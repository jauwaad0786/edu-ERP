from functools import wraps
from flask import jsonify
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request
from app.models.user import User, UserRole

# ═══════════════════════════════════════════════════════════════════════════
#  DASHBOARD-EQUIVALENCE GROUPS  (spec section 1 — ROLE HIERARCHY)
# ═══════════════════════════════════════════════════════════════════════════
# "Director & Principal have same dashboard. Vice Principal has same
# dashboard except cannot delete Director/Principal."
#
# Rather than editing every `@role_required('PRINCIPAL', ...)` line across
# hostel.py / principal.py / finance.py (100+ occurrences, high regression
# risk for a one-line spec requirement), we expand the *check* itself here:
# whenever a route asks for 'PRINCIPAL', DIRECTOR and VICE_PRINCIPAL pass
# too. The one exception the spec carves out — VP cannot delete a
# Principal/Director user account — is enforced separately by
# `_actor_can_manage_target()` (principal.py) / the hierarchy check in
# admin.py's delete_user(), which compare rbac.py hierarchy_level and
# don't go through this decorator's role-name matching at all. So a VP
# reaching a delete-user route via this expansion still gets correctly
# blocked one layer deeper, by the real hierarchy check, not by name.
ROLE_EQUIVALENCE = {
    'PRINCIPAL': {'PRINCIPAL', 'DIRECTOR', 'VICE_PRINCIPAL'},
}


def _expand(role_key):
    return ROLE_EQUIVALENCE.get(role_key, {role_key})


def validate_user_and_school_lifecycle(user):
    """
    Validates user active status, account_status, and school lifecycle status.
    Returns (True, None) or (False, (json_response, 403))
    """
    if not user or not getattr(user, 'is_active', True):
        return False, (jsonify({'error': 'Access denied'}), 403)

    if getattr(user, 'account_status', 'ACTIVE') == 'SUSPENDED':
        return False, (jsonify({'error': 'Your user account has been suspended.'}), 403)

    role_str = getattr(user.role, 'value', str(user.role))
    if user.school_id and role_str != 'SUPER_ADMIN':
        from app.models.school import School
        school = School.query.get(user.school_id)
        if school:
            s_status = getattr(school, 'status', 'ACTIVE')
            if s_status == 'ARCHIVED':
                return False, (jsonify({'error': 'This school account is currently archived. Please contact the administrator.'}), 403)
            if s_status == 'SUSPENDED':
                return False, (jsonify({'error': 'This school account has been suspended. Please contact the administrator.'}), 403)
            if s_status in ('INACTIVE', 'DRAFT', 'ONBOARDING'):
                return False, (jsonify({'error': 'This school account is inactive. Please contact the administrator.'}), 403)

    return True, None


def role_required(*roles):
    """Decorator: restrict endpoint to given roles (dashboard-equivalent
    roles from ROLE_EQUIVALENCE are always included automatically).

    Checks user.role (legacy single-role field) FIRST -- the fast, common
    path, no extra query. Falls back to the full set of roles the user
    currently HOLDS via the new engine (app.models.rbac.get_user_roles),
    which is what makes Temporary Role Delegation (spec section 3) actually
    work for modules that haven't migrated to permission_required(...) yet
    -- Hostel, Library, Marks, most of principal.py. Without this fallback,
    delegating e.g. 'HOSTEL' to a Teacher created a UserRoleAssignment row
    that every @role_required('HOSTEL') route silently ignored, because it
    only ever checked the one legacy user.role value.
    """
    allowed_keys = set()
    for r in roles:
        allowed_keys |= _expand(r)

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            user_id = int(get_jwt_identity())
            user = User.query.get(user_id)
            is_valid, err_resp = validate_user_and_school_lifecycle(user)
            if not is_valid:
                return err_resp[0], err_resp[1]
            allowed_enum = set()
            for k in allowed_keys:
                try:
                    allowed_enum.add(UserRole(k))
                except ValueError:
                    pass
            if user.role in allowed_enum:
                return fn(*args, **kwargs)

            # Fallback: any role held via the new engine -- permanent
            # multi-role assignment OR an active temporary delegation.
            from app.models.rbac import get_user_roles
            held_keys = {r.key for r in get_user_roles(user)}
            if held_keys & allowed_keys:
                return fn(*args, **kwargs)

            return jsonify({'error': f'Role {user.role} not authorized'}), 403
        return wrapper
    return decorator


def get_current_user():
    try:
        verify_jwt_in_request(optional=True)
        identity = get_jwt_identity()
        if identity is None:
            return None
        return User.query.get(int(identity))
    except Exception:
        return None
