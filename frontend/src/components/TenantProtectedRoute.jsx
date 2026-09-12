import React from 'react';
import { Navigate, useParams, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { roleIsAllowed } from '../utils/roleEquivalence';
import { getCanonicalRoleSlug, getCanonicalSchoolSlug } from '../utils/routeBuilder';
import { AccessDeniedPage, SchoolMismatchPage } from '../pages/ErrorPages';

/**
 * TenantProtectedRoute
 * Enforces:
 * 1. Authentication
 * 2. School Tenant Isolation (:schoolSlug matches user.school_code)
 * 3. Role Isolation (:role matches user's active role slug)
 * 4. Granular RBAC Permissions & Delegation Layer
 */
export default function TenantProtectedRoute({ children, roles, permissions }) {
  const { user, loading } = useAuth();
  const { schoolSlug, role } = useParams();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#f8fafc', fontFamily: "'Plus Jakarta Sans', sans-serif"
      }}>
        <div style={{
          width: 44, height: 44,
          border: '4px solid #e2e8f0',
          borderTop: '4px solid #2563eb',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
        <div style={{ marginTop: 16, fontSize: 13, fontWeight: 700, color: '#64748b', letterSpacing: '0.04em' }}>
          1P360 SECURE GATEWAY
        </div>
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

  // ── 1. School Tenant Isolation Check ──
  if (schoolSlug && !isCompanyActor) {
    const userSchoolSlug = getCanonicalSchoolSlug(user);
    if (schoolSlug.toLowerCase() !== userSchoolSlug.toLowerCase()) {
      return <SchoolMismatchPage targetSchoolSlug={schoolSlug} />;
    }
  }

  // ── 2. Role Isolation Check ──
  const userRoleSlug = getCanonicalRoleSlug(user);
  if (role && !isSuperAdmin) {
    const requestedRole = role.toLowerCase();
    
    // Principal equivalents: principal, director, vice_principal
    const isPrincipalEquivalent = ['principal', 'director', 'vice_principal'].includes(userRoleSlug);
    const roleMatches = (requestedRole === userRoleSlug) ||
      (requestedRole === 'principal' && isPrincipalEquivalent);

    if (!roleMatches) {
      return (
        <AccessDeniedPage
          message={`Your authorized role is "${userRoleSlug.toUpperCase()}", but this service requires the "${requestedRole.toUpperCase()}" interface.`}
        />
      );
    }
  }

  // ── 3. Role Allowed List Check ──
  if (roles && roles.length > 0) {
    const roleOk = roleIsAllowed(user.role, roles) || isSuperAdmin;
    const permissionOk = !!permissions?.length &&
      (user.permissions || []).some(p => permissions.includes(p));

    if (!roleOk && !permissionOk) {
      return (
        <AccessDeniedPage
          message="You do not hold the required role privileges or delegated permissions for this module."
        />
      );
    }
  }

  return children;
}
