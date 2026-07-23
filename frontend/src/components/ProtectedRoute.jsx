import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { roleIsAllowed } from '../utils/roleEquivalence';

// `roles`: static allow-list, same as before (role-default access).
// `permissions`: OPTIONAL array of permission_catalog.py keys -- pass
// ROUTE_PERMISSIONS['/some/path'] from utils/permissionMenuMap.js here.
// If the user's role isn't in `roles` but they hold ANY of these
// permissions (granted via Staff Access page / UserPermissionOverride),
// the route still opens.
//
// Bug this fixes: earlier this component only ever checked `roles`, a
// hardcoded per-route array. So even after Principal granted a Teacher an
// extra permission (e.g. 'fees.structure.manage') and the sidebar item
// correctly appeared, clicking it still bounced back to /dashboard --
// this gate had no idea permissions existed at all.
export default function ProtectedRoute({ children, roles, permissions }) {
  const { user, loading } = useAuth();

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <div style={{
        width: 36, height: 36,
        border: '4px solid #e5e7eb',
        borderTop: '4px solid #6366f1',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite'
      }}></div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (!user) return <Navigate to="/login" replace />;

  const roleOk = roleIsAllowed(user.role, roles);
  const permissionOk = !!permissions?.length &&
    (user.permissions || []).some(p => permissions.includes(p));

  if (!roleOk && !permissionOk) return <Navigate to="/dashboard" replace />;
  return children;
}
