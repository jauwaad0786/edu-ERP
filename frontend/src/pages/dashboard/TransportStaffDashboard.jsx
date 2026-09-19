// frontend/src/pages/dashboard/TransportStaffDashboard.jsx
// Transport Staff — Fleet Operations Dashboard

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api     from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { resolveTenantPath } from '../../utils/routeBuilder';

const C = {
  bg:      '#f0f4f8',
  surface: '#ffffff',
  border:  '#e2e8f0',
  primary: '#0176d3',
  orange:  '#ea580c',
  green:   '#16a34a',
  warning: '#d97706',
  error:   '#dc2626',
  text:    '#1e293b',
  muted:   '#64748b',
  light:   '#f8fafc',
};

function KPI({ icon, label, value, sub, color = C.primary, onClick, badge }) {
  const [hover, setHover] = useState(false);
  return (
    <div onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`,
        boxShadow: hover && onClick ? '0 6px 20px rgba(0,0,0,0.1)' : '0 1px 4px rgba(0,0,0,0.06)',
        padding: '18px 20px', cursor: onClick ? 'pointer' : 'default',
        transform: hover && onClick ? 'translateY(-2px)' : 'none',
        transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', gap: 14,
      }}
    >
      <div style={{ width: 50, height: 50, borderRadius: 12, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <i className={`ti ${icon}`} style={{ fontSize: 22, color }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: C.muted, fontWeight: 500, marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 24, fontWeight: 800, color: C.text }}>{value ?? '—'}</div>
        {sub && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{sub}</div>}
      </div>
      {badge && (
        <span style={{ padding: '3px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700, background: `${badge.color}20`, color: badge.color, flexShrink: 0 }}>
          {badge.text}
        </span>
      )}
    </div>
  );
}

function Card({ title, icon, action, children, extra = {} }) {
  return (
    <div style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', padding: '20px 22px', ...extra }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className={`ti ${icon}`} style={{ fontSize: 15, color: C.orange }} />
          <span style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{title}</span>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function QA({ icon, label, color, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        flex: 1, minWidth: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        padding: '14px 10px', background: hover ? `${color}15` : `${color}08`,
        border: `1px solid ${hover ? color + '60' : color + '25'}`,
        borderRadius: 12, cursor: 'pointer', transition: 'all 0.18s',
      }}
    >
      <i className={`ti ${icon}`} style={{ fontSize: 20, color }} />
      <span style={{ fontSize: 11, fontWeight: 600, color: C.text, textAlign: 'center', lineHeight: 1.3 }}>{label}</span>
    </button>
  );
}

const STATUS_COLORS = {
  ACTIVE:   C.green,
  ON_ROUTE: C.green,
  IDLE:     C.muted,
  INACTIVE: C.error,
  MAINTENANCE: C.warning,
};

export default function TransportStaffDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('ederp_theme') === 'dark');
  useEffect(() => { localStorage.setItem('ederp_theme', darkMode ? 'dark' : 'light'); }, [darkMode]);

  const goTo = useCallback((path) => navigate(resolveTenantPath(path, user)), [navigate, user]);

  const [dashboard, setDashboard] = useState(null);
  const [vehicles,  setVehicles]  = useState([]);
  const [routes,    setRoutes]    = useState([]);
  const [drivers,   setDrivers]   = useState([]);
  const [loading,   setLoading]   = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get('/transport/dashboard').catch(() => ({ data: null })),
      api.get('/transport/vehicles', { params: { per_page: 10 } }).catch(() => ({ data: { vehicles: [] } })),
      api.get('/transport/routes', { params: { per_page: 8 } }).catch(() => ({ data: { routes: [] } })),
      api.get('/transport/drivers', { params: { per_page: 8 } }).catch(() => ({ data: { drivers: [] } })),
    ]).then(([dash, veh, rt, drv]) => {
      setDashboard(dash.data);
      setVehicles(veh.data?.vehicles || veh.data || []);
      setRoutes(rt.data?.routes || rt.data || []);
      setDrivers(drv.data?.drivers || drv.data || []);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const d = dashboard || {};
  const totalVehicles    = d.total_vehicles    ?? vehicles.length;
  const activeVehicles   = d.active_vehicles   ?? vehicles.filter(v => v.status === 'ACTIVE').length;
  const totalRoutes      = d.total_routes      ?? routes.length;
  const totalDrivers     = d.total_drivers     ?? drivers.length;
  const totalStudents    = d.total_students    ?? null;
  const pendingFees      = d.pending_fees      ?? null;
  const maintenanceDue   = d.maintenance_due   ?? vehicles.filter(v => v.status === 'MAINTENANCE').length;

  const todayStr = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className={`app-shell${darkMode ? ' theme-dark' : ''}`}>
      <Sidebar darkMode={darkMode} />
      <div className="main-content">
        <Navbar title="Transport Fleet Operations" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />
        <div className="page-body" style={{ background: C.bg, padding: '20px 24px', minHeight: '100vh' }}>

          {/* ── Hero ── */}
          <div style={{
            borderRadius: 18, padding: '26px 32px', marginBottom: 24,
            background: 'linear-gradient(135deg, #431407 0%, #7c2d12 40%, #9a3412 80%, #ea580c 100%)',
            color: '#fff', position: 'relative', overflow: 'hidden',
            boxShadow: '0 8px 30px rgba(234,88,12,0.35)',
          }}>
            <div style={{ position: 'absolute', top: -50, right: -30, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', opacity: 0.75, marginBottom: 6 }}>
                  {todayStr.toUpperCase()} · TRANSPORT OPERATIONS
                </div>
                <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>Fleet Operations Hub</h1>
                <p style={{ margin: '8px 0 0', opacity: 0.8, fontSize: 14 }}>
                  {totalVehicles} vehicles · {activeVehicles} active · {totalRoutes} routes
                </p>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => goTo('/transport/live')} style={{
                  padding: '10px 20px', borderRadius: 10, border: 'none',
                  background: '#fff', color: '#ea580c', fontWeight: 700, cursor: 'pointer', fontSize: 13,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <i className="ti ti-map-pin-filled" /> Live Tracking
                </button>
                <button onClick={() => goTo('/transport/reports')} style={{
                  padding: '10px 20px', borderRadius: 10, border: '1.5px solid rgba(255,255,255,0.5)',
                  background: 'rgba(255,255,255,0.15)', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13,
                  display: 'flex', alignItems: 'center', gap: 6, backdropFilter: 'blur(4px)',
                }}>
                  <i className="ti ti-report" /> Reports
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: C.muted }}>
              <i className="ti ti-loader-2" style={{ fontSize: 32, animation: 'spin 1s linear infinite' }} />
              <p style={{ marginTop: 12 }}>Loading transport data…</p>
            </div>
          ) : (
            <>
              {/* ── KPIs ── */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 20 }}>
                <KPI icon="ti-bus" label="Total Vehicles" value={totalVehicles} color={C.orange} onClick={() => goTo('/transport/vehicles')} />
                <KPI icon="ti-circle-check" label="Active Vehicles" value={activeVehicles}
                     color={C.green} badge={{ text: 'RUNNING', color: C.green }} />
                <KPI icon="ti-tool" label="Under Maintenance" value={maintenanceDue}
                     color={maintenanceDue > 0 ? C.warning : C.green}
                     badge={maintenanceDue > 0 ? { text: 'SCHEDULED', color: C.warning } : null}
                     onClick={() => goTo('/transport/maintenance')} />
                <KPI icon="ti-route" label="Active Routes" value={totalRoutes} color={C.primary} onClick={() => goTo('/transport/routes')} />
                <KPI icon="ti-steering-wheel" label="Total Drivers" value={totalDrivers} color={C.orange} onClick={() => goTo('/transport/drivers')} />
                <KPI icon="ti-users" label="Students Enrolled" value={totalStudents?.toLocaleString()} color={C.primary} onClick={() => goTo('/transport/students')} />
              </div>

              {/* ── Quick Actions + Vehicles ── */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16, marginBottom: 20 }}>

                <Card title="Quick Actions" icon="ti-bolt">
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <QA icon="ti-map-pin-filled"  label="Live Track"    color={C.green}   onClick={() => goTo('/transport/live')} />
                    <QA icon="ti-bus"             label="Vehicles"      color={C.orange}  onClick={() => goTo('/transport/vehicles')} />
                    <QA icon="ti-route"           label="Routes"        color={C.primary} onClick={() => goTo('/transport/routes')} />
                    <QA icon="ti-steering-wheel"  label="Drivers"       color="#7c3aed"   onClick={() => goTo('/transport/drivers')} />
                    <QA icon="ti-users"           label="Students"      color="#0891b2"   onClick={() => goTo('/transport/students')} />
                    <QA icon="ti-tool"            label="Maintenance"   color={C.warning} onClick={() => goTo('/transport/maintenance')} />
                    <QA icon="ti-currency-rupee"  label="Fees"          color={C.error}   onClick={() => goTo('/transport/fees')} />
                    <QA icon="ti-history"         label="Travel Log"    color={C.muted}   onClick={() => goTo('/transport/travel-history')} />
                  </div>
                </Card>

                {/* Vehicle Fleet Status */}
                <Card
                  title="Fleet Status"
                  icon="ti-bus"
                  action={
                    <button onClick={() => goTo('/transport/vehicles')} style={{
                      fontSize: 12, color: C.orange, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600,
                    }}>All Vehicles →</button>
                  }
                >
                  {vehicles.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px 0', color: C.muted, fontSize: 13 }}>
                      <i className="ti ti-bus" style={{ fontSize: 28, opacity: 0.4 }} />
                      <p style={{ marginTop: 8 }}>No vehicle data available</p>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
                      {vehicles.slice(0, 8).map((v, i) => {
                        const statusColor = STATUS_COLORS[v.status] || C.muted;
                        return (
                          <div key={i} style={{
                            padding: '12px 14px', borderRadius: 10,
                            background: `${statusColor}08`,
                            border: `1px solid ${statusColor}25`,
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                              <i className="ti ti-bus" style={{ fontSize: 16, color: statusColor }} />
                              <span style={{ fontWeight: 700, fontSize: 12, color: C.text }}>{v.registration_no || v.vehicle_no || `Vehicle ${i + 1}`}</span>
                            </div>
                            <div style={{ fontSize: 10, color: C.muted }}>{v.make || v.model || 'Bus'}</div>
                            <div style={{ marginTop: 6 }}>
                              <span style={{
                                padding: '2px 8px', borderRadius: 99, fontSize: 9, fontWeight: 700,
                                background: `${statusColor}20`, color: statusColor,
                              }}>{v.status || 'ACTIVE'}</span>
                            </div>
                            {v.capacity && (
                              <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>Cap: {v.capacity}</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              </div>

              {/* ── Routes Table ── */}
              <Card
                title="Route Overview"
                icon="ti-route"
                action={
                  <button onClick={() => goTo('/transport/routes')} style={{
                    fontSize: 12, color: C.orange, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600,
                  }}>Manage Routes →</button>
                }
              >
                {routes.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: C.muted, fontSize: 13 }}>
                    <i className="ti ti-route" style={{ fontSize: 28, opacity: 0.4 }} />
                    <p style={{ marginTop: 8 }}>No routes configured yet</p>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: `2px solid ${C.border}` }}>
                          {['Route Name', 'From', 'To', 'Vehicle', 'Driver', 'Students'].map(h => (
                            <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: C.muted }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {routes.slice(0, 8).map((r, i) => (
                          <tr key={i} style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? C.surface : C.light }}>
                            <td style={{ padding: '9px 10px', fontWeight: 600, color: C.text }}>{r.name || r.route_name || `Route ${i + 1}`}</td>
                            <td style={{ padding: '9px 10px', color: C.muted }}>{r.from_location || r.origin || '—'}</td>
                            <td style={{ padding: '9px 10px', color: C.muted }}>{r.to_location || r.destination || '—'}</td>
                            <td style={{ padding: '9px 10px', color: C.muted }}>{r.vehicle_no || r.bus_no || '—'}</td>
                            <td style={{ padding: '9px 10px', color: C.muted }}>{r.driver_name || '—'}</td>
                            <td style={{ padding: '9px 10px', fontWeight: 600, color: C.primary }}>{r.student_count ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
