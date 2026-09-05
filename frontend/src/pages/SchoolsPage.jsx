import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Navbar  from '../components/Navbar';
import api     from '../api/axios';

export default function SchoolsPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('active'); // 'active' | 'archived'

  const [activeSchools,   setActiveSchools]   = useState([]);
  const [archivedSchools, setArchivedSchools] = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [msg,             setMsg]             = useState('');
  const [search,          setSearch]          = useState('');

  // Edit Modal
  const [showEdit,   setShowEdit]   = useState(false);
  const [editSchool, setEditSchool] = useState(null);
  const [form,       setForm]       = useState({});
  const [saving,     setSaving]     = useState(false);

  // Archive Modal
  const [showArchive,    setShowArchive]    = useState(false);
  const [targetSchool,   setTargetSchool]   = useState(null);
  const [archiveReason,  setArchiveReason]  = useState('');
  const [archiveConfirm, setArchiveConfirm] = useState('');
  const [archiveSummary, setArchiveSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [actionLoading,  setActionLoading]  = useState(false);

  // Recover Modal
  const [showRecover, setShowRecover] = useState(false);

  // Permanent Delete Modal
  const [showPermanent,    setShowPermanent]    = useState(false);
  const [permConfirmInput, setPermConfirmInput] = useState('');
  const [permForce,        setPermForce]        = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [resActive, resArchived] = await Promise.all([
        api.get('/admin/schools', { params: { status: 'ACTIVE' } }),
        api.get('/admin/schools/archived')
      ]);
      setActiveSchools(resActive.data || []);
      setArchivedSchools(resArchived.data || []);
    } catch (err) {
      setMsg('❌ Failed to load schools.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const toggleSchool = async (id) => {
    try {
      await api.put(`/admin/schools/${id}/toggle`);
      setMsg('✅ School status updated.');
      loadData();
    } catch {
      setMsg('❌ Failed to toggle school status.');
    }
  };

  const openEdit = (s) => {
    setEditSchool(s);
    setForm({ ...s });
    setShowEdit(true);
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    try {
      await api.put(`/admin/schools/${editSchool.id}`, form);
      setMsg('✅ School updated successfully!');
      setShowEdit(false);
      loadData();
    } catch {
      setMsg('❌ Error saving school changes.');
    } finally {
      setSaving(false);
    }
  };

  // Open Archive Dialog
  const openArchiveDialog = async (s) => {
    setTargetSchool(s);
    setArchiveReason('');
    setArchiveConfirm('');
    setArchiveSummary(null);
    setShowArchive(true);
    setLoadingSummary(true);
    try {
      const res = await api.get(`/admin/schools/${s.id}/archive-summary`);
      setArchiveSummary(res.data);
    } catch {
      // Non-fatal, summary preview simply unavailable
    } finally {
      setLoadingSummary(false);
    }
  };

  // Execute Archive
  const handleArchive = async (e) => {
    e.preventDefault();
    if (!targetSchool) return;
    if (archiveConfirm.trim() !== targetSchool.name.trim()) {
      setMsg(`❌ Please type "${targetSchool.name}" exactly to confirm archiving.`);
      return;
    }
    setActionLoading(true);
    try {
      await api.post(`/admin/schools/${targetSchool.id}/archive`, { reason: archiveReason });
      setMsg(`✅ School "${targetSchool.name}" successfully archived.`);
      setShowArchive(false);
      setTab('archived');
      loadData();
    } catch (err) {
      setMsg(`❌ ${err.response?.data?.error || 'Failed to archive school.'}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Open Recover Dialog
  const openRecoverDialog = (s) => {
    setTargetSchool(s);
    setShowRecover(true);
  };

  // Execute Recover
  const handleRecover = async () => {
    if (!targetSchool) return;
    setActionLoading(true);
    try {
      await api.post(`/admin/schools/${targetSchool.id}/recover`);
      setMsg(`✅ School "${targetSchool.name}" successfully recovered to ACTIVE.`);
      setShowRecover(false);
      setTab('active');
      loadData();
    } catch (err) {
      setMsg(`❌ ${err.response?.data?.error || 'Failed to recover school.'}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Open Permanent Delete Dialog
  const openPermanentDialog = async (s) => {
    setTargetSchool(s);
    setPermConfirmInput('');
    setPermForce(s.is_permanent_delete_eligible ? false : true);
    setArchiveSummary(null);
    setShowPermanent(true);
    setLoadingSummary(true);
    try {
      const res = await api.get(`/admin/schools/${s.id}/archive-summary`);
      setArchiveSummary(res.data);
    } catch {
    } finally {
      setLoadingSummary(false);
    }
  };

  // Execute Permanent Delete
  const handlePermanentDelete = async (e) => {
    e.preventDefault();
    if (!targetSchool) return;
    const requiredPhrase = `DELETE ${targetSchool.name}`;
    if (permConfirmInput.trim() !== requiredPhrase) {
      setMsg(`❌ You must type "${requiredPhrase}" exactly to confirm permanent deletion.`);
      return;
    }
    setActionLoading(true);
    try {
      await api.delete(`/admin/schools/${targetSchool.id}/permanent`, {
        data: {
          confirm_name: permConfirmInput.trim(),
          force: permForce,
        }
      });
      setMsg(`✅ School "${targetSchool.name}" permanently deleted.`);
      setShowPermanent(false);
      loadData();
    } catch (err) {
      setMsg(`❌ ${err.response?.data?.error || 'Failed to permanently delete school.'}`);
    } finally {
      setActionLoading(false);
    }
  };

  const fmt = (n) => Number(n || 0).toLocaleString('en-IN');

  const filteredActive = useMemo(() => {
    if (!search.trim()) return activeSchools;
    const q = search.toLowerCase();
    return activeSchools.filter(s =>
      s.name?.toLowerCase().includes(q) ||
      s.code?.toLowerCase().includes(q) ||
      s.city?.toLowerCase().includes(q)
    );
  }, [activeSchools, search]);

  const filteredArchived = useMemo(() => {
    if (!search.trim()) return archivedSchools;
    const q = search.toLowerCase();
    return archivedSchools.filter(s =>
      s.name?.toLowerCase().includes(q) ||
      s.code?.toLowerCase().includes(q) ||
      s.city?.toLowerCase().includes(q) ||
      s.archive_reason?.toLowerCase().includes(q)
    );
  }, [archivedSchools, search]);

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar title="Schools Lifecycle & Management" />
        <div className="page-body">

          {/* Header */}
          <div className="page-header flex justify-between items-center" style={{ marginBottom: 20 }}>
            <div>
              <h2 className="page-title" style={{ fontSize: 22, fontWeight: 700 }}>School Management</h2>
              <p className="page-subtitle" style={{ color: '#64748b', fontSize: 13 }}>
                Monitor active institutions, handle lifecycle archiving, and manage retention recovery.
              </p>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/dashboard')}>
              + Add New School
            </button>
          </div>

          {msg && (
            <div className={`alert ${msg.startsWith('✅') ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: 16 }}>
              {msg}
            </div>
          )}

          {/* Stats Cards */}
          <div className="grid-4 mb-6" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
            {[
              { icon: '🏫', label: 'Total Registered',  value: activeSchools.length + archivedSchools.length, color: '#0176d3' },
              { icon: '🟢', label: 'Active Schools',   value: activeSchools.length,                          color: '#059669' },
              { icon: '📦', label: 'Archived (In Retention)', value: archivedSchools.length,                 color: '#d97706' },
              { icon: '💳', label: 'Service Paid',     value: activeSchools.filter(s => s.paid_this_month).length, color: '#7c3aed' },
            ].map(s => (
              <div className="stat-card" key={s.label} style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="stat-icon" style={{ background: s.color + '18', width: 44, height: 44, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 22 }}>{s.icon}</span>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>{s.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Sub-tabs & Search */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid #e2e8f0', paddingBottom: 12 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setTab('active')}
                style={{
                  padding: '8px 18px',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: 'none',
                  background: tab === 'active' ? '#0176d3' : '#f1f5f9',
                  color: tab === 'active' ? '#fff' : '#475569',
                  transition: 'all 0.15s ease'
                }}
              >
                Active Schools ({activeSchools.length})
              </button>
              <button
                onClick={() => setTab('archived')}
                style={{
                  padding: '8px 18px',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: 'none',
                  background: tab === 'archived' ? '#d97706' : '#f1f5f9',
                  color: tab === 'archived' ? '#fff' : '#475569',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.15s ease'
                }}
              >
                <span>📦 Archived Schools ({archivedSchools.length})</span>
                {archivedSchools.length > 0 && (
                  <span style={{ background: '#fff', color: '#d97706', padding: '1px 6px', borderRadius: 10, fontSize: 11, fontWeight: 700 }}>
                    {archivedSchools.length}
                  </span>
                )}
              </button>
            </div>

            <div style={{ position: 'relative', width: 280 }}>
              <input
                type="text"
                className="form-input"
                placeholder="Search by code, name, city..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ fontSize: 13, padding: '7px 12px' }}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  style={{ position: 'absolute', right: 8, top: 7, background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 14 }}
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* TAB 1: ACTIVE SCHOOLS TABLE */}
          {tab === 'active' && (
            <div className="card" style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
              <div className="card-header" style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Active Schools ({filteredActive.length})</h4>
                <span style={{ fontSize: 12, color: '#64748b' }}>Operational institutions with active student & staff access</span>
              </div>
              <div className="table-container">
                {loading ? (
                  <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Loading active schools...</div>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Code</th>
                        <th>Name</th>
                        <th>Type</th>
                        <th>City</th>
                        <th>Session</th>
                        <th>Students</th>
                        <th>Service</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredActive.map(s => (
                        <tr key={s.id}>
                          <td>
                            <span className="badge badge-info">{s.code}</span>
                          </td>
                          <td>
                            <span
                              onClick={() => navigate(`/schools/${s.id}`)}
                              style={{
                                fontWeight: 600,
                                color: '#0176d3',
                                cursor: 'pointer',
                                borderBottom: '1px dashed #93c5fd',
                              }}
                            >
                              {s.name}
                            </span>
                          </td>
                          <td><span className="badge badge-neutral">{s.type || 'School'}</span></td>
                          <td style={{ color: '#64748b' }}>{s.city || '—'}</td>
                          <td>{s.current_session || '2025-2026'}</td>
                          <td>
                            <span style={{ background: '#dbeafe', color: '#1d4ed8', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                              {fmt(s.total_students)}
                            </span>
                          </td>
                          <td>
                            <span style={{
                              fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                              background: s.paid_this_month ? '#dcfce7' : '#fee2e2',
                              color: s.paid_this_month ? '#16a34a' : '#dc2626',
                            }}>
                              {s.paid_this_month ? '✅ Paid' : '⏳ Due'}
                            </span>
                          </td>
                          <td>
                            <span className={`badge ${s.is_active ? 'badge-success' : 'badge-error'}`}>
                              {s.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                              <button className="btn btn-neutral btn-sm" onClick={() => navigate(`/schools/${s.id}`)}>
                                View
                              </button>
                              <button className="btn btn-neutral btn-sm" onClick={() => openEdit(s)}>
                                Edit
                              </button>
                              <button
                                className="btn btn-sm"
                                onClick={() => toggleSchool(s.id)}
                                style={{
                                  background: s.is_active ? '#fef1ee' : '#eaf5ea',
                                  color: s.is_active ? 'var(--error)' : 'var(--success)',
                                  border: 'none', cursor: 'pointer', borderRadius: 4,
                                  padding: '4px 8px', fontSize: 11, fontWeight: 700,
                                }}
                              >
                                {s.is_active ? 'Deactivate' : 'Activate'}
                              </button>
                              <button
                                className="btn btn-sm"
                                onClick={() => openArchiveDialog(s)}
                                style={{
                                  background: '#fffbeb',
                                  color: '#b45309',
                                  border: '1px solid #fde68a',
                                  cursor: 'pointer',
                                  borderRadius: 4,
                                  padding: '4px 10px',
                                  fontSize: 11,
                                  fontWeight: 700,
                                }}
                                title="Archive school (soft delete with 1-year retention)"
                              >
                                📦 Archive
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {!filteredActive.length && (
                        <tr>
                          <td colSpan={9} style={{ textAlign: 'center', color: '#94a3b8', padding: 40 }}>
                            {search ? 'No matching active schools found.' : 'No active schools registered yet.'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: ARCHIVED SCHOOLS TABLE */}
          {tab === 'archived' && (
            <div className="card" style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
              <div className="card-header" style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#92400e' }}>
                    📦 Archived Schools ({filteredArchived.length})
                  </h4>
                  <p style={{ margin: '3px 0 0', fontSize: 12, color: '#64748b' }}>
                    Archived schools are retained for 1 year. All financial, academic, and student records are preserved.
                  </p>
                </div>
              </div>
              <div className="table-container">
                {loading ? (
                  <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Loading archived schools...</div>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Code</th>
                        <th>School Name</th>
                        <th>Archived Date</th>
                        <th>Reason</th>
                        <th>Archived By</th>
                        <th>Retention Period</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredArchived.map(s => {
                        const daysLeft = s.days_remaining_to_permanent_delete;
                        const isEligible = s.is_permanent_delete_eligible || daysLeft <= 0;
                        return (
                          <tr key={s.id} style={{ background: '#fffdfa' }}>
                            <td>
                              <span className="badge" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>
                                {s.code}
                              </span>
                            </td>
                            <td>
                              <span
                                onClick={() => navigate(`/schools/${s.id}`)}
                                style={{ fontWeight: 600, color: '#1e293b', cursor: 'pointer' }}
                              >
                                {s.name}
                              </span>
                              <div style={{ fontSize: 11, color: '#64748b' }}>{s.city || '—'}</div>
                            </td>
                            <td style={{ fontSize: 12, color: '#475569' }}>
                              {s.archived_at ? new Date(s.archived_at).toLocaleDateString() : '—'}
                            </td>
                            <td style={{ fontSize: 12, maxWidth: 220, color: '#64748b' }}>
                              {s.archive_reason || <span style={{ fontStyle: 'italic' }}>No reason specified</span>}
                            </td>
                            <td style={{ fontSize: 12, color: '#475569' }}>
                              {s.archived_by_name || (s.archived_by ? `User #${s.archived_by}` : 'Super Admin')}
                            </td>
                            <td>
                              {isEligible ? (
                                <span className="badge badge-error" style={{ fontSize: 11, fontWeight: 700 }}>
                                  ⚠️ Eligible for Permanent Deletion
                                </span>
                              ) : (
                                <div style={{ fontSize: 12 }}>
                                  <span style={{ fontWeight: 700, color: '#d97706' }}>
                                    {daysLeft} days remaining
                                  </span>
                                  <div style={{ fontSize: 10, color: '#94a3b8' }}>1-Year Retention Window</div>
                                </div>
                              )}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                                <button
                                  className="btn btn-neutral btn-sm"
                                  onClick={() => navigate(`/schools/${s.id}`)}
                                >
                                  Details
                                </button>
                                <button
                                  className="btn btn-sm"
                                  onClick={() => openRecoverDialog(s)}
                                  style={{
                                    background: '#ecfdf5',
                                    color: '#059669',
                                    border: '1px solid #a7f3d0',
                                    cursor: 'pointer',
                                    borderRadius: 4,
                                    padding: '4px 10px',
                                    fontSize: 11,
                                    fontWeight: 700,
                                  }}
                                  title="Restore school and reactivate accounts"
                                >
                                  ♻️ Recover
                                </button>
                                <button
                                  className="btn btn-sm"
                                  onClick={() => openPermanentDialog(s)}
                                  style={{
                                    background: '#fef2f2',
                                    color: '#dc2626',
                                    border: '1px solid #fecaca',
                                    cursor: 'pointer',
                                    borderRadius: 4,
                                    padding: '4px 10px',
                                    fontSize: 11,
                                    fontWeight: 700,
                                  }}
                                  title="Permanently erase this school and all child records"
                                >
                                  🗑️ Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {!filteredArchived.length && (
                        <tr>
                          <td colSpan={7} style={{ textAlign: 'center', color: '#94a3b8', padding: 40 }}>
                            {search ? 'No matching archived schools found.' : 'No archived schools. All schools are currently active.'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ── MODAL 1: EDIT SCHOOL ── */}
      {showEdit && editSchool && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowEdit(false)}>
          <div className="modal" style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <h3>✏️ Edit School — {editSchool.name}</h3>
              <button className="modal-close" onClick={() => setShowEdit(false)}>✕</button>
            </div>
            <form onSubmit={saveEdit}>
              <div className="modal-body">
                <div className="grid-2">
                  {[
                    ['name',            'School Name *', 'text',  true],
                    ['city',            'City',          'text',  false],
                    ['state',           'State',         'text',  false],
                    ['phone',           'Phone',         'text',  false],
                    ['email',           'Email',         'email', false],
                    ['current_session', 'Session',       'text',  false],
                  ].map(([field, label, type, req]) => (
                    <div className="form-group" key={field}>
                      <label className="form-label">{label}</label>
                      <input
                        className="form-input"
                        type={type}
                        required={req}
                        value={form[field] || ''}
                        onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                      />
                    </div>
                  ))}
                </div>
                <div className="form-group">
                  <label className="form-label">Address</label>
                  <input
                    className="form-input"
                    value={form.address || ''}
                    onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-neutral" onClick={() => setShowEdit(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : '💾 Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 2: ARCHIVE SCHOOL (SOFT DELETE) ── */}
      {showArchive && targetSchool && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowArchive(false)}>
          <div className="modal" style={{ maxWidth: 580 }}>
            <div className="modal-header" style={{ borderBottom: '1px solid #fed7aa', background: '#fffbeb' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 24 }}>📦</span>
                <div>
                  <h3 style={{ margin: 0, color: '#92400e' }}>Archive School Account</h3>
                  <div style={{ fontSize: 12, color: '#b45309' }}>1-Year Retention &amp; Recovery Protected</div>
                </div>
              </div>
              <button className="modal-close" onClick={() => setShowArchive(false)}>✕</button>
            </div>

            <form onSubmit={handleArchive}>
              <div className="modal-body" style={{ padding: 20 }}>
                {/* Warning Card */}
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: 14, marginBottom: 16 }}>
                  <div style={{ fontWeight: 700, color: '#92400e', marginBottom: 4, fontSize: 13 }}>
                    ⚠️ What happens when you archive this school?
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#78350f', lineHeight: 1.6 }}>
                    <li>All school logins (Principal, Teachers, Students, Staff) will be immediately suspended.</li>
                    <li>The school will be hidden from operational modules and ERP queries.</li>
                    <li><strong>100% of data is preserved</strong> (academic marks, fees, receipts, attendance).</li>
                    <li>The school can be <strong>restored at any time</strong> within the 1-year retention window.</li>
                  </ul>
                </div>

                {/* Summary of preserved items */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 8 }}>
                    Records to be preserved in archive:
                  </div>
                  {loadingSummary ? (
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>Loading record breakdown...</div>
                  ) : archiveSummary ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                      {Object.entries(archiveSummary.counts || {}).slice(0, 9).map(([k, v]) => (
                        <div key={k} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 10px' }}>
                          <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>{k.replace(/_/g, ' ')}</div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{fmt(v)}</div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                {/* Reason Input */}
                <div className="form-group" style={{ marginBottom: 14 }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>Reason for Archiving (Optional)</label>
                  <input
                    className="form-input"
                    placeholder="e.g. Contract expired, School requested temporary freeze"
                    value={archiveReason}
                    onChange={e => setArchiveReason(e.target.value)}
                  />
                </div>

                {/* Confirmation phrase */}
                <div className="form-group" style={{ marginBottom: 8 }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>
                    Type <span style={{ color: '#b45309', fontWeight: 800 }}>{targetSchool.name}</span> to confirm:
                  </label>
                  <input
                    className="form-input"
                    required
                    placeholder={`Type ${targetSchool.name}`}
                    value={archiveConfirm}
                    onChange={e => setArchiveConfirm(e.target.value)}
                    style={{ borderColor: archiveConfirm === targetSchool.name ? '#16a34a' : '#cbd5e1' }}
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
                <button type="button" className="btn btn-neutral" onClick={() => setShowArchive(false)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn"
                  disabled={actionLoading || archiveConfirm.trim() !== targetSchool.name.trim()}
                  style={{
                    background: '#d97706',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 700,
                    opacity: archiveConfirm.trim() !== targetSchool.name.trim() ? 0.5 : 1
                  }}
                >
                  {actionLoading ? 'Archiving...' : '📦 Confirm & Archive School'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 3: RECOVER SCHOOL ── */}
      {showRecover && targetSchool && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowRecover(false)}>
          <div className="modal" style={{ maxWidth: 520 }}>
            <div className="modal-header" style={{ background: '#ecfdf5', borderBottom: '1px solid #a7f3d0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 24 }}>♻️</span>
                <div>
                  <h3 style={{ margin: 0, color: '#065f46' }}>Recover School</h3>
                  <div style={{ fontSize: 12, color: '#047857' }}>Restore to Active ERP Operations</div>
                </div>
              </div>
              <button className="modal-close" onClick={() => setShowRecover(false)}>✕</button>
            </div>

            <div className="modal-body" style={{ padding: 20 }}>
              <p style={{ fontSize: 14, color: '#334155', lineHeight: 1.6, marginTop: 0 }}>
                Are you sure you want to recover <strong>{targetSchool.name}</strong> ({targetSchool.code})?
              </p>
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 14, fontSize: 12, color: '#166534', lineHeight: 1.5 }}>
                ✅ <strong>Restoration Effects:</strong>
                <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                  <li>School status will be restored to <strong>ACTIVE</strong>.</li>
                  <li>User accounts (Principal, Teachers, Students) will be re-activated.</li>
                  <li>All classes, subjects, fees, and operational rosters will resume normal functions.</li>
                </ul>
              </div>
            </div>

            <div className="modal-footer" style={{ background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
              <button type="button" className="btn btn-neutral" onClick={() => setShowRecover(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-success"
                disabled={actionLoading}
                onClick={handleRecover}
              >
                {actionLoading ? 'Restoring...' : '♻️ Recover & Reactivate School'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 4: PERMANENT DELETE SCHOOL ── */}
      {showPermanent && targetSchool && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowPermanent(false)}>
          <div className="modal" style={{ maxWidth: 580, border: '2px solid #ef4444' }}>
            <div className="modal-header" style={{ background: '#fef2f2', borderBottom: '1px solid #fecaca' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 24 }}>🚨</span>
                <div>
                  <h3 style={{ margin: 0, color: '#991b1b' }}>Permanently Delete School</h3>
                  <div style={{ fontSize: 12, color: '#b91c1c' }}>DANGER: Irreversible Database Wipe</div>
                </div>
              </div>
              <button className="modal-close" onClick={() => setShowPermanent(false)}>✕</button>
            </div>

            <form onSubmit={handlePermanentDelete}>
              <div className="modal-body" style={{ padding: 20 }}>
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 14, marginBottom: 16 }}>
                  <div style={{ fontWeight: 800, color: '#991b1b', marginBottom: 4, fontSize: 13 }}>
                    ⚠️ IRREVERSIBLE ACTION — READ CAREFULLY
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: '#7f1d1d', lineHeight: 1.5 }}>
                    This will permanently and irreversibly wipe <strong>{targetSchool.name}</strong> and all affiliated student records, teacher profiles, examination results, fee bills, receipts, attendance logs, and uploaded files from the database.
                  </p>
                </div>

                {/* Retention notice if deleting early */}
                {!targetSchool.is_permanent_delete_eligible && targetSchool.days_remaining_to_permanent_delete > 0 && (
                  <div style={{ background: '#fffbeb', border: '1px solid #fed7aa', borderRadius: 8, padding: 12, marginBottom: 16 }}>
                    <div style={{ fontSize: 12, color: '#92400e', fontWeight: 600, marginBottom: 6 }}>
                      ⏳ Retention Notice: {targetSchool.days_remaining_to_permanent_delete} days left in 1-year retention window.
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#78350f', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={permForce}
                        onChange={e => setPermForce(e.target.checked)}
                      />
                      <span>Override retention policy &amp; force early permanent deletion</span>
                    </label>
                  </div>
                )}

                {/* Counts to be destroyed */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 8 }}>
                    Items to be permanently erased:
                  </div>
                  {loadingSummary ? (
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>Loading record breakdown...</div>
                  ) : archiveSummary ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                      {Object.entries(archiveSummary.counts || {}).slice(0, 9).map(([k, v]) => (
                        <div key={k} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 10px' }}>
                          <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>{k.replace(/_/g, ' ')}</div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: '#dc2626' }}>{fmt(v)}</div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                {/* Confirmation phrase input */}
                <div className="form-group" style={{ marginBottom: 8 }}>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: 13 }}>
                    To confirm, please type <code style={{ background: '#fee2e2', color: '#991b1b', padding: '2px 6px', borderRadius: 4, fontWeight: 800 }}>DELETE {targetSchool.name}</code>:
                  </label>
                  <input
                    className="form-input"
                    required
                    placeholder={`Type DELETE ${targetSchool.name}`}
                    value={permConfirmInput}
                    onChange={e => setPermConfirmInput(e.target.value)}
                    style={{ borderColor: permConfirmInput === `DELETE ${targetSchool.name}` ? '#dc2626' : '#cbd5e1' }}
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
                <button type="button" className="btn btn-neutral" onClick={() => setShowPermanent(false)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-error"
                  disabled={
                    actionLoading ||
                    permConfirmInput.trim() !== `DELETE ${targetSchool.name}` ||
                    (!targetSchool.is_permanent_delete_eligible && !permForce)
                  }
                  style={{ fontWeight: 800 }}
                >
                  {actionLoading ? 'Deleting...' : '🚨 Permanently Delete School'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
