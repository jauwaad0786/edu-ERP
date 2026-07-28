// FULL FILE — src/pages/staff-attendance/MonthlySummary.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api     from '../../api/axios';
import toast   from 'react-hot-toast';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function MonthlySummary() {
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(localStorage.getItem('ederp_theme') === 'dark');

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api.get(`/staff-attendance/monthly-summary?month=${month}&year=${year}`)
      .then((r) => setRows(r.data))
      .catch(() => toast.error('Monthly summary load nahi hui'))
      .finally(() => setLoading(false));
  }, [month, year]);

  useEffect(() => { load(); }, [load]);

  const filtered = rows.filter((r) => {
    const matchSearch = !search
      || r.employee_name?.toLowerCase().includes(search.toLowerCase())
      || r.employee_id?.toLowerCase().includes(search.toLowerCase());
    const matchRole = !roleFilter || r.role === roleFilter;
    return matchSearch && matchRole;
  });

  const roles = [...new Set(rows.map((r) => r.role).filter(Boolean))];

  const exportCsv = () => {
    const headers = [
      'Employee ID', 'Name', 'Role', 'Working Days', 'Present', 'Absent', 'Late',
      'Half Day', 'Paid Leave', 'Unpaid Leave', 'Attendance %', 'Working Hours',
      'Overtime Hours', 'Regularization Count', 'Salary Impact',
    ];
    const csvRows = filtered.map((r) => [
      r.employee_id, r.employee_name, r.role, r.working_days, r.present_days,
      r.absent_days, r.late_days, r.half_days, r.paid_leave_days, r.unpaid_leave_days,
      r.attendance_percent, r.working_hours, r.overtime_hours, r.regularization_count,
      r.salary_impact,
    ]);
    const csv = [headers, ...csvRows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Attendance_Summary_${MONTHS[month - 1]}_${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── styles ──
  const bg     = darkMode ? '#0f172a' : '#f8fafc';
  const cardBg = darkMode ? '#1e293b' : '#fff';
  const border = darkMode ? '#334155' : '#e2e8f0';
  const text   = darkMode ? '#e2e8f0' : '#0f172a';
  const muted  = darkMode ? '#94a3b8' : '#64748b';
  const card = { background: cardBg, border: `1px solid ${border}`, borderRadius: 14, padding: 18 };
  const th = { textAlign: 'left', padding: '10px 12px', fontSize: 11, color: muted, borderBottom: `1px solid ${border}`, position: 'sticky', top: 0, background: cardBg, whiteSpace: 'nowrap' };
  const td = { padding: '10px 12px', fontSize: 13, borderBottom: `1px solid ${border}`, color: text, whiteSpace: 'nowrap' };
  const selectStyle = { padding: '8px 12px', borderRadius: 8, border: `1px solid ${border}`, background: cardBg, color: text, fontSize: 13 };

  const pctColor = (pct) => (pct >= 90 ? '#16a34a' : pct >= 75 ? '#d97706' : '#dc2626');

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: bg }}>
      <Sidebar darkMode={darkMode} />
      <div style={{ marginLeft: 232, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Navbar title="Monthly Attendance Summary" darkMode={darkMode} onToggleDark={() => setDarkMode((d) => !d)} />

        <div style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <h2 style={{ color: text, margin: 0 }}>Monthly Attendance Summary</h2>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <select style={selectStyle} value={month} onChange={(e) => setMonth(parseInt(e.target.value))}>
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
              <select style={selectStyle} value={year} onChange={(e) => setYear(parseInt(e.target.value))}>
                {[year - 1, year, year + 1].map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
              <button onClick={exportCsv} style={{
                background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8,
                padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              }}>⬇ Export CSV</button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <input
              placeholder="Search by name or employee ID..." value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ ...selectStyle, flex: 1, minWidth: 220 }}
            />
            <select style={selectStyle} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              <option value="">All Roles</option>
              {roles.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div style={{ ...card, marginBottom: 16, display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 13, color: muted }}>
            <div><b style={{ color: text }}>{filtered.length}</b> employees shown</div>
            <div>Working Days this month: <b style={{ color: text }}>{rows[0]?.working_days ?? '—'}</b></div>
          </div>

          <div style={{ ...card, overflowX: 'auto', maxHeight: 600 }}>
            {loading ? (
              <div style={{ color: muted, padding: 20 }}>Loading…</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={th}>Employee ID</th>
                    <th style={th}>Name</th>
                    <th style={th}>Role</th>
                    <th style={th}>Working Days</th>
                    <th style={th}>Present</th>
                    <th style={th}>Absent</th>
                    <th style={th}>Late</th>
                    <th style={th}>Half Day</th>
                    <th style={th}>Paid Leave</th>
                    <th style={th}>Unpaid Leave</th>
                    <th style={th}>Attendance %</th>
                    <th style={th}>Working Hrs</th>
                    <th style={th}>Overtime</th>
                    <th style={th}>Regularizations</th>
                    <th style={th}>Salary Impact</th>
                    <th style={th}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr><td style={td} colSpan={16}>Koi record nahi mila.</td></tr>
                  )}
                  {filtered.map((r) => (
                    <tr key={r.user_id}>
                      <td style={td}>{r.employee_id}</td>
                      <td style={td}>{r.employee_name}</td>
                      <td style={td}>{r.role}</td>
                      <td style={td}>{r.working_days}</td>
                      <td style={{ ...td, color: '#16a34a', fontWeight: 600 }}>{r.present_days}</td>
                      <td style={{ ...td, color: '#dc2626', fontWeight: 600 }}>{r.absent_days}</td>
                      <td style={{ ...td, color: '#d97706' }}>{r.late_days}</td>
                      <td style={td}>{r.half_days}</td>
                      <td style={td}>{r.paid_leave_days}</td>
                      <td style={td}>{r.unpaid_leave_days}</td>
                      <td style={{ ...td, color: pctColor(r.attendance_percent), fontWeight: 700 }}>{r.attendance_percent}%</td>
                      <td style={td}>{r.working_hours}h</td>
                      <td style={td}>{r.overtime_hours}h</td>
                      <td style={td}>{r.regularization_count}</td>
                      <td style={{ ...td, color: r.salary_impact > 0 ? '#dc2626' : muted }}>
                        {r.salary_impact > 0 ? `-₹${r.salary_impact}` : '—'}
                      </td>
                      <td style={td}>
                        <button
                          onClick={() => navigate(`/staff/attendance/employee/${r.user_id}`)}
                          style={{ background: 'transparent', border: `1px solid ${border}`, color: text, borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12 }}
                        >View</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
