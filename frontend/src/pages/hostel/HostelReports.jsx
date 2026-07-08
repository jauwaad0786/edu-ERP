// NEW FILE — src/pages/hostel/HostelReports.jsx
import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api     from '../../api/axios';
import toast   from 'react-hot-toast';

const TABS = [
  { key: 'occupancy', label: '🏨 Occupancy' },
  { key: 'fees',       label: '💰 Fee Collection' },
  { key: 'history',    label: '📜 Admission History' },
];

export default function HostelReports() {
  const [darkMode, setDarkMode] = useState(localStorage.getItem('ederp_theme') === 'dark');
  const [tab, setTab] = useState('occupancy');

  const cardStyle = {
    background: darkMode ? '#1e293b' : '#fff',
    border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
    borderRadius: 12, padding: 18,
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: darkMode ? '#0f172a' : '#f8fafc' }}>
      <Sidebar darkMode={darkMode} />
      <div style={{ marginLeft: 232, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Navbar title="Hostel Reports" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />

        <div style={{ padding: 24 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                padding: '9px 18px', fontSize: 13, fontWeight: 700, borderRadius: 8,
                border: 'none', cursor: 'pointer',
                background: tab === t.key ? '#4f46e5' : (darkMode ? '#1e293b' : '#fff'),
                color: tab === t.key ? '#fff' : (darkMode ? '#94a3b8' : '#64748b'),
                border: `1px solid ${tab === t.key ? '#4f46e5' : (darkMode ? '#334155' : '#e2e8f0')}`,
              }}>
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'occupancy' && <OccupancyReport darkMode={darkMode} cardStyle={cardStyle} />}
          {tab === 'fees'      && <FeeCollectionReport darkMode={darkMode} cardStyle={cardStyle} />}
          {tab === 'history'   && <HistoryReport darkMode={darkMode} cardStyle={cardStyle} />}
        </div>
      </div>
    </div>
  );
}

// ── Occupancy Tab ──
function OccupancyReport({ darkMode, cardStyle }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get('/hostel/reports/occupancy')
      .then(r => setData(r.data))
      .catch(() => toast.error('Occupancy report load nahi hua'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>Loading...</div>;
  if (!data) return <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>Data nahi mila</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Hostel-wise */}
      <div style={cardStyle}>
        <h4 style={{ margin: '0 0 14px', fontSize: 14, color: darkMode ? '#f1f5f9' : '#0f172a' }}>Hostel-wise Occupancy</h4>
        {data.hostel_breakdown.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20, color: '#94a3b8', fontSize: 13 }}>Koi hostel nahi bana</div>
        ) : data.hostel_breakdown.map(h => (
          <div key={h.id} style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
              <span style={{ fontWeight: 600, color: darkMode ? '#e2e8f0' : '#1e293b' }}>{h.name} ({h.gender})</span>
              <span style={{ color: '#94a3b8' }}>{h.occupied_beds}/{h.total_beds} beds ({h.occupancy_pct}%)</span>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: darkMode ? '#334155' : '#f1f5f9', overflow: 'hidden' }}>
              <div style={{
                width: `${h.occupancy_pct}%`, height: '100%',
                background: h.occupancy_pct > 85 ? '#dc2626' : h.occupancy_pct > 60 ? '#d97706' : '#16a34a',
                borderRadius: 4,
              }} />
            </div>
          </div>
        ))}
      </div>

      {/* Building-wise */}
      <div style={cardStyle}>
        <h4 style={{ margin: '0 0 14px', fontSize: 14, color: darkMode ? '#f1f5f9' : '#0f172a' }}>Building-wise Occupancy</h4>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, textAlign: 'left' }}>
              <th style={{ padding: '8px 6px', color: '#94a3b8', fontSize: 11 }}>HOSTEL</th>
              <th style={{ padding: '8px 6px', color: '#94a3b8', fontSize: 11 }}>BUILDING</th>
              <th style={{ padding: '8px 6px', color: '#94a3b8', fontSize: 11 }}>OCCUPIED/TOTAL</th>
              <th style={{ padding: '8px 6px', color: '#94a3b8', fontSize: 11 }}>OCCUPANCY %</th>
            </tr>
          </thead>
          <tbody>
            {data.building_breakdown.length === 0 ? (
              <tr><td colSpan={4} style={{ textAlign: 'center', padding: 20, color: '#94a3b8' }}>Koi building nahi bani</td></tr>
            ) : data.building_breakdown.map(b => (
              <tr key={b.id} style={{ borderBottom: `1px solid ${darkMode ? '#334155' : '#f1f5f9'}` }}>
                <td style={{ padding: '9px 6px' }}>{b.hostel_name}</td>
                <td style={{ padding: '9px 6px', fontWeight: 600 }}>{b.name}</td>
                <td style={{ padding: '9px 6px' }}>{b.occupied_beds}/{b.total_beds}</td>
                <td style={{ padding: '9px 6px' }}>{b.occupancy_pct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Distributions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {[
          { title: 'Room Type Distribution', data: data.room_type_distribution },
          { title: 'AC vs Non-AC',           data: data.ac_distribution },
          { title: 'Gender Distribution',    data: data.gender_distribution },
        ].map(section => (
          <div key={section.title} style={cardStyle}>
            <h4 style={{ margin: '0 0 12px', fontSize: 13, color: darkMode ? '#f1f5f9' : '#0f172a' }}>{section.title}</h4>
            {Object.keys(section.data).length === 0 ? (
              <div style={{ fontSize: 12, color: '#94a3b8' }}>No data</div>
            ) : Object.entries(section.data).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12 }}>
                <span style={{ color: darkMode ? '#cbd5e1' : '#475569' }}>{k}</span>
                <span style={{ fontWeight: 700, color: '#4f46e5' }}>{v}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Fee Collection Tab ──
function FeeCollectionReport({ darkMode, cardStyle }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('ALL');
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const params = status !== 'ALL' ? `?status=${status}` : '';
    api.get('/hostel/reports/fee-collection' + params)
      .then(r => setData(r.data))
      .catch(() => toast.error('Fee report load nahi hua'))
      .finally(() => setLoading(false));
  }, [status]);

  useEffect(() => { load(); }, [load]);

  async function downloadCSV() {
    setDownloading(true);
    try {
      const res = await api.get('/hostel/reports/fee-collection/export', { responseType: 'blob' });
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      link.download = 'hostel_fee_collection.csv';
      link.click();
    } catch {
      toast.error('Export fail hua');
    }
    setDownloading(false);
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>Loading...</div>;
  if (!data) return <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>Data nahi mila</div>;

  const { summary, records } = data;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {[
          { label: 'Total Due',   value: `₹${summary.total_due}`,     color: '#4f46e5' },
          { label: 'Total Paid',  value: `₹${summary.total_paid}`,    color: '#16a34a' },
          { label: 'Pending',     value: `₹${summary.total_pending}`, color: '#dc2626' },
          { label: 'Collection %',value: `${summary.collection_pct}%`,color: '#0891b2' },
        ].map(s => (
          <div key={s.label} style={cardStyle}>
            <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <select value={status} onChange={e => setStatus(e.target.value)} style={{
          padding: '8px 14px', fontSize: 13, fontWeight: 600, borderRadius: 8,
          border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
          background: darkMode ? '#1e293b' : '#fff', color: darkMode ? '#f1f5f9' : '#0f172a',
        }}>
          <option value="ALL">All Status</option>
          <option value="PAID">Paid</option>
          <option value="PARTIAL">Partial</option>
          <option value="PENDING">Pending</option>
        </select>
        <button onClick={downloadCSV} disabled={downloading} style={{
          background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8,
          padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}>
          {downloading ? 'Exporting...' : '⬇️ Export CSV'}
        </button>
      </div>

      <div style={cardStyle}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, textAlign: 'left' }}>
              {['Student', 'Admission No', 'Month', 'Due', 'Paid', 'Pending', 'Status', 'Receipt'].map(h => (
                <th key={h} style={{ padding: '8px 6px', color: '#94a3b8', fontSize: 10 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 20, color: '#94a3b8' }}>Koi record nahi mila</td></tr>
            ) : records.map((r, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${darkMode ? '#334155' : '#f1f5f9'}` }}>
                <td style={{ padding: '9px 6px', fontWeight: 600 }}>{r.student_name}</td>
                <td style={{ padding: '9px 6px' }}>{r.admission_no}</td>
                <td style={{ padding: '9px 6px' }}>{r.month}</td>
                <td style={{ padding: '9px 6px' }}>₹{r.amount_due}</td>
                <td style={{ padding: '9px 6px', color: '#16a34a' }}>₹{r.amount_paid}</td>
                <td style={{ padding: '9px 6px', color: r.pending > 0 ? '#dc2626' : '#16a34a' }}>₹{r.pending}</td>
                <td style={{ padding: '9px 6px' }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20,
                    background: r.status === 'PAID' ? '#f0fdf4' : r.status === 'PARTIAL' ? '#fefce8' : '#fef2f2',
                    color: r.status === 'PAID' ? '#16a34a' : r.status === 'PARTIAL' ? '#ca8a04' : '#dc2626',
                  }}>{r.status}</span>
                </td>
                <td style={{ padding: '9px 6px', fontFamily: 'monospace', fontSize: 10 }}>{r.receipt_no || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── History Tab ──
function HistoryReport({ darkMode, cardStyle }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState('ALL');

  useEffect(() => {
    setLoading(true);
    const params = action !== 'ALL' ? `?action=${action}` : '';
    api.get('/hostel/reports/history' + params)
      .then(r => setData(r.data || []))
      .catch(() => toast.error('History load nahi hui'))
      .finally(() => setLoading(false));
  }, [action]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <select value={action} onChange={e => setAction(e.target.value)} style={{
        padding: '8px 14px', fontSize: 13, fontWeight: 600, borderRadius: 8, width: 200,
        border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
        background: darkMode ? '#1e293b' : '#fff', color: darkMode ? '#f1f5f9' : '#0f172a',
      }}>
        <option value="ALL">All</option>
        <option value="ACTIVE">Active</option>
        <option value="TRANSFERRED">Transferred</option>
        <option value="VACATED">Vacated</option>
      </select>

      <div style={cardStyle}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Loading...</div>
        ) : data.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Koi record nahi mila</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, textAlign: 'left' }}>
                {['Student', 'Admission Date', 'Vacate Date', 'Status', 'Transfer Type', 'Reason'].map(h => (
                  <th key={h} style={{ padding: '8px 6px', color: '#94a3b8', fontSize: 10 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map(a => (
                <tr key={a.id} style={{ borderBottom: `1px solid ${darkMode ? '#334155' : '#f1f5f9'}` }}>
                  <td style={{ padding: '9px 6px', fontWeight: 600 }}>{a.student_name}</td>
                  <td style={{ padding: '9px 6px' }}>{a.admission_date}</td>
                  <td style={{ padding: '9px 6px' }}>{a.vacate_date || '—'}</td>
                  <td style={{ padding: '9px 6px' }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20,
                      background: a.status === 'ACTIVE' ? '#f0fdf4' : '#f1f5f9',
                      color: a.status === 'ACTIVE' ? '#16a34a' : '#64748b',
                    }}>{a.status}</span>
                  </td>
                  <td style={{ padding: '9px 6px' }}>{a.transfer_type || '—'}</td>
                  <td style={{ padding: '9px 6px' }}>{a.transfer_reason || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
