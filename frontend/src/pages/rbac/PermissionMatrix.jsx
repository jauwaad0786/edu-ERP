import React, { useState, useEffect, useMemo } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api from '../../api/axios';
import { usePermission } from '../../hooks/usePermission';
import { useAuth } from '../../context/AuthContext';

export default function PermissionMatrix() {
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('ederp_theme') === 'dark');
  useEffect(() => { localStorage.setItem('ederp_theme', darkMode ? 'dark' : 'light'); }, [darkMode]);

  const { user } = useAuth();
  // Same reasoning as RoleManagement.jsx: a school-scoped actor always
  // gets forced to TENANT roles server-side, so the scope tabs are only
  // meaningful (and only shown) for a company-scoped actor.
  const isCompanyActor = !user?.school_id;
  const [activeScope, setActiveScope] = useState(isCompanyActor ? 'COMPANY' : 'TENANT');

  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [rolePermissions, setRolePermissions] = useState({});
  // Staged edits: { "roleId:permId": true/false }. Nothing here hits the
  // API until "Save Changes" -- this is the whole fix for "changes show
  // in the UI but don't apply until saved" / no confirm step before.
  const [pendingChanges, setPendingChanges] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const canManage = usePermission('admin.user.manage');

  useEffect(() => {
    fetchData();
    setPendingChanges({});
  }, [activeScope]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rolesRes, permsRes] = await Promise.all([
        api.get('/rbac/roles', { params: { scope: activeScope } }),
        api.get('/rbac/permissions'),
      ]);
      setRoles(rolesRes.data || []);
      setPermissions(permsRes.data || []);

      const rpRes = await api.get('/rbac/role-permissions');
      setRolePermissions(rpRes.data || {});
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Permissions grouped by module -- Permission.module already comes
  // sorted from the backend (order_by(Permission.module, Permission.key)),
  // this just buckets the flat array into sections instead of rendering
  // one long confusing column list.
  const permissionsByModule = useMemo(() => {
    const groups = {};
    for (const p of permissions) {
      const mod = p.module || 'other';
      if (!groups[mod]) groups[mod] = [];
      groups[mod].push(p);
    }
    return groups;
  }, [permissions]);

  const cellKey = (roleId, permId) => `${roleId}:${permId}`;

  const isEnabled = (roleId, permId) => {
    const key = cellKey(roleId, permId);
    if (key in pendingChanges) return pendingChanges[key];
    return rolePermissions[roleId]?.[permId] || false;
  };

  const isDirty = (roleId, permId) => cellKey(roleId, permId) in pendingChanges;

  const toggleCell = (roleId, permId) => {
    if (!canManage) return;
    const current = isEnabled(roleId, permId);
    setPendingChanges(prev => ({ ...prev, [cellKey(roleId, permId)]: !current }));
  };

  const cancelChanges = () => setPendingChanges({});

  const saveChanges = async () => {
    const entries = Object.entries(pendingChanges);
    if (!entries.length) return;
    setSaving(true);
    try {
      // Sequential, not Promise.all -- toggle_role_permission does a
      // read-then-write per row; firing 20 of these concurrently against
      // the same role risks lost updates. Slower but correct.
      for (const [key, is_enabled] of entries) {
        const [roleId, permId] = key.split(':');
        await api.post(`/rbac/roles/${roleId}/permissions/${permId}`, { is_enabled });
      }
      setRolePermissions(prev => {
        const next = { ...prev };
        for (const [key, is_enabled] of entries) {
          const [roleId, permId] = key.split(':');
          next[roleId] = { ...(next[roleId] || {}), [permId]: is_enabled };
        }
        return next;
      });
      setPendingChanges({});
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save some permission changes');
      // Re-fetch so the grid reflects whatever actually landed, since a
      // failure partway through the loop can leave some rows saved.
      await fetchData();
    } finally {
      setSaving(false);
    }
  };

  const getRoleColor = (role) => {
    if (role.is_super) return '#4f46e5';
    if (role.is_protected) return '#dc2626';
    return '#64748b';
  };

  const pendingCount = Object.keys(pendingChanges).length;

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
          <p className="page-subtitle">
            {activeScope === 'COMPANY'
              ? 'Permissions for internal company roles'
              : 'Permissions for school-side roles'}
          </p>
        </div>
        {canManage && (
          <button className="btn btn-neutral btn-sm" onClick={fetchData} disabled={pendingCount > 0}>
            <i className="ti ti-refresh" /> Refresh
          </button>
        )}
      </div>

      {isCompanyActor && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid var(--neutral-2)' }}>
          {[['COMPANY', '🏢 Company Roles'], ['TENANT', '🏫 School Roles']].map(([scope, label]) => (
            <button
              key={scope}
              onClick={() => {
                if (pendingCount > 0 && !window.confirm('Unsaved changes will be discarded. Switch anyway?')) return;
                setActiveScope(scope);
              }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '10px 20px', fontSize: 13, fontWeight: 600,
                color: activeScope === scope ? 'var(--blue-60)' : 'var(--neutral-6)',
                borderBottom: activeScope === scope ? '2px solid var(--blue-60)' : '2px solid transparent',
                marginBottom: -2,
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Sticky Save/Cancel bar -- only appears once something is staged */}
      {pendingCount > 0 && (
        <div style={{
          position: 'sticky', top: 0, zIndex: 5,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: darkMode ? '#1e293b' : '#eff6ff',
          border: `1px solid ${darkMode ? '#334155' : '#bfdbfe'}`,
          borderRadius: 8, padding: '10px 16px', marginBottom: 16,
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: darkMode ? '#e2e8f0' : '#1e40af' }}>
            {pendingCount} unsaved change{pendingCount > 1 ? 's' : ''}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-neutral btn-sm" onClick={cancelChanges} disabled={saving}>
              Cancel
            </button>
            <button className="btn btn-primary btn-sm" onClick={saveChanges} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      {Object.entries(permissionsByModule).map(([moduleName, modulePerms]) => (
        <div key={moduleName} className="card" style={{ marginBottom: 20, background: darkMode ? '#141b2d' : undefined }}>
          <div className="card-header" style={{ textTransform: 'capitalize' }}>
            <h4 style={{ margin: 0 }}>{moduleName}</h4>
          </div>
          <div className="card-body" style={{ overflowX: 'auto', padding: 0 }}>
            <table style={{ minWidth: 800, width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{
                    position: 'sticky', left: 0,
                    background: darkMode ? '#141b2d' : 'white',
                    zIndex: 2, minWidth: 150, padding: '12px 16px',
                    textAlign: 'left', borderBottom: '2px solid var(--neutral-2)',
                  }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>Role ↓</div>
                  </th>
                  {modulePerms.map(p => (
                    <th key={p.id} style={{
                      padding: '8px 4px', textAlign: 'center', fontSize: 11,
                      fontWeight: 600, color: '#64748b',
                      borderBottom: '2px solid var(--neutral-2)', minWidth: 70,
                    }}>
                      <div style={{
                        writingMode: 'vertical-rl', textOrientation: 'mixed',
                        letterSpacing: 0.5, maxHeight: 80,
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
                        position: 'sticky', left: 0,
                        background: darkMode ? '#0f172a' : 'white',
                        zIndex: 1, padding: '8px 16px',
                        borderBottom: '1px solid var(--neutral-1)',
                        fontWeight: 600, fontSize: 13, color: getRoleColor(role),
                      }}>
                        <div>{role.name}</div>
                        <div style={{ fontSize: 10, color: '#64748b', fontWeight: 400 }}>
                          Level {role.hierarchy_level}{role.is_super && ' ★'}
                        </div>
                      </td>
                      {modulePerms.map(p => {
                        const enabled = isEnabled(role.id, p.id);
                        const dirty = isDirty(role.id, p.id);
                        const isSuper = role.is_super;
                        return (
                          <td key={p.id} style={{
                            textAlign: 'center', padding: '6px 4px',
                            borderBottom: '1px solid var(--neutral-1)',
                            background: isSuper ? (darkMode ? 'rgba(79,70,229,0.1)' : '#f5f3ff') : undefined,
                          }}>
                            <button
                              onClick={() => toggleCell(role.id, p.id)}
                              disabled={!canManage || isSuper || saving}
                              style={{
                                width: 28, height: 28, borderRadius: 6,
                                border: dirty ? '2px solid #f59e0b' : 'none',
                                background: isSuper
                                  ? '#4f46e5'
                                  : enabled
                                    ? (darkMode ? 'rgba(34,197,94,0.3)' : '#dcfce7')
                                    : (darkMode ? '#1e293b' : '#f1f5f9'),
                                color: isSuper
                                  ? 'white'
                                  : enabled ? '#16a34a' : (darkMode ? '#64748b' : '#94a3b8'),
                                cursor: (isSuper || !canManage || saving) ? 'default' : 'pointer',
                                fontSize: 14, display: 'flex', alignItems: 'center',
                                justifyContent: 'center', margin: '0 auto',
                                transition: 'all 0.15s',
                                opacity: isSuper ? 1 : (enabled ? 1 : 0.4),
                              }}
                              title={isSuper ? 'Super role has all permissions' : (enabled ? 'Click to revoke' : 'Click to grant')}
                            >
                              {isSuper ? '★' : enabled ? '✓' : '−'}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <div style={{ fontSize: 12, color: '#64748b', textAlign: 'right', marginTop: -8 }}>
        ★ = Super role (all permissions) · ✓ = Enabled · − = Disabled · 🟠 border = unsaved
      </div>
        </div>
      </div>
    </div>
  );
}
