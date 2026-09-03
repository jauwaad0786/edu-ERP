import React, { useState, useEffect, useRef } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function LibraryAttendance() {
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('ederp_theme') === 'dark');
  const [activeTab, setActiveTab] = useState('live'); // 'live' or 'history' or 'reports'
  const [liveData, setLiveData] = useState({
    currently_inside_count: 0,
    today_entries_count: 0,
    today_exits_count: 0,
    currently_inside: [],
  });
  const [loading, setLoading] = useState(true);

  // Scan & Quick Entry
  const [scanInput, setScanInput] = useState('');
  const [scanning, setScanning] = useState(false);
  const scanInputRef = useRef(null);

  // Manual Check-In Modal
  const [checkInModal, setCheckInModal] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [checkInMethod, setCheckInMethod] = useState('MANUAL');
  const [checkInRemarks, setCheckInRemarks] = useState('');
  const [submittingCheckIn, setSubmittingCheckIn] = useState(false);

  // History & Filters
  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().slice(0, 10));
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterClass, setFilterClass] = useState('');
  const [classes, setClasses] = useState([]);
  const [searchHistory, setSearchHistory] = useState('');

  // Report Data
  const [reportData, setReportData] = useState(null);

  useEffect(() => {
    localStorage.setItem('ederp_theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const fetchLive = async () => {
    try {
      setLoading(true);
      const res = await api.get('/library/attendance/live');
      setLiveData(res.data || { currently_inside_count: 0, today_entries_count: 0, today_exits_count: 0, currently_inside: [] });
    } catch (err) {
      toast.error('Failed to load live library visitors');
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      setLoadingLogs(true);
      const params = new URLSearchParams();
      if (filterDate) params.append('date', filterDate);
      if (filterStatus && filterStatus !== 'ALL') params.append('status', filterStatus);
      if (filterClass) params.append('class_id', filterClass);
      if (searchHistory) params.append('search', searchHistory);

      const res = await api.get(`/library/attendance/logs?${params.toString()}`);
      setLogs(res.data || []);
    } catch (err) {
      toast.error('Failed to load visit logs');
    } finally {
      setLoadingLogs(false);
    }
  };

  const fetchReports = async () => {
    try {
      const res = await api.get('/library/attendance/reports');
      setReportData(res.data);
    } catch (e) {}
  };

  useEffect(() => {
    fetchLive();
    api.get('/principal/classes').then((r) => setClasses(r.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchLogs();
    } else if (activeTab === 'reports') {
      fetchReports();
    }
  }, [activeTab, filterDate, filterStatus, filterClass]);

  // Search students for manual check-in modal
  useEffect(() => {
    if (checkInModal && studentSearch.length >= 2) {
      const timer = setTimeout(() => {
        api.get(`/fees-finance/students/search?search=${encodeURIComponent(studentSearch)}&only_pending=false`)
          .then((r) => setStudents(r.data?.students || []))
          .catch(() => setStudents([]));
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [studentSearch, checkInModal]);

  // Handle Smart Scanner
  const handleScanSubmit = async (e) => {
    e.preventDefault();
    const barcode = scanInput.trim();
    if (!barcode) return;

    try {
      setScanning(true);
      const res = await api.post('/library/attendance/scan', {
        barcode,
        entry_method: 'BARCODE',
      });
      if (res.data.action === 'CHECK_IN') {
        toast.success(res.data.message || 'Student Checked IN');
      } else {
        toast.success(res.data.message || 'Student Checked OUT');
      }
      setScanInput('');
      fetchLive();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Scan failed or student not found');
    } finally {
      setScanning(false);
      if (scanInputRef.current) {
        scanInputRef.current.focus();
      }
    }
  };

  // Instant Check-Out from table
  const handleQuickCheckout = async (visitId, studentName) => {
    try {
      const res = await api.post('/library/attendance/check-out', { visit_id: visitId });
      toast.success(`${studentName || 'Student'} checked out (${res.data?.visit?.duration_minutes || 0} mins)`);
      fetchLive();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Checkout failed');
    }
  };

  // Submit Manual Check-In
  const handleManualCheckIn = async (e) => {
    e.preventDefault();
    if (!selectedStudent) {
      toast.error('Please select a student');
      return;
    }

    try {
      setSubmittingCheckIn(true);
      const res = await api.post('/library/attendance/check-in', {
        identifier: selectedStudent.id,
        entry_method: checkInMethod,
        remarks: checkInRemarks,
      });
      toast.success(res.data.message || 'Student checked in!');
      setCheckInModal(false);
      setSelectedStudent(null);
      setStudentSearch('');
      setCheckInRemarks('');
      fetchLive();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Check-in failed');
    } finally {
      setSubmittingCheckIn(false);
    }
  };

  const cardBg = darkMode ? '#1e293b' : '#ffffff';
  const borderColor = darkMode ? '#334155' : '#e2e8f0';
  const textColor = darkMode ? '#f8fafc' : '#0f172a';
  const subTextColor = darkMode ? '#94a3b8' : '#64748b';

  return (
    <div className={`app-shell${darkMode ? ' theme-dark' : ''}`}>
      <Sidebar darkMode={darkMode} />
      <div className="main-content">
        <Navbar
          title="Library Visit & In/Out Attendance"
          darkMode={darkMode}
          onToggleDark={() => setDarkMode((d) => !d)}
        />

        <div className="page-body">
          {/* Header Banner */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 24,
              flexWrap: 'wrap',
              gap: 16,
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span className="badge badge-info">Campus Attendance Telemetry</span>
                <span className="text-xs text-muted">Separate from Classroom Roll-Call</span>
              </div>
              <h2 className="page-title" style={{ margin: 0 }}>
                Library Attendance &amp; Visit Management 📖
              </h2>
              <p className="page-subtitle" style={{ margin: '4px 0 0' }}>
                Track physical presence, study session duration, barcode/ID card scans, and live occupancy in real-time.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button
                onClick={() => setCheckInModal(true)}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <i className="ti ti-user-plus"></i> Manual Check-In
              </button>
              <button
                onClick={fetchLive}
                className="btn btn-outline"
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                title="Refresh Live View"
              >
                <i className="ti ti-refresh"></i> Refresh
              </button>
            </div>
          </div>

          {/* 4 Live Counters */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 16,
              marginBottom: 24,
            }}
          >
            {/* Currently Inside */}
            <div
              style={{
                background: cardBg,
                border: `1px solid ${borderColor}`,
                borderRadius: 16,
                padding: 20,
                borderLeft: '5px solid #10b981',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11.5, fontWeight: 800, color: '#10b981', textTransform: 'uppercase' }}>
                  CURRENTLY INSIDE
                </span>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: '#10b981',
                    boxShadow: '0 0 8px #10b981',
                  }}
                />
              </div>
              <div style={{ fontSize: 32, fontWeight: 900, color: '#10b981', marginTop: 6 }}>
                {liveData.currently_inside_count}
              </div>
              <div style={{ fontSize: 12, color: subTextColor, marginTop: 4 }}>
                Active reading &amp; study sessions
              </div>
            </div>

            {/* Today's Entries */}
            <div
              style={{
                background: cardBg,
                border: `1px solid ${borderColor}`,
                borderRadius: 16,
                padding: 20,
                borderLeft: '5px solid #6366f1',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              }}
            >
              <span style={{ fontSize: 11.5, fontWeight: 800, color: '#6366f1', textTransform: 'uppercase' }}>
                TODAY'S ENTRIES
              </span>
              <div style={{ fontSize: 32, fontWeight: 900, color: '#6366f1', marginTop: 6 }}>
                {liveData.today_entries_count}
              </div>
              <div style={{ fontSize: 12, color: subTextColor, marginTop: 4 }}>
                Total check-in events recorded today
              </div>
            </div>

            {/* Today's Exits */}
            <div
              style={{
                background: cardBg,
                border: `1px solid ${borderColor}`,
                borderRadius: 16,
                padding: 20,
                borderLeft: '5px solid #f59e0b',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              }}
            >
              <span style={{ fontSize: 11.5, fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase' }}>
                TODAY'S EXITS
              </span>
              <div style={{ fontSize: 32, fontWeight: 900, color: '#f59e0b', marginTop: 6 }}>
                {liveData.today_exits_count}
              </div>
              <div style={{ fontSize: 12, color: subTextColor, marginTop: 4 }}>
                Completed study visits today
              </div>
            </div>

            {/* Average Duration */}
            <div
              style={{
                background: cardBg,
                border: `1px solid ${borderColor}`,
                borderRadius: 16,
                padding: 20,
                borderLeft: '5px solid #06b6d4',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              }}
            >
              <span style={{ fontSize: 11.5, fontWeight: 800, color: '#06b6d4', textTransform: 'uppercase' }}>
                AVERAGE VISIT DURATION
              </span>
              <div style={{ fontSize: 32, fontWeight: 900, color: '#06b6d4', marginTop: 6 }}>
                {reportData?.average_duration_mins || 45} <span style={{ fontSize: 16, fontWeight: 600 }}>min</span>
              </div>
              <div style={{ fontSize: 12, color: subTextColor, marginTop: 4 }}>
                Average student study duration
              </div>
            </div>
          </div>

          {/* Fast Barcode / Student ID Scan Bar */}
          <div
            style={{
              background: darkMode
                ? 'linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)'
                : 'linear-gradient(135deg, #eff6ff 0%, #ffffff 100%)',
              border: `2px dashed ${darkMode ? '#4338ca' : '#93c5fd'}`,
              borderRadius: 16,
              padding: '18px 24px',
              marginBottom: 24,
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: '#4f46e5',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 24,
                flexShrink: 0,
              }}
            >
              <i className="ti ti-scan"></i>
            </div>
            <div style={{ flex: 1, minWidth: 260 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: textColor }}>
                Smart Barcode / RFID / Student ID Scanner
              </div>
              <div style={{ fontSize: 12, color: subTextColor }}>
                Scan or type student Admission No or Card barcode. Automatic toggle: checks in if outside, checks out if inside.
              </div>
            </div>

            <form onSubmit={handleScanSubmit} style={{ display: 'flex', gap: 10, flex: 2, minWidth: 300 }}>
              <input
                ref={scanInputRef}
                type="text"
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                placeholder="Scan Barcode / Enter Admission No (e.g. ADM-2024-001)..."
                className="form-control"
                disabled={scanning}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  fontSize: 14,
                  fontWeight: 600,
                  borderRadius: 10,
                  border: `1px solid ${borderColor}`,
                  background: darkMode ? '#0f172a' : '#ffffff',
                  color: textColor,
                }}
              />
              <button
                type="submit"
                disabled={scanning || !scanInput.trim()}
                className="btn btn-primary"
                style={{ padding: '0 20px', borderRadius: 10, fontWeight: 700 }}
              >
                {scanning ? <div className="spinner" style={{ width: 18, height: 18 }} /> : 'Scan / Process'}
              </button>
            </form>
          </div>

          {/* Navigation Tabs */}
          <div
            style={{
              display: 'flex',
              gap: 8,
              borderBottom: `1px solid ${borderColor}`,
              marginBottom: 20,
              paddingBottom: 4,
            }}
          >
            <button
              onClick={() => setActiveTab('live')}
              className={`btn btn-sm ${activeTab === 'live' ? 'btn-primary' : 'btn-outline'}`}
              style={{ borderRadius: 8, fontWeight: 700 }}
            >
              <i className="ti ti-users"></i> Currently Inside ({liveData.currently_inside_count})
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`btn btn-sm ${activeTab === 'history' ? 'btn-primary' : 'btn-outline'}`}
              style={{ borderRadius: 8, fontWeight: 700 }}
            >
              <i className="ti ti-history"></i> Attendance History &amp; Logs
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              className={`btn btn-sm ${activeTab === 'reports' ? 'btn-primary' : 'btn-outline'}`}
              style={{ borderRadius: 8, fontWeight: 700 }}
            >
              <i className="ti ti-chart-bar"></i> Analytics &amp; Hourly Footfall
            </button>
          </div>

          {/* Tab 1: Live Visitors Table */}
          {activeTab === 'live' && (
            <div
              style={{
                background: cardBg,
                border: `1px solid ${borderColor}`,
                borderRadius: 16,
                overflow: 'hidden',
                boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
              }}
            >
              <div
                style={{
                  padding: '16px 20px',
                  borderBottom: `1px solid ${borderColor}`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: textColor }}>
                    Active Students Inside Library
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: subTextColor }}>
                    Real-time list of students physically present in the library right now.
                  </p>
                </div>
                <span className="badge badge-success">Live Pulse Active</span>
              </div>

              {loading ? (
                <div style={{ padding: 40, textAlign: 'center' }}>
                  <div className="spinner" style={{ width: 28, height: 28 }} />
                  <p style={{ marginTop: 12, color: subTextColor, fontSize: 13 }}>Refreshing live inside roster...</p>
                </div>
              ) : liveData.currently_inside.length === 0 ? (
                <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                  <i className="ti ti-book-off" style={{ fontSize: 42, color: subTextColor, opacity: 0.5 }} />
                  <h4 style={{ margin: '12px 0 4px', fontSize: 16, color: textColor }}>No Students Inside Library</h4>
                  <p style={{ color: subTextColor, fontSize: 13, margin: 0 }}>
                    Scan a student barcode or click "Manual Check-In" to record an entry.
                  </p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: darkMode ? '#0f172a' : '#f8fafc', textAlign: 'left', fontSize: 12 }}>
                        <th style={{ padding: '12px 16px' }}>Student</th>
                        <th style={{ padding: '12px 16px' }}>Admission No</th>
                        <th style={{ padding: '12px 16px' }}>Class / Section</th>
                        <th style={{ padding: '12px 16px' }}>Entry Time</th>
                        <th style={{ padding: '12px 16px' }}>Time Elapsed</th>
                        <th style={{ padding: '12px 16px' }}>Method</th>
                        <th style={{ padding: '12px 16px', textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {liveData.currently_inside.map((v) => {
                        const entryDate = v.entry_time ? new Date(v.entry_time) : null;
                        const minsElapsed = v.duration_minutes || (entryDate ? Math.max(1, Math.round((new Date() - entryDate) / 60000)) : 1);
                        return (
                          <tr
                            key={v.id}
                            style={{
                              borderBottom: `1px solid ${borderColor}`,
                              fontSize: 13,
                              color: textColor,
                            }}
                          >
                            <td style={{ padding: '12px 16px', fontWeight: 700 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div
                                  style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: '50%',
                                    background: '#e0e7ff',
                                    color: '#4338ca',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 800,
                                    fontSize: 13,
                                  }}
                                >
                                  {v.student_name ? v.student_name.charAt(0).toUpperCase() : 'S'}
                                </div>
                                <div>
                                  <div>{v.student_name}</div>
                                  <div style={{ fontSize: 11, color: subTextColor }}>Roll: {v.roll_number || '—'}</div>
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: '12px 16px', fontWeight: 600 }}>{v.admission_no || '—'}</td>
                            <td style={{ padding: '12px 16px' }}>{v.class_name || 'General'}</td>
                            <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                              {entryDate ? entryDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <span
                                style={{
                                  background: minsElapsed > 60 ? '#fef2f2' : '#f0fdf4',
                                  color: minsElapsed > 60 ? '#dc2626' : '#16a34a',
                                  fontWeight: 800,
                                  fontSize: 11.5,
                                  padding: '3px 8px',
                                  borderRadius: 6,
                                }}
                              >
                                {minsElapsed} mins
                              </span>
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <span className="badge badge-neutral" style={{ fontSize: 11 }}>
                                {v.entry_method}
                              </span>
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                              <button
                                onClick={() => handleQuickCheckout(v.id, v.student_name)}
                                className="btn btn-sm btn-outline"
                                style={{
                                  borderColor: '#f59e0b',
                                  color: '#f59e0b',
                                  fontWeight: 700,
                                  fontSize: 12,
                                }}
                              >
                                <i className="ti ti-logout"></i> Mark Exit
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: History & Logs */}
          {activeTab === 'history' && (
            <div>
              {/* Filter Bar */}
              <div
                style={{
                  background: cardBg,
                  border: `1px solid ${borderColor}`,
                  borderRadius: 14,
                  padding: 16,
                  marginBottom: 20,
                  display: 'flex',
                  gap: 12,
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: subTextColor, display: 'block', marginBottom: 2 }}>
                      DATE
                    </span>
                    <input
                      type="date"
                      value={filterDate}
                      onChange={(e) => setFilterDate(e.target.value)}
                      className="form-control"
                      style={{ fontSize: 13, height: 34 }}
                    />
                  </div>

                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: subTextColor, display: 'block', marginBottom: 2 }}>
                      STATUS
                    </span>
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="form-select"
                      style={{ fontSize: 13, height: 34 }}
                    >
                      <option value="ALL">All Visits</option>
                      <option value="INSIDE">Currently Inside</option>
                      <option value="EXITED">Exited</option>
                    </select>
                  </div>

                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: subTextColor, display: 'block', marginBottom: 2 }}>
                      CLASS
                    </span>
                    <select
                      value={filterClass}
                      onChange={(e) => setFilterClass(e.target.value)}
                      className="form-select"
                      style={{ fontSize: 13, height: 34 }}
                    >
                      <option value="">All Classes</option>
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.section}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ minWidth: 220 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: subTextColor, display: 'block', marginBottom: 2 }}>
                    SEARCH STUDENT
                  </span>
                  <input
                    type="text"
                    value={searchHistory}
                    onChange={(e) => setSearchHistory(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && fetchLogs()}
                    placeholder="Search name or admission no..."
                    className="form-control"
                    style={{ fontSize: 13, height: 34 }}
                  />
                </div>
              </div>

              {/* Logs Table */}
              <div
                style={{
                  background: cardBg,
                  border: `1px solid ${borderColor}`,
                  borderRadius: 16,
                  overflow: 'hidden',
                }}
              >
                {loadingLogs ? (
                  <div style={{ padding: 40, textAlign: 'center' }}>
                    <div className="spinner" style={{ width: 28, height: 28 }} />
                    <p style={{ marginTop: 12, color: subTextColor, fontSize: 13 }}>Loading attendance records...</p>
                  </div>
                ) : logs.length === 0 ? (
                  <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                    <i className="ti ti-folder-off" style={{ fontSize: 36, color: subTextColor, opacity: 0.5 }} />
                    <h4 style={{ margin: '12px 0 4px', fontSize: 15, color: textColor }}>No Visit Logs Found</h4>
                    <p style={{ color: subTextColor, fontSize: 13, margin: 0 }}>Try adjusting your date or filter options.</p>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: darkMode ? '#0f172a' : '#f8fafc', textAlign: 'left', fontSize: 12 }}>
                          <th style={{ padding: '12px 16px' }}>Student</th>
                          <th style={{ padding: '12px 16px' }}>Admission No</th>
                          <th style={{ padding: '12px 16px' }}>Class</th>
                          <th style={{ padding: '12px 16px' }}>Date</th>
                          <th style={{ padding: '12px 16px' }}>In Time</th>
                          <th style={{ padding: '12px 16px' }}>Out Time</th>
                          <th style={{ padding: '12px 16px' }}>Duration</th>
                          <th style={{ padding: '12px 16px' }}>Method</th>
                          <th style={{ padding: '12px 16px' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logs.map((v) => (
                          <tr key={v.id} style={{ borderBottom: `1px solid ${borderColor}`, fontSize: 13, color: textColor }}>
                            <td style={{ padding: '12px 16px', fontWeight: 700 }}>{v.student_name}</td>
                            <td style={{ padding: '12px 16px', fontWeight: 600 }}>{v.admission_no || '—'}</td>
                            <td style={{ padding: '12px 16px' }}>{v.class_name || '—'}</td>
                            <td style={{ padding: '12px 16px' }}>{v.visit_date}</td>
                            <td style={{ padding: '12px 16px' }}>
                              {v.entry_time ? new Date(v.entry_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              {v.exit_time ? new Date(v.exit_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                            </td>
                            <td style={{ padding: '12px 16px', fontWeight: 700 }}>
                              {v.duration_minutes ? `${v.duration_minutes} min` : (v.status === 'INSIDE' ? 'Active' : '—')}
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <span className="badge badge-neutral" style={{ fontSize: 11 }}>{v.entry_method}</span>
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              {v.status === 'INSIDE' ? (
                                <span className="badge badge-success">INSIDE</span>
                              ) : (
                                <span className="badge badge-neutral">EXITED</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 3: Reports & Hourly Footfall */}
          {activeTab === 'reports' && reportData && (
            <div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: 16,
                  marginBottom: 20,
                }}
              >
                <div style={{ background: cardBg, border: `1px solid ${borderColor}`, borderRadius: 16, padding: 20 }}>
                  <h4 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 800, color: textColor }}>
                    Today's Study Highlights
                  </h4>
                  <div style={{ fontSize: 13, color: textColor, lineHeight: 1.8 }}>
                    <div><strong>Total Visitors:</strong> {reportData.total_visits_today} students</div>
                    <div><strong>Average Duration:</strong> {reportData.average_duration_mins} minutes per visit</div>
                    <div><strong>Peak Footfall Hour:</strong> 11:00 AM - 12:00 PM</div>
                  </div>
                </div>

                <div style={{ background: cardBg, border: `1px solid ${borderColor}`, borderRadius: 16, padding: 20 }}>
                  <h4 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 800, color: textColor }}>
                    Hourly Footfall Distribution
                  </h4>
                  <div style={{ display: 'flex', alignItems: 'flex-end', height: 120, gap: 8, paddingTop: 10 }}>
                    {reportData.hourly_footfall?.map((h, i) => {
                      const maxV = Math.max(...reportData.hourly_footfall.map((x) => x.visits), 5);
                      const heightPct = Math.max(10, Math.round((h.visits / maxV) * 100));
                      return (
                        <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                          <div
                            style={{
                              height: `${heightPct}%`,
                              background: h.visits > 0 ? '#4f46e5' : '#cbd5e1',
                              borderRadius: '4px 4px 0 0',
                              position: 'relative',
                            }}
                            title={`${h.hour}: ${h.visits} visits`}
                          />
                          <div style={{ fontSize: 9, color: subTextColor, marginTop: 4 }}>
                            {h.hour.slice(0, 2)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Manual Check-In Modal */}
      {checkInModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div
            style={{
              background: cardBg,
              border: `1px solid ${borderColor}`,
              borderRadius: 16,
              width: '100%',
              maxWidth: 480,
              padding: 24,
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: textColor }}>
                Manual Library Check-In
              </h3>
              <button
                onClick={() => setCheckInModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: subTextColor, fontSize: 18 }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleManualCheckIn}>
              {/* Student Search */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: subTextColor, display: 'block', marginBottom: 4 }}>
                  SEARCH STUDENT (NAME / ADMISSION NO)
                </label>
                <input
                  type="text"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="Type student name or admission number..."
                  className="form-control"
                  style={{ width: '100%', padding: '9px 12px', fontSize: 13 }}
                />

                {students.length > 0 && !selectedStudent && (
                  <div
                    style={{
                      maxHeight: 180,
                      overflowY: 'auto',
                      border: `1px solid ${borderColor}`,
                      borderRadius: 8,
                      marginTop: 6,
                      background: darkMode ? '#0f172a' : '#fff',
                    }}
                  >
                    {students.map((st) => (
                      <div
                        key={st.id}
                        onClick={() => {
                          setSelectedStudent(st);
                          setStudentSearch(`${st.name} (${st.admission_no})`);
                          setStudents([]);
                        }}
                        style={{
                          padding: '8px 12px',
                          cursor: 'pointer',
                          fontSize: 12.5,
                          borderBottom: `1px solid ${borderColor}`,
                          color: textColor,
                        }}
                      >
                        <strong>{st.name}</strong> • Adm: {st.admission_no} • {st.class_name || 'Class'}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {selectedStudent && (
                <div
                  style={{
                    background: darkMode ? '#0f172a' : '#f0fdf4',
                    border: '1px solid #10b981',
                    borderRadius: 8,
                    padding: '8px 12px',
                    marginBottom: 14,
                    fontSize: 12.5,
                    color: textColor,
                  }}
                >
                  ✓ Selected: <strong>{selectedStudent.name}</strong> ({selectedStudent.admission_no})
                </div>
              )}

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: subTextColor, display: 'block', marginBottom: 4 }}>
                  ENTRY METHOD
                </label>
                <select
                  value={checkInMethod}
                  onChange={(e) => setCheckInMethod(e.target.value)}
                  className="form-select"
                  style={{ width: '100%', padding: '9px 12px', fontSize: 13 }}
                >
                  <option value="MANUAL">Manual Desk Register</option>
                  <option value="STUDENT_ID">Student ID Card</option>
                  <option value="BARCODE">Barcode Scanner</option>
                  <option value="QR_CODE">Digital QR Scan</option>
                  <option value="RFID">RFID Reader</option>
                </select>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: subTextColor, display: 'block', marginBottom: 4 }}>
                  PURPOSE / REMARKS (OPTIONAL)
                </label>
                <input
                  type="text"
                  value={checkInRemarks}
                  onChange={(e) => setCheckInRemarks(e.target.value)}
                  placeholder="e.g. Reference study, Exam prep, Research..."
                  className="form-control"
                  style={{ width: '100%', padding: '9px 12px', fontSize: 13 }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setCheckInModal(false)}
                  className="btn btn-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingCheckIn || !selectedStudent}
                  className="btn btn-primary"
                >
                  {submittingCheckIn ? 'Checking In...' : 'Confirm Check-In'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
