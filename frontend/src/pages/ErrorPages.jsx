import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { buildTenantRoute, getCanonicalRoleSlug, getCanonicalSchoolSlug } from '../utils/routeBuilder';

export function NotFoundPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleReturn = () => {
    if (!user) {
      navigate('/login');
      return;
    }
    const schoolSlug = getCanonicalSchoolSlug(user);
    const roleSlug = getCanonicalRoleSlug(user);
    navigate(buildTenantRoute({ schoolSlug, role: roleSlug, service: 'dashboard' }));
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', background: '#f8fafc',
      padding: '24px', textAlign: 'center', fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif"
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: 20, background: '#eff6ff',
        color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 32, marginBottom: 20, boxShadow: '0 4px 12px rgba(37,99,235,0.12)'
      }}>
        <i className="ti ti-compass" />
      </div>
      <span style={{ fontSize: 12, fontWeight: 800, color: '#2563eb', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
        1P360 &bull; 404 Error
      </span>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', margin: '0 0 10px' }}>
        Page Not Found
      </h1>
      <p style={{ fontSize: 14, color: '#64748b', maxWidth: 460, margin: '0 0 24px', lineHeight: 1.5 }}>
        The requested service or URL does not exist or has been moved to a new canonical address.
      </p>
      <button
        onClick={handleReturn}
        style={{
          background: '#2563eb', color: '#ffffff', border: 'none',
          padding: '11px 22px', borderRadius: 10, fontSize: 14, fontWeight: 700,
          cursor: 'pointer', boxShadow: '0 4px 12px rgba(37,99,235,0.25)'
        }}
      >
        Return to Authorized Dashboard
      </button>
    </div>
  );
}

export function AccessDeniedPage({ message }) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleReturn = () => {
    if (!user) {
      navigate('/login');
      return;
    }
    const schoolSlug = getCanonicalSchoolSlug(user);
    const roleSlug = getCanonicalRoleSlug(user);
    navigate(buildTenantRoute({ schoolSlug, role: roleSlug, service: 'dashboard' }));
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', background: '#f8fafc',
      padding: '24px', textAlign: 'center', fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif"
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: 20, background: '#fef2f2',
        color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 32, marginBottom: 20, boxShadow: '0 4px 12px rgba(220,38,38,0.12)'
      }}>
        <i className="ti ti-shield-lock" />
      </div>
      <span style={{ fontSize: 12, fontWeight: 800, color: '#dc2626', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
        1P360 &bull; Security &bull; 403 Forbidden
      </span>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', margin: '0 0 10px' }}>
        Access Denied
      </h1>
      <p style={{ fontSize: 14, color: '#64748b', maxWidth: 500, margin: '0 0 24px', lineHeight: 1.5 }}>
        {message || "You do not have the required role or RBAC permissions to access this service."}
      </p>
      <button
        onClick={handleReturn}
        style={{
          background: '#0f172a', color: '#ffffff', border: 'none',
          padding: '11px 22px', borderRadius: 10, fontSize: 14, fontWeight: 700,
          cursor: 'pointer', boxShadow: '0 4px 12px rgba(15,23,42,0.15)'
        }}
      >
        Go to My Authorized Dashboard
      </button>
    </div>
  );
}

export function SchoolMismatchPage({ targetSchoolSlug }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const mySchoolSlug = getCanonicalSchoolSlug(user);
  const myRoleSlug = getCanonicalRoleSlug(user);

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', background: '#f8fafc',
      padding: '24px', textAlign: 'center', fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif"
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: 20, background: '#fffbeb',
        color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 32, marginBottom: 20, boxShadow: '0 4px 12px rgba(217,119,6,0.12)'
      }}>
        <i className="ti ti-building-community" />
      </div>
      <span style={{ fontSize: 12, fontWeight: 800, color: '#d97706', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
        1P360 &bull; Tenant Isolation Guard
      </span>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', margin: '0 0 10px' }}>
        School Tenant Access Denied
      </h1>
      <p style={{ fontSize: 14, color: '#64748b', maxWidth: 520, margin: '0 0 24px', lineHeight: 1.5 }}>
        You are authenticated with school tenant <strong>{mySchoolSlug}</strong> ({user?.school_name || user?.school?.name || 'My School'}), but you attempted to open the tenant <strong>{targetSchoolSlug}</strong>. Cross-tenant access is strictly forbidden by policy.
      </p>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
        <button
          onClick={() => navigate(buildTenantRoute({ schoolSlug: mySchoolSlug, role: myRoleSlug, service: 'dashboard' }))}
          style={{
            background: '#2563eb', color: '#ffffff', border: 'none',
            padding: '11px 22px', borderRadius: 10, fontSize: 14, fontWeight: 700,
            cursor: 'pointer', boxShadow: '0 4px 12px rgba(37,99,235,0.25)'
          }}
        >
          Open {user?.school_name || mySchoolSlug} Dashboard
        </button>
        <button
          onClick={() => { logout(); navigate('/login'); }}
          style={{
            background: '#ffffff', color: '#dc2626', border: '1px solid #fca5a5',
            padding: '11px 20px', borderRadius: 10, fontSize: 14, fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
