# backend/app/middleware/error_middleware.py
"""
Global exception handler — koi bhi unhandled exception (chahe route me ho,
service layer me, ya DB query me) yahan aake ErrorLog me capture hoti hai.
developer_center.py ka `log_error()` / `make_fingerprint()` isi file se
call hote hain.

Security Sanitization:
- Sensitive headers and payload fields (passwords, tokens, cookies, secrets, payment data) are redacted.
- Exception messages are sanitized against JWT, DB connection passwords, tokens, and OTP codes.
- Database rollback is executed first to prevent broken transaction cascading.
"""

import re
import traceback
from flask import request, jsonify, g
from werkzeug.exceptions import HTTPException

from app import db
from app.models.developer_center import log_error, make_fingerprint
from app.utils.request_context import capture_request_context

REDACT_KEYS = {
    'password', 'confirm_password', 'old_password', 'new_password', 'plain_password_temp',
    'token', 'access_token', 'refresh_token', 'authorization', 'auth', 'bearer',
    'cookie', 'cookies', 'set-cookie', 'x-csrf-token', 'csrf_token', 'session', 'sessionid',
    'otp', 'secret', 'app_secret', 'api_key', 'x-api-key', 'encryption_key', 'secret_key',
    'card', 'cvv', 'cvv2', 'card_number', 'pan', 'pin', 'expiry',
    'private_key', 'certificate', 'signature', 'message'
}

# Regex patterns for sanitizing exception strings and stack messages
JWT_PATTERN          = re.compile(r'eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]+')
DB_URI_PWD_PATTERN   = re.compile(r'(://[^:]+:)([^@]+)(@)')
BEARER_PATTERN       = re.compile(r'(Bearer\s+)[a-zA-Z0-9._~+/-]+=*', re.IGNORECASE)
OTP_PATTERN          = re.compile(r'(otp\s*[:=]\s*)(\d{4,8})', re.IGNORECASE)

ERROR_TYPE_RULES = [
    ('IntegrityError',        'SQL'),
    ('DataError',             'SQL'),
    ('OperationalError',      'SQL'),
    ('SQLAlchemyError',       'SQL'),
    ('ValidationError',       'VALIDATION'),
    ('JWTExtendedException',  'AUTH'),
    ('NoAuthorizationError',  'AUTH'),
    ('ExpiredSignatureError', 'AUTH'),
    ('RequestException',      'EXTERNAL_API'),
    ('ConnectionError',       'EXTERNAL_API'),
    ('Timeout',               'EXTERNAL_API'),
]

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
            return exc

        status_code = getattr(exc, 'code', 500) or 500

        # MUST rollback before touching db.session again
        db.session.rollback()

        try:
            _capture_error(exc, status_code)
            db.session.commit()
        except Exception as log_failure:
            db.session.rollback()
            app.logger.error(f'error_middleware failed to log the original error: {log_failure}')

        request_id = getattr(g, '_request_context_cache', {}).get('request_id')
        resp = jsonify({
            'error': 'Internal server error',
            'request_id': request_id,
        })
        origin = request.headers.get('Origin')
        from app.utils.security_headers import is_cors_origin_allowed, apply_security_headers
        if origin and is_cors_origin_allowed(origin):
            resp.headers['Access-Control-Allow-Origin'] = origin
            resp.headers['Access-Control-Allow-Credentials'] = 'true'
            resp.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
            req_headers = request.headers.get('Access-Control-Request-Headers')
            resp.headers['Access-Control-Allow-Headers'] = req_headers or 'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-Client-Page, X-Client-Action'
            resp.headers['Access-Control-Expose-Headers'] = 'Content-Type, Authorization'
        apply_security_headers(resp)
        return resp, status_code

    return app


def _redact(data):
    """Recursively blanks out sensitive keys in a dict or list. Non-dict input passed through."""
    if isinstance(data, dict):
        redacted = {}
        for key, value in data.items():
            if str(key).lower() in REDACT_KEYS:
                redacted[key] = '***REDACTED***'
            elif isinstance(value, (dict, list)):
                redacted[key] = _redact(value)
            else:
                redacted[key] = value
        return redacted
    elif isinstance(data, list):
        return [_redact(item) for item in data]
    return data


def _sanitize_string(text):
    """Strips JWTs, DB connection credentials, and OTPs from freeform error text."""
    if not text:
        return ''
    cleaned = str(text)
    cleaned = JWT_PATTERN.sub('[REDACTED_JWT]', cleaned)
    cleaned = DB_URI_PWD_PATTERN.sub(r'\1***REDACTED***\3', cleaned)
    cleaned = BEARER_PATTERN.sub(r'\1***REDACTED***', cleaned)
    cleaned = OTP_PATTERN.sub(r'\1***REDACTED***', cleaned)
    return cleaned


def _classify_error_type(exc):
    exc_chain_names = [type(exc).__name__] + [type(c).__name__ for c in _cause_chain(exc)]
    for name in exc_chain_names:
        for pattern, error_type in ERROR_TYPE_RULES:
            if pattern in name:
                return error_type
    return 'UNKNOWN'


def _cause_chain(exc):
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
        elif request.form:
            payload = _redact(request.form.to_dict())
    except Exception:
        payload = None

    # Sanitize headers
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
    sanitized_msg = _sanitize_string(str(exc))[:2000]
    sanitized_stack = _sanitize_string(traceback.format_exc())[:8000]

    log_error(fingerprint, defaults={
        'product_id':        None,
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
        'exception_message': sanitized_msg,
        'stack_trace':       sanitized_stack,
        'error_type':        error_type,
        'severity':          severity,
        'status':            'NEW',
        'ip_address':        meta.get('ip_address'),
        'browser':           meta.get('browser'),
        'os':                meta.get('os'),
        'request_id':        meta.get('request_id'),
    })
