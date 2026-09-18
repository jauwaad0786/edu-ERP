import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Navbar  from '../components/Navbar';
import api from '../api/axios';
import toast from 'react-hot-toast';

// New Student Lifecycle Sub-Modals
import PromotionModal from '../components/students/PromotionModal';
import ShuffleModal from '../components/students/ShuffleModal';
import BulkEditModal from '../components/students/BulkEditModal';
import AnnualRegisterModal from '../components/students/AnnualRegisterModal';
import ImportCsvModal from '../components/students/ImportCsvModal';

export default function StudentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sessions, setSessions] = useState([]);

  // Filters
  const [filter, setFilter] = useState('');
  const [classFilter, setClassFilter] = useState(searchParams.get('class_id') || '');
  const [sessionFilter, setSessionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Bulk Selection
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Rollback Token for Section Shuffle
  const [lastRollbackToken, setLastRollbackToken] = useState(() => sessionStorage.getItem('sis_last_shuffle_token') || null);
  const [revertingShuffle, setRevertingShuffle] = useState(false);

  // Modals state
  const [showModal, setShowModal] = useState(false); // Enroll new student
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [showShuffleModal, setShowShuffleModal] = useState(false);
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);
  const [showAnnualRegModal, setShowAnnualRegModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [provisionalTarget, setProvisionalTarget] = useState(null);
  const [provisionalCount, setProvisionalCount] = useState(0);

  const [createdCreds, setCreatedCreds] = useState(null);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const [downloading, setDownloading] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Fetch initial data
  const loadStudents = () => {
    const params = [];
    if (classFilter) params.push(`class_id=${classFilter}`);
    if (sessionFilter) params.push(`session=${encodeURIComponent(sessionFilter)}`);
    const q = params.length ? `?${params.join('&')}` : '';

    api.get(`/principal/students${q}`)
      .then(r => setStudents(Array.isArray(r.data) ? r.data : (r.data.data || [])))
      .catch(() => {});
  };

  useEffect(() => {
    loadStudents();
    setSelectedIds(new Set());
  }, [classFilter, sessionFilter]);

  useEffect(() => {
    api.get('/principal/classes').then(r => setClasses(r.data)).catch(() => {});
    api.get('/principal/students/sessions')
      .then(r => {
        const sess = r.data.sessions || [];
        setSessions(sess);
        if (sess.length > 0 && !sessionFilter) {
          // Default to first session
          setSessionFilter(sess[0]);
        }
      })
      .catch(() => {});

    api.get('/principal/students?status=PROVISIONAL')
      .then(r => {
        const list = Array.isArray(r.data) ? r.data : (r.data.data || []);
        setProvisionalCount(list.length);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (classFilter) {
      setSearchParams({ class_id: classFilter });
    } else {
      setSearchParams({});
    }
  }, [classFilter, setSearchParams]);

  // Download admission card
  async function downloadAdmissionCard(studentId, studentName) {
    setDownloading(studentId);
    try {
      const res = await api.get(
        `/principal/admission-card/${studentId}`,
        { responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(
        new Blob([res.data], { type: 'application/pdf' })
      );
      const a = document.createElement('a');
      a.href = url;
      a.download = `AdmissionCard_${studentName}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Admission card generate nahi hua');
    }
    setDownloading(null);
  }

  // Export CSV
  async function handleExportCSV() {
    setExporting(true);
    try {
      const q = [];
      if (sessionFilter) q.push(`session=${encodeURIComponent(sessionFilter)}`);
      if (classFilter) q.push(`class_id=${encodeURIComponent(classFilter)}`);
      const qs = q.length ? `?${q.join('&')}` : '';

      const res = await api.get(`/principal/students/export${qs}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `Students_Export_${sessionFilter || 'all'}_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('Students exported to CSV successfully!');
    } catch {
      toast.error('Export failed');
    }
    setExporting(false);
  }

  // Revert last shuffle
  async function handleRollbackShuffle() {
    if (!lastRollbackToken) return;
    if (!window.confirm('Are you sure you want to revert the last section shuffle? Students will be restored to their previous sections.')) {
      return;
    }
    setRevertingShuffle(true);
    try {
      const res = await api.post('/principal/students/shuffle/rollback', {
        rollback_token: lastRollbackToken,
      });
      toast.success(res.data.message || 'Section shuffle reverted successfully!');
      sessionStorage.removeItem('sis_last_shuffle_token');
      setLastRollbackToken(null);
      loadStudents();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Rollback failed');
    }
    setRevertingShuffle(false);
  }

  const createStudent = async e => {
    e.preventDefault(); setSaving(true); setMsg('');
    try {
      const autoEmail = `stu_${form.roll_number || Date.now()}_${
        crypto.getRandomValues(new Uint32Array(1))[0].toString(36).slice(0, 4)
      }@internal.school`;
      const payload = { ...form, email: autoEmail };
      await api.post('/principal/students', payload);
      toast.success('Student enrolled successfully!');
      setShowModal(false);
      setCreatedCreds({
        name:        form.name,
        rollNo:      form.roll_number  || '—',
        admissionNo: form.admission_no || '—',
        className:   classes.find(c => String(c.id) === String(form.class_id))?.name || '—',
        parentName:  form.parent_name  || '—',
        parentPhone: form.parent_phone || '—',
        password:    form.password     || 'Student@123', // NOSONAR(javascript:S2068) - temporary display-only onboarding credential
      });
      setForm({});
      loadStudents();
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Error';
      setMsg('❌ ' + errMsg);
      toast.error(errMsg);
    }
    setSaving(false);
  };

  async function confirmDeleteStudent() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/principal/students/${deleteTarget.id}`);
      toast.success(`${deleteTarget.name} moved to Deleted Items for 1 year`);
      setStudents(prev => prev.filter(s => s.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Delete nahi ho paya');
    }
    setDeleting(false);
  }

  // Selection toggle
  function toggleStudentSelection(id) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(s => s.id)));
    }
  }

  // Filtering
  const filtered = students.filter(s => {
    const matchesSearch =
      s.name?.toLowerCase().includes(filter.toLowerCase()) ||
      s.roll_number?.toLowerCase().includes(filter.toLowerCase()) ||
      s.admission_no?.toLowerCase().includes(filter.toLowerCase());

    const matchesStatus = !statusFilter || (s.status || 'ACTIVE') === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const STATUS_BADGES = {
    ACTIVE:      { bg: '#dcfce7', text: '#15803d', label: 'Confirmed (Active)' },
    PROVISIONAL: { bg: '#fef3c7', text: '#b45309', label: 'Unconfirmed (Fee Due)' },
    PROMOTED:    { bg: '#e0e7ff', text: '#3730a3', label: 'Promoted' },
    RETAINED:    { bg: '#fef3c7', text: '#92400e', label: 'Retained' },
    GRADUATED:   { bg: '#f3e8ff', text: '#6b21a8', label: 'Graduated' },
    WITHDRAWN:   { bg: '#fee2e2', text: '#991b1b', label: 'Withdrawn' },
    LEFT:        { bg: '#f1f5f9', text: '#475569', label: 'Left' },
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar title="Student Management & Lifecycle" />
        <div className="page-body">

          {/* ── Page Header & Lifecycle Toolbar ── */}
          <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14, marginBottom: 16 }}>
            <div>
              <h2 className="page-title" style={{ fontSize: 22, fontWeight: 800 }}>
                Student Management & SIS Lifecycle
              </h2>
              <p className="page-subtitle" style={{ fontSize: 13, color: 'var(--neutral-5)' }}>
                Permanent student master profiles, annual session rollover, section shuffle, bulk editing, and multi-year academic history.
              </p>
            </div>

            {/* Action Buttons Toolbar */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => navigate('/admission')}
                style={{ background: '#0176d3', borderColor: '#0176d3', fontWeight: 700 }}
              >
                + New Admission
              </button>
              <button
                type="button"
                className="btn btn-neutral"
                onClick={() => navigate('/students/import')}
              >
                📥 Import CSV
              </button>
              <button
                type="button"
                className="btn btn-neutral"
                disabled={exporting}
                onClick={handleExportCSV}
              >
                {exporting ? 'Exporting...' : '📤 Export CSV'}
              </button>
            </div>
          </div>

          {/* ── Provisional Admissions Alert Banner ── */}
          {provisionalCount > 0 && (
            <div style={{
              background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
              border: '1px solid #fde68a',
              borderRadius: 10,
              padding: '12px 18px',
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 22 }}>⏳</span>
                <div>
                  <div style={{ fontWeight: 700, color: '#92400e', fontSize: 14 }}>
                    {provisionalCount} Unconfirmed {provisionalCount === 1 ? 'Admission' : 'Admissions'} Pending Fee Clearance
                  </div>
                  <div style={{ fontSize: 12, color: '#b45309' }}>
                    These applicants are isolated in the Provisional Admissions queue with temporary PROV- IDs and excluded from official student rosters.
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate('/admissions/provisional')}
                style={{
                  background: '#b45309',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 6,
                  padding: '7px 14px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                Go to Provisional Admissions <i className="ti ti-arrow-right" />
              </button>
            </div>
          )}

          {/* ── Rollback Notification Banner ── */}
          {lastRollbackToken && (
            <div style={{
              background: '#eff6ff', border: '1px solid #93c5fd', borderRadius: 8,
              padding: '10px 16px', marginBottom: 14, display: 'flex',
              justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8
            }}>
              <div style={{ fontSize: 13, color: '#1e40af' }}>
                ⚡ <strong>Recent Section Shuffle Active</strong> (Token: <code>{lastRollbackToken.slice(0, 10)}...</code>). You can revert student sections to their previous state if needed.
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={handleRollbackShuffle}
                  disabled={revertingShuffle}
                  style={{
                    background: '#2563eb', color: '#fff', border: 'none',
                    borderRadius: 6, padding: '4px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  {revertingShuffle ? 'Reverting...' : '↩️ Undo / Revert Last Shuffle'}
                </button>
                <button
                  type="button"
                  onClick={() => { sessionStorage.removeItem('sis_last_shuffle_token'); setLastRollbackToken(null); }}
                  style={{ background: 'none', border: 'none', fontSize: 12, color: '#64748b', cursor: 'pointer' }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* ── Bulk Action Floating / Inline Toolbar ── */}
          {selectedIds.size > 0 && (
            <div style={{
              background: '#1e293b', color: '#fff', borderRadius: 8,
              padding: '10px 16px', marginBottom: 14, display: 'flex',
              justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
            }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>
                📋 {selectedIds.size} student{selectedIds.size === 1 ? '' : 's'} selected
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => navigate('/students/bulk-edit', { state: { selectedIds: Array.from(selectedIds) } })}
                  style={{ background: '#0284c7', borderColor: '#0284c7' }}
                >
                  ✏️ Bulk Edit Selection
                </button>
                <button
                  type="button"
                  className="btn btn-neutral btn-sm"
                  onClick={() => setSelectedIds(new Set())}
                  style={{ background: '#334155', color: '#fff', borderColor: '#475569' }}
                >
                  Clear Selection
                </button>
              </div>
            </div>
          )}

          {msg && (
            <div className={`alert ${msg.startsWith('✅') ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: 14 }}>
              {msg}
            </div>
          )}

          {/* ── Filters Card ── */}
          <div className="card mb-6" style={{ margin: '0 0 16px 0' }}>
            <div className="card-body" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                className="form-input"
                placeholder="🔍 Search name, admission no, roll no..."
                style={{ maxWidth: 280 }}
                value={filter}
                onChange={e => setFilter(e.target.value)}
              />

              {/* Session Filter */}
              <select
                className="form-select"
                style={{ maxWidth: 170 }}
                value={sessionFilter}
                onChange={e => setSessionFilter(e.target.value)}
              >
                <option value="">All Sessions</option>
                {sessions.map(s => (
                  <option key={s} value={s}>Session {s}</option>
                ))}
              </select>

              {/* Class Filter */}
              <select
                className="form-select"
                style={{ maxWidth: 180 }}
                value={String(classFilter)}
                onChange={e => setClassFilter(e.target.value)}
              >
                <option value="">All Classes</option>
                {classes.map(c => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name} — {c.section}
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                className="form-select"
                style={{ maxWidth: 150 }}
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="ACTIVE">Confirmed (Active)</option>
                <option value="PROVISIONAL">Unconfirmed (Fee Due)</option>
                <option value="PROMOTED">Promoted</option>
                <option value="RETAINED">Retained</option>
                <option value="GRADUATED">Graduated</option>
                <option value="WITHDRAWN">Withdrawn</option>
                <option value="LEFT">Left</option>
              </select>

              {(classFilter || sessionFilter || statusFilter || filter) && (
                <button
                  type="button"
                  className="btn btn-neutral btn-sm"
                  onClick={() => { setClassFilter(''); setStatusFilter(''); setFilter(''); }}
                >
                  ✕ Clear Filters
                </button>
              )}

              <div style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--neutral-6)' }}>
                Showing <strong>{filtered.length}</strong> of {students.length} students
              </div>
            </div>
          </div>

          {/* ── Students Table ── */}
          <div className="card" style={{ margin: 0 }}>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>
                      <input
                        type="checkbox"
                        checked={filtered.length > 0 && selectedIds.size === filtered.length}
                        onChange={toggleSelectAll}
                        title="Select All"
                      />
                    </th>
                    <th>Roll No</th>
                    <th>Student Name</th>
                    <th>Admission No</th>
                    <th>Session</th>
                    <th>Class</th>
                    <th>Stream / House</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(s => {
                    const st = STATUS_BADGES[s.status || 'ACTIVE'] || STATUS_BADGES.ACTIVE;
                    const isSelected = selectedIds.has(s.id);

                    return (
                      <tr key={s.id} style={{ background: isSelected ? '#f0f9ff' : 'inherit' }}>
                        <td>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleStudentSelection(s.id)}
                          />
                        </td>
                        <td>
                          <span
                            className="badge badge-info"
                            style={{ fontWeight: 700, cursor: 'pointer' }}
                            onClick={() => navigate(`/students/${s.id}`)}
                            title="Click to view student profile"
                          >
                            {s.roll_number || '—'}
                          </span>
                        </td>
                        <td>
                          <div
                            style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                            onClick={() => navigate(`/students/${s.id}`)}
                            title="Click to view full dossier"
                          >
                            <div style={{
                              width: 32, height: 32, borderRadius: '50%',
                              background: 'var(--blue-10)', color: 'var(--blue-80)',
                              display: 'flex', alignItems: 'center',
                              justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0
                            }}>
                              {s.name?.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div style={{
                                fontWeight: 700, fontSize: 13,
                                color: 'var(--blue-60)',
                              }}>
                                {s.name}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--neutral-5)' }}>
                                {s.email || (s.parent_phone ? `Parent: ${s.parent_phone}` : '')}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div
                            style={{ fontWeight: 700, fontSize: 12, color: '#0176d3', cursor: 'pointer' }}
                            onClick={() => navigate(`/students/${s.id}`)}
                            title="Click to view student profile"
                          >
                            {s.admission_no || '—'}
                          </div>
                          {s.original_admission_year && (
                            <div style={{ fontSize: 10, color: 'var(--neutral-4)' }}>
                              Admitted: {s.original_admission_year}
                            </div>
                          )}
                        </td>
                        <td>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#334155', background: '#f1f5f9', padding: '2px 8px', borderRadius: 4 }}>
                            {s.session || 'Current'}
                          </span>
                        </td>
                        <td style={{ fontSize: 12, fontWeight: 600 }}>
                          {classes.find(c => String(c.id) === String(s.class_id))?.name
                            ? `${classes.find(c => String(c.id) === String(s.class_id)).name} - ${classes.find(c => String(c.id) === String(s.class_id)).section}`
                            : (s.class_name || '—')}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {s.house && (
                              <span style={{ fontSize: 10, fontWeight: 600, color: '#0369a1', background: '#e0f2fe', padding: '2px 6px', borderRadius: 4 }}>
                                🏠 {s.house}
                              </span>
                            )}
                            {s.stream && s.stream !== 'General' && (
                              <span style={{ fontSize: 10, fontWeight: 600, color: '#7c3aed', background: '#f3e8ff', padding: '2px 6px', borderRadius: 4 }}>
                                🧪 {s.stream}
                              </span>
                            )}
                            {!s.house && (!s.stream || s.stream === 'General') && (
                              <span style={{ fontSize: 11, color: 'var(--neutral-4)' }}>—</span>
                            )}
                          </div>
                        </td>
                        <td>
                          {s.status === 'PROVISIONAL' ? (
                            <button
                              type="button"
                              onClick={() => setProvisionalTarget(s)}
                              style={{
                                padding: '3px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700,
                                background: st.bg, color: st.text, border: '1px solid #fcd34d',
                                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4
                              }}
                              title="Click to view incomplete admission options"
                            >
                              ⚠️ {st.label} ↗
                            </button>
                          ) : (
                            <span style={{
                              padding: '3px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700,
                              background: st.bg, color: st.text
                            }}>
                              {st.label}
                            </span>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {/* Complete Admission button for Unconfirmed Students */}
                            {s.status === 'PROVISIONAL' && (
                              <button
                                type="button"
                                onClick={() => setProvisionalTarget(s)}
                                style={{
                                  background: '#fffbeb', color: '#b45309',
                                  border: '1px solid #fcd34d', borderRadius: 4,
                                  padding: '4px 8px', fontSize: 11,
                                  fontWeight: 800, cursor: 'pointer',
                                  display: 'inline-flex', alignItems: 'center', gap: 4
                                }}
                                title="Complete Admission: Pay Fee or Complete Profile"
                              >
                                ⚡ Complete Admission
                              </button>
                            )}
                            {/* Academic History Button */}
                            <button
                              type="button"
                              onClick={() => navigate(`/students/${s.id}?tab=history`)}
                              style={{
                                background: '#f5f3ff', color: '#6d28d9',
                                border: 'none', borderRadius: 4,
                                padding: '4px 8px', fontSize: 11,
                                fontWeight: 700, cursor: 'pointer',
                              }}
                              title="View Multi-Year Academic History"
                            >
                              📜 History
                            </button>

                            {/* Profile */}
                            <button
                              type="button"
                              onClick={() => navigate(`/students/${s.id}`)}
                              style={{
                                background: '#eff6ff', color: '#0176d3',
                                border: 'none', borderRadius: 4,
                                padding: '4px 8px', fontSize: 11,
                                fontWeight: 700, cursor: 'pointer',
                              }}
                            >
                              👤 Profile
                            </button>

                            {/* Admission Card */}
                            <button
                              type="button"
                              onClick={() => downloadAdmissionCard(s.id, s.name)}
                              disabled={downloading === s.id}
                              style={{
                                background: downloading === s.id ? '#f1f5f9' : '#e8f4fd',
                                color: '#0176d3', border: 'none', borderRadius: 4,
                                padding: '4px 8px', fontSize: 11, fontWeight: 700,
                                cursor: downloading === s.id ? 'not-allowed' : 'pointer',
                              }}
                            >
                              {downloading === s.id ? '⏳' : '🎓 Card'}
                            </button>

                            {/* Delete */}
                            <button
                              type="button"
                              onClick={() => setDeleteTarget({ id: s.id, name: s.name })}
                              style={{
                                background: '#fef2f2', color: '#dc2626',
                                border: 'none', borderRadius: 4,
                                padding: '4px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                              }}
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {!filtered.length && (
                    <tr>
                      <td colSpan={9}>
                        <div className="empty-state" style={{ padding: 48 }}>
                          <div className="empty-state-icon">🎒</div>
                          <p style={{ margin: 0 }}>No students found matching your criteria</p>
                          {(classFilter || sessionFilter || statusFilter || filter) && (
                            <button
                              type="button"
                              className="btn btn-neutral btn-sm"
                              style={{ marginTop: 12 }}
                              onClick={() => { setClassFilter(''); setSessionFilter(''); setStatusFilter(''); setFilter(''); }}
                            >
                              Reset All Filters
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>

      {/* ── Sub-Modals ── */}

      {/* 1. Annual Rollover & Promotion Modal */}
      <PromotionModal
        isOpen={showPromoteModal}
        onClose={() => setShowPromoteModal(false)}
        onSuccess={loadStudents}
        classes={classes}
        sessions={sessions}
      />

      {/* 2. Section Shuffle Modal */}
      <ShuffleModal
        isOpen={showShuffleModal}
        onClose={() => setShowShuffleModal(false)}
        onSuccess={(token) => {
          if (token) {
            setLastRollbackToken(token);
            sessionStorage.setItem('sis_last_shuffle_token', token);
          }
          loadStudents();
        }}
        classes={classes}
        sessions={sessions}
      />

      {/* 3. Bulk Edit Modal */}
      <BulkEditModal
        isOpen={showBulkEditModal}
        onClose={() => setShowBulkEditModal(false)}
        onSuccess={() => {
          setSelectedIds(new Set());
          loadStudents();
        }}
        selectedStudentIds={Array.from(selectedIds)}
        session={sessionFilter || '2024-25'}
      />

      {/* 4. Annual Re-Registration Modal */}
      <AnnualRegisterModal
        isOpen={showAnnualRegModal}
        onClose={() => setShowAnnualRegModal(false)}
        onSuccess={loadStudents}
        classes={classes}
        sessions={sessions}
      />

      {/* 5. Import CSV Modal */}
      <ImportCsvModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={loadStudents}
        sessions={sessions}
      />

      {/* ── Enroll Student Modal (New Admission) ── */}
      {showModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <h3>🎒 Enroll New Student</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={createStudent}>
              <div className="modal-body">
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#1e40af', marginBottom: 14 }}>
                  ℹ️ Creates a <strong>permanent student profile</strong> and initial enrollment for the active academic session.
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Full Legal Name *</label>
                    <input className="form-input" required placeholder="Student name"
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Roll Number</label>
                    <input className="form-input" placeholder="e.g. 101"
                      onChange={e => setForm(f => ({ ...f, roll_number: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Admission No *</label>
                    <input className="form-input" placeholder="e.g. ADM2024001"
                      onChange={e => setForm(f => ({ ...f, admission_no: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Class & Section *</label>
                    <select className="form-select" required
                      onChange={e => setForm(f => ({ ...f, class_id: e.target.value || null }))}>
                      <option value="">Select class</option>
                      {classes.map(c => (
                        <option key={c.id} value={c.id}>{c.name} - {c.section}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Gender</label>
                    <select className="form-select"
                      onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}>
                      <option value="">Select</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Academic Session</label>
                    <input className="form-input" defaultValue={sessionFilter || '2024-25'}
                      onChange={e => setForm(f => ({ ...f, session: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Stream</label>
                    <select className="form-select"
                      onChange={e => setForm(f => ({ ...f, stream: e.target.value }))}>
                      <option value="General">General</option>
                      <option value="Science">Science</option>
                      <option value="Commerce">Commerce</option>
                      <option value="Arts / Humanities">Arts / Humanities</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">House</label>
                    <input className="form-input" placeholder="e.g. Red Tigers"
                      onChange={e => setForm(f => ({ ...f, house: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Father Name</label>
                    <input className="form-input" placeholder="e.g. Rahman"
                      onChange={e => setForm(f => ({ ...f, father_name: e.target.value, parent_name: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Mother Name</label>
                    <input className="form-input" placeholder="e.g. Ayesha"
                      onChange={e => setForm(f => ({ ...f, mother_name: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Parent Phone</label>
                    <input className="form-input" placeholder="+91-XXXXX-XXXXX"
                      onChange={e => setForm(f => ({ ...f, parent_phone: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Parent Email</label>
                    <input className="form-input" type="email" placeholder="parent@email.com"
                      onChange={e => setForm(f => ({ ...f, parent_email: e.target.value }))} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-neutral" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : '🎒 Enroll Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Credentials Modal ── */}
      {createdCreds && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h3>✅ Student Enrolled!</h3>
              <button className="modal-close" onClick={() => { setCreatedCreds(null); setCopied(false); }}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{
                background: '#f0fdf4', border: '1px solid #bbf7d0',
                borderRadius: 10, padding: '16px 20px', marginBottom: 14,
              }}>
                <p style={{ fontSize: 12, color: '#166534', fontWeight: 600, marginBottom: 12 }}>
                  📋 Student / Parent credentials:
                </p>
                {[
                  ['👤 Name',        createdCreds.name],
                  ['🎒 Roll No',      createdCreds.rollNo],
                  ['📋 Admission No', createdCreds.admissionNo],
                  ['🏛 Class',        createdCreds.className],
                  ['👨‍👩‍👦 Parent',      createdCreds.parentName],
                  ['📱 Mobile',       createdCreds.parentPhone],
                  ['🔑 Password',     createdCreds.password],
                ].map(([label, value]) => (
                  <div key={label} style={{
                    display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', padding: '7px 0',
                    borderBottom: '1px solid #dcfce7', fontSize: 13,
                  }}>
                    <span style={{ color: '#64748b' }}>{label}</span>
                    <strong style={{
                      color: '#0f172a',
                      fontFamily: label.includes('Password') ? 'monospace' : 'inherit',
                      background: label.includes('Password') ? '#e0f2fe' : 'transparent',
                      padding: label.includes('Password') ? '2px 8px' : 0,
                      borderRadius: 4,
                    }}>{value}</strong>
                  </div>
                ))}
              </div>
              <button onClick={() => {
                const text =
                  `EduERP Student Login\n` +
                  `Name:         ${createdCreds.name}\n` +
                  `Roll No:      ${createdCreds.rollNo}\n` +
                  `Admission No: ${createdCreds.admissionNo}\n` +
                  `Class:        ${createdCreds.className}\n` +
                  `Password:     ${createdCreds.password}\n` +
                  `Login URL:    ${window.location.origin}/login`;
                navigator.clipboard.writeText(text);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }} style={{
                width: '100%', padding: 11, borderRadius: 8, border: 'none',
                background: copied ? '#2e844a' : 'var(--blue-60)',
                color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                transition: 'background 0.2s',
              }}>
                {copied ? '✅ Copied!' : '📋 Copy Credentials'}
              </button>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => { setCreatedCreds(null); setCopied(false); }}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {deleteTarget && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && !deleting && setDeleteTarget(null)}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h3>🗑️ Delete Student</h3>
              <button className="modal-close" disabled={deleting} onClick={() => setDeleteTarget(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{
                background: '#eff6ff', border: '1px solid #bfdbfe',
                borderRadius: 8, padding: '14px 16px', fontSize: 13, color: '#1e40af',
              }}>
                ℹ️ <strong>{deleteTarget.name}</strong> will be moved to <strong>DELETED ITEMS</strong>. It remains recoverable for 1 year (365 days).
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-neutral" disabled={deleting} onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button
                onClick={confirmDeleteStudent}
                disabled={deleting}
                style={{
                  background: '#dc2626', color: '#fff', border: 'none',
                  borderRadius: 6, padding: '8px 18px', fontSize: 13,
                  fontWeight: 700, cursor: deleting ? 'not-allowed' : 'pointer',
                  opacity: deleting ? 0.7 : 1,
                }}>
                {deleting ? 'Deleting...' : '🗑️ Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Incomplete / Provisional Student Modal ── */}
      {provisionalTarget && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setProvisionalTarget(null)}>
          <div className="modal" style={{ maxWidth: 540, borderRadius: 14, overflow: 'hidden' }}>
            <div className="modal-header" style={{ background: '#fffbeb', borderBottom: '1px solid #fcd34d', padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 24 }}>⚡</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#92400e' }}>
                    Unconfirmed Student Admission
                  </h3>
                  <p style={{ margin: 0, fontSize: 12, color: '#b45309' }}>
                    Quick registration complete, pending fee payment &amp; profile finalization
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setProvisionalTarget(null)}
                style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#78350f' }}
              >
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Student Details Card */}
              <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12.5, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>👤 <strong>Name:</strong> {provisionalTarget.name}</div>
                <div>🆔 <strong>Admission No:</strong> {provisionalTarget.admission_no || '—'}</div>
                <div>🎓 <strong>Class:</strong> {classes.find(c => String(c.id) === String(provisionalTarget.class_id))?.name || provisionalTarget.class_name || '—'}</div>
                <div>📱 <strong>Mobile:</strong> {provisionalTarget.parent_phone || '—'}</div>
                <div style={{ gridColumn: '1 / -1', color: '#b45309', background: '#fef3c7', padding: '8px 12px', borderRadius: 6, fontWeight: 600, fontSize: 12 }}>
                  ⚠️ <strong>Current Status: Unconfirmed (Fee Due).</strong> Student portal credentials (Admission No &amp; Father&apos;s Name) are active, but admission will be officially confirmed only once fees are deposited.
                </div>
              </div>

              {/* Next Steps Choices */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Option 1: Collect Fees */}
                <div
                  onClick={() => {
                    const t = provisionalTarget;
                    setProvisionalTarget(null);
                    navigate(`/finance/payments/collect?student_id=${t.id}`);
                  }}
                  style={{
                    background: '#f0fdf4',
                    border: '1.5px solid #86efac',
                    borderRadius: 10,
                    padding: '14px 16px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 26 }}>💳</span>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 800, color: '#15803d' }}>
                        Collect Admission Fee &amp; Auto-Confirm
                      </div>
                      <div style={{ fontSize: 11.5, color: '#166534', marginTop: 2 }}>
                        Fee collect hote hi status automatically <strong>CONFIRMED (ACTIVE)</strong> ho jayega aur receipt issue hogi.
                      </div>
                    </div>
                  </div>
                  <span style={{ fontSize: 18, color: '#15803d', fontWeight: 800 }}>→</span>
                </div>

                {/* Option 2: Complete Profile */}
                <div
                  onClick={() => {
                    const t = provisionalTarget;
                    setProvisionalTarget(null);
                    navigate(`/students/${t.id}`);
                  }}
                  style={{
                    background: '#eff6ff',
                    border: '1.5px solid #93c5fd',
                    borderRadius: 10,
                    padding: '14px 16px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 26 }}>👤</span>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 800, color: '#1e40af' }}>
                        Complete Full Profile &amp; KYC Documents
                      </div>
                      <div style={{ fontSize: 11.5, color: '#1d4ed8', marginTop: 2 }}>
                        Student photo, Aadhar documents, address, aur academic history fill / update karein.
                      </div>
                    </div>
                  </div>
                  <span style={{ fontSize: 18, color: '#1e40af', fontWeight: 800 }}>→</span>
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ padding: '12px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-neutral"
                onClick={() => setProvisionalTarget(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
