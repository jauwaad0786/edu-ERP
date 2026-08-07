import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api     from '../../api/axios';
import toast   from 'react-hot-toast';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const PIE_COLORS = ['#4f46e5', '#0891b2', '#d97706'];

export default function TransportDashboard() {
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(localStorage.getItem('ederp_theme') === 'dark');
  const [data, setData] = useState(null);
  const [monthly, setMonthly] = useState([]);
  const [vehicleDist, setVehicleDist] = useState([]);
  const [studentsByVehicle, setStudentsByVehicle] = useState([]);
  const [routeWise, setRouteWise] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);
  const [upcomingMaintenance, setUpcomingMaintenance] = useState([]);
  const [loading, setLoading] = useState(true);

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
      .catch(() => toast.error('Dashboard load nahi hua'))
      .finally(() => setLoading(false));
  }, []);

  const cardStyle = {
    background: darkMode ? '#1e293b' : '#fff',
    border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
    borderRadius: 12, padding: 18,
  };
  const textPrimary = darkMode ? '#f1f5f9' : '#0f172a';
  const textMuted = '#94a3b8';

  const STAT_CARDS = data ? [
    { label: 'Total Vehicles',       value: data.total_vehicles,               icon: '🚌', color: '#4f46e5' },
    { label: 'Total Drivers',        value: data.total_drivers,                icon: '🧑‍✈️', color: '#0176d3' },
    { label: 'Total Conductors',     value: data.total_conductors,             icon: '🎫', color: '#7c3aed' },
    { label: 'Using Transport',      value: data.students_using_transport,     icon: '🟢', color: '#16a34a' },
    { label: 'Not Using Transport',  value: data.students_not_using_transport, icon: '⚪', color: '#64748b' },
    { label: 'Active Routes',        value: data.active_routes,                icon: '🗺️', color: '#0891b2' },
    { label: 'Fee Pending',          value: `₹${data.transport_fee_pending}`,  icon: '⏳', color: '#dc2626' },
    { label: 'Fee Collected',        value: `₹${data.transport_fee_collected}`,icon: '💰', color: '#16a34a' },
    { label: 'Under Maintenance',    value: data.vehicles_under_maintenance,   icon: '🛠️', color: '#d97706' },
    { label: "Today's Trips",        value: data.today_running_trips,          icon: '🛣️', color: '#4f46e5' },
    { label: 'Live Now',             value: data.live_trips_now,               icon: '📡', color: '#dc2626' },
  ] : [];

  const vehicleTypeData = data ? [
    { name: 'Bus', value: data.bus_count },
    { name: 'Van', value: data.van_count },
    { name: 'Car', value: data.car_count },
  ] : [];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: darkMode ? '#0f172a' : '#f8fafc' }}>
      <Sidebar darkMode={darkMode} />
      <div style={{ marginLeft: 232, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Navbar title="Transport Dashboard" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />

        <div style={{ padding: 24 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: textMuted }}>Loading...</div>
          ) : !data ? (
            <div style={{ textAlign: 'center', padding: 60, color: textMuted }}>Data load nahi ho payi</div>
          ) : (
            <>
              {/* Quick actions */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
                <button onClick={() => navigate('/transport/students')} style={{
                  background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8,
                  padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}>+ Assign Transport</button>
                <button onClick={() => navigate('/transport/live')} style={{
                  background: darkMode ? '#1e293b' : '#fff', color: darkMode ? '#e2e8f0' : '#334155',
                  border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, borderRadius: 8,
                  padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}>📡 Live Tracking</button>
                <button onClick={() => navigate('/transport/routes')} style={{
                  background: darkMode ? '#1e293b' : '#fff', color: darkMode ? '#e2e8f0' : '#334155',
                  border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, borderRadius: 8,
                  padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}>Manage Routes</button>
              </div>

              {/* Stat cards */}
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: 14, marginBottom: 20,
              }}>
                {STAT_CARDS.map(c => (
                  <div key={c.label} style={cardStyle}>
                    <div style={{ fontSize: 22, marginBottom: 6 }}>{c.icon}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: c.color }}>{c.value}</div>
                    <div style={{ fontSize: 12, color: textMuted, marginTop: 2 }}>{c.label}</div>
                  </div>
                ))}
              </div>

              {/* Graphs row 1 */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 20 }}>
                <div style={cardStyle}>
                  <h4 style={{ margin: '0 0 14px', fontSize: 14, color: textPrimary }}>Monthly Fee Collection</h4>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={monthly} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#334155' : '#f1f5f9'} />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="amount" stroke="#4f46e5" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div style={cardStyle}>
                  <h4 style={{ margin: '0 0 14px', fontSize: 14, color: textPrimary }}>Vehicle Distribution</h4>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={vehicleTypeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75}
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

              {/* Graphs row 2 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                <div style={cardStyle}>
                  <h4 style={{ margin: '0 0 14px', fontSize: 14, color: textPrimary }}>Students by Vehicle</h4>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={studentsByVehicle} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#334155' : '#f1f5f9'} />
                      <XAxis dataKey="vehicle_number" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="students" fill="#0891b2" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div style={cardStyle}>
                  <h4 style={{ margin: '0 0 14px', fontSize: 14, color: textPrimary }}>Route Wise Students</h4>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={routeWise} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#334155' : '#f1f5f9'} />
                      <XAxis dataKey="route_name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="students" fill="#7c3aed" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Recent activity + Upcoming maintenance */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={cardStyle}>
                  <h4 style={{ margin: '0 0 14px', fontSize: 14, color: textPrimary }}>Recent Activities</h4>
                  {recentActivities.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 20, color: textMuted, fontSize: 13 }}>Koi recent activity nahi</div>
                  ) : recentActivities.map(a => (
                    <div key={a.id} style={{
                      display: 'flex', justifyContent: 'space-between', padding: '8px 0',
                      borderBottom: `1px solid ${darkMode ? '#334155' : '#f1f5f9'}`, fontSize: 12,
                    }}>
                      <span style={{ color: textPrimary }}>
                        {a.transfer_type === 'ADDED' ? '➕ Added' :
                         a.transfer_type === 'REMOVED' ? '➖ Removed' : '🔄 Transferred'}
                        {' — '}{a.to_vehicle_number || a.from_vehicle_number || ''}
                      </span>
                      <span style={{ color: textMuted }}>{a.transfer_date?.slice(0, 10)}</span>
                    </div>
                  ))}
                </div>

                <div style={cardStyle}>
                  <h4 style={{ margin: '0 0 14px', fontSize: 14, color: textPrimary }}>Upcoming Vehicle Maintenance</h4>
                  {upcomingMaintenance.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 20, color: textMuted, fontSize: 13 }}>Koi open maintenance nahi</div>
                  ) : upcomingMaintenance.map(m => (
                    <div key={m.id} style={{
                      display: 'flex', justifyContent: 'space-between', padding: '8px 0',
                      borderBottom: `1px solid ${darkMode ? '#334155' : '#f1f5f9'}`, fontSize: 12,
                    }}>
                      <span style={{ color: textPrimary }}>{m.vehicle_number} — {m.problem}</span>
                      <span style={{
                        color: m.status === 'REPORTED' ? '#dc2626' : '#d97706', fontWeight: 600,
                      }}>{m.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
