import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

export function usePermission(permissionKey) {
  const { user } = useContext(AuthContext);
  
  if (!user) return false;
  
  // Super Admin / CEO bypass
  if (user.role === 'SUPER_ADMIN' || user.role === 'CEO') return true;
  
  // Check if user has the permission in their permissions list
  return (user.permissions || []).includes(permissionKey);
}

export function usePermissions(permissionKeys) {
  const { user } = useContext(AuthContext);
  
  if (!user) return false;
  if (user.role === 'SUPER_ADMIN' || user.role === 'CEO') return true;
  
  return permissionKeys.some(key => (user.permissions || []).includes(key));
}
