import React, { useState, useEffect, useRef, useCallback } from 'react';
import Sidebar      from '../../components/Sidebar';
import Navbar        from '../../components/Navbar';
import transportApi  from '../../api/transportApi';
import toast          from 'react-hot-toast';
import L               from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Default to School Campus location in Muzaffarpur, Bihar
const DEFAULT_CAMPUS_CENTER = [26.1209, 85.3647];
const DEFAULT_CAMPUS_ZOOM   = 13;
const REFRESH_MS            = 8000;   // 8s live refresh (Zomato/Blinkit feel)

const STATUS_COLOR = {
  RUNNING:   '#16a34a', // Emerald green
  PAUSED:    '#d97706', // Amber
  SOS:       '#dc2626', // Red
  BREAKDOWN: '#dc2626', // Red
};

const STATUS_LABEL = {
  RUNNING:   'Live On Road',
  PAUSED:    'Halted / Paused',
  SOS:       'Emergency SOS!',
  BREAKDOWN: 'Breakdown',
};

// Zomato/Blinkit style vehicle marker with radar pulse ring, heading indicator, and speed badge
function zomatoBusIcon(color, heading, speed) {
  const speedDisplay = Math.round(speed || 0);
  const isMoving = speedDisplay > 2;

  return L.divIcon({
    className: 'zomato-vehicle-wrapper',
    html: `
      <div style="position:relative; width:48px; height:48px; display:flex; align-items:center; justify-content:center;">
        <!-- Pulsing Radar Ripple (Zomato/Blinkit Style) -->
        <div style="
          position:absolute; inset:-4px; border-radius:50%;
          border: 2.5px solid ${color};
          animation: zomatoRadarPulse 2s cubic-bezier(0.24, 0, 0.38, 1) infinite;
          pointer-events:none;
        "></div>
        <div style="
          position:absolute; inset:-10px; border-radius:50%;
          border: 1.5px solid ${color};
          opacity: 0.5;
          animation: zomatoRadarPulse 2s cubic-bezier(0.24, 0, 0.38, 1) 0.5s infinite;
          pointer-events:none;
        "></div>

        <!-- Vehicle Body Icon with Heading -->
        <div style="
          width:38px; height:38px; border-radius:50%;
          background:${color}; border:3px solid #ffffff;
          box-shadow: 0 4px 14px rgba(0,0,0,0.38);
          display:flex; align-items:center; justify-content:center;
          transform: rotate(${heading || 0}deg);
          transition: transform 0.4s ease;
          font-size: 18px; z-index: 2;
        ">
          🚌
        </div>

        <!-- Floating Live Speed Pill Badge -->
        <div style="
          position:absolute; bottom:-10px; z-index:3;
          background:#0f172a; color:#ffffff; font-size:10px; font-weight:800;
          padding:1px 6px; border-radius:10px; border:1.5px solid #ffffff;
          box-shadow:0 2px 6px rgba(0,0,0,0.3); white-space:nowrap;
          letter-spacing:0.02em; display:flex; align-items:center; gap:2px;
        ">
          ${isMoving ? `<span style="color:#22c55e;">●</span>` : `<span style="color:#f59e0b;">⏸</span>`}
          ${speedDisplay} km/h
        </div>
      </div>
    `,
    iconSize: [48, 48],
    iconAnchor: [24, 24],
  });
}

// School Campus Base Marker
function campusIcon() {
  return L.divIcon({
    className: 'school-campus-marker',
    html: `
      <div style="display:flex; flex-direction:column; align-items:center; pointer-events:auto; filter: drop-shadow(0 4px 8px rgba(1,118,211,0.4));">
        <div style="
          background:#0176d3; color:#ffffff; font-size:11px; font-weight:800;
          padding:2px 8px; border-radius:12px; border:2px solid #ffffff;
          box-shadow:0 3px 10px rgba(0,0,0,0.25); white-space:nowrap; margin-bottom:2px;
          letter-spacing:0.02em;
        ">
          🏫 School Campus
        </div>
        <div style="
          width:34px; height:34px; border-radius:50%; background:#032d60;
          border:3px solid #ffffff; box-shadow:0 4px 12px rgba(0,0,0,0.3);
          display:flex; align-items:center; justify-content:center; font-size:16px;
        ">
          🏫
        </div>
      </div>
    `,
    iconSize: [110, 60],
    iconAnchor: [55, 58],
  });
}

export default function LiveTracking() {
  const [darkMode, setDarkMode] = useState(localStorage.getItem('ederp_theme') === 'dark');
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [selectedTripId, setSelectedTripId] = useState(null);
  const [search, setSearch] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const mapDivRef       = useRef(null);
  const mapInstanceRef  = useRef(null);
  const campusMarkerRef = useRef(null);
  const markersRef      = useRef({});     // trip_id -> L.marker
  const trailLineRef    = useRef(null);   // currently-drawn polyline
  const trailMarkersRef = useRef([]);    // small dots along the trail

  const textMuted = darkMode ? '#94a3b8' : '#64748b';
  const cardBg    = darkMode ? '#1e293b' : '#ffffff';
  const border    = darkMode ? '#334155' : '#e2e8f0';

  // ── Inject CSS keyframes for Zomato pulse once ──
  useEffect(() => {
    const styleId = 'zomato-tracking-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.innerHTML = `
        @keyframes zomatoRadarPulse {
          0% {
            transform: scale(0.7);
            opacity: 0.9;
          }
          70% {
            transform: scale(1.7);
            opacity: 0.05;
          }
          100% {
            transform: scale(2.0);
            opacity: 0;
          }
        }
        .leaflet-container {
          background-color: #f1f5f9;
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  // ── Init map anchored around School Campus (Muzaffarpur) ──
  useEffect(() => {
    if (!mapDivRef.current || mapInstanceRef.current) return;

    // Use default Muzaffarpur school coordinates
    const map = L.map(mapDivRef.current, {
      zoomControl: true,
      attributionControl: true
    }).setView(DEFAULT_CAMPUS_CENTER, DEFAULT_CAMPUS_ZOOM);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors | edu-ERP Fleet GPS',
      maxZoom: 19,
    }).addTo(map);

    // Place School Campus marker
    campusMarkerRef.current = L.marker(DEFAULT_CAMPUS_CENTER, { icon: campusIcon() })
      .addTo(map)
      .bindTooltip('🏫 Main Campus Base', { permanent: false, direction: 'top' });

    mapInstanceRef.current = map;

    // Invalidate size shortly after mounting to avoid Leaflet tile-load issues
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 250);

    const onResize = () => map.invalidateSize();
    window.addEventListener('resize', onResize);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', onResize);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // ── Fetch active vehicles ──
  const loadVehicles = useCallback(async (silent) => {
    if (!silent) setLoading(true);
    try {
      const res = await transportApi.live.vehicles();
      const trips = res.data.data || [];
      setVehicles(trips);

      const map = mapInstanceRef.current;
      if (map) {
        map.invalidateSize();
        const seen = new Set();

        trips.forEach(t => {
          const gps = t.latest_gps;
          if (!gps) return;
          seen.add(t.id);
          const color = STATUS_COLOR[t.status] || '#0176d3';
          const pos = [gps.latitude, gps.longitude];
          const icon = zomatoBusIcon(color, gps.heading, gps.speed);

          if (markersRef.current[t.id]) {
            markersRef.current[t.id].setLatLng(pos);
            markersRef.current[t.id].setIcon(icon);
          } else {
            const m = L.marker(pos, { icon }).addTo(map);
            m.on('click', () => setSelectedTripId(t.id));
            markersRef.current[t.id] = m;
          }

          markersRef.current[t.id].bindTooltip(
            `<div style="font-weight:700;font-size:12px;">🚌 ${t.vehicle_number}</div>
             <div style="font-size:11px;color:#64748b;">${t.route_name || 'Active Route'} · ${Math.round(gps.speed || 0)} km/h</div>`,
            { direction: 'top', offset: [0, -22] }
          );
        });

        // Remove markers for trips that have ended
        Object.keys(markersRef.current).forEach(tid => {
          if (!seen.has(Number(tid))) {
            map.removeLayer(markersRef.current[tid]);
            delete markersRef.current[tid];
          }
        });

        // First load auto-fit: If vehicles exist with GPS, encompass them + campus. Otherwise stay centered on campus!
        if (!silent) {
          const validPts = trips.filter(t => t.latest_gps).map(t => [t.latest_gps.latitude, t.latest_gps.longitude]);
          if (validPts.length > 0) {
            validPts.push(DEFAULT_CAMPUS_CENTER);
            map.fitBounds(validPts, { padding: [70, 70], maxZoom: 15 });
          } else {
            map.setView(DEFAULT_CAMPUS_CENTER, DEFAULT_CAMPUS_ZOOM);
          }
        }
      }
    } catch (err) {
      toast.error('Live fleet tracking data load nahi hui');
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadVehicles(false); }, [loadVehicles]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => loadVehicles(true), REFRESH_MS);
    return () => clearInterval(id);
  }, [autoRefresh, loadVehicles]);

  // ── Draw trail (Zomato/Blinkit glowing route line) for selected vehicle ──
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear previous trail
    if (trailLineRef.current) { map.removeLayer(trailLineRef.current); trailLineRef.current = null; }
    trailMarkersRef.current.forEach(m => map.removeLayer(m));
    trailMarkersRef.current = [];

    if (!selectedTripId) return;

    transportApi.live.tripDetail(selectedTripId, { include_trail: true }).then(res => {
      const trail = res.data.data?.gps_trail || [];
      if (trail.length < 2) return;
      const latlngs = trail.map(g => [g.latitude, g.longitude]);

      // Glowing route polyline
      trailLineRef.current = L.polyline(latlngs, {
        color: '#0176d3',
        weight: 5,
        opacity: 0.85,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);

      // Waypoint dots along the route
      trail.forEach((g, i) => {
        if (i % Math.max(1, Math.floor(trail.length / 12)) !== 0) return;
        const dot = L.circleMarker([g.latitude, g.longitude], {
          radius: 4,
          color: '#ffffff',
          fillColor: '#0176d3',
          fillOpacity: 1,
          weight: 2,
        }).addTo(map);
        dot.bindTooltip(new Date(g.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), { direction: 'top' });
        trailMarkersRef.current.push(dot);
      });

      map.fitBounds(latlngs, { padding: [70, 70], maxZoom: 16 });
    }).catch(() => toast.error('Vehicle live route trail load nahi hua'));
  }, [selectedTripId]);

  function focusVehicle(t) {
    setSelectedTripId(t.id === selectedTripId ? null : t.id);
    if (t.latest_gps && mapInstanceRef.current) {
      mapInstanceRef.current.setView([t.latest_gps.latitude, t.latest_gps.longitude], 16, { animate: true });
    }
  }

  function centerOnCampus() {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView(DEFAULT_CAMPUS_CENTER, DEFAULT_CAMPUS_ZOOM, { animate: true });
    }
  }

  const filtered = vehicles.filter(t =>
    !search.trim() ||
    t.vehicle_number?.toLowerCase().includes(search.toLowerCase()) ||
    t.route_name?.toLowerCase().includes(search.toLowerCase()) ||
    t.driver_name?.toLowerCase().includes(search.toLowerCase())
  );

  const selectedVehicleObj = vehicles.find(v => v.id === selectedTripId);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: darkMode ? '#0b1120' : '#f8fafc' }}>
      <Sidebar darkMode={darkMode} />
      <div style={{ marginLeft: 232, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Navbar title="Fleet Live Tracking" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />

        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          {/* ── Map (left, majority width — Zomato/Blinkit full telemetry layout) ── */}
          <div style={{ flex: 1, position: 'relative' }}>
            <div ref={mapDivRef} style={{ position: 'absolute', inset: 0, zIndex: 1 }} />

            {/* Top Toolbar overlay */}
            <div style={{
              position: 'absolute', top: 16, left: 16, zIndex: 1000,
              background: cardBg, borderRadius: 12, padding: '10px 16px',
              boxShadow: '0 4px 18px rgba(0,0,0,0.18)', display: 'flex', gap: 16, alignItems: 'center',
              fontSize: 13, color: darkMode ? '#e2e8f0' : '#0f172a', border: `1px solid ${border}`,
              backdropFilter: 'blur(8px)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  width: 9, height: 9, borderRadius: '50%', background: '#16a34a',
                  boxShadow: '0 0 8px #16a34a', display: 'inline-block'
                }}></span>
                <b>{vehicles.length}</b> Active Vehicle{vehicles.length !== 1 ? 's' : ''} Live
              </div>
              <div style={{ width: 1, height: 16, background: border }}></div>
              <button
                onClick={centerOnCampus}
                style={{
                  background: 'transparent', border: 'none', color: '#0176d3', fontWeight: 700,
                  fontSize: 12.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, padding: 0
                }}
              >
                🏫 Focus Campus (Muzaffarpur)
              </button>
              <div style={{ width: 1, height: 16, background: border }}></div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={e => setAutoRefresh(e.target.checked)}
                  style={{ accentColor: '#0176d3' }}
                />
                Auto-Refresh (8s)
              </label>
            </div>

            {/* ── Floating Zomato/Blinkit Telemetry Card (When vehicle selected) ── */}
            {selectedVehicleObj && (
              <div style={{
                position: 'absolute', bottom: 20, left: 20, zIndex: 1000,
                width: 360, background: cardBg, borderRadius: 16,
                padding: '16px 20px', boxShadow: '0 12px 32px rgba(0,0,0,0.25)',
                border: `1.5px solid ${border}`, animation: 'fadeIn 0.2s ease',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 18 }}>🚌</span>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a' }}>
                        {selectedVehicleObj.vehicle_number}
                      </h3>
                      <span style={{
                        fontSize: 11, fontWeight: 800, color: '#ffffff',
                        background: STATUS_COLOR[selectedVehicleObj.status] || '#0176d3',
                        padding: '2px 8px', borderRadius: 12
                      }}>
                        {STATUS_LABEL[selectedVehicleObj.status] || selectedVehicleObj.status}
                      </span>
                    </div>
                    <div style={{ fontSize: 12.5, color: textMuted, marginTop: 4 }}>
                      Route: <strong style={{ color: darkMode ? '#e2e8f0' : '#1e293b' }}>{selectedVehicleObj.route_name || 'Regular School Route'}</strong>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedTripId(null)}
                    style={{
                      background: 'transparent', border: 'none', fontSize: 16,
                      color: textMuted, cursor: 'pointer', padding: '2px 6px'
                    }}
                  >
                    ✕
                  </button>
                </div>

                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
                  background: darkMode ? '#0f172a' : '#f8fafc', padding: '10px 12px',
                  borderRadius: 10, margin: '10px 0', border: `1px solid ${border}`
                }}>
                  <div>
                    <div style={{ fontSize: 10.5, color: textMuted, fontWeight: 600 }}>SPEED</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#16a34a' }}>
                      ⚡ {Math.round(selectedVehicleObj.latest_gps?.speed || 0)} km/h
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10.5, color: textMuted, fontWeight: 600 }}>STUDENTS</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a' }}>
                      👨‍🎓 {selectedVehicleObj.students_count || 0}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10.5, color: textMuted, fontWeight: 600 }}>DRIVER</div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: darkMode ? '#ffffff' : '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {selectedVehicleObj.driver_name || 'Assigned'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                  <div style={{ fontSize: 11.5, color: textMuted }}>
                    {selectedVehicleObj.latest_gps ? (
                      <>Last updated {new Date(selectedVehicleObj.latest_gps.recorded_at).toLocaleTimeString()}</>
                    ) : 'GPS connection active'}
                  </div>
                  <button
                    onClick={() => focusVehicle(selectedVehicleObj)}
                    style={{
                      background: '#0176d3', color: '#ffffff', border: 'none',
                      borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 700,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4
                    }}
                  >
                    🎯 Re-center Bus
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── Side list (right — delivery-partner-list style) ── */}
          <div style={{
            width: 350, borderLeft: `1px solid ${border}`, background: cardBg,
            display: 'flex', flexDirection: 'column', zIndex: 10,
          }}>
            <div style={{ padding: 16, borderBottom: `1px solid ${border}` }}>
              <input
                placeholder="Search bus, route, or driver..."
                value={search} onChange={e => setSearch(e.target.value)}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 13,
                  border: `1.5px solid ${border}`, background: darkMode ? '#0f172a' : '#f8fafc',
                  color: darkMode ? '#e2e8f0' : '#0f172a', outline: 'none',
                }}
              />
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {loading ? (
                <div style={{ padding: 40, textAlign: 'center', color: textMuted }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>📡</div>
                  Connecting to Fleet GPS...
                </div>
              ) : filtered.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: textMuted }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>🚌</div>
                  {search ? 'Koi matching vehicle nahi mila' : 'Abhi koi vehicle active trip pe nahi hai'}
                  <div style={{ fontSize: 12, marginTop: 8, color: '#0176d3' }}>
                    Map currently centered at School Campus (Muzaffarpur)
                  </div>
                </div>
              ) : filtered.map(t => {
                const gps = t.latest_gps;
                const color = STATUS_COLOR[t.status] || '#0176d3';
                const active = t.id === selectedTripId;
                const lastSeenMin = gps ? Math.round((Date.now() - new Date(gps.recorded_at).getTime()) / 60000) : null;
                const speed = Math.round(gps?.speed || 0);

                return (
                  <div
                    key={t.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => focusVehicle(t)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        focusVehicle(t);
                      }
                    }}
                    style={{
                      padding: '14px 16px', borderBottom: `1px solid ${border}`, cursor: 'pointer',
                      background: active ? (darkMode ? '#1e3a8a33' : '#f0f9ff') : 'transparent',
                      borderLeft: active ? '4px solid #0176d3' : '4px solid transparent',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontWeight: 800, fontSize: 14.5, color: darkMode ? '#f1f5f9' : '#0f172a' }}>
                        🚌 {t.vehicle_number}
                      </div>
                      <span style={{
                        fontSize: 11, fontWeight: 700, color: '#ffffff', background: color,
                        padding: '2px 8px', borderRadius: 20,
                      }}>{STATUS_LABEL[t.status] || t.status}</span>
                    </div>

                    <div style={{ fontSize: 12.5, color: textMuted, marginTop: 4 }}>
                      {t.route_name || 'Regular School Route'} · Driver: <strong>{t.driver_name || '—'}</strong>
                    </div>

                    <div style={{ fontSize: 12, color: textMuted, marginTop: 4, display: 'flex', gap: 12 }}>
                      <span>👨‍🎓 {t.students_count || 0} students</span>
                      {gps && (
                        <span style={{ color: speed > 0 ? '#16a34a' : '#d97706', fontWeight: 700 }}>
                          ⚡ {speed} km/h
                        </span>
                      )}
                    </div>

                    {gps && (
                      <div style={{ fontSize: 11, color: lastSeenMin > 3 ? '#dc2626' : textMuted, marginTop: 4 }}>
                        {lastSeenMin <= 0 ? '● Real-time (Live)' : `${lastSeenMin} min ago`}
                        {lastSeenMin > 3 && ' — GPS signal delayed'}
                      </div>
                    )}

                    {active && (
                      <div style={{ fontSize: 11.5, color: '#0176d3', marginTop: 6, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span>📍</span> Showing live route trail on map
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
