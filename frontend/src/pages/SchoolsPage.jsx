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

  // SaaS School Onboarding Wizard Modal
  const [showOnboardModal, setShowOnboardModal] = useState(false);
  const [onboardStep,      setOnboardStep]      = useState(1);
  const [onboardSaving,    setOnboardSaving]    = useState(false);
  const [onboardError,     setOnboardError]     = useState('');
  const [onboardResult,    setOnboardResult]    = useState(null);
  const initialOnboardForm = {
    name: '',
    code: '',
    type: 'SCHOOL',
    affiliation_board: 'CBSE',
    established_year: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    phone: '',
    email: '',
    website: '',
    current_session: '2024-25',
    plan: 'BASIC',
    classes: [
      'Nursery', 'LKG', 'UKG',
      'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5',
      'Class 6', 'Class 7', 'Class 8', 'Class 9',
      'Class 10', 'Class 11', 'Class 12'
    ],
    principal_name: '',
    principal_email: '',
    principal_phone: '',
    principal_employee_id: '',
    principal_password: 'School@123',
    principal_status: 'ACTIVE'
  };
  const [onboardForm, setOnboardForm] = useState(initialOnboardForm);

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

  const handleOnboardSubmit = async (e) => {
    if (e) e.preventDefault();
    setOnboardSaving(true);
    setOnboardError('');
    try {
      const res = await api.post('/admin/schools/onboard', onboardForm);
      setOnboardResult(res.data);
      setOnboardStep(7); // Jump to success screen
      loadData();
    } catch (err) {
      setOnboardError(err.response?.data?.error || 'Failed to onboard school. Please check all fields.');
    } finally {
      setOnboardSaving(false);
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
            <button
              className="btn btn-primary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
              onClick={() => {
                setOnboardForm(initialOnboardForm);
                setOnboardStep(1);
                setOnboardError('');
                setOnboardResult(null);
                setShowOnboardModal(true);
              }}
            >
              <span>✨</span>
              <span>+ Onboard New School</span>
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

      {/* ══════════ SAAS SCHOOL ONBOARDING WIZARD MODAL ══════════ */}
      {showOnboardModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && !onboardSaving && setShowOnboardModal(false)}>
          <div className="modal" style={{ maxWidth: 760, width: '92%', borderRadius: 16, overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)' }}>
            
            {/* Modal Header */}
            <div className="modal-header" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', color: '#fff', padding: '18px 24px', borderBottom: '1px solid #334155' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 20 }}>🏫</span>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#f8fafc' }}>
                    {onboardStep === 7 ? 'Onboarding Completed' : 'SaaS School Onboarding Wizard'}
                  </h3>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#94a3b8' }}>
                  {onboardStep === 7
                    ? 'School profile, principal account, and initial configurations are now live.'
                    : 'Configure school details, principal credentials, academic sessions, and SaaS plan in one atomic flow.'}
                </p>
              </div>
              <button
                className="modal-close"
                style={{ color: '#94a3b8', fontSize: 20, background: 'none', border: 'none', cursor: 'pointer' }}
                onClick={() => !onboardSaving && setShowOnboardModal(false)}
              >
                ✕
              </button>
            </div>

            {/* Step Indicators (Steps 1 to 6) */}
            {onboardStep < 7 && (
              <div style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '12px 20px', display: 'flex', gap: 6, overflowX: 'auto' }}>
                {[
                  { id: 1, label: '1. School Info' },
                  { id: 2, label: '2. Academic' },
                  { id: 3, label: '3. Principal' },
                  { id: 4, label: '4. Login Setup' },
                  { id: 5, label: '5. Plan & ERP' },
                  { id: 6, label: '6. Review' },
                ].map(st => {
                  const isActive = onboardStep === st.id;
                  const isDone = onboardStep > st.id;
                  return (
                    <div
                      key={st.id}
                      onClick={() => {
                        if (isDone) setOnboardStep(st.id);
                      }}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: isActive ? 700 : 500,
                        background: isActive ? '#0176d3' : isDone ? '#dcfce7' : '#f1f5f9',
                        color: isActive ? '#fff' : isDone ? '#166534' : '#64748b',
                        whiteSpace: 'nowrap',
                        cursor: isDone ? 'pointer' : 'default',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <span>{isDone ? '✓' : st.id}</span>
                      <span>{st.label.split('. ')[1]}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Error Banner */}
            {onboardError && (
              <div style={{ background: '#fef2f2', borderLeft: '4px solid #ef4444', padding: '12px 20px', color: '#b91c1c', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>⚠️</span>
                <span>{onboardError}</span>
              </div>
            )}

            {/* Modal Body */}
            <div className="modal-body" style={{ maxHeight: '68vh', overflowY: 'auto', padding: '24px' }}>
              
              {/* ── STEP 1: School Basic Information ── */}
              {onboardStep === 1 && (
                <div>
                  <h4 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>
                    Step 1: School Basic Information
                  </h4>
                  <p style={{ fontSize: 12, color: '#64748b', marginBottom: 18 }}>
                    Enter the official institutional identity, affiliation, and contact details.
                  </p>

                  <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 600, fontSize: 12.5 }}>School Name <span style={{ color: '#ef4444' }}>*</span></label>
                      <input
                        className="form-input"
                        placeholder="e.g. Delhi Public School"
                        value={onboardForm.name}
                        onChange={e => setOnboardForm(f => ({ ...f, name: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 600, fontSize: 12.5 }}>School Code <span style={{ color: '#ef4444' }}>*</span></label>
                      <input
                        className="form-input"
                        placeholder="e.g. DPS001 (Unique uppercase)"
                        value={onboardForm.code}
                        onChange={e => setOnboardForm(f => ({ ...f, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') }))}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 600, fontSize: 12.5 }}>Institution Type</label>
                      <select
                        className="form-select"
                        value={onboardForm.type}
                        onChange={e => setOnboardForm(f => ({ ...f, type: e.target.value }))}
                      >
                        <option value="SCHOOL">K-12 School</option>
                        <option value="COLLEGE">Higher Secondary / College</option>
                        <option value="COACHING">Coaching / Academy</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 600, fontSize: 12.5 }}>Affiliation / Board</label>
                      <select
                        className="form-select"
                        value={onboardForm.affiliation_board}
                        onChange={e => setOnboardForm(f => ({ ...f, affiliation_board: e.target.value }))}
                      >
                        <option value="CBSE">CBSE (Central Board)</option>
                        <option value="ICSE">ICSE / ISC</option>
                        <option value="STATE_BOARD">State Board</option>
                        <option value="IB">International Baccalaureate (IB)</option>
                        <option value="CAMBRIDGE">Cambridge (IGCSE)</option>
                        <option value="OTHER">Other / Autonomous</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 600, fontSize: 12.5 }}>Contact Phone <span style={{ color: '#ef4444' }}>*</span></label>
                      <input
                        className="form-input"
                        placeholder="e.g. 9876543210"
                        value={onboardForm.phone}
                        onChange={e => setOnboardForm(f => ({ ...f, phone: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 600, fontSize: 12.5 }}>Official Email <span style={{ color: '#ef4444' }}>*</span></label>
                      <input
                        className="form-input"
                        type="email"
                        placeholder="e.g. info@school.edu"
                        value={onboardForm.email}
                        onChange={e => setOnboardForm(f => ({ ...f, email: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 600, fontSize: 12.5 }}>Website</label>
                      <input
                        className="form-input"
                        placeholder="e.g. https://school.edu"
                        value={onboardForm.website}
                        onChange={e => setOnboardForm(f => ({ ...f, website: e.target.value }))}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 600, fontSize: 12.5 }}>Established Year</label>
                      <input
                        className="form-input"
                        type="number"
                        placeholder="e.g. 2005"
                        value={onboardForm.established_year}
                        onChange={e => setOnboardForm(f => ({ ...f, established_year: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="form-group" style={{ marginTop: 12 }}>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: 12.5 }}>Address</label>
                    <input
                      className="form-input"
                      placeholder="Campus street address..."
                      value={onboardForm.address}
                      onChange={e => setOnboardForm(f => ({ ...f, address: e.target.value }))}
                    />
                  </div>

                  <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginTop: 12 }}>
                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 600, fontSize: 12.5 }}>City</label>
                      <input
                        className="form-input"
                        placeholder="City"
                        value={onboardForm.city}
                        onChange={e => setOnboardForm(f => ({ ...f, city: e.target.value }))}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 600, fontSize: 12.5 }}>State</label>
                      <input
                        className="form-input"
                        placeholder="State"
                        value={onboardForm.state}
                        onChange={e => setOnboardForm(f => ({ ...f, state: e.target.value }))}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 600, fontSize: 12.5 }}>PIN Code</label>
                      <input
                        className="form-input"
                        placeholder="PIN Code"
                        value={onboardForm.pincode}
                        onChange={e => setOnboardForm(f => ({ ...f, pincode: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ── STEP 2: Academic Configuration ── */}
              {onboardStep === 2 && (
                <div>
                  <h4 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>
                    Step 2: Academic Configuration
                  </h4>
                  <p style={{ fontSize: 12, color: '#64748b', marginBottom: 18 }}>
                    Configure the active academic session and classes to be automatically initialized.
                  </p>

                  <div className="form-group" style={{ marginBottom: 16 }}>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: 12.5 }}>Current Academic Session</label>
                    <select
                      className="form-select"
                      value={onboardForm.current_session}
                      onChange={e => setOnboardForm(f => ({ ...f, current_session: e.target.value }))}
                      style={{ maxWidth: 300 }}
                    >
                      <option value="2024-25">2024-25 (Current)</option>
                      <option value="2025-26">2025-26 (Upcoming)</option>
                      <option value="2026-27">2026-27</option>
                    </select>
                  </div>

                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <label className="form-label" style={{ fontWeight: 700, fontSize: 13, margin: 0 }}>
                        Auto-Initialized Academic Classes ({onboardForm.classes.length})
                      </label>
                      <span style={{ fontSize: 11, color: '#059669', fontWeight: 600 }}>Section 'A' will be created for each</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {onboardForm.classes.map((cls, idx) => (
                        <span
                          key={idx}
                          style={{
                            background: '#eff6ff',
                            border: '1px solid #bfdbfe',
                            color: '#1e40af',
                            padding: '4px 10px',
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          {cls}
                        </span>
                      ))}
                    </div>
                    <p style={{ fontSize: 11, color: '#64748b', marginTop: 10, marginBottom: 0 }}>
                      ℹ️ Staff can rename, remove, or add extra sections (B, C, D) anytime from Class Management after onboarding.
                    </p>
                  </div>
                </div>
              )}

              {/* ── STEP 3: Principal Information ── */}
              {onboardStep === 3 && (
                <div>
                  <h4 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>
                    Step 3: School Admin / Principal Information
                  </h4>
                  <p style={{ fontSize: 12, color: '#64748b', marginBottom: 18 }}>
                    Create the initial head administrator account for this school.
                  </p>

                  <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 600, fontSize: 12.5 }}>Principal Full Name <span style={{ color: '#ef4444' }}>*</span></label>
                      <input
                        className="form-input"
                        placeholder="e.g. Dr. Rajesh Sharma"
                        value={onboardForm.principal_name}
                        onChange={e => setOnboardForm(f => ({ ...f, principal_name: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 600, fontSize: 12.5 }}>Employee ID (Optional)</label>
                      <input
                        className="form-input"
                        placeholder={`e.g. EMP-${onboardForm.code || 'SCH'}-001`}
                        value={onboardForm.principal_employee_id}
                        onChange={e => setOnboardForm(f => ({ ...f, principal_employee_id: e.target.value }))}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 600, fontSize: 12.5 }}>Principal Email <span style={{ color: '#ef4444' }}>*</span></label>
                      <input
                        className="form-input"
                        type="email"
                        placeholder="e.g. principal@school.edu"
                        value={onboardForm.principal_email}
                        onChange={e => setOnboardForm(f => ({ ...f, principal_email: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 600, fontSize: 12.5 }}>Principal Mobile Number <span style={{ color: '#ef4444' }}>*</span></label>
                      <input
                        className="form-input"
                        placeholder="e.g. 9876543210 (10 digits)"
                        value={onboardForm.principal_phone}
                        onChange={e => setOnboardForm(f => ({ ...f, principal_phone: e.target.value }))}
                        required
                      />
                    </div>
                  </div>

                  <div style={{ marginTop: 14, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '12px 16px' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#166534', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>🔑</span> Dual Authentication Enabled
                    </div>
                    <p style={{ fontSize: 12, color: '#15803d', margin: '4px 0 0' }}>
                      The Principal will be able to log in using either their registered <strong>Email</strong> ({onboardForm.principal_email || 'principal@school.edu'}) or <strong>10-digit Mobile Number</strong> ({onboardForm.principal_phone || '9876543210'}) into the exact same account.
                    </p>
                  </div>
                </div>
              )}

              {/* ── STEP 4: Principal Login Setup ── */}
              {onboardStep === 4 && (
                <div>
                  <h4 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>
                    Step 4: Principal Login Setup & Status
                  </h4>
                  <p style={{ fontSize: 12, color: '#64748b', marginBottom: 18 }}>
                    Set the initial password and initial account state for the Principal.
                  </p>

                  <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 600, fontSize: 12.5 }}>Initial Password <span style={{ color: '#ef4444' }}>*</span></label>
                      <input
                        className="form-input"
                        type="text"
                        placeholder="Initial account password"
                        value={onboardForm.principal_password}
                        onChange={e => setOnboardForm(f => ({ ...f, principal_password: e.target.value }))}
                        required
                      />
                      <span style={{ fontSize: 11, color: '#64748b' }}>Default: School@123 (Principal can change after login)</span>
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 600, fontSize: 12.5 }}>Initial Account Status</label>
                      <select
                        className="form-select"
                        value={onboardForm.principal_status}
                        onChange={e => setOnboardForm(f => ({ ...f, principal_status: e.target.value }))}
                      >
                        <option value="ACTIVE">ACTIVE (Ready to log in immediately)</option>
                        <option value="INVITED">INVITED (Pending invitation confirmation)</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ marginTop: 16, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14 }}>
                    <div style={{ fontWeight: 600, fontSize: 12.5, color: '#334155', marginBottom: 4 }}>
                      🛡️ Security & Access Policy:
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>
                      <li>Passwords are stored securely using salted bcrypt hashing and are never revealed in plain text.</li>
                      <li>Super Admin can deactivate, suspend, or reset access from School Details at any time.</li>
                      <li>Principals are automatically isolated to their school tenant via JWT context.</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* ── STEP 5: Fee & ERP Configuration ── */}
              {onboardStep === 5 && (
                <div>
                  <h4 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>
                    Step 5: Fee & ERP Subscription Configuration
                  </h4>
                  <p style={{ fontSize: 12, color: '#64748b', marginBottom: 18 }}>
                    Choose the institutional SaaS subscription tier and review auto-configured fee heads.
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
                    {[
                      { id: 'BASIC', title: 'Basic', price: '₹1,799/mo', desc: 'Up to 200 students, attendance, report cards, fees.' },
                      { id: 'PROFESSIONAL', title: 'Professional', price: '₹2,999/mo', desc: 'HRMS, Payroll, Analytics, 3 admin accounts, 24/7 support.' },
                      { id: 'ENTERPRISE', title: 'Enterprise', price: '₹5,999/mo', desc: 'WhatsApp alerts, AI reports, priority support, unlimited staff.' },
                    ].map(plan => {
                      const isSel = onboardForm.plan === plan.id;
                      return (
                        <div
                          key={plan.id}
                          onClick={() => setOnboardForm(f => ({ ...f, plan: plan.id }))}
                          style={{
                            border: isSel ? '2px solid #0176d3' : '1px solid #e2e8f0',
                            background: isSel ? '#eff6ff' : '#fff',
                            borderRadius: 10,
                            padding: '14px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 800, fontSize: 13, color: isSel ? '#0176d3' : '#1e293b' }}>{plan.title}</span>
                            {isSel && <span style={{ color: '#0176d3', fontSize: 14 }}>✓</span>}
                          </div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: '4px 0' }}>{plan.price}</div>
                          <p style={{ fontSize: 11, color: '#64748b', margin: 0, lineHeight: 1.4 }}>{plan.desc}</p>
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14 }}>
                    <div style={{ fontWeight: 700, fontSize: 12.5, color: '#334155', marginBottom: 8 }}>
                      💳 Default Standard Fee Heads (Auto-Configured):
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                      <div style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: 6, padding: '8px 10px' }}>
                        <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Admission Fee</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>₹5,000 (One-Time)</div>
                      </div>
                      <div style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: 6, padding: '8px 10px' }}>
                        <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Tuition Fee</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>₹2,500 (Monthly)</div>
                      </div>
                      <div style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: 6, padding: '8px 10px' }}>
                        <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Examination Fee</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>₹1,000 (Yearly)</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── STEP 6: Review Screen ── */}
              {onboardStep === 6 && (
                <div>
                  <h4 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>
                    Step 6: Review & Final Confirmation
                  </h4>
                  <p style={{ fontSize: 12, color: '#64748b', marginBottom: 18 }}>
                    Please verify all information before executing the atomic onboarding transaction.
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    {/* School Summary Card */}
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>🏫 School Profile</span>
                        <button type="button" onClick={() => setOnboardStep(1)} style={{ background: 'none', border: 'none', color: '#0176d3', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>Edit</button>
                      </div>
                      <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.8 }}>
                        <div><strong>Name:</strong> {onboardForm.name || '—'}</div>
                        <div><strong>Code:</strong> <code style={{ background: '#e2e8f0', padding: '1px 5px', borderRadius: 4 }}>{onboardForm.code || '—'}</code></div>
                        <div><strong>Type / Board:</strong> {onboardForm.type} ({onboardForm.affiliation_board})</div>
                        <div><strong>Contact:</strong> {onboardForm.phone} | {onboardForm.email}</div>
                        <div><strong>Location:</strong> {onboardForm.city || '—'}, {onboardForm.state || '—'}</div>
                      </div>
                    </div>

                    {/* Principal Summary Card */}
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>👔 Principal Account</span>
                        <button type="button" onClick={() => setOnboardStep(3)} style={{ background: 'none', border: 'none', color: '#0176d3', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>Edit</button>
                      </div>
                      <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.8 }}>
                        <div><strong>Name:</strong> {onboardForm.principal_name || '—'}</div>
                        <div><strong>Email:</strong> {onboardForm.principal_email || '—'}</div>
                        <div><strong>Mobile:</strong> {onboardForm.principal_phone || '—'}</div>
                        <div><strong>Login Methods:</strong> Email or Mobile (Dual)</div>
                        <div><strong>Status:</strong> <span className="badge badge-success">{onboardForm.principal_status}</span></div>
                      </div>
                    </div>

                    {/* Academic Setup Card */}
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>🎓 Academic Configuration</span>
                        <button type="button" onClick={() => setOnboardStep(2)} style={{ background: 'none', border: 'none', color: '#0176d3', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>Edit</button>
                      </div>
                      <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.8 }}>
                        <div><strong>Session:</strong> {onboardForm.current_session}</div>
                        <div><strong>Classes Initialized:</strong> {onboardForm.classes.length} classes (Nursery to 12th)</div>
                      </div>
                    </div>

                    {/* ERP Plan Card */}
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>⚡ Subscription Tier</span>
                        <button type="button" onClick={() => setOnboardStep(5)} style={{ background: 'none', border: 'none', color: '#0176d3', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>Edit</button>
                      </div>
                      <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.8 }}>
                        <div><strong>Plan:</strong> <span className="badge badge-neutral" style={{ fontWeight: 700 }}>{onboardForm.plan}</span></div>
                        <div><strong>Standard Fee Heads:</strong> Admission, Tuition, Exam</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── STEP 7: Onboarding Success Screen ── */}
              {onboardStep === 7 && onboardResult && (
                <div style={{ textAlign: 'center', padding: '20px 10px' }}>
                  <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, margin: '0 auto 16px' }}>
                    ✓
                  </div>
                  <h3 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>
                    School Successfully Onboarded!
                  </h3>
                  <p style={{ fontSize: 13, color: '#64748b', maxWidth: 480, margin: '0 auto 24px' }}>
                    The institution has been initialized, the Principal user is active, and the school is ready for operations.
                  </p>

                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '18px 24px', textAlign: 'left', maxWidth: 520, margin: '0 auto 24px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13, color: '#334155' }}>
                      <div>
                        <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase' }}>School Name</div>
                        <strong style={{ color: '#0f172a' }}>{onboardResult.school?.name}</strong>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase' }}>School Code</div>
                        <code style={{ background: '#e2e8f0', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>{onboardResult.school?.code}</code>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase' }}>Principal</div>
                        <strong style={{ color: '#0f172a' }}>{onboardResult.principal?.name || '—'}</strong>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase' }}>Login Identifier</div>
                        <span style={{ color: '#0284c7', fontWeight: 600 }}>Email OR Mobile</span>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <button
                      className="btn btn-primary"
                      onClick={() => {
                        setShowOnboardModal(false);
                        navigate(`/schools/${onboardResult.school?.id}`);
                      }}
                    >
                      🏫 Open School Details
                    </button>
                    <button
                      className="btn btn-neutral"
                      onClick={() => {
                        setShowOnboardModal(false);
                        navigate('/users');
                      }}
                    >
                      👥 View Staff & Principal
                    </button>
                    <button
                      className="btn btn-neutral"
                      onClick={() => {
                        setOnboardForm(initialOnboardForm);
                        setOnboardStep(1);
                        setOnboardError('');
                        setOnboardResult(null);
                      }}
                    >
                      ➕ Onboard Another School
                    </button>
                  </div>
                </div>
              )}

            </div>

            {/* Modal Footer Controls (Steps 1 to 6) */}
            {onboardStep < 7 && (
              <div className="modal-footer" style={{ background: '#f8fafc', borderTop: '1px solid #e2e8f0', padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn btn-neutral"
                  disabled={onboardSaving}
                  onClick={() => {
                    if (onboardStep > 1) {
                      setOnboardStep(s => s - 1);
                      setOnboardError('');
                    } else {
                      setShowOnboardModal(false);
                    }
                  }}
                >
                  {onboardStep === 1 ? 'Cancel' : '← Back'}
                </button>

                <div style={{ display: 'flex', gap: 10 }}>
                  {onboardStep < 6 ? (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => {
                        // Inline validation per step
                        setOnboardError('');
                        if (onboardStep === 1) {
                          if (!onboardForm.name.trim()) {
                            setOnboardError('School Name is required');
                            return;
                          }
                          if (!onboardForm.code.trim()) {
                            setOnboardError('School Code is required');
                            return;
                          }
                          if (!onboardForm.phone.trim() || !onboardForm.email.trim()) {
                            setOnboardError('Official Phone and Email are required');
                            return;
                          }
                        }
                        if (onboardStep === 3) {
                          if (!onboardForm.principal_name.trim()) {
                            setOnboardError('Principal full name is required');
                            return;
                          }
                          if (!onboardForm.principal_email.trim() || !onboardForm.principal_email.includes('@')) {
                            setOnboardError('Valid Principal email is required');
                            return;
                          }
                          if (onboardForm.principal_phone.replace(/\D/g, '').length < 10) {
                            setOnboardError('Principal mobile must have at least 10 digits');
                            return;
                          }
                        }
                        setOnboardStep(s => s + 1);
                      }}
                    >
                      Next Step →
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={onboardSaving}
                      onClick={handleOnboardSubmit}
                      style={{ background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', fontWeight: 800 }}
                    >
                      {onboardSaving ? 'Creating School & Principal...' : '🚀 Create & Onboard School'}
                    </button>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
