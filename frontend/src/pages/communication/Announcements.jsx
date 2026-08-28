import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { expandRole } from '../../utils/roleEquivalence';

const AUDIENCE_LABEL = { ALL: 'Everyone', TEACHERS: 'Teachers', STUDENTS: 'Students', PARENTS: 'Parents', STAFF: 'Staff' };
const CAN_CREATE_ROLES = ['SUPER_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL'];

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60)    return 'Just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function Announcements({ initialShowForm }) {
  const location = useLocation();
  const [darkMode] = useState(() => localStorage.getItem('ederp_theme') === 'dark');
  const { user } = useAuth();
  const canCreate = expandRole(user?.role).some(r => CAN_CREATE_ROLES.includes(r));
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const shouldOpenForm = Boolean(
    initialShowForm ||
    (location.search && location.search.includes('create=true')) ||
    (location.pathname && location.pathname.endsWith('/create'))
  );

  const [list,     setList]     = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(shouldOpenForm);
  const [schools,  setSchools]  = useState([]);
  const [form, setForm] = useState({ title: '', body: '', audience: 'ALL', priority: 'MEDIUM', is_pinned: false, target_school_id: 'ALL' });

  useEffect(() => {
    if (shouldOpenForm) {
      setShowForm(true);
    }
  }, [shouldOpenForm]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    api.get('/admin/schools').then(r => setSchools(r.data || [])).catch(() => setSchools([]));
  }, [isSuperAdmin]);

  const fetchList = useCallback(() => {
    setLoading(true);
    api.get('/support/announcements', { params: { per_page: 30 } })
      .then(r => setList(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchList(); }, [fetchList]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) return;
    const payload = { ...form };
    if (isSuperAdmin) {
      payload.target_school_id = form.target_school_id === 'ALL' ? null : form.target_school_id;
    } else {
      delete payload.target_school_id;
    }
    try {
      await api.post('/support/announcements', payload);
      setShowForm(false);
      setForm({ title: '', body: '', audience: 'ALL', priority: 'MEDIUM', is_pinned: false, target_school_id: 'ALL' });
      fetchList();
    } catch (err) {
      alert(err.response?.data?.error || 'Announcement create nahi hua');
    }
  };

  const togglePin = async (id) => {
    await api.post(`/support/announcements/${id}/pin`).catch(() => {});
    fetchList();
  };

  const remove = async (id) => {
    if (!window.confirm('Yeh announcement remove karna hai?')) return;
    await api.delete(`/support/announcements/${id}`).catch(() => {});
    fetchList();
  };

  const cardBg = { background: darkMode ? '#141b2d' : undefined, borderColor: darkMode ? '#1e293b' : undefined };
  const border = darkMode ? '#1e293b' : '#e2e8f0';
  const inputStyle = {
    width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13,
    border: `1px solid ${border}`, background: darkMode ? '#0f172a' : '#fff',
    color: darkMode ? '#e2e8f0' : '#0f172a',
  };

  const PRIORITY_COLOR = { LOW: '#64748b', MEDIUM: '#ca8a04', HIGH: '#ea580c', CRITICAL: '#dc2626' };

  return (
    <div className={`app-shell${darkMode ? ' theme-dark' : ''}`}>
      <Sidebar darkMode={darkMode} />
      <div className="main-content">
        <Navbar title="Announcements" darkMode={darkMode} onToggleDark={() => {}} />
        <div className="page-body">

          <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h2 className="page-title">Announcements</h2>
              <p className="page-subtitle">School-wide updates aur notices</p>
            </div>
            {canCreate && (
              <button className="btn btn-primary btn-sm" onClick={() => setShowForm(s => !s)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <i className="ti ti-speakerphone" style={{ fontSize: 14 }} aria-hidden="true" /> {showForm ? 'Cancel' : 'New Announcement'}
              </button>
            )}
          </div>

          {showForm && (
            <div className="card" style={{ marginBottom: 20, maxWidth: 640, ...cardBg }}>
              <form onSubmit={submit} style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
                {isSuperAdmin && (
                  <select className="form-select" style={inputStyle} value={form.target_school_id}
                    onChange={e => setForm(f => ({ ...f, target_school_id: e.target.value }))}>
                    <option value="ALL">🌐 All Schools (platform-wide)</option>
                    {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                )}
                <input style={inputStyle} placeholder="Title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                <textarea style={{ ...inputStyle, minHeight: 90, fontFamily: 'inherit', resize: 'vertical' }}
                  placeholder="Message likho..." value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <select className="form-select" style={inputStyle} value={form.audience} onChange={e => setForm(f => ({ ...f, audience: e.target.value }))}>
                    {Object.entries(AUDIENCE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select>
                  <select className="form-select" style={inputStyle} value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                    <option value="LOW">Low</option><option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option><option value="CRITICAL">Critical</option>
                  </select>
                </div>
                <label style={{ fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6, color: darkMode ? '#cbd5e1' : '#334155' }}>
                  <input type="checkbox" checked={form.is_pinned} onChange={e => setForm(f => ({ ...f, is_pinned: e.target.checked }))} />
                  Pin to top
                </label>
                <button type="submit" className="btn btn-primary">Publish</button>
              </form>
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 13 }}>Loading...</div>
          ) : list.length === 0 ? (
            <div className="card" style={{ ...cardBg, padding: 40, textAlign: 'center' }}>
              <i className="ti ti-speakerphone-off" style={{ fontSize: 32, color: darkMode ? '#475569' : '#cbd5e1', display: 'block', marginBottom: 10 }} aria-hidden="true" />
              <div style={{ fontSize: 13, color: darkMode ? '#94a3b8' : '#64748b' }}>Koi announcement nahi hai abhi</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {list.map(a => (
                <div key={a.id} className="card" style={{ ...cardBg, padding: 16, borderLeft: `4px solid ${PRIORITY_COLOR[a.priority] || '#4f46e5'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {a.is_pinned && <i className="ti ti-pin-filled" style={{ fontSize: 13, color: '#d97706' }} aria-hidden="true" />}
                      <span style={{ fontSize: 14, fontWeight: 700, color: darkMode ? '#f1f5f9' : '#0f172a' }}>{a.title}</span>
                    </div>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {a.is_platform && (
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '1px 8px', borderRadius: 20,
                          background: '#ede9fe', color: '#6d28d9',
                        }}>🌐 Platform</span>
                      )}
                      {isSuperAdmin && !a.is_platform && a.school_name && (
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '1px 8px', borderRadius: 20,
                          background: darkMode ? '#1e293b' : '#f1f5f9', color: darkMode ? '#94a3b8' : '#64748b',
                        }}>{a.school_name}</span>
                      )}
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '1px 8px', borderRadius: 20,
                        background: darkMode ? '#1e293b' : '#f1f5f9', color: darkMode ? '#94a3b8' : '#64748b',
                      }}>{AUDIENCE_LABEL[a.audience] || a.audience}</span>
                    </span>
                  </div>
                  <p style={{ fontSize: 13, color: darkMode ? '#cbd5e1' : '#334155', margin: '8px 0', lineHeight: 1.5 }}>{a.body}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: darkMode ? '#64748b' : '#94a3b8' }}>
                      {a.creator_name} · {timeAgo(a.created_at)}
                    </span>
                    {canCreate && (
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button onClick={() => togglePin(a.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#4f46e5' }}>
                          {a.is_pinned ? 'Unpin' : 'Pin'}
                        </button>
                        <button onClick={() => remove(a.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#dc2626' }}>
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>

      <style>{`
        .theme-dark { background: #0b1220; }
        .theme-dark .main-content { background: #0b1220; }
        .theme-dark .card { background: #141b2d !important; border-color: #1e293b !important; }
        .theme-dark .page-title { color: #f1f5f9 !important; }
        .theme-dark .page-subtitle { color: #94a3b8 !important; }
      `}</style>
    </div>
  );
}
