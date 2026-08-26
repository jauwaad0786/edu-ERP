import React, { useState, useEffect, useRef, useCallback } from 'react';
import transportApi from '../../api/transportApi';
import toast from 'react-hot-toast';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';

const GPS_PING_INTERVAL_MS = 8000; // ping every 8 seconds while RUNNING

export default function DriverMobileApp() {
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('ederp_theme') === 'dark');
  const [loading, setLoading] = useState(true);
  const [home, setHome] = useState(null); // /driver/today response
  const [trip, setTrip] = useState(null); // current trip (RUNNING/PAUSED/SOS/BREAKDOWN)
  const [lastGps, setLastGps] = useState(null); // { latitude, longitude, speed }
  const [battery, setBattery] = useState(null); // 0-100
  const [online, setOnline] = useState(navigator.onLine);
  const [elapsed, setElapsed] = useState(0); // seconds since start_time
  const [busy, setBusy] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [breakdownRemarks, setBreakdownRemarks] = useState('');

  const watchIdRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const elapsedIntervalRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('ederp_theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  // ── Load home screen ──
  const loadHome = useCallback(() => {
    setLoading(true);
    transportApi.driver.today()
      .then(r => {
        const data = r.data.data;
        setHome(data);
        setTrip(data?.current_trip || null);
      })
      .catch(() => toast.error('Data load nahi hua — dobara try karo'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadHome(); }, [loadHome]);

  // ── Online/offline listener ──
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

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

  // ── GPS ping loop while RUNNING ──
  useEffect(() => {
    function stopGpsLoop() {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      clearInterval(pingIntervalRef.current);
      watchIdRef.current = null;
      pingIntervalRef.current = null;
    }

    if (trip && trip.status === 'RUNNING') {
      watchIdRef.current = navigator.geolocation.watchPosition(
        pos => setLastGps({
          latitude: pos.coords.latitude, longitude: pos.coords.longitude,
          speed: pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : 0, // m/s -> km/h
        }),
        () => toast.error('Location access nahi mila — GPS on karo'),
        { enableHighAccuracy: true, maximumAge: 5000 }
      );

      pingIntervalRef.current = setInterval(() => {
        setLastGps(current => {
          if (current) {
            transportApi.driver.pingGps(trip.id, {
              latitude: current.latitude, longitude: current.longitude,
              speed: current.speed, battery_level: battery,
              network_status: online ? 'ONLINE' : 'OFFLINE',
            }).catch(() => { /* silent — next ping will retry */ });
          }
          return current;
        });
      }, GPS_PING_INTERVAL_MS);

      return stopGpsLoop;
    }
    return stopGpsLoop;
  }, [trip?.id, trip?.status, battery, online]);

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
      const pos = await getCurrentPosition();
      const r = await transportApi.driver.startTrip(pos);
      setTrip(r.data.data);
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
    if (!window.confirm('Trip khatam karni hai?')) return;
    setBusy(true);
    try {
      const pos = await getCurrentPosition();
      await transportApi.driver.endTrip(trip.id, pos);
      toast.success('Trip khatam ✅');
      setTrip(null);
      setElapsed(0);
      loadHome();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Nahi hua');
    }
    setBusy(false);
  }

  async function handleSOS() {
    if (!window.confirm('SOS emergency alert bhejni hai? Principal & Admin ko turant alert jayega!')) return;
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

  function fmtDuration(sec) {
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  const isRunning = trip?.status === 'RUNNING';
  const isPaused  = trip?.status === 'PAUSED';
  const isSOS = trip?.status === 'SOS';
  const isBreakdown = trip?.status === 'BREAKDOWN';
  const tripActive = trip && ['RUNNING', 'PAUSED', 'SOS', 'BREAKDOWN'].includes(trip.status);

  return (
    <div className={`app-shell${darkMode ? ' theme-dark' : ''}`}>
      <Sidebar darkMode={darkMode} />
      <div className="main-content">
        <Navbar title="Driver Cockpit &amp; Trip Control" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />
        <div className="page-body" style={{ maxWidth: '900px', margin: '0 auto' }}>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '80px 20px', color: darkMode ? '#94a3b8' : '#64748b' }}>
              <div className="driver-spinner" style={{ margin: '0 auto 16px', width: '40px', height: '40px', border: '4px solid #6366f120', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              <div style={{ fontSize: '20px', fontWeight: 800 }}>Loading Cockpit... / लोड हो रहा है...</div>
            </div>
          ) : !home?.has_vehicle ? (
            <div style={{
              background: darkMode ? '#111827' : '#ffffff',
              border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
              borderRadius: '20px', padding: '60px 24px', textAlign: 'center',
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
                borderRadius: '24px', padding: '26px 30px', marginBottom: '22px',
                background: darkMode
                  ? 'radial-gradient(circle at 85% 20%, rgba(245,158,11,0.25) 0%, transparent 60%), linear-gradient(135deg, #2b1102 0%, #451a03 45%, #0f172a 100%)'
                  : 'radial-gradient(circle at 85% 20%, rgba(255,255,255,0.18) 0%, transparent 50%), linear-gradient(135deg, #78350f 0%, #b45309 35%, #d97706 75%, #f59e0b 100%)',
                color: '#ffffff',
                boxShadow: darkMode
                  ? '0 12px 35px -5px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1)'
                  : '0 15px 35px -5px rgba(217,119,6,0.35), inset 0 1px 0 rgba(255,255,255,0.3)',
                border: darkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(255,255,255,0.25)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '20px'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{
                      padding: '4px 12px', borderRadius: '20px',
                      background: 'rgba(255,255,255,0.2)', fontSize: '11.5px', fontWeight: 800,
                      letterSpacing: '0.05em', textTransform: 'uppercase',
                      backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.25)'
                    }}>
                      🚏 ASSIGNED BUS FLEET
                    </span>
                    {tripActive && (
                      <span style={{
                        padding: '4px 12px', borderRadius: '20px',
                        background: isRunning ? '#10b981' : isPaused ? '#f59e0b' : '#ef4444',
                        color: '#ffffff', fontSize: '11.5px', fontWeight: 800,
                        boxShadow: '0 0 10px rgba(0,0,0,0.2)'
                      }}>
                        {isRunning ? '● LIVE ON ROUTE' : isPaused ? '⏸ PAUSED' : '🚨 ALERT ACTIVE'}
                      </span>
                    )}
                  </div>

                  <h1 style={{ margin: 0, fontSize: '34px', fontWeight: 900, letterSpacing: '-0.02em', color: '#ffffff', textShadow: '0 2px 10px rgba(0,0,0,0.2)' }}>
                    🚌 {home.vehicle_number}
                  </h1>
                  <div style={{ fontSize: '15px', color: 'rgba(255,255,255,0.92)', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                    <i className="ti ti-map-pin" style={{ color: '#fef3c7' }} />
                    <span>{home.route_name || 'Route not assigned'}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                  <div style={{
                    display: 'flex', gap: '12px',
                    background: 'rgba(255,255,255,0.15)', padding: '12px 18px', borderRadius: '16px',
                    backdropFilter: 'blur(8px)', alignItems: 'center', border: '1px solid rgba(255,255,255,0.2)'
                  }}>
                    <div style={{ textAlign: 'center', padding: '0 6px' }}>
                      <div style={{ fontSize: '11px', opacity: 0.85, fontWeight: 700 }}>BATTERY</div>
                      <div style={{ fontSize: '16px', fontWeight: 900 }}>🔋 {battery ?? '--'}%</div>
                    </div>
                    <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.25)' }} />
                    <div style={{ textAlign: 'center', padding: '0 6px' }}>
                      <div style={{ fontSize: '11px', opacity: 0.85, fontWeight: 700 }}>NETWORK</div>
                      <div style={{ fontSize: '16px', fontWeight: 900 }}>{online ? '📶 Online' : '📵 Offline'}</div>
                    </div>
                  </div>

                  {/* Mini Framed 3D Bus */}
                  <div style={{
                    width: '120px', height: '80px', borderRadius: '12px', overflow: 'hidden',
                    background: 'rgba(255,255,255,0.15)', border: '1.5px solid rgba(255,255,255,0.25)',
                    padding: '3px'
                  }}>
                    <img src="/assets/illustrations/transport_hero.jpg" alt="Bus" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '10px' }} />
                  </div>
                </div>
              </div>

              {/* ══ Emergency Status Alert Banners ══ */}
              {isSOS && (
                <div style={{
                  background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
                  borderRadius: '16px', padding: '16px 20px', marginBottom: '20px',
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
                  borderRadius: '16px', padding: '16px 20px', marginBottom: '20px',
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
                display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '24px'
              }}>
                <div style={{
                  background: darkMode ? '#111827' : '#ffffff',
                  border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
                  borderRadius: '16px', padding: '16px 14px', textAlign: 'center',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.04)'
                }}>
                  <div style={{ fontSize: '11.5px', color: darkMode ? '#94a3b8' : '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                    Students / छात्र
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: 900, color: '#6366f1', marginTop: '4px' }}>
                    {home.students_count ?? 0}
                  </div>
                  <div style={{ fontSize: '10.5px', color: darkMode ? '#64748b' : '#94a3b8' }}>Assigned passengers</div>
                </div>

                <div style={{
                  background: darkMode ? '#111827' : '#ffffff',
                  border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
                  borderRadius: '16px', padding: '16px 14px', textAlign: 'center',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.04)'
                }}>
                  <div style={{ fontSize: '11.5px', color: darkMode ? '#94a3b8' : '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                    Speed / गति
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: 900, color: '#10b981', marginTop: '4px' }}>
                    {lastGps?.speed ?? 0} <span style={{ fontSize: '13px', fontWeight: 600 }}>km/h</span>
                  </div>
                  <div style={{ fontSize: '10.5px', color: darkMode ? '#64748b' : '#94a3b8' }}>Live telemetry</div>
                </div>

                <div style={{
                  background: darkMode ? '#111827' : '#ffffff',
                  border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
                  borderRadius: '16px', padding: '16px 14px', textAlign: 'center',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.04)'
                }}>
                  <div style={{ fontSize: '11.5px', color: darkMode ? '#94a3b8' : '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                    Duration / समय
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 900, color: darkMode ? '#ffffff' : '#0f172a', marginTop: '6px', fontFamily: 'monospace' }}>
                    {isRunning ? fmtDuration(elapsed) : '--:--:--'}
                  </div>
                  <div style={{ fontSize: '10.5px', color: darkMode ? '#64748b' : '#94a3b8' }}>Elapsed trip time</div>
                </div>

                <div style={{
                  background: darkMode ? '#111827' : '#ffffff',
                  border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
                  borderRadius: '16px', padding: '16px 14px', textAlign: 'center',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.04)'
                }}>
                  <div style={{ fontSize: '11.5px', color: darkMode ? '#94a3b8' : '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                    GPS Accuracy
                  </div>
                  <div style={{ fontSize: '22px', fontWeight: 900, color: lastGps ? '#10b981' : '#f59e0b', marginTop: '6px' }}>
                    {lastGps ? '🟢 LOCKED' : '🟡 SEARCHING'}
                  </div>
                  <div style={{ fontSize: '10.5px', color: darkMode ? '#64748b' : '#94a3b8' }}>
                    {lastGps ? `${lastGps.latitude.toFixed(4)}, ${lastGps.longitude.toFixed(4)}` : 'Wait for GPS'}
                  </div>
                </div>
              </div>

              {/* ══ Giant Tactile Action Controls ══ */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
                {!tripActive && (
                  <button
                    disabled={busy}
                    onClick={handleStart}
                    style={{
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      color: '#ffffff', border: 'none', borderRadius: '24px',
                      padding: '30px 24px', fontSize: '28px', fontWeight: 900, cursor: 'pointer',
                      boxShadow: '0 10px 25px rgba(16, 185, 129, 0.4)',
                      transition: 'all 0.2s ease', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
                    }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                  >
                    <div>▶️ START TRIP</div>
                    <span style={{ fontSize: '16px', fontWeight: 600, opacity: 0.9, marginTop: '4px' }}>
                      ट्रिप शुरू करें (GPS Live Tracking)
                    </span>
                  </button>
                )}

                {isRunning && (
                  <>
                    <button
                      disabled={busy}
                      onClick={handlePause}
                      style={{
                        background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                        color: '#ffffff', border: 'none', borderRadius: '20px',
                        padding: '24px 20px', fontSize: '24px', fontWeight: 900, cursor: 'pointer',
                        boxShadow: '0 8px 20px rgba(245, 158, 11, 0.35)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center'
                      }}
                    >
                      <div>⏸️ PAUSE TRIP</div>
                      <span style={{ fontSize: '15px', fontWeight: 600, opacity: 0.9, marginTop: '2px' }}>
                        रुकें (Temporary Halt)
                      </span>
                    </button>

                    <button
                      disabled={busy}
                      onClick={handleEnd}
                      style={{
                        background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                        color: '#ffffff', border: 'none', borderRadius: '20px',
                        padding: '24px 20px', fontSize: '24px', fontWeight: 900, cursor: 'pointer',
                        boxShadow: '0 8px 20px rgba(239, 68, 68, 0.35)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center'
                      }}
                    >
                      <div>⏹️ END TRIP</div>
                      <span style={{ fontSize: '15px', fontWeight: 600, opacity: 0.9, marginTop: '2px' }}>
                        ट्रिप खत्म करें (Complete Route)
                      </span>
                    </button>
                  </>
                )}

                {isPaused && (
                  <>
                    <button
                      disabled={busy}
                      onClick={handleResume}
                      style={{
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        color: '#ffffff', border: 'none', borderRadius: '20px',
                        padding: '24px 20px', fontSize: '24px', fontWeight: 900, cursor: 'pointer',
                        boxShadow: '0 8px 20px rgba(16, 185, 129, 0.35)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center'
                      }}
                    >
                      <div>▶️ RESUME TRIP</div>
                      <span style={{ fontSize: '15px', fontWeight: 600, opacity: 0.9, marginTop: '2px' }}>
                        फिर से शुरू करें (Resume Navigation)
                      </span>
                    </button>

                    <button
                      disabled={busy}
                      onClick={handleEnd}
                      style={{
                        background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                        color: '#ffffff', border: 'none', borderRadius: '20px',
                        padding: '24px 20px', fontSize: '24px', fontWeight: 900, cursor: 'pointer',
                        boxShadow: '0 8px 20px rgba(239, 68, 68, 0.35)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center'
                      }}
                    >
                      <div>⏹️ END TRIP</div>
                      <span style={{ fontSize: '15px', fontWeight: 600, opacity: 0.9, marginTop: '2px' }}>
                        ट्रिप खत्म करें
                      </span>
                    </button>
                  </>
                )}

                {/* Secondary Safety / Emergency Triggers */}
                {(isRunning || isPaused) && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginTop: '8px' }}>
                    <button
                      disabled={busy}
                      onClick={handleSOS}
                      style={{
                        background: 'linear-gradient(135deg, #7f1d1d 0%, #450a0a 100%)',
                        color: '#fca5a5', border: '2px solid #ef4444', borderRadius: '16px',
                        padding: '16px', fontSize: '18px', fontWeight: 900, cursor: 'pointer',
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
                        padding: '16px', fontSize: '18px', fontWeight: 900, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                      }}
                    >
                      <span>🔧 Report Breakdown</span>
                    </button>
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
        @media (max-width: 640px) {
          .dash-telemetry-grid { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </div>
  );
}
