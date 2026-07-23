import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Navbar  from '../components/Navbar';
import api from '../api/axios';
import toast from 'react-hot-toast';

const STAFF_ROLES = [
  { value: 'VICE_PRINCIPAL',       label: 'Vice Principal' },
  { value: 'ACADEMIC_COORDINATOR', label: 'Academic Coordinator' },
  { value: 'EXAM_CONTROLLER',      label: 'Exam Controller' },
  { value: 'LIBRARIAN',            label: 'Librarian' },
  { value: 'ACCOUNTANT',           label: 'Accountant' },
  { value: 'RECEPTIONIST',         label: 'Receptionist' },
  { value: 'HOSTEL',               label: 'Hostel Warden' },
  { value: 'TRANSPORT',            label: 'Transport Manager' },
  { value: 'HR',                   label: 'HR' },
];

// Roles whose dashboard access is equivalent to Principal — shown with a
// distinct badge so it's obvious in the list who else has broad access.
// (Vice Principal can manage everyone below Principal/Director but not
// delete a Principal/Director — enforced server-side, not just here.)
const ELEVATED_ROLES = new Set(['VICE_PRINCIPAL']);

export default function StaffPage() {
  const navigate = useNavigate();
  const [staff,        setStaff]        = useState([]);
  const [filter,        setFilter]       = useState('');
  const [roleFilter,    setRoleFilter]   = useState('');
  const [showModal,     setShowModal]    = useState(false);
  const [createdCreds,  setCreatedCreds] = useState(null);
  const [copied,        setCopied]       = useState(false);
  const [form,          setForm]         = useState({ role: 'LIBRARIAN' });
  const [saving,        setSaving]       = useState(false);
  const [msg,           setMsg]          = useState('');
  const [resetTarget,   setResetTarget]  = useState(null); // user obj
  const [resetPw,       setResetPw]      = useState('');
  const [resetting,     setResetting]    = useState(false);
  const [toggling,      setToggling]     = useState(null);
  const [deleteTarget,  setDeleteTarget] = useState(null); // user obj pending delete confirm
  const [deleting,      setDeleting]     = useState(false);

  const load = () => {
    api.get('/principal/users', { params: { per_page: 200 } })
      .then(r => {
        // Sirf staff roles dikhao — TEACHER/STUDENT/PARENT/PRINCIPAL exclude
        const staffRoleKeys = STAFF_ROLES.map(r => r.value);
        setStaff((r.data.users || []).filter(u => staffRoleKeys.includes(u.role)));
      })
      .catch(err => {
        if (err?.response?.status === 403) {
          toast.error('Staff list dekhne ki permission nahi hai');
        }
      });
  };
  useEffect(() => { load(); }, []);

  const createStaff = async e => {
    e.preventDefault(); setSaving(true); setMsg('');
    try {
      const res = await api.post('/principal/users', form);
      toast.success('Staff member added!');
      setShowModal(false);
      setCreatedCreds({
        name:     res.data.name,
        email:    res.data.email,
        username: res.data.username,
        password: res.data.plain_password_temp || form.password || 'EduErp@123',
        role:     STAFF_ROLES.find(r => r.value === res.data.role)?.label || res.data.role,
      });
      setForm({ role: 'LIBRARIAN' });
      load();
    } catch (err) {
      const errMsg = err.response?.data?.error || err.response?.data?.message || 'Error';
      setMsg('❌ ' + errMsg);
      toast.error(errMsg);
    }
    setSaving(false);
  };

  const toggleStaff = async (u) => {
    setToggling(u.id);
    try {
      await api.put(`/principal/users/${u.id}/toggle`);
      toast.success(u.is_active ? 'Deactivated' : 'Activated');
      load();
    } catch {
      toast.error('Action failed');
    }
    setToggling(null);
  };

  const deleteStaff = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/principal/users/${deleteTarget.id}`);
      toast.success(`${deleteTarget.name} removed`);
      setDeleteTarget(null);
      load();
    } catch (err) {
      // Backend enforces hierarchy (e.g. a Vice Principal can't delete a
      // Principal/Director) — surface that reason instead of a generic error.
      toast.error(err.response?.data?.error || 'Could not delete this staff member');
    }
    setDeleting(false);
  };

  const submitReset = async e => {
    e.preventDefault(); setResetting(true);
    try {
      const res = await api.put(`/principal/users/${resetTarget.id}/reset-password`, {
        password: resetPw || undefined,
      });
      toast.success('Password reset!');
      setCreatedCreds({
        name:     resetTarget.name,
        email:    res.data.email,
        username: res.data.username,
        password: res.data.plain_password_temp,
        role:     STAFF_ROLES.find(r => r.value === resetTarget.role)?.label || resetTarget.role,
      });
      setResetTarget(null);
      setResetPw('');
      load();
    } catch {
      toast.error('Reset failed');
    }
    setResetting(false);
  };

  const filtered = staff.filter(u => {
    const matchesText = u.name?.toLowerCase().includes(filter.toLowerCase()) ||
      u.email?.toLowerCase().includes(filter.toLowerCase()) ||
      u.username?.toLowerCase().includes(filter.toLowerCase());
    const matchesRole = !roleFilter || u.role === roleFilter;
    return matchesText && matchesRole;
  });

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar title="Staff" />
        <div className="page-body">

          <div className="page-header flex justify-between items-center">
            <div>
              <h2 className="page-title">Staff Management</h2>
              <p className="page-subtitle">{staff.length} staff members</p>
            </div>
            <button className="btn btn-primary btn-sm"
              onClick={() => { setForm({ role: 'LIBRARIAN' }); setShowModal(true); }}>
              + Add Staff
            </button>
          </div>

          {msg && (
            <div className={`alert ${msg.startsWith('✅') ? 'alert-success' : 'alert-error'}`}>
              {msg}
            </div>
          )}

          <div className="card mb-4">
            <div className="card-body" style={{ display: 'flex', gap: 12 }}>
              <input className="form-input"
                placeholder="🔍 Search by name, email, username..."
                style={{ maxWidth: 320 }} value={filter}
                onChange={e => setFilter(e.target.value)} />
              <select className="form-select" style={{ maxWidth: 200 }}
                value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
                <option value="">All Roles</option>
                {STAFF_ROLES.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="card">
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Name</th><th>Role</th><th>Username</th>
                    <th>Email</th><th>Status</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(u => (
                    <tr key={u.id}>
                      <td>
                        <div
                          style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                          onClick={() => navigate(`/staff/${u.id}`)}
                          title="Profile dekhne ke liye click karein">
                          <div style={{
                            width: 32, height: 32, borderRadius: '50%',
                            background: '#f3f0ff', color: '#5867e8',
                            display: 'flex', alignItems: 'center',
                            justifyContent: 'center', fontSize: 13, fontWeight: 700,
                          }}>{u.name?.charAt(0).toUpperCase()}</div>
                          <div style={{ fontWeight: 600, color: '#5867e8', borderBottom: '1px dashed #c4b5fd' }}>{u.name}</div>
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${ELEVATED_ROLES.has(u.role) ? 'badge-warning' : 'badge-info'}`}
                          title={ELEVATED_ROLES.has(u.role) ? 'Has the same dashboard access as Principal' : ''}>
                          {ELEVATED_ROLES.has(u.role) ? '⭐ ' : ''}
                          {STAFF_ROLES.find(r => r.value === u.role)?.label || u.role}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--neutral-6)' }}>{u.username || '—'}</td>
                      <td style={{ fontSize: 12, color: 'var(--neutral-6)' }}>{u.email}</td>
                      <td>
                        <span className={`badge ${u.is_active ? 'badge-success' : 'badge-neutral'}`}>
                          {u.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-neutral btn-sm"
                            onClick={() => { setResetTarget(u); setResetPw(''); }}>
                            🔑 Reset
                          </button>
                          <button className="btn btn-sm" style={{
                            background: u.is_active ? '#fef1ee' : '#f0fdf4',
                            color: u.is_active ? 'var(--error)' : '#16a34a',
                            border: 'none', cursor: 'pointer', borderRadius: 4,
                            padding: '4px 10px', fontSize: 11, fontWeight: 700,
                          }}
                            disabled={toggling === u.id}
                            onClick={() => toggleStaff(u)}>
                            {toggling === u.id ? '...' : (u.is_active ? 'Deactivate' : 'Activate')}
                          </button>
                          <button className="btn btn-sm" style={{
                            background: '#fef1ee', color: 'var(--error)',
                            border: 'none', cursor: 'pointer', borderRadius: 4,
                            padding: '4px 10px', fontSize: 11, fontWeight: 700,
                          }}
                            title="Permanently remove this staff member"
                            onClick={() => setDeleteTarget(u)}>
                            🗑️ Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!filtered.length && (
                    <tr>
                      <td colSpan={6}>
                        <div className="empty-state">
                          <div className="empty-state-icon">🧑‍💼</div>
                          <p>No staff yet. Add your first staff member!</p>
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

      {/* ── Add Staff Modal ── */}
      {showModal && (
        <div className="modal-backdrop"
          onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h3>🧑‍💼 Add New Staff</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={createStaff}>
              <div className="modal-body">
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Role *</label>
                    <select className="form-select" required
                      value={form.role || 'LIBRARIAN'}
                      onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                      {STAFF_ROLES.map(r => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Full Name *</label>
                    <input className="form-input" required placeholder="Staff name"
                      value={form.name || ''}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email *</label>
                    <input className="form-input" type="email" required
                      placeholder="staff@school.edu"
                      value={form.email || ''}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input className="form-input" placeholder="+91-XXXXX-XXXXX"
                      value={form.phone || ''}
                      onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Department</label>
                    <input className="form-input" placeholder="e.g. Library"
                      value={form.department || ''}
                      onChange={e => setForm(f => ({ ...f, department: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Designation</label>
                    <input className="form-input" placeholder="e.g. Senior Librarian"
                      value={form.designation || ''}
                      onChange={e => setForm(f => ({ ...f, designation: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Username</label>
                    <input className="form-input" placeholder="Auto-generated if blank"
                      value={form.username || ''}
                      onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Custom Password</label>
                    <input className="form-input" type="password"
                      placeholder="Leave blank → EduErp@123"
                      value={form.password || ''}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-neutral"
                  onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Adding...' : '🧑‍💼 Add Staff'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Reset Password Modal ── */}
      {resetTarget && (
        <div className="modal-backdrop"
          onClick={e => e.target === e.currentTarget && setResetTarget(null)}>
          <div className="modal" style={{ maxWidth: 380 }}>
            <div className="modal-header">
              <h3>🔑 Reset Password — {resetTarget.name}</h3>
              <button className="modal-close" onClick={() => setResetTarget(null)}>✕</button>
            </div>
            <form onSubmit={submitReset}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">New Password</label>
                  <input className="form-input" type="text"
                    placeholder="Leave blank → EduErp@123"
                    value={resetPw}
                    onChange={e => setResetPw(e.target.value)} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-neutral"
                  onClick={() => setResetTarget(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={resetting}>
                  {resetting ? 'Resetting...' : '🔑 Reset Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {deleteTarget && (
        <div className="modal-backdrop"
          onClick={e => e.target === e.currentTarget && !deleting && setDeleteTarget(null)}>
          <div className="modal" style={{ maxWidth: 380 }}>
            <div className="modal-header">
              <h3>🗑️ Remove Staff Member</h3>
              <button className="modal-close" onClick={() => setDeleteTarget(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 14, marginBottom: 8 }}>
                Are you sure you want to permanently remove <strong>{deleteTarget.name}</strong>
                {' '}({STAFF_ROLES.find(r => r.value === deleteTarget.role)?.label || deleteTarget.role})?
              </p>
              <p style={{ fontSize: 12, color: 'var(--neutral-6)' }}>
                This cannot be undone. If you don't have sufficient hierarchy to remove this person
                (e.g. trying to delete a Principal/Director), the server will block it.
              </p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-neutral"
                onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</button>
              <button type="button" className="btn"
                style={{ background: 'var(--error)', color: '#fff', border: 'none' }}
                disabled={deleting} onClick={deleteStaff}>
                {deleting ? 'Removing...' : '🗑️ Yes, Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Credentials Modal ── */}
      {createdCreds && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h3>✅ Done!</h3>
              <button className="modal-close"
                onClick={() => { setCreatedCreds(null); setCopied(false); }}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{
                background: '#f0fdf4', border: '1px solid #bbf7d0',
                borderRadius: 10, padding: '16px 20px', marginBottom: 14,
              }}>
                <p style={{ fontSize: 12, color: '#166534', fontWeight: 600, marginBottom: 12 }}>
                  📋 Staff ko ye credentials share karein:
                </p>
                {[
                  ['👤 Name',     createdCreds.name],
                  ['🏷️ Role',     createdCreds.role],
                  ['🆔 Username', createdCreds.username],
                  ['📧 Email',    createdCreds.email],
                  ['🔑 Password', createdCreds.password],
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
              <button onClick={() => {
                const text =
                  `EduERP Staff Login Credentials\n` +
                  `Name:      ${createdCreds.name}\n` +
                  `Role:      ${createdCreds.role}\n` +
                  `Username:  ${createdCreds.username}\n` +
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
