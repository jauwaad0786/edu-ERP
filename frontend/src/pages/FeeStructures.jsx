import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { resolveTenantPath } from '../utils/routeBuilder';

/**
 * FeeStructures (Deprecated / Legacy V1)
 * Superseded by FeeSetupPage (frontend/src/pages/finance/FeeSetupPage.jsx).
 * Seamlessly redirects users to the canonical /finance/setup route.
 */
export default function FeeStructures() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    const target = resolveTenantPath(`/finance/setup${location.search}`, user);
    navigate(target, { replace: true });
  }, [navigate, location.search, user]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif' }}>
      <p style={{ color: '#64748b' }}>Redirecting to Fee Setup & Structure Management...</p>
    </div>
  );
}
