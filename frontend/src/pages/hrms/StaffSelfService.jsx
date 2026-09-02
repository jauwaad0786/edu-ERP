import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function StaffSelfService() {
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('ederp_theme') === 'dark');
  useEffect(() => { localStorage.setItem('ederp_theme', darkMode ? 'dark' : 'light'); }, [darkMode]);

  const [activeTab, setActiveTab] = useState('attendance'); // attendance, leaves, payslips, official_duty, profile
  const [loading, setLoading] = useState(true);

  // Today's GPS Attendance State
  const [todayAtt, setTodayAtt] = useState(null);
  const [locating, setLocating] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [currentDistance, setCurrentDistance] = useState(null);
  const [gpsAccuracy, setGpsAccuracy] = useState(null);
  const [coords, setCoords] = useState(null);

  // Leaves State
  const [leaveBalances, setLeaveBalances] = useState([]);
  const [myLeaveRequests, setMyLeaveRequests] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    leave_type_id: '', from_date: '', to_date: '', reason: '', is_half_day: false
  });
  const [submittingLeave, setSubmittingLeave] = useState(false);

  // Payslips State
  const [payslips, setPayslips] = useState([]);

  // Profile & Official Duty State
  const [profileData, setProfileData] = useState(null);
  const [odList, setOdList] = useState([]);
  const [showOdModal, setShowOdModal] = useState(false);
  const [odForm, setOdForm] = useState({
    from_date: '', to_date: '', duty_type: 'SCHOOL_EVENT', location: '', purpose: ''
  });
  const [submittingOd, setSubmittingOd] = useState(false);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      api.get('/staff-attendance/today').catch(() => ({ data: null })),
      api.get('/hrms/my/leaves').catch(() => ({ data: { balances: [], requests: [] } })),
      api.get('/hrms/leaves/types').catch(() => ({ data: [] })),
      api.get('/hrms/my/payslips').catch(() => ({ data: [] })),
      api.get('/hrms/my/profile').catch(() => ({ data: null })),
      api.get('/hrms/my/official-duty').catch(() => ({ data: [] })),
    ])
      .then(([attRes, leaveRes, typeRes, slipRes, profRes, odRes]) => {
        setTodayAtt(attRes.data);
        setLeaveBalances(leaveRes.data?.balances || []);
        setMyLeaveRequests(leaveRes.data?.requests || []);
        setLeaveTypes(typeRes.data || []);
        setPayslips(slipRes.data || []);
        setProfileData(profRes.data);
        setOdList(odRes.data || []);
      })
      .catch(err => toast.error('Failed to load employee portal data'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
    detectLocation();
  }, []);

  const detectLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsAccuracy(Math.round(pos.coords.accuracy));
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        toast.error(`Location access denied or unavailable: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleCheckIn = async () => {
    if (!coords) {
      toast.error('Detecting GPS location... Please allow location access');
      detectLocation();
      return;
    }
    setCheckingIn(true);
    try {
      const res = await api.post('/staff-attendance/check-in', {
        latitude: coords.lat,
        longitude: coords.lng,
        accuracy: gpsAccuracy,
        device: navigator.userAgent,
      });
      toast.success('Check-in marked successfully! Have a great day.');
      setTodayAtt(res.data?.attendance);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Check-in failed');
    } finally {
      setCheckingIn(false);
    }
  };

  const handleCheckOut = async () => {
    setCheckingIn(true);
    try {
      const res = await api.post('/staff-attendance/check-out', {
        latitude: coords?.lat,
        longitude: coords?.lng,
      });
      toast.success('Check-out marked successfully! Goodbye.');
      setTodayAtt(res.data?.attendance);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Check-out failed');
    } finally {
      setCheckingIn(false);
    }
  };

  const handleApplyLeave = async (e) => {
    e.preventDefault();
    setSubmittingLeave(true);
    try {
      await api.post('/hrms/leaves/requests', leaveForm);
      toast.success('Leave application submitted for approval');
      setShowApplyModal(false);
      setLeaveForm({ leave_type_id: '', from_date: '', to_date: '', reason: '', is_half_day: false });
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit leave');
    } finally {
      setSubmittingLeave(false);
    }
  };

  const handleApplyOd = async (e) => {
    e.preventDefault();
    setSubmittingOd(true);
    try {
      await api.post('/hrms/official-duty', odForm);
      toast.success('Official Duty submitted for approval');
      setShowOdModal(false);
      setOdForm({ from_date: '', to_date: '', duty_type: 'SCHOOL_EVENT', location: '', purpose: '' });
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit OD');
    } finally {
      setSubmittingOd(false);
    }
  };

  const cardBg = {
    background: darkMode ? '#141b2d' : '#ffffff',
    borderColor: darkMode ? '#1e293b' : '#e2e8f0',
    color: darkMode ? '#f8fafc' : '#0f172a'
  };

  const u = profileData?.user || {};
  const p = profileData?.profile || {};

  return (
    <div className={`app-shell${darkMode ? ' theme-dark' : ''}`}>
      <Sidebar darkMode={darkMode} />
      <div className="main-content">
        <Navbar title="My Staff Portal (Self-Service)" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />

        <div className="page-body">
          {/* ══ Welcome Card ══ */}
          <div style={{
            ...cardBg, borderRadius: '20px', border: '1px solid', padding: '24px 30px', marginBottom: '22px',
            background: darkMode ? 'linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)' : 'linear-gradient(135deg, #eff6ff 0%, #ffffff 100%)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{
                  width: '60px', height: '60px', borderRadius: '50%', background: '#3b82f620',
                  color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '22px', fontWeight: 800, border: '2px solid #3b82f6'
                }}>
                  {u.name ? u.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div>
                  <h2 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: 800 }}>
                    Welcome back, {u.name || 'Staff Member'}!
                  </h2>
                  <div style={{ fontSize: '13px', color: '#64748b' }}>
                    <b>ID:</b> {u.employee_id || '—'} • <b>Role:</b> {u.role} • <b>Dept:</b> {p.department || u.department || 'General'}
                  </div>
                </div>
              </div>

              {/* GPS Live Status Indicator */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: darkMode ? '#1e293b' : '#ffffff', padding: '10px 16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: coords ? '#10b981' : '#f59e0b' }} />
                <div style={{ fontSize: '12px' }}>
                  <div style={{ fontWeight: 700 }}>{coords ? 'GPS Active' : 'Locating GPS...'}</div>
                  <div style={{ color: '#64748b' }}>Accuracy: {gpsAccuracy ? `±${gpsAccuracy}m` : 'Detecting...'}</div>
                </div>
                <button onClick={detectLocation} style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: '16px' }}>
                  <i className={`ti ti-refresh ${locating ? 'ti-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div style={{ display: 'flex', gap: '8px', borderTop: `1px solid ${darkMode ? '#1e293b' : '#e2e8f0'}`, marginTop: '20px', paddingTop: '14px', overflowX: 'auto' }}>
              {[
                { id: 'attendance', label: "Today's GPS Attendance", icon: 'ti-map-pin' },
                { id: 'leaves', label: 'My Leaves & Apply', icon: 'ti-calendar-event' },
                { id: 'payslips', label: 'My Payslips & Salary', icon: 'ti-wallet' },
                { id: 'official_duty', label: 'Official Duty (OD)', icon: 'ti-briefcase' },
                { id: 'profile', label: 'My Profile & KYC', icon: 'ti-user' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    background: activeTab === tab.id ? (darkMode ? '#3b82f6' : '#2563eb') : 'transparent',
                    color: activeTab === tab.id ? '#ffffff' : '#64748b',
                    border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 700, fontSize: '12.5px',
                    display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', whiteSpace: 'nowrap'
                  }}
                >
                  <i className={`ti ${tab.icon}`} /> {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* ══ TAB 1: GPS Attendance ══ */}
          {activeTab === 'attendance' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
              {/* Check-In / Out Action Box */}
              <div style={{ ...cardBg, borderRadius: '18px', border: '1px solid', padding: '26px', textAlign: 'center' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Live Campus Attendance
                </div>
                <h3 style={{ margin: '0 0 16px', fontSize: '20px', fontWeight: 800 }}>
                  {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                </h3>

                {/* Status Box */}
                <div style={{ background: darkMode ? '#0f172a' : '#f8fafc', borderRadius: '14px', padding: '18px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: '11.5px', color: '#64748b' }}>Check-In Time</span>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: '#10b981', marginTop: '2px' }}>
                        {todayAtt?.check_in_time ? new Date(todayAtt.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '— : —'}
                      </div>
                    </div>
                    <div style={{ width: '1px', height: '36px', background: '#cbd5e1' }} />
                    <div>
                      <span style={{ fontSize: '11.5px', color: '#64748b' }}>Check-Out Time</span>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: '#ef4444', marginTop: '2px' }}>
                        {todayAtt?.check_out_time ? new Date(todayAtt.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '— : —'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Punch Buttons */}
                {!todayAtt?.check_in_time ? (
                  <button
                    onClick={handleCheckIn} disabled={checkingIn}
                    style={{
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      color: '#fff', border: 'none', padding: '14px 28px', borderRadius: '12px',
                      fontSize: '15px', fontWeight: 800, cursor: 'pointer', width: '100%',
                      boxShadow: '0 8px 20px rgba(16,185,129,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                    }}
                  >
                    <i className="ti ti-login" /> {checkingIn ? 'Marking Check-In...' : 'Mark Check-In (In Campus)'}
                  </button>
                ) : !todayAtt?.check_out_time ? (
                  <button
                    onClick={handleCheckOut} disabled={checkingIn}
                    style={{
                      background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                      color: '#fff', border: 'none', padding: '14px 28px', borderRadius: '12px',
                      fontSize: '15px', fontWeight: 800, cursor: 'pointer', width: '100%',
                      boxShadow: '0 8px 20px rgba(239,68,68,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                    }}
                  >
                    <i className="ti ti-logout" /> {checkingIn ? 'Marking Check-Out...' : 'Mark Check-Out'}
                  </button>
                ) : (
                  <div style={{ background: '#10b98118', color: '#10b981', padding: '12px', borderRadius: '10px', fontWeight: 800, fontSize: '13px' }}>
                    ✅ Attendance Completed for Today
                  </div>
                )}
              </div>

              {/* GPS Information Box */}
              <div style={{ ...cardBg, borderRadius: '18px', border: '1px solid', padding: '24px' }}>
                <h4 style={{ margin: '0 0 14px', fontSize: '15px', fontWeight: 700, color: '#3b82f6' }}>
                  📍 Campus Geofence Verification
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>GPS Status:</span>
                    <b style={{ color: todayAtt?.gps_status === 'OUTSIDE_CAMPUS' ? '#ef4444' : '#10b981' }}>
                      {todayAtt?.gps_status || (coords ? 'Inside Campus Radius' : 'Detecting...')}
                    </b>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Approval Status:</span>
                    <b style={{ color: todayAtt?.approval_status === 'APPROVED' ? '#10b981' : '#f59e0b' }}>
                      {todayAtt?.approval_status || 'NOT_REQUIRED'}
                    </b>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Working Hours:</span>
                    <b>{todayAtt?.working_minutes ? `${Math.floor(todayAtt.working_minutes / 60)}h ${todayAtt.working_minutes % 60}m` : '—'}</b>
                  </div>
                </div>

                <div style={{ marginTop: '20px', background: darkMode ? '#0f172a' : '#f8fafc', padding: '12px', borderRadius: '10px', fontSize: '12px', color: '#64748b', border: '1px solid #e2e8f0' }}>
                  💡 <b>Tip:</b> If on outdoor school duty or event, submit an <b>Official Duty (OD)</b> request to exempt GPS distance checking.
                </div>
              </div>
            </div>
          )}

          {/* ══ TAB 2: My Leaves ══ */}
          {activeTab === 'leaves' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800 }}>My Leave Balances &amp; History</h3>
                <button
                  onClick={() => setShowApplyModal(true)}
                  style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '9px 18px', borderRadius: '8px', fontWeight: 700, fontSize: '12.5px', cursor: 'pointer' }}
                >
                  <i className="ti ti-plus" /> Apply for Leave
                </button>
              </div>

              {/* Balance Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '22px' }}>
                {leaveBalances.map((b) => (
                  <div key={b.id} style={{ ...cardBg, borderRadius: '14px', border: '1px solid', padding: '18px' }}>
                    <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>{b.leave_type_name}</div>
                    <div style={{ fontSize: '26px', fontWeight: 800, color: '#3b82f6', margin: '6px 0' }}>{b.remaining} <span style={{ fontSize: '13px', color: '#64748b' }}>left</span></div>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>Allocated: {b.allocated} • Used: {b.used}</div>
                  </div>
                ))}
              </div>

              {/* My Requests Table */}
              <div style={{ ...cardBg, borderRadius: '16px', border: '1px solid', overflow: 'hidden' }}>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid #e2e8f0', fontWeight: 700 }}>
                  Application History
                </div>
                {myLeaveRequests.length === 0 ? (
                  <p style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>No leave applications submitted yet.</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: darkMode ? '#0f172a' : '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
                        <th style={{ padding: '12px 16px' }}>Leave Type</th>
                        <th style={{ padding: '12px 16px' }}>Duration</th>
                        <th style={{ padding: '12px 16px' }}>Days</th>
                        <th style={{ padding: '12px 16px' }}>Reason</th>
                        <th style={{ padding: '12px 16px' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {myLeaveRequests.map((r) => (
                        <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '12px 16px', fontWeight: 700 }}>{r.leave_type_name}</td>
                          <td style={{ padding: '12px 16px', color: '#64748b' }}>{r.from_date} to {r.to_date}</td>
                          <td style={{ padding: '12px 16px' }}>{r.days_count} {r.is_half_day ? '(Half Day)' : ''}</td>
                          <td style={{ padding: '12px 16px', maxWidth: '200px' }}>{r.reason}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{
                              background: r.status === 'APPROVED' ? '#10b98118' : r.status === 'REJECTED' ? '#ef444418' : '#f59e0b18',
                              color: r.status === 'APPROVED' ? '#10b981' : r.status === 'REJECTED' ? '#ef4444' : '#f59e0b',
                              padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 800
                            }}>
                              {r.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* ══ TAB 3: My Payslips ══ */}
          {activeTab === 'payslips' && (
            <div style={{ ...cardBg, borderRadius: '16px', border: '1px solid', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', fontWeight: 700 }}>
                My Monthly Payslips &amp; Salary History
              </div>
              {payslips.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                  <i className="ti ti-cash" style={{ fontSize: '36px', marginBottom: '8px' }} />
                  <p>No payslips generated yet.</p>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: darkMode ? '#0f172a' : '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
                      <th style={{ padding: '12px 16px' }}>Pay Period</th>
                      <th style={{ padding: '12px 16px' }}>Payable Days</th>
                      <th style={{ padding: '12px 16px' }}>Gross Pay</th>
                      <th style={{ padding: '12px 16px' }}>Deductions</th>
                      <th style={{ padding: '12px 16px' }}>Net Salary</th>
                      <th style={{ padding: '12px 16px' }}>Status</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>Download PDF</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payslips.map((s) => (
                      <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 700 }}>{s.month_name}</td>
                        <td style={{ padding: '12px 16px' }}>{s.payable_days} Days</td>
                        <td style={{ padding: '12px 16px' }}>₹{s.gross_salary?.toLocaleString('en-IN')}</td>
                        <td style={{ padding: '12px 16px', color: '#ef4444' }}>₹{s.total_deductions?.toLocaleString('en-IN')}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 800, color: '#10b981', fontSize: '14px' }}>₹{s.net_salary?.toLocaleString('en-IN')}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ background: '#10b98118', color: '#10b981', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 800 }}>
                            {s.payment_status}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <button
                            onClick={() => window.open(`${api.defaults.baseURL}/hrms/payroll/slips/${s.id}/pdf`, '_blank')}
                            style={{ background: '#2563eb16', color: '#2563eb', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                          >
                            <i className="ti ti-file-download" /> Payslip PDF
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ══ TAB 4: Official Duty ══ */}
          {activeTab === 'official_duty' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800 }}>My Official Outdoor Duties</h3>
                <button
                  onClick={() => setShowOdModal(true)}
                  style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '9px 18px', borderRadius: '8px', fontWeight: 700, fontSize: '12.5px', cursor: 'pointer' }}
                >
                  <i className="ti ti-plus" /> Apply for Official Duty
                </button>
              </div>

              <div style={{ ...cardBg, borderRadius: '16px', border: '1px solid', overflow: 'hidden' }}>
                {odList.length === 0 ? (
                  <p style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>No official duties applied.</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: darkMode ? '#0f172a' : '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
                        <th style={{ padding: '12px 16px' }}>Duty Type</th>
                        <th style={{ padding: '12px 16px' }}>Dates</th>
                        <th style={{ padding: '12px 16px' }}>Location</th>
                        <th style={{ padding: '12px 16px' }}>Purpose</th>
                        <th style={{ padding: '12px 16px' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {odList.map((d) => (
                        <tr key={d.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '12px 16px', fontWeight: 700 }}>{d.duty_type}</td>
                          <td style={{ padding: '12px 16px', color: '#64748b' }}>{d.from_date} to {d.to_date}</td>
                          <td style={{ padding: '12px 16px' }}>📍 {d.location}</td>
                          <td style={{ padding: '12px 16px' }}>{d.purpose}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{
                              background: d.status === 'APPROVED' ? '#10b98118' : d.status === 'REJECTED' ? '#ef444418' : '#f59e0b18',
                              color: d.status === 'APPROVED' ? '#10b981' : d.status === 'REJECTED' ? '#ef4444' : '#f59e0b',
                              padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 800
                            }}>
                              {d.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* ══ TAB 5: My Profile & KYC ══ */}
          {activeTab === 'profile' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
              <div style={{ ...cardBg, borderRadius: '16px', border: '1px solid', padding: '22px' }}>
                <h4 style={{ margin: '0 0 14px', fontSize: '15px', fontWeight: 700, color: '#3b82f6' }}>Personal Information</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Name:</span><b>{u.name}</b></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Email:</span><b>{u.email}</b></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Phone:</span><b>{u.phone || '—'}</b></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>DOB:</span><b>{p.dob || '—'}</b></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Emergency Contact:</span><b>{p.emergency_contact || '—'}</b></div>
                </div>
              </div>

              <div style={{ ...cardBg, borderRadius: '16px', border: '1px solid', padding: '22px' }}>
                <h4 style={{ margin: '0 0 14px', fontSize: '15px', fontWeight: 700, color: '#3b82f6' }}>Bank &amp; KYC Verification</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Bank:</span><b>{p.bank_name || '—'}</b></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Account No:</span><b>{p.account_number || '—'}</b></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>IFSC:</span><b>{p.ifsc_code || '—'}</b></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>PAN No:</span><b>{p.pan_number || '—'}</b></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Aadhaar:</span><b>{p.aadhaar_number || '—'}</b></div>
                </div>
              </div>
            </div>
          )}

          {/* Apply Leave Modal */}
          {showApplyModal && (
            <div style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px'
            }}>
              <div style={{ ...cardBg, borderRadius: '18px', width: '100%', maxWidth: '480px', padding: '24px', border: '1px solid' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: '17px', fontWeight: 800 }}>Apply for Leave</h3>
                <form onSubmit={handleApplyLeave}>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Leave Type *</label>
                    <select
                      required value={leaveForm.leave_type_id}
                      onChange={e => setLeaveForm({ ...leaveForm, leave_type_id: e.target.value })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                    >
                      <option value="">Select Leave Type...</option>
                      {leaveTypes.map(t => <option key={t.id} value={t.id}>{t.name} ({t.code})</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>From Date *</label>
                      <input
                        type="date" required value={leaveForm.from_date}
                        onChange={e => setLeaveForm({ ...leaveForm, from_date: e.target.value })}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>To Date *</label>
                      <input
                        type="date" required value={leaveForm.to_date}
                        onChange={e => setLeaveForm({ ...leaveForm, to_date: e.target.value })}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                      />
                    </div>
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px' }}>
                      <input
                        type="checkbox" checked={leaveForm.is_half_day}
                        onChange={e => setLeaveForm({ ...leaveForm, is_half_day: e.target.checked })}
                      />
                      Half Day Leave
                    </label>
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Reason *</label>
                    <textarea
                      rows={3} required placeholder="Reason for leave request..."
                      value={leaveForm.reason} onChange={e => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button
                      type="button" onClick={() => setShowApplyModal(false)}
                      style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'transparent', cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit" disabled={submittingLeave}
                      style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', background: '#2563eb', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
                    >
                      {submittingLeave ? 'Submitting...' : 'Submit Application'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Apply OD Modal */}
          {showOdModal && (
            <div style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px'
            }}>
              <div style={{ ...cardBg, borderRadius: '18px', width: '100%', maxWidth: '480px', padding: '24px', border: '1px solid' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: '17px', fontWeight: 800 }}>Apply for Official Duty (OD)</h3>
                <form onSubmit={handleApplyOd}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>From Date *</label>
                      <input
                        type="date" required value={odForm.from_date}
                        onChange={e => setOdForm({ ...odForm, from_date: e.target.value })}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>To Date *</label>
                      <input
                        type="date" required value={odForm.to_date}
                        onChange={e => setOdForm({ ...odForm, to_date: e.target.value })}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                      />
                    </div>
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Duty Type</label>
                    <select
                      value={odForm.duty_type} onChange={e => setOdForm({ ...odForm, duty_type: e.target.value })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                    >
                      <option value="EXAM_DUTY">External Exam Duty</option>
                      <option value="SPORTS_EVENT">Sports Event / Meet</option>
                      <option value="SEMINAR_TRAINING">Seminar / Workshop</option>
                      <option value="SCHOOL_EVENT">Outdoor School Event</option>
                      <option value="OTHER">Other Official Work</option>
                    </select>
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Location / Venue *</label>
                    <input
                      type="text" required placeholder="e.g. City Center Exam Hall" value={odForm.location}
                      onChange={e => setOdForm({ ...odForm, location: e.target.value })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                    />
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Purpose / Remarks *</label>
                    <textarea
                      rows={3} required placeholder="State official duties to be performed..."
                      value={odForm.purpose} onChange={e => setOdForm({ ...odForm, purpose: e.target.value })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button
                      type="button" onClick={() => setShowOdModal(false)}
                      style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'transparent', cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit" disabled={submittingOd}
                      style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', background: '#2563eb', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
                    >
                      {submittingOd ? 'Submitting...' : 'Submit OD Request'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
