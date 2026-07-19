// frontend/src/pages/UsersPage.jsx — NEW FILE

import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar  from '../components/Navbar';
import api     from '../api/axios';

// School-side hierarchy — legacy User.role enum values (unchanged flow:
// role_str goes straight onto the user row, school_id is required).
const SCHOOL_ROLES = [
  { value: 'DIRECTOR',             label: 'Director' },
  { value: 'PRINCIPAL',            label: 'Principal' },
  { value: 'VICE_PRINCIPAL',       label: 'Vice Principal' },
  { value: 'ACADEMIC_COORDINATOR', label: 'Academic Coordinator' },
  { value: 'EXAM_CONTROLLER',      label: 'Exam Controller' },
  { value: 'TEACHER',              label: 'Teacher' },
  { value: 'CLASS_TEACHER',        label: 'Class Teacher' },
  { value: 'ASSISTANT_TEACHER',    label: 'Assistant Teacher' },
  { value: 'ACCOUNTANT',           label: 'Accountant' },
  { value: 'RECEPTIONIST',         label: 'Receptionist' },
  { value: 'LIBRARIAN',            label: 'Librarian' },
  { value: 'HOSTEL',               label: 'Hostel Warden' },
  { value: 'TRANSPORT',            label: 'Transport Manager' },
  { value: 'HR',                   label: 'HR' },
  { value: 'STUDENT',              label: 'Student' },
  { value: 'PARENT',               label: 'Parent' },
];

// Company-side hierarchy — these are NOT legacy enum values. The backend
// (_resolve_creation_role in admin.py) looks them up as COMPANY-scope
// platform_roles and links them via UserRoleAssignment instead — so
// creating one of these must NOT also carry a school_id.
const COMPANY_ROLES = [
  { value: 'CEO',                label: 'CEO' },
  { value: 'SUB_ADMIN',          label: 'Sub Admin' },
  { value: 'MANAGER',            label: 'Manager' },
  { value: 'TEAM_LEAD',          label: 'Team Lead' },
  { value: 'SOFTWARE_ENGINEER',  label: 'Software Engineer' },
  { value: 'BACKEND_DEVELOPER',  label: 'Backend Developer' },
  { value: 'FRONTEND_DEVELOPER', label: 'Frontend Developer' },
  { value: 'QA',                 label: 'QA' },
  { value: 'CUSTOMER_SUPPORT',   label: 'Customer Support' },
  { value: 'CALL_CENTER',        label: 'Call Center' },
  { value: 'SALES',              label: 'Sales' },
  { value: 'ACCOUNTS',           label: 'Accounts' },
  { value: 'COMPANY_HR',         label: 'HR (Company)' },
  { value: 'MARKETING',          label: 'Marketing' },
  { value: 'INTERN',             label: 'Intern' },
];

const ROLES = SCHOOL_ROLES.map(r => r.value);
const ALL_ROLE_OPTIONS = [...SCHOOL_ROLES, ...COMPANY_ROLES];
const roleLabel = value => ALL_ROLE_OPTIONS.find(r => r.value === value)?.label || value;

export default function UsersPage() {
  const [users,   setUsers]   = useState([]);
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg,     setMsg]     = useState('');
  const [showPw,  setShowPw]  = useState({});

  // Filters
  const [filterRole,   setFilterRole]   = useState('');
  const [filterSchool, setFilterSchool] = useState('');
  const [search,       setSearch]       = useState('');

  // Create user modal
  const [showCreate, setShowCreate] = useState(false);
  const [form,       setForm]       = useState({});
  const [saving,     setSaving]     = useState(false);
  const [createdCreds, setCreatedCreds] = useState(null);
  const [copied,       setCopied]       = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get('/admin/users?per_page=200'),
      api.get('/admin/schools'),
    ]).then(([u, s]) => {
      setUsers(u.data.users || []);
      setSchools(s.data);
    }).catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const toggleUser = async id => {
    await api.put(`/admin/users/${id}/toggle`);
    load();
  };

  const createUser = async e => {
    e.preventDefault(); setSaving(true); setMsg('');
    try {
      const r = await api.post('/admin/users', form);
      setShowCreate(false);
      setCreatedCreds({
        name:     r.data.name,
        username: r.data.username,
        email:    r.data.email,
        password: r.data.plain_password_temp || form.password || 'EduErp@123',
        role:     r.data.role,
        school:   schools.find(s => String(s.id) === String(r.data.school_id))?.name || '—',
      });
      setForm({}); load();
    } catch (err) {
      setMsg('❌ ' + (err.response?.data?.error || 'Error'));
    }
    setSaving(false);
  };

  const handleCopy = () => {
    if (!createdCreds) return;
    navigator.clipboard.writeText(
      `EduERP Login Credentials\n` +
      `Name:     ${createdCreds.name}\n` +
      `Username: ${createdCreds.username || '—'}\n` +
      `Email:    ${createdCreds.email}\n` +
      `Password: ${createdCreds.password}\n` +
      `Role:     ${createdCreds.role}\n` +
      `School:   ${createdCreds.school}\n` +
      `Login at: ${window.location.origin}/login`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Filtered users
  const filtered = users.filter(u => {
    const matchRole   = filterRole   ? u.role === filterRole   : true;
    const matchSchool = filterSchool ? String(u.school_id) === filterSchool : true;
    const matchSearch = search
      ? u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase()) ||
        (u.username || '').toLowerCase().includes(search.toLowerCase()) ||
        (u.phone || '').toLowerCase().includes(search.toLowerCase())
      : true;
    return matchRole && matchSchool && matchSearch;
  });

  const roleBadge = role => ({
    SUPER_ADMIN: 'badge-error',
    PRINCIPAL:   'badge-warning',
    TEACHER:     'badge-info',
    STUDENT:     'badge-success',
    PARENT:      'badge-neutral',
  }[role] || 'badge-neutral');

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar title="Users" />
        <div className="page-body">

          {/* Header */}
          <div className="page-header flex justify-between items-center">
            <div>
              <h2 className="page-title">All Users</h2>
              <p className="page-subtitle">Manage all users across EduERP</p>
            </div>
            <button className="btn btn-primary btn-sm"
              onClick={() => { setForm({}); setShowCreate(true); }}>
              + Create User
            </button>
          </div>

          {msg && (
            <div className={`alert ${msg.startsWith('✅') ? 'alert-success' : 'alert-error'}`}
              style={{ marginBottom: 16 }}>
              {msg}
            </div>
          )}

          {/* Stats Row */}
          <div className="grid-4 mb-6">
            {[
              { icon: '👥', label: 'Total Users',    value: users.length,                                           color: '#0176d3' },
              { icon: '👩‍🏫', label: 'Teachers',      value: users.filter(u => u.role === 'TEACHER').length,         color: '#7c3aed' },
              { icon: '🎒', label: 'Students',       value: users.filter(u => u.role === 'STUDENT').length,         color: '#059669' },
              { icon: '🟢', label: 'Active',         value: users.filter(u => u.is_active).length,                  color: '#dd7a01' },
            ].map(s => (
              <div className="stat-card" key={s.label}>
                <div className="stat-icon" style={{ background: s.color + '14' }}>
                  <span style={{ fontSize: 20 }}>{s.icon}</span>
                </div>
                <div className="stat-label">{s.label}</div>
                <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div style={{
            background: '#fff', borderRadius: 10, padding: '14px 20px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginBottom: 20,
            display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
          }}>
            {/* Search */}
            <input
              placeholder="🔍 Search name or email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                flex: 1, minWidth: 200, padding: '8px 12px',
                border: '1px solid #e2e8f0', borderRadius: 6,
                fontSize: 13, outline: 'none',
              }}
            />

            {/* Role filter */}
            <select
              value={filterRole}
              onChange={e => setFilterRole(e.target.value)}
              style={{
                padding: '8px 12px', border: '1px solid #e2e8f0',
                borderRadius: 6, fontSize: 13, color: '#475569',
                background: '#fff', cursor: 'pointer',
              }}>
              <option value="">All Roles</option>
              {['SUPER_ADMIN', ...ROLES].map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>

            {/* School filter */}
            <select
              value={filterSchool}
              onChange={e => setFilterSchool(e.target.value)}
              style={{
                padding: '8px 12px', border: '1px solid #e2e8f0',
                borderRadius: 6, fontSize: 13, color: '#475569',
                background: '#fff', cursor: 'pointer',
              }}>
              <option value="">All Schools</option>
              {schools.map(s => (
                <option key={s.id} value={String(s.id)}>{s.name}</option>
              ))}
            </select>

            {/* Clear */}
            {(filterRole || filterSchool || search) && (
              <button
                onClick={() => { setFilterRole(''); setFilterSchool(''); setSearch(''); }}
                style={{
                  padding: '8px 14px', border: '1px solid #e2e8f0',
                  borderRadius: 6, fontSize: 12, color: '#dc2626',
                  background: '#fef2f2', cursor: 'pointer', fontWeight: 600,
                }}>
                ✕ Clear
              </button>
            )}

            <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 'auto' }}>
              {filtered.length} of {users.length} users
            </span>
          </div>

          {/* Table */}
          <div className="card">
            <div className="table-container">
              {loading ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
                  Loading...
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Username</th>
                      <th>Email</th>
                      <th>Password</th>
                      <th>Role</th>
                      <th>School</th>
                      <th>Phone</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(u => (
                      <tr key={u.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{
                              width: 30, height: 30, borderRadius: '50%',
                              background: 'var(--blue-10)', color: 'var(--blue-80)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 12, fontWeight: 700, flexShrink: 0,
                            }}>
                              {u.name?.charAt(0).toUpperCase()}
                            </div>
                            <span style={{ fontWeight: 500, fontSize: 13 }}>{u.name}</span>
                          </div>
                        </td>
                        <td style={{ color: 'var(--neutral-6)', fontSize: 12, fontFamily: 'monospace' }}>
                          {u.username
                            ? <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                {u.username}
                                <button onClick={() => navigator.clipboard.writeText(u.username)}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#94a3b8', padding: 0 }}>📋</button>
                              </span>
                            : '—'}
                        </td>
                        <td style={{ color: 'var(--neutral-6)', fontSize: 12 }}>{u.email}</td>
                        <td>
                          {u.plain_password_temp ? (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
                                {showPw[u.id] ? u.plain_password_temp : '••••••'}
                              </span>
                              <button onClick={() => setShowPw(p => ({ ...p, [u.id]: !p[u.id] }))}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#94a3b8', padding: 0 }}>
                                {showPw[u.id] ? '🙈' : '👁'}
                              </button>
                              <button onClick={() => navigator.clipboard.writeText(u.plain_password_temp)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#94a3b8', padding: 0 }}>📋</button>
                            </span>
                          ) : <span style={{ color: '#94a3b8', fontSize: 12 }}>changed</span>}
                        </td>
                        <td>
                          <span className={`badge ${roleBadge(u.role)}`}>{u.role}</span>
                        </td>
                        <td style={{ color: 'var(--neutral-6)', fontSize: 12 }}>
                          {schools.find(s => s.id === u.school_id)?.name || '—'}
                        </td>
                        <td style={{ color: 'var(--neutral-6)', fontSize: 12 }}>
                          {u.phone || '—'}
                        </td>
                        <td>
                          <span className={`badge ${u.is_active ? 'badge-success' : 'badge-neutral'}`}>
                            {u.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td>
                          <button
                            onClick={() => toggleUser(u.id)}
                            style={{
                              background: u.is_active ? '#fef1ee' : '#eaf5ea',
                              color:      u.is_active ? 'var(--error)' : 'var(--success)',
                              border: 'none', cursor: 'pointer', borderRadius: 4,
                              padding: '4px 10px', fontSize: 11, fontWeight: 700,
                            }}>
                            {u.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!filtered.length && (
                      <tr>
                        <td colSpan={9} style={{
                          textAlign: 'center', color: 'var(--neutral-4)', padding: 40,
                        }}>
                          No users found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* ── Create User Modal ── */}
      {showCreate && (
        <div className="modal-backdrop"
          onClick={e => e.target === e.currentTarget && setShowCreate(false)}>
          <div className="modal">
            <div className="modal-header">
              <h3>👤 Create New User</h3>
              <button className="modal-close" onClick={() => setShowCreate(false)}>✕</button>
            </div>
            <form onSubmit={createUser}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input className="form-input" placeholder="John Doe" required
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Email *</label>
                  <input className="form-input" type="email" placeholder="john@school.edu" required
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Role *</label>
                    <select className="form-select" required
                      onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                      <option value="">Select role</option>
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Assign School</label>
                    <select className="form-select"
                      onChange={e => setForm(f => ({ ...f, school_id: e.target.value || null }))}>
                      <option value="">None</option>
                      {schools.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <input className="form-input" type="password"
                    placeholder="Leave blank for default: EduErp@123"
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Username <span style={{ color: '#94a3b8', fontWeight: 400 }}>(optional — auto-generated if blank)</span></label>
                  <input className="form-input" placeholder="e.g. ravi.kumar.tchr"
                    onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input className="form-input" placeholder="+91-XXXXX-XXXXX"
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Department</label>
                  <input className="form-input" placeholder="e.g. Science"
                    onChange={e => setForm(f => ({ ...f, department: e.target.value }))} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-neutral"
                  onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Creating...' : '👤 Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Credentials Modal ── */}
      {createdCreds && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h3>✅ User Created!</h3>
              <button className="modal-close"
                onClick={() => { setCreatedCreds(null); setCopied(false); }}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{
                background: '#f0fdf4', border: '1px solid #bbf7d0',
                borderRadius: 10, padding: '16px 20px', marginBottom: 16,
              }}>
                <p style={{ fontSize: 12, color: '#166534', fontWeight: 600, marginBottom: 14 }}>
                  📋 Share these credentials with the user:
                </p>
                {[
                  ['👤 Name',     createdCreds.name],
                  ['🔖 Username', createdCreds.username],
                  ['📧 Email',    createdCreds.email],
                  ['🔑 Password', createdCreds.password],
                  ['🎭 Role',     createdCreds.role],
                  ['🏫 School',   createdCreds.school],
                ].map(([label, value]) => (
                  <div key={label} style={{
                    display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', fontSize: 13,
                    padding: '8px 0', borderBottom: '1px solid #dcfce7',
                  }}>
                    <span style={{ color: '#64748b' }}>{label}</span>
                    <strong style={{
                      color: '#0f172a',
                      fontFamily: label.includes('Password') ? 'monospace' : 'inherit',
                      background: label.includes('Password') ? '#e0f2fe' : 'transparent',
                      padding:    label.includes('Password') ? '2px 8px'  : '0',
                      borderRadius: 4,
                    }}>{value}</strong>
                  </div>
                ))}
              </div>
              <div style={{
                background: '#fffbeb', border: '1px solid #fde68a',
                borderRadius: 8, padding: '10px 14px', marginBottom: 16,
                fontSize: 12, color: '#92400e',
              }}>
                ⚠️ Save these credentials now — password cannot be retrieved later.
              </div>
              <button onClick={handleCopy} style={{
                width: '100%', padding: '11px', borderRadius: 8, border: 'none',
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
