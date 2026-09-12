import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { buildTenantRoute, getCanonicalRoleSlug, getCanonicalSchoolSlug, ROLE_SLUG_MAP } from '../utils/routeBuilder';
import { NotFoundPage } from '../pages/ErrorPages';

/**
 * LegacyRedirect
 * Seamless backward-compatibility handler for un-prefixed routes.
 * Takes legacy routes (e.g. /fees, /students, /settings/whatsapp, /dashboard)
 * and resolves them to the logged-in user's canonical tenant URL with query parameters preserved.
 * 
 * STRICT LOOP PROTECTION:
 * Never appends tenant prefixes if the path is already inside tenant space.
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
    // If requesting root or index.html, just go to /login
    if (location.pathname === '/' || location.pathname === '/index.html') {
      return <Navigate to="/login" replace />;
    }
    const returnUrl = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?returnUrl=${returnUrl}`} replace />;
  }

  const isCompanyActor = user && user.school_id == null;
  const isSuperAdmin = user?.role === 'SUPER_ADMIN' || user?.active_role?.key === 'SUPER_ADMIN' || !!user?.is_super;

  // Platform admin redirect
  if (isCompanyActor && isSuperAdmin) {
    if (!toService || toService === 'dashboard' || toService === 'index.html') {
      return <Navigate to={`/admin/dashboard${location.search}`} replace />;
    }
    return <Navigate to={`/admin/${toService}${location.search}`} replace />;
  }

  const schoolSlug = getCanonicalSchoolSlug(user);
  const roleSlug = getCanonicalRoleSlug(user);

  let targetService = toService;
  const q = new URLSearchParams(location.search);
  const isAuditQuery = q.has('module') || q.has('is_delegated') || q.get('tab') === 'retention';

  // If no explicit target service, derive cleanly without loops
  if (!targetService) {
    let cleanPath = location.pathname.startsWith('/') ? location.pathname.slice(1) : location.pathname;

    // Handle index.html or empty path
    if (cleanPath === '' || cleanPath === 'index.html' || cleanPath.endsWith('/index.html')) {
      targetService = isAuditQuery ? 'audit-logs' : 'dashboard';
    } else {
      // Split parts and clean out any existing schoolSlug or roleSlug
      const parts = cleanPath.split('/').filter(p => p && p !== 'index.html');
      
      // If it already has multiple schoolSlug / role repeats, clean them all out
      while (parts.length > 0 && (parts[0].toLowerCase() === schoolSlug.toLowerCase() || Object.values(ROLE_SLUG_MAP).includes(parts[0].toLowerCase()))) {
        parts.shift();
      }

      targetService = parts.join('/') || 'dashboard';
    }
  }

  if (isAuditQuery && targetService === 'dashboard') {
    targetService = 'audit-logs';
  }

  // Alias mappings
  if (targetService === 'audit/school/logs') targetService = 'audit-logs';
  if (targetService === 'principal/deleted-items') targetService = 'deleted-items';

  const destination = buildTenantRoute({
    schoolSlug,
    role: roleSlug,
    service: targetService,
    search: location.search
  });

  // Strict anti-loop guard: if destination is identical to current path, do NOT redirect!
  if (destination === location.pathname + location.search || destination === location.pathname) {
    return <NotFoundPage />;
  }

  return <Navigate to={destination} replace />;
}
