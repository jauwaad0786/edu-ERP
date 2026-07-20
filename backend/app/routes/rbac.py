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
from datetime import datetime, timezone

from app import db
from app.services.permission_resolver import permission_required
from app.services.audit_service import log_action
from app.models.audit import log_company_action
from app.utils.decorators import get_current_user
from app.models.rbac import (
    Permission, 
    UserPermissionOverride, 
    resolve_platform_permissions,
    TemporaryRoleDelegation,
    Role,
    RolePermission,
    UserRoleAssignment,
    get_user_roles,
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
        if end_date.tzinfo is not None:
            end_date = end_date.astimezone(timezone.utc).replace(tzinfo=None)
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
        if new_end_date.tzinfo is not None:
            new_end_date = new_end_date.astimezone(timezone.utc).replace(tzinfo=None)
    except ValueError:
        return jsonify({'error': 'Invalid end_date format. Use ISO-8601'}), 400

    success, error = extend_delegation(delegation_id, new_end_date, actor)

    if error:
        return jsonify({'error': error}), 400

    return jsonify({'message': 'Delegation extended successfully'}), 200


# ═══════════════════════════════════════════════════════════════════════════
#  ROLE CRUD  (RoleManagement.jsx's Role Hierarchy screen)
# ═══════════════════════════════════════════════════════════════════════════
# The seeded roles (CEO..Intern, Director..Parent — rbac.seed_default_roles)
# are the platform defaults and cannot be edited/deleted here (is_protected,
# or plain "system role" guard below) — this endpoint is for a Super Admin
# adding a genuinely NEW role the seed list doesn't cover (e.g. a school
# wants a "Sports Coordinator" role), not for tampering with the hierarchy
# spec's fixed roles.

def _school_scope_actor_school_id(actor):
    """A school-scoped actor (Principal/Director/VP) may only create/edit
    TENANT-scope roles; scope is otherwise unrestricted for company actors."""
    return getattr(actor, 'school_id', None)


@rbac_bp.route('/roles', methods=['GET'])
@permission_required('admin.user.manage')
def list_roles():
    """
    School-scoped actor -> only TENANT-scope roles (their own product's
    roles; Role has no school_id, roles are shared per-product templates).
    Company-scoped actor -> everything, both scopes.
    """
    actor = get_current_user()
    q = Role.query
    if _school_scope_actor_school_id(actor) is not None:
        q = q.filter(Role.scope == 'TENANT')
    roles = q.order_by(Role.scope, Role.hierarchy_level).all()
    return jsonify([r.to_dict() for r in roles]), 200


@rbac_bp.route('/roles', methods=['POST'])
@permission_required('admin.user.manage')
def create_role():
    actor = get_current_user()
    data = request.get_json() or {}

    key   = (data.get('key') or '').strip().upper().replace(' ', '_')
    name  = (data.get('name') or '').strip()
    scope = (data.get('scope') or 'TENANT').strip().upper()

    if not key or not name:
        return jsonify({'error': 'key and name are required'}), 400
    if scope not in ('COMPANY', 'TENANT'):
        return jsonify({'error': "scope must be 'COMPANY' or 'TENANT'"}), 400

    # School-scoped actors can only add roles to their own product's TENANT
    # catalog — never a COMPANY-scope (internal company hierarchy) role.
    if _school_scope_actor_school_id(actor) is not None and scope != 'TENANT':
        return jsonify({'error': 'Only a company-side admin can create COMPANY-scope roles'}), 403

    product_id = None
    if scope == 'TENANT':
        from app.models.platform import Product
        school_product = Product.query.filter_by(key='SCHOOL_ERP').first()
        product_id = school_product.id if school_product else None

    existing = Role.query.filter_by(scope=scope, product_id=product_id, key=key).first()
    if existing:
        return jsonify({'error': f"Role '{key}' already exists in this scope"}), 409

    role = Role(
        product_id=product_id,
        scope=scope,
        key=key,
        name=name,
        hierarchy_level=int(data.get('hierarchy_level', 10)),
        is_super=bool(data.get('is_super', False)),
        # A newly created custom role is never auto-protected — only the
        # platform seed defaults (CEO, Director, Principal) get that flag.
        is_protected=False,
    )
    db.session.add(role)
    db.session.commit()

    log_company_action(
        actor_user=actor if _school_scope_actor_school_id(actor) is None else None,
        module='rbac', action='CREATE',
        new_value=role.to_dict(), remarks=f'Created role {key}',
    ) if _school_scope_actor_school_id(actor) is None else log_action(
        module='rbac', submodule='role', action='CREATE', user=actor,
        new_value=role.to_dict(), remarks=f'Created role {key}',
    )
    db.session.commit()

    return jsonify(role.to_dict()), 201


@rbac_bp.route('/roles/<int:role_id>', methods=['PUT'])
@permission_required('admin.user.manage')
def update_role(role_id):
    actor = get_current_user()
    role = Role.query.get(role_id)
    if not role:
        return jsonify({'error': 'Role not found'}), 404
    if role.is_protected:
        return jsonify({'error': 'This is a protected system role and cannot be edited'}), 403
    if _school_scope_actor_school_id(actor) is not None and role.scope != 'TENANT':
        return jsonify({'error': 'Cannot edit a COMPANY-scope role'}), 403

    data = request.get_json() or {}
    old_value = role.to_dict()

    if 'name' in data and data['name'].strip():
        role.name = data['name'].strip()
    if 'hierarchy_level' in data:
        role.hierarchy_level = int(data['hierarchy_level'])
    if 'is_super' in data:
        role.is_super = bool(data['is_super'])
    # key/scope/is_protected intentionally not editable after creation —
    # changing key would orphan existing UserRoleAssignment/RolePermission
    # rows, and is_protected is only ever set by the seed script.

    db.session.commit()

    log_fn_kwargs = dict(module='rbac', action='UPDATE', old_value=old_value,
                          new_value=role.to_dict(), remarks=f'Updated role {role.key}')
    if _school_scope_actor_school_id(actor) is None:
        log_company_action(actor_user=actor, **log_fn_kwargs)
    else:
        log_action(submodule='role', user=actor, **log_fn_kwargs)
    db.session.commit()

    return jsonify(role.to_dict()), 200


@rbac_bp.route('/roles/<int:role_id>', methods=['DELETE'])
@permission_required('admin.user.manage')
def delete_role(role_id):
    actor = get_current_user()
    role = Role.query.get(role_id)
    if not role:
        return jsonify({'error': 'Role not found'}), 404
    if role.is_protected:
        return jsonify({'error': 'This is a protected system role and cannot be deleted'}), 403
    if _school_scope_actor_school_id(actor) is not None and role.scope != 'TENANT':
        return jsonify({'error': 'Cannot delete a COMPANY-scope role'}), 403

    in_use = UserRoleAssignmentCount(role.id)
    if in_use:
        return jsonify({
            'error': f'{in_use} user(s) currently hold this role — reassign them before deleting it'
        }), 409

    old_value = role.to_dict()
    db.session.delete(role)

    log_fn_kwargs = dict(module='rbac', action='DELETE', old_value=old_value,
                          remarks=f'Deleted role {role.key}')
    if _school_scope_actor_school_id(actor) is None:
        log_company_action(actor_user=actor, **log_fn_kwargs)
    else:
        log_action(submodule='role', user=actor, **log_fn_kwargs)

    db.session.commit()
    return jsonify({'message': 'Role deleted'}), 200


def UserRoleAssignmentCount(role_id):
    from app.models.rbac import UserRoleAssignment
    return UserRoleAssignment.query.filter_by(role_id=role_id).count()



# ═══════════════════════════════════════════════════════════════════════════
#  PERMISSION MATRIX — frontend/src/pages/rbac/PermissionMatrix.jsx
# ═══════════════════════════════════════════════════════════════════════════
# These 3 endpoints were called by the frontend from day one but never
# existed here (the module docstring even flagged this as "separate future
# work") -- the matrix page was 404-ing on load. Adding them now.

@rbac_bp.route('/permissions', methods=['GET'])
@permission_required('admin.user.manage')
def list_permissions():
    """
    Full permission catalog for the matrix's column headers.
    School-scoped actor -> only their own product's (SCHOOL_ERP) catalog.
    Company-scoped actor -> everything, same as list_roles().
    """
    actor = get_current_user()
    q = Permission.query
    if _school_scope_actor_school_id(actor) is not None:
        from app.models.platform import Product
        school_product = Product.query.filter_by(key='SCHOOL_ERP').first()
        if school_product:
            q = q.filter(Permission.product_id == school_product.id)
    permissions = q.order_by(Permission.module, Permission.key).all()
    return jsonify([p.to_dict() for p in permissions]), 200


@rbac_bp.route('/role-permissions', methods=['GET'])
@permission_required('admin.user.manage')
def get_role_permissions():
    """
    Matrix payload: { role_id: { permission_id: is_enabled } }.

    Same precedence as resolve_platform_permissions() -- global (school_id
    NULL) template first, then the actor's own school-specific override
    rows layered on top -- so what a Principal sees here matches what's
    actually enforced for their school. Company-scoped actor sees only the
    global template (there's no single "their school" to merge).
    """
    actor = get_current_user()
    actor_school_id = _school_scope_actor_school_id(actor)

    matrix = {}
    for row in RolePermission.query.filter(RolePermission.school_id.is_(None)).all():
        matrix.setdefault(row.role_id, {})[row.permission_id] = row.is_enabled

    if actor_school_id is not None:
        for row in RolePermission.query.filter_by(school_id=actor_school_id).all():
            matrix.setdefault(row.role_id, {})[row.permission_id] = row.is_enabled

    return jsonify(matrix), 200


@rbac_bp.route('/roles/<int:role_id>/permissions/<int:permission_id>', methods=['POST'])
@permission_required('admin.user.manage')
def toggle_role_permission(role_id, permission_id):
    """
    Grant/revoke one permission for one role.

    IMPORTANT (multi-tenant safety): a school-scoped actor's toggle is
    written to a row scoped to THEIR OWN school_id only -- it never touches
    the global (school_id=NULL) template. Writing to the global row here
    would mean one Principal customizing their school's matrix silently
    changes the default for every other school on the platform. Only a
    company-scoped actor (no school_id) edits the global template.
    """
    actor = get_current_user()
    role = Role.query.get(role_id)
    if not role:
        return jsonify({'error': 'Role not found'}), 404
    permission = Permission.query.get(permission_id)
    if not permission:
        return jsonify({'error': 'Permission not found'}), 404
    if role.is_super:
        return jsonify({'error': 'Super roles already have every permission — nothing to toggle'}), 400

    actor_school_id = _school_scope_actor_school_id(actor)
    if actor_school_id is not None and role.scope != 'TENANT':
        return jsonify({'error': 'Cannot edit permissions for a COMPANY-scope role'}), 403

    data = request.get_json() or {}
    is_enabled = bool(data.get('is_enabled', True))

    row = RolePermission.query.filter_by(
        role_id=role_id, permission_id=permission_id, school_id=actor_school_id,
    ).first()
    old_value = {'is_enabled': row.is_enabled} if row else None

    if row:
        row.is_enabled = is_enabled
    else:
        row = RolePermission(
            role_id=role_id, permission_id=permission_id,
            school_id=actor_school_id, is_enabled=is_enabled,
        )
        db.session.add(row)

    db.session.commit()

    log_fn_kwargs = dict(
        module='rbac', action='PERMISSION_CHANGE',
        old_value=old_value, new_value={'is_enabled': is_enabled},
        remarks=f'{"Granted" if is_enabled else "Revoked"} {permission.key} for role {role.key}',
    )
    if actor_school_id is None:
        log_company_action(actor_user=actor, **log_fn_kwargs)
    else:
        log_action(submodule='role_permission', user=actor, **log_fn_kwargs)
    db.session.commit()

    return jsonify({
        'role_id': row.role_id,
        'permission_id': row.permission_id,
        'school_id': row.school_id,
        'is_enabled': row.is_enabled,
    }), 200


# ═══════════════════════════════════════════════════════════════════════════
#  ROLE SWITCH  (spec section 5 — dropdown to switch active role, no logout)
# ═══════════════════════════════════════════════════════════════════════════
# Not gated by permission_required('admin.user.manage') like the routes
# above -- a user must always be able to see and switch between their OWN
# held roles regardless of what they're otherwise permitted to manage.
# This is what RoleSwitchDropdown.jsx calls; neither endpoint existed
# before, which is why that component's fetch always failed silently.

@rbac_bp.route('/user-roles', methods=['GET'])
def list_my_roles():
    """GET /api/rbac/user-roles -- every role assignment the CALLER holds."""
    from flask_jwt_extended import verify_jwt_in_request
    verify_jwt_in_request()
    actor = get_current_user()
    if not actor:
        return jsonify({'error': 'Authentication required'}), 401

    assignments = UserRoleAssignment.query.filter_by(user_id=actor.id).all()
    roles_by_id = {
        r.id: r for r in Role.query.filter(
            Role.id.in_([a.role_id for a in assignments])
        ).all()
    }

    return jsonify([
        {
            'id':        a.role_id,
            'key':       roles_by_id[a.role_id].key,
            'name':      roles_by_id[a.role_id].name,
            'is_active': a.is_active,
        }
        for a in assignments if a.role_id in roles_by_id
    ]), 200


@rbac_bp.route('/switch-role', methods=['POST'])
def switch_active_role():
    """
    POST /api/rbac/switch-role  { role_id }
    Only changes which of the caller's OWN already-held roles is "active"
    (dashboard context) -- does not grant a new role and never touches
    another user. Permission resolution (resolve_platform_permissions)
    already unions every held role regardless of is_active, so this can
    only change which dashboard renders, never widen or shrink access.
    """
    from flask_jwt_extended import verify_jwt_in_request
    verify_jwt_in_request()
    actor = get_current_user()
    if not actor:
        return jsonify({'error': 'Authentication required'}), 401

    data = request.get_json() or {}
    role_id = data.get('role_id')
    if not role_id:
        return jsonify({'error': 'role_id is required'}), 400

    target_assignment = UserRoleAssignment.query.filter_by(
        user_id=actor.id, role_id=role_id
    ).first()
    if not target_assignment:
        return jsonify({'error': 'You do not hold this role'}), 403

    role = Role.query.get(role_id)

    # Flip is_active across only the CALLER's own rows.
    UserRoleAssignment.query.filter_by(user_id=actor.id).update({'is_active': False})
    target_assignment.is_active = True

    # Best-effort mirror onto the legacy single-role field: DashboardRouter.jsx
    # and every @role_required(...) route still read user.role directly, so
    # switching only the new-engine assignment would be cosmetic without
    # this. Skipped (not crashed) if the key has no legacy enum value yet --
    # e.g. company-side roles, or DIRECTOR until its migration lands.
    from app.models.user import UserRole
    try:
        actor.role = UserRole(role.key)
    except ValueError:
        pass

    db.session.commit()

    return jsonify({
        'active_role': {'id': role.id, 'key': role.key, 'name': role.name},
        'permissions': sorted(resolve_platform_permissions(actor, school_id=actor.school_id)),
    }), 200
