import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Navbar  from '../components/Navbar';
import api from '../api/axios';
import toast from 'react-hot-toast';

export default function StudentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [students,     setStudents]     = useState([]);
  const [classes,      setClasses]      = useState([]);
  const [filter,       setFilter]       = useState('');
  // Fix #3 — URL se class_id padho
  const [classFilter,  setClassFilter]  = useState(searchParams.get('class_id') || '');
  const [showModal,    setShowModal]    = useState(false);
  const [createdCreds, setCreatedCreds] = useState(null);
  const [copied,       setCopied]       = useState(false);
  const [form,         setForm]         = useState({});
  const [saving,       setSaving]       = useState(false);
  const [msg,          setMsg]          = useState('');
  // Fix #2 — downloading state
  const [downloading, setDownloading] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null); // { id, name }
  const [deleting, setDeleting] = useState(false);

useEffect(() => {
  const q = classFilter ? `?class_id=${classFilter}` : '';
  api.get(`/principal/students${q}`).then(r => {   setStudents(Array.isArray(r.data) ? r.data : (r.data.data || [])); }).catch(() => {});
  api.get('/principal/classes').then(r => setClasses(r.data)).catch(() => {});
}, [classFilter]);

useEffect(() => {
    if (classFilter) {
      setSearchParams({ class_id: classFilter });
    } else {
      setSearchParams({});
    }
  }, [classFilter, setSearchParams]);

  // Fix #2 — axios blob download (JWT token automatically jata hai)
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
      setMsg('❌ Admission card generate nahi hua');
      toast.error('Admission card generate nahi hua');
    }
    setDownloading(null);
  }

  const createStudent = async e => {
    e.preventDefault(); setSaving(true); setMsg('');
    try {
      const autoEmail = `stu_${form.roll_number || Date.now()}_${
        Math.random().toString(36).slice(2, 6)
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
        password:    form.password     || 'Student@123',
      });
    setForm({});
      const q = classFilter ? `?class_id=${classFilter}` : '';
      api.get(`/principal/students${q}`).then(r => {   setStudents(Array.isArray(r.data) ? r.data : (r.data.data || [])); }).catch(() => {});
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

  const filtered = students.filter(s =>
    s.name?.toLowerCase().includes(filter.toLowerCase()) ||
    s.roll_number?.includes(filter) ||
    s.admission_no?.includes(filter)
  );

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar title="Students" />
        <div className="page-body">

          <div className="page-header flex justify-between items-center">
            <div>
              <h2 className="page-title">Students</h2>
              <p className="page-subtitle">{students.length} enrolled this session</p>
            </div>
            <button className="btn btn-primary btn-sm"
              onClick={() => { setForm({}); setShowModal(true); }}>
              + Enroll Student
            </button>
          </div>

          {msg && (
            <div className={`alert ${msg.startsWith('✅') ? 'alert-success' : 'alert-error'}`}>
              {msg}
            </div>
          )}

          <div className="card mb-6">
            <div className="card-body" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <input
                className="form-input"
                placeholder="🔍 Search by name, roll no..."
                style={{ maxWidth: 280 }}
                value={filter}
                onChange={e => setFilter(e.target.value)}
              />
              {/* Fix #3 — String() wrap for proper value match */}
              <select
                className="form-select"
                style={{ maxWidth: 200 }}
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

              {/* Clear filter button — URL se aaya ho to */}
              {classFilter && (
                <button
                  className="btn btn-neutral btn-sm"
                  onClick={() => setClassFilter('')}
                >
                  ✕ Clear Filter
                </button>
              )}

              <div style={{
                marginLeft: 'auto', display: 'flex',
                alignItems: 'center', fontSize: 13, color: 'var(--neutral-6)',
              }}>
                Showing {filtered.length} of {students.length}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Roll No</th>
                    <th>Name</th>
                    <th>Admission No</th>
                    <th>Class</th>
                    <th>Parent</th>
                    <th>Contact</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(s => (
                    <tr key={s.id}>
                      <td>
                        <span className="badge badge-info">
                          {s.roll_number || '—'}
                        </span>
                      </td>
                      <td>
                        <div
                          style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                          onClick={() => navigate(`/students/${s.id}`)}
                          title="Profile dekhne ke liye click karein">
                          <div style={{
                            width: 30, height: 30, borderRadius: '50%',
                            background: 'var(--blue-10)', color: 'var(--blue-80)',
                            display: 'flex', alignItems: 'center',
                            justifyContent: 'center', fontSize: 12, fontWeight: 700,
                          }}>
                            {s.name?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{
                              fontWeight: 600, fontSize: 13,
                              color: 'var(--blue-60)',
                              borderBottom: '1px dashed var(--blue-30)',
                            }}>{s.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--neutral-6)' }}>
                              {s.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ color: 'var(--neutral-6)', fontSize: 12 }}>
                        {s.admission_no || '—'}
                      </td>
                      {/* Fix #3 — String() comparison for class name lookup */}
                      <td style={{ fontSize: 12 }}>
                        {classes.find(c => String(c.id) === String(s.class_id))?.name || '—'}
                      </td>
                      <td style={{ fontSize: 12 }}>{s.parent_name || '—'}</td>
                      <td style={{ fontSize: 12, color: 'var(--neutral-6)' }}>
                        {s.parent_phone || '—'}
                      </td>
                      <td>
                        <span className="badge badge-success">Active</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={() => navigate(`/students/${s.id}`)}
                            style={{
                              background: '#eff6ff', color: '#0176d3',
                              border: 'none', borderRadius: 4,
                              padding: '4px 10px', fontSize: 11,
                              fontWeight: 700, cursor: 'pointer',
                            }}>
                            👤 Profile
                          </button>
                          <button
                            onClick={() => downloadAdmissionCard(s.id, s.name)}
                            disabled={downloading === s.id}
                            style={{
                              background: downloading === s.id ? '#f1f5f9' : '#e8f4fd',
                              color: '#0176d3',
                              border: 'none',
                              borderRadius: 4,
                              padding: '4px 10px',
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: downloading === s.id ? 'not-allowed' : 'pointer',
                              opacity: downloading === s.id ? 0.6 : 1,
                              transition: 'all 0.15s',
                            }}
                          >
                            {downloading === s.id ? '⏳ Loading...' : '🎓 Admission Card'}
                          </button>
                          <button
                            onClick={() => setDeleteTarget({ id: s.id, name: s.name })}
                            style={{
                              background: '#fef2f2', color: '#dc2626',
                              border: 'none', borderRadius: 4,
                              padding: '4px 10px', fontSize: 11,
                              fontWeight: 700, cursor: 'pointer',
                            }}
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {!filtered.length && (
                    <tr>
                      <td colSpan={8}>
                        <div className="empty-state">
                          <div className="empty-state-icon">🎒</div>
                          <p>
                            {classFilter
                              ? 'Is class mein koi student nahi mila'
                              : 'No students found'}
                          </p>
                          {classFilter && (
                            <button
                              className="btn btn-neutral btn-sm"
                              style={{ marginTop: 12 }}
                              onClick={() => setClassFilter('')}
                            >
                              Sab students dekho
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

      {/* ── Enroll Student Modal ── */}
      {showModal && (
        <div className="modal-backdrop"
          onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <h3>🎒 Enroll New Student</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={createStudent}>
              <div className="modal-body">
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Full Name *</label>
                    <input className="form-input" required placeholder="Student name"
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Roll Number</label>
                    <input className="form-input" placeholder="e.g. 101"
                      onChange={e => setForm(f => ({ ...f, roll_number: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Admission No</label>
                    <input className="form-input" placeholder="e.g. ADM2024001"
                      onChange={e => setForm(f => ({ ...f, admission_no: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Class</label>
                    <select className="form-select"
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
                  <div className="form-group">
                    <label className="form-label">Session</label>
                    <input className="form-input" defaultValue="2024-25"
                      onChange={e => setForm(f => ({ ...f, session: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Custom Password</label>
                    <input className="form-input" type="password"
                      placeholder="Leave blank → Student@123"
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-neutral"
                  onClick={() => setShowModal(false)}>Cancel</button>
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
              <button className="modal-close"
                onClick={() => { setCreatedCreds(null); setCopied(false); }}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{
                background: '#f0fdf4', border: '1px solid #bbf7d0',
                borderRadius: 10, padding: '16px 20px', marginBottom: 14,
              }}>
                <p style={{ fontSize: 12, color: '#166534', fontWeight: 600, marginBottom: 12 }}>
                  📋 Student / Parent ko ye credentials share karein:
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
              <div style={{
                background: '#fffbeb', border: '1px solid #fde68a',
                borderRadius: 8, padding: '10px 14px',
                fontSize: 12, color: '#92400e', marginBottom: 14,
              }}>
                ⚠️ Pehli login ke baad password change karne ko bolein.
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
              <button className="btn btn-primary"
                onClick={() => { setCreatedCreds(null); setCopied(false); }}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {deleteTarget && (
        <div className="modal-backdrop"
          onClick={e => e.target === e.currentTarget && !deleting && setDeleteTarget(null)}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h3>🗑️ Delete Student</h3>
              <button className="modal-close" disabled={deleting}
                onClick={() => setDeleteTarget(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{
                background: '#eff6ff', border: '1px solid #bfdbfe',
                borderRadius: 8, padding: '14px 16px', fontSize: 13, color: '#1e40af',
              }}>
                ℹ️ <strong>{deleteTarget.name}</strong> ko <strong>DELETED ITEMS</strong> archive mein move kiya jayega. Yeh active lists se hat jayega par <strong>1 saal (365 din)</strong> tak Deleted Items mein surakshit rahega aur kabhi bhi <strong>Recover</strong> kiya ja sakta hai.
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-neutral" disabled={deleting}
                onClick={() => setDeleteTarget(null)}>
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
    </div>
  );
}
      
