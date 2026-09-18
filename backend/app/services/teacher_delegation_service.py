# backend/app/services/teacher_delegation_service.py
"""
Teacher Delegation Service — Enterprise School Temporary Access Engine.

Enforces:
- Scoped delegation (Class, Subject, Period)
- Granular permissions (ATTENDANCE_MARK, MARKS_ENTER, etc.)
- Multi-tenancy (both teachers, classes, subjects must belong to the same school)
- Strict forbidden permission boundary (no administrative or role mutation)
- Real-time time window enforcement (starts_at <= now <= expires_at)
- Conflict detection (overlapping time & scope)
- Immutable audit logging on create, revoke, and execute
"""

import logging
from datetime import datetime
from app.utils.timezone_util import utc_now
from flask import g
from app import db
from app.models.academic import Teacher, Class, Subject
from app.models.user import User, UserRole
from app.models.delegation import (
    TeacherDelegation, TeacherDelegationScope, TeacherDelegationPermission
)
from app.services.audit_service import log_action

logger = logging.getLogger(__name__)


def validate_delegation_request(school_id, source_teacher_id, delegate_teacher_id,
                                starts_at, expires_at, scopes, permissions):
    """
    Validates input parameters before creating a delegation.
    Returns (True, None) or (False, error_message).
    """
    # 1. No self-delegation
    if source_teacher_id == delegate_teacher_id:
        return False, "Absent teacher and substitute teacher cannot be the same person."

    # 2. Source teacher verification
    source_teacher = Teacher.query.filter_by(id=source_teacher_id, school_id=school_id).first()
    if not source_teacher:
        return False, "Source teacher not found in this school."
    if getattr(source_teacher, 'is_deleted', False):
        return False, "Source teacher account is deleted or inactive."
    if not source_teacher.user or not source_teacher.user.is_active:
        return False, "Source teacher user account is deactivated."

    # 3. Delegate teacher verification
    delegate_teacher = Teacher.query.filter_by(id=delegate_teacher_id, school_id=school_id).first()
    if not delegate_teacher:
        return False, "Substitute teacher not found in this school."
    if getattr(delegate_teacher, 'is_deleted', False):
        return False, "Substitute teacher account is deleted or inactive."
    if not delegate_teacher.user or not delegate_teacher.user.is_active:
        return False, "Substitute teacher user account is deactivated."

    # Disallow delegating to students, parents, super admin
    if delegate_teacher.user.role in (UserRole.STUDENT, UserRole.PARENT, UserRole.SUPER_ADMIN):
        return False, "Delegation can only be granted to active faculty/staff."

    # 4. Dates validation
    now = utc_now()
    if starts_at >= expires_at:
        return False, "End date/time must be strictly after start date/time."
    if expires_at <= now:
        return False, "End date/time must be in the future."

    # 5. Permissions validation
    if not permissions or len(permissions) == 0:
        return False, "At least one operational permission must be selected."

    valid_codes = TeacherDelegationPermission.VALID_PERMISSIONS
    forbidden_codes = TeacherDelegationPermission.FORBIDDEN_PERMISSIONS

    for code in permissions:
        if code in forbidden_codes:
            return False, f"Permission '{code}' is high-privilege and cannot be delegated to teachers."
        if code not in valid_codes:
            return False, f"Invalid permission code: '{code}'."

    # 6. Scopes validation
    if not scopes or len(scopes) == 0:
        return False, "At least one class scope must be selected."

    for scope in scopes:
        cid = scope.get('class_id')
        if not cid:
            return False, "Class ID is required for each scope."
        cls = Class.query.filter_by(id=cid, school_id=school_id).first()
        if not cls:
            return False, f"Class ID {cid} does not belong to this school."

        sid = scope.get('subject_id')
        if sid:
            subj = Subject.query.filter_by(id=sid, class_id=cid, school_id=school_id).first()
            if not subj:
                return False, f"Subject ID {sid} is not assigned to Class {cls.name} {cls.section}."

    return True, None


def check_delegation_conflicts(school_id, delegate_teacher_id, starts_at, expires_at, scopes):
    """
    Checks for potential scheduling conflicts and duplicate delegations.
    Returns list of warning dicts: [{'type': 'WARNING'|'ERROR', 'message': '...'}]
    """
    conflicts = []
    now = utc_now()

    # Find active or scheduled delegations for the substitute teacher that overlap in time
    overlapping_dels = TeacherDelegation.query.filter(
        TeacherDelegation.school_id == school_id,
        TeacherDelegation.delegate_teacher_id == delegate_teacher_id,
        TeacherDelegation.revoked_at.is_(None),
        TeacherDelegation.status != 'REVOKED',
        TeacherDelegation.expires_at > now,
        TeacherDelegation.starts_at < expires_at,
        TeacherDelegation.expires_at > starts_at,
    ).all()

    for del_item in overlapping_dels:
        for ex_scope in del_item.scopes:
            for new_scope in scopes:
                if ex_scope.class_id == new_scope.get('class_id'):
                    # Same class
                    if (not ex_scope.subject_id) or (not new_scope.get('subject_id')) or (ex_scope.subject_id == new_scope.get('subject_id')):
                        c_name = f"{ex_scope.class_ref.name} {ex_scope.class_ref.section}" if ex_scope.class_ref else f"Class {ex_scope.class_id}"
                        s_name = ex_scope.subject_ref.name if ex_scope.subject_ref else "All Subjects"
                        conflicts.append({
                            'type': 'CONFLICT',
                            'message': f"Substitute teacher already has an active/scheduled delegation for {c_name} ({s_name}) during overlapping period ({del_item.starts_at.strftime('%d %b %Y')} to {del_item.expires_at.strftime('%d %b %Y')}).",
                            'existing_delegation_id': del_item.id
                        })

    # Check if the substitute teacher ALREADY permanently teaches any of the requested class/subjects
    for new_scope in scopes:
        cid = new_scope.get('class_id')
        sid = new_scope.get('subject_id')
        if sid:
            permanent_subj = Subject.query.filter_by(id=sid, class_id=cid, teacher_id=delegate_teacher_id).first()
            if permanent_subj:
                conflicts.append({
                    'type': 'REDUNDANT',
                    'message': f"Substitute teacher is already the permanent teacher for {permanent_subj.name}. Delegation is not needed for this subject.",
                })

    return conflicts


def create_teacher_delegation(school_id, creator_user_id, session, source_teacher_id,
                              delegate_teacher_id, starts_at, expires_at, reason, notes,
                              scopes, permissions):
    """
    Creates a new teacher delegation with associated scopes and permissions.
    """
    # 1. Validate
    is_valid, err_msg = validate_delegation_request(
        school_id, source_teacher_id, delegate_teacher_id, starts_at, expires_at, scopes, permissions
    )
    if not is_valid:
        raise ValueError(err_msg)

    now = utc_now()
    initial_status = 'ACTIVE' if (starts_at <= now <= expires_at) else 'SCHEDULED'

    delegation = TeacherDelegation(
        school_id=school_id,
        source_teacher_id=source_teacher_id,
        delegate_teacher_id=delegate_teacher_id,
        session=session or '2024-25',
        starts_at=starts_at,
        expires_at=expires_at,
        status=initial_status,
        reason=reason[:500] if reason else None,
        notes=notes if notes else None,
        created_by=creator_user_id,
        created_at=now,
        updated_at=now,
    )
    db.session.add(delegation)
    db.session.flush()  # populate delegation.id

    # 2. Add scopes
    for sc in scopes:
        scope_entry = TeacherDelegationScope(
            delegation_id=delegation.id,
            class_id=sc['class_id'],
            subject_id=sc.get('subject_id') or None,
            period_id=sc.get('period_id') or None,
        )
        db.session.add(scope_entry)

    # 3. Add permissions
    for perm_code in set(permissions):
        perm_entry = TeacherDelegationPermission(
            delegation_id=delegation.id,
            permission_code=perm_code.strip(),
        )
        db.session.add(perm_entry)

    db.session.commit()

    # 4. Audit Log
    try:
        creator_user = User.query.get(creator_user_id)
        log_action(
            module='staff',
            submodule='delegations',
            action='CREATE',
            new_value={
                'delegation_id': delegation.id,
                'source_teacher_id': source_teacher_id,
                'delegate_teacher_id': delegate_teacher_id,
                'starts_at': starts_at.isoformat(),
                'expires_at': expires_at.isoformat(),
                'permissions': list(permissions),
                'scopes_count': len(scopes),
                'reason': reason,
            },
            remarks=f"Delegated {len(permissions)} permissions to teacher {delegate_teacher_id} for {len(scopes)} scopes.",
            user=creator_user
        )
    except Exception as audit_err:
        logger.warning(f"Audit log failed for delegation creation: {audit_err}")

    return delegation


def revoke_teacher_delegation(delegation_id, revoker_user_id, school_id, revoke_reason=None):
    """
    Manually revokes an active or scheduled delegation immediately.
    """
    delegation = TeacherDelegation.query.filter_by(id=delegation_id, school_id=school_id).first()
    if not delegation:
        return None, "Delegation not found or unauthorized."

    if delegation.status == 'REVOKED' or delegation.revoked_at is not None:
        return None, "Delegation has already been revoked."

    old_snapshot = delegation.to_dict(include_details=False)

    now = utc_now()
    delegation.status = 'REVOKED'
    delegation.revoked_by = revoker_user_id
    delegation.revoked_at = now
    delegation.revoke_reason = (revoke_reason or 'Revoked by school management')[:500]
    delegation.updated_at = now

    db.session.commit()

    # Audit Log
    try:
        revoker_user = User.query.get(revoker_user_id)
        log_action(
            module='staff',
            submodule='delegations',
            action='UPDATE',
            old_value=old_snapshot,
            new_value=delegation.to_dict(include_details=False),
            remarks=f"Revoked delegation #{delegation.id}. Reason: {delegation.revoke_reason}",
            user=revoker_user
        )
    except Exception as audit_err:
        logger.warning(f"Audit log failed for delegation revoke: {audit_err}")

    return delegation, None


def get_active_teacher_delegations_for_user(user, permission_code=None, class_id=None, subject_id=None):
    """
    Resolves currently valid, active delegations for the given teacher user.
    Strictly checks:
    - User is an active teacher
    - Same school
    - Status is not REVOKED
    - starts_at <= now <= expires_at
    - Matches requested permission_code and scope if provided
    """
    if not user or not user.is_active:
        return []

    teacher = Teacher.query.filter_by(user_id=user.id, school_id=user.school_id).first()
    if not teacher or getattr(teacher, 'is_deleted', False):
        return []

    now = utc_now()

    # Query active delegations
    q = TeacherDelegation.query.filter(
        TeacherDelegation.school_id == user.school_id,
        TeacherDelegation.delegate_teacher_id == teacher.id,
        TeacherDelegation.revoked_at.is_(None),
        TeacherDelegation.status != 'REVOKED',
        TeacherDelegation.starts_at <= now,
        TeacherDelegation.expires_at >= now,
    )

    delegations = q.all()
    if not delegations:
        return []

    matched = []
    for d in delegations:
        # Check permission code
        if permission_code:
            has_perm = any(p.permission_code == permission_code for p in (d.permissions or []))
            if not has_perm:
                continue

        # Check scope
        if class_id is not None:
            has_class = False
            for sc in (d.scopes or []):
                if sc.class_id == class_id:
                    if subject_id is None or sc.subject_id is None or sc.subject_id == subject_id:
                        has_class = True
                        break
            if not has_class:
                continue

        matched.append(d)

    return matched


def has_teacher_delegated_permission(user, permission_code, class_id=None, subject_id=None):
    """
    Boolean helper: returns True if user currently has an active delegation granting permission_code for scope.
    """
    active = get_active_teacher_delegations_for_user(user, permission_code=permission_code, class_id=class_id, subject_id=subject_id)
    return len(active) > 0


def auto_expire_teacher_delegations():
    """
    Maintenance task to sync database status column for reporting and queries.
    (Authorization does NOT depend on this; time window is checked live).
    """
    now = utc_now()
    # Expire passed delegations
    expired_count = TeacherDelegation.query.filter(
        TeacherDelegation.status.in_(['ACTIVE', 'SCHEDULED']),
        TeacherDelegation.revoked_at.is_(None),
        TeacherDelegation.expires_at < now,
    ).update({'status': 'EXPIRED'}, synchronize_session=False)

    # Activate scheduled delegations that have reached start time
    activated_count = TeacherDelegation.query.filter(
        TeacherDelegation.status == 'SCHEDULED',
        TeacherDelegation.revoked_at.is_(None),
        TeacherDelegation.starts_at <= now,
        TeacherDelegation.expires_at >= now,
    ).update({'status': 'ACTIVE'}, synchronize_session=False)

    if expired_count or activated_count:
        db.session.commit()
        logger.info(f"Delegation scheduler sync: {activated_count} activated, {expired_count} expired.")
    return {'activated': activated_count, 'expired': expired_count}
