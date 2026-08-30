import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import transportApi from '../../api/transportApi';
import toast   from 'react-hot-toast';
import StudentTravelHistoryWidget from '../../components/transport/StudentTravelHistoryWidget';

// Each report: key -> { label, fetch(params), columns: [{key, label, format?}], filters: ['status'|'dateRange'] }
const REPORTS = {
  travelHistory: {
    label: '🚌 Student Travel & Boarding History (Daily/Monthly)',
    custom: 'travelHistory',
  },
  vehicleStudents: {
    label: 'Vehicle Wise Students',
    fetch: transportApi.reports.vehicleWiseStudents,
    columns: [
      { key: 'vehicle_number', label: 'Vehicle' },
      { key: 'vehicle_type', label: 'Type' },
      { key: 'capacity', label: 'Capacity' },
      { key: 'students_assigned', label: 'Students' },
    ],
  },
  driverStudents: {
    label: 'Driver Wise Students',
    fetch: transportApi.reports.driverWiseStudents,
    columns: [
      { key: 'driver_name', label: 'Driver' },
      { key: 'mobile_number', label: 'Mobile' },
      { key: 'vehicle_number', label: 'Vehicle' },
      { key: 'students_assigned', label: 'Students' },
    ],
  },
  routeStudents: {
    label: 'Route Wise Students',
    fetch: transportApi.reports.routeWiseStudents,
    columns: [
      { key: 'route_name', label: 'Route' },
      { key: 'vehicle_number', label: 'Vehicle' },
      { key: 'students_count', label: 'Students' },
    ],
  },
  stopStudents: {
    label: 'Stop Wise Students',
    fetch: transportApi.reports.stopWiseStudents,
    columns: [
      { key: 'stop_name', label: 'Stop' },
      { key: 'students_count', label: 'Students' },
    ],
  },
  withoutTransport: {
    label: 'Students Without Transport',
    fetch: transportApi.reports.studentsWithoutTransport,
    columns: [
      { key: 'admission_no', label: 'Admission No' },
      { key: 'name', label: 'Name' },
      { key: 'father_name', label: 'Father Name' },
      { key: 'father_mobile', label: 'Mobile' },
    ],
    paginated: true,
  },
  feeReport: {
    label: 'Transport Fee Report',
    fetch: transportApi.reports.transportFee,
    columns: [
      { key: 'student_name', label: 'Student' },
      { key: 'period_label', label: 'Period' },
      { key: 'amount', label: 'Amount', format: v => `₹${(v || 0).toLocaleString()}` },
      { key: 'paid_amount', label: 'Paid', format: v => `₹${(v || 0).toLocaleString()}` },
      { key: 'balance', label: 'Balance', format: v => `₹${(v || 0).toLocaleString()}` },
      { key: 'status', label: 'Status' },
    ],
    filters: ['status', 'dateRange'],
    hasSummary: true,
  },
  collection: {
    label: 'Collection Report',
    fetch: transportApi.reports.collection,
    filters: ['dateRange'],
    custom: 'collection',
  },
  maintenance: {
    label: 'Maintenance Report',
    fetch: transportApi.reports.maintenance,
    columns: [
      { key: 'vehicle_number', label: 'Vehicle' },
      { key: 'problem', label: 'Problem' },
      { key: 'reported_date', label: 'Reported' },
      { key: 'cost', label: 'Cost', format: v => `₹${(v || 0).toLocaleString()}` },
      { key: 'status', label: 'Status' },
    ],
    filters: ['dateRange'],
    hasSummary: true,
  },
  utilization: {
    label: 'Vehicle Utilization',
    fetch: transportApi.reports.vehicleUtilization,
    columns: [
      { key: 'vehicle_number', label: 'Vehicle' },
      { key: 'capacity', label: 'Capacity' },
      { key: 'students_assigned', label: 'Assigned' },
      { key: 'utilization_pct', label: 'Utilization %', format: v => v === null || v === undefined ? '—' : `${v}%` },
      { key: 'status', label: 'Status' },
    ],
  },
  transferHistory: {
    label: 'Transfer History',
    fetch: transportApi.reports.transferHistory,
    columns: [
      { key: 'transfer_type', label: 'Type' },
      { key: 'from_vehicle_number', label: 'From Vehicle' },
      { key: 'to_vehicle_number', label: 'To Vehicle' },
      { key: 'from_stop_name', label: 'From Stop' },
      { key: 'to_stop_name', label: 'To Stop' },
      { key: 'transfer_date', label: 'Date', format: v => v?.slice(0, 10) },
    ],
    paginated: true,
  },
};

const FEE_STATUSES = ['PENDING', 'PARTIAL', 'PAID', 'OVERDUE', 'WAIVED'];

function exportCsv(filename, columns, rows) {
  const header = columns.map(c => c.label).join(',');
  const lines = rows.map(r => columns.map(c => {
    const raw = r[c.key];
    const val = c.format ? c.format(raw) : raw;
    const s = (val ?? '').toString().replace(/"/g, '""');
    return `"${s}"`;
  }).join(','));
  const csv = [header, ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${filename}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function TransportReports() {
  const [darkMode, setDarkMode] = useState(localStorage.getItem('ederp_theme') === 'dark');
  const [activeKey, setActiveKey] = useState('vehicleStudents');

  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [collectionData, setCollectionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [statusFilter, setStatusFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const report = REPORTS[activeKey];

  const load = useCallback(() => {
    if (!report || typeof report.fetch !== 'function') {
      setLoading(false);
      return;
    }
    setLoading(true);
    const params = {};
    if (report.paginated) params.page = page;
    if (report.filters?.includes('status') && statusFilter) params.status = statusFilter;
    if (report.filters?.includes('dateRange')) {
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;
    }

    report.fetch(params)
      .then(r => {
        if (report.custom === 'collection') {
          setCollectionData(r.data.data || { vehicle_wise: [], route_wise: [] });
        } else {
          setRows(r.data.data || []);
          setSummary(r.data.summary || null);
          setTotal(r.data.total || (r.data.data || []).length);
        }
      })
      .catch(() => toast.error('Report load nahi hua'))
      .finally(() => setLoading(false));
  }, [report, page, statusFilter, fromDate, toDate]);

  useEffect(() => {
    setPage(1);
    setStatusFilter('');
    setFromDate('');
    setToDate('');
  }, [activeKey]);

  useEffect(() => { load(); }, [load]);

  function handleExport() {
    if (report.custom === 'collection') {
      toast('Collection report ke liye vehicle-wise / route-wise section me dekho', { icon: 'ℹ️' });
      return;
    }
    if (!rows.length) { toast.error('Export karne ke liye koi data nahi hai'); return; }
    exportCsv(activeKey, report.columns, rows);
  }

  const cardStyle = {
    background: darkMode ? '#1e293b' : '#fff',
    border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
    borderRadius: 12, padding: 18,
  };
  const inputStyle = {
    padding: '8px 10px', fontSize: 12,
    border: '1px solid #e2e8f0', borderRadius: 8, outline: 'none',
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: darkMode ? '#0f172a' : '#f8fafc' }}>
      <Sidebar darkMode={darkMode} />
      <div style={{ marginLeft: 232, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Navbar title="Transport Reports" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />

        <div style={{ padding: 24 }}>
          {/* Report tabs */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {Object.entries(REPORTS).map(([key, r]) => (
              <button key={key} onClick={() => setActiveKey(key)} style={{
                padding: '8px 14px', fontSize: 12, fontWeight: 700, borderRadius: 8, cursor: 'pointer',
                border: 'none', whiteSpace: 'nowrap',
                background: activeKey === key ? '#4f46e5' : (darkMode ? '#1e293b' : '#f1f5f9'),
                color: activeKey === key ? '#fff' : (darkMode ? '#94a3b8' : '#334155'),
              }}>{r.label}</button>
            ))}
          </div>

          {activeKey === 'travelHistory' ? (
            <StudentTravelHistoryWidget darkMode={darkMode} />
          ) : (
            <>
              {/* Filters + export */}
              <div style={{ ...cardStyle, marginBottom: 16, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {report.filters?.includes('status') && (
                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={inputStyle}>
                      <option value="">All Status</option>
                      {FEE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  )}
                  {report.filters?.includes('dateRange') && (
                    <>
                      <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={inputStyle} />
                      <span style={{ alignSelf: 'center', color: '#94a3b8', fontSize: 12 }}>to</span>
                      <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} style={inputStyle} />
                    </>
                  )}
                </div>
                <button onClick={handleExport} style={{
                  background: '#f1f5f9', color: '#334155', border: 'none', borderRadius: 8,
                  padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}>⬇ Export CSV</button>
              </div>

              {/* Summary cards */}
              {report.hasSummary && summary && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 16 }}>
                  {Object.entries(summary).map(([k, v]) => (
                    <div key={k} style={cardStyle}>
                      <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>{k.replace(/_/g, ' ')}</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: darkMode ? '#f1f5f9' : '#0f172a', marginTop: 4 }}>
                        {typeof v === 'number' && k.includes('amount') || k.includes('collected') || k.includes('pending') || k === 'total_cost'
                          ? `₹${v.toLocaleString()}` : v}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Content */}
          {activeKey !== 'travelHistory' && (
          <div style={cardStyle}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Loading...</div>
            ) : report.custom === 'collection' ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: darkMode ? '#f1f5f9' : '#0f172a' }}>Vehicle Wise</div>
                  {(collectionData?.vehicle_wise || []).length === 0 ? (
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>Koi data nahi</div>
                  ) : collectionData.vehicle_wise.map((v, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, borderBottom: '1px solid #f1f5f9' }}>
                      <span>{v.vehicle_number}</span>
                      <span style={{ fontWeight: 700, color: '#16a34a' }}>₹{v.amount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: darkMode ? '#f1f5f9' : '#0f172a' }}>Route Wise</div>
                  {(collectionData?.route_wise || []).length === 0 ? (
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>Koi data nahi</div>
                  ) : collectionData.route_wise.map((r, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, borderBottom: '1px solid #f1f5f9' }}>
                      <span>{r.route_name}</span>
                      <span style={{ fontWeight: 700, color: '#16a34a' }}>₹{r.amount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : rows.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Koi data nahi mila</div>
            ) : (
              <>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, textAlign: 'left' }}>
                      {report.columns.map(c => (
                        <th key={c.key} style={{ padding: '8px 6px', color: '#94a3b8', fontSize: 11 }}>{c.label.toUpperCase()}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={row.id || row.vehicle_id || row.student_id || i} style={{ borderBottom: `1px solid ${darkMode ? '#334155' : '#f1f5f9'}` }}>
                        {report.columns.map(c => (
                          <td key={c.key} style={{ padding: '10px 6px', color: darkMode ? '#e2e8f0' : '#334155' }}>
                            {c.format ? c.format(row[c.key]) : (row[c.key] ?? '—')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>

                {report.paginated && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>{total} total</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{
                        padding: '6px 14px', fontSize: 12, borderRadius: 6, border: '1px solid #e2e8f0',
                        background: darkMode ? '#0f172a' : '#fff', color: darkMode ? '#e2e8f0' : '#334155',
                        cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.5 : 1,
                      }}>Prev</button>
                      <button disabled={rows.length < 50} onClick={() => setPage(p => p + 1)} style={{
                        padding: '6px 14px', fontSize: 12, borderRadius: 6, border: '1px solid #e2e8f0',
                        background: darkMode ? '#0f172a' : '#fff', color: darkMode ? '#e2e8f0' : '#334155',
                        cursor: rows.length < 50 ? 'not-allowed' : 'pointer', opacity: rows.length < 50 ? 0.5 : 1,
                      }}>Next</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
