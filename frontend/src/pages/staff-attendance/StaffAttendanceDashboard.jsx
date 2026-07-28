// FULL FILE — src/pages/staff-attendance/StaffAttendanceDashboard.jsx
import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api     from '../../api/axios';
import toast   from 'react-hot-toast';

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function StaffAttendanceDashboard() {
  const [darkMode] = useState(localStorage.getItem('ederp_theme') === 'dark');

  const [date, setDate] = useState(todayStr());
  const [dash, setDash] = useState(null);
  const [loadingDash, setLoadingDash] = useState(true);

  const [pending, setPending] = useState([]);
  const [approved, setApproved] = useState([]);
  const [regularizations, setRegularizations] = useState([]);
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);

  const loadAll = useCallback(() => {
    setLoadingDash(true);
    Promise.all([
      api.get(`/staff-attendance/dashboard?date=${date}`),
      api.get(`/staff-attendance/today?date=${date}&approval_status=PENDING&per_page=50`),
      api.get(`/staff-attendance/today?date=${date}&approval_status=APPROVED&per_page=50`),
      api.get(`/staff-attendance/regularization?status=PENDING`),
    ])
      .then(([d, p, a, r]) => {
        setDash(d.data);
        setPending(p.data.items);
        setApproved(a.data.items);
        setRegularizations(r.data);
      })
      .catch(() => toast.error('Dashboard load nahi hua'))
      .finally(() => setLoadingDash(false));
  }, [date]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const toggleSelect = (id) => {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  const approveOne = async (id) => {
    try {
      await api.post(`/staff-attendance/approve/${id}`);
      toast.success('Approved');
      loadAll();
    } catch {
      toast.error('Approve fail ho gaya');
    }
  };

  const rejectOne = async (id) => {
    const reason = window.prompt('Reject reason (optional):') || '';
    try {
      await api.post(`/staff-attendance/reject/${id}`, { reason });
      toast.success('Rejected');
      loadAll();
    } catch {
      toast.error('Reject fail ho gaya');
    }
  };

  const bulkAction = async (type) => {
    setBusy(true);
    try {
      const ids = selected.length ? selected : undefined;
      await api.post(`/staff-attendance/${type}-bulk`, { ids, date });
      toast.success(type === 'approve' ? 'Sab approve ho gaye' : 'Sab reject ho gaye');
      setSelected([]);
      loadAll();
    } catch {
      toast.error('Action fail ho gaya');
    } finally {
      setBusy(false);
    }
  };

  const reviewRegularization = async (id, approve) => {
    try {
      await api.post(`/staff-attendance/regularization/${id}/review`, { approve });
      toast.success(approve ? 'Regularization approved' : 'Regularization rejected');
      loadAll();
    } catch {
      toast.error('Action fail ho gaya');
    }
  };

  // ── styles ──
  const bg      = darkMode ? '#0f172a' : '#f8fafc';
  const cardBg  = darkMode ? '#1e293b' : '#fff';
  const border  = darkMode ? '#334155' : '#e2e8f0';
  const text    = darkMode ? '#e2e8f0' : '#0f172a';
  const muted   = darkMode ? '#94a3b8' : '#64748b';

  const card = { background: cardBg, border: `1px solid ${border}`, borderRadius: 14, padding: 18 };
  const th = { textAlign: 'left', padding: '10px 12px', fontSize: 12, color: muted, borderBottom: `1px solid ${border}`, position: 'sticky', top: 0, background: cardBg };
  const td = { padding: '10px 12px', fontSize: 13, borderBottom: `1px solid ${border}`, color: text };

  const KPI_CARDS = dash ? [
    { label: 'Total Employees',   value: dash.total_employees,   icon: '👥', color: '#4f46e5' },
    { label: 'Present Today',     value: dash.present_today,     icon: '✅', color: '#16a34a', sub: `${dash.attendance_percent}%` },
    { label: 'Late Today',        value: dash.late_today,        icon: '⏰', color: '#d97706' },
    { label: 'Absent Today',      value: dash.absent_today,      icon: '❌', color: '#dc2626' },
    { label: 'Pending Approval',  value: dash.pending_approval,  icon: '🕓', color: '#0891b2' },
    { label: 'Regularization',    value: dash.regularization_requests, icon: '📝', color: '#7c3aed' },
    { label: 'Avg Check In',      value: dash.average_check_in || '—', icon: '🕗', color: '#0176d3' },
    { label: 'Avg Working Hrs',   value: dash.average_working_hours, icon: '⏱️', color: '#0f766e' },
  ] : [];

  const filteredApproved = approved.filter((r) =>
    !search || r.employee_name?.toLowerCase().includes(search.toLowerCase()) || r.employee_id?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: bg }}>
      <Sidebar />
      <div style={{ flex: 1 }}>
        <Navbar />
        <div style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <h2 style={{ color: text, margin: 0 }}>Staff Attendance</h2>
            <input
              type="date" value={date} onChange={(e) => setDate(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${border}`, background: cardBg, color: text }}
            />
          </div>

          {loadingDash ? (
            <div style={{ color: muted }}>Loading…</div>
          ) : (
            <>
              {/* KPI CARDS */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 24 }}>
                {KPI_CARDS.map((c) => (
                  <div key={c.label} style={card}>
                    <div style={{ fontSize: 22 }}>{c.icon}</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: text, marginTop: 6 }}>{c.value}</div>
                    <div style={{ fontSize: 12, color: muted }}>{c.label}</div>
                    {c.sub && <div style={{ fontSize: 11, color: c.color, marginTop: 2 }}>{c.sub}</div>}
                  </div>
                ))}
              </div>

              {/* PENDING REQUESTS */}
              <div style={{ ...card, marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                  <h3 style={{ margin: 0, color: text, fontSize: 16 }}>
                    Attendance Requests (Today) <span style={{ color: muted, fontWeight: 400 }}>({pending.length})</span>
                  </h3>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button disabled={busy} onClick={() => bulkAction('approve')}
                      style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: 'pointer' }}>
                      {selected.length ? `Approve Selected (${selected.length})` : 'Approve All'}
                    </button>
                    <button disabled={busy} onClick={() => bulkAction('reject')}
                      style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: 'pointer' }}>
                      {selected.length ? `Reject Selected (${selected.length})` : 'Reject All'}
                    </button>
                  </div>
                </div>

                <div style={{ overflowX: 'auto', maxHeight: 400, overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={th}></th>
                        <th style={th}>Employee</th>
                        <th style={th}>Role</th>
                        <th style={th}>Check In</th>
                        <th style={th}>Distance</th>
                        <th style={th}>GPS</th>
                        <th style={th}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pending.length === 0 && (
                        <tr><td style={td} colSpan={7}>Koi pending request nahi hai.</td></tr>
                      )}
                      {pending.map((r) => (
                        <tr key={r.id}>
                          <td style={td}>
                            <input type="checkbox" checked={selected.includes(r.id)} onChange={() => toggleSelect(r.id)} />
                          </td>
                          <td style={td}>
                            <div style={{ fontWeight: 600 }}>{r.employee_name}</div>
                            <div style={{ fontSize: 11, color: muted }}>{r.employee_id}</div>
                          </td>
                          <td style={td}>{r.designation || r.role}</td>
                          <td style={td}>{r.check_in_time ? new Date(r.check_in_time).toLocaleTimeString() : '—'}</td>
                          <td style={td}>{r.check_in_distance != null ? `${Math.round(r.check_in_distance)}m` : '—'}</td>
                          <td style={td}>
                            <span style={{
                              padding: '2px 8px', borderRadius: 6, fontSize: 11,
                              background: r.gps_status === 'INSIDE_CAMPUS' ? '#dcfce7' : r.gps_status === 'NEAR_BOUNDARY' ? '#fef9c3' : '#fee2e2',
                              color: r.gps_status === 'INSIDE_CAMPUS' ? '#166534' : r.gps_status === 'NEAR_BOUNDARY' ? '#854d0e' : '#991b1b',
                            }}>
                              {r.gps_status?.replace('_', ' ')}
                            </span>
                          </td>
                          <td style={td}>
                            <button onClick={() => approveOne(r.id)} style={{ marginRight: 6, background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>✓</button>
                            <button onClick={() => rejectOne(r.id)} style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>✕</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20 }}>
                {/* APPROVED TODAY */}
                <div style={card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                    <h3 style={{ margin: 0, color: text, fontSize: 16 }}>Today's Attendance (Approved)</h3>
                    <input
                      placeholder="Search by name, ID..." value={search} onChange={(e) => setSearch(e.target.value)}
                      style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${border}`, background: cardBg, color: text }}
                    />
                  </div>
                  <div style={{ overflowX: 'auto', maxHeight: 420, overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={th}>Employee</th>
                          <th style={th}>Role</th>
                          <th style={th}>In</th>
                          <th style={th}>Out</th>
                          <th style={th}>Hrs</th>
                          <th style={th}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredApproved.length === 0 && (
                          <tr><td style={td} colSpan={6}>Koi approved record nahi mila.</td></tr>
                        )}
                        {filteredApproved.map((r) => (
                          <tr key={r.id}>
                            <td style={td}>
                              <div style={{ fontWeight: 600 }}>{r.employee_name}</div>
                              <div style={{ fontSize: 11, color: muted }}>{r.employee_id}</div>
                            </td>
                            <td style={td}>{r.designation || r.role}</td>
                            <td style={td}>{r.check_in_time ? new Date(r.check_in_time).toLocaleTimeString() : '—'}</td>
                            <td style={td}>{r.check_out_time ? new Date(r.check_out_time).toLocaleTimeString() : '—'}</td>
                            <td style={td}>{r.working_hours}h</td>
                            <td style={td}>
                              <span style={{
                                padding: '2px 8px', borderRadius: 6, fontSize: 11,
                                background: r.status === 'LATE' ? '#fef9c3' : r.status === 'HALF_DAY' ? '#fde68a' : '#dcfce7',
                                color: r.status === 'LATE' ? '#854d0e' : '#166534',
                              }}>{r.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* REGULARIZATION */}
                <div style={card}>
                  <h3 style={{ margin: '0 0 12px', color: text, fontSize: 16 }}>Regularization Requests</h3>
                  <div style={{ maxHeight: 420, overflowY: 'auto' }}>
                    {regularizations.length === 0 && <div style={{ color: muted, fontSize: 13 }}>Koi pending regularization nahi hai.</div>}
                    {regularizations.map((r) => (
                      <div key={r.id} style={{ padding: '10px 0', borderBottom: `1px solid ${border}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <div>
                            <div style={{ fontWeight: 600, color: text, fontSize: 13 }}>{r.employee_name}</div>
                            <div style={{ fontSize: 11, color: muted }}>{r.reason_type?.replace('_', ' ')} — {r.date}</div>
                            {r.reason_text && <div style={{ fontSize: 12, color: muted, marginTop: 2 }}>{r.reason_text}</div>}
                          </div>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                            <button onClick={() => reviewRegularization(r.id, true)} style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>✓</button>
                            <button onClick={() => reviewRegularization(r.id, false)} style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>✕</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
