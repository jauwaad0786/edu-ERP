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


def role_required(*roles):
    """Decorator: restrict endpoint to given roles (dashboard-equivalent
    roles from ROLE_EQUIVALENCE are always included automatically)."""
    allowed_keys = set()
    for r in roles:
        allowed_keys |= _expand(r)

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            user_id = int(get_jwt_identity())
            user = User.query.get(user_id)
            if not user or not user.is_active:
                return jsonify({'error': 'Access denied'}), 403
            allowed_enum = set()
            for k in allowed_keys:
                try:
                    allowed_enum.add(UserRole(k))
                except ValueError:
                    pass   # role key not in legacy enum yet — skip, don't crash the whole check
            if user.role not in allowed_enum:
                return jsonify({'error': f'Role {user.role} not authorized'}), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator


def get_current_user():
    user_id = int(get_jwt_identity())   # ← add int()
    return User.query.get(user_id)
