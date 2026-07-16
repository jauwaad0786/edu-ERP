# backend/app/utils/request_context.py
"""
Har request se IP / browser / OS / request_id / session_id nikaalne ka
SHARED utility — audit_middleware.py aur (future) error_middleware.py
dono isi function ko reuse karenge, taaki logic do jagah duplicate na ho.

Design decisions:
  - Koi 'user-agent parsing' external library add nahi ki (jaise `user-agents`
    PyPI package) — requirements.txt already lean hai (Redis/Celery bhi abhi
    tak jaan-boojh kar nahi hai, jab tak infra decision final nahi hota).
    Werkzeug ka built-in request.user_agent ab khud parse nahi karta
    (Werkzeug 2.1+ ke baad), isliye ek chhota regex-based parser likha hai —
    zero extra dependency, production me kaam chalane ke liye kaafi accurate.
  - IP address: Render jaisi platforms reverse-proxy ke peeche chalti hain,
    isliye X-Forwarded-For header pehle check hota hai, request.remote_addr
    sirf local/dev fallback hai.
  - request_id: agar frontend/gateway already 'X-Request-ID' bhej raha hai
    to wahi reuse hota hai (distributed tracing ke liye), warna naya uuid4
    generate hota hai. Ek hi request ke andar flask.g pe cache hota hai
    taaki audit row aur error row (agar dono banein) same request_id share
    karein — yehi correlation key hai jo AuditLog.request_id aur future
    ErrorLog.request_id ko jodta hai.
"""

import re
import uuid
from flask import request, g


# ── Browser / OS regex parser (dependency-free) ─────────────────────────────

_BROWSER_PATTERNS = [
    ('Edge',    r'Edg/'),
    ('Opera',   r'OPR/|Opera/'),
    ('Chrome',  r'Chrome/'),
    ('Firefox', r'Firefox/'),
    ('Safari',  r'Version/.*Safari/'),
    ('IE',      r'MSIE |Trident/'),
]

_OS_PATTERNS = [
    ('Windows', r'Windows'),
    ('Mac OS',  r'Mac OS X'),
    ('Android', r'Android'),
    ('iOS',     r'iPhone|iPad|iPod'),
    ('Linux',   r'Linux'),
]


def _parse_user_agent(ua_string):
    """Returns (browser, os) tuple. 'Unknown' agar match na ho ya UA hi na ho."""
    if not ua_string:
        return 'Unknown', 'Unknown'

    browser = next(
        (name for name, pattern in _BROWSER_PATTERNS if re.search(pattern, ua_string)),
        'Unknown',
    )
    os_name = next(
        (name for name, pattern in _OS_PATTERNS if re.search(pattern, ua_string)),
        'Unknown',
    )
    return browser, os_name


# ── IP address (proxy-aware) ─────────────────────────────────────────────────

def _get_client_ip():
    """
    Render/most PaaS ek reverse proxy ke peeche app chalate hain — direct
    request.remote_addr proxy ka IP dega, real client ka nahi. X-Forwarded-For
    ka pehla entry hi asli client hota hai (baaki intermediate proxies).
    """
    xff = request.headers.get('X-Forwarded-For', '')
    if xff:
        return xff.split(',')[0].strip()
    return request.remote_addr or 'Unknown'


# ── JWT session id (jti) — safe, works even on unauthenticated requests ────

def _get_session_id():
    try:
        from flask_jwt_extended import get_jwt, verify_jwt_in_request
        verify_jwt_in_request(optional=True)
        claims = get_jwt()
        return claims.get('jti') if claims else None
    except Exception:
        return None


# ── Request id (reuse incoming header, else generate) ───────────────────────

def _get_request_id():
    incoming = request.headers.get('X-Request-ID')
    return incoming or str(uuid.uuid4())


# ── Public entrypoint ────────────────────────────────────────────────────────

def capture_request_context():
    """
    Ek hi request ke lifetime me sirf ek baar compute hota hai — flask.g pe
    cache hota hai, so audit_middleware ka before_request aur koi bhi route
    jo beech me audit_service.log_action() call kare, dono ko same dict
    milega (same request_id, same IP/browser/OS).
    """
    if hasattr(g, '_request_context_cache'):
        return g._request_context_cache

    browser, os_name = _parse_user_agent(request.headers.get('User-Agent', ''))

    meta = {
        'ip_address':   _get_client_ip(),
        'browser':      browser,
        'os':           os_name,
        'session_id':   _get_session_id(),
        'request_id':   _get_request_id(),
        'api_endpoint': request.path,
        'http_method':  request.method,
    }
    g._request_context_cache = meta
    return meta
