# backend/app/services/audit_service.py
"""
Centralized Enterprise Audit Service — OnePlatform360 / EduERP.

Handles:
- Recording audit events across all business modules
- Field-level diffing between old_value and new_value
- Sensitive data masking (passwords, tokens, OTPs)
- Automatic delegation linkage for substitute teachers
- Resilient non-blocking database persistence
"""

import json
import logging
from flask import g
from app import db
from app.models.audit import log_school_action, AUDIT_ACTIONS, purge_school_logs
from app.utils.request_context import capture_request_context

logger = logging.getLogger(__name__)

# Keys to strictly scrub/mask before saving into audit tables
SENSITIVE_KEYS = {
    'password', 'password_hash', 'plain_password_temp', 'token',
    'access_token', 'refresh_token', 'secret', 'otp', 'otp_hash',
    'secret_key', 'api_key', 'jwt_payload', 'authorization'
}

# Fields to ignore during diff calculation
NOISY_DIFF_KEYS = {'updated_at', 'created_at'}


def _mask_sensitive_dict(d):
    """Recursively masks passwords, secrets, and auth tokens."""
    if not isinstance(d, dict):
        return d
    cleaned = {}
    for k, v in d.items():
        if any(sens in k.lower() for sens in SENSITIVE_KEYS):
            cleaned[k] = '[REDACTED]'
        elif isinstance(v, dict):
            cleaned[k] = _mask_sensitive_dict(v)
        elif isinstance(v, list):
            cleaned[k] = [_mask_sensitive_dict(item) if isinstance(item, dict) else item for item in v]
        else:
            cleaned[k] = v
    return cleaned


def compute_changed_fields(old_val, new_val):
    """
    Computes a clean dictionary of changed fields:
    { "field_name": { "old": old_val, "new": new_val } }
    """
    if not isinstance(old_val, dict) or not isinstance(new_val, dict):
        return None

    changes = {}
    all_keys = set(old_val.keys()).union(set(new_val.keys()))

    for k in all_keys:
        if k in NOISY_DIFF_KEYS:
            continue
        v_old = old_val.get(k)
        v_new = new_val.get(k)

        # Normalize string representations for comparison
        str_old = str(v_old) if v_old is not None else ''
        str_new = str(v_new) if v_new is not None else ''

        if str_old != str_new:
            # Mask if sensitive
            if any(sens in k.lower() for sens in SENSITIVE_KEYS):
                v_old = '[REDACTED]'
                v_new = '[REDACTED]'
            changes[k] = {'old': v_old, 'new': v_new}

    return changes if len(changes) > 0 else None


def record_audit_event(
    module='GENERAL', action='UPDATE',
    submodule=None,
    entity_type=None, entity_id=None,
    old_value=None, new_value=None,
    student_id=None, teacher_id=None,
    class_id=None, subject_id=None,
    delegation_id=None,
    status='SUCCESS', severity='INFO',
    remarks=None, user=None, school_id=None,
    actor_user_id=None, **kwargs
):
    """
    Primary API to record any auditable operation in the ERP.
    """
    # 1. Resolve user and school_id
    if user is None and actor_user_id:
        from app.models.user import User
        user = User.query.get(actor_user_id)

    if user is None:
        from app.utils.decorators import get_current_user
        try:
            user = get_current_user()
        except Exception:
            user = None

    if not school_id and user:
        school_id = getattr(user, 'school_id', None)

    if not school_id:
        return None

    # 2. Mask sensitive fields
    safe_old = _mask_sensitive_dict(old_value) if isinstance(old_value, dict) else old_value
    safe_new = _mask_sensitive_dict(new_value) if isinstance(new_value, dict) else new_value

    # 3. Compute changed fields
    changed_fields = compute_changed_fields(safe_old, safe_new)

    # 4. Auto-detect active delegation if not passed explicitly
    is_delegated = False
    if delegation_id:
        is_delegated = True
    elif user and getattr(user, 'role', None) and getattr(user.role, 'value', '') == 'TEACHER':
        try:
            from app.services.teacher_delegation_service import get_active_teacher_delegations_for_user
            active_dels = get_active_teacher_delegations_for_user(
                user, class_id=class_id, subject_id=subject_id
            )
            if active_dels and len(active_dels) > 0:
                delegation_id = active_dels[0].id
                is_delegated = True
        except Exception:
            pass

    # 5. Capture context
    meta = dict(getattr(g, 'audit_meta', None) or {})
    if not meta:
        try:
            meta = capture_request_context()
        except Exception:
            meta = {}

    try:
        row = log_school_action(
            school_id=school_id,
            user=user,
            module=str(module).upper(),
            submodule=submodule,
            action=str(action).upper(),
            entity_type=entity_type,
            entity_id=entity_id,
            student_id=student_id,
            teacher_id=teacher_id,
            class_id=class_id,
            subject_id=subject_id,
            delegation_id=delegation_id,
            is_delegated=is_delegated,
            old_value=safe_old,
            new_value=safe_new,
            changed_fields=changed_fields,
            status=status,
            severity=severity,
            request_meta=meta,
            remarks=remarks,
        )
        db.session.commit()

        # Mark request context so audit_middleware avoids duplicate generic rows
        g.audit_already_logged = True
        g.audit_row_id = row.id
        return row
    except Exception as e:
        db.session.rollback()
        logger.warning(f"Failed to record audit event: {e}")
        return None


def log_action(module, action, old_value=None, new_value=None,
                submodule=None, remarks=None, user=None):
    """
    Backward-compatible entry point for existing code.
    Calls record_audit_event internally.
    """
    return record_audit_event(
        module=module,
        action=action,
        submodule=submodule,
        old_value=old_value,
        new_value=new_value,
        remarks=remarks,
        user=user
    )
