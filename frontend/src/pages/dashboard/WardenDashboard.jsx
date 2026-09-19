// frontend/src/pages/dashboard/WardenDashboard.jsx
// Hostel Warden — Hostel Operations Command Center

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
  indigo:  '#4338ca',
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
          <i className={`ti ${icon}`} style={{ fontSize: 15, color: C.indigo }} />
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

export default function WardenDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('ederp_theme') === 'dark');
  useEffect(() => { localStorage.setItem('ederp_theme', darkMode ? 'dark' : 'light'); }, [darkMode]);

  const goTo = useCallback((path) => navigate(resolveTenantPath(path, user)), [navigate, user]);

  const [dashboard,    setDashboard]    = useState(null);
  const [complaints,   setComplaints]   = useState([]);
  const [outPasses,    setOutPasses]    = useState([]);
  const [visitors,     setVisitors]     = useState([]);
  const [loading,      setLoading]      = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get('/hostel/dashboard').catch(() => ({ data: null })),
      api.get('/hostel/complaints', { params: { status: 'OPEN', per_page: 6 } }).catch(() => ({ data: { complaints: [] } })),
      api.get('/hostel/out-pass', { params: { status: 'PENDING', per_page: 6 } }).catch(() => ({ data: { passes: [] } })),
      api.get('/hostel/visitors', { params: { per_page: 5 } }).catch(() => ({ data: { visitors: [] } })),
    ]).then(([dash, comp, passes, vis]) => {
      setDashboard(dash.data);
      setComplaints(comp.data?.complaints || []);
      setOutPasses(passes.data?.passes || []);
      setVisitors(vis.data?.visitors || []);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const d = dashboard || {};
  const totalResidents = d.total_residents ?? d.occupied_beds ?? null;
  const totalBeds      = d.total_beds ?? null;
  const occupancyRate  = totalBeds && totalResidents != null ? Math.round((totalResidents / totalBeds) * 100) : null;
  const pendingFees    = d.pending_fees ?? null;
  const totalRooms     = d.total_rooms ?? null;
  const availableBeds  = d.available_beds ?? (totalBeds != null && totalResidents != null ? totalBeds - totalResidents : null);
  const rollCallDone   = d.attendance_taken ?? d.roll_call_done ?? null;

  const todayStr = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className={`app-shell${darkMode ? ' theme-dark' : ''}`}>
      <Sidebar darkMode={darkMode} />
      <div className="main-content">
        <Navbar title="Hostel Operations Command Center" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />
        <div className="page-body" style={{ background: C.bg, padding: '20px 24px', minHeight: '100vh' }}>

          {/* ── Hero ── */}
          <div style={{
            borderRadius: 18, padding: '26px 32px', marginBottom: 24,
            background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #3730a3 80%, #4338ca 100%)',
            color: '#fff', position: 'relative', overflow: 'hidden',
            boxShadow: '0 8px 30px rgba(67,56,202,0.35)',
          }}>
            <div style={{ position: 'absolute', top: -50, right: -30, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', opacity: 0.75, marginBottom: 6 }}>
                  {todayStr.toUpperCase()} · HOSTEL WARDEN PORTAL
                </div>
                <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>Hostel Operations Hub</h1>
                <p style={{ margin: '8px 0 0', opacity: 0.8, fontSize: 14 }}>
                  {totalResidents != null ? `${totalResidents} residents` : 'Loading…'}
                  {totalBeds != null ? ` · ${totalBeds} beds` : ''}
                  {occupancyRate != null ? ` · ${occupancyRate}% occupancy` : ''}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => goTo('/hostel/attendance')} style={{
                  padding: '10px 20px', borderRadius: 10, border: 'none',
                  background: '#fff', color: '#4338ca', fontWeight: 700, cursor: 'pointer', fontSize: 13,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <i className="ti ti-clipboard-check" /> Night Roll Call
                </button>
                <button onClick={() => goTo('/hostel/room-map')} style={{
                  padding: '10px 20px', borderRadius: 10, border: '1.5px solid rgba(255,255,255,0.5)',
                  background: 'rgba(255,255,255,0.15)', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13,
                  display: 'flex', alignItems: 'center', gap: 6, backdropFilter: 'blur(4px)',
                }}>
                  <i className="ti ti-layout-grid" /> Room Map
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: C.muted }}>
              <i className="ti ti-loader-2" style={{ fontSize: 32, animation: 'spin 1s linear infinite' }} />
              <p style={{ marginTop: 12 }}>Loading hostel data…</p>
            </div>
          ) : (
            <>
              {/* ── KPIs ── */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 20 }}>
                <KPI icon="ti-users" label="Total Residents" value={totalResidents?.toLocaleString()} color={C.indigo} onClick={() => goTo('/hostel/admission')} />
                <KPI icon="ti-bed" label="Total Beds" value={totalBeds?.toLocaleString()} color={C.primary} />
                <KPI icon="ti-door-enter" label="Available Beds" value={availableBeds?.toLocaleString()} color={C.green}
                     badge={availableBeds != null && availableBeds > 0 ? { text: 'VACANT', color: C.green } : { text: 'FULL', color: C.error }} />
                <KPI icon="ti-layout-grid" label="Total Rooms" value={totalRooms?.toLocaleString()} color={C.indigo} onClick={() => goTo('/hostel/room-map')} />
                <KPI icon="ti-currency-rupee" label="Pending Fees" value={pendingFees != null ? `₹${Number(pendingFees).toLocaleString('en-IN')}` : '—'}
                     color={pendingFees > 0 ? C.warning : C.green}
                     badge={pendingFees > 0 ? { text: 'PENDING', color: C.warning } : null}
                     onClick={() => goTo('/hostel/fees')} />
                <KPI icon="ti-tool" label="Open Complaints" value={complaints.length}
                     color={complaints.length > 0 ? C.error : C.green}
                     badge={complaints.length > 0 ? { text: 'ACTION', color: C.error } : { text: 'CLEAR', color: C.green }}
                     onClick={() => goTo('/hostel/complaints')} />
              </div>

              {/* ── Occupancy Bar ── */}
              {occupancyRate != null && (
                <div style={{ ...Card, background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', padding: '18px 22px', marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <i className="ti ti-building" style={{ fontSize: 15, color: C.indigo }} />
                      <span style={{ fontWeight: 700, fontSize: 14, color: C.text }}>Occupancy Rate</span>
                    </div>
                    <span style={{
                      fontSize: 14, fontWeight: 800,
                      color: occupancyRate >= 90 ? C.error : occupancyRate >= 70 ? C.warning : C.green,
                    }}>{occupancyRate}%</span>
                  </div>
                  <div style={{ height: 12, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{
                      width: `${occupancyRate}%`, height: '100%', borderRadius: 99,
                      background: occupancyRate >= 90 ? C.error : occupancyRate >= 70 ? C.warning : C.green,
                      transition: 'width 0.6s ease',
                    }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.muted, marginTop: 6 }}>
                    <span>{totalResidents} residents</span>
                    <span>{availableBeds} beds available</span>
                    <span>{totalBeds} total beds</span>
                  </div>
                </div>
              )}

              {/* ── Row 2: Quick Actions + Roll Call Status ── */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>

                <Card title="Quick Actions" icon="ti-bolt">
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <QA icon="ti-clipboard-check" label="Roll Call"      color={C.indigo}  onClick={() => goTo('/hostel/attendance')} />
                    <QA icon="ti-user-plus"        label="Admission"      color={C.green}   onClick={() => goTo('/hostel/admission')} />
                    <QA icon="ti-ticket"           label="Out Pass"       color={C.primary} onClick={() => goTo('/hostel/out-pass')} />
                    <QA icon="ti-layout-grid"      label="Room Map"       color="#7c3aed"   onClick={() => goTo('/hostel/room-map')} />
                    <QA icon="ti-currency-rupee"   label="Fees"           color={C.warning} onClick={() => goTo('/hostel/fees')} />
                    <QA icon="ti-tool"             label="Complaints"     color={C.error}   onClick={() => goTo('/hostel/complaints')} />
                    <QA icon="ti-users"            label="Visitors"       color="#0891b2"   onClick={() => goTo('/hostel/visitors')} />
                    <QA icon="ti-report"           label="Reports"        color={C.muted}   onClick={() => goTo('/hostel/reports')} />
                  </div>
                </Card>

                {/* Pending Out Passes */}
                <Card
                  title={`Pending Out Passes (${outPasses.length})`}
                  icon="ti-ticket"
                  action={
                    <button onClick={() => goTo('/hostel/out-pass')} style={{
                      fontSize: 12, color: C.indigo, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600,
                    }}>View All →</button>
                  }
                >
                  {outPasses.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px 0', color: C.muted, fontSize: 13 }}>
                      <i className="ti ti-circle-check" style={{ fontSize: 28, color: C.green, opacity: 0.7 }} />
                      <p style={{ marginTop: 8 }}>No pending out-pass requests</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {outPasses.slice(0, 5).map((pass, i) => (
                        <div key={i} style={{
                          padding: '10px 12px', borderRadius: 9, background: '#fefce8',
                          border: `1px solid #fde68a`, display: 'flex', alignItems: 'center', gap: 10,
                        }}>
                          <i className="ti ti-ticket" style={{ fontSize: 16, color: C.warning, flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: 12, color: C.text }}>{pass.student_name || 'Student'}</div>
                            <div style={{ fontSize: 10, color: C.muted, marginTop: 1 }}>
                              {pass.pass_type || 'OUT PASS'} · {pass.destination || pass.reason || '—'}
                            </div>
                          </div>
                          <span style={{ fontSize: 10, fontWeight: 700, color: C.warning, flexShrink: 0, background: `${C.warning}20`, padding: '2px 7px', borderRadius: 99 }}>PENDING</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>

              {/* ── Row 3: Open Complaints + Recent Visitors ── */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>

                {/* Open Complaints */}
                <Card
                  title={`Open Complaints (${complaints.length})`}
                  icon="ti-tool"
                  action={
                    <button onClick={() => goTo('/hostel/complaints')} style={{
                      fontSize: 12, color: C.error, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600,
                    }}>Manage →</button>
                  }
                >
                  {complaints.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px 0', color: C.muted, fontSize: 13 }}>
                      <i className="ti ti-mood-happy" style={{ fontSize: 28, color: C.green, opacity: 0.7 }} />
                      <p style={{ marginTop: 8 }}>No open complaints</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {complaints.slice(0, 5).map((comp, i) => (
                        <div key={i} style={{
                          padding: '10px 12px', borderRadius: 9, background: '#fef2f2',
                          border: `1px solid #fecaca`, display: 'flex', alignItems: 'center', gap: 10,
                        }}>
                          <i className="ti ti-alert-triangle" style={{ fontSize: 15, color: C.error, flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: 12, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {comp.title || comp.category || 'Complaint'}
                            </div>
                            <div style={{ fontSize: 10, color: C.muted, marginTop: 1 }}>
                              {comp.room_name || comp.room || '—'} · {comp.student_name || comp.resident_name || '—'}
                            </div>
                          </div>
                          <span style={{
                            fontSize: 10, fontWeight: 700, flexShrink: 0,
                            background: comp.priority === 'HIGH' ? `${C.error}15` : `${C.warning}15`,
                            color: comp.priority === 'HIGH' ? C.error : C.warning,
                            padding: '2px 7px', borderRadius: 99,
                          }}>{comp.priority || 'NORMAL'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                {/* Recent Visitors */}
                <Card
                  title="Recent Visitors"
                  icon="ti-users"
                  action={
                    <button onClick={() => goTo('/hostel/visitors')} style={{
                      fontSize: 12, color: C.indigo, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600,
                    }}>Visitor Log →</button>
                  }
                >
                  {visitors.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px 0', color: C.muted, fontSize: 13 }}>
                      <i className="ti ti-users" style={{ fontSize: 28, opacity: 0.4 }} />
                      <p style={{ marginTop: 8 }}>No recent visitor records</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {visitors.slice(0, 5).map((vis, i) => (
                        <div key={i} style={{
                          padding: '10px 12px', borderRadius: 9, background: C.light,
                          border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 10,
                        }}>
                          <div style={{ width: 32, height: 32, borderRadius: '50%', background: `${C.indigo}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <i className="ti ti-user" style={{ fontSize: 15, color: C.indigo }} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: 12, color: C.text }}>{vis.visitor_name || 'Visitor'}</div>
                            <div style={{ fontSize: 10, color: C.muted, marginTop: 1 }}>
                              Visiting: {vis.resident_name || vis.student_name || '—'}
                            </div>
                          </div>
                          <div style={{ fontSize: 10, color: C.muted, textAlign: 'right', flexShrink: 0 }}>
                            {vis.visit_date || vis.check_in ? new Date(vis.visit_date || vis.check_in).toLocaleDateString('en-IN') : '—'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            </>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
