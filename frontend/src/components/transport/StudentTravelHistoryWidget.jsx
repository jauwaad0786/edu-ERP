import React, { useState, useEffect, useCallback } from 'react';
import api from '../../api/axios';
import transportApi from '../../api/transportApi';
import toast from 'react-hot-toast';

export default function StudentTravelHistoryWidget({ darkMode = false, title = "Student Transport & Daily Travel History" }) {
  // Mode: 'DATE' (everyday single date) or 'MONTH' (month-wise)
  const [viewMode, setViewMode] = useState('DATE');
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  });

  const [loading, setLoading] = useState(false);
  const [historyData, setHistoryData] = useState([]);
  const [summary, setSummary] = useState({
    total_enrolled: 0,
    boarded_count: 0,
    dropped_count: 0,
    in_transit_count: 0,
    absent_count: 0,
    not_boarded_count: 0,
    safe_drop_pct: 100,
    total_records: 0
  });

  // Filter States
  const [search, setSearch] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [vehiclesList, setVehiclesList] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Load Vehicles for Filter
  useEffect(() => {
    transportApi.vehicles.list({ per_page: 100 })
      .then(res => {
        const list = res.data?.data || [];
        setVehiclesList(list);
      })
      .catch(() => {});
  }, []);

  // Fetch Travel History
  const fetchTravelHistory = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page,
        per_page: 50,
        search: search.trim() || undefined,
        vehicle_id: selectedVehicle ? Number(selectedVehicle) : undefined,
        status: selectedStatus !== 'ALL' ? selectedStatus : undefined,
      };

      if (viewMode === 'DATE') {
        params.date = selectedDate;
      } else {
        params.month = selectedMonth;
      }

      const res = await api.get('/transport/travel-history', { params });
      if (res.data?.success) {
        setHistoryData(res.data.data || []);
        if (res.data.summary) {
          setSummary(res.data.summary);
        }
        setTotalPages(res.data.pages || 1);
      }
    } catch (err) {
      console.error('Failed to load travel history:', err);
      toast.error('Travel history load nahi ho saki');
    } finally {
      setLoading(false);
    }
  }, [viewMode, selectedDate, selectedMonth, search, selectedVehicle, selectedStatus, page]);

  useEffect(() => {
    fetchTravelHistory();
  }, [fetchTravelHistory]);

  // Quick Date Helpers
  const setToday = () => {
    const today = new Date().toISOString().split('T')[0];
    setSelectedDate(today);
    setViewMode('DATE');
  };

  const setYesterday = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().split('T')[0]);
    setViewMode('DATE');
  };

  const setCurrentMonth = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    setSelectedMonth(`${y}-${m}`);
    setViewMode('MONTH');
  };

  // CSV Export
  const exportToCSV = () => {
    if (!historyData || historyData.length === 0) {
      toast.error('Export karne ke liye koi data nahi hai');
      return;
    }
    const headers = [
      'Date', 'Student Name', 'Admission No', 'Class', 'Father Name', 'Parent Mobile',
      'Vehicle No', 'Route', 'Pickup Stop', 'Boarding Time (Gadi me aane ka samay)',
      'Drop Stop', 'Drop Time (Drop hone ka samay)', 'Status', 'Driver Name', 'Driver Mobile'
    ];
    const rows = historyData.map(r => [
      `"${r.date_formatted || r.date || ''}"`,
      `"${r.student_name || ''}"`,
      `"${r.admission_no || ''}"`,
      `"${r.class_name || ''}"`,
      `"${r.father_name || ''}"`,
      `"${r.parent_phone || ''}"`,
      `"${r.vehicle_number || ''}"`,
      `"${r.route_name || ''}"`,
      `"${r.pickup_stop_name || ''}"`,
      `"${r.boarded_time || '--'}"`,
      `"${r.drop_stop_name || ''}"`,
      `"${r.dropped_time || '--'}"`,
      `"${r.status_label || r.status || ''}"`,
      `"${r.driver_name || ''}"`,
      `"${r.driver_mobile || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Student_Travel_History_${viewMode === 'DATE' ? selectedDate : selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('CSV Report Downloaded! 📥');
  };

  return (
    <div style={{
      background: darkMode ? '#111827' : '#ffffff',
      border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
      borderRadius: '24px',
      padding: '24px',
      marginBottom: '24px',
      boxShadow: darkMode ? '0 10px 30px rgba(0,0,0,0.4)' : '0 4px 20px rgba(0,0,0,0.04)',
      position: 'relative'
    }}>
      {/* ══ HEADER ══ */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: '16px', marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '46px', height: '46px', borderRadius: '14px',
            background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
            color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '22px', boxShadow: '0 6px 16px rgba(2, 132, 199, 0.35)'
          }}>
            🚌
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '19px', fontWeight: 900, color: darkMode ? '#ffffff' : '#0f172a' }}>
                {title}
              </h3>
              <span style={{
                fontSize: '11px', fontWeight: 800, padding: '3px 9px', borderRadius: '20px',
                background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0'
              }}>
                ● LIVE TELEMETRY
              </span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: darkMode ? '#94a3b8' : '#64748b', fontWeight: 500 }}>
              Gadi me aane ka samay (Boarding) & Drop hone ka samay (Drop-off) — Date-wise & Month-wise Everyday History
            </p>
          </div>
        </div>

        {/* View Mode & Export Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Mode Switcher */}
          <div style={{
            display: 'flex', background: darkMode ? '#1e293b' : '#f1f5f9',
            padding: '3px', borderRadius: '12px', border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`
          }}>
            <button
              onClick={() => { setViewMode('DATE'); setPage(1); }}
              style={{
                background: viewMode === 'DATE' ? '#0284c7' : 'none',
                color: viewMode === 'DATE' ? '#ffffff' : (darkMode ? '#94a3b8' : '#64748b'),
                border: 'none', borderRadius: '9px', padding: '6px 14px',
                fontSize: '12px', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s'
              }}
            >
              📅 Date-wise (Daily)
            </button>
            <button
              onClick={() => { setViewMode('MONTH'); setPage(1); }}
              style={{
                background: viewMode === 'MONTH' ? '#0284c7' : 'none',
                color: viewMode === 'MONTH' ? '#ffffff' : (darkMode ? '#94a3b8' : '#64748b'),
                border: 'none', borderRadius: '9px', padding: '6px 14px',
                fontSize: '12px', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s'
              }}
            >
              🗓️ Month-wise (महीना)
            </button>
          </div>

          <button
            onClick={exportToCSV}
            style={{
              background: darkMode ? '#1e293b' : '#f8fafc',
              color: darkMode ? '#ffffff' : '#0f172a',
              border: `1px solid ${darkMode ? '#334155' : '#cbd5e1'}`,
              borderRadius: '12px', padding: '8px 14px', fontSize: '12.5px',
              fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
            }}
          >
            📥 Export CSV
          </button>
        </div>
      </div>

      {/* ══ SUMMARY METRIC CARDS ══ */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '14px',
        marginBottom: '20px'
      }}>
        {/* Total Enrolled */}
        <div style={{
          background: darkMode ? '#1e293b' : '#f8fafc',
          border: `1px solid ${darkMode ? 'rgba(255,255,255,0.06)' : '#e2e8f0'}`,
          borderRadius: '16px', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '12px'
        }}>
          <div style={{
            width: '42px', height: '42px', borderRadius: '12px',
            background: '#eff6ff', color: '#2563eb',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px'
          }}>
            👥
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Enrolled Students</div>
            <div style={{ fontSize: '22px', fontWeight: 900, color: darkMode ? '#ffffff' : '#0f172a' }}>
              {summary.total_enrolled}
            </div>
          </div>
        </div>

        {/* Boarded / Picked Up */}
        <div style={{
          background: darkMode ? '#1e293b' : '#f8fafc',
          border: `1px solid ${darkMode ? 'rgba(255,255,255,0.06)' : '#e2e8f0'}`,
          borderRadius: '16px', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '12px'
        }}>
          <div style={{
            width: '42px', height: '42px', borderRadius: '12px',
            background: '#ecfdf5', color: '#059669',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px'
          }}>
            🟢
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Gadi Me Aaye (Boarded)</div>
            <div style={{ fontSize: '22px', fontWeight: 900, color: '#059669' }}>
              {summary.boarded_count}
            </div>
          </div>
        </div>

        {/* Safely Dropped */}
        <div style={{
          background: darkMode ? '#1e293b' : '#f8fafc',
          border: `1px solid ${darkMode ? 'rgba(255,255,255,0.06)' : '#e2e8f0'}`,
          borderRadius: '16px', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '12px'
        }}>
          <div style={{
            width: '42px', height: '42px', borderRadius: '12px',
            background: '#f0fdf4', color: '#16a34a',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px'
          }}>
            🏁
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Safe Drop ({summary.safe_drop_pct}%)</div>
            <div style={{ fontSize: '22px', fontWeight: 900, color: '#16a34a' }}>
              {summary.dropped_count}
            </div>
          </div>
        </div>

        {/* In Transit */}
        <div style={{
          background: darkMode ? '#1e293b' : '#f8fafc',
          border: `1px solid ${darkMode ? 'rgba(255,255,255,0.06)' : '#e2e8f0'}`,
          borderRadius: '16px', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '12px'
        }}>
          <div style={{
            width: '42px', height: '42px', borderRadius: '12px',
            background: '#fffbeb', color: '#d97706',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px'
          }}>
            🚌
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>On Board (In-Transit)</div>
            <div style={{ fontSize: '22px', fontWeight: 900, color: '#d97706' }}>
              {summary.in_transit_count}
            </div>
          </div>
        </div>

        {/* Absent */}
        <div style={{
          background: darkMode ? '#1e293b' : '#f8fafc',
          border: `1px solid ${darkMode ? 'rgba(255,255,255,0.06)' : '#e2e8f0'}`,
          borderRadius: '16px', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '12px'
        }}>
          <div style={{
            width: '42px', height: '42px', borderRadius: '12px',
            background: '#fef2f2', color: '#ef4444',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px'
          }}>
            🔴
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Marked Absent</div>
            <div style={{ fontSize: '22px', fontWeight: 900, color: '#ef4444' }}>
              {summary.absent_count}
            </div>
          </div>
        </div>
      </div>

      {/* ══ FILTER & DATE SELECTION BAR ══ */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center',
        padding: '16px', borderRadius: '16px',
        background: darkMode ? '#1e293b' : '#f8fafc',
        border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
        marginBottom: '20px'
      }}>
        {/* Date Selector */}
        {viewMode === 'DATE' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 800, color: darkMode ? '#cbd5e1' : '#475569' }}>Date:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={e => { setSelectedDate(e.target.value); setPage(1); }}
              style={{
                padding: '7px 12px', borderRadius: '10px', fontSize: '12.5px', fontWeight: 700,
                border: `1px solid ${darkMode ? '#475569' : '#cbd5e1'}`,
                background: darkMode ? '#0f172a' : '#ffffff',
                color: darkMode ? '#ffffff' : '#0f172a'
              }}
            />
            <button
              onClick={setToday}
              style={{
                padding: '6px 12px', borderRadius: '8px', fontSize: '11.5px', fontWeight: 800,
                background: selectedDate === new Date().toISOString().split('T')[0] ? '#0284c7' : (darkMode ? '#334155' : '#e2e8f0'),
                color: selectedDate === new Date().toISOString().split('T')[0] ? '#ffffff' : (darkMode ? '#ffffff' : '#0f172a'),
                border: 'none', cursor: 'pointer'
              }}
            >
              Today
            </button>
            <button
              onClick={setYesterday}
              style={{
                padding: '6px 12px', borderRadius: '8px', fontSize: '11.5px', fontWeight: 700,
                background: darkMode ? '#334155' : '#e2e8f0',
                color: darkMode ? '#ffffff' : '#0f172a',
                border: 'none', cursor: 'pointer'
              }}
            >
              Yesterday
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 800, color: darkMode ? '#cbd5e1' : '#475569' }}>Month:</span>
            <input
              type="month"
              value={selectedMonth}
              onChange={e => { setSelectedMonth(e.target.value); setPage(1); }}
              style={{
                padding: '7px 12px', borderRadius: '10px', fontSize: '12.5px', fontWeight: 700,
                border: `1px solid ${darkMode ? '#475569' : '#cbd5e1'}`,
                background: darkMode ? '#0f172a' : '#ffffff',
                color: darkMode ? '#ffffff' : '#0f172a'
              }}
            />
            <button
              onClick={setCurrentMonth}
              style={{
                padding: '6px 12px', borderRadius: '8px', fontSize: '11.5px', fontWeight: 800,
                background: darkMode ? '#334155' : '#e2e8f0',
                color: darkMode ? '#ffffff' : '#0f172a',
                border: 'none', cursor: 'pointer'
              }}
            >
              This Month
            </button>
          </div>
        )}

        <div style={{ width: '1px', height: '26px', background: darkMode ? '#334155' : '#cbd5e1', margin: '0 4px' }} />

        {/* Search Input */}
        <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
          <i className="ti ti-search" style={{
            position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
            color: '#94a3b8', fontSize: '15px'
          }} />
          <input
            type="text"
            placeholder="Search student, admission no, bus..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            style={{
              width: '100%', padding: '7px 12px 7px 36px', borderRadius: '10px',
              border: `1px solid ${darkMode ? '#475569' : '#cbd5e1'}`,
              background: darkMode ? '#0f172a' : '#ffffff',
              color: darkMode ? '#ffffff' : '#0f172a', fontSize: '12.5px', fontWeight: 600
            }}
          />
        </div>

        {/* Vehicle Filter */}
        <select
          value={selectedVehicle}
          onChange={e => { setSelectedVehicle(e.target.value); setPage(1); }}
          style={{
            padding: '7px 12px', borderRadius: '10px', fontSize: '12.5px', fontWeight: 600,
            border: `1px solid ${darkMode ? '#475569' : '#cbd5e1'}`,
            background: darkMode ? '#0f172a' : '#ffffff',
            color: darkMode ? '#ffffff' : '#0f172a'
          }}
        >
          <option value="">All Vehicles / Sabhi Gaadiyan</option>
          {vehiclesList.map(v => (
            <option key={v.id} value={v.id}>{v.vehicle_number} ({v.vehicle_type})</option>
          ))}
        </select>

        {/* Status Filter */}
        <select
          value={selectedStatus}
          onChange={e => { setSelectedStatus(e.target.value); setPage(1); }}
          style={{
            padding: '7px 12px', borderRadius: '10px', fontSize: '12.5px', fontWeight: 600,
            border: `1px solid ${darkMode ? '#475569' : '#cbd5e1'}`,
            background: darkMode ? '#0f172a' : '#ffffff',
            color: darkMode ? '#ffffff' : '#0f172a'
          }}
        >
          <option value="ALL">All Status / Sabhi Status</option>
          <option value="DROPPED">Safely Dropped (ड्रॉप हो गए)</option>
          <option value="IN_TRANSIT">In-Transit / Boarded (गाड़ी में सवार)</option>
          <option value="ABSENT">Absent (अनुपस्थित)</option>
          <option value="NOT_BOARDED">Scheduled / Not Yet Boarded</option>
        </select>
      </div>

      {/* ══ DATA TABLE ══ */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
          <div className="driver-spinner" style={{
            margin: '0 auto 12px', width: '36px', height: '36px',
            border: '3px solid #0284c730', borderTopColor: '#0284c7',
            borderRadius: '50%', animation: 'spin 1s linear infinite'
          }} />
          <div style={{ fontSize: '14px', fontWeight: 700 }}>Loading travel records... / डेटा लोड हो रहा है...</div>
        </div>
      ) : historyData.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '50px 20px',
          background: darkMode ? '#1e293b' : '#f8fafc',
          borderRadius: '16px', border: `1px dashed ${darkMode ? '#334155' : '#cbd5e1'}`
        }}>
          <div style={{ fontSize: '42px', marginBottom: '8px' }}>🚌</div>
          <h4 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a' }}>
            Koi Travel Record Nahi Mila
          </h4>
          <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>
            {viewMode === 'DATE' ? `Date ${selectedDate} ke liye koi live trip ya travel history nahi hai.` : `Month ${selectedMonth} ke liye koi data nahi hai.`}
          </p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: '14px', border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}` }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{
                background: darkMode ? '#1e293b' : '#f1f5f9',
                color: darkMode ? '#94a3b8' : '#475569',
                borderBottom: `2px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
                fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em'
              }}>
                <th style={{ padding: '12px 16px' }}>Student Profile</th>
                {viewMode === 'MONTH' && <th style={{ padding: '12px 14px' }}>Date</th>}
                <th style={{ padding: '12px 14px' }}>Assigned Bus & Route</th>
                <th style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>🟢 Boarding (Gadi Me Aaye)</span>
                  </div>
                </th>
                <th style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>🏁 Drop-off (Drop Ho Gye)</span>
                  </div>
                </th>
                <th style={{ padding: '12px 14px' }}>Travel Status</th>
                <th style={{ padding: '12px 16px' }}>Parent / Emergency</th>
              </tr>
            </thead>
            <tbody>
              {historyData.map((row, idx) => {
                const isDropped = row.status === 'DROPPED';
                const isInTransit = row.status === 'IN_TRANSIT';
                const isAbsent = row.status === 'ABSENT';

                return (
                  <tr
                    key={`${row.student_id}-${row.date}-${idx}`}
                    style={{
                      borderBottom: `1px solid ${darkMode ? '#1f2937' : '#f1f5f9'}`,
                      background: idx % 2 === 0
                        ? (darkMode ? '#111827' : '#ffffff')
                        : (darkMode ? '#151f32' : '#fcfdfe'),
                      transition: 'background 0.15s'
                    }}
                  >
                    {/* 1. Student Profile */}
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '38px', height: '38px', borderRadius: '10px',
                          background: darkMode ? '#334155' : '#e0f2fe',
                          color: '#0284c7', fontWeight: 800, fontSize: '14px',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0, overflow: 'hidden'
                        }}>
                          {row.photo_url ? (
                            <img src={row.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            row.student_name ? row.student_name.charAt(0).toUpperCase() : 'S'
                          )}
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a', fontSize: '13.5px' }}>
                            {row.student_name}
                          </div>
                          <div style={{ fontSize: '11.5px', color: '#94a3b8', display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <span>Adm: <strong>{row.admission_no || '--'}</strong></span>
                            <span>•</span>
                            <span style={{ color: '#0284c7', fontWeight: 700 }}>{row.class_name || 'No Class'}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Date Column in Month View */}
                    {viewMode === 'MONTH' && (
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 700, color: darkMode ? '#ffffff' : '#0f172a', fontSize: '12.5px' }}>
                          {row.date_formatted || row.date}
                        </div>
                        <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>{row.day_name}</div>
                      </td>
                    )}

                    {/* 2. Bus & Route */}
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span>🚌 {row.vehicle_number || 'Not Assigned'}</span>
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '2px' }}>
                        {row.route_name || 'Direct Route'}
                      </div>
                    </td>

                    {/* 3. Boarding (Gadi Me Aane Ka Samay) */}
                    <td style={{ padding: '12px 14px' }}>
                      {row.boarded ? (
                        <div>
                          <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                            background: darkMode ? 'rgba(5,150,105,0.2)' : '#ecfdf5',
                            color: '#059669', padding: '3px 8px', borderRadius: '8px',
                            fontWeight: 800, fontSize: '12px'
                          }}>
                            <i className="ti ti-clock" /> {row.boarded_time}
                          </div>
                          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '3px' }}>
                            🚏 {row.boarded_stop || row.pickup_stop_name || 'Pickup Stop'}
                          </div>
                        </div>
                      ) : isAbsent ? (
                        <span style={{ fontSize: '12px', color: '#ef4444', fontWeight: 700 }}>
                          ✕ Student Absent
                        </span>
                      ) : (
                        <div>
                          <span style={{
                            fontSize: '11px', color: '#94a3b8', background: darkMode ? '#1e293b' : '#f1f5f9',
                            padding: '3px 7px', borderRadius: '6px', fontWeight: 600
                          }}>
                            ⏳ Scheduled
                          </span>
                          <div style={{ fontSize: '10.5px', color: '#94a3b8', marginTop: '2px' }}>
                            {row.pickup_stop_name || 'Scheduled Stop'}
                          </div>
                        </div>
                      )}
                    </td>

                    {/* 4. Drop-off (Drop Hone Ka Samay) */}
                    <td style={{ padding: '12px 14px' }}>
                      {row.dropped ? (
                        <div>
                          <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                            background: darkMode ? 'rgba(22,163,74,0.2)' : '#f0fdf4',
                            color: '#16a34a', padding: '3px 8px', borderRadius: '8px',
                            fontWeight: 800, fontSize: '12px'
                          }}>
                            <i className="ti ti-check" /> {row.dropped_time}
                          </div>
                          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '3px' }}>
                            🚏 {row.dropped_stop || row.drop_stop_name || 'Drop Stop'}
                          </div>
                        </div>
                      ) : isInTransit ? (
                        <div>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            background: '#fffbeb', color: '#d97706', padding: '3px 8px',
                            borderRadius: '8px', fontWeight: 800, fontSize: '11.5px'
                          }}>
                            🚌 On Route
                          </span>
                          <div style={{ fontSize: '10.5px', color: '#94a3b8', marginTop: '2px' }}>
                            Dest: {row.drop_stop_name || 'Drop Stop'}
                          </div>
                        </div>
                      ) : isAbsent ? (
                        <span style={{ fontSize: '12px', color: '#94a3b8' }}>—</span>
                      ) : (
                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                          Pending Drop
                        </span>
                      )}
                    </td>

                    {/* 5. Travel Status Badge */}
                    <td style={{ padding: '12px 14px' }}>
                      {isDropped ? (
                        <span style={{
                          padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 800,
                          background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0',
                          display: 'inline-flex', alignItems: 'center', gap: '4px'
                        }}>
                          🏁 Safely Dropped
                        </span>
                      ) : isInTransit ? (
                        <span style={{
                          padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 800,
                          background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a',
                          display: 'inline-flex', alignItems: 'center', gap: '4px'
                        }}>
                          ● Live In Transit
                        </span>
                      ) : isAbsent ? (
                        <span style={{
                          padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 800,
                          background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca',
                          display: 'inline-flex', alignItems: 'center', gap: '4px'
                        }}>
                          ✕ Absent
                        </span>
                      ) : (
                        <span style={{
                          padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700,
                          background: darkMode ? '#334155' : '#f1f5f9', color: darkMode ? '#94a3b8' : '#64748b'
                        }}>
                          ⏳ Scheduled
                        </span>
                      )}
                    </td>

                    {/* 6. Parent Contact */}
                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: 700, color: darkMode ? '#ffffff' : '#0f172a', fontSize: '12.5px' }}>
                        {row.father_name || 'Parent'}
                      </div>
                      {row.parent_phone && (
                        <a
                          href={`tel:${row.parent_phone}`}
                          style={{
                            fontSize: '11.5px', color: '#0284c7', textDecoration: 'none',
                            display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700, marginTop: '2px'
                          }}
                        >
                          <i className="ti ti-phone" /> {row.parent_phone}
                        </a>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ══ PAGINATION ══ */}
      {totalPages > 1 && (
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginTop: '16px', paddingTop: '12px', borderTop: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`
        }}>
          <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>
            Showing page <strong>{page}</strong> of <strong>{totalPages}</strong> ({summary.total_records} records)
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              style={{
                padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 700,
                background: darkMode ? '#1e293b' : '#f1f5f9', color: darkMode ? '#ffffff' : '#0f172a',
                border: 'none', cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.5 : 1
              }}
            >
              ← Previous
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              style={{
                padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 700,
                background: darkMode ? '#1e293b' : '#f1f5f9', color: darkMode ? '#ffffff' : '#0f172a',
                border: 'none', cursor: page >= totalPages ? 'not-allowed' : 'pointer', opacity: page >= totalPages ? 0.5 : 1
              }}
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
