import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * FeesPage (Deprecated / Legacy V1)
 * Superseded by Unified Finance Suite: FeeBillsPage, CollectPaymentPage, ReceiptsPage, StudentFinancialLedgerPage.
 * Seamlessly redirects users to the canonical /fees route.
 */
export default function FeesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    const slug = user?.school_slug || 'school';
    const role = (user?.role || 'principal').toLowerCase();
    navigate(`/${slug}/${role}/fees${location.search}`, { replace: true });
  }, [navigate, location.search, user]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif' }}>
      <p style={{ color: '#64748b' }}>Redirecting to Unified Fee Management...</p>
    </div>
  );
}
