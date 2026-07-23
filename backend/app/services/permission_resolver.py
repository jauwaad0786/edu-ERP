# backend/app/services/permission_resolver.py
"""
File 6 — RBAC ko routes se connect karne ka bridge.

Do cheezein isme hain, dono zaroori hain ek doosre ke bina adhoore:

  1. `permission_required(*keys)` — naya decorator jo `role_required()` ko
     module-by-module replace karega. `resolve_platform_permissions()`
     (rbac.py) ko har request pe baar-baar na chalana pade isliye
     per-request cache hai (flask.g).

  2. `sync_legacy_role_assignments()` — backfill. rbac.py sirf Role ROWS
     seed karta hai, kisi bhi existing User ko kisi Role se assign nahi
     karta. Iske bina `permission_required` har user ko 403 dega, kyunki
     UserRoleAssignment table khaali hai. Ye function har existing User ke
     legacy `User.role` enum value ko dhoondh kar matching naye `Role` row
     se link karta hai — idempotent, safe to run every boot (jaise baaki
     saare seed functions), taaki naye signup bhi (jo abhi bhi sirf
     User.role likhte hain, UserRoleAssignment nahi) automatically sync
     hote rahein jab tak saare signup flows migrate na ho jayein.

     KNOWN GAP jo ye function khud detect karega: legacy UserRole enum me
     'HR' hai, lekin rbac.py ke DEFAULT_SCHOOL_ROLES me abhi 'HR' key
     missing hai (sirf company-side 'COMPANY_HR' hai). Jab tak rbac.py me
     ye add nahi hota, HR role wale users backfill me "unmapped" list me
     aayenge — crash nahi karega, bas skip karega aur report karega.
"""

from flask import g, jsonify
from functools import wraps

from app import db
from app.models.rbac import (
    Role, UserRoleAssignment, resolve_platform_permissions,
)

# Legacy enum values that map to a COMPANY-scope role instead of the
# default assumption (TENANT-scope, same key, under SCHOOL_ERP). Right now
# only SUPER_ADMIN needs this — the seeded platform Super Admin has no
# school_id and is conceptually a company-side operator, not school staff,
# even though it lives in the same User.role enum as PRINCIPAL/TEACHER/etc.
LEGACY_COMPANY_SCOPE_KEYS = {'SUPER_ADMIN'}


# ═══════════════════════════════════════════════════════════════════════════
#  PER-REQUEST CACHED PERMISSION CHECK
# ═══════════════════════════════════════════════════════════════════════════

def has_platform_permission_cached(user, permission_key, school_id=None):
    """
    Same result as rbac.has_platform_permission(), but computes the full
    permission set at most once per request (cached on flask.g), even if
    several @permission_required checks fire during the same request
    (e.g. a helper function called from inside a protected route that
    also checks a second permission).
    """
    cache_key = (user.id, school_id)
    if not hasattr(g, '_platform_permission_cache'):
        g._platform_permission_cache = {}

    if cache_key not in g._platform_permission_cache:
        g._platform_permission_cache[cache_key] = resolve_platform_permissions(
            user, school_id=school_id
        )

    return permission_key in g._platform_permission_cache[cache_key]


# ═══════════════════════════════════════════════════════════════════════════
#  DECORATOR
# ═══════════════════════════════════════════════════════════════════════════

def permission_required(*permission_keys):
    """
    Drop-in style replacement for @role_required(*roles), but checks
    DB-driven permissions instead of a hardcoded role list. Multiple keys
    are OR'd — matches role_required's existing semantics, so swapping one
    decorator for the other on a route doesn't change its calling
    convention.

    Usage:
        @fees_bp.route('/collect', methods=['POST'])
        @permission_required('Fees.Collect')
        def collect_fee():
            ...

    NOTE: do not swap this onto a route until sync_legacy_role_assignments()
    has run at least once AND the target Permission rows + RolePermission
    template rows actually exist for the roles that need access — this
    decorator denies by default (fails closed) if nothing matches, unlike
    the legacy decorator which had the allowed roles hardcoded right there
    in the route file.
    """
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            from app.utils.decorators import get_current_user
            user = get_current_user()
            if not user:
                return jsonify({'error': 'Authentication required'}), 401

            school_id = getattr(user, 'school_id', None)
            if any(has_platform_permission_cached(user, key, school_id=school_id)
                   for key in permission_keys):
                return fn(*args, **kwargs)

            return jsonify({
                'error': 'Permission denied',
                'required_any_of': list(permission_keys),
            }), 403
        return wrapper
    return decorator


def role_or_permission_required(roles=(), permissions=()):
    """
    Bridge decorator for routes that were @role_required(...) and still
    need to stay that way for their default roles, but ALSO need to open
    up for whoever a Principal grants an extra permission to via the Staff
    Access page.

    Root cause this fixes: after Sidebar + ProtectedRoute were made
    permission-aware, a Teacher granted e.g. 'staff.payroll.view' could
    reach /staff and /finance/payroll in the browser -- but the actual data
    endpoints behind those pages (GET /principal/users, GET
    /principal/payroll/records) were still plain @role_required('PRINCIPAL',
    ...) with no permission escape hatch at all. Result: page loads, fetch
    call gets a silent 403 (both pages `.catch(() => {})` / `.catch(() =>
    setRecords([]))` it), and the user sees an empty list -- no staff
    names, no payment history -- with no visible error.

    Checks, in order: (1) same role-equivalence + held-role logic as
    role_required, (2) if that fails, whether the user holds ANY of
    `permissions` via resolve_platform_permissions(). Passes if either
    check passes; 403 only if both fail.
    """
    from app.utils.decorators import _expand
    from app.models.user import User, UserRole

    allowed_keys = set()
    for r in roles:
        allowed_keys |= _expand(r)

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            from app.utils.decorators import get_current_user
            user = get_current_user()
            if not user or not getattr(user, 'is_active', True):
                return jsonify({'error': 'Access denied'}), 403

            allowed_enum = set()
            for k in allowed_keys:
                try:
                    allowed_enum.add(UserRole(k))
                except ValueError:
                    pass
            if user.role in allowed_enum:
                return fn(*args, **kwargs)

            from app.models.rbac import get_user_roles
            held_keys = {r.key for r in get_user_roles(user)}
            if held_keys & allowed_keys:
                return fn(*args, **kwargs)

            school_id = getattr(user, 'school_id', None)
            if permissions and any(
                has_platform_permission_cached(user, key, school_id=school_id)
                for key in permissions
            ):
                return fn(*args, **kwargs)

            return jsonify({
                'error': f'Role {user.role} not authorized',
                'required_any_of_permissions': list(permissions),
            }), 403
        return wrapper
    return decorator


# ═══════════════════════════════════════════════════════════════════════════
#  BACKFILL — legacy User.role  →  UserRoleAssignment
# ═══════════════════════════════════════════════════════════════════════════

def ensure_role_assignment_for_user(user):
    """
    Single-user version of sync_legacy_role_assignments(), for use right
    after a new staff/teacher User row is created (principal.py), and
    lazily at login (auth.py's _serialize_user) to heal any existing user
    who is still missing one.

    WHY THIS MATTERS: creating a User row only sets the legacy `User.role`
    enum column. Permission resolution (resolve_platform_permissions) reads
    `UserRoleAssignment`, not `User.role` directly. Before this function was
    called at creation time, a brand-new "Hostel Warden" or "Accountant" had
    ZERO UserRoleAssignment rows until the next server restart ran the boot
    backfill -- meaning no role-default permissions AND (until the
    overrides-without-roles fix above) no per-user override either. From
    the Principal's side this looked like "Staff Access page permission
    grant kiya lekin kuch change nahi hota".

    Idempotent -- safe to call on every login and every user creation.
    Returns the linked Role row, or None if this legacy role has no
    matching platform Role yet (see sync_legacy_role_assignments' KNOWN GAP
    note).
    """
    from app.models.platform import Product

    legacy_role = getattr(user, 'role', None)
    if not legacy_role:
        return None
    role_key = legacy_role.value if hasattr(legacy_role, 'value') else str(legacy_role)

    existing = UserRoleAssignment.query.filter_by(user_id=user.id).first()
    if existing:
        return Role.query.get(existing.role_id)

    if role_key in LEGACY_COMPANY_SCOPE_KEYS:
        target_role = Role.query.filter_by(key=role_key, scope='COMPANY').first()
    else:
        school_product = Product.query.filter_by(key='SCHOOL_ERP').first()
        target_role = (
            Role.query.filter_by(key=role_key, scope='TENANT', product_id=school_product.id).first()
            if school_product else None
        )

    if not target_role:
        return None

    db.session.add(UserRoleAssignment(
        user_id=user.id, role_id=target_role.id, is_active=True,
    ))
    return target_role


def sync_legacy_role_assignments():
    """
    Idempotent. For every User with a legacy `role` set, ensures a matching
    active UserRoleAssignment exists. Never removes or overwrites an
    assignment a Principal/Admin has manually added through the new RBAC
    system — only fills in the gap for users who have none yet.

    Returns a summary dict: {'created': int, 'already_synced': int,
    'unmapped': [{'user_id', 'email', 'legacy_role'}]} — check
    'unmapped' after every deploy; it should shrink to zero as role
    coverage in rbac.py's DEFAULT_SCHOOL_ROLES / DEFAULT_COMPANY_ROLES
    gets completed.
    """
    from app.models.user import User
    from app.models.platform import Product

    school_product = Product.query.filter_by(key='SCHOOL_ERP').first()

    # Pre-load all roles once instead of a query per user.
    all_roles = Role.query.all()
    company_roles = {r.key: r for r in all_roles if r.scope == 'COMPANY'}
    school_roles = ({r.key: r for r in all_roles
                     if r.scope == 'TENANT' and r.product_id == school_product.id}
                    if school_product else {})

    existing_assignments = {
        (a.user_id, a.role_id) for a in UserRoleAssignment.query.all()
    }
    users_with_any_assignment = {a.user_id for a in UserRoleAssignment.query.all()}

    created, already_synced, unmapped = 0, 0, []

    for user in User.query.all():
        legacy_role = getattr(user, 'role', None)
        if not legacy_role:
            continue
        role_key = legacy_role.value if hasattr(legacy_role, 'value') else str(legacy_role)

        if user.id in users_with_any_assignment:
            already_synced += 1
            continue

        target_role = (
            company_roles.get(role_key) if role_key in LEGACY_COMPANY_SCOPE_KEYS
            else school_roles.get(role_key)
        )

        if not target_role:
            unmapped.append({
                'user_id': user.id, 'email': getattr(user, 'email', None),
                'legacy_role': role_key,
            })
            continue

        if (user.id, target_role.id) in existing_assignments:
            already_synced += 1
            continue

        db.session.add(UserRoleAssignment(
            user_id=user.id, role_id=target_role.id, is_active=True,
        ))
        created += 1

    if created:
        db.session.commit()

    return {'created': created, 'already_synced': already_synced, 'unmapped': unmapped}
