# backend/app/middleware/error_middleware.py
"""
Global exception handler — koi bhi unhandled exception (chahe route me ho,
service layer me, ya DB query me) yahan aake ErrorLog me capture hoti hai.
developer_center.py ka `log_error()` / `make_fingerprint()` isi file se
call hote hain (jaisa developer_center.py ke docstring me already likha tha).

Scope (jaan-boojh kar):
  - Sirf TRUE errors log hote hain: unhandled Python exceptions, aur
    HTTPException jinka code >= 500. Normal `abort(404)` / `abort(400)`
    jaisi cheezein yahan SE NAHI aatin — wo route ka expected behaviour
    hai, developer ka bug nahi. Unhe log karna to sirf noise badhayega.
  - session.rollback() SABSE PEHLE, ErrorLog insert se bhi pehle. Jis query
    ne exception throw ki thi wahi session ko dirty chhod jaati hai —
    rollback ke bina ErrorLog ka apna INSERT bhi usi transaction me fail
    ho jayega (aur phir dusra exception, is baar humare apne logging code
    se, jo silently poori request ko 500 loop me daal sakta hai).
  - Sensitive fields (password/token/otp/secret/card/cvv/authorization)
    payload aur headers dono se redact hote hain STORE karne se pehle —
    ErrorLog.payload permanent DB row hai, ismein kabhi bhi raw credential
    nahi jaani chahiye.

Side-effect worth knowing: is file ke lagne se pehle, unhandled 500s par
Flask ka after_request (audit_middleware.py) shayad nahi chalta tha (Flask
un exceptions ko "unhandled" treat karta hai jab tak koi errorhandler na
ho). Ab errorhandler register hone ke baad, Flask exception ko "handled"
maanega aur ek response banayega — jisse audit_middleware.py bhi ab in
requests ko dekh payega aur unhe API_ERROR mark kar payega. Dono middleware
ab consistent kaam karenge.
"""

import re
import traceback
from flask import request, jsonify, g
from werkzeug.exceptions import HTTPException

from app import db
from app.models.developer_center import log_error, make_fingerprint
from app.utils.request_context import capture_request_context

REDACT_KEYS = {
    'password', 'confirm_password', 'old_password', 'new_password',
    'token', 'access_token', 'refresh_token', 'authorization',
    'otp', 'secret', 'api_key', 'card', 'cvv', 'plain_password_temp',
}

# Exception class name (or substring) -> error_type. Checked in order,
# first match wins. Kept as a simple name-match instead of isinstance
# checks against optional libraries (sqlalchemy/marshmallow/requests) so
# this file has zero hard imports beyond what's already a dependency.
ERROR_TYPE_RULES = [
    ('IntegrityError',        'SQL'),
    ('DataError',             'SQL'),
    ('OperationalError',      'SQL'),
    ('SQLAlchemyError',       'SQL'),
    ('ValidationError',       'VALIDATION'),
    ('JWTExtendedException',  'AUTH'),
    ('NoAuthorizationError',  'AUTH'),
    ('ExpiredSignatureError', 'AUTH'),
    ('RequestException',      'EXTERNAL_API'),   # requests library
    ('ConnectionError',       'EXTERNAL_API'),
    ('Timeout',               'EXTERNAL_API'),
]

# error_type -> severity. SQL issues risk data integrity (CRITICAL).
# External dependency failures (WhatsApp/Payment/Email/Cloudinary/OTP) are
# urgent but not data-corrupting (HIGH). Validation reaching this far
# means a route forgot to catch it itself, usually not user-facing danger
# (MEDIUM).
SEVERITY_BY_ERROR_TYPE = {
    'SQL':           'CRITICAL',
    'AUTH':          'HIGH',
    'EXTERNAL_API':  'HIGH',
    'OTP':           'HIGH',
    'WHATSAPP':      'HIGH',
    'PAYMENT':       'HIGH',
    'EMAIL':         'HIGH',
    'CLOUDINARY':    'HIGH',
    'VALIDATION':    'MEDIUM',
    'UNKNOWN':       'HIGH',
}


def register_error_middleware(app):
    """create_app() se ek baar call hoga — app/__init__.py me wire karna hai."""

    @app.errorhandler(Exception)
    def _handle_uncaught_exception(exc):
        if isinstance(exc, HTTPException) and exc.code < 500:
            # Normal HTTP flow (404/400/403/...) — not a developer-facing error.
            return exc

        status_code = getattr(exc, 'code', 500) or 500

        # MUST rollback before touching db.session again — see module docstring.
        db.session.rollback()

        try:
            _capture_error(exc, status_code)
            db.session.commit()
        except Exception as log_failure:
            # Logging itself must never be why the request fails harder.
            db.session.rollback()
            app.logger.error(f'error_middleware failed to log the original error: {log_failure}')

        request_id = getattr(g, '_request_context_cache', {}).get('request_id')
        return jsonify({
            'error': 'Internal server error',
            'request_id': request_id,
        }), status_code

    return app


def _redact(data):
    """Recursively blanks out sensitive keys in a dict. Non-dict input passed through."""
    if not isinstance(data, dict):
        return data
    redacted = {}
    for key, value in data.items():
        if key.lower() in REDACT_KEYS:
            redacted[key] = '***REDACTED***'
        elif isinstance(value, dict):
            redacted[key] = _redact(value)
        else:
            redacted[key] = value
    return redacted


def _classify_error_type(exc):
    exc_chain_names = [type(exc).__name__] + [type(c).__name__ for c in _cause_chain(exc)]
    for name in exc_chain_names:
        for pattern, error_type in ERROR_TYPE_RULES:
            if pattern in name:
                return error_type
    return 'UNKNOWN'


def _cause_chain(exc):
    """Walks __cause__/__context__ so a wrapped exception still classifies correctly."""
    chain = []
    current = exc
    seen = set()
    while current is not None and id(current) not in seen:
        seen.add(id(current))
        nxt = current.__cause__ or current.__context__
        if nxt is None:
            break
        chain.append(nxt)
        current = nxt
    return chain


def _top_stack_frame(exc):
    """Returns a stable 'file.py:line in function' string for fingerprinting."""
    tb = traceback.extract_tb(exc.__traceback__)
    if not tb:
        return 'unknown:0'
    frame = tb[-1]
    return f'{frame.filename}:{frame.lineno} in {frame.name}'


def _capture_error(exc, status_code):
    from app.utils.decorators import get_current_user
    try:
        user = get_current_user()
    except Exception:
        user = None

    meta = {}
    try:
        meta = capture_request_context()
    except Exception:
        pass

    payload = None
    try:
        if request.is_json:
            payload = _redact(request.get_json(silent=True) or {})
    except Exception:
        payload = None

    headers = _redact({k: v for k, v in request.headers.items()})

    error_type = _classify_error_type(exc)
    severity = SEVERITY_BY_ERROR_TYPE.get(error_type, 'HIGH')
    stack_top = _top_stack_frame(exc)

    fingerprint = make_fingerprint(
        error_type=error_type,
        api_endpoint=request.path,
        exception_type=type(exc).__name__,
        stack_top_line=stack_top,
    )

    import json
    log_error(fingerprint, defaults={
        'product_id':        None,   # SCHOOL_ERP-only today; set once other products exist
        'school_id':         getattr(user, 'school_id', None) if user else None,
        'user_id':           user.id if user else None,
        'role_snapshot':     user.role.value if user and getattr(user, 'role', None) else None,
        'module':            (request.endpoint or 'unknown').split('.', 1)[0],
        'page':              request.headers.get('X-Client-Page'),
        'button_clicked':    request.headers.get('X-Client-Action'),
        'api_endpoint':      request.path,
        'http_method':       request.method,
        'payload':           json.dumps(payload) if payload is not None else None,
        'headers':           json.dumps(headers),
        'exception_type':    type(exc).__name__,
        'exception_message': str(exc)[:2000],
        'stack_trace':       traceback.format_exc()[:8000],
        'error_type':        error_type,
        'severity':          severity,
        'status':            'NEW',
        'ip_address':        meta.get('ip_address'),
        'browser':           meta.get('browser'),
        'os':                meta.get('os'),
        'request_id':        meta.get('request_id'),
    })
