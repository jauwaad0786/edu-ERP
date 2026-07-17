# backend/app/routes/rbac.py
"""
API for per-user permission overrides — this is what lets a Principal say
"this ONE teacher can collect fees" without giving every teacher that
right, and without inventing a whole new role just for one person.

Deliberately narrow scope for this first version: grant/revoke/list a
single UserPermissionOverride row. Role CRUD, delegation, and the
permission matrix UI's bulk endpoints are separate future work — this file
is only the piece needed right now for the Teacher-fee-access use case.

Authorization: gated by `permission_required('admin.user.manage')`.
PRINCIPAL/DIRECTOR bypass via is_super (same as everywhere else in the new
engine); VICE_PRINCIPAL has it by default per permission_catalog.py.

Tenant isolation: a school-scoped actor (has a school_id) can only manage
users in their OWN school -- checked explicitly below, not left to
implicitly fall out of the permission check. Company-side actors
(school_id is None, e.g. Super Admin) are not restricted this way.
"""

from flask import Blueprint, request, jsonify
from datetime import datetime

from app import db
from app.services.permission_resolver import permission_required
from app.services.audit_service import log_action
from app.models.audit import log_company_action
from app.utils.decorators import get_current_user
from app.models.rbac import (
    Permission, 
    UserPermissionOverride, 
    resolve_platform_permissions,
    TemporaryRoleDelegation
)
from app.services.delegation_service import (
    create_delegation,
    revoke_delegation,
    extend_delegation,
    get_active_delegations
)

rbac_bp = Blueprint('rbac', __name__)


def _get_target_user_or_403(user_id, actor):
    from app.models.user import User
    target = User.query.get(user_id)
    if not target:
        return None, (jsonify({'error': 'User not found'}), 404)

    actor_school_id = getattr(actor, 'school_id', None)
    if actor_school_id is not None and target.school_id != actor_school_id:
        return None, (jsonify({'error': 'Cannot manage users outside your own school'}), 403)

    return target, None


def _log_permission_change(actor, target, old_value, new_value, remarks):
    """
    School-scoped actor (Principal/VP) -> logged to that school's AuditLog.
    Company-scoped actor (Super Admin, no school_id) -> logged to
    CompanyActivityLog instead, with the target's school as accountability
    metadata (see audit.py's CompanyActivityLog docstring) -- log_action()
    alone would silently drop this because it only writes when the ACTING
    user has a school_id, and a Super Admin never does.
    """
    if getattr(actor, 'school_id', None) is not None:
        log_action(
            module='rbac', submodule='user_override', action='PERMISSION_CHANGE',
            old_value=old_value, new_value=new_value, remarks=remarks, user=actor,
        )
    else:
        log_company_action(
            actor_user=actor, module='rbac', action='PERMISSION_CHANGE',
            old_value=old_value, new_value=new_value,
            affected_school_id=target.school_id, remarks=remarks,
        )
        db.session.commit()


@rbac_bp.route('/users/<int:user_id>/permissions', methods=['GET'])
@permission_required('admin.user.manage')
def list_user_permissions(user_id):
    actor = get_current_user()
    target, error = _get_target_user_or_403(user_id, actor)
    if error:
        return error

    effective = resolve_platform_permissions(target, school_id=target.school_id)

    perm_key_by_id = {p.id: p.key for p in Permission.query.all()}
    overrides = UserPermissionOverride.query.filter_by(user_id=user_id).all()

    return jsonify({
        'user_id': user_id,
        'effective_permissions': sorted(effective),
        'overrides': [
            {
                'permission_key': perm_key_by_id.get(o.permission_id),
                'is_enabled': o.is_enabled,
            }
            for o in overrides if o.permission_id in perm_key_by_id
        ],
    }), 200


@rbac_bp.route('/users/<int:user_id>/permissions', methods=['POST'])
@permission_required('admin.user.manage')
def grant_user_permission(user_id):
    """Body: {"permission_key": "fees.collect", "is_enabled": true}"""
    actor = get_current_user()
    target, error = _get_target_user_or_403(user_id, actor)
    if error:
        return error

    data = request.get_json() or {}
    permission_key = data.get('permission_key')
    is_enabled = data.get('is_enabled', True)

    if not permission_key:
        return jsonify({'error': 'permission_key is required'}), 400

    perm = Permission.query.filter_by(key=permission_key).first()
    if not perm:
        return jsonify({'error': f"Unknown permission key '{permission_key}'"}), 404

    existing = UserPermissionOverride.query.filter_by(
        user_id=user_id, permission_id=perm.id
    ).first()
    old_snapshot = (
        {'permission_key': permission_key, 'is_enabled': existing.is_enabled}
        if existing else None
    )

    if existing:
        existing.is_enabled = is_enabled
        existing.granted_by = actor.id
    else:
        db.session.add(UserPermissionOverride(
            user_id=user_id, permission_id=perm.id,
            is_enabled=is_enabled, granted_by=actor.id,
        ))

    db.session.commit()

    _log_permission_change(
        actor=actor, target=target,
        old_value=old_snapshot,
        new_value={'permission_key': permission_key, 'is_enabled': is_enabled, 'target_user_id': user_id},
        remarks=f"{'Granted' if is_enabled else 'Revoked'} '{permission_key}' for user {user_id}",
    )

    return jsonify({
        'message': 'Permission override saved',
        'permission_key': permission_key,
        'is_enabled': is_enabled,
    }), 200


@rbac_bp.route('/users/<int:user_id>/permissions/<permission_key>', methods=['DELETE'])
@permission_required('admin.user.manage')
def revoke_user_permission_override(user_id, permission_key):
    """Removes the override entirely -- user falls back to their role's default for this key."""
    actor = get_current_user()
    target, error = _get_target_user_or_403(user_id, actor)
    if error:
        return error

    perm = Permission.query.filter_by(key=permission_key).first()
    if not perm:
        return jsonify({'error': f"Unknown permission key '{permission_key}'"}), 404

    existing = UserPermissionOverride.query.filter_by(
        user_id=user_id, permission_id=perm.id
    ).first()
    if not existing:
        return jsonify({'message': 'No override existed for this user — already at role default'}), 200

    old_snapshot = {'permission_key': permission_key, 'is_enabled': existing.is_enabled}
    db.session.delete(existing)
    db.session.commit()

    _log_permission_change(
        actor=actor, target=target,
        old_value=old_snapshot, new_value=None,
        remarks=f"Removed override for '{permission_key}' on user {user_id} (reverted to role default)",
    )

    return jsonify({'message': 'Override removed, user reverted to role default'}), 200


# ── DELEGATION ENDPOINTS ──

@rbac_bp.route('/delegations', methods=['POST'])
@permission_required('admin.user.manage')
def create_delegation_route():
    """
    Body: {
        "delegatee_user_id": 123,
        "role_key": "ACCOUNTANT",
        "end_date": "2026-08-01T23:59:59",
        "reason": "Accountant on leave for 1 day"
    }
    """
    actor = get_current_user()
    data = request.get_json() or {}

    delegatee_user_id = data.get('delegatee_user_id')
    role_key = data.get('role_key')
    end_date_str = data.get('end_date')
    reason = data.get('reason')

    if not all([delegatee_user_id, role_key, end_date_str]):
        return jsonify({'error': 'delegatee_user_id, role_key, and end_date are required'}), 400

    try:
        end_date = datetime.fromisoformat(end_date_str.replace('Z', '+00:00'))
    except ValueError:
        return jsonify({'error': 'Invalid end_date format. Use ISO-8601 (e.g., 2026-08-01T23:59:59)'}), 400

    delegation, error = create_delegation(
        delegator=actor,
        delegatee_user_id=delegatee_user_id,
        role_key=role_key,
        end_date=end_date,
        reason=reason
    )

    if error:
        return jsonify({'error': error}), 400

    return jsonify({
        'message': 'Delegation created successfully',
        'delegation': {
            'id': delegation.id,
            'role_key': delegation.role.key,
            'delegatee_user_id': delegation.delegatee_user_id,
            'start_date': delegation.start_date.isoformat(),
            'end_date': delegation.end_date.isoformat(),
            'status': delegation.status,
            'reason': delegation.reason,
        }
    }), 201


@rbac_bp.route('/delegations', methods=['GET'])
@permission_required('admin.user.manage')
def list_delegations():
    """Query params: user_id (delegatee), status, delegator_id"""
    actor = get_current_user()
    user_id = request.args.get('user_id')
    status = request.args.get('status')
    delegator_id = request.args.get('delegator_id')

    query = TemporaryRoleDelegation.query

    if user_id:
        query = query.filter_by(delegatee_user_id=user_id)
    if status:
        query = query.filter_by(status=status)
    if delegator_id:
        query = query.filter_by(delegator_user_id=delegator_id)

    # Tenant isolation (school-scoped actors only see their school's users)
    actor_school_id = getattr(actor, 'school_id', None)
    if actor_school_id is not None:
        from app.models.user import User
        query = query.join(User, User.id == TemporaryRoleDelegation.delegatee_user_id)
        query = query.filter(User.school_id == actor_school_id)

    delegations = query.order_by(TemporaryRoleDelegation.created_at.desc()).all()

    return jsonify({
        'delegations': [
            {
                'id': d.id,
                'role_key': d.role.key,
                'role_name': d.role.name,
                'delegator_user_id': d.delegator_user_id,
                'delegatee_user_id': d.delegatee_user_id,
                'start_date': d.start_date.isoformat(),
                'end_date': d.end_date.isoformat(),
                'status': d.status,
                'reason': d.reason,
                'created_at': d.created_at.isoformat(),
            }
            for d in delegations
        ]
    }), 200


@rbac_bp.route('/delegations/<int:delegation_id>', methods=['DELETE'])
@permission_required('admin.user.manage')
def revoke_delegation_route(delegation_id):
    actor = get_current_user()
    success, error = revoke_delegation(delegation_id, actor)

    if error:
        return jsonify({'error': error}), 400

    return jsonify({'message': 'Delegation revoked successfully'}), 200


@rbac_bp.route('/delegations/<int:delegation_id>/extend', methods=['PUT'])
@permission_required('admin.user.manage')
def extend_delegation_route(delegation_id):
    """Body: {"new_end_date": "2026-08-01T23:59:59"}"""
    actor = get_current_user()
    data = request.get_json() or {}
    new_end_date_str = data.get('new_end_date')

    if not new_end_date_str:
        return jsonify({'error': 'new_end_date is required'}), 400

    try:
        new_end_date = datetime.fromisoformat(new_end_date_str.replace('Z', '+00:00'))
    except ValueError:
        return jsonify({'error': 'Invalid end_date format. Use ISO-8601'}), 400

    success, error = extend_delegation(delegation_id, new_end_date, actor)

    if error:
        return jsonify({'error': error}), 400

    return jsonify({'message': 'Delegation extended successfully'}), 200
