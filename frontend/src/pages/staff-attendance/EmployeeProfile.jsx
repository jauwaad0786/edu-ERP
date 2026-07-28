// FULL FILE — src/pages/staff-attendance/EmployeeProfile.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api     from '../../api/axios';
import toast   from 'react-hot-toast';

const TABS = ['Daily History', 'Regularization History'];

export default function EmployeeProfile() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(localStorage.getItem('ederp_theme') === 'dark');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (fromDate) params.set('from_date', fromDate);
    if (toDate) params.set('to_date', toDate);
    api.get(`/staff-attendance/employee/${userId}/history?${params.toString()}`)
      .then((r) => setData(r.data))
      .catch(() => toast.error('Profile load nahi hui'))
      .finally(() => setLoading(false));
  }, [userId, fromDate, toDate]);

  useEffect(() => { load(); }, [load]);

  // ── styles ──
  const bg     = darkMode ? '#0f172a' : '#f8fafc';
  const cardBg = darkMode ? '#1e293b' : '#fff';
  const border = darkMode ? '#334155' : '#e2e8f0';
  const text   = darkMode ? '#e2e8f0' : '#0f172a';
  const muted  = darkMode ? '#94a3b8' : '#64748b';
  const card = { background: cardBg, border: `1px solid ${border}`, borderRadius: 14, padding: 18 };
  const th = { textAlign: 'left', padding: '10px 12px', fontSize: 11, color: muted, borderBottom: `1px solid ${border}`, position: 'sticky', top: 0, background: cardBg, whiteSpace: 'nowrap' };
  const td = { padding: '10px 12px', fontSize: 13, borderBottom: `1px solid ${border}`, color: text, whiteSpace: 'nowrap' };
  const input = { padding: '8px 12px', borderRadius: 8, border: `1px solid ${border}`, background: cardBg, color: text, fontSize: 13 };

  const statusBadge = (status) => {
    const map = {
      PRESENT: ['#dcfce7', '#166534'], LATE: ['#fef9c3', '#854d0e'],
      HALF_DAY: ['#fde68a', '#854d0e'], ABSENT: ['#fee2e2', '#991b1b'],
      MISSING_CHECKOUT: ['#fee2e2', '#991b1b'],
    };
    const [background, color] = map[status] || ['#e2e8f0', '#334155'];
    return <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, background, color }}>{status}</span>;
  };

  const approvalBadge = (status) => {
    const map = {
      APPROVED: ['#dcfce7', '#166534'], PENDING: ['#fef9c3', '#854d0e'],
      REJECTED: ['#fee2e2', '#991b1b'], NOT_REQUIRED: ['#e2e8f0', '#334155'],
    };
    const [background, color] = map[status] || ['#e2e8f0', '#334155'];
    return <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, background, color }}>{status?.replace('_', ' ')}</span>;
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: bg }}>
      <Sidebar darkMode={darkMode} />
      <div style={{ marginLeft: 232, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Navbar title="Employee Attendance Profile" darkMode={darkMode} onToggleDark={() => setDarkMode((d) => !d)} />

        <div style={{ padding: 24 }}>
          <button onClick={() => navigate(-1)} style={{
            background: 'transparent', border: `1px solid ${border}`, color: text,
            borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 13, marginBottom: 16,
          }}>← Back</button>

          {loading || !data ? (
            <div style={{ color: muted }}>Loading…</div>
          ) : (
            <>
              {/* HEADER CARD */}
              <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
                <img
                  src={data.employee.photo_url || 'https://via.placeholder.com/64'}
                  alt={data.employee.name}
                  style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: `1px solid ${border}` }}
                />
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: text }}>{data.employee.name}</div>
                  <div style={{ fontSize: 12, color: muted }}>
                    {data.employee.employee_id} · {data.employee.designation || data.employee.role}
                  </div>
                </div>
              </div>

              {/* DATE FILTER */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                <label style={{ fontSize: 12, color: muted }}>From</label>
                <input style={input} type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                <label style={{ fontSize: 12, color: muted }}>To</label>
                <input style={input} type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </div>

              {/* TABS */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: `1px solid ${border}` }}>
                {TABS.map((t, i) => (
                  <button key={t} onClick={() => setTab(i)} style={{
                    padding: '10px 18px', border: 'none', background: 'transparent', cursor: 'pointer',
                    fontSize: 13, fontWeight: 600, color: tab === i ? '#4f46e5' : muted,
                    borderBottom: tab === i ? '2px solid #4f46e5' : '2px solid transparent',
                  }}>{t}</button>
                ))}
              </div>

              {/* DAILY HISTORY */}
              {tab === 0 && (
                <div style={{ ...card, overflowX: 'auto', maxHeight: 520 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={th}>Date</th>
                        <th style={th}>Check In</th>
                        <th style={th}>Check Out</th>
                        <th style={th}>Working Hrs</th>
                        <th style={th}>Distance</th>
                        <th style={th}>GPS</th>
                        <th style={th}>Status</th>
                        <th style={th}>Approval</th>
                        <th style={th}>Regularized</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.daily_history.length === 0 && (
                        <tr><td style={td} colSpan={9}>Is range me koi record nahi mila.</td></tr>
                      )}
                      {data.daily_history.map((r) => (
                        <tr key={r.id}>
                          <td style={td}>{r.date}</td>
                          <td style={td}>{r.check_in_time ? new Date(r.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                          <td style={td}>{r.check_out_time ? new Date(r.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                          <td style={td}>{r.working_hours}h</td>
                          <td style={td}>{r.check_in_distance != null ? `${Math.round(r.check_in_distance)}m` : '—'}</td>
                          <td style={td}>{r.gps_status?.replace('_', ' ')}</td>
                          <td style={td}>{statusBadge(r.status)}</td>
                          <td style={td}>{approvalBadge(r.approval_status)}</td>
                          <td style={td}>{r.is_regularized ? '✅' : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* REGULARIZATION HISTORY */}
              {tab === 1 && (
                <div style={{ ...card, overflowX: 'auto', maxHeight: 520 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={th}>Date</th>
                        <th style={th}>Reason</th>
                        <th style={th}>Remarks</th>
                        <th style={th}>Requested Check In</th>
                        <th style={th}>Requested Check Out</th>
                        <th style={th}>Status</th>
                        <th style={th}>Submitted On</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.regularization_history.length === 0 && (
                        <tr><td style={td} colSpan={7}>Koi regularization request nahi mili.</td></tr>
                      )}
                      {data.regularization_history.map((r) => (
                        <tr key={r.id}>
                          <td style={td}>{r.date}</td>
                          <td style={td}>{r.reason_type?.replace('_', ' ')}</td>
                          <td style={td}>{r.reason_text || '—'}</td>
                          <td style={td}>{r.requested_check_in ? new Date(r.requested_check_in).toLocaleString() : '—'}</td>
                          <td style={td}>{r.requested_check_out ? new Date(r.requested_check_out).toLocaleString() : '—'}</td>
                          <td style={td}>{approvalBadge(r.status)}</td>
                          <td style={td}>{r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
