// frontend/src/components/rbac/RoleSwitchDropdown.jsx
import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import api from '../../api/axios';

export default function RoleSwitchDropdown({ darkMode }) {
  const { user, setUser } = useContext(AuthContext);
  const [showDropdown, setShowDropdown] = useState(false);
  const [availableRoles, setAvailableRoles] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.id) {
      fetchAvailableRoles();
    }
  }, [user?.id]);

  const fetchAvailableRoles = async () => {
    try {
      const res = await api.get('/rbac/user-roles');
      setAvailableRoles(res.data || []);
    } catch (err) {
      console.error('Failed to fetch roles:', err);
    }
  };

  const switchRole = async (roleId) => {
    setLoading(true);
    try {
      const res = await api.post('/rbac/switch-role', { role_id: roleId });
      // Update user context with new active role
      setUser(prev => ({
        ...prev,
        active_role: res.data.active_role,
        permissions: res.data.permissions,
      }));
      setShowDropdown(false);
      // Reload page to reflect new permissions
      window.location.reload();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to switch role');
    } finally {
      setLoading(false);
    }
  };

  // Show only if user has multiple roles
  if (!user || availableRoles.length < 2) return null;

  const activeRole = availableRoles.find(r => r.is_active) || availableRoles[0];

  return (
    <div style={{ position: 'relative' }}>
      <button
        className="btn btn-neutral btn-sm"
        onClick={() => setShowDropdown(!showDropdown)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          background: darkMode ? '#1e293b' : undefined,
          color: darkMode ? '#e2e8f0' : undefined,
        }}
        disabled={loading}
      >
        <i className="ti ti-switch-horizontal" />
        <span style={{ fontWeight: 600, fontSize: 12 }}>
          {activeRole?.name || 'Switch Role'}
        </span>
        <i className="ti ti-chevron-down" style={{ fontSize: 12 }} />
      </button>

      {showDropdown && (
        <>
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 999,
            }}
            onClick={() => setShowDropdown(false)}
          />
          <div
            style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: 4,
              background: darkMode ? '#141b2d' : 'white',
              border: `1px solid ${darkMode ? '#1e293b' : '#e2e8f0'}`,
              borderRadius: 8,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              zIndex: 1000,
              minWidth: 200,
              maxHeight: 300,
              overflowY: 'auto',
              padding: '4px 0',
            }}
          >
            {availableRoles.map(role => (
              <button
                key={role.id}
                onClick={() => switchRole(role.id)}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '8px 16px',
                  textAlign: 'left',
                  border: 'none',
                  background: role.is_active 
                    ? (darkMode ? 'rgba(79,70,229,0.2)' : '#f5f3ff')
                    : 'transparent',
                  color: darkMode ? '#e2e8f0' : '#0f172a',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: role.is_active ? 700 : 400,
                  transition: 'background 0.1s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
                onMouseEnter={(e) => {
                  if (!role.is_active) {
                    e
