# backend/app/services/audit_service.py
"""
Routes se explicitly call karne ke liye — jab generic auto-capture
(audit_middleware.py) kaafi nahi hai aur old_value/new_value ka real
before/after snapshot chahiye (e.g. FeeStructure update, Role/Permission
change, User deactivate).

Usage (kisi bhi route ke andar, ek line):

    from app.services.audit_service import log_action

    old_snapshot = fee_structure.to_dict()
    fee_structure.amount = new_amount
    db.session.commit()
    log_action(
        module='fees', submodule='fee_structure', action='UPDATE',
        old_value=old_snapshot, new_value=fee_structure.to_dict(),
    )

Ye function call karne ke baad audit_middleware.py apne aap generic row
nahi banayega — g.audit_already_logged flag set ho jaata hai, isliye
ek hi request me duplicate audit row kabhi nahi banti (middleware sirf
status_code/execution_time is row pe patch karega).
"""

from flask import g

from app import db
from app.models.audit import log_school_action, AUDIT_ACTIONS
from app.utils.request_context import capture_request_context


def log_action(module, action, old_value=None, new_value=None,
                submodule=None, remarks=None, user=None):
    """
    Returns the created AuditLog row, ya None agar user school-scoped nahi
    hai (company-side actions ke liye log_company_action() use karo, alag
    function — see app/models/audit.py).
    """
    if action not in AUDIT_ACTIONS:
        raise ValueError(f"Unknown audit action '{action}'. Valid: {AUDIT_ACTIONS}")

    if user is None:
        from app.utils.decorators import get_current_user
        try:
            user = get_current_user()
        except Exception:
            user = None

    if not user or not getattr(user, 'school_id', None):
        return None

    meta = dict(getattr(g, 'audit_meta', None) or capture_request_context())

    row = log_school_action(
        school_id=user.school_id,
        user=user,
        module=module,
        submodule=submodule,
        action=action,
        old_value=old_value,
        new_value=new_value,
        request_meta=meta,
        remarks=remarks,
    )

    # Commit turant taaki row.id mil jaaye — audit_middleware baad me
    # (response ban jaane ke baad) sirf status_code/execution_time patch
    # karega, is row ko dobara insert nahi karega.
    db.session.commit()

    g.audit_already_logged = True
    g.audit_row_id = row.id
    return row
