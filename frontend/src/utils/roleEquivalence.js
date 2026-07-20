// frontend/src/utils/roleEquivalence.js
//
// Mirrors backend/app/utils/decorators.py's ROLE_EQUIVALENCE exactly.
// "Director & Principal have same dashboard. Vice Principal has same
// dashboard except cannot delete Director/Principal." (spec section 1)
//
// Rather than adding 'DIRECTOR'/'VICE_PRINCIPAL' to every single
// <ProtectedRoute roles={[...]}> array across App.jsx (50+ occurrences)
// and every Sidebar.jsx ROLE_MENUS block, we expand the *check* itself
// here -- same approach the backend already takes. The one carve-out the
// spec makes (VP cannot delete a Principal/Director account) is enforced
// server-side by hierarchy_level in rbac.py's can_manage_role(), never by
// role-name matching -- so a VP reaching a delete action via this
// expansion still gets correctly blocked one layer deeper, not by name.
export const ROLE_EQUIVALENCE = {
  PRINCIPAL: ['PRINCIPAL', 'DIRECTOR', 'VICE_PRINCIPAL'],
};

/** All role keys equivalent to the given one (including itself). */
export function expandRole(roleKey) {
  return ROLE_EQUIVALENCE[roleKey] || [roleKey];
}

/** True if userRole satisfies any of the allowedRoles, dashboard-equivalence included. */
export function roleIsAllowed(userRole, allowedRoles) {
  if (!allowedRoles) return true;
  return allowedRoles.some(allowed => expandRole(allowed).includes(userRole));
}

/**
 * For lookups keyed by role (e.g. Sidebar's ROLE_MENUS) that don't have
 * their own DIRECTOR/VICE_PRINCIPAL entry: fall back to the PRINCIPAL
 * entry, since a menu table is naturally keyed by "canonical" role, not
 * every equivalent alias.
 */
export function resolveMenuRole(userRole, menuTable) {
  if (menuTable[userRole]) return userRole;
  for (const canonical of Object.keys(ROLE_EQUIVALENCE)) {
    if (ROLE_EQUIVALENCE[canonical].includes(userRole)) return canonical;
  }
  return userRole;
}
