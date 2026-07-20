# backend/app/services/delegation_service.py
"""
Temporary Role Delegation Service — Enterprise-grade temporary access management.

Use cases:
  - Teacher → Accountant for 1 day (fee collection during accountant's leave)
  - Teacher → Receptionist for 3 days (front desk coverage)
  - Principal → Vice Principal for 2 weeks (acting principal)

Key features:
  1. Hierarchy validation — delegator must outrank the role being delegated
  2. Auto-expiry — APScheduler runs every 5 minutes to expire past delegations
  3. Audit trail — every create/revoke/expire logged to school/company audit
  4. Permission merge — temporary roles are UNIONed with permanent roles
  5. Conflict resolution — if delegatee already has that role, skip duplicate
  6. Protected roles — CEO/DIRECTOR/PRINCIPAL cannot be delegated
"""

from datetime import datetime, timedelta
from flask import g
from app import db
from app.models.rbac import (
    Role, UserRoleAssignment, TemporaryRoleDelegation,
    get_user_roles, can_manage_role
)
from app.models.user import User
from app.services.audit_service import log_action
from app.models.audit import log_company_action


# ── Core Delegation Operations ────────────────────────────────────────────

def create_delegation(delegator, delegatee_user_id, role_key, end_date, reason=None):
    """
    Create a temporary role delegation.

    Args:
        delegator: User object (the one granting access)
        delegatee_user_id: int (the one receiving temporary access)
        role_key: str (e.g., 'ACCOUNTANT', 'RECEPTIONIST')
        end_date: datetime (when delegation expires)
        reason: str (optional, max 500 chars)

    Returns:
        (delegation_obj, error_message) tuple

    Validation:
        - Delegator must be authenticated
        - Delegatee must exist
        - Role must exist
        - Delegator must outrank the role (can_manage_role check)
        - Role cannot be protected (CEO/DIRECTOR/PRINCIPAL)
        - End date must be in future
        - Delegatee doesn't already have this role permanently or temporarily
    """
    # 1. Validate delegatee
    delegatee = User.query.get(delegatee_user_id)
    if not delegatee:
        return None, "Delegatee user not found"

    # 2. Validate role
    role = Role.query.filter_by(key=role_key).first()
    if not role:
        return None, f"Role '{role_key}' not found"

    # 3. Protected role check (nobody can delegate CEO/DIRECTOR/PRINCIPAL)
    if role.is_protected:
        return None, f"Cannot delegate protected role '{role_key}'"

    # 4. Hierarchy check: delegator must outrank the role
    delegator_roles = get_user_roles(delegator)
    if not can_manage_role(delegator_roles, [role]):
        return None, "Delegator does not have sufficient hierarchy to delegate this role"

    # 5. End date validation
    if end_date <= datetime.utcnow():
        return None, "End date must be in the future"

    # 6. Prevent duplicate: check if delegatee already has this role (permanent)
    existing_permanent = UserRoleAssignment.query.filter_by(
        user_id=delegatee_user_id, role_id=role.id
    ).first()
    if existing_permanent:
        return None, f"User already has role '{role_key}' permanently"

    # 7. Prevent duplicate: check if delegatee already has an active delegation for same role
    existing_delegation = TemporaryRoleDelegation.query.filter_by(
        delegatee_user_id=delegatee_user_id,
        role_id=role.id,
        status='ACTIVE'
    ).first()
    if existing_delegation:
        return None, f"User already has an active delegation for role '{role_key}'"

    # 8. Create delegation record
    delegation = TemporaryRoleDelegation(
        delegator_user_id=delegator.id,
        delegatee_user_id=delegatee_user_id,
        role_id=role.id,
        start_date=datetime.utcnow(),
        end_date=end_date,
        reason=reason[:500] if reason else None,
        status='ACTIVE'
    )
    db.session.add(delegation)

    # 9. Immediately assign temporary role to delegatee (add to UserRoleAssignment)
    #    Note: We don't set is_active=True — the user still has their permanent
    #    active role; the temporary role is just ADDED to their permissions union.
    temp_assignment = UserRoleAssignment(
        user_id=delegatee_user_id,
        role_id=role.id,
        is_active=False,  # temporary roles never become the "active" dashboard role
        assigned_by=delegator.id
    )
    db.session.add(temp_assignment)

    # Flush (not commit) BEFORE touching delegation.role / delegation.id below.
    # A pending (added-but-not-flushed) ORM object's many-to-one relationship
    # does not lazy-load from the FK column -- it resolves to None instead of
    # querying, since the row doesn't exist in the DB yet for SQLAlchemy to
    # join against. _log_delegation_audit() reads delegation.role.key and
    # delegation.id, so without this flush it crashes with
    # "AttributeError: 'NoneType' object has no attribute 'key'" -> 500,
    # every single time a delegation is created. Reproduced and confirmed
    # locally before this fix.
    db.session.flush()

    # 10. Audit logging
    _log_delegation_audit(
        actor=delegator,
        target=delegatee,
        action='CREATE',
        delegation=delegation,
        reason=reason
    )

    db.session.commit()

    return delegation, None


def revoke_delegation(delegation_id, revoker):
    """
    Manually revoke an active delegation before its expiry date.

    Args:
        delegation_id: int
        revoker: User object (the one revoking)

    Returns:
        (success_bool, error_message)

    Validation:
        - Revoker must be either the original delegator OR someone who outranks them
        - Delegation must be ACTIVE
    """
    delegation = TemporaryRoleDelegation.query.get(delegation_id)
    if not delegation:
        return False, "Delegation not found"

    if delegation.status != 'ACTIVE':
        return False, f"Delegation is already {delegation.status}"

    # Check if revoker is authorized: delegator OR higher hierarchy
    if revoker.id != delegation.delegator_user_id:
        revoker_roles = get_user_roles(revoker)
        delegator = User.query.get(delegation.delegator_user_id)
        delegator_roles = get_user_roles(delegator)
        if not can_manage_role(revoker_roles, delegator_roles):
            return False, "Only the delegator or a higher authority can revoke this delegation"

    # Update delegation status
    delegation.status = 'REVOKED'
    delegation.updated_at = datetime.utcnow()

    # Remove temporary role from delegatee (only if no other active delegation for same role)
    _remove_temporary_role_if_no_other(delegation.delegatee_user_id, delegation.role_id)

    # Audit logging
    _log_delegation_audit(
        actor=revoker,
        target=User.query.get(delegation.delegatee_user_id),
        action='REVOKE',
        delegation=delegation,
        reason=f"Manually revoked by {revoker.username}"
    )

    db.session.commit()
    return True, None


def extend_delegation(delegation_id, new_end_date, updater):
    """
    Extend an active delegation's expiry date.

    Args:
        delegation_id: int
        new_end_date: datetime (must be > current end_date)
        updater: User object

    Returns:
        (success_bool, error_message)
    """
    delegation = TemporaryRoleDelegation.query.get(delegation_id)
    if not delegation:
        return False, "Delegation not found"

    if delegation.status != 'ACTIVE':
        return False, f"Can only extend ACTIVE delegations (current: {delegation.status})"

    # Check authorization: delegator OR higher hierarchy
    if updater.id != delegation.delegator_user_id:
        revoker_roles = get_user_roles(updater)
        delegator = User.query.get(delegation.delegator_user_id)
        delegator_roles = get_user_roles(delegator)
        if not can_manage_role(revoker_roles, delegator_roles):
            return False, "Only the delegator or a higher authority can extend this delegation"

    if new_end_date <= delegation.end_date:
        return False, "New end date must be after current end date"

    if new_end_date <= datetime.utcnow():
        return False, "New end date must be in the future"

    old_end_date = delegation.end_date
    delegation.end_date = new_end_date
    delegation.updated_at = datetime.utcnow()

    # Audit logging (with old/new values)
    _log_delegation_audit(
        actor=updater,
        target=User.query.get(delegation.delegatee_user_id),
        action='EXTEND',
        delegation=delegation,
        reason=f"Extended from {old_end_date} to {new_end_date}"
    )

    db.session.commit()
    return True, None


def expire_delegation(delegation_id):
    """
    Internal: expire a single delegation (called by auto_expire_delegations()).
    Does NOT require authorization — it's a system action.
    """
    delegation = TemporaryRoleDelegation.query.get(delegation_id)
    if not delegation or delegation.status != 'ACTIVE':
        return False

    delegation.status = 'EXPIRED'
    delegation.updated_at = datetime.utcnow()

    # Remove temporary role from delegatee
    _remove_temporary_role_if_no_other(delegation.delegatee_user_id, delegation.role_id)

    # Audit logging (system action, no actor)
    _log_delegation_audit(
        actor=None,  # system
        target=User.query.get(delegation.delegatee_user_id),
        action='EXPIRE',
        delegation=delegation,
        reason="Auto-expired by system"
    )

    db.session.commit()
    return True


def auto_expire_delegations():
    """
    Scheduled job (APScheduler) — runs every 5 minutes.
    Finds all ACTIVE delegations where end_date < NOW() and expires them.

    Returns:
        int: Number of delegations expired
    """
    now = datetime.utcnow()
    expired_delegations = TemporaryRoleDelegation.query.filter(
        TemporaryRoleDelegation.status == 'ACTIVE',
        TemporaryRoleDelegation.end_date < now
    ).all()

    count = 0
    for delegation in expired_delegations:
        try:
            if expire_delegation(delegation.id):
                count += 1
        except Exception as e:
            # Log error but continue with others (don't fail the whole job)
            db.session.rollback()
            import logging
            logging.error(f"Failed to expire delegation {delegation.id}: {e}")

    return count


# ── Query Helpers ──────────────────────────────────────────────────────────

def get_active_delegations(user_id):
    """
    Get all ACTIVE delegations for a user (used in permission resolver).
    Returns: list of TemporaryRoleDelegation objects
    """
    return TemporaryRoleDelegation.query.filter_by(
        delegatee_user_id=user_id,
        status='ACTIVE'
    ).all()


def get_active_delegated_roles(user_id):
    """
    Get Role objects for all active delegations (used in permission resolver).
    Returns: list of Role objects
    """
    delegations = get_active_delegations(user_id)
    role_ids = [d.role_id for d in delegations]
    if not role_ids:
        return []
    return Role.query.filter(Role.id.in_(role_ids)).all()


def get_delegations_for_user(user_id, status=None):
    """
    Get all delegations (active + expired + revoked) for a user.
    Used in audit/UI to show history.

    Args:
        user_id: int
        status: 'ACTIVE' | 'EXPIRED' | 'REVOKED' | None (all)

    Returns: list of TemporaryRoleDelegation objects
    """
    query = TemporaryRoleDelegation.query.filter_by(delegatee_user_id=user_id)
    if status:
        query = query.filter_by(status=status)
    return query.order_by(TemporaryRoleDelegation.created_at.desc()).all()


def get_delegations_by_delegator(delegator_user_id, status=None):
    """Get all delegations created by a specific user."""
    query = TemporaryRoleDelegation.query.filter_by(delegator_user_id=delegator_user_id)
    if status:
        query = query.filter_by(status=status)
    return query.order_by(TemporaryRoleDelegation.created_at.desc()).all()


def can_delegate_role(actor, role_key):
    """
    Check if an actor can delegate a specific role.
    Used in UI to enable/disable delegation buttons.

    Returns: bool
    """
    role = Role.query.filter_by(key=role_key).first()
    if not role or role.is_protected:
        return False
    actor_roles = get_user_roles(actor)
    return can_manage_role(actor_roles, [role])


# ── Internal Helpers ──────────────────────────────────────────────────────

def _remove_temporary_role_if_no_other(user_id, role_id):
    """
    Remove a temporary role from UserRoleAssignment ONLY if there are no
    other active delegations for this (user, role) pair.
    """
    other_active = TemporaryRoleDelegation.query.filter(
        TemporaryRoleDelegation.delegatee_user_id == user_id,
        TemporaryRoleDelegation.role_id == role_id,
        TemporaryRoleDelegation.status == 'ACTIVE'
    ).first()

    if not other_active:
        # No other active delegation — remove the temporary role assignment
        assignment = UserRoleAssignment.query.filter_by(
            user_id=user_id,
            role_id=role_id
        ).first()
        if assignment:
            db.session.delete(assignment)


def _log_delegation_audit(actor, target, action, delegation, reason=None):
    """
    Log delegation actions to appropriate audit table.
    - If actor has school_id → AuditLog (school-side)
    - If actor is company-side (no school_id) OR actor is None (system) → CompanyActivityLog
    """
    log_data = {
        'module': 'delegation',
        'submodule': 'temporary_role',
        'action': action,
        'old_value': {
            'status': 'ACTIVE',
            'end_date': delegation.end_date.isoformat(),
            'role_key': delegation.role.key,
        },
        'new_value': {
            'status': delegation.status,
            'end_date': delegation.end_date.isoformat(),
            'role_key': delegation.role.key,
            'delegator': delegation.delegator_user_id,
            'delegatee': delegation.delegatee_user_id,
        },
        'remarks': reason or f"{action} delegation #{delegation.id}"
    }

    if actor is None:
        # System action (auto-expiry) — log to CompanyActivityLog
        log_company_action(
            actor_user=None,
            module='delegation',
            action='SYSTEM_EXPIRE',
            old_value=log_data['old_value'],
            new_value=log_data['new_value'],
            affected_school_id=target.school_id if target else None,
            remarks=f"Auto-expired delegation #{delegation.id}"
        )
        return

    if getattr(actor, 'school_id', None) is not None:
        # School-scoped actor
        log_action(
            module='delegation',
            submodule='temporary_role',
            action=action,
            user=actor,
            old_value=log_data['old_value'],
            new_value=log_data['new_value'],
            remarks=log_data['remarks']
        )
    else:
        # Company-scoped actor (Super Admin, CEO)
        log_company_action(
            actor_user=actor,
            module='delegation',
            action=action,
            old_value=log_data['old_value'],
            new_value=log_data['new_value'],
            affected_school_id=target.school_id if target else None,
            remarks=log_data['remarks']
        )


# ── Permission Resolver Integration ──────────────────────────────────────

def merge_delegated_permissions(user, base_permissions):
    """
    Merge temporary role permissions into the base permission set.
    Called from permission_resolver.py.

    Args:
        user: User object
        base_permissions: set of permission keys (from permanent roles)

    Returns:
        set of permission keys (base + delegated)
    """
    delegated_roles = get_active_delegated_roles(user.id)
    if not delegated_roles:
        return base_permissions

    # Collect permissions from all delegated roles
    from app.models.rbac import RolePermission, Permission
    role_ids = [r.id for r in delegated_roles]
    rows = RolePermission.query.filter(
        RolePermission.role_id.in_(role_ids)
    ).all()

    delegated_perms = set()
    for row in rows:
        perm = Permission.query.get(row.permission_id)
        if perm and row.is_enabled:
            delegated_perms.add(perm.key)

    # Merge (delegated permissions override base if conflict — union is simpler)
    return base_permissions.union(delegated_perms)
