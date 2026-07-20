// frontend/src/pages/rbac/PermissionMatrix.jsx
import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api from '../../api/axios';
import { usePermission } from '../../hooks/usePermission';

export default function PermissionMatrix() {
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('ederp_theme') === 'dark');
  useEffect(() => { localStorage.setItem('ederp_theme', darkMode ? 'dark' : 'light'); }, [darkMode]);

  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [rolePermissions, setRolePermissions] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState(null);
  const [saving, setSaving] = useState(false);

  const canManage = usePermission('admin.user.manage');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [rolesRes, permsRes] = await Promise.all([
        api.get('/rbac/roles'),
        api.get('/rbac/permissions'),
      ]);
      setRoles(rolesRes.data || []);
      setPermissions(permsRes.data || []);
      
      // Fetch role-permission mappings
      if (rolesRes.data?.length) {
        const rpRes = await api.get('/rbac/role-permissions');
        setRolePermissions(rpRes.data || {});
      }
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  };

  const togglePermission = async (roleId, permissionId) => {
    if (!canManage) return;
    
    const current = rolePermissions[roleId]?.[permissionId] || false;
    setSaving(true);
    
    try {
      await api.post(`/rbac/roles/${roleId}/permissions/${permissionId}`, {
        is_enabled: !current,
      });
      
      setRolePermissions(prev => ({
        ...prev,
        [roleId]: {
          ...(prev[roleId] || {}),
          [permissionId]: !current,
        },
      }));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update permission');
    } finally {
      setSaving(false);
    }
  };

  const getRoleColor = (role) => {
    if (role.is_super) return '#4f46e5';
    if (role.is_protected) return '#dc2626';
    return '#64748b';
  };

  if (loading) {
    return (
      <div className={`app-shell${darkMode ? ' theme-dark' : ''}`}>
        <Sidebar darkMode={darkMode} />
        <div className="main-content">
          <Navbar title="Permission Matrix" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />
          <div className="page-body">
            <div className="loading-spinner">Loading permission matrix...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`app-shell${darkMode ? ' theme-dark' : ''}`}>
      <Sidebar darkMode={darkMode} />
      <div className="main-content">
        <Navbar title="Permission Matrix" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />
        <div className="page-body">
      <div className="page-header">
        <div>
          <h2 className="page-title">Permission Matrix</h2>
          <p className="page-subtitle">Define which permissions each role has — Jira/Entra ID style</p>
        </div>
        {canManage && (
          <button
            className="btn btn-neutral btn-sm"
            onClick={fetchData}
          >
            <i className="ti ti-refresh" /> Refresh
          </button>
        )}
      </div>

      <div className="card" style={{ background: darkMode ? '#141b2d' : undefined }}>
        <div className="card-body" style={{ overflowX: 'auto', padding: 0 }}>
          <table style={{ minWidth: 800, width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ 
                  position: 'sticky', 
                  left: 0, 
                  background: darkMode ? '#141b2d' : 'white',
                  zIndex: 2,
                  minWidth: 150,
                  padding: '12px 16px',
                  textAlign: 'left',
                  borderBottom: '2px solid var(--neutral-2)',
                }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>Permissions →</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>↓ Roles</div>
                </th>
                {permissions.map(p => (
                  <th key={p.id} style={{
                    padding: '8px 4px',
                    textAlign: 'center',
                    fontSize: 11,
                    fontWeight: 600,
                    color: '#64748b',
                    borderBottom: '2px solid var(--neutral-2)',
                    minWidth: 70,
                  }}>
                    <div style={{ 
                      writingMode: 'vertical-rl', 
                      textOrientation: 'mixed',
                      letterSpacing: 0.5,
                      maxHeight: 80,
                    }}>
                      {p.label || p.key}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {roles
                .sort((a, b) => a.hierarchy_level - b.hierarchy_level)
                .map(role => (
                  <tr key={role.id}>
                    <td style={{
                      position: 'sticky',
                      left: 0,
                      background: darkMode ? '#0f172a' : 'white',
                      zIndex: 1,
                      padding: '8px 16px',
                      borderBottom: '1px solid var(--neutral-1)',
                      fontWeight: 600,
                      fontSize: 13,
                      color: getRoleColor(role),
                    }}>
                      <div>{role.name}</div>
                      <div style={{ fontSize: 10, color: '#64748b', fontWeight: 400 }}>
                        Level {role.hierarchy_level}
                        {role.is_super && ' ★'}
                      </div>
                    </td>
                    {permissions.map(p => {
                      const isEnabled = rolePermissions[role.id]?.[p.id] || false;
                      const isSuper = role.is_super;
                      
                      return (
                        <td key={p.id} style={{
                          textAlign: 'center',
                          padding: '6px 4px',
                          borderBottom: '1px solid var(--neutral-1)',
                          background: isSuper ? (darkMode ? 'rgba(79,70,229,0.1)' : '#f5f3ff') : undefined,
                        }}>
                          <button
                            onClick={() => togglePermission(role.id, p.id)}
                            disabled={!canManage || isSuper || saving}
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 6,
                              border: 'none',
                              background: isSuper 
                                ? '#4f46e5' 
                                : isEnabled 
                                  ? (darkMode ? 'rgba(34,197,94,0.3)' : '#dcfce7')
                                  : (darkMode ? '#1e293b' : '#f1f5f9'),
                              color: isSuper 
                                ? 'white'
                                : isEnabled 
                                  ? '#16a34a' 
                                  : (darkMode ? '#64748b' : '#94a3b8'),
                              cursor: (isSuper || !canManage || saving) ? 'default' : 'pointer',
                              fontSize: 14,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              margin: '0 auto',
                              transition: 'all 0.15s',
                              opacity: isSuper ? 1 : (isEnabled ? 1 : 0.4),
                            }}
                            title={isSuper ? 'Super role has all permissions' : (isEnabled ? 'Click to revoke' : 'Click to grant')}
                          >
                            {isSuper ? '★' : isEnabled ? '✓' : '−'}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--neutral-2)', fontSize: 12, color: '#64748b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>
            {roles.length} roles · {permissions.length} permissions
            {saving && ' (Saving...)'}
          </span>
          <span>
            ★ = Super role (all permissions) · ✓ = Enabled · − = Disabled
          </span>
        </div>
      </div>
        </div>
      </div>
    </div>
  );
}
