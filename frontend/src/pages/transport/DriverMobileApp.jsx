import React, { useState, useEffect, useRef, useCallback } from 'react';
import transportApi from '../../api/transportApi';
import toast from 'react-hot-toast';

/**
 * Driver Mobile App — designed for drivers who may not be highly educated.
 * Rules followed: large buttons, large text, very few options, Hindi/English
 * labels, minimal clicks, no nested menus. No Sidebar/Navbar — full screen,
 * single-purpose UI (opened directly after driver login, no dashboard chrome).
 */

const GPS_PING_INTERVAL_MS = 8000; // ping every 8 seconds while RUNNING

export default function DriverMobileApp() {
  const [loading, setLoading] = useState(true);
  const [home, setHome] = useState(null);       // /driver/today response
  const [trip, setTrip] = useState(null);        // current trip (RUNNING/PAUSED/SOS/BREAKDOWN)
  const [lastGps, setLastGps] = useState(null);   // { latitude, longitude, speed }
  const [battery, setBattery] = useState(null);   // 0-100
  const [online, setOnline] = useState(navigator.onLine);
  const [elapsed, setElapsed] = useState(0);       // seconds since start_time
  const [busy, setBusy] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [breakdownRemarks, setBreakdownRemarks] = useState('');

  const watchIdRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const elapsedIntervalRef = useRef(null);

  // ── Load home screen ──
  const loadHome = useCallback(() => {
    setLoading(true);
    transportApi.driver.today()
      .then(r => {
        const data = r.data.data;
        setHome(data);
        setTrip(data.current_trip || null);
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

  // ── Battery status (best-effort, not all browsers support it) ──
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip?.id, trip?.status]);

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
    if (!window.confirm('SOS emergency alert bhejni hai? Principal ko turant pata chalega.')) return;
    setBusy(true);
    try {
      const r = await transportApi.driver.sos(trip.id);
      setTrip(r.data.data);
      toast.success('SOS bhej diya — madad aa rahi hai');
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

  // ── Styles: everything BIG, high contrast ──
  const page = { minHeight: '100vh', background: '#0f172a', color: '#fff', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif' };
  const bigBtn = (bg) => ({
    background: bg, color: '#fff', border: 'none', borderRadius: 20,
    padding: '28px 20px', fontSize: 26, fontWeight: 800, cursor: 'pointer',
    width: '100%', boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
  });
  const smallBtn = (bg) => ({
    background: bg, color: '#fff', border: 'none', borderRadius: 16,
    padding: '18px 12px', fontSize: 18, fontWeight: 800, cursor: 'pointer', width: '100%',
  });
  const statCard = { background: '#1e293b', borderRadius: 16, padding: '16px 20px', textAlign: 'center' };

  if (loading) {
    return <div style={{ ...page, alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: 22, fontWeight: 700 }}>Loading... / लोड हो रहा है...</div>
    </div>;
  }

  if (!home?.has_vehicle) {
    return <div style={{ ...page, alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
      <div style={{ fontSize: 60, marginBottom: 16 }}>🚌</div>
      <div style={{ fontSize: 22, fontWeight: 700 }}>Koi vehicle assign nahi hai</div>
      <div style={{ fontSize: 16, color: '#94a3b8', marginTop: 8 }}>No vehicle assigned. Admin se contact karo.</div>
    </div>;
  }

  const isRunning = trip?.status === 'RUNNING';
  const isPaused  = trip?.status === 'PAUSED';
  const isSOS = trip?.status === 'SOS';
  const isBreakdown = trip?.status === 'BREAKDOWN';
  const tripActive = trip && ['RUNNING', 'PAUSED', 'SOS', 'BREAKDOWN'].includes(trip.status);

  return (
    <div style={page}>
      {/* ── Header ── */}
      <div style={{ padding: '20px 20px 10px', textAlign: 'center' }}>
        <div style={{ fontSize: 28, fontWeight: 900 }}>🚌 {home.vehicle_number}</div>
        <div style={{ fontSize: 16, color: '#94a3b8', marginTop: 4 }}>{home.route_name || 'Route not set'}</div>
      </div>

      {/* ── Status banner ── */}
      {isSOS && (
        <div style={{ background: '#dc2626', textAlign: 'center', padding: 14, fontSize: 20, fontWeight: 900 }}>
          🚨 SOS ACTIVE — Help is on the way
        </div>
      )}
      {isBreakdown && (
        <div style={{ background: '#d97706', textAlign: 'center', padding: 14, fontSize: 20, fontWeight: 900 }}>
          🔧 BREAKDOWN REPORTED
        </div>
      )}

      {/* ── Quick stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '10px 20px' }}>
        <div style={statCard}>
          <div style={{ fontSize: 13, color: '#94a3b8' }}>Students / छात्र</div>
          <div style={{ fontSize: 26, fontWeight: 900 }}>{home.students_count}</div>
        </div>
        <div style={statCard}>
          <div style={{ fontSize: 13, color: '#94a3b8' }}>Speed / गति</div>
          <div style={{ fontSize: 26, fontWeight: 900 }}>{lastGps?.speed ?? 0} <span style={{ fontSize: 14 }}>km/h</span></div>
        </div>
        <div style={statCard}>
          <div style={{ fontSize: 13, color: '#94a3b8' }}>Trip Duration</div>
          <div style={{ fontSize: 26, fontWeight: 900 }}>{isRunning ? fmtDuration(elapsed) : '--:--:--'}</div>
        </div>
        <div style={statCard}>
          <div style={{ fontSize: 13, color: '#94a3b8' }}>Battery / Net</div>
          <div style={{ fontSize: 18, fontWeight: 900 }}>
            🔋{battery ?? '--'}% {online ? '📶' : '📵'}
          </div>
        </div>
      </div>

      {lastGps && (
        <div style={{ textAlign: 'center', fontSize: 13, color: '#64748b', padding: '4px 20px' }}>
          📍 {lastGps.latitude.toFixed(5)}, {lastGps.longitude.toFixed(5)}
        </div>
      )}

      {/* ── Main action button ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 20, gap: 16 }}>
        {!tripActive && (
          <button disabled={busy} onClick={handleStart} style={bigBtn('#16a34a')}>
            ▶️ START TRIP<br /><span style={{ fontSize: 16, fontWeight: 500 }}>ट्रिप शुरू करें</span>
          </button>
        )}

        {isRunning && (
          <>
            <button disabled={busy} onClick={handlePause} style={bigBtn('#d97706')}>
              ⏸️ PAUSE TRIP<br /><span style={{ fontSize: 16, fontWeight: 500 }}>रुकें</span>
            </button>
            <button disabled={busy} onClick={handleEnd} style={bigBtn('#dc2626')}>
              ⏹️ END TRIP<br /><span style={{ fontSize: 16, fontWeight: 500 }}>ट्रिप खत्म करें</span>
            </button>
          </>
        )}

        {isPaused && (
          <>
            <button disabled={busy} onClick={handleResume} style={bigBtn('#16a34a')}>
              ▶️ RESUME TRIP<br /><span style={{ fontSize: 16, fontWeight: 500 }}>फिर से शुरू करें</span>
            </button>
            <button disabled={busy} onClick={handleEnd} style={bigBtn('#dc2626')}>
              ⏹️ END TRIP<br /><span style={{ fontSize: 16, fontWeight: 500 }}>ट्रिप खत्म करें</span>
            </button>
          </>
        )}

        {(isRunning || isPaused) && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <button disabled={busy} onClick={handleSOS} style={smallBtn('#7f1d1d')}>
              🚨 SOS
            </button>
            <button disabled={busy} onClick={() => setShowBreakdown(true)} style={smallBtn('#78350f')}>
              🔧 Breakdown
            </button>
          </div>
        )}
      </div>

      {/* ── Breakdown modal — kept extremely simple ── */}
      {showBreakdown && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
          <div style={{ background: '#1e293b', borderRadius: 20, padding: 24, width: '100%', maxWidth: 380 }}>
            <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 12 }}>Breakdown Details</div>
            <textarea
              value={breakdownRemarks}
              onChange={e => setBreakdownRemarks(e.target.value)}
              placeholder="Kya problem hai? (optional)"
              rows={3}
              style={{
                width: '100%', padding: 12, fontSize: 16, borderRadius: 12,
                border: '1px solid #334155', background: '#0f172a', color: '#fff', boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 16 }}>
              <button onClick={() => setShowBreakdown(false)} style={smallBtn('#334155')}>Cancel</button>
              <button disabled={busy} onClick={handleBreakdown} style={smallBtn('#d97706')}>Report</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
