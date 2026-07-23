import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

// is_super comes straight from the backend's real Role.is_super flag (see
// rbac.py's resolve_platform_permissions / auth.py's _serialize_user) --
// unlike the legacy user.role enum, this is NEVER true for a random
// company employee. Every company account (CEO, Manager, Intern, Sales,
// Developer, ...) gets the SAME legacy user.role = 'SUPER_ADMIN' at
// creation time (see admin.py's _resolve_creation_role -- it's used there
// purely as a generic "company account" marker, not a real identity).
// Checking user.role === 'SUPER_ADMIN' (or 'CEO', which the legacy enum
// doesn't even have) here used to hand every single company employee a
// full permission bypass, no matter how junior.

export function usePermission(permissionKey) {
  const { user } = useContext(AuthContext);

  if (!user) return false;
  if (user.is_super) return true;

  return (user.permissions || []).includes(permissionKey);
}

export function usePermissions(permissionKeys) {
  const { user } = useContext(AuthContext);

  if (!user) return false;
  if (user.is_super) return true;

  return permissionKeys.some(key => (user.permissions || []).includes(key));
}
