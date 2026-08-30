import React, { useState, useEffect, useRef, useCallback } from 'react';
import transportApi from '../../api/transportApi';
import toast from 'react-hot-toast';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';

const GPS_PING_INTERVAL_MS = 8000; // ping every 8 seconds while RUNNING
const STOP_POLL_INTERVAL_MS = 10000; // auto-detect stop every 10 seconds

export default function DriverMobileApp() {
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('ederp_theme') === 'dark');
  const [loading, setLoading] = useState(true);
  const [home, setHome] = useState(null); // /driver/today response
  const [trip, setTrip] = useState(null); // current trip
  const [lastGps, setLastGps] = useState(null); // { latitude, longitude, speed }
  const [battery, setBattery] = useState(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [breakdownRemarks, setBreakdownRemarks] = useState('');

  // Route Stops and Student Attendance
  const [stops, setStops] = useState([]);
  const [currentStopIndex, setCurrentStopIndex] = useState(0);
  const [selectedStopId, setSelectedStopId] = useState(null);
  const [studentEvents, setStudentEvents] = useState({}); // { student_id: 'PICKED_UP' | 'DROPPED_OFF' | 'ABSENT' }
  const [manualStopOverride, setManualStopOverride] = useState(false);
  const [manifestFilter, setManifestFilter] = useState('CURRENT_STOP'); // 'CURRENT_STOP' | 'ONBOARD' | 'DROPPED' | 'ALL'
  const [searchQuery, setSearchQuery] = useState('');
  const [tripTab, setTripTab] = useState('CURRENT_STOP'); // 'CURRENT_STOP' | 'ALL_PASSENGERS' | 'ROUTE_MAP'

  const watchIdRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const stopDetectIntervalRef = useRef(null);
  const elapsedIntervalRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('ederp_theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  // ── Load home screen & active trip data ──
  const loadHome = useCallback(() => {
    setLoading(true);
    transportApi.driver.today()
      .then(r => {
        const data = r.data?.data || r.data || {};
        setHome(data);
        const activeTrip = data?.current_trip || null;
        setTrip(activeTrip);
        if (activeTrip) {
          loadTripStops(activeTrip.id);
        } else if (data?.stops && data.stops.length > 0) {
          setStops(data.stops);
          setSelectedStopId(data.stops[0].stop_id);
          const evMap = {};
          data.stops.forEach(s => {
            (s.students || []).forEach(st => {
              if (st.event_status) evMap[st.student_id] = st.event_status;
            });
          });
          setStudentEvents(evMap);
        }
      })
      .catch(err => {
        console.error('Failed to load driver home:', err);
        toast.error(err.response?.data?.message || 'Data load nahi hua — dobara try karo');
      })
      .finally(() => setLoading(false));
  }, []);

  const loadTripStops = async (tripId) => {
    try {
      const res = await transportApi.driver.getStops(tripId);
      const stopsData = res.data.data.stops || [];
      setStops(stopsData);

      // Build initial student events map
      const evMap = {};
      stopsData.forEach(s => {
        (s.students || []).forEach(st => {
          if (st.event_status) evMap[st.student_id] = st.event_status;
        });
      });
      setStudentEvents(evMap);

      if (stopsData.length > 0 && !selectedStopId) {
        setSelectedStopId(stopsData[0].stop_id);
      }
    } catch (e) {
      console.warn('Could not load stops:', e);
    }
  };

  useEffect(() => { loadHome(); }, [loadHome]);

  // ── Online/offline listener & offline queue flush ──
  useEffect(() => {
    const on = () => {
      setOnline(true);
      toast.success('📶 Network Connected');
      flushOfflineQueue();
    };
    const off = () => {
      setOnline(false);
      toast.error('📵 Offline Mode — actions queued');
    };
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  const flushOfflineQueue = async () => {
    try {
      const qStr = localStorage.getItem('ederp_offline_driver_events');
      if (!qStr) return;
      const q = JSON.parse(qStr);
      if (Array.isArray(q) && q.length > 0) {
        for (const item of q) {
          try {
            await transportApi.driver.recordStudentEvent(item.tripId, item.data);
          } catch (err) {}
        }
        localStorage.removeItem('ederp_offline_driver_events');
        toast.success(`Flushed ${q.length} offline actions to server!`);
      }
    } catch (err) {}
  };

  // ── Battery status ──
  useEffect(() => {
    if (navigator.getBattery) {
      navigator.getBattery().then(b => {
        setBattery(Math.round(b.level * 100));
        b.addEventListener('levelchange', () => setBattery(Math.round(b.level * 100)));
      }).catch(() => {});
    }
  }, []);

  // ── Elapsed trip timer ──
  useEffect(() => {
    if (trip && trip.status === 'RUNNING' && trip.start_time) {
      elapsedIntervalRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - new Date(trip.start_time).getTime()) / 1000));
      }, 1000);
    }
    return () => clearInterval(elapsedIntervalRef.current);
  }, [trip]);

  // ── GPS ping & Stop Auto-Detection while RUNNING ──
  useEffect(() => {
    function stopGpsLoop() {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      clearInterval(pingIntervalRef.current);
      clearInterval(stopDetectIntervalRef.current);
      watchIdRef.current = null;
      pingIntervalRef.current = null;
      stopDetectIntervalRef.current = null;
    }

    if (trip && trip.status === 'RUNNING') {
      watchIdRef.current = navigator.geolocation.watchPosition(
        pos => setLastGps({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          speed: pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : 0,
        }),
        () => toast.error('Location access nahi mila — GPS on karo'),
        { enableHighAccuracy: true, maximumAge: 4000 }
      );

      // Periodic GPS Ping
      pingIntervalRef.current = setInterval(() => {
        setLastGps(current => {
          if (current) {
            transportApi.driver.pingGps(trip.id, {
              latitude: current.latitude, longitude: current.longitude,
              speed: current.speed, battery_level: battery,
              network_status: online ? 'ONLINE' : 'OFFLINE',
            }).catch(() => {});
          }
          return current;
        });
      }, GPS_PING_INTERVAL_MS);

      // Periodic Stop Auto-Detection
      stopDetectIntervalRef.current = setInterval(() => {
        setLastGps(current => {
          if (current && !manualStopOverride) {
            transportApi.driver.detectStop(trip.id, {
              latitude: current.latitude, longitude: current.longitude
            }).then(res => {
              const resData = res.data.data;
              if (resData.detected && resData.current_stop) {
                const detectedStop = resData.current_stop;
                setSelectedStopId(detectedStop.stop_id);
                // Update student event status
                setStudentEvents(prev => {
                  const updated = { ...prev };
                  (detectedStop.students || []).forEach(st => {
                    if (st.event_status) updated[st.student_id] = st.event_status;
                  });
                  return updated;
                });
              }
            }).catch(() => {});
          }
          return current;
        });
      }, STOP_POLL_INTERVAL_MS);

      return stopGpsLoop;
    }
    return stopGpsLoop;
  }, [trip?.id, trip?.status, battery, online, manualStopOverride]);

  function getCurrentPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) { reject(new Error('GPS available nahi hai')); return; }
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        () => reject(new Error('Location nahi mili — GPS on karo')),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }

  async function handleStart() {
    setBusy(true);
    try {
      const pos = await getCurrentPosition().catch(() => ({ latitude: null, longitude: null }));
      const r = await transportApi.driver.startTrip(pos);
      const newTrip = r.data.data;
      setTrip(newTrip);
      await loadTripStops(newTrip.id);
      toast.success('Trip shuru ho gayi 🚌');
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Trip start nahi hui');
    }
    setBusy(false);
  }

  async function handlePause() {
    setBusy(true);
    try {
      const r = await transportApi.driver.pauseTrip(trip.id);
      setTrip(r.data.data);
      toast.success('Trip pause ho gayi');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Nahi hua');
    }
    setBusy(false);
  }

  async function handleResume() {
    setBusy(true);
    try {
      const r = await transportApi.driver.resumeTrip(trip.id);
      setTrip(r.data.data);
      toast.success('Trip fir se shuru');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Nahi hua');
    }
    setBusy(false);
  }

  async function handleEnd() {
    if (!window.confirm('Trip khatam karni hai? / Complete Journey?')) return;
    setBusy(true);
    try {
      const pos = await getCurrentPosition().catch(() => ({ latitude: null, longitude: null }));
      await transportApi.driver.endTrip(trip.id, pos);
      toast.success('Trip khatam ✅');
      setTrip(null);
      setElapsed(0);
      setStops([]);
      loadHome();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Nahi hua');
    }
    setBusy(false);
  }

  async function handleSOS() {
    if (!window.confirm('🚨 SOS Emergency Alert भेजना है? Principal को तुरंत alert जाएगा!')) return;
    setBusy(true);
    try {
      const r = await transportApi.driver.sos(trip.id);
      setTrip(r.data.data);
      toast.success('🚨 SOS alert bhej diya gaya — madad aa rahi hai');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Nahi hua');
    }
    setBusy(false);
  }

  async function handleBreakdown() {
    setBusy(true);
    try {
      const r = await transportApi.driver.breakdown(trip.id, { remarks: breakdownRemarks });
      setTrip(r.data.data);
      setShowBreakdown(false);
      setBreakdownRemarks('');
      toast.success('Breakdown report ho gayi');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Nahi hua');
    }
    setBusy(false);
  }

  // ── Record Student Action: Picked up, Dropped off, Absent ──
  const handleStudentEvent = async (studentId, eventType) => {
    if (navigator.vibrate) navigator.vibrate(60);

    // Optimistic UI update
    setStudentEvents(prev => ({ ...prev, [studentId]: eventType }));

    const payload = {
      student_id: studentId,
      event_type: eventType,
      stop_id: selectedStopId,
      latitude: lastGps?.latitude || null,
      longitude: lastGps?.longitude || null,
    };

    if (!online) {
      // Save in offline queue
      const q = JSON.parse(localStorage.getItem('ederp_offline_driver_events') || '[]');
      q.push({ tripId: trip.id, data: payload, time: Date.now() });
      localStorage.setItem('ederp_offline_driver_events', JSON.stringify(q));
      toast('Action saved offline 💾', { icon: '📵' });
      return;
    }

    try {
      await transportApi.driver.recordStudentEvent(trip.id, payload);
      const label = eventType === 'PICKED_UP' ? 'Picked Up 🟢' : eventType === 'DROPPED_OFF' ? 'Dropped Off 🔵' : 'Marked Absent 🔴';
      toast.success(label);
    } catch (err) {
      toast.error('Record nahi hua — retry karo');
    }
  };

  function fmtDuration(sec) {
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  const isRunning = trip?.status === 'RUNNING';
  const isPaused  = trip?.status === 'PAUSED';
  const isSOS = trip?.status === 'SOS';
  const isBreakdown = trip?.status === 'BREAKDOWN';
  const tripActive = trip && ['RUNNING', 'PAUSED', 'SOS', 'BREAKDOWN'].includes(trip.status);

  // Resolve current active stop
  const currentStop = stops.find(s => s.stop_id === selectedStopId) || (stops.length > 0 ? stops[0] : null);
  const currentStopIndexInList = stops.findIndex(s => s.stop_id === (currentStop?.stop_id));
  const nextStop = currentStopIndexInList >= 0 && currentStopIndexInList < stops.length - 1 ? stops[currentStopIndexInList + 1] : null;

  // Flatten all students across all stops
  const allStudents = stops.flatMap(s => (s.students || []).map(st => ({ ...st, stop_name: s.stop_name, assigned_stop_id: s.stop_id })));

  // Live Onboard & Drop Off Passenger Manifest counts
  const pickedUpList = allStudents.filter(st => (studentEvents[st.student_id] || st.event_status) === 'PICKED_UP');
  const droppedOffList = allStudents.filter(st => (studentEvents[st.student_id] || st.event_status) === 'DROPPED_OFF');
  const absentList = allStudents.filter(st => (studentEvents[st.student_id] || st.event_status) === 'ABSENT');
  const pendingList = allStudents.filter(st => {
    const s = studentEvents[st.student_id] || st.event_status;
    return !s || (s !== 'PICKED_UP' && s !== 'DROPPED_OFF' && s !== 'ABSENT');
  });

  const pickedUpCount = pickedUpList.length;
  const droppedOffCount = droppedOffList.length;
  const absentCount = absentList.length;
  const pendingCount = pendingList.length;

  let displayedStudents = [];
  if (manifestFilter === 'CURRENT_STOP') {
    displayedStudents = currentStop?.students || [];
  } else if (manifestFilter === 'ONBOARD') {
    displayedStudents = pickedUpList;
  } else if (manifestFilter === 'DROPPED') {
    displayedStudents = droppedOffList;
  } else {
    displayedStudents = allStudents;
  }

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    displayedStudents = displayedStudents.filter(st =>
      (st.student_name || '').toLowerCase().includes(q) ||
      (st.admission_no || '').toLowerCase().includes(q) ||
      (st.class_name || '').toLowerCase().includes(q) ||
      (st.stop_name || '').toLowerCase().includes(q)
    );
  }

  return (
    <div className={`app-shell${darkMode ? ' theme-dark' : ''}`}>
      <Sidebar darkMode={darkMode} />
      <div className="main-content">
        <Navbar title="Driver Cockpit & Trip Control" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />
        <div className="page-body" style={{ maxWidth: '960px', margin: '0 auto' }}>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '80px 20px', color: darkMode ? '#94a3b8' : '#64748b' }}>
              <div className="driver-spinner" style={{ margin: '0 auto 16px', width: '44px', height: '44px', border: '4px solid #6366f120', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              <div style={{ fontSize: '22px', fontWeight: 800 }}>Loading Cockpit... / लोड हो रहा है...</div>
            </div>
          ) : !home?.has_vehicle ? (
            <div style={{
              background: darkMode ? '#111827' : '#ffffff',
              border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
              borderRadius: '24px', padding: '60px 24px', textAlign: 'center',
              boxShadow: '0 10px 30px rgba(0,0,0,0.1)'
            }}>
              <div style={{ fontSize: '64px', marginBottom: '16px' }}>🚌</div>
              <h2 style={{ fontSize: '24px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a', margin: '0 0 8px' }}>
                Koi Vehicle Assign Nahi Hai
              </h2>
              <p style={{ fontSize: '15px', color: darkMode ? '#94a3b8' : '#64748b', margin: 0 }}>
                No vehicle assigned to your profile. Please contact School Transport Manager or Admin.
              </p>
            </div>
          ) : (
            <>
              {/* ══ Vehicle & Route Hero Header ══ */}
              <div style={{
                position: 'relative', overflow: 'hidden',
                borderRadius: '24px', padding: '24px 28px', marginBottom: '20px',
                background: darkMode
                  ? 'radial-gradient(circle at 85% 20%, rgba(245,158,11,0.25) 0%, transparent 60%), linear-gradient(135deg, #2b1102 0%, #451a03 45%, #0f172a 100%)'
                  : 'radial-gradient(circle at 85% 20%, rgba(255,255,255,0.18) 0%, transparent 50%), linear-gradient(135deg, #78350f 0%, #b45309 35%, #d97706 75%, #f59e0b 100%)',
                color: '#ffffff',
                boxShadow: darkMode
                  ? '0 12px 35px -5px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1)'
                  : '0 15px 35px -5px rgba(217,119,6,0.35), inset 0 1px 0 rgba(255,255,255,0.3)',
                border: darkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(255,255,255,0.25)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{
                      padding: '4px 12px', borderRadius: '20px',
                      background: 'rgba(255,255,255,0.2)', fontSize: '11px', fontWeight: 800,
                      letterSpacing: '0.05em', textTransform: 'uppercase',
                      backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.25)'
                    }}>
                      🚏 ASSIGNED BUS FLEET
                    </span>
                    {tripActive && (
                      <span style={{
                        padding: '4px 12px', borderRadius: '20px',
                        background: isRunning ? '#10b981' : isPaused ? '#f59e0b' : '#ef4444',
                        color: '#ffffff', fontSize: '11px', fontWeight: 800,
                        boxShadow: '0 0 10px rgba(0,0,0,0.2)'
                      }}>
                        {isRunning ? '● LIVE ON ROUTE' : isPaused ? '⏸ PAUSED' : '🚨 ALERT ACTIVE'}
                      </span>
                    )}
                  </div>

                  <h1 style={{ margin: 0, fontSize: '32px', fontWeight: 900, letterSpacing: '-0.02em', color: '#ffffff' }}>
                    🚌 {home.vehicle_number}
                  </h1>
                  <div style={{ fontSize: '14.5px', color: 'rgba(255,255,255,0.92)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                    <i className="ti ti-map-pin" style={{ color: '#fef3c7' }} />
                    <span>{home.route_name || 'Route not assigned'}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{
                    display: 'flex', gap: '12px',
                    background: 'rgba(255,255,255,0.15)', padding: '10px 16px', borderRadius: '14px',
                    backdropFilter: 'blur(8px)', alignItems: 'center', border: '1px solid rgba(255,255,255,0.2)'
                  }}>
                    <div style={{ textAlign: 'center', padding: '0 4px' }}>
                      <div style={{ fontSize: '10px', opacity: 0.85, fontWeight: 700 }}>BATTERY</div>
                      <div style={{ fontSize: '15px', fontWeight: 900 }}>🔋 {battery ?? '--'}%</div>
                    </div>
                    <div style={{ width: '1px', height: '22px', background: 'rgba(255,255,255,0.25)' }} />
                    <div style={{ textAlign: 'center', padding: '0 4px' }}>
                      <div style={{ fontSize: '10px', opacity: 0.85, fontWeight: 700 }}>NETWORK</div>
                      <div style={{ fontSize: '15px', fontWeight: 900 }}>{online ? '📶 Online' : '📵 Offline'}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ══ Emergency Status Alert Banners ══ */}
              {isSOS && (
                <div style={{
                  background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
                  borderRadius: '16px', padding: '16px 20px', marginBottom: '18px',
                  color: '#ffffff', textAlign: 'center', boxShadow: '0 8px 24px rgba(220, 38, 38, 0.4)',
                  animation: 'pulse 1.5s infinite'
                }}>
                  <div style={{ fontSize: '22px', fontWeight: 900 }}>🚨 SOS EMERGENCY ACTIVE</div>
                  <div style={{ fontSize: '13px', opacity: 0.9, marginTop: '4px' }}>
                    School Administration and Support team have received your live location alert!
                  </div>
                </div>
              )}

              {isBreakdown && (
                <div style={{
                  background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
                  borderRadius: '16px', padding: '16px 20px', marginBottom: '18px',
                  color: '#ffffff', textAlign: 'center', boxShadow: '0 8px 24px rgba(217, 119, 6, 0.4)'
                }}>
                  <div style={{ fontSize: '20px', fontWeight: 900 }}>🔧 BREAKDOWN REPORTED</div>
                  <div style={{ fontSize: '13px', opacity: 0.9, marginTop: '4px' }}>
                    Maintenance team has been dispatched to your vehicle location.
                  </div>
                </div>
              )}

              {/* ══ Telemetry Cards Grid ══ */}
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px'
              }}>
                <div style={{
                  background: darkMode ? '#111827' : '#ffffff',
                  border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
                  borderRadius: '16px', padding: '14px 12px', textAlign: 'center',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.04)'
                }}>
                  <div style={{ fontSize: '11px', color: darkMode ? '#94a3b8' : '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                    Passengers
                  </div>
                  <div style={{ fontSize: '26px', fontWeight: 900, color: '#6366f1', marginTop: '2px' }}>
                    {home.students_count ?? 0}
                  </div>
                  <div style={{ fontSize: '10px', color: darkMode ? '#64748b' : '#94a3b8' }}>Total assigned</div>
                </div>

                <div style={{
                  background: darkMode ? '#111827' : '#ffffff',
                  border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
                  borderRadius: '16px', padding: '14px 12px', textAlign: 'center',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.04)'
                }}>
                  <div style={{ fontSize: '11px', color: darkMode ? '#94a3b8' : '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                    Speed
                  </div>
                  <div style={{ fontSize: '26px', fontWeight: 900, color: '#10b981', marginTop: '2px' }}>
                    {lastGps?.speed ?? 0} <span style={{ fontSize: '12px', fontWeight: 600 }}>km/h</span>
                  </div>
                  <div style={{ fontSize: '10px', color: darkMode ? '#64748b' : '#94a3b8' }}>Live GPS</div>
                </div>

                <div style={{
                  background: darkMode ? '#111827' : '#ffffff',
                  border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
                  borderRadius: '16px', padding: '14px 12px', textAlign: 'center',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.04)'
                }}>
                  <div style={{ fontSize: '11px', color: darkMode ? '#94a3b8' : '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                    Duration
                  </div>
                  <div style={{ fontSize: '22px', fontWeight: 900, color: darkMode ? '#ffffff' : '#0f172a', marginTop: '4px', fontFamily: 'monospace' }}>
                    {isRunning ? fmtDuration(elapsed) : '--:--:--'}
                  </div>
                  <div style={{ fontSize: '10px', color: darkMode ? '#64748b' : '#94a3b8' }}>Elapsed time</div>
                </div>

                <div style={{
                  background: darkMode ? '#111827' : '#ffffff',
                  border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
                  borderRadius: '16px', padding: '14px 12px', textAlign: 'center',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.04)'
                }}>
                  <div style={{ fontSize: '11px', color: darkMode ? '#94a3b8' : '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                    GPS Lock
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 900, color: lastGps ? '#10b981' : '#f59e0b', marginTop: '4px' }}>
                    {lastGps ? '🟢 LOCKED' : '🟡 SEARCHING'}
                  </div>
                  <div style={{ fontSize: '10px', color: darkMode ? '#64748b' : '#94a3b8' }}>
                    {lastGps ? `${lastGps.latitude.toFixed(3)}, ${lastGps.longitude.toFixed(3)}` : 'Wait for GPS'}
                  </div>
                </div>
              </div>

              {/* ══ Giant Tactile Action Controls ══ */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '22px' }}>
                {!tripActive && (
                  <button
                    disabled={busy}
                    onClick={handleStart}
                    style={{
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      color: '#ffffff', border: 'none', borderRadius: '24px',
                      padding: '28px 24px', fontSize: '28px', fontWeight: 900, cursor: 'pointer',
                      boxShadow: '0 10px 25px rgba(16, 185, 129, 0.4)',
                      transition: 'all 0.2s ease', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
                    }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                  >
                    <div>▶️ START JOURNEY</div>
                    <span style={{ fontSize: '16px', fontWeight: 600, opacity: 0.9, marginTop: '4px' }}>
                      सफ़र शुरू करें (Live GPS & Stop Detection Active)
                    </span>
                  </button>
                )}

                {isRunning && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <button
                      disabled={busy}
                      onClick={handlePause}
                      style={{
                        background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                        color: '#ffffff', border: 'none', borderRadius: '20px',
                        padding: '22px 18px', fontSize: '22px', fontWeight: 900, cursor: 'pointer',
                        boxShadow: '0 8px 20px rgba(245, 158, 11, 0.35)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center'
                      }}
                    >
                      <div>⏸️ PAUSE TRIP</div>
                      <span style={{ fontSize: '13px', fontWeight: 600, opacity: 0.9, marginTop: '2px' }}>
                        रुकें (Temporary Halt)
                      </span>
                    </button>

                    <button
                      disabled={busy}
                      onClick={handleEnd}
                      style={{
                        background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                        color: '#ffffff', border: 'none', borderRadius: '20px',
                        padding: '22px 18px', fontSize: '22px', fontWeight: 900, cursor: 'pointer',
                        boxShadow: '0 8px 20px rgba(239, 68, 68, 0.35)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center'
                      }}
                    >
                      <div>⏹️ END JOURNEY</div>
                      <span style={{ fontSize: '13px', fontWeight: 600, opacity: 0.9, marginTop: '2px' }}>
                        सफ़र खत्म करें (Complete Route)
                      </span>
                    </button>
                  </div>
                )}

                {isPaused && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <button
                      disabled={busy}
                      onClick={handleResume}
                      style={{
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        color: '#ffffff', border: 'none', borderRadius: '20px',
                        padding: '22px 18px', fontSize: '22px', fontWeight: 900, cursor: 'pointer',
                        boxShadow: '0 8px 20px rgba(16, 185, 129, 0.35)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center'
                      }}
                    >
                      <div>▶️ RESUME TRIP</div>
                      <span style={{ fontSize: '13px', fontWeight: 600, opacity: 0.9, marginTop: '2px' }}>
                        फिर से शुरू करें (Resume)
                      </span>
                    </button>

                    <button
                      disabled={busy}
                      onClick={handleEnd}
                      style={{
                        background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                        color: '#ffffff', border: 'none', borderRadius: '20px',
                        padding: '22px 18px', fontSize: '22px', fontWeight: 900, cursor: 'pointer',
                        boxShadow: '0 8px 20px rgba(239, 68, 68, 0.35)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center'
                      }}
                    >
                      <div>⏹️ END JOURNEY</div>
                      <span style={{ fontSize: '13px', fontWeight: 600, opacity: 0.9, marginTop: '2px' }}>
                        सफ़र खत्म करें
                      </span>
                    </button>
                  </div>
                )}

                {/* Secondary Safety / Emergency Triggers */}
                {(isRunning || isPaused) && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <button
                      disabled={busy}
                      onClick={handleSOS}
                      style={{
                        background: 'linear-gradient(135deg, #7f1d1d 0%, #450a0a 100%)',
                        color: '#fca5a5', border: '2px solid #ef4444', borderRadius: '16px',
                        padding: '14px', fontSize: '17px', fontWeight: 900, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                      }}
                    >
                      <span>🚨 SOS EMERGENCY</span>
                    </button>

                    <button
                      disabled={busy}
                      onClick={() => setShowBreakdown(true)}
                      style={{
                        background: darkMode ? '#1e293b' : '#f8fafc',
                        color: '#d97706', border: '2px solid #f59e0b', borderRadius: '16px',
                        padding: '14px', fontSize: '17px', fontWeight: 900, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                      }}
                    >
                      <span>🔧 Report Breakdown</span>
                    </button>
                  </div>
                )}
              </div>

              {/* ══ Live Passenger Manifest & Onboard / Dropoff Status Strip ══ */}
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginBottom: '20px'
              }}>
                {/* 1. Onboard / Bus Mein Hain */}
                <div
                  onClick={() => setManifestFilter('ONBOARD')}
                  style={{
                    background: darkMode ? '#064e3b30' : '#ecfdf5',
                    border: `2px solid ${manifestFilter === 'ONBOARD' ? '#10b981' : (darkMode ? '#064e3b60' : '#a7f3d0')}`,
                    borderRadius: '16px', padding: '14px 12px', textAlign: 'center', cursor: 'pointer',
                    boxShadow: manifestFilter === 'ONBOARD' ? '0 4px 16px rgba(16,185,129,0.3)' : 'none',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#10b981', letterSpacing: '0.04em' }}>
                    🟢 BUS MEIN HAIN
                  </div>
                  <div style={{ fontSize: '26px', fontWeight: 900, color: '#10b981', marginTop: '2px' }}>
                    {pickedUpCount}
                  </div>
                  <div style={{ fontSize: '10.5px', color: darkMode ? '#94a3b8' : '#059669', fontWeight: 600 }}>
                    Picked Up (Onboard)
                  </div>
                </div>

                {/* 2. Dropped Off / Utar Gaye */}
                <div
                  onClick={() => setManifestFilter('DROPPED')}
                  style={{
                    background: darkMode ? '#1e3a8a30' : '#eff6ff',
                    border: `2px solid ${manifestFilter === 'DROPPED' ? '#3b82f6' : (darkMode ? '#1e3a8a60' : '#bfdbfe')}`,
                    borderRadius: '16px', padding: '14px 12px', textAlign: 'center', cursor: 'pointer',
                    boxShadow: manifestFilter === 'DROPPED' ? '0 4px 16px rgba(59,130,246,0.3)' : 'none',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#3b82f6', letterSpacing: '0.04em' }}>
                    🔵 DROP HO GAYE
                  </div>
                  <div style={{ fontSize: '26px', fontWeight: 900, color: '#3b82f6', marginTop: '2px' }}>
                    {droppedOffCount}
                  </div>
                  <div style={{ fontSize: '10.5px', color: darkMode ? '#94a3b8' : '#2563eb', fontWeight: 600 }}>
                    Dropped Off (Safe)
                  </div>
                </div>

                {/* 3. Absent / Nahi Aaye */}
                <div
                  onClick={() => setManifestFilter('ALL')}
                  style={{
                    background: darkMode ? '#7f1d1d30' : '#fef2f2',
                    border: `2px solid ${darkMode ? '#7f1d1d60' : '#fecaca'}`,
                    borderRadius: '16px', padding: '14px 12px', textAlign: 'center', cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#ef4444', letterSpacing: '0.04em' }}>
                    🔴 ABSENT
                  </div>
                  <div style={{ fontSize: '26px', fontWeight: 900, color: '#ef4444', marginTop: '2px' }}>
                    {absentCount}
                  </div>
                  <div style={{ fontSize: '10.5px', color: darkMode ? '#94a3b8' : '#dc2626', fontWeight: 600 }}>
                    Ghar Pe Hain
                  </div>
                </div>

                {/* 4. Pending / Baki Hain */}
                <div
                  onClick={() => setManifestFilter('ALL')}
                  style={{
                    background: darkMode ? '#78350f30' : '#fffbeb',
                    border: `2px solid ${darkMode ? '#78350f60' : '#fde68a'}`,
                    borderRadius: '16px', padding: '14px 12px', textAlign: 'center', cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#f59e0b', letterSpacing: '0.04em' }}>
                    ⏳ BAKI HAIN
                  </div>
                  <div style={{ fontSize: '26px', fontWeight: 900, color: '#f59e0b', marginTop: '2px' }}>
                    {pendingCount}
                  </div>
                  <div style={{ fontSize: '10.5px', color: darkMode ? '#94a3b8' : '#d97706', fontWeight: 600 }}>
                    Pending Pickup/Drop
                  </div>
                </div>
              </div>

              {/* ══ Live Stops & Student Pickup/Drop Roster ══ */}
              <div style={{
                background: darkMode ? '#111827' : '#ffffff',
                borderRadius: '24px', padding: '24px',
                border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
                boxShadow: '0 8px 30px rgba(0,0,0,0.06)', marginBottom: '24px'
              }}>
                {tripActive && stops.length > 0 && (
                  <>
                    {/* Stop Navigation Header & Manual Selector */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '18px' }}>
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 800, color: '#6366f1', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                          📍 ACTIVE STOP SELECTION
                        </div>
                        <div style={{ fontSize: '24px', fontWeight: 900, color: darkMode ? '#ffffff' : '#0f172a', marginTop: '2px' }}>
                          {currentStop ? currentStop.stop_name : 'Selecting Stop...'}
                          <span style={{ fontSize: '14px', fontWeight: 700, color: darkMode ? '#94a3b8' : '#64748b', marginLeft: '10px' }}>
                            (Stop {currentStopIndexInList + 1} of {stops.length})
                          </span>
                        </div>
                      </div>

                      {/* Manual Stop Selector Override */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: darkMode ? '#94a3b8' : '#64748b' }}>
                          Change Stop:
                        </span>
                        <select
                          value={selectedStopId || ''}
                          onChange={e => {
                            setSelectedStopId(parseInt(e.target.value, 10));
                            setManualStopOverride(true);
                            setManifestFilter('CURRENT_STOP');
                          }}
                          style={{
                            padding: '8px 12px', borderRadius: '12px', fontSize: '14px', fontWeight: 700,
                            background: darkMode ? '#1e293b' : '#f8fafc',
                            color: darkMode ? '#ffffff' : '#0f172a',
                            border: `1px solid ${darkMode ? '#334155' : '#cbd5e1'}`, outline: 'none'
                          }}
                        >
                          {stops.map(s => (
                            <option key={s.stop_id} value={s.stop_id}>
                              #{s.sequence} {s.stop_name} ({s.students_count || 0} students)
                            </option>
                          ))}
                        </select>
                        {manualStopOverride && (
                          <button
                            onClick={() => { setManualStopOverride(false); toast.success('Auto GPS stop detection active'); }}
                            style={{
                              padding: '8px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 800,
                              background: '#6366f1', color: '#ffffff', border: 'none', cursor: 'pointer'
                            }}
                          >
                            Auto-Detect
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Next Stop Indicator */}
                    {nextStop && (
                      <div style={{
                        background: darkMode ? 'rgba(99,102,241,0.1)' : '#eef2ff',
                        border: `1px dashed ${darkMode ? 'rgba(99,102,241,0.3)' : '#c7d2fe'}`,
                        borderRadius: '14px', padding: '12px 16px', marginBottom: '18px',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                      }}>
                        <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#6366f1' }}>
                          ⏩ NEXT STOP: <strong>{nextStop.stop_name}</strong> {nextStop.estimated_time ? `(~${nextStop.estimated_time})` : ''}
                        </div>
                        <span style={{ fontSize: '12px', fontWeight: 800, color: '#4f46e5' }}>
                          {nextStop.students_count || 0} Passengers waiting
                        </span>
                      </div>
                    )}
                  </>
                )}

                {/* ══ Passenger Manifest Filter Tabs & Search ══ */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {tripActive && (
                      <button
                        onClick={() => setManifestFilter('CURRENT_STOP')}
                        style={{
                          padding: '10px 16px', borderRadius: '12px', fontSize: '13px', fontWeight: 800, cursor: 'pointer', border: 'none',
                          background: manifestFilter === 'CURRENT_STOP' ? '#6366f1' : (darkMode ? '#1e293b' : '#f1f5f9'),
                          color: manifestFilter === 'CURRENT_STOP' ? '#ffffff' : (darkMode ? '#94a3b8' : '#475569')
                        }}
                      >
                        📍 Is Stop Ke Bacche ({currentStop?.students?.length || 0})
                      </button>
                    )}

                    <button
                      onClick={() => setManifestFilter('ONBOARD')}
                      style={{
                        padding: '10px 16px', borderRadius: '12px', fontSize: '13px', fontWeight: 800, cursor: 'pointer', border: 'none',
                        background: manifestFilter === 'ONBOARD' ? '#10b981' : (darkMode ? '#1e293b' : '#f1f5f9'),
                        color: manifestFilter === 'ONBOARD' ? '#ffffff' : (darkMode ? '#94a3b8' : '#475569')
                      }}
                    >
                      🟢 Bus Mein Kaun Hain ({pickedUpCount})
                    </button>

                    <button
                      onClick={() => setManifestFilter('DROPPED')}
                      style={{
                        padding: '10px 16px', borderRadius: '12px', fontSize: '13px', fontWeight: 800, cursor: 'pointer', border: 'none',
                        background: manifestFilter === 'DROPPED' ? '#3b82f6' : (darkMode ? '#1e293b' : '#f1f5f9'),
                        color: manifestFilter === 'DROPPED' ? '#ffffff' : (darkMode ? '#94a3b8' : '#475569')
                      }}
                    >
                      🔵 Drop Ho Gaye ({droppedOffCount})
                    </button>

                    <button
                      onClick={() => setManifestFilter('ALL')}
                      style={{
                        padding: '10px 16px', borderRadius: '12px', fontSize: '13px', fontWeight: 800, cursor: 'pointer', border: 'none',
                        background: manifestFilter === 'ALL' ? '#0f172a' : (darkMode ? '#1e293b' : '#f1f5f9'),
                        color: manifestFilter === 'ALL' ? '#ffffff' : (darkMode ? '#94a3b8' : '#475569')
                      }}
                    >
                      👥 Sabhi Passengers ({allStudents.length})
                    </button>
                  </div>

                  {/* Quick Search */}
                  <div style={{ position: 'relative', width: '220px' }}>
                    <i className="ti ti-search" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input
                      type="text"
                      placeholder="Search bacche ka naam..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      style={{
                        width: '100%', padding: '9px 12px 9px 36px', borderRadius: '12px', fontSize: '13px',
                        background: darkMode ? '#1e293b' : '#f8fafc', color: darkMode ? '#ffffff' : '#0f172a',
                        border: `1px solid ${darkMode ? '#334155' : '#cbd5e1'}`, outline: 'none'
                      }}
                    />
                  </div>
                </div>

                {/* ══ Student Passenger Cards List ══ */}
                {displayedStudents.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: darkMode ? '#94a3b8' : '#64748b' }}>
                    <div style={{ fontSize: '36px', marginBottom: '8px' }}>
                      {manifestFilter === 'ONBOARD' ? '🚍' : manifestFilter === 'DROPPED' ? '🏠' : '🚏'}
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a' }}>
                      {manifestFilter === 'ONBOARD'
                        ? 'Abhi Bus Mein Koi Baccha Nahi Hai'
                        : manifestFilter === 'DROPPED'
                        ? 'Abhi Tak Koi Baccha Drop Nahi Hua Hai'
                        : manifestFilter === 'CURRENT_STOP'
                        ? 'Is Stop Pe Koi Baccha Assigned Nahi Hai'
                        : 'Koi Record Nahi Mila'}
                    </div>
                    <p style={{ fontSize: '13px', margin: '4px 0 0' }}>
                      {manifestFilter === 'ONBOARD'
                        ? 'Bacchon ko board karne ke liye "🟢 Bus Mein Liya" button dabayein.'
                        : 'Check other tabs or proceed with journey.'}
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {displayedStudents.map(st => {
                      const status = studentEvents[st.student_id] || st.event_status;
                      const isOnboard = status === 'PICKED_UP';
                      const isDropped = status === 'DROPPED_OFF';
                      const isAbsent = status === 'ABSENT';

                      return (
                        <div
                          key={st.student_id}
                          style={{
                            background: darkMode ? '#1e293b' : '#f8fafc',
                            border: `2px solid ${
                              isOnboard ? '#10b981' :
                              isDropped ? '#3b82f6' :
                              isAbsent ? '#ef4444' :
                              (darkMode ? 'rgba(255,255,255,0.06)' : '#e2e8f0')
                            }`,
                            borderRadius: '18px', padding: '16px 20px',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                            <div style={{
                              width: '48px', height: '48px', borderRadius: '50%',
                              background: isOnboard ? '#10b98120' : isDropped ? '#3b82f620' : isAbsent ? '#ef444420' : '#6366f120',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '20px', fontWeight: 900,
                              color: isOnboard ? '#10b981' : isDropped ? '#3b82f6' : isAbsent ? '#ef4444' : '#6366f1'
                            }}>
                              {st.photo_url ? (
                                <img src={st.photo_url} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                              ) : (
                                st.student_name ? st.student_name[0].toUpperCase() : 'S'
                              )}
                            </div>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '18px', fontWeight: 900, color: darkMode ? '#ffffff' : '#0f172a' }}>
                                  {st.student_name}
                                </span>
                                <span style={{
                                  padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 800,
                                  background: isOnboard ? '#10b98120' : isDropped ? '#3b82f620' : isAbsent ? '#ef444420' : '#f1f5f9',
                                  color: isOnboard ? '#10b981' : isDropped ? '#3b82f6' : isAbsent ? '#ef4444' : '#64748b'
                                }}>
                                  {isOnboard ? '🟢 Bus Mein Hai' : isDropped ? '🔵 Drop Ho Gaya' : isAbsent ? '🔴 Absent' : '⏳ Baki Hai'}
                                </span>
                              </div>
                              <div style={{ fontSize: '13px', color: darkMode ? '#94a3b8' : '#64748b', fontWeight: 600 }}>
                                Adm: {st.admission_no || '--'} • {st.class_name || 'Class N/A'} • 🚏 {st.stop_name || 'Assigned Stop'}
                              </div>
                              {st.father_mobile && (
                                <a
                                  href={`tel:${st.father_mobile}`}
                                  style={{
                                    fontSize: '12px', color: '#10b981', fontWeight: 700, marginTop: '3px',
                                    display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none'
                                  }}
                                >
                                  📞 Call Parent ({st.father_mobile})
                                </a>
                              )}
                            </div>
                          </div>

                          {/* One-Tap Tactile Action Buttons */}
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <button
                              onClick={() => handleStudentEvent(st.student_id, 'PICKED_UP')}
                              style={{
                                background: isOnboard ? '#10b981' : (darkMode ? '#0f172a' : '#ffffff'),
                                color: isOnboard ? '#ffffff' : '#10b981',
                                border: '2px solid #10b981', borderRadius: '14px',
                                padding: '12px 18px', fontSize: '15px', fontWeight: 900, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: '6px',
                                boxShadow: isOnboard ? '0 4px 12px rgba(16,185,129,0.4)' : 'none'
                              }}
                            >
                              <span>🟢 Bus Mein Liya</span>
                            </button>

                            <button
                              onClick={() => handleStudentEvent(st.student_id, 'DROPPED_OFF')}
                              style={{
                                background: isDropped ? '#3b82f6' : (darkMode ? '#0f172a' : '#ffffff'),
                                color: isDropped ? '#ffffff' : '#3b82f6',
                                border: '2px solid #3b82f6', borderRadius: '14px',
                                padding: '12px 18px', fontSize: '15px', fontWeight: 900, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: '6px',
                                boxShadow: isDropped ? '0 4px 12px rgba(59,130,246,0.4)' : 'none'
                              }}
                            >
                              <span>🔵 Drop Kiya</span>
                            </button>

                            <button
                              onClick={() => handleStudentEvent(st.student_id, 'ABSENT')}
                              style={{
                                background: isAbsent ? '#ef4444' : (darkMode ? '#0f172a' : '#ffffff'),
                                color: isAbsent ? '#ffffff' : '#ef4444',
                                border: '2px solid #ef4444', borderRadius: '14px',
                                padding: '12px 14px', fontSize: '14px', fontWeight: 900, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: '4px',
                                boxShadow: isAbsent ? '0 4px 12px rgba(239,68,68,0.4)' : 'none'
                              }}
                            >
                              <span>🔴 Absent</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ══ Breakdown Modal ══ */}
              {showBreakdown && (
                <div style={{
                  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
                  zIndex: 9999, backdropFilter: 'blur(6px)'
                }}>
                  <div style={{
                    background: darkMode ? '#111827' : '#ffffff',
                    borderRadius: '24px', padding: '28px 24px', width: '100%', maxWidth: '440px',
                    border: `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`,
                    boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
                  }}>
                    <div style={{ fontSize: '22px', fontWeight: 900, color: darkMode ? '#ffffff' : '#0f172a', marginBottom: '8px' }}>
                      🔧 Report Vehicle Breakdown
                    </div>
                    <p style={{ fontSize: '13px', color: darkMode ? '#94a3b8' : '#64748b', margin: '0 0 16px' }}>
                      Kripya problem ka chhota sa description likhein:
                    </p>

                    <textarea
                      value={breakdownRemarks}
                      onChange={e => setBreakdownRemarks(e.target.value)}
                      placeholder="e.g. Engine heat problem, flat tire near main junction..."
                      rows={3}
                      style={{
                        width: '100%', padding: '12px 14px', fontSize: '15px', borderRadius: '12px',
                        border: `1px solid ${darkMode ? '#334155' : '#cbd5e1'}`,
                        background: darkMode ? '#0f172a' : '#f8fafc',
                        color: darkMode ? '#ffffff' : '#0f172a',
                        boxSizing: 'border-box', outline: 'none', resize: 'vertical'
                      }}
                    />

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '20px' }}>
                      <button
                        onClick={() => setShowBreakdown(false)}
                        style={{
                          background: darkMode ? '#1e293b' : '#f1f5f9',
                          color: darkMode ? '#e2e8f0' : '#475569',
                          border: 'none', borderRadius: '12px', padding: '14px',
                          fontSize: '15px', fontWeight: 700, cursor: 'pointer'
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        disabled={busy}
                        onClick={handleBreakdown}
                        style={{
                          background: '#f59e0b', color: '#ffffff',
                          border: 'none', borderRadius: '12px', padding: '14px',
                          fontSize: '15px', fontWeight: 800, cursor: 'pointer'
                        }}
                      >
                        Send Report
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

        </div>
      </div>

      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.85; } }
      `}</style>
    </div>
  );
}
