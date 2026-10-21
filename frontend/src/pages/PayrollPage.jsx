import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { resolveTenantPath } from '../utils/routeBuilder';

/**
 * PayrollPage (Deprecated / Legacy V1)
 * Superseded by FinancePayrollPage (frontend/src/pages/finance/FinancePayrollPage.jsx)
 * and HRMS PayrollManagerPage (frontend/src/pages/hrms/PayrollManagerPage.jsx).
 * Seamlessly redirects users to the canonical /finance/payroll route.
 */
export default function PayrollPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    const target = resolveTenantPath(`/finance/payroll${location.search}`, user);
    navigate(target, { replace: true });
  }, [navigate, location.search, user]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif' }}>
      <p style={{ color: '#64748b' }}>Redirecting to Enterprise Payroll Management...</p>
    </div>
  );
}
