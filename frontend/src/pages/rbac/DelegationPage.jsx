// frontend/src/pages/rbac/DelegationPage.jsx
import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api from '../../api/axios';
import { usePermission } from '../../hooks/usePermission';
import { useAuth } from '../../context/AuthContext';

export default function DelegationPage() {
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('ederp_theme') === 'dark');
  useEffect(() => { localStorage.setItem('ederp_theme', darkMode ? 'dark' : 'light'); }, [darkMode]);

  const { user } = useAuth();

  const [delegations, setDelegations] = useState([]);
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    delegatee_user_id: '',
    role_key: '',
    end_date: '',
    reason: '',
  });
  const [filter, setFilter] = useState('ACTIVE');

  const canDelegate = usePermission('admin.user.manage');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // SUPER_ADMIN is company-scoped -> /admin/users (all schools).
      // Everyone else delegating is school-scoped -> /principal/users
      // (own school only; PRINCIPAL/DIRECTOR/VICE_PRINCIPAL all resolve
      // here via the backend's ROLE_EQUIVALENCE expansion). Both endpoints
      // return the same { users, total, page, ... } shape, not a bare array.
      const usersEndpoint = user?.role === 'SUPER_ADMIN' ? '/admin/users' : '/principal/users';

      const [delRes, usersRes, rolesRes] = await Promise.all([
        api.get('/rbac/delegations', { params: { status: filter } }),
        api.get(usersEndpoint, { params: { per_page: 200 } }),
        api.get('/rbac/roles'),
      ]);
      setDelegations(delRes.data?.delegations || []);
      setUsers(usersRes.data?.users || []);
      setRoles(rolesRes.data || []);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/rbac/delegations', {
        delegatee_user_id: parseInt(formData.delegatee_user_id),
        role_key: formData.role_key,
        end_date: new Date(formData.end_date).toISOString(),
        reason: formData.reason || undefined,
      });
      setShowForm(false);
      resetForm();
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create delegation');
    }
  };

  const handleRevoke = async (delegationId) => {
    if (!window.confirm('Revoke this delegation?')) return;
    try {
      await api.delete(`/rbac/delegations/${delegationId}`);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to revoke delegation');
    }
  };

  const handleExtend = async (delegationId, newEndDate) => {
    try {
      await api.put(`/rbac/delegations/${delegationId}/extend`, {
        new_end_date: new Date(newEndDate).toISOString(),
      });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to extend delegation');
    }
  };

  const resetForm = () => {
    setFormData({
      delegatee_user_id: '',
      role_key: '',
      end_date: '',
      reason: '',
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      ACTIVE: '#16a34a',
      EXPIRED: '#dc2626',
      REVOKED: '#64748b',
    };
    return colors[status] || '#64748b';
  };

  if (loading) {
    return (
      <div className={`app-shell${darkMode ? ' theme-dark' : ''}`}>
        <Sidebar darkMode={darkMode} />
        <div className="main-content">
          <Navbar title="Role Delegation" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />
          <div className="page-body">
            <div className="loading-spinner">Loading delegations...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`app-shell${darkMode ? ' theme-dark' : ''}`}>
      <Sidebar darkMode={darkMode} />
      <div className="main-content">
        <Navbar title="Role Delegation" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />
        <div className="page-body">
      <div className="page-header">
        <div>
          <h2 className="page-title">Temporary Role Delegation</h2>
          <p className="page-subtitle">Grant temporary access to roles — auto-expires</p>
        </div>
        {canDelegate && (
          <button
            className="btn btn-primary"
            onClick={() => setShowForm(true)}
          >
            <i className="ti ti-user-plus" /> Delegate Role
          </button>
        )}
      </div>

      {/* Filter */}
      <div style={{ marginBottom: 20, display: 'flex', gap: 12, alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#64748b' }}>Filter:</span>
        {['ACTIVE', 'EXPIRED', 'REVOKED'].map(s => (
          <button
            key={s}
            className={`btn ${filter === s ? 'btn-primary' : 'btn-neutral'}`}
            size="sm"
            onClick={() => {
              setFilter(s);
              fetchData();
            }}
          >
            {s}
          </button>
        ))}
        <button
          className="btn btn-neutral btn-sm"
          onClick={() => {
            setFilter('');
            fetchData();
          }}
        >
          All
        </button>
      </div>

      {/* Delegations List */}
      <div className="card" style={{ background: darkMode ? '#141b2d' : undefined }}>
        {delegations.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
            <i className="ti ti-zoom-question" style={{ fontSize: 40, display: 'block', marginBottom: 12 }} />
            No delegations found
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12, padding: 16 }}>
            {delegations.map(d => (
              <div
                key={d.id}
                style={{
                  border: `1px solid ${darkMode ? '#1e293b' : '#e2e8f0'}`,
                  borderRadius: 10,
                  padding: '16px 20px',
                  background: darkMode ? '#0f172a' : 'white',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 10,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, color: darkMode ? '#f1f5f9' : '#0f172a' }}>
                      {d.role_name || d.role_key}
                    </span>
                    <span style={{
                      padding: '2px 10px',
                      borderRadius: 20,
                      fontSize: 11,
                      fontWeight: 700,
                      background: darkMode ? 'rgba(22,163,74,0.15)' : '#dcfce7',
                      color: getStatusColor(d.status),
                    }}>
                      {d.status}
                    </span>
                    {d.reason && (
                      <span style={{ fontSize: 11, color: '#64748b' }}>· {d.reason}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                    <i className="ti ti-user" /> Delegatee: {d.delegatee_user_id} 
                    {d.delegatee_name && ` (${d.delegatee_name})`}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 2 }}>
                    <span><i className="ti ti-calendar-start" /> Starts: {new Date(d.start_date).toLocaleDateString()}</span>
                    <span><i className="ti ti-calendar-end" /> Expires: {new Date(d.end_date).toLocaleDateString()}</span>
                    {d.created_at && <span>Created: {new Date(d.created_at).toLocaleDateString()}</span>}
                  </div>
                </div>

                {d.status === 'ACTIVE' && canDelegate && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      className="btn btn-neutral btn-sm"
                      onClick={() => {
                        const newDate = prompt('New end date (YYYY-MM-DD):', new Date(d.end_date).toISOString().split('T')[0]);
                        if (newDate) handleExtend(d.id, newDate);
                      }}
                    >
                      <i className="ti ti-clock" /> Extend
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleRevoke(d.id)}
                    >
                      <i className="ti ti-x" /> Revoke
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Delegation Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => { setShowForm(false); resetForm(); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 450, background: darkMode ? '#141b2d' : undefined }}>
            <div className="modal-header">
              <h3>Delegate Role</h3>
              <button className="btn-close" onClick={() => { setShowForm(false); resetForm(); }}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Delegatee (User)</label>
                  <select
                    className="form-select"
                    value={formData.delegatee_user_id}
                    onChange={(e) => setFormData({ ...formData, delegatee_user_id: e.target.value })}
                    required
                  >
                    <option value="">Select user...</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.email}) — {u.role}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Role to Delegate</label>
                  <select
                    className="form-select"
                    value={formData.role_key}
                    onChange={(e) => setFormData({ ...formData, role_key: e.target.value })}
                    required
                  >
                    <option value="">Select role...</option>
                    {roles
                      .filter(r => !r.is_protected)
                      .map(r => (
                        <option key={r.id} value={r.key}>
                          {r.name} (Level {r.hierarchy_level}){r.is_super ? ' ★' : ''}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>End Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    required
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>

                <div className="form-group">
                  <label>Reason (optional)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    placeholder="Why is this temporary access needed?"
                    maxLength={500}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-neutral" onClick={() => { setShowForm(false); resetForm(); }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  <i className="ti ti-user-plus" /> Delegate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
        </div>
      </div>
    </div>
  );
}
