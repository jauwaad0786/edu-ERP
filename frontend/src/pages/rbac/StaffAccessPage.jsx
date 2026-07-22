import React, { useState, useEffect, useMemo } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api from '../../api/axios';
import { usePermission } from '../../hooks/usePermission';

// NEW — closes the gap found during the RBAC audit: UserPermissionOverride
// (grant/revoke a single permission for a single user) was fully built on
// the backend (routes/rbac.py) but had NO frontend anywhere that called it.
// PermissionMatrix.jsx only edits ROLE-level defaults; this page is the
// missing per-person layer on top of that -- "this one teacher can also
// collect fees" without opening fees.collect for every teacher.
export default function StaffAccessPage() {
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('ederp_theme') === 'dark');
  useEffect(() => { localStorage.setItem('ederp_theme', darkMode ? 'dark' : 'light'); }, [darkMode]);

  const canManage = usePermission('admin.user.manage');

  const [staff, setStaff]               = useState([]);
  const [staffLoading, setStaffLoading]  = useState(true);
  const [search, setSearch]              = useState('');
  const [selectedId, setSelectedId]      = useState(null);

  const [catalog, setCatalog]            = useState([]);
  const [effective, setEffective]        = useState(new Set());
  const [overrides, setOverrides]        = useState({});   // { permKey: is_enabled }
  const [detailLoading, setDetailLoading] = useState(false);
  const [savingKey, setSavingKey]        = useState(null);
  const [error, setError]                = useState('');

  // ── Load staff list once: Teacher.to_dict() now includes user_id (was
  // missing before -- without it there was no way to call
  // /rbac/users/<user_id>/permissions for anyone picked from this list).
  // Merged with /principal/staff-list (non-teaching staff) and deduped by
  // user_id so one page covers "all staff", not just teachers.
  useEffect(() => {
    (async () => {
      setStaffLoading(true);
      try {
        const [teachersRes, staffRes] = await Promise.all([
          api.get('/principal/teachers'),
          api.get('/principal/staff-list'),
        ]);
        const merged = new Map();
        for (const t of (teachersRes.data || [])) {
          if (t.user_id) merged.set(t.user_id, { user_id: t.user_id, name: t.name, designation: t.designation || 'Teacher' });
        }
        for (const s of (staffRes.data || [])) {
          if (s.id && !merged.has(s.id)) merged.set(s.id, { user_id: s.id, name: s.name, designation: s.designation });
        }
        setStaff([...merged.values()].sort((a, b) => (a.name || '').localeCompare(b.name || '')));
      } catch (err) {
        setError('Failed to load staff list');
      } finally {
        setStaffLoading(false);
      }
    })();
  }, []);

  // ── Load the permission catalog once (same source PermissionMatrix.jsx
  // uses), grouped by module.
  useEffect(() => {
    api.get('/rbac/permissions').then(res => setCatalog(res.data || [])).catch(() => {});
  }, []);

  const catalogByModule = useMemo(() => {
    const groups = {};
    for (const p of catalog) {
      const mod = p.module || 'other';
      if (!groups[mod]) groups[mod] = [];
      groups[mod].push(p);
    }
    return groups;
  }, [catalog]);

  const filteredStaff = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return staff;
    return staff.filter(s => (s.name || '').toLowerCase().includes(q) || (s.designation || '').toLowerCase().includes(q));
  }, [staff, search]);

  const loadUserPermissions = async (userId) => {
    setDetailLoading(true);
    setError('');
    try {
      const res = await api.get(`/rbac/users/${userId}/permissions`);
      setEffective(new Set(res.data.effective_permissions || []));
      const ovMap = {};
      for (const o of (res.data.overrides || [])) ovMap[o.permission_key] = o.is_enabled;
      setOverrides(ovMap);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load this user\'s permissions');
      setEffective(new Set());
      setOverrides({});
    } finally {
      setDetailLoading(false);
    }
  };

  const selectStaff = (userId) => {
    setSelectedId(userId);
    loadUserPermissions(userId);
  };

  const toggle = async (permKey, currentlyEnabled) => {
    if (!canManage || !selectedId) return;
    setSavingKey(permKey);
    try {
      await api.post(`/rbac/users/${selectedId}/permissions`, {
        permission_key: permKey,
        is_enabled: !currentlyEnabled,
      });
      await loadUserPermissions(selectedId);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update permission');
    } finally {
      setSavingKey(null);
    }
  };

  const resetToDefault = async (permKey) => {
    if (!canManage || !selectedId) return;
    setSavingKey(permKey);
    try {
      await api.delete(`/rbac/users/${selectedId}/permissions/${permKey}`);
      await loadUserPermissions(selectedId);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to reset permission');
    } finally {
      setSavingKey(null);
    }
  };

  const selectedStaff = staff.find(s => s.user_id === selectedId);

  return (
    <div className={`app-shell${darkMode ? ' theme-dark' : ''}`}>
      <Sidebar darkMode={darkMode} />
      <div className="main-content">
        <Navbar title="Staff Permissions" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />
        <div className="page-body">
          <div className="page-header">
            <div>
              <h2 className="page-title">Staff Permissions</h2>
              <p className="page-subtitle">
                Grant or revoke an individual permission for one specific teacher/staff member,
                on top of their role's defaults.
              </p>
            </div>
          </div>

          {error && (
            <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
            {/* ── Staff picker ── */}
            <div className="card" style={{ width: 280, flexShrink: 0, background: darkMode ? '#141b2d' : undefined }}>
              <div className="card-header">
                <input
                  type="text"
                  placeholder="Search staff..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{
                    width: '100%', padding: '8px 10px', borderRadius: 6,
                    border: '1px solid var(--neutral-2)', fontSize: 13,
                    background: darkMode ? '#0f172a' : 'white',
                    color: darkMode ? '#e2e8f0' : '#0f172a',
                  }}
                />
              </div>
              <div className="card-body" style={{ padding: 0, maxHeight: 520, overflowY: 'auto' }}>
                {staffLoading ? (
                  <div style={{ padding: 16, fontSize: 13, color: '#64748b' }}>Loading...</div>
                ) : filteredStaff.length === 0 ? (
                  <div style={{ padding: 16, fontSize: 13, color: '#64748b' }}>No staff found</div>
                ) : (
                  filteredStaff.map(s => (
                    <div
                      key={s.user_id}
                      onClick={() => selectStaff(s.user_id)}
                      style={{
                        padding: '10px 16px', cursor: 'pointer',
                        background: selectedId === s.user_id ? (darkMode ? 'rgba(79,70,229,0.15)' : '#eef2ff') : 'transparent',
                        borderLeft: selectedId === s.user_id ? '3px solid #4f46e5' : '3px solid transparent',
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{s.name}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{s.designation}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* ── Permission grid for selected staff ── */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {!selectedId ? (
                <div className="card" style={{ padding: 40, textAlign: 'center', color: '#64748b', background: darkMode ? '#141b2d' : undefined }}>
                  Select a staff member from the list to view and edit their permissions.
                </div>
              ) : detailLoading ? (
                <div className="card" style={{ padding: 40, textAlign: 'center', color: '#64748b', background: darkMode ? '#141b2d' : undefined }}>
                  Loading permissions...
                </div>
              ) : (
                <>
                  <h4 style={{ margin: '0 0 12px' }}>{selectedStaff?.name}</h4>
                  {Object.entries(catalogByModule).map(([moduleName, perms]) => (
                    <div key={moduleName} className="card" style={{ marginBottom: 14, background: darkMode ? '#141b2d' : undefined }}>
                      <div className="card-header" style={{ textTransform: 'capitalize' }}>
                        <h5 style={{ margin: 0 }}>{moduleName}</h5>
                      </div>
                      <div className="card-body" style={{ padding: 0 }}>
                        {perms.map(p => {
                          const isOn = effective.has(p.key);
                          const hasOverride = p.key in overrides;
                          const busy = savingKey === p.key;
                          return (
                            <div key={p.id} style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              padding: '10px 16px', borderBottom: '1px solid var(--neutral-1)',
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 13 }}>{p.label || p.key}</span>
                                {hasOverride && (
                                  <span style={{
                                    fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4,
                                    background: darkMode ? 'rgba(245,158,11,0.15)' : '#fef3c7',
                                    color: '#b45309',
                                  }}>
                                    Custom
                                  </span>
                                )}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                {hasOverride && (
                                  <button
                                    className="btn btn-neutral btn-sm"
                                    disabled={!canManage || busy}
                                    onClick={() => resetToDefault(p.key)}
                                    title="Remove override, revert to role default"
                                  >
                                    Reset
                                  </button>
                                )}
                                <button
                                  onClick={() => toggle(p.key, isOn)}
                                  disabled={!canManage || busy}
                                  style={{
                                    width: 40, height: 22, borderRadius: 11, border: 'none',
                                    background: isOn ? '#16a34a' : (darkMode ? '#1e293b' : '#e2e8f0'),
                                    position: 'relative', cursor: canManage ? 'pointer' : 'default',
                                    opacity: busy ? 0.5 : 1, transition: 'background 0.15s',
                                  }}
                                  title={isOn ? 'Enabled — click to revoke' : 'Disabled — click to grant'}
                                >
                                  <span style={{
                                    position: 'absolute', top: 2, left: isOn ? 20 : 2,
                                    width: 18, height: 18, borderRadius: '50%', background: 'white',
                                    transition: 'left 0.15s', boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
                                  }} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    "Custom" = this permission was individually granted/revoked for this person and no
                    longer follows their role's default. Click Reset to go back to whatever their role
                    normally gets.
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
