// frontend/src/pages/rbac/RoleManagement.jsx
import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { usePermission } from '../../hooks/usePermission';

export default function RoleManagement({ darkMode }) {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [formData, setFormData] = useState({
    key: '',
    name: '',
    scope: 'TENANT',
    hierarchy_level: 10,
    is_super: false,
    is_protected: false,
  });
  const [expandedRoles, setExpandedRoles] = useState([]);

  const canManage = usePermission('admin.user.manage');

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      const res = await api.get('/rbac/roles');
      setRoles(res.data || []);
    } catch (err) {
      console.error('Failed to fetch roles:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingRole) {
        await api.put(`/rbac/roles/${editingRole.id}`, formData);
      } else {
        await api.post('/rbac/roles', formData);
      }
      setShowModal(false);
      resetForm();
      fetchRoles();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save role');
    }
  };

  const handleDelete = async (roleId) => {
    if (!window.confirm('Delete this role? This cannot be undone.')) return;
    try {
      await api.delete(`/rbac/roles/${roleId}`);
      fetchRoles();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete role');
    }
  };

  const resetForm = () => {
    setEditingRole(null);
    setFormData({
      key: '',
      name: '',
      scope: 'TENANT',
      hierarchy_level: 10,
      is_super: false,
      is_protected: false,
    });
  };

  const toggleExpand = (roleId) => {
    setExpandedRoles(prev =>
      prev.includes(roleId) ? prev.filter(id => id !== roleId) : [...prev, roleId]
    );
  };

  const getScopeLabel = (scope) => {
    return scope === 'COMPANY' ? '🏢 Company' : '🏫 School';
  };

  const getHierarchyLabel = (level) => {
    const labels = {
      0: 'CEO / Director (Top)',
      1: 'Executive',
      2: 'Senior Management',
      3: 'Management',
      4: 'Supervisor',
      5: 'Senior Staff',
      6: 'Staff',
      7: 'Junior Staff',
      8: 'Support',
      9: 'Entry Level',
      10: 'Intern / Student',
    };
    return labels[level] || `Level ${level}`;
  };

  if (loading) return <div className="loading-spinner">Loading roles...</div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2 className="page-title">Role Management</h2>
          <p className="page-subtitle">Manage roles and hierarchy across the platform</p>
        </div>
        {canManage && (
          <button
            className="btn btn-primary"
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
          >
            <i className="ti ti-plus" /> New Role
          </button>
        )}
      </div>

      {/* Hierarchy Tree View */}
      <div className="card" style={{ marginBottom: 24, background: darkMode ? '#141b2d' : undefined }}>
        <div className="card-header">
          <h4 style={{ margin: 0 }}>Role Hierarchy</h4>
          <span style={{ fontSize: 12, color: '#64748b' }}>Lower number = higher authority</span>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {roles
            .sort((a, b) => a.hierarchy_level - b.hierarchy_level)
            .map((role, index) => (
              <div
                key={role.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '12px 20px',
                  borderBottom: index < roles.length - 1 ? '1px solid var(--neutral-2)' : 'none',
                  background: darkMode ? '#0f172a' : undefined,
                  cursor: 'pointer',
                }}
                onClick={() => toggleExpand(role.id)}
              >
                <div style={{ 
                  width: 32, 
                  height: 32, 
                  borderRadius: '50%', 
                  background: role.is_super ? '#4f46e5' : role.is_protected ? '#dc2626' : '#64748b',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 700,
                  marginRight: 12,
                  flexShrink: 0,
                }}>
                  {role.is_super ? '★' : role.is_protected ? '🔒' : role.hierarchy_level}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: darkMode ? '#f1f5f9' : '#0f172a' }}>
                    {role.name}
                    <span style={{ fontSize: 11, color: '#64748b', marginLeft: 8 }}>
                      ({role.key})
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>
                    {getScopeLabel(role.scope)} · {getHierarchyLabel(role.hierarchy_level)}
                    {role.is_super && ' · ⭐ Super (full access)'}
                    {role.is_protected && ' · 🔒 Protected (cannot delete)'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {canManage && !role.is_protected && (
                    <>
                      <button
                        className="btn btn-neutral btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingRole(role);
                          setFormData(role);
                          setShowModal(true);
                        }}
                      >
                        <i className="ti ti-edit" />
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(role.id);
                        }}
                      >
                        <i className="ti ti-trash" />
                      </button>
                    </>
                  )}
                  {role.is_protected && (
                    <span style={{ fontSize: 11, color: '#dc2626', padding: '4px 12px', background: darkMode ? 'rgba(220,38,38,0.15)' : '#fee2e2', borderRadius: 20 }}>
                      Protected
                    </span>
                  )}
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Role Form Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => { setShowModal(false); resetForm(); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500, background: darkMode ? '#141b2d' : undefined }}>
            <div className="modal-header">
              <h3>{editingRole ? 'Edit Role' : 'Create New Role'}</h3>
              <button className="btn-close" onClick={() => { setShowModal(false); resetForm(); }}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Role Key (unique identifier)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.key}
                    onChange={(e) => setFormData({ ...formData, key: e.target.value.toUpperCase().replace(/\s/g, '_') })}
                    required
                    disabled={!!editingRole}
                    placeholder="e.g., ACCOUNTANT"
                  />
                </div>
                <div className="form-group">
                  <label>Display Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    placeholder="e.g., Accountant"
                  />
                </div>
                <div className="form-group">
                  <label>Scope</label>
                  <select
                    className="form-select"
                    value={formData.scope}
                    onChange={(e) => setFormData({ ...formData, scope: e.target.value })}
                  >
                    <option value="TENANT">School / Tenant</option>
                    <option value="COMPANY">Company (Platform)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Hierarchy Level (0 = highest authority)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={formData.hierarchy_level}
                    onChange={(e) => setFormData({ ...formData, hierarchy_level: parseInt(e.target.value) || 10 })}
                    min="0"
                    max="99"
                  />
                  <small style={{ color: '#64748b' }}>{getHierarchyLabel(formData.hierarchy_level)}</small>
                </div>
                <div className="form-group" style={{ display: 'flex', gap: 20, marginTop: 8 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={formData.is_super}
                      onChange={(e) => setFormData({ ...formData, is_super: e.target.checked })}
                    />
                    Super Role (full access)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={formData.is_protected}
                      onChange={(e) => setFormData({ ...formData, is_protected: e.target.checked })}
                    />
                    Protected (cannot delete)
                  </label>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-neutral" onClick={() => { setShowModal(false); resetForm(); }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingRole ? 'Update' : 'Create'} Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
