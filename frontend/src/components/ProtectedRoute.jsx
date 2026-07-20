import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { roleIsAllowed } from '../utils/roleEquivalence';

export default function ProtectedRoute({ children, roles }) {
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
  if (!roleIsAllowed(user.role, roles)) return <Navigate to="/dashboard" replace />;
  return children;
}
