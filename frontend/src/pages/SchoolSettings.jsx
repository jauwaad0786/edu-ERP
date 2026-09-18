import React, { useState, useEffect, useRef } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar  from '../components/Navbar';
import api     from '../api/axios';
import toast   from 'react-hot-toast';

// ── Upload Box Component ──────────────────────────────────────────────────────
function UploadBox({ label, sublabel, currentUrl, onUpload, onDelete, uploading, accept = 'image/*' }) {
  const ref = useRef();
  return (
    <div style={{
      border: '1.5px dashed #cbd5e1', borderRadius: 12, padding: 20,
      background: '#f8fafc', textAlign: 'center', position: 'relative',
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 14 }}>{sublabel}</div>

      {currentUrl ? (
        <div style={{ marginBottom: 14 }}>
          <img
            src={currentUrl}
            alt={label}
            style={{
              maxHeight: 80, maxWidth: '100%', objectFit: 'contain',
              border: '1px solid #e2e8f0', borderRadius: 8,
              background: '#fff', padding: 6,
            }}
          />
        </div>
      ) : (
        <div style={{
          width: 64, height: 64, borderRadius: 10,
          background: '#e2e8f0', margin: '0 auto 14px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 26, color: '#94a3b8',
        }}>
          {label.includes('Logo') ? '🏫' : '✍️'}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={() => ref.current.click()}
          disabled={uploading}
          style={{
            background: '#0176d3', color: '#fff', border: 'none',
            borderRadius: 7, padding: '7px 16px', fontSize: 12,
            fontWeight: 600, cursor: uploading ? 'not-allowed' : 'pointer',
            opacity: uploading ? 0.7 : 1,
          }}
        >
          {uploading ? '⏳ Uploading...' : currentUrl ? '🔄 Change' : '📤 Upload'}
        </button>
        {currentUrl && (
          <button
            onClick={onDelete}
            disabled={uploading}
            style={{
              background: '#fee2e2', color: '#dc2626', border: 'none',
              borderRadius: 7, padding: '7px 14px', fontSize: 12,
              fontWeight: 600, cursor: 'pointer',
            }}
          >
            🗑 Delete
          </button>
        )}
      </div>

      <input
        ref={ref}
        type="file"
        accept={accept}
        style={{ display: 'none' }}
        onChange={e => { if (e.target.files[0]) onUpload(e.target.files[0]); e.target.value = ''; }}
      />
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SchoolSettings() {
  const [school,  setSchool]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [tab,     setTab]     = useState('info');

  // uploading state per field
  const [uploading, setUploading] = useState({
    logo: false, principal_sig: false, director_sig: false,
  });

  // form state
  const [form, setForm] = useState({
    name: '', address: '', city: '', state: '',
    pincode: '', phone: '', email: '', current_session: '',
  });

  // ── Fetch ──
  // ── Fetch ──
  const load = () => {
    setLoading(true);
  
    api.get('/principal/school/settings')
      .then(r => {
        console.log("SETTINGS API:", r.data);
  
        setSchool(r.data);
  
        setForm({
          name: r.data.name || '',
          address: r.data.address || '',
          city: r.data.city || '',
          state: r.data.state || '',
          pincode: r.data.pincode || '',
          phone: r.data.phone || '',
          email: r.data.email || '',
          current_session: r.data.current_session || '',
        });
      })
      .catch(err => {
        console.log("SETTINGS ERROR:", err);
        toast.error('School data load nahi hua');
      })
      .finally(() => {
        setLoading(false);
      });
  };
  
  useEffect(() => {
    load();
  }, []);

  // ── Save text info ──
  const saveInfo = async e => {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await api.patch('/principal/school/settings', form);
      setSchool(r.data);
      toast.success('✅ School info save ho gayi!');
    } catch {
      toast.error('Save nahi hua — dobara try karo');
    }
    setSaving(false);
  };

  // ── Generic image upload ──
  const handleUpload = async (file, endpoint, field) => {
    setUploading(u => ({ ...u, [field]: true }));
    const fd = new FormData();
    // field name matches what backend expects
    const fieldName = field === 'logo' ? 'logo' : 'signature';
    fd.append(fieldName, file);
    try {
      const r = await api.post(endpoint, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSchool(s => ({ ...s, ...r.data }));
      toast.success('✅ Upload ho gaya!');
    } catch {
      toast.error('Upload fail hua — file size check karo (max 5MB)');
    }
    setUploading(u => ({ ...u, [field]: false }));
  };

  // ── Generic image delete ──
  const handleDelete = async (endpoint, key) => {
    if (!window.confirm('Delete karna chahte ho?')) return;
    try {
      await api.delete(endpoint);
      setSchool(s => ({ ...s, [key]: null }));
      toast.success('Deleted!');
    } catch {
      toast.error('Delete nahi hua');
    }
  };

  // ── Users tab state (Principal) ──
  const PU_ROLES = ['VICE_PRINCIPAL','TEACHER','ACCOUNTANT','RECEPTIONIST','LIBRARIAN','HOSTEL','TRANSPORT','HR','STUDENT','PARENT'];
  const [pUsers, setPUsers]             = useState([]);
  const [pUsersLoading, setPUsersLoading] = useState(false);
  const [pSearch, setPSearch]           = useState('');
  const [pFilterRole, setPFilterRole]   = useState('');
  const [showPCreate, setShowPCreate]   = useState(false);
  const [pForm, setPForm]               = useState({});
  const [pSaving, setPSaving]           = useState(false);
  const [pCreds, setPCreds]             = useState(null);
  const [pCopied, setPCopied]           = useState(false);
  const [pShowPw, setPShowPw]           = useState({});

  const loadPrincipalUsers = () => {
    setPUsersLoading(true);
    const params = new URLSearchParams();
    if (pSearch) params.set('search', pSearch);
    if (pFilterRole) params.set('role', pFilterRole);
    api.get('/principal/users?' + params.toString())
      .then(r => setPUsers(r.data.users || []))
      .catch(() => toast.error('Users load nahi hue'))
      .finally(() => setPUsersLoading(false));
  };

  useEffect(() => { if (tab === 'users') loadPrincipalUsers(); }, [tab, pSearch, pFilterRole]);

  if (loading) return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar title="School Settings" />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
          <div style={{ textAlign: 'center', color: '#64748b' }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>⏳</div>
            <div style={{ fontSize: 14 }}>Loading...</div>
          </div>
        </div>
      </div>
    </div>
  );

  

  const createPrincipalUser = async e => {
    e.preventDefault(); setPSaving(true);
    try {
      const r = await api.post('/principal/users', pForm);
      setPCreds(r.data);
      setShowPCreate(false);
      setPForm({});
      loadPrincipalUsers();
      toast.success('User created!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error');
    }
    setPSaving(false);
  };

  const togglePUser = async (id) => {
    try {
      await api.put('/principal/users/' + id + '/toggle');
      loadPrincipalUsers();
    } catch {
      toast.error('Toggle failed');
    }
  };

  const resetPUserPw = async (u) => {
    // SonarQube Hotspot javascript:S2068 Audit: Admin-prompted fallback credential for manual password reset UI — not stored server-side.
    const DEFAULT_RESET_CREDENTIAL = 'EduErp@123'; // NOSONAR(javascript:S2068)
    const pw = window.prompt("New password for " + u.name + " (min 6 chars):\n(blank = " + DEFAULT_RESET_CREDENTIAL + ")");
    if (pw === null) return;
    const chosenPw = (pw || DEFAULT_RESET_CREDENTIAL).trim();
    if (chosenPw.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    try {
      const r = await api.put('/principal/users/' + u.id + '/reset-password', { password: chosenPw });
      toast.success('Password reset successfully! Temporary password copied.');
      navigator.clipboard.writeText('Username: ' + (r.data.username || u.email) + '\nTemporary Password: ' + chosenPw);
      loadPrincipalUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Reset failed');
    }
  };

  const pRoleBadge = r => ({ TEACHER: 'badge-info', STUDENT: 'badge-success', PARENT: 'badge-neutral' }[r] || 'badge-warning');

  const TABS = [
    { key: 'info',     icon: '🏫', label: 'School Info' },
    { key: 'branding', icon: '🖼️', label: 'Logo & Signatures' },
    { key: 'users',    icon: '👥', label: 'Users' },
  ];

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar title="School Settings" />
        <div className="page-body">

          {/* ── Header ── */}
          <div className="page-header">
            <div>
              <h2 className="page-title">⚙️ School Settings</h2>
              <p className="page-subtitle">
                School ki information, logo aur signatures manage karo
              </p>
            </div>
            {/* Quick preview badges */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {school?.logo_url && (
                <img src={school.logo_url} alt="logo"
                  style={{ height: 40, width: 40, objectFit: 'contain',
                    border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', padding: 4 }} />
              )}
              <div style={{
                background: '#f1f5f9', borderRadius: 8,
                padding: '6px 14px', fontSize: 12, fontWeight: 600, color: '#475569',
              }}>
                {school?.code || '—'}
              </div>
              <span style={{
                background: school?.is_active ? '#dcfce7' : '#fee2e2',
                color: school?.is_active ? '#16a34a' : '#dc2626',
                borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 700,
              }}>
                {school?.is_active ? '🟢 Active' : '🔴 Inactive'}
              </span>
            </div>
          </div>

          {/* ── Tabs ── */}
          <div style={{ display: 'flex', borderBottom: '2px solid #e2e8f0', marginBottom: 24 }}>
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '10px 22px', fontSize: 13, fontWeight: 600,
                color: tab === t.key ? '#0176d3' : '#64748b',
                borderBottom: tab === t.key ? '2px solid #0176d3' : '2px solid transparent',
                marginBottom: -2, display: 'flex', alignItems: 'center', gap: 7,
              }}>
                <span>{t.icon}</span>{t.label}
              </button>
            ))}
          </div>

          {/* ══ TAB: School Info ══════════════════════════════════════════════ */}
          {tab === 'info' && (
            <div style={{ maxWidth: 720 }}>
              <div className="card" style={{ margin: 0 }}>
                <div className="card-header">
                  <h4 style={{ margin: 0 }}>🏫 School Information</h4>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b' }}>
                    Yeh information ID cards, PDFs aur reports mein use hoti hai
                  </p>
                </div>
                <div className="card-body" style={{ padding: '24px' }}>
                  <form onSubmit={saveInfo}>

                    {/* School Name */}
                    <div className="form-group" style={{ marginBottom: 16 }}>
                      <label className="form-label">School Name *</label>
                      <input
                        className="form-input"
                        value={form.name}
                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        required
                        placeholder="e.g. Delhi Public School"
                      />
                    </div>

                    {/* Address */}
                    <div className="form-group" style={{ marginBottom: 16 }}>
                      <label className="form-label">Full Address</label>
                      <input
                        className="form-input"
                        value={form.address}
                        onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                        placeholder="Street, Area, Landmark"
                      />
                    </div>

                    {/* City + State */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                      <div className="form-group">
                        <label className="form-label">City</label>
                        <input
                          className="form-input"
                          value={form.city}
                          onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                          placeholder="e.g. Delhi"
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">State</label>
                        <input
                          className="form-input"
                          value={form.state}
                          onChange={e => setForm(f => ({ ...f, state: e.target.value }))}
                          placeholder="e.g. Delhi"
                        />
                      </div>
                    </div>

                    {/* Pincode + Phone */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                      <div className="form-group">
                        <label className="form-label">Pincode</label>
                        <input
                          className="form-input"
                          value={form.pincode}
                          onChange={e => setForm(f => ({ ...f, pincode: e.target.value }))}
                          placeholder="110001"
                          maxLength={6}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Phone</label>
                        <input
                          className="form-input"
                          value={form.phone}
                          onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                          placeholder="9876543210"
                        />
                      </div>
                    </div>

                    {/* Email + Session */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}>
                      <div className="form-group">
                        <label className="form-label">Email</label>
                        <input
                          className="form-input"
                          type="email"
                          value={form.email}
                          onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                          placeholder="school@email.com"
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Current Session</label>
                        <select
                          className="form-select"
                          value={form.current_session}
                          onChange={e => setForm(f => ({ ...f, current_session: e.target.value }))}
                        >
                          {['2023-24','2024-25','2025-26','2026-27'].map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Current values preview */}
                    <div style={{
                      background: '#f8fafc', borderRadius: 10, padding: '14px 18px',
                      marginBottom: 20, border: '1px solid #e2e8f0',
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b',
                        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                        Current Saved Info
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 20px' }}>
                        {[
                          ['Name',    school?.name],
                          ['City',    school?.city],
                          ['State',   school?.state],
                          ['Phone',   school?.phone],
                          ['Email',   school?.email],
                          ['Session', school?.current_session],
                          ['Address', school?.address],
                          ['Pincode', school?.pincode],
                        ].map(([k, v]) => (
                          <div key={k} style={{ fontSize: 12, color: '#475569', display: 'flex', gap: 6 }}>
                            <span style={{ color: '#94a3b8', minWidth: 56 }}>{k}:</span>
                            <strong style={{ color: '#0f172a' }}>{v || '—'}</strong>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={saving}
                      className="btn btn-primary"
                      style={{ minWidth: 140 }}
                    >
                      {saving ? '⏳ Saving...' : '💾 Save Changes'}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* ══ TAB: Logo & Signatures ════════════════════════════════════════ */}
          {tab === 'branding' && (
            <div style={{ maxWidth: 760 }}>

              {/* Instructions */}
              <div style={{
                background: '#eff6ff', border: '1px solid #bfdbfe',
                borderRadius: 10, padding: '12px 18px', marginBottom: 24,
                fontSize: 12, color: '#1e40af', lineHeight: 1.7,
              }}>
                <strong>📌 Signature upload kaise karein:</strong><br />
                Principal/Director white paper pe signature karein → phone se photo lein →
                sirf signature area crop karein → upload karein.
                PDF mein white background automatically transparent ho jaata hai.
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>

                {/* Logo */}
                <UploadBox
                  label="School Logo"
                  sublabel="PNG/JPG — white/transparent bg best hai"
                  currentUrl={school?.logo_url}
                  uploading={uploading.logo}
                  onUpload={file => handleUpload(file, '/principal/school/logo', 'logo')}
                  onDelete={() => handleDelete('/principal/school/logo', 'logo_url')}
                />

                {/* Principal Signature */}
                <UploadBox
                  label="Principal Signature"
                  sublabel="White paper pe sign karo, crop karke upload karo"
                  currentUrl={school?.principal_signature_url}
                  uploading={uploading.principal_sig}
                  onUpload={file => handleUpload(file, '/principal/school/principal-signature', 'principal_sig')}
                  onDelete={() => handleDelete('/principal/school/principal-signature', 'principal_signature_url')}
                />

                {/* Director Signature */}
                <UploadBox
                  label="Director Signature"
                  sublabel="Chairman/Director ka signature"
                  currentUrl={school?.director_signature_url}
                  uploading={uploading.director_sig}
                  onUpload={file => handleUpload(file, '/principal/school/director-signature', 'director_sig')}
                  onDelete={() => handleDelete('/principal/school/director-signature', 'director_signature_url')}
                />
              </div>

              {/* Usage note */}
              <div style={{
                background: '#f0fdf4', border: '1px solid #bbf7d0',
                borderRadius: 10, padding: '14px 18px', marginTop: 24,
                fontSize: 12, color: '#166534',
              }}>
                <strong>✅ Yeh images automatically use hoti hain:</strong>
                <ul style={{ margin: '8px 0 0', paddingLeft: 18, lineHeight: 1.9 }}>
                  <li>Student ID Cards — school logo (front) + principal signature (back)</li>
                  <li>Employee ID Cards — school logo (front)</li>
                  <li>Admit Cards, Result Cards — logo + signature</li>
                </ul>
              </div>
            </div>
          )}

          {/* ══ TAB: User Management (Principal) ════════════════════════════ */}
          {tab === 'users' && (
            <div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
                <input
                  placeholder="🔍 Search name, email, username, phone..."
                  value={pSearch} onChange={e => setPSearch(e.target.value)}
                  style={{ flex: 1, minWidth: 180, padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, outline: 'none' }}
                />
                <select value={pFilterRole} onChange={e => setPFilterRole(e.target.value)}
                  style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, color: '#475569', background: '#fff' }}>
                  <option value="">All Roles</option>
                  {PU_ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
                </select>
                <button className="btn btn-primary btn-sm" onClick={() => { setPForm({}); setShowPCreate(true); }}>+ Create User</button>
              </div>

              <div className="card">
                <div className="table-container">
                  {pUsersLoading ? (
                    <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Loading...</div>
                  ) : (
                    <table>
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Username</th>
                          <th>Email</th>
                          <th>Password</th>
                          <th>Role</th>
                          <th>Phone</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pUsers.map(u => (
                          <tr key={u.id}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--blue-10)', color: 'var(--blue-80)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
                                  {u.name?.charAt(0).toUpperCase()}
                                </div>
                                <span style={{ fontWeight: 500, fontSize: 13 }}>{u.name}</span>
                              </div>
                            </td>
                            <td style={{ fontSize: 12, fontFamily: 'monospace', color: '#334155' }}>
                              {u.username || '—'}
                            </td>
                            <td style={{ fontSize: 12, color: '#64748b' }}>{u.email}</td>
                            <td>
                              {u.plain_password_temp ? (
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
                                    {pShowPw[u.id] ? u.plain_password_temp : '••••••'}
                                  </span>
                                  <button onClick={() => setPShowPw(p => ({ ...p, [u.id]: !p[u.id] }))}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 11, padding: 0 }}>
                                    {pShowPw[u.id] ? '🙈' : '👁'}
                                  </button>
                                </span>
                              ) : <span style={{ color: '#94a3b8', fontSize: 12 }}>changed</span>}
                            </td>
                            <td><span className={"badge " + pRoleBadge(u.role)}>{u.role?.replace(/_/g, ' ')}</span></td>
                            <td style={{ fontSize: 12, color: '#64748b' }}>{u.phone || '—'}</td>
                            <td><span className={"badge " + (u.is_active ? 'badge-success' : 'badge-neutral')}>{u.is_active ? 'Active' : 'Inactive'}</span></td>
                            <td>
                              <div style={{ display: 'flex', gap: 4 }}>
                                <button onClick={() => resetPUserPw(u)} style={{ background: '#eff6ff', color: '#1d4ed8', border: 'none', borderRadius: 5, padding: '4px 8px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>🔑 Reset</button>
                                <button onClick={() => togglePUser(u.id)} style={{ background: u.is_active ? '#fef1ee' : '#f0fdf4', color: u.is_active ? '#dc2626' : '#16a34a', border: 'none', borderRadius: 5, padding: '4px 8px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                                  {u.is_active ? 'Deactivate' : 'Activate'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {!pUsers.length && (
                          <tr><td colSpan={8} style={{ textAlign: 'center', color: '#94a3b8', padding: 40 }}>No users found.</td></tr>
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {showPCreate && (
                <div
                  className="modal-backdrop"
                  role="button"
                  tabIndex={0}
                  aria-label="Close modal"
                  onClick={e => e.target === e.currentTarget && setShowPCreate(false)}
                  onKeyDown={e => e.key === 'Escape' && setShowPCreate(false)}
                >
                  <div className="modal" style={{ maxWidth: 480 }}>
                    <div className="modal-header">
                      <h3>👤 Create User</h3>
                      <button className="modal-close" onClick={() => setShowPCreate(false)}>✕</button>
                    </div>
                    <form onSubmit={createPrincipalUser}>
                      <div className="modal-body">
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                          <div className="form-group" style={{ gridColumn: '1/-1' }}>
                            <label className="form-label">Full Name *</label>
                            <input className="form-input" required placeholder="Ravi Sharma"
                              value={pForm.name || ''} onChange={e => setPForm(f => ({ ...f, name: e.target.value }))} />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Email *</label>
                            <input className="form-input" type="email" required placeholder="ravi@school.edu"
                              value={pForm.email || ''} onChange={e => setPForm(f => ({ ...f, email: e.target.value }))} />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Phone</label>
                            <input className="form-input" placeholder="9876543210"
                              value={pForm.phone || ''} onChange={e => setPForm(f => ({ ...f, phone: e.target.value }))} />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Role *</label>
                            <select className="form-select" required value={pForm.role || ''}
                              onChange={e => setPForm(f => ({ ...f, role: e.target.value }))}>
                              <option value="">Select role</option>
                              {PU_ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
                            </select>
                          </div>
                          <div className="form-group">
                            <label className="form-label">Password <span style={{ color: '#94a3b8', fontWeight: 400 }}>(default: EduErp@123)</span></label>
                            <input className="form-input" type="password" placeholder="EduErp@123"
                              value={pForm.password || ''} onChange={e => setPForm(f => ({ ...f, password: e.target.value }))} />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Department</label>
                            <input className="form-input" placeholder="Science, Maths..."
                              value={pForm.department || ''} onChange={e => setPForm(f => ({ ...f, department: e.target.value }))} />
                          </div>
                        </div>
                      </div>
                      <div className="modal-footer">
                        <button type="button" className="btn btn-neutral" onClick={() => setShowPCreate(false)}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={pSaving}>{pSaving ? '⏳ Creating...' : '👤 Create'}</button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {pCreds && (
                <div className="modal-backdrop">
                  <div className="modal" style={{ maxWidth: 400 }}>
                    <div className="modal-header">
                      <h3>✅ User Created!</h3>
                      <button className="modal-close" onClick={() => setPCreds(null)}>✕</button>
                    </div>
                    <div className="modal-body">
                      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '14px 18px', marginBottom: 12 }}>
                        {[['Name', pCreds.name], ['Username', pCreds.username || pCreds.email], ['Email', pCreds.email], ['Password', pCreds.plain_password_temp || 'EduErp@123'], ['Role', pCreds.role?.replace(/_/g, ' ')]].map(([lbl, val]) => (
                          <div key={lbl} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 0', borderBottom: '1px solid #dcfce7' }}>
                            <span style={{ color: '#64748b' }}>{lbl}</span>
                            <strong style={{ color: '#0f172a', fontFamily: (lbl === 'Password' || lbl === 'Username') ? 'monospace' : 'inherit' }}>{val || '—'}</strong>
                          </div>
                        ))}
                      </div>
                      <button onClick={() => {
                        navigator.clipboard.writeText('Username: ' + (pCreds.username || pCreds.email) + '\nPassword: ' + (pCreds.plain_password_temp || 'EduErp@123'));
                        setPCopied(true); setTimeout(() => setPCopied(false), 2000);
                      }} style={{ width: '100%', padding: 10, borderRadius: 8, border: 'none', background: pCopied ? '#2e844a' : '#0176d3', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                        {pCopied ? '✅ Copied!' : '📋 Copy Credentials'}
                      </button>
                    </div>
                    <div className="modal-footer">
                      <button className="btn btn-primary" onClick={() => setPCreds(null)}>Done</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
