import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api     from '../../api/axios';
import toast   from 'react-hot-toast';

export default function HostelDashboard() {
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(localStorage.getItem('ederp_theme') === 'dark');
  const [data, setData]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/hostel/dashboard')
      .then(r => setData(r.data))
      .catch(() => toast.error('Dashboard load nahi hua'))
      .finally(() => setLoading(false));
  }, []);

  const cardStyle = {
    background: darkMode ? '#1e293b' : '#fff',
    border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
    borderRadius: 12, padding: 18,
  };

  const STAT_CARDS = data ? [
    { label: 'Total Hostels',    value: data.total_hostels,   icon: '🏨', color: '#4f46e5' },
    { label: 'Buildings',        value: data.total_buildings, icon: '🏢', color: '#0176d3' },
    { label: 'Rooms',            value: data.total_rooms,     icon: '🚪', color: '#7c3aed' },
    { label: 'Total Beds',       value: data.total_beds,      icon: '🛏️', color: '#0891b2' },
    { label: 'Occupied Beds',    value: data.occupied_beds,   icon: '🔴', color: '#dc2626' },
    { label: 'Vacant Beds',      value: data.vacant_beds,     icon: '🟢', color: '#16a34a' },
    { label: 'Reserved Beds',    value: data.reserved_beds,   icon: '🟡', color: '#d97706' },
    { label: 'Maintenance Beds', value: data.maintenance_beds,icon: '⚪', color: '#64748b' },
  ] : [];

  const TODAY_CARDS = data ? [
    { label: "Hostel Students",     value: data.hostel_students,   icon: '👥' },
    { label: "Today's Admissions",  value: data.todays_admissions, icon: '📝' },
    { label: "Today's Transfers",   value: data.todays_transfers,  icon: '🔄' },
    { label: "Today's Vacate",      value: data.todays_vacate,     icon: '🚪' },
  ] : [];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: darkMode ? '#0f172a' : '#f8fafc' }}>
      <Sidebar darkMode={darkMode} />
      <div style={{ marginLeft: 232, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Navbar title="Hostel Dashboard" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />

        <div style={{ padding: 24 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>Loading...</div>
          ) : !data ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>Data load nahi ho payi</div>
          ) : (
            <>
              {/* Quick actions */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
                <button onClick={() => navigate('/hostel/admission')} style={{
                  background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8,
                  padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}>+ New Admission</button>
                <button onClick={() => navigate('/hostel/room-map')} style={{
                  background: darkMode ? '#1e293b' : '#fff', color: darkMode ? '#e2e8f0' : '#334155',
                  border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, borderRadius: 8,
                  padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}>View Room Map</button>
                <button onClick={() => navigate('/hostel/setup')} style={{
                  background: darkMode ? '#1e293b' : '#fff', color: darkMode ? '#e2e8f0' : '#334155',
                  border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, borderRadius: 8,
                  padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}>Hostel Setup</button>
              </div>

              {/* Occupancy overview */}
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: 14, marginBottom: 20,
              }}>
                {STAT_CARDS.map(c => (
                  <div key={c.label} style={cardStyle}>
                    <div style={{ fontSize: 22, marginBottom: 6 }}>{c.icon}</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: c.color }}>{c.value}</div>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{c.label}</div>
                  </div>
                ))}
              </div>

              {/* Occupancy bar */}
              <div style={{ ...cardStyle, marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: darkMode ? '#f1f5f9' : '#0f172a' }}>
                    Overall Occupancy
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#4f46e5' }}>{data.occupancy_pct}%</span>
                </div>
                <div style={{ height: 10, borderRadius: 6, background: darkMode ? '#334155' : '#f1f5f9', overflow: 'hidden' }}>
                  <div style={{
                    width: `${data.occupancy_pct}%`, height: '100%',
                    background: 'linear-gradient(90deg, #4f46e5, #7c3aed)',
                    borderRadius: 6, transition: 'width 0.3s',
                  }} />
                </div>
              </div>

              {/* Today's activity */}
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 14, marginBottom: 20,
              }}>
                {TODAY_CARDS.map(c => (
                  <div key={c.label} style={cardStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 24 }}>{c.icon}</span>
                      <div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: darkMode ? '#f1f5f9' : '#0f172a' }}>{c.value}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>{c.label}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Per-hostel breakdown */}
              <div style={cardStyle}>
                <h4 style={{ margin: '0 0 14px', fontSize: 14, color: darkMode ? '#f1f5f9' : '#0f172a' }}>
                  Hostel-wise Occupancy
                </h4>
                {data.hostel_breakdown.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 30, color: '#94a3b8', fontSize: 13 }}>
                    Koi hostel setup nahi hua abhi
                  </div>
                ) : data.hostel_breakdown.map(h => (
                  <div key={h.id} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                      <span style={{ fontWeight: 600, color: darkMode ? '#e2e8f0' : '#1e293b' }}>{h.name}</span>
                      <span style={{ color: '#94a3b8' }}>
                        {h.occupied_beds}/{h.total_beds} beds ({h.occupancy_pct}%)
                      </span>
                    </div>
                    <div style={{ height: 8, borderRadius: 4, background: darkMode ? '#334155' : '#f1f5f9', overflow: 'hidden' }}>
                      <div style={{
                        width: `${h.occupancy_pct}%`, height: '100%',
                        background: h.occupancy_pct > 85 ? '#dc2626' : h.occupancy_pct > 60 ? '#d97706' : '#16a34a',
                        borderRadius: 4, transition: 'width 0.3s',
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
