import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api     from '../../api/axios';
import toast   from 'react-hot-toast';

export default function LibraryMembers() {
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(localStorage.getItem('ederp_theme') === 'dark');

  const [members, setMembers]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  // ── Enroll new member ──
  const [showEnroll, setShowEnroll]   = useState(false);
  const [enrollType, setEnrollType]   = useState('STUDENT');
  const [enrollSearch, setEnrollSearch] = useState('');
  const [enrollResults, setEnrollResults] = useState([]);
  const [enrolling, setEnrolling]     = useState(false);

  // ── Member detail drawer ──
  const [classes, setClasses] = useState([]);
  const [enrollClassId, setEnrollClassId] = useState('');
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    api.get('/principal/classes').then(r => setClasses(r.data || [])).catch(() => {});
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (typeFilter) params.set('member_type', typeFilter);
    api.get('/library/members?' + params.toString())
      .then(r => setMembers(r.data || []))
      .catch(() => toast.error('Failed to load library members'))
      .finally(() => setLoading(false));
  }, [search, typeFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!enrollSearch.trim() && !enrollClassId && enrollType === 'STUDENT') {
      setEnrollResults([]);
      return;
    }
    if (!enrollSearch.trim() && enrollType === 'TEACHER') {
      setEnrollResults([]);
      return;
    }
    const t = setTimeout(() => {
      const params = new URLSearchParams();
      if (enrollSearch.trim()) params.set('search', enrollSearch.trim());
      if (enrollType === 'STUDENT' && enrollClassId) params.set('class_id', enrollClassId);
      params.set('type', enrollType);
      api.get(`/library/members/search-eligible?${params.toString()}`)
        .then(r => setEnrollResults(r.data || []))
        .catch(() => setEnrollResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [enrollSearch, enrollClassId, enrollType]);

  async function handleEnroll(userItem) {
    if (userItem.is_member) { toast.error('User is already an enrolled library member'); return; }
    setEnrolling(true);
    try {
      await api.post('/library/members', { user_id: userItem.user_id, member_type: enrollType });
      toast.success(`${userItem.name} enrolled as library member`);
      setEnrollSearch('');
      setEnrollResults([]);
      setShowEnroll(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to enroll member');
    }
    setEnrolling(false);
  }

  async function toggleStatus(member) {
    const newStatus = member.status === 'ACTIVE' ? 'BLOCKED' : 'ACTIVE';
    try {
      await api.patch(`/library/members/${member.id}`, { status: newStatus });
      toast.success(`Member ${newStatus.toLowerCase()}`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update member');
    }
  }

  async function openDetail(member) {
    try {
      const r = await api.get(`/library/members/${member.id}/history`);
      setDetail(r.data);
    } catch {
      toast.error('Failed to load issue history');
    }
  }

  const cardStyle = {
    background: darkMode ? '#1e293b' : '#fff',
    border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
    borderRadius: 12, padding: 18,
  };
  const inputStyle = {
    width: '100%', padding: '9px 12px', fontSize: 13,
    border: '1px solid #e2e8f0', borderRadius: 8, outline: 'none', boxSizing: 'border-box',
  };

  const STATUS_COLORS = {
    ACTIVE: { bg: '#f0fdf4', color: '#16a34a' },
    BLOCKED: { bg: '#fef2f2', color: '#dc2626' },
    SUSPENDED: { bg: '#fef3c7', color: '#d97706' },
  };

  return (
    <div className={`app-shell${darkMode ? ' theme-dark' : ''}`}>
      <Sidebar darkMode={darkMode} />
      <div className="main-content">
        <Navbar title="Library Members" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />

        <div className="page-body">
          {/* Toolbar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search name or card number..." style={{ ...inputStyle, width: 260 }} />
              <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
                style={{ padding: '9px 12px', fontSize: 13, border: '1px solid #e2e8f0', borderRadius: 8 }}>
                <option value="">All Types</option>
                <option value="STUDENT">Students</option>
                <option value="TEACHER">Teachers</option>
              </select>
            </div>
            <button onClick={() => setShowEnroll(true)} style={{
              background: '#0176d3', color: '#fff', border: 'none', borderRadius: 8,
              padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>
              + Enroll Member
            </button>
          </div>

          {/* Table */}
          <div style={cardStyle}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Loading...</div>
            ) : members.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>No library members found</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, textAlign: 'left' }}>
                    <th style={{ padding: '8px 6px', color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>CARD #</th>
                    <th style={{ padding: '8px 6px', color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>NAME</th>
                    <th style={{ padding: '8px 6px', color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>TYPE</th>
                    <th style={{ padding: '8px 6px', color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>ISSUED</th>
                    <th style={{ padding: '8px 6px', color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>PENDING FINE</th>
                    <th style={{ padding: '8px 6px', color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>STATUS</th>
                    <th style={{ padding: '8px 6px', color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map(m => (
                    <tr key={m.id} style={{ borderBottom: `1px solid ${darkMode ? '#334155' : '#f1f5f9'}` }}>
                      <td style={{ padding: '10px 6px', color: darkMode ? '#f1f5f9' : '#0f172a' }}>{m.card_number}</td>
                      <td style={{ padding: '10px 6px', color: darkMode ? '#f1f5f9' : '#0f172a', fontWeight: 600 }}>{m.name}</td>
                      <td style={{ padding: '10px 6px', color: '#64748b' }}>{m.member_type}</td>
                      <td style={{ padding: '10px 6px', color: '#64748b' }}>{m.current_issues}</td>
                      <td style={{ padding: '10px 6px', color: m.pending_fine > 0 ? '#dc2626' : '#64748b', fontWeight: m.pending_fine > 0 ? 700 : 400 }}>
                        ₹{m.pending_fine}
                      </td>
                      <td style={{ padding: '10px 6px' }}>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                          background: STATUS_COLORS[m.status]?.bg, color: STATUS_COLORS[m.status]?.color,
                        }}>
                          {m.status}
                        </span>
                      </td>
                      <td style={{ padding: '10px 6px' }}>
                        <button onClick={() => openDetail(m)} style={{
                          background: '#e0f2fe', color: '#0176d3', border: 'none', borderRadius: 6,
                          padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', marginRight: 6,
                        }}>
                          History
                        </button>
                        <button onClick={() => toggleStatus(m)} style={{
                          background: m.status === 'ACTIVE' ? '#fef2f2' : '#f0fdf4',
                          color: m.status === 'ACTIVE' ? '#dc2626' : '#16a34a',
                          border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                        }}>
                          {m.status === 'ACTIVE' ? 'Block' : 'Unblock'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* ── Enroll Modal ── */}
      {showEnroll && (
        <div className="modal-backdrop" role="button" tabIndex={0} aria-label="Close modal" onClick={e => e.target === e.currentTarget && setShowEnroll(false)} onKeyDown={e => e.key === 'Escape' && setShowEnroll(false)}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3>Enroll Library Member</h3>
              <button className="modal-close" onClick={() => setShowEnroll(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                {['STUDENT', 'TEACHER'].map(t => (
                  <button key={t} onClick={() => { setEnrollType(t); setEnrollSearch(''); setEnrollClassId(''); setEnrollResults([]); }}
                    style={{
                      flex: 1, padding: '8px 0', fontSize: 12, fontWeight: 700, borderRadius: 6,
                      border: 'none', cursor: 'pointer',
                      background: enrollType === t ? '#0176d3' : '#f1f5f9',
                      color: enrollType === t ? '#fff' : '#64748b',
                    }}>
                    {t === 'STUDENT' ? 'Student' : 'Teacher'}
                  </button>
                ))}
              </div>

              {enrollType === 'STUDENT' && (
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 4 }}>
                    FILTER BY CLASS & SECTION
                  </label>
                  <select
                    className="form-input"
                    value={enrollClassId}
                    onChange={e => setEnrollClassId(e.target.value)}
                    style={{ marginBottom: 8 }}
                  >
                    <option value="">-- All Classes (or select class) --</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.section ? `(${c.section})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <input
                value={enrollSearch}
                onChange={e => setEnrollSearch(e.target.value)}
                placeholder={enrollType === 'STUDENT' ? "Search by name, roll no, or admission no..." : "Search teacher by name or email..."}
                className="form-input"
              />

              <div style={{ marginTop: 10, maxHeight: 280, overflowY: 'auto' }}>
                {enrollResults.length === 0 ? (
                  <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: 24 }}>
                    {enrollClassId || enrollSearch ? 'No eligible records found' : 'Select class or search by name / admission number'}
                  </div>
                ) : enrollResults.map(u => (
                  <div key={u.user_id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 8px', borderBottom: '1px solid #f1f5f9',
                  }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{u.name}</div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                        {u.class_name ? <span style={{ fontWeight: 600, color: '#0176d3' }}>{u.class_name}</span> : null}
                        {u.roll_number && u.roll_number !== '—' ? <span> · Roll: {u.roll_number}</span> : null}
                        {u.admission_no && u.admission_no !== '—' ? <span> · Adm: {u.admission_no}</span> : null}
                        {(!u.roll_number || u.roll_number === '—') && u.email ? <span> · {u.email}</span> : null}
                      </div>
                    </div>
                    <button
                      disabled={u.is_member || enrolling}
                      onClick={() => handleEnroll(u)}
                      style={{
                        background: u.is_member ? '#f1f5f9' : '#0176d3',
                        color: u.is_member ? '#94a3b8' : '#fff',
                        border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 11, fontWeight: 700,
                        cursor: u.is_member ? 'not-allowed' : 'pointer',
                      }}>
                      {u.is_member ? 'Already Member' : 'Enroll'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Member History Drawer ── */}
      {detail && (
        <div className="modal-backdrop" role="button" tabIndex={0} aria-label="Close modal" onClick={e => e.target === e.currentTarget && setDetail(null)} onKeyDown={e => e.key === 'Escape' && setDetail(null)}>
          <div className="modal" style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <h3>{detail.member.name} — History</h3>
              <button className="modal-close" onClick={() => setDetail(null)}>✕</button>
            </div>
            <div className="modal-body">
              <h5 style={{ fontSize: 13, margin: '0 0 8px' }}>📚 Issue History</h5>
              {detail.issues.length === 0 ? (
                <p style={{ fontSize: 12, color: '#94a3b8' }}>No issue history found</p>
              ) : (
                detail.issues.map(i => (
                  <div key={i.id} style={{ fontSize: 12, padding: '6px 0', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{i.book_title}</span>
                    <span style={{ color: i.status === 'RETURNED' ? '#16a34a' : i.status === 'LOST' ? '#dc2626' : '#0176d3' }}>
                      {i.status}
                    </span>
                  </div>
                ))
              )}

              <h5 style={{ fontSize: 13, margin: '16px 0 8px' }}>💰 Fine History</h5>
              {detail.fines.length === 0 ? (
                <p style={{ fontSize: 12, color: '#94a3b8' }}>No fine history found</p>
              ) : (
                detail.fines.map(f => (
                  <div key={f.id} style={{ fontSize: 12, padding: '6px 0', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{f.reason} — ₹{f.amount}</span>
                    <span style={{ color: f.status === 'PAID' ? '#16a34a' : f.status === 'WAIVED' ? '#64748b' : '#dc2626' }}>
                      {f.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
