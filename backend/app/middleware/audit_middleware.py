# backend/app/middleware/audit_middleware.py
"""
Har mutating API call (POST/PUT/PATCH/DELETE) automatically AuditLog me
capture karta hai — bina kisi existing route ko touch kiye. Ye File 4 hai
jo pehli baar audit_logs table ko actually populate karna shuru karega.

Kaise kaam karta hai:
  1. before_request  -> timer start + request context (IP/browser/OS/request_id)
                         ek baar compute karke g pe cache kar deta hai.
  2. after_request   -> agar method mutating hai aur route ne khud
                         (audit_service.log_action ke through) already ek
                         RICH row nahi likhi, to ek GENERIC row likhta hai
                         (module/submodule = blueprint.endpoint se inferred,
                         action = HTTP method se inferred). Agar route ne
                         khud rich row likh di thi (old_value/new_value ke
                         saath), to ye sirf uss row ka status_code aur
                         execution_time_ms patch karta hai — duplicate row
                         kabhi nahi banti.

Jaan-boojh kar SKIP kiya gaya scope (future files ka kaam):
  - GET requests: audit_logs table ki sabse badi growth-risk read traffic
    se hoti (10,000+ schools scale pe), aur "kisne kya dekha" audit ka
    core purpose nahi hai — sirf mutations track hoti hain.
  - Company-side actions (CEO/Super Admin bina school_id ke): explicit
    log_company_action() calls se aayenge, generic middleware se nahi —
    (audit.py model docstring: "school logs se kabhi mix nahi").
  - LoginHistory: auth.py me explicit calls se aayega (agla chhota step),
    kyunki failure_reason (invalid password vs user not found) sirf
    business logic ko pata hota hai, generic middleware ko nahi.
  - 500 errors jo unhandled exception se aate hain: Flask un cases me
    after_request skip kar deta hai jab tak error_middleware.py (File 5 —
    global exception handler) na lag jaye. Wahi unhandled exceptions ko
    ErrorLog me bhejega; ye middleware sirf successfully-returned
    responses (4xx/2xx) ko audit karta hai.
"""

import time
from flask import request, g

from app import db
from app.utils.request_context import capture_request_context
from app.models.audit import log_school_action

MUTATING_METHODS = {'POST', 'PUT', 'PATCH', 'DELETE'}

# Ye prefixes kabhi bhi generic-audit nahi hote — inbound webhooks user
# action nahi hain, aur auth endpoints ka apna explicit LoginHistory flow
# aayega (upar docstring dekho).
EXCLUDED_PREFIXES = (
    '/api/webhooks',
    '/api/auth/login',
    '/api/auth/student-login',
    '/api/auth/refresh',
)


def register_audit_middleware(app):
    """create_app() se ek baar call hoga — app/__init__.py me wire karna hai."""

    @app.before_request
    def _audit_start_timer():
        g.request_start_time = time.time()
        g.audit_already_logged = False
        g.audit_row_id = None
        # Context ko yahin bhi eagerly compute kar dena taaki route ke
        # beech me audit_service.log_action() call ho to cache-hit mile.
        try:
            g.audit_meta = capture_request_context()
        except Exception:
            g.audit_meta = {}

    @app.after_request
    def _audit_finalize(response):
        try:
            _finalize_audit_row(response)
        except Exception as e:
            db.session.rollback()
            app.logger.warning(f'Audit middleware skipped for this request: {e}')
        return response

    return app


def _finalize_audit_row(response):
    if request.method == 'OPTIONS':
        return
    if request.method not in MUTATING_METHODS:
        return
    if any(request.path.startswith(p) for p in EXCLUDED_PREFIXES):
        return

    elapsed_ms = None
    if hasattr(g, 'request_start_time'):
        elapsed_ms = int((time.time() - g.request_start_time) * 1000)

    # Case A: route ne khud audit_service.log_action() call karke pehle
    # se ek rich row bana li thi (old_value/new_value ke saath) — us row
    # ko sirf status_code / execution_time_ms se patch karo, naya mat banao.
    if getattr(g, 'audit_already_logged', False):
        row_id = getattr(g, 'audit_row_id', None)
        if row_id:
            from app.models.audit import AuditLog
            row = AuditLog.query.get(row_id)
            if row:
                row.status_code = response.status_code
                row.execution_time_ms = elapsed_ms
                db.session.commit()
        return

    # Case B: koi rich row nahi bani — generic auto-capture.
    from app.utils.decorators import get_current_user
    try:
        user = get_current_user()
    except Exception:
        user = None

    if not user or not getattr(user, 'school_id', None):
        # Company-side (no school_id) actions generic middleware se nahi
        # jaatin — explicit log_company_action() se aayengi.
        return

    endpoint = request.endpoint or ''
    parts = endpoint.split('.', 1)
    module = parts[0] if parts and parts[0] else 'unknown'
    submodule = parts[1] if len(parts) > 1 else None

    if response.status_code >= 400:
        action = 'API_ERROR'
    else:
        action = {
            'POST': 'CREATE', 'PUT': 'UPDATE', 'PATCH': 'UPDATE', 'DELETE': 'DELETE',
        }.get(request.method, 'UPDATE')

    meta = dict(getattr(g, 'audit_meta', {}) or {})
    meta['status_code'] = response.status_code
    meta['execution_time_ms'] = elapsed_ms

    log_school_action(
        school_id=user.school_id,
        user=user,
        module=module,
        submodule=submodule,
        action=action,
        request_meta=meta,
        remarks='auto-captured (no explicit audit_service call in this route)',
    )
    db.session.commit()
