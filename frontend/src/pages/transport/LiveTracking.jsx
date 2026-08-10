import React, { useState, useEffect, useRef, useCallback } from 'react';
import Sidebar      from '../../components/Sidebar';
import Navbar        from '../../components/Navbar';
import transportApi  from '../../api/transportApi';
import toast          from 'react-hot-toast';
import L               from 'leaflet';
import 'leaflet/dist/leaflet.css';

const INDIA_CENTER = [22.9734, 78.6569];
const INDIA_ZOOM   = 5;
const REFRESH_MS   = 10000;   // 10s — Zomato/Swiggy jaisa hi live feel

const STATUS_COLOR = {
  RUNNING:   '#16a34a',
  PAUSED:    '#d97706',
  SOS:       '#dc2626',
  BREAKDOWN: '#dc2626',
};
const STATUS_LABEL = {
  RUNNING:   'On the way',
  PAUSED:    'Paused',
  SOS:       'SOS!',
  BREAKDOWN: 'Breakdown',
};

// Bus icon divIcon — colored dot + rotation for heading, jaise delivery-partner marker
function busIcon(color, heading) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:34px;height:34px;border-radius:50%;
      background:${color};border:3px solid #fff;
      box-shadow:0 2px 8px rgba(0,0,0,0.35);
      display:flex;align-items:center;justify-content:center;
      transform:rotate(${heading || 0}deg);
      font-size:16px;">🚌</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

export default function LiveTracking() {
  const [darkMode, setDarkMode] = useState(localStorage.getItem('ederp_theme') === 'dark');
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [selectedTripId, setSelectedTripId] = useState(null);
  const [search, setSearch] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const mapDivRef      = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef     = useRef({});     // trip_id -> L.marker
  const trailLineRef   = useRef(null);   // currently-drawn polyline
  const trailMarkersRef = useRef([]);    // small dots along the trail

  const textMuted = darkMode ? '#94a3b8' : '#64748b';
  const cardBg    = darkMode ? '#1e293b' : '#fff';
  const border    = darkMode ? '#334155' : '#e2e8f0';

  // ── init map once ──
  useEffect(() => {
    if (!mapDivRef.current || mapInstanceRef.current) return;
    const map = L.map(mapDivRef.current).setView(INDIA_CENTER, INDIA_ZOOM);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);
    mapInstanceRef.current = map;
    return () => { map.remove(); mapInstanceRef.current = null; };
  }, []);

  // ── fetch active vehicles ──
  const loadVehicles = useCallback(async (silent) => {
    if (!silent) setLoading(true);
    try {
      const res = await transportApi.live.vehicles();
      const trips = res.data.data || [];
      setVehicles(trips);

      const map = mapInstanceRef.current;
      if (map) {
        const seen = new Set();
        trips.forEach(t => {
          const gps = t.latest_gps;
          if (!gps) return;
          seen.add(t.id);
          const color = STATUS_COLOR[t.status] || '#4f46e5';
          const pos = [gps.latitude, gps.longitude];
          if (markersRef.current[t.id]) {
            markersRef.current[t.id].setLatLng(pos);
            markersRef.current[t.id].setIcon(busIcon(color, gps.heading));
          } else {
            const m = L.marker(pos, { icon: busIcon(color, gps.heading) }).addTo(map);
            m.on('click', () => setSelectedTripId(t.id));
            markersRef.current[t.id] = m;
          }
          markersRef.current[t.id].bindTooltip(
            `${t.vehicle_number} — ${t.route_name || 'No route'}`,
            { direction: 'top', offset: [0, -18] }
          );
        });
        // remove markers for trips that ended
        Object.keys(markersRef.current).forEach(tid => {
          if (!seen.has(Number(tid))) {
            map.removeLayer(markersRef.current[tid]);
            delete markersRef.current[tid];
          }
        });

        // first load — fit map to all active vehicles
        if (!silent && trips.length) {
          const pts = trips.filter(t => t.latest_gps).map(t => [t.latest_gps.latitude, t.latest_gps.longitude]);
          if (pts.length) map.fitBounds(pts, { padding: [60, 60], maxZoom: 14 });
        }
      }
    } catch (err) {
      toast.error('Live data load nahi hui');
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadVehicles(false); }, [loadVehicles]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => loadVehicles(true), REFRESH_MS);
    return () => clearInterval(id);
  }, [autoRefresh, loadVehicles]);

  // ── draw trail (breadcrumb line) for selected vehicle ──
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // clear previous trail
    if (trailLineRef.current) { map.removeLayer(trailLineRef.current); trailLineRef.current = null; }
    trailMarkersRef.current.forEach(m => map.removeLayer(m));
    trailMarkersRef.current = [];

    if (!selectedTripId) return;

    transportApi.live.tripDetail(selectedTripId, { include_trail: true }).then(res => {
      const trail = res.data.data?.gps_trail || [];
      if (trail.length < 2) return;
      const latlngs = trail.map(g => [g.latitude, g.longitude]);

      trailLineRef.current = L.polyline(latlngs, {
        color: '#4f46e5', weight: 4, opacity: 0.75, dashArray: '1, 8', lineCap: 'round',
      }).addTo(map);

      // small waypoint dots every ~10th point, jaise Zomato ka route history
      trail.forEach((g, i) => {
        if (i % Math.max(1, Math.floor(trail.length / 15)) !== 0) return;
        const dot = L.circleMarker([g.latitude, g.longitude], {
          radius: 3, color: '#4f46e5', fillColor: '#818cf8', fillOpacity: 1, weight: 1,
        }).addTo(map);
        dot.bindTooltip(new Date(g.recorded_at).toLocaleTimeString(), { direction: 'top' });
        trailMarkersRef.current.push(dot);
      });

      map.fitBounds(latlngs, { padding: [60, 60], maxZoom: 15 });
    }).catch(() => toast.error('Trail load nahi hua'));
  }, [selectedTripId]);

  function focusVehicle(t) {
    setSelectedTripId(t.id === selectedTripId ? null : t.id);
    if (t.latest_gps && mapInstanceRef.current) {
      mapInstanceRef.current.setView([t.latest_gps.latitude, t.latest_gps.longitude], 15);
    }
  }

  const filtered = vehicles.filter(t =>
    !search.trim() ||
    t.vehicle_number?.toLowerCase().includes(search.toLowerCase()) ||
    t.route_name?.toLowerCase().includes(search.toLowerCase()) ||
    t.driver_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: darkMode ? '#0f172a' : '#f8fafc' }}>
      <Sidebar darkMode={darkMode} />
      <div style={{ marginLeft: 232, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Navbar title="Live Tracking" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />

        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          {/* ── Map (left, majority width — Zomato/Swiggy style) ── */}
          <div style={{ flex: 1, position: 'relative' }}>
            <div ref={mapDivRef} style={{ position: 'absolute', inset: 0 }} />

            <div style={{
              position: 'absolute', top: 14, left: 14, zIndex: 1000,
              background: cardBg, borderRadius: 10, padding: '8px 14px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.15)', display: 'flex', gap: 14, alignItems: 'center',
              fontSize: 13, color: darkMode ? '#e2e8f0' : '#0f172a',
            }}>
              <b>{vehicles.length}</b> vehicle{vehicles.length !== 1 ? 's' : ''} live
              <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
                <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} />
                Auto-refresh (10s)
              </label>
            </div>
          </div>

          {/* ── Side list (right — delivery-partner-list style) ── */}
          <div style={{
            width: 340, borderLeft: `1px solid ${border}`, background: cardBg,
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ padding: 14, borderBottom: `1px solid ${border}` }}>
              <input
                placeholder="Search bus, route, driver..."
                value={search} onChange={e => setSearch(e.target.value)}
                style={{
                  width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13,
                  border: `1px solid ${border}`, background: darkMode ? '#0f172a' : '#f8fafc',
                  color: darkMode ? '#e2e8f0' : '#0f172a', outline: 'none',
                }}
              />
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {loading ? (
                <div style={{ padding: 30, textAlign: 'center', color: textMuted }}>Loading...</div>
              ) : filtered.length === 0 ? (
                <div style={{ padding: 30, textAlign: 'center', color: textMuted }}>
                  Abhi koi vehicle active trip pe nahi hai
                </div>
              ) : filtered.map(t => {
                const gps = t.latest_gps;
                const color = STATUS_COLOR[t.status] || '#4f46e5';
                const active = t.id === selectedTripId;
                const lastSeenMin = gps ? Math.round((Date.now() - new Date(gps.recorded_at).getTime()) / 60000) : null;
                return (
                  <div key={t.id} onClick={() => focusVehicle(t)} style={{
                    padding: '12px 14px', borderBottom: `1px solid ${border}`, cursor: 'pointer',
                    background: active ? (darkMode ? '#0f172a' : '#eef2ff') : 'transparent',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: darkMode ? '#e2e8f0' : '#0f172a' }}>
                        🚌 {t.vehicle_number}
                      </div>
                      <span style={{
                        fontSize: 11, fontWeight: 700, color: '#fff', background: color,
                        padding: '2px 8px', borderRadius: 20,
                      }}>{STATUS_LABEL[t.status] || t.status}</span>
                    </div>
                    <div style={{ fontSize: 12.5, color: textMuted, marginTop: 4 }}>
                      {t.route_name || 'Route not set'} · Driver: {t.driver_name || '—'}
                    </div>
                    <div style={{ fontSize: 12, color: textMuted, marginTop: 3, display: 'flex', gap: 10 }}>
                      <span>👨‍🎓 {t.students_count} students</span>
                      {gps && <span>⚡ {Math.round(gps.speed || 0)} km/h</span>}
                    </div>
                    {gps && (
                      <div style={{ fontSize: 11, color: lastSeenMin > 3 ? '#dc2626' : textMuted, marginTop: 2 }}>
                        {lastSeenMin <= 0 ? 'Just now' : `${lastSeenMin} min ago`}
                        {lastSeenMin > 3 && ' — signal weak?'}
                      </div>
                    )}
                    {active && (
                      <div style={{ fontSize: 11.5, color: '#4f46e5', marginTop: 6, fontWeight: 600 }}>
                        ● Route history dikh rahi hai map par
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
