import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Navbar  from '../components/Navbar';
import api from '../api/axios';
import toast from 'react-hot-toast';
export default function TeachersPage() {
  const [teachers,     setTeachers]     = useState([]);
  const [filter,       setFilter]       = useState('');
  const [showModal,    setShowModal]    = useState(false);
  const [createdCreds, setCreatedCreds] = useState(null);
  const [copied,       setCopied]       = useState(false);
  const [form,   setForm]   = useState({});
  const [subjects, setSubjects] = useState([{ class_name: '', subject_name: '' }]);
  const [saving, setSaving] = useState(false);
  const [msg,       setMsg]       = useState('');
  const [editForm,  setEditForm]  = useState(null);  // null = closed
  const [deleting,  setDeleting]  = useState(null);
  const [photoUploading, setPhotoUploading] = useState(null); // teacher id store hoga

  const navigate = useNavigate();
  const load = () =>
    api.get('/principal/teachers').then(r => setTeachers(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);
  async function uploadTeacherPhoto(teacherId, file) {
  setPhotoUploading(teacherId);
  try {
    const fd = new FormData();
    fd.append('photo', file);
    await api.post(`/principal/teachers/${teacherId}/photo`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    load();
    toast.success('Photo upload ho gayi!');
    setMsg('✅ Photo upload ho gayi!');
  } catch {
    setMsg('❌ Photo upload nahi hui');
    toast.error('Photo upload nahi hui');
  }
  setPhotoUploading(null);
}

async function deleteTeacherPhoto(teacherId) {
  try {
    await api.delete(`/principal/teachers/${teacherId}/photo`);
    load();
    setMsg('✅ Photo delete ho gayi');
  } catch {
    setMsg('❌ Delete nahi hua');
  }
}

  const createTeacher = async e => {
    e.preventDefault(); setSaving(true); setMsg('');
    try {
      await api.post('/principal/teachers', {
        ...form,
        dob:          form.dob          || undefined,
        salary:       form.salary       ? parseFloat(form.salary) : undefined,
        joining_date: form.joining_date || undefined,
        qualification:form.qualification|| undefined,
        subjects:     subjects.filter(s => s.class_name && s.subject_name),
      });
      toast.success('Teacher added successfully!');
      setShowModal(false);
      setSubjects([{ class_name: '', subject_name: '' }]);
      setCreatedCreds({
      
        name:  form.name,
        email: form.email,
        password: form.password || 'Teacher@123',
        empId: form.employee_id || '—',
        dept:  form.department  || '—',
      });
      setForm({}); load();
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Error';
      setMsg('❌ ' + errMsg);
      toast.error(errMsg);
    }
    setSaving(false);
  };
  
  const updateTeacher = async e => {
    e.preventDefault(); setSaving(true);
    try {
      await api.patch(`/principal/teachers/${editForm.id}`, editForm);
      toast.success('Teacher updated!');
      setEditForm(null); load();
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Update failed';
      setMsg('❌ ' + errMsg);
      toast.error(errMsg);
    }
    setSaving(false);
  };

  const removeTeacher = async (id) => {
    if (!window.confirm('Are you sure? This teacher will be moved to Deleted Items for 1 year and can be recovered anytime.')) return;
    setDeleting(id);
    try {
      await api.delete(`/principal/teachers/${id}`);
      toast.success('Teacher moved to Deleted Items for 1 year');
      load();
    } catch {
      setMsg('❌ Remove failed');
      toast.error('Remove failed');
    }
    setDeleting(null);
  };
  const filtered = teachers.filter(t =>
    t.name?.toLowerCase().includes(filter.toLowerCase()) ||
    t.employee_id?.includes(filter) ||
    t.department?.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar title="Teachers" />
        <div className="page-body">

          <div className="page-header flex justify-between items-center">
            <div>
              <h2 className="page-title">Teaching Staff</h2>
              <p className="page-subtitle">{teachers.length} staff members</p>
            </div>
            <button className="btn btn-primary btn-sm"
              onClick={() => { setForm({}); setShowModal(true); }}>
              + Add Teacher
            </button>
          </div>

          {msg && (
            <div className={`alert ${msg.startsWith('✅') ? 'alert-success' : 'alert-error'}`}>
              {msg}
            </div>
          )}

          <div className="card mb-4">
            <div className="card-body">
              <input className="form-input"
                placeholder="🔍 Search by name, employee ID, department..."
                style={{ maxWidth: 360 }} value={filter}
                onChange={e => setFilter(e.target.value)} />
            </div>
          </div>

          <div className="card">
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Employee ID</th><th>Name</th><th>Department</th>
                    <th>Designation</th><th>Email</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(t => (
                    <tr key={t.id}>
                      <td>
                        <span className="badge badge-info">{t.employee_id || '—'}</span>
                      </td>
                      
                      <td>
                        <div
                          style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                          onClick={() => navigate(`/teachers/${t.id}`)}
                          title="Profile dekhne ke liye click karein">
                          <div style={{ position: 'relative', width: 32, height: 32 }}>
                            {t.photo_url
                              ? <img src={t.photo_url} alt={t.name}
                                  style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                              : <div style={{
                                  width: 32, height: 32, borderRadius: '50%',
                                  background: '#f3f0ff', color: '#5867e8',
                                  display: 'flex', alignItems: 'center',
                                  justifyContent: 'center', fontSize: 13, fontWeight: 700,
                                }}>{t.name?.charAt(0).toUpperCase()}</div>
                            }
                            <label onClick={e => e.stopPropagation()} style={{
                              position: 'absolute', bottom: -2, right: -2,
                              background: '#0176d3', borderRadius: '50%',
                              width: 14, height: 14, display: 'flex',
                              alignItems: 'center', justifyContent: 'center',
                              cursor: 'pointer', fontSize: 8,
                            }} title="Photo upload/change">
                              📷
                              <input type="file" accept="image/*" style={{ display: 'none' }}
                                onChange={e => e.target.files[0] && uploadTeacherPhoto(t.id, e.target.files[0])} />
                            </label>
                          </div>
                          <div>
                            <div style={{
                              fontWeight: 600, color: '#5867e8',
                              borderBottom: '1px dashed #c4b5fd',
                            }}>{t.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--neutral-5)' }}>
                              {t.employee_id || '—'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ color: 'var(--neutral-6)' }}>{t.department || '—'}</td>
                      <td>
                        <span className="badge badge-neutral">{t.designation}</span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--neutral-6)' }}>{t.email}</td>
                      <td>
                         <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={() => navigate(`/teachers/${t.id}`)}
                            style={{
                              background: '#f3f0ff', color: '#5867e8',
                              border: 'none', borderRadius: 4,
                              padding: '4px 10px', fontSize: 11,
                              fontWeight: 700, cursor: 'pointer',
                            }}>👤 Profile</button>
                          <button className="btn btn-neutral btn-sm"
                            onClick={() => setEditForm({ ...t })}>Edit</button>
                          <button className="btn btn-sm" style={{
                            background: '#fef1ee', color: 'var(--error)',
                            border: 'none', cursor: 'pointer', borderRadius: 4,
                            padding: '4px 10px', fontSize: 11, fontWeight: 700,
                          }}
                            disabled={deleting === t.id}
                            onClick={() => removeTeacher(t.id)}>
                            {deleting === t.id ? '...' : 'Remove'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!filtered.length && (
                    <tr>
                      <td colSpan={6}>
                        <div className="empty-state">
                          <div className="empty-state-icon">👩‍🏫</div>
                          <p>No teachers yet. Add your first teacher!</p>
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

      {/* ── Add Teacher Modal ── */}
      {showModal && (
        <div className="modal-backdrop"
          onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h3>👩‍🏫 Add New Teacher</h3>
               <button className="modal-close" onClick={() => {
              setShowModal(false);
              setSubjects([{ class_name: '', subject_name: '' }]);
            }}>✕</button>
            </div>
            <form onSubmit={createTeacher}>
              <div className="modal-body">
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Full Name *</label>
                    <input className="form-input" required placeholder="Teacher name"
                      onChange={e => setForm(f => ({...f, name: e.target.value}))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email *</label>
                    <input className="form-input" type="email" required
                      placeholder="teacher@school.edu"
                      onChange={e => setForm(f => ({...f, email: e.target.value}))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Employee ID</label>
                    <input className="form-input" placeholder="EMP001"
                      onChange={e => setForm(f => ({...f, employee_id: e.target.value}))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input className="form-input" placeholder="+91-XXXXX-XXXXX"
                      onChange={e => setForm(f => ({...f, phone: e.target.value}))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Department</label>
                    <input className="form-input" placeholder="e.g. Mathematics"
                      onChange={e => setForm(f => ({...f, department: e.target.value}))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Designation</label>
                    <select className="form-select"
                      onChange={e => setForm(f => ({...f, designation: e.target.value}))}>
                      <option value="Teacher">Teacher</option>
                      <option value="Senior Teacher">Senior Teacher</option>
                      <option value="HOD">HOD</option>
                      <option value="Vice Principal">Vice Principal</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Custom Password</label>
                    <input className="form-input" type="password"
                      placeholder="Leave blank → Teacher@123"
                      onChange={e => setForm(f => ({...f, password: e.target.value}))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Monthly Salary (₹)</label>
                    <input className="form-input" type="number" placeholder="e.g. 25000"
                      onChange={e => setForm(f => ({...f, salary: e.target.value}))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Date of Birth (DOB)</label>
                    <input className="form-input" type="date"
                      onChange={e => setForm(f => ({...f, dob: e.target.value}))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Date of Joining</label>
                    <input className="form-input" type="date"
                      onChange={e => setForm(f => ({...f, joining_date: e.target.value}))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Qualification</label>
                    <input className="form-input" placeholder="e.g. B.Ed, M.Sc"
                      onChange={e => setForm(f => ({...f, qualification: e.target.value}))} />
                  </div>
                </div>
                <div style={{ gridColumn: '1 / -1', marginTop: 8 }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', marginBottom: 8,
                }}>
                  <label className="form-label" style={{ marginBottom: 0 }}>
                    📚 Subjects to Teach (optional — add later too)
                  </label>
                  <button
                    type="button"
                    onClick={() => setSubjects(s => [...s, { class_name: '', subject_name: '' }])}
                    style={{
                      background: '#eff6ff', color: '#0176d3', border: 'none',
                      borderRadius: 6, padding: '4px 10px', fontSize: 11,
                      fontWeight: 700, cursor: 'pointer',
                    }}>+ Add Row</button>
                </div>
                {subjects.map((s, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                    <input
                      className="form-input"
                      placeholder="Class (e.g. Class 10 - A)"
                      style={{ flex: 1 }}
                      value={s.class_name}
                      onChange={e => setSubjects(prev =>
                        prev.map((x, j) => j === i ? { ...x, class_name: e.target.value } : x)
                      )} />
                    <input
                      className="form-input"
                      placeholder="Subject (e.g. Mathematics)"
                      style={{ flex: 1 }}
                      value={s.subject_name}
                      onChange={e => setSubjects(prev =>
                        prev.map((x, j) => j === i ? { ...x, subject_name: e.target.value } : x)
                      )} />
                    {subjects.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setSubjects(prev => prev.filter((_, j) => j !== i))}
                        style={{
                          background: '#fef2f2', color: '#dc2626', border: 'none',
                          borderRadius: 6, padding: '6px 10px', cursor: 'pointer',
                          fontSize: 13, fontWeight: 700,
                        }}>✕</button>
                    )}
                  </div>
                ))}
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                  💡 Class teacher assign karna ho toh Classes page se kar sakte ho
                </div>
              </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-neutral"
                  onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Adding...' : '👩‍🏫 Add Teacher'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {editForm && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setEditForm(null)}>
          <div className="modal">
            <div className="modal-header">
              <h3>✏️ Edit Teacher</h3>
              <button className="modal-close" onClick={() => setEditForm(null)}>✕</button>
            </div>
            <form onSubmit={updateTeacher}>
              <div className="modal-body">
                <div className="grid-2">
                  {[
                    ['Full Name',          'name',         'text',   'Teacher name'],
                    ['Department',         'department',   'text',   'e.g. Mathematics'],
                    ['Designation',        'designation',  'text',   'e.g. Senior Teacher'],
                    ['Phone',              'phone',        'text',   '+91-XXXXX'],
                    ['Monthly Salary (₹)', 'salary',       'number', 'e.g. 25000'],
                    ['Date of Birth (DOB)','dob',          'date',   ''],
                    ['Date of Joining',    'joining_date', 'date',   ''],
                    ['Qualification',      'qualification','text',   'e.g. B.Ed'],
                  ].map(([label, field, type, ph]) => (
                    <div className="form-group" key={field}>
                      <label className="form-label">{label}</label>
                      <input className="form-input" type={type} placeholder={ph}
                        value={editForm[field] || ''}
                        onChange={e => setEditForm(f => ({ ...f, [field]: e.target.value }))} />
                    </div>
                  ))}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-neutral" onClick={() => setEditForm(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : '✅ Save Changes'}
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
              <h3>✅ Teacher Added!</h3>
              <button className="modal-close"
                onClick={() => { setCreatedCreds(null); setCopied(false); }}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{
                background: '#f0fdf4', border: '1px solid #bbf7d0',
                borderRadius: 10, padding: '16px 20px', marginBottom: 14,
              }}>
                <p style={{ fontSize: 12, color: '#166534', fontWeight: 600, marginBottom: 12 }}>
                  📋 Teacher ko ye credentials share karein:
                </p>
                {[
                  ['👤 Name',        createdCreds.name],
                  ['🪪 Employee ID',  createdCreds.empId],
                  ['🏢 Department',   createdCreds.dept],
                  ['📧 Email',        createdCreds.email],
                  ['🔑 Password',     createdCreds.password],
                ].map(([label, value]) => (
                  <div key={label} style={{
                    display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', padding: '8px 0',
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
                ⚠️ Pehli login ke baad teacher ko password change karne ko bolein.
              </div>
              <button onClick={() => {
                const text =
                  `EduERP Teacher Login Credentials\n` +
                  `Name:      ${createdCreds.name}\n` +
                  `Email:     ${createdCreds.email}\n` +
                  `Password:  ${createdCreds.password}\n` +
                  `Login URL: ${window.location.origin}/login`;
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
    </div>
  );
}
