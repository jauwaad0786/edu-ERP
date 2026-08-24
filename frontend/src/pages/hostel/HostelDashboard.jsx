import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api     from '../../api/axios';
import toast   from 'react-hot-toast';

export default function HostelDashboard() {
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('ederp_theme') === 'dark');
  const [data, setData]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    localStorage.setItem('ederp_theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    api.get('/hostel/dashboard')
      .then(r => setData(r.data))
      .catch(() => toast.error('Hostel Dashboard load nahi hua'))
      .finally(() => setLoading(false));
  }, []);

  const STAT_CARDS = data ? [
    { label: 'Total Hostels',    value: data.total_hostels,   icon: 'ti-building', color: '#6366f1', gradient: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' },
    { label: 'Total Buildings',  value: data.total_buildings, icon: 'ti-building-skyscraper', color: '#06b6d4', gradient: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)' },
    { label: 'Total Rooms',      value: data.total_rooms,     icon: 'ti-door', color: '#8b5cf6', gradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)' },
    { label: 'Total Beds',       value: data.total_beds,      icon: 'ti-bed', color: '#3b82f6', gradient: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' },
    { label: 'Occupied Beds',    value: data.occupied_beds,   icon: 'ti-user-check', color: '#ef4444', gradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' },
    { label: 'Vacant Beds',      value: data.vacant_beds,     icon: 'ti-circle-check', color: '#10b981', gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' },
    { label: 'Reserved Beds',    value: data.reserved_beds,   icon: 'ti-clock', color: '#f59e0b', gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' },
    { label: 'Maintenance Beds', value: data.maintenance_beds,icon: 'ti-tool', color: '#64748b', gradient: 'linear-gradient(135deg, #64748b 0%, #475569 100%)' },
  ] : [];

  const TODAY_CARDS = data ? [
    { label: 'Hostel Students',    value: data.hostel_students,   icon: 'ti-users', color: '#6366f1' },
    { label: "Today's Admissions", value: data.todays_admissions, icon: 'ti-user-plus', color: '#10b981' },
    { label: "Today's Transfers",  value: data.todays_transfers,  icon: 'ti-arrows-exchange', color: '#f59e0b' },
    { label: "Today's Vacate",     value: data.todays_vacate,     icon: 'ti-door-exit', color: '#ef4444' },
  ] : [];

  return (
    <div className={`app-shell${darkMode ? ' theme-dark' : ''}`}>
      <Sidebar darkMode={darkMode} />
      <div className="main-content">
        <Navbar title="Hostel &amp; Residence Management" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />

        <div className="page-body">

          {/* ══ Hero Command Banner ══ */}
          <div style={{
            position: 'relative', overflow: 'hidden',
            borderRadius: '20px', padding: '24px 28px', marginBottom: '22px',
            background: darkMode
              ? 'linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)'
              : 'linear-gradient(135deg, #4f46e5 0%, #6366f1 50%, #818cf8 100%)',
            color: '#ffffff',
            boxShadow: '0 10px 30px -5px rgba(79, 70, 229, 0.35)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span style={{
                    padding: '3px 10px', borderRadius: '20px',
                    background: 'rgba(255,255,255,0.2)', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase'
                  }}>
                    🏨 Campus Residence
                  </span>
                  <span style={{ fontSize: '12px', opacity: 0.9 }}>
                    Occupancy: {data?.occupancy_pct ?? 0}%
                  </span>
                </div>
                <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em', color: '#ffffff' }}>
                  Hostel Operations Center
                </h1>
                <p style={{ margin: '4px 0 0', fontSize: '13.5px', color: 'rgba(255,255,255,0.85)' }}>
                  Monitor resident boarding, manage room allocations, track bed vacancies, and handle student transfers.
                </p>
              </div>

              {/* Quick Launchpad Actions */}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => navigate('/hostel/admission')}
                  style={{
                    background: '#ffffff', color: '#4f46e5', border: 'none', borderRadius: '10px',
                    padding: '10px 16px', fontSize: '13px', fontWeight: 800, cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', gap: '6px'
                  }}
                >
                  <i className="ti ti-plus" /> New Admission
                </button>
                <button
                  onClick={() => navigate('/hostel/room-map')}
                  style={{
                    background: 'rgba(255,255,255,0.15)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.3)',
                    borderRadius: '10px', padding: '10px 16px', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                    backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', gap: '6px'
                  }}
                >
                  <i className="ti ti-layout-grid" /> View Room Map
                </button>
                <button
                  onClick={() => navigate('/hostel/setup')}
                  style={{
                    background: 'rgba(255,255,255,0.15)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.3)',
                    borderRadius: '10px', padding: '10px 16px', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                    backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', gap: '6px'
                  }}
                >
                  <i className="ti ti-settings" /> Hostel Setup
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '80px 20px', color: '#94a3b8' }}>
              <div style={{ fontSize: '20px', fontWeight: 700 }}>Loading Hostel Occupancy &amp; Data...</div>
            </div>
          ) : !data ? (
            <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>Data load nahi ho payi</div>
          ) : (
            <>
              {/* ══ Occupancy Progress Gauge Card ══ */}
              <div style={{
                background: darkMode ? '#111827' : '#ffffff',
                border: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : '#e2e8f0'}`,
                borderRadius: '18px', padding: '20px 24px', marginBottom: '22px',
                boxShadow: darkMode ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 20px rgba(15,23,42,0.03)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div>
                    <span style={{ fontSize: '14px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a' }}>
                      Overall Campus Bed Occupancy Rate
                    </span>
                    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                      {data.occupied_beds} occupied of {data.total_beds} total beds across all hostel buildings
                    </div>
                  </div>
                  <span style={{
                    fontSize: '18px', fontWeight: 900,
                    color: data.occupancy_pct > 85 ? '#ef4444' : data.occupancy_pct > 60 ? '#f59e0b' : '#10b981'
                  }}>
                    {data.occupancy_pct}%
                  </span>
                </div>
                <div style={{ height: '10px', borderRadius: '5px', background: darkMode ? '#1e293b' : '#f1f5f9', overflow: 'hidden' }}>
                  <div style={{
                    width: `${data.occupancy_pct}%`, height: '100%',
                    background: 'linear-gradient(90deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%)',
                    borderRadius: '5px', transition: 'width 0.5s ease'
                  }} />
                </div>
              </div>

              {/* ══ Bento Metric Cards ══ */}
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '14px', marginBottom: '22px',
              }}>
                {STAT_CARDS.map(c => (
                  <div
                    key={c.label}
                    style={{
                      background: darkMode ? '#111827' : '#ffffff',
                      border: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : '#e2e8f0'}`,
                      borderRadius: '16px', padding: '16px',
                      boxShadow: darkMode ? '0 4px 16px rgba(0,0,0,0.3)' : '0 4px 16px rgba(15,23,42,0.03)',
                      transition: 'transform 0.2s ease',
                    }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                      <div style={{
                        width: '34px', height: '34px', borderRadius: '8px',
                        background: c.gradient, color: '#ffffff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: `0 4px 10px -2px ${c.color}60`
                      }}>
                        <i className={`ti ${c.icon}`} style={{ fontSize: '16px' }} />
                      </div>
                      <span style={{ fontSize: '11px', color: darkMode ? '#94a3b8' : '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                        {c.label}
                      </span>
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 900, color: darkMode ? '#ffffff' : '#0f172a' }}>
                      {c.value ?? 0}
                    </div>
                  </div>
                ))}
              </div>

              {/* ══ Today's Live Movement Strip ══ */}
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '14px', marginBottom: '22px',
              }}>
                {TODAY_CARDS.map(c => (
                  <div key={c.label} style={{
                    background: darkMode ? '#111827' : '#ffffff',
                    border: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : '#e2e8f0'}`,
                    borderRadius: '16px', padding: '16px 20px',
                    display: 'flex', alignItems: 'center', gap: '14px',
                    boxShadow: darkMode ? '0 4px 16px rgba(0,0,0,0.3)' : '0 4px 16px rgba(15,23,42,0.03)'
                  }}>
                    <div style={{
                      width: '42px', height: '42px', borderRadius: '12px',
                      background: `${c.color}15`, color: c.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px'
                    }}>
                      <i className={`ti ${c.icon}`} />
                    </div>
                    <div>
                      <div style={{ fontSize: '22px', fontWeight: 900, color: darkMode ? '#ffffff' : '#0f172a' }}>{c.value ?? 0}</div>
                      <div style={{ fontSize: '11.5px', color: '#94a3b8', fontWeight: 600 }}>{c.label}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* ══ Per-Hostel Occupancy Breakdown ══ */}
              <div style={{
                background: darkMode ? '#111827' : '#ffffff',
                border: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : '#e2e8f0'}`,
                borderRadius: '18px', padding: '22px',
                boxShadow: darkMode ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 20px rgba(15,23,42,0.03)'
              }}>
                <h4 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a' }}>
                  🏢 Building &amp; Hostel-wise Capacity Breakdown
                </h4>
                {data.hostel_breakdown.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '36px', color: '#94a3b8', fontSize: '13px' }}>
                    Koi hostel configure nahi hua abhi
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {data.hostel_breakdown.map(h => (
                      <div key={h.id} style={{
                        padding: '14px 18px', borderRadius: '12px',
                        background: darkMode ? '#1e293b' : '#f8fafc',
                        border: `1px solid ${darkMode ? '#334155' : '#f1f5f9'}`
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13.5px' }}>
                          <span style={{ fontWeight: 700, color: darkMode ? '#ffffff' : '#0f172a' }}>{h.name}</span>
                          <span style={{ color: '#94a3b8', fontWeight: 600 }}>
                            {h.occupied_beds} / {h.total_beds} beds ({h.occupancy_pct}%)
                          </span>
                        </div>
                        <div style={{ height: '8px', borderRadius: '4px', background: darkMode ? '#334155' : '#e2e8f0', overflow: 'hidden' }}>
                          <div style={{
                            width: `${h.occupancy_pct}%`, height: '100%',
                            background: h.occupancy_pct > 85 ? '#ef4444' : h.occupancy_pct > 60 ? '#f59e0b' : '#10b981',
                            borderRadius: '4px', transition: 'width 0.4s ease'
                          }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
