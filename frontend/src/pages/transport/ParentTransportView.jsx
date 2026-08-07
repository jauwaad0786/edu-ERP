import React, { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api          from '../../api/axios';
import transportApi from '../../api/transportApi';
import toast from 'react-hot-toast';

const POLL_MS = 10000; // refresh live location every 10s while a trip is running

const TRIP_STATUS_LABEL = {
  NOT_STARTED: 'Trip abhi shuru nahi hui',
  RUNNING:     'Bus chal rahi hai',
  PAUSED:      'Bus rukhi hui hai',
  SOS:         'Emergency — SOS active',
  BREAKDOWN:   'Vehicle breakdown',
  COMPLETED:   'Aaj ki trip khatam ho chuki hai',
};

/**
 * Shared "My Transport" screen — used by BOTH the Student portal and the
 * Parent portal. Logic is identical either way (both roles resolve to the
 * same underlying Student.user_id, see transport_gps.py's _own_student_ids),
 * so this one component is wired into both Sidebars / App.jsx routes rather
 * than duplicating a near-identical file per role.
 */
export default function ParentTransportView() {
  const [darkMode, setDarkMode] = useState(localStorage.getItem('ederp_theme') === 'dark');

  const [studentId, setStudentId] = useState(null);
  const [studentName, setStudentName] = useState('');
  const [loading, setLoading] = useState(true);
  const [trip, setTrip] = useState(null);   // response from /transport/parent/child/<id>/trip
  const [error, setError] = useState('');

  const pollRef = useRef(null);

  // ── Step 1: resolve which student this login belongs to ──
  useEffect(() => {
    api.get('/student/profile')
      .then(r => {
        setStudentId(r.data.id);
        setStudentName(r.data.name || '');
      })
      .catch(() => setError('Student profile nahi mila'));
  }, []);

  // ── Step 2: fetch live transport status for that student ──
  const load = useCallback(() => {
    if (!studentId) return;
    transportApi.parent.childTrip(studentId)
      .then(r => { setTrip(r.data.data); setError(''); })
      .catch(() => setError('Transport status load nahi hua'))
      .finally(() => setLoading(false));
  }, [studentId]);

  useEffect(() => { load(); }, [load]);

  // ── Poll while a trip is actually running/paused ──
  useEffect(() => {
    clearInterval(pollRef.current);
    if (trip && ['RUNNING', 'PAUSED', 'SOS', 'BREAKDOWN'].includes(trip.trip_status)) {
      pollRef.current = setInterval(load, POLL_MS);
    }
    return () => clearInterval(pollRef.current);
  }, [trip, load]);

  function callDriver(mobile) {
    if (!mobile) { toast.error('Driver ka number available nahi hai'); return; }
    window.location.href = `tel:${mobile}`;
  }

  const cardStyle = {
    background: darkMode ? '#1e293b' : '#fff',
    border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
    borderRadius: 16, padding: 24,
  };

  const statusColor = {
    NOT_STARTED: '#94a3b8', RUNNING: '#16a34a', PAUSED: '#d97706',
    SOS: '#dc2626', BREAKDOWN: '#dc2626', COMPLETED: '#64748b',
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: darkMode ? '#0f172a' : '#f8fafc' }}>
      <Sidebar darkMode={darkMode} />
      <div style={{ marginLeft: 232, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Navbar title="My Transport" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />

        <div style={{ padding: 24, maxWidth: 560 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>Loading...</div>
          ) : error ? (
            <div style={{ ...cardStyle, textAlign: 'center', color: '#dc2626' }}>{error}</div>
          ) : !trip?.has_transport ? (
            <div style={{ ...cardStyle, textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>🚌</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: darkMode ? '#f1f5f9' : '#0f172a' }}>
                {studentName ? `${studentName} ` : ''}Transport se abhi assigned nahi hai
              </div>
              <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 6 }}>
                School office se contact karo agar transport chahiye
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Status header */}
              <div style={{ ...cardStyle, textAlign: 'center' }}>
                <div style={{ fontSize: 36, marginBottom: 6 }}>🚌</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: darkMode ? '#f1f5f9' : '#0f172a' }}>
                  {trip.vehicle_number}
                </div>
                <div style={{
                  display: 'inline-block', marginTop: 10, padding: '6px 16px', borderRadius: 20,
                  fontSize: 13, fontWeight: 700, color: '#fff',
                  background: statusColor[trip.trip_status] || '#64748b',
                }}>
                  {TRIP_STATUS_LABEL[trip.trip_status] || trip.trip_status}
                </div>
              </div>

              {/* Live details — only when trip is actually moving */}
              {['RUNNING', 'PAUSED'].includes(trip.trip_status) && (
                <div style={{ ...cardStyle, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>CURRENT SPEED</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: darkMode ? '#f1f5f9' : '#0f172a' }}>
                      {trip.speed ?? 0} <span style={{ fontSize: 13 }}>km/h</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>NEXT STOP</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: darkMode ? '#f1f5f9' : '#0f172a' }}>
                      {trip.next_stop || '—'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>ESTIMATED ARRIVAL</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: darkMode ? '#f1f5f9' : '#0f172a' }}>
                      {trip.eta || '—'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>LAST UPDATED</div>
                    <div style={{ fontSize: 13, color: '#64748b' }}>
                      {trip.last_updated ? new Date(trip.last_updated).toLocaleTimeString() : '—'}
                    </div>
                  </div>
                </div>
              )}

              {trip.trip_status === 'SOS' && (
                <div style={{ ...cardStyle, background: '#fef2f2', border: '1px solid #dc2626', textAlign: 'center' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#dc2626' }}>
                    🚨 Driver ne SOS emergency alert bheja hai. School inform ho chuki hai.
                  </div>
                </div>
              )}
              {trip.trip_status === 'BREAKDOWN' && (
                <div style={{ ...cardStyle, background: '#fffbeb', border: '1px solid #d97706', textAlign: 'center' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#d97706' }}>
                    🔧 Vehicle breakdown ho gayi hai. School alternate arrangement kar rahi hai.
                  </div>
                </div>
              )}

              {/* Driver card */}
              {(trip.driver_name || trip.driver_mobile) && (
                <div style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>DRIVER</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: darkMode ? '#f1f5f9' : '#0f172a' }}>
                      {trip.driver_name || 'Not assigned'}
                    </div>
                  </div>
                  <button onClick={() => callDriver(trip.driver_mobile)} style={{
                    background: '#16a34a', color: '#fff', border: 'none', borderRadius: 10,
                    padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  }}>📞 Call Driver</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
