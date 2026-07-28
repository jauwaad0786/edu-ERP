// FULL FILE — src/pages/staff-attendance/MyAttendance.jsx
import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api     from '../../api/axios';
import toast   from 'react-hot-toast';

const REASON_OPTIONS = [
  { value: 'FORGOT_CHECKOUT',   label: 'Forgot Checkout' },
  { value: 'LATE_CHECKIN',      label: 'Late Check In' },
  { value: 'WRONG_ATTENDANCE',  label: 'Wrong Attendance' },
  { value: 'MEDICAL',           label: 'Medical Reason' },
  { value: 'NETWORK_ISSUE',     label: 'Network Issue' },
  { value: 'GPS_ISSUE',         label: 'GPS Issue' },
  { value: 'OTHER',             label: 'Other' },
];

export default function MyAttendance() {
  const [darkMode, setDarkMode] = useState(localStorage.getItem('ederp_theme') === 'dark');
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [showRegularize, setShowRegularize] = useState(false);
  const [regForm, setRegForm] = useState({ reason_type: 'FORGOT_CHECKOUT', reason_text: '', requested_check_out: '' });

  const load = () => {
    setLoading(true);
    api.get('/staff-attendance/my-status')
      .then((r) => setStatus(r.data))
      .catch(() => toast.error('Status load nahi hua'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const getLocation = () =>
    new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(pos.coords),
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });

  const handleCheckIn = async () => {
    setWorking(true);
    try {
      const coords = await getLocation();
      await api.post('/staff-attendance/check-in', {
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
        device: navigator.userAgent,
      });
      toast.success('Check-in request bhej di gayi');
      load();
    } catch (err) {
      toast.error(err?.response?.data?.error || err.message || 'Check-in fail ho gaya');
    } finally {
      setWorking(false);
    }
  };

  const handleCheckOut = async () => {
    setWorking(true);
    try {
      let coords = {};
      try { coords = await getLocation(); } catch { /* checkout allowed even without GPS */ }
      await api.post('/staff-attendance/check-out', {
        latitude: coords.latitude, longitude: coords.longitude,
      });
      toast.success('Check-out ho gaya');
      load();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Check-out fail ho gaya');
    } finally {
      setWorking(false);
    }
  };

  const submitRegularization = async () => {
    setWorking(true);
    try {
      await api.post('/staff-attendance/regularization', {
        date: status?.date || new Date().toISOString().slice(0, 10),
        reason_type: regForm.reason_type,
        reason_text: regForm.reason_text,
        requested_check_out: regForm.requested_check_out
          ? new Date(regForm.requested_check_out).toISOString()
          : null,
      });
      toast.success('Regularization request bhej di gayi');
      setShowRegularize(false);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Request fail ho gayi');
    } finally {
      setWorking(false);
    }
  };

  // ── styles ──
  const bg     = darkMode ? '#0f172a' : '#f8fafc';
  const cardBg = darkMode ? '#1e293b' : '#fff';
  const border = darkMode ? '#334155' : '#e2e8f0';
  const text   = darkMode ? '#e2e8f0' : '#0f172a';
  const muted  = darkMode ? '#94a3b8' : '#64748b';
  const card = { background: cardBg, border: `1px solid ${border}`, borderRadius: 16, padding: 24 };

  const statusColor = {
    PRESENT: '#16a34a', LATE: '#d97706', HALF_DAY: '#d97706',
    ABSENT: '#dc2626', MISSING_CHECKOUT: '#dc2626',
  }[status?.status] || muted;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: bg }}>
      <Sidebar darkMode={darkMode} />
      <div style={{ marginLeft: 232, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Navbar title="My Attendance" darkMode={darkMode} onToggleDark={() => setDarkMode((d) => !d)} />

        <div style={{ padding: 24, maxWidth: 520 }}>
          {loading ? (
            <div style={{ color: muted }}>Loading…</div>
          ) : (
            <div style={card}>
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <div style={{ fontSize: 13, color: muted }}>{new Date().toDateString()}</div>
                {status ? (
                  <span style={{
                    display: 'inline-block', marginTop: 8, padding: '4px 14px', borderRadius: 20,
                    fontSize: 12, fontWeight: 700, color: '#fff', background: statusColor,
                  }}>
                    {status.approval_status === 'PENDING' ? 'PENDING APPROVAL' : status.status}
                  </span>
                ) : (
                  <span style={{
                    display: 'inline-block', marginTop: 8, padding: '4px 14px', borderRadius: 20,
                    fontSize: 12, fontWeight: 700, color: '#fff', background: muted,
                  }}>NOT CHECKED IN</span>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: 24 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: muted }}>Check In</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: text }}>
                    {status?.check_in_time ? new Date(status.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: muted }}>Check Out</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: text }}>
                    {status?.check_out_time ? new Date(status.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: muted }}>Working Hrs</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: text }}>{status?.working_hours ?? 0}h</div>
                </div>
              </div>

              {status?.check_in_distance != null && (
                <div style={{ textAlign: 'center', fontSize: 12, color: muted, marginBottom: 20 }}>
                  📍 {status.gps_status?.replace('_', ' ')} — {Math.round(status.check_in_distance)}m from school
                </div>
              )}

              {!status?.check_in_time && (
                <button onClick={handleCheckIn} disabled={working} style={{
                  width: '100%', padding: '14px', borderRadius: 12, border: 'none',
                  background: '#16a34a', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
                }}>
                  {working ? 'Locating…' : '📍 Mark Attendance'}
                </button>
              )}

              {status?.check_in_time && !status?.check_out_time && (
                <button onClick={handleCheckOut} disabled={working} style={{
                  width: '100%', padding: '14px', borderRadius: 12, border: 'none',
                  background: '#dc2626', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
                }}>
                  {working ? 'Please wait…' : '🚪 Check Out'}
                </button>
              )}

              {status?.check_in_time && status?.check_out_time && (
                <div style={{ textAlign: 'center', color: muted, fontSize: 13 }}>Aaj ka attendance complete ho chuka hai. ✅</div>
              )}

              {(status?.status === 'MISSING_CHECKOUT' || status?.check_in_time) && (
                <button onClick={() => setShowRegularize((s) => !s)} style={{
                  width: '100%', marginTop: 12, padding: '10px', borderRadius: 10,
                  border: `1px solid ${border}`, background: 'transparent', color: text,
                  fontSize: 13, cursor: 'pointer',
                }}>
                  {showRegularize ? 'Cancel' : '✏️ Regularize Attendance'}
                </button>
              )}

              {showRegularize && (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${border}` }}>
                  <label style={{ display: 'block', fontSize: 12, color: muted, marginBottom: 6 }}>Reason</label>
                  <select
                    value={regForm.reason_type}
                    onChange={(e) => setRegForm((f) => ({ ...f, reason_type: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${border}`, background: darkMode ? '#0f172a' : '#fff', color: text, marginBottom: 12 }}
                  >
                    {REASON_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>

                  {regForm.reason_type === 'FORGOT_CHECKOUT' && (
                    <>
                      <label style={{ display: 'block', fontSize: 12, color: muted, marginBottom: 6 }}>Requested Check Out Time</label>
                      <input
                        type="datetime-local"
                        value={regForm.requested_check_out}
                        onChange={(e) => setRegForm((f) => ({ ...f, requested_check_out: e.target.value }))}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${border}`, background: darkMode ? '#0f172a' : '#fff', color: text, marginBottom: 12 }}
                      />
                    </>
                  )}

                  <label style={{ display: 'block', fontSize: 12, color: muted, marginBottom: 6 }}>Remarks</label>
                  <textarea
                    rows={3}
                    value={regForm.reason_text}
                    onChange={(e) => setRegForm((f) => ({ ...f, reason_text: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${border}`, background: darkMode ? '#0f172a' : '#fff', color: text, marginBottom: 12, resize: 'vertical' }}
                  />

                  <button onClick={submitRegularization} disabled={working} style={{
                    width: '100%', padding: '10px', borderRadius: 8, border: 'none',
                    background: '#4f46e5', color: '#fff', fontWeight: 600, cursor: 'pointer',
                  }}>
                    {working ? 'Submitting…' : 'Submit Request'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
