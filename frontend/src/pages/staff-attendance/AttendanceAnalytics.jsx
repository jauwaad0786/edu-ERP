// FULL FILE — src/pages/staff-attendance/AttendanceAnalytics.jsx
import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api     from '../../api/axios';
import toast   from 'react-hot-toast';

const RANGE_OPTIONS = [
  { key: 'daily',   label: 'Daily' },
  { key: 'weekly',  label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'yearly',  label: 'Yearly' },
];

export default function AttendanceAnalytics() {
  const [darkMode, setDarkMode] = useState(localStorage.getItem('ederp_theme') === 'dark');
  const [range, setRange] = useState('monthly');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [role, setRole] = useState('ALL');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ range, month, year, role });
    api.get(`/staff-attendance/analytics?${params.toString()}`)
      .then((r) => setData(r.data))
      .catch(() => toast.error('Analytics load nahi hui'))
      .finally(() => setLoading(false));
  }, [range, month, year, role]);

  useEffect(() => { load(); }, [load]);

  const exportFile = async (type) => {
    setExporting(true);
    try {
      const params = new URLSearchParams({ range, month, year, role, format: type });
      const res = await api.get(`/staff-attendance/analytics/export?${params.toString()}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `attendance-analytics-${month}-${year}.${type === 'excel' ? 'xlsx' : 'pdf'}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      toast.error('Export fail ho gaya');
    } finally {
      setExporting(false);
    }
  };

  // ── styles ──
  const bg     = darkMode ? '#0f172a' : '#f8fafc';
  const cardBg = darkMode ? '#1e293b' : '#fff';
  const border = darkMode ? '#334155' : '#e2e8f0';
  const text   = darkMode ? '#e2e8f0' : '#0f172a';
  const muted  = darkMode ? '#94a3b8' : '#64748b';
  const card = { background: cardBg, border: `1px solid ${border}`, borderRadius: 14, padding: 18, marginBottom: 20 };
  const sectionTitle = { fontSize: 15, fontWeight: 700, color: text, marginBottom: 14 };
  const kpiGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 20 };
  const select = { padding: '8px 12px', borderRadius: 8, border: `1px solid ${border}`, background: cardBg, color: text, fontSize: 13 };

  const KpiCard = ({ label, value, sub, color }) => (
    <div style={{ ...card, marginBottom: 0, borderLeft: `3px solid ${color}` }}>
      <div style={{ fontSize: 11, color: muted, fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: text }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: muted, marginTop: 4 }}>{sub}</div>}
    </div>
  );

  // simple self-drawn bar chart, no external chart lib
  const BarChart = ({ points, maxValue, barColor }) => {
    const max = maxValue || Math.max(1, ...points.map((p) => p.value));
    return (
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 160, overflowX: 'auto', paddingBottom: 4 }}>
        {points.map((p, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 30 }}>
            <div style={{ fontSize: 10, color: muted, marginBottom: 4 }}>{p.value}</div>
            <div style={{
              width: 20, borderRadius: '4px 4px 0 0',
              height: `${Math.max(4, (p.value / max) * 120)}px`,
              background: barColor || '#4f46e5',
            }} />
            <div style={{ fontSize: 10, color: muted, marginTop: 6, whiteSpace: 'nowrap' }}>{p.label}</div>
          </div>
        ))}
      </div>
    );
  };

  const RankList = ({ title, items, valueKey, valueSuffix, color }) => (
    <div style={card}>
      <div style={sectionTitle}>{title}</div>
      {(!items || items.length === 0) && <div style={{ fontSize: 12, color: muted }}>Data nahi mila.</div>}
      {items && items.map((it, i) => (
        <div key={it.user_id || i} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 0', borderBottom: i < items.length - 1 ? `1px solid ${border}` : 'none',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 24, height: 24, borderRadius: '50%', background: darkMode ? '#334155' : '#e2e8f0',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: text,
            }}>{i + 1}</div>
            <div>
              <div style={{ fontSize: 13, color: text, fontWeight: 600 }}>{it.employee_name}</div>
              <div style={{ fontSize: 11, color: muted }}>{it.employee_id} · {it.designation || it.role}</div>
            </div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color }}>{it[valueKey]}{valueSuffix}</div>
        </div>
      ))}
    </div>
  );

  // heatmap: value 0-100 -> shade of green
  const heatColor = (pct) => {
    if (pct == null) return darkMode ? '#1e293b' : '#f1f5f9';
    if (pct >= 95) return '#16a34a';
    if (pct >= 85) return '#4ade80';
    if (pct >= 70) return '#facc15';
    if (pct >= 50) return '#fb923c';
    return '#ef4444';
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: bg }}>
      <Sidebar darkMode={darkMode} />
      <div style={{ marginLeft: 232, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Navbar title="Attendance Analytics" darkMode={darkMode} onToggleDark={() => setDarkMode((d) => !d)} />

        <div style={{ padding: 24 }}>
          {/* FILTERS */}
          <div style={{
            display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 20,
            position: 'sticky', top: 0, zIndex: 5, background: bg, paddingBottom: 8,
          }}>
            <div style={{ display: 'flex', gap: 4, background: cardBg, border: `1px solid ${border}`, borderRadius: 10, padding: 4 }}>
              {RANGE_OPTIONS.map((r) => (
                <button key={r.key} onClick={() => setRange(r.key)} style={{
                  padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  background: range === r.key ? '#4f46e5' : 'transparent',
                  color: range === r.key ? '#fff' : text,
                }}>{r.label}</button>
              ))}
            </div>

            <select style={select} value={month} onChange={(e) => setMonth(parseInt(e.target.value))}>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {new Date(0, i).toLocaleString('default', { month: 'long' })}
                </option>
              ))}
            </select>
            <select style={select} value={year} onChange={(e) => setYear(parseInt(e.target.value))}>
              {[year - 1, year, year + 1].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <select style={select} value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="ALL">All Roles</option>
              <option value="TEACHER">Teacher</option>
              <option value="ACCOUNTANT">Accountant</option>
              <option value="RECEPTIONIST">Receptionist</option>
              <option value="LIBRARIAN">Librarian</option>
              <option value="DRIVER">Driver</option>
              <option value="OTHER">Other Staff</option>
            </select>

            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button onClick={() => exportFile('pdf')} disabled={exporting} style={{
                background: 'transparent', border: `1px solid ${border}`, color: text,
                borderRadius: 8, padding: '8px 14px', fontSize: 12, cursor: 'pointer',
              }}>📄 Export PDF</button>
              <button onClick={() => exportFile('excel')} disabled={exporting} style={{
                background: 'transparent', border: `1px solid ${border}`, color: text,
                borderRadius: 8, padding: '8px 14px', fontSize: 12, cursor: 'pointer',
              }}>📊 Export Excel</button>
            </div>
          </div>

          {loading || !data ? (
            <div style={{ color: muted }}>Loading…</div>
          ) : (
            <>
              {/* KPI ROW */}
              <div style={kpiGrid}>
                <KpiCard label="Attendance %" value={`${data.kpis.attendance_percent}%`} color="#16a34a" />
                <KpiCard label="Late %" value={`${data.kpis.late_percent}%`} color="#eab308" />
                <KpiCard label="Absent %" value={`${data.kpis.absent_percent}%`} color="#ef4444" />
                <KpiCard label="Half Day %" value={`${data.kpis.half_day_percent}%`} color="#f97316" />
                <KpiCard label="Avg Check In" value={data.kpis.avg_check_in || '—'} color="#4f46e5" />
                <KpiCard label="Avg Check Out" value={data.kpis.avg_check_out || '—'} color="#4f46e5" />
                <KpiCard label="Avg Working Hrs" value={`${data.kpis.avg_working_hours || 0}h`} color="#0ea5e9" />
                <KpiCard label="Payroll Impact" value={`₹${data.kpis.payroll_impact || 0}`} sub="Loss of pay est." color="#dc2626" />
              </div>

              {/* TREND CHART */}
              <div style={card}>
                <div style={sectionTitle}>{RANGE_OPTIONS.find((r) => r.key === range)?.label} Attendance Trend</div>
                <BarChart points={data.trend.attendance_percent} barColor="#16a34a" maxValue={100} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
                <div style={card}>
                  <div style={sectionTitle}>Late Trend</div>
                  <BarChart points={data.trend.late_count} barColor="#eab308" />
                </div>
                <div style={card}>
                  <div style={sectionTitle}>Working Hours Trend</div>
                  <BarChart points={data.trend.working_hours} barColor="#0ea5e9" />
                </div>
                <div style={card}>
                  <div style={sectionTitle}>Regularization Trend</div>
                  <BarChart points={data.trend.regularization_count} barColor="#8b5cf6" />
                </div>
              </div>

              {/* RANK LISTS */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, marginTop: 4 }}>
                <RankList title="🏆 Perfect Attendance" items={data.rankings.top_attendance} valueKey="attendance_percent" valueSuffix="%" color="#16a34a" />
                <RankList title="⏰ Most Late" items={data.rankings.most_late} valueKey="late_days" valueSuffix=" days" color="#eab308" />
                <RankList title="🌴 Most Leave Taken" items={data.rankings.most_leave} valueKey="leave_days" valueSuffix=" days" color="#dc2626" />
              </div>

              {/* HEATMAP */}
              <div style={card}>
                <div style={sectionTitle}>Attendance Heatmap — {new Date(0, month - 1).toLocaleString('default', { month: 'long' })} {year}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(32px, 1fr))', gap: 4, maxWidth: 600 }}>
                  {data.heatmap.map((d) => (
                    <div key={d.date} title={`${d.date}: ${d.attendance_percent != null ? d.attendance_percent + '%' : 'No data'}`} style={{
                      aspectRatio: '1', borderRadius: 6, background: heatColor(d.attendance_percent),
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#fff', fontWeight: 600,
                    }}>{new Date(d.date).getDate()}</div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 12, fontSize: 11, color: muted, alignItems: 'center' }}>
                  <span>Low</span>
                  {['#ef4444', '#fb923c', '#facc15', '#4ade80', '#16a34a'].map((c) => (
                    <div key={c} style={{ width: 14, height: 14, borderRadius: 4, background: c }} />
                  ))}
                  <span>High</span>
                </div>
              </div>

              {/* COMPARISON */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
                <div style={card}>
                  <div style={sectionTitle}>Monthly Comparison</div>
                  <BarChart points={data.comparison.monthly} barColor="#4f46e5" maxValue={100} />
                </div>
                <div style={card}>
                  <div style={sectionTitle}>Academic Session Comparison</div>
                  <BarChart points={data.comparison.session} barColor="#0891b2" maxValue={100} />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
