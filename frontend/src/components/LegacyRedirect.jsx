import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { buildTenantRoute, getCanonicalRoleSlug, getCanonicalSchoolSlug } from '../utils/routeBuilder';

/**
 * LegacyRedirect
 * Seamless backward-compatibility handler for un-prefixed routes.
 * Takes any legacy route (e.g. /fees, /students, /settings/whatsapp, /dashboard)
 * and resolves it to the logged-in user's canonical tenant URL with query parameters preserved.
 */
export default function LegacyRedirect({ toService = '' }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#f8fafc'
      }}>
        <div style={{
          width: 36, height: 36,
          border: '4px solid #e2e8f0',
          borderTop: '4px solid #2563eb',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!user) {
    const returnUrl = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?returnUrl=${returnUrl}`} replace />;
  }

  const isCompanyActor = user && user.school_id == null;
  const isSuperAdmin = user?.role === 'SUPER_ADMIN' || user?.active_role?.key === 'SUPER_ADMIN' || !!user?.is_super;

  // Platform admin redirect
  if (isCompanyActor && isSuperAdmin) {
    if (!toService || toService === 'dashboard') {
      return <Navigate to={`/admin/dashboard${location.search}`} replace />;
    }
    return <Navigate to={`/admin/${toService}${location.search}`} replace />;
  }

  const schoolSlug = getCanonicalSchoolSlug(user);
  const roleSlug = getCanonicalRoleSlug(user);

  let targetService = toService;
  if (!targetService) {
    const cleanPath = location.pathname.startsWith('/') ? location.pathname.slice(1) : location.pathname;
    targetService = cleanPath || 'dashboard';
  }

  const destination = buildTenantRoute({
    schoolSlug,
    role: roleSlug,
    service: targetService,
    search: location.search
  });

  return <Navigate to={destination} replace />;
}
