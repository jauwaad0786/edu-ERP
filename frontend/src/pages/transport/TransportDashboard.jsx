import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api     from '../../api/axios';
import toast   from 'react-hot-toast';
import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

const PIE_COLORS = ['#6366f1', '#06b6d4', '#f59e0b', '#10b981'];

export default function TransportDashboard() {
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('ederp_theme') === 'dark');
  const [data, setData] = useState(null);
  const [monthly, setMonthly] = useState([]);
  const [vehicleDist, setVehicleDist] = useState([]);
  const [studentsByVehicle, setStudentsByVehicle] = useState([]);
  const [routeWise, setRouteWise] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);
  const [upcomingMaintenance, setUpcomingMaintenance] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    localStorage.setItem('ederp_theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    Promise.all([
      api.get('/transport/dashboard'),
      api.get('/transport/dashboard/monthly-collection'),
      api.get('/transport/dashboard/vehicle-distribution'),
      api.get('/transport/dashboard/students-by-vehicle'),
      api.get('/transport/dashboard/route-wise-students'),
      api.get('/transport/dashboard/recent-activities?limit=8'),
      api.get('/transport/dashboard/upcoming-maintenance'),
    ])
      .then(([d, m, vd, sv, rw, ra, um]) => {
        setData(d.data.data);
        setMonthly(m.data.data);
        setVehicleDist(vd.data.data);
        setStudentsByVehicle(sv.data.data);
        setRouteWise(rw.data.data);
        setRecentActivities(ra.data.data);
        setUpcomingMaintenance(um.data.data);
      })
      .catch(() => toast.error('Transport Dashboard load nahi hua'))
      .finally(() => setLoading(false));
  }, []);

  const STAT_CARDS = data ? [
    { label: 'Total Fleet',        value: data.total_vehicles,               icon: 'ti-bus', color: '#6366f1', gradient: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' },
    { label: 'Licensed Drivers',   value: data.total_drivers,                icon: 'ti-steering-wheel', color: '#06b6d4', gradient: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)' },
    { label: 'Conductors',         value: data.total_conductors,             icon: 'ti-ticket', color: '#8b5cf6', gradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)' },
    { label: 'Students in Transit',value: data.students_using_transport,     icon: 'ti-user-check', color: '#10b981', gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' },
    { label: 'Active Routes',      value: data.active_routes,                icon: 'ti-map-pins', color: '#3b82f6', gradient: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' },
    { label: 'Fee Recovered',      value: `₹${(data.transport_fee_collected || 0).toLocaleString('en-IN')}`, icon: 'ti-cash', color: '#059669', gradient: 'linear-gradient(135deg, #10b981 0%, #047857 100%)' },
    { label: 'Pending Dues',       value: `₹${(data.transport_fee_pending || 0).toLocaleString('en-IN')}`,   icon: 'ti-receipt-refund', color: '#ef4444', gradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' },
    { label: 'Maintenance Garage', value: data.vehicles_under_maintenance,   icon: 'ti-tool', color: '#f59e0b', gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' },
    { label: 'Running Trips Today',value: data.today_running_trips,          icon: 'ti-road', color: '#4f46e5', gradient: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)' },
    { label: 'Live GPS Broadcast', value: data.live_trips_now,               icon: 'ti-broadcast', color: '#ec4899', gradient: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)' },
  ] : [];

  const vehicleTypeData = data ? [
    { name: 'Bus', value: data.bus_count || 0 },
    { name: 'Van', value: data.van_count || 0 },
    { name: 'Car', value: data.car_count || 0 },
  ].filter(x => x.value > 0) : [];

  return (
    <div className={`app-shell${darkMode ? ' theme-dark' : ''}`}>
      <Sidebar darkMode={darkMode} />
      <div className="main-content">
        <Navbar title="Fleet &amp; Transport Logistics Hub" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />

        <div className="page-body">

          {/* ══ Hero Command Banner ══ */}
          <div style={{
            position: 'relative', overflow: 'hidden',
            borderRadius: '20px', padding: '24px 28px', marginBottom: '22px',
            background: darkMode
              ? 'linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)'
              : 'linear-gradient(135deg, #1e293b 0%, #334155 50%, #475569 100%)',
            color: '#ffffff',
            boxShadow: '0 10px 30px -5px rgba(30, 41, 59, 0.4)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span style={{
                    padding: '3px 10px', borderRadius: '20px',
                    background: 'rgba(255,255,255,0.15)', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase'
                  }}>
                    🚌 Smart Fleet Operations
                  </span>
                  <span style={{ fontSize: '12px', opacity: 0.9, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                    {data?.live_trips_now ?? 0} Live GPS Vehicles Active
                  </span>
                </div>
                <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em', color: '#ffffff' }}>
                  Transport Command Center
                </h1>
                <p style={{ margin: '4px 0 0', fontSize: '13.5px', color: 'rgba(255,255,255,0.85)' }}>
                  Live vehicle route telemetry, passenger assignments, fee recovery momentum, and maintenance tracking.
                </p>
              </div>

              {/* Quick Launchpad Actions */}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => navigate('/transport/live')}
                  style={{
                    background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '10px',
                    padding: '10px 16px', fontSize: '13px', fontWeight: 800, cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)', display: 'flex', alignItems: 'center', gap: '6px'
                  }}
                >
                  <i className="ti ti-broadcast" /> 📡 Live Tracking Map
                </button>
                <button
                  onClick={() => navigate('/transport/students')}
                  style={{
                    background: 'rgba(255,255,255,0.15)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.3)',
                    borderRadius: '10px', padding: '10px 16px', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                    backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', gap: '6px'
                  }}
                >
                  <i className="ti ti-user-plus" /> Assign Transport
                </button>
                <button
                  onClick={() => navigate('/transport/routes')}
                  style={{
                    background: 'rgba(255,255,255,0.15)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.3)',
                    borderRadius: '10px', padding: '10px 16px', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                    backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', gap: '6px'
                  }}
                >
                  <i className="ti ti-map-pins" /> Manage Routes
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '80px 20px', color: '#94a3b8' }}>
              <div style={{ fontSize: '20px', fontWeight: 700 }}>Loading Fleet Telemetry &amp; Routes...</div>
            </div>
          ) : !data ? (
            <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>Data load nahi ho payi</div>
          ) : (
            <>
              {/* ══ Bento Stat Cards Grid ══ */}
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: '14px', marginBottom: '24px',
              }}>
                {STAT_CARDS.map(c => (
                  <div
                    key={c.label}
                    style={{
                      background: darkMode ? '#111827' : '#ffffff',
                      border: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : '#e2e8f0'}`,
                      borderRadius: '16px', padding: '16px 18px',
                      boxShadow: darkMode ? '0 4px 16px rgba(0,0,0,0.3)' : '0 4px 16px rgba(15,23,42,0.03)',
                      transition: 'transform 0.2s ease',
                    }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                      <div style={{
                        width: '36px', height: '36px', borderRadius: '10px',
                        background: c.gradient, color: '#ffffff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: `0 4px 10px -2px ${c.color}60`
                      }}>
                        <i className={`ti ${c.icon}`} style={{ fontSize: '18px' }} />
                      </div>
                      <span style={{ fontSize: '11px', color: darkMode ? '#94a3b8' : '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                        {c.label}
                      </span>
                    </div>
                    <div style={{ fontSize: '22px', fontWeight: 900, color: darkMode ? '#ffffff' : '#0f172a' }}>
                      {c.value}
                    </div>
                  </div>
                ))}
              </div>

              {/* ══ Analytics Graphs Row 1 ══ */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '18px', marginBottom: '20px' }}>
                <div style={{
                  background: darkMode ? '#111827' : '#ffffff',
                  border: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : '#e2e8f0'}`,
                  borderRadius: '18px', padding: '20px',
                  boxShadow: darkMode ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 20px rgba(15,23,42,0.03)'
                }}>
                  <h4 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a' }}>
                    📈 Monthly Transport Fee Collection Trend
                  </h4>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={monthly} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                      <defs>
                        <linearGradient id="transFeeGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#1f2937' : '#f1f5f9'} />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                      <Tooltip contentStyle={{ background: darkMode ? '#1e293b' : '#ffffff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }} />
                      <Area type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#transFeeGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div style={{
                  background: darkMode ? '#111827' : '#ffffff',
                  border: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : '#e2e8f0'}`,
                  borderRadius: '18px', padding: '20px',
                  boxShadow: darkMode ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 20px rgba(15,23,42,0.03)'
                }}>
                  <h4 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a' }}>
                    🚌 Fleet Vehicle Distribution
                  </h4>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={vehicleTypeData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={75}
                           label={({ name, value }) => `${name}: ${value}`}>
                        {vehicleTypeData.map((entry, i) => (
                          <Cell key={entry.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* ══ Analytics Graphs Row 2 ══ */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', marginBottom: '20px' }}>
                <div style={{
                  background: darkMode ? '#111827' : '#ffffff',
                  border: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : '#e2e8f0'}`,
                  borderRadius: '18px', padding: '20px',
                  boxShadow: darkMode ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 20px rgba(15,23,42,0.03)'
                }}>
                  <h4 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a' }}>
                    👥 Students by Vehicle Capacity
                  </h4>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={studentsByVehicle} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#1f2937' : '#f1f5f9'} />
                      <XAxis dataKey="vehicle_number" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                      <Tooltip contentStyle={{ background: darkMode ? '#1e293b' : '#ffffff', borderRadius: '8px' }} />
                      <Bar dataKey="students" fill="#06b6d4" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div style={{
                  background: darkMode ? '#111827' : '#ffffff',
                  border: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : '#e2e8f0'}`,
                  borderRadius: '18px', padding: '20px',
                  boxShadow: darkMode ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 20px rgba(15,23,42,0.03)'
                }}>
                  <h4 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a' }}>
                    🗺️ Route Wise Student Distribution
                  </h4>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={routeWise} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#1f2937' : '#f1f5f9'} />
                      <XAxis dataKey="route_name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                      <Tooltip contentStyle={{ background: darkMode ? '#1e293b' : '#ffffff', borderRadius: '8px' }} />
                      <Bar dataKey="students" fill="#6366f1" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* ══ Operational Activity & Maintenance Rows ══ */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
                <div style={{
                  background: darkMode ? '#111827' : '#ffffff',
                  border: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : '#e2e8f0'}`,
                  borderRadius: '18px', padding: '20px',
                  boxShadow: darkMode ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 20px rgba(15,23,42,0.03)'
                }}>
                  <h4 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a' }}>
                    🔄 Recent Transport Activity &amp; Transfers
                  </h4>
                  {recentActivities.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8', fontSize: '13px' }}>
                      Koi recent transfer activity nahi hui
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {recentActivities.map(a => (
                        <div key={a.id} style={{
                          display: 'flex', justifyContent: 'space-between', padding: '10px 12px',
                          borderRadius: '10px', background: darkMode ? '#1e293b' : '#f8fafc',
                          border: `1px solid ${darkMode ? '#334155' : '#f1f5f9'}`, fontSize: '12.5px',
                        }}>
                          <span style={{ color: darkMode ? '#ffffff' : '#0f172a', fontWeight: 600 }}>
                            {a.transfer_type === 'ADDED' ? '➕ Passenger Added' :
                             a.transfer_type === 'REMOVED' ? '➖ Removed' : '🔄 Transferred'}
                            {' — '}{a.to_vehicle_number || a.from_vehicle_number || ''}
                          </span>
                          <span style={{ color: '#94a3b8' }}>{a.transfer_date?.slice(0, 10)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{
                  background: darkMode ? '#111827' : '#ffffff',
                  border: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : '#e2e8f0'}`,
                  borderRadius: '18px', padding: '20px',
                  boxShadow: darkMode ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 20px rgba(15,23,42,0.03)'
                }}>
                  <h4 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a' }}>
                    🔧 Upcoming Vehicle Maintenance &amp; Garage
                  </h4>
                  {upcomingMaintenance.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8', fontSize: '13px' }}>
                      Koi open maintenance issue nahi hai 🎉
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {upcomingMaintenance.map(m => (
                        <div key={m.id} style={{
                          display: 'flex', justifyContent: 'space-between', padding: '10px 12px',
                          borderRadius: '10px', background: darkMode ? '#1e293b' : '#f8fafc',
                          border: `1px solid ${darkMode ? '#334155' : '#f1f5f9'}`, fontSize: '12.5px',
                        }}>
                          <span style={{ color: darkMode ? '#ffffff' : '#0f172a', fontWeight: 600 }}>
                            {m.vehicle_number} — {m.problem}
                          </span>
                          <span style={{
                            color: m.status === 'REPORTED' ? '#ef4444' : '#f59e0b', fontWeight: 800,
                            background: m.status === 'REPORTED' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                            padding: '2px 8px', borderRadius: '6px'
                          }}>
                            {m.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
