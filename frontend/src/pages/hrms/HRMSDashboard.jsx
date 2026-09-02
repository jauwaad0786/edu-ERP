import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function HRMSDashboard() {
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('ederp_theme') === 'dark');
  useEffect(() => { localStorage.setItem('ederp_theme', darkMode ? 'dark' : 'light'); }, [darkMode]);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  const loadDashboard = () => {
    setLoading(true);
    api.get('/hrms/dashboard')
      .then(res => setData(res.data))
      .catch(err => toast.error(err.response?.data?.error || 'Failed to load HRMS dashboard'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const cardBg = {
    background: darkMode ? '#141b2d' : '#ffffff',
    borderColor: darkMode ? '#1e293b' : '#e2e8f0',
    color: darkMode ? '#f8fafc' : '#0f172a'
  };

  const m = data?.metrics || {};
  const payroll = data?.payroll_summary || {};
  const trend = data?.attendance_trend || [];
  const depts = data?.department_distribution || [];

  return (
    <div className={`app-shell${darkMode ? ' theme-dark' : ''}`}>
      <Sidebar darkMode={darkMode} />
      <div className="main-content">
        <Navbar
          title="School HRMS Command Center"
          darkMode={darkMode}
          onToggleDark={() => setDarkMode(d => !d)}
        />

        <div className="page-body">
          {/* ══ Hero Header Banner ══ */}
          <div style={{
            position: 'relative', overflow: 'hidden',
            borderRadius: '20px', padding: '26px 32px', marginBottom: '24px',
            background: darkMode
              ? 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 60%, #312e81 100%)'
              : 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 60%, #3b82f6 100%)',
            color: '#ffffff',
            boxShadow: '0 10px 25px -5px rgba(37,99,235,0.25)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{
                  background: 'rgba(255,255,255,0.2)', padding: '4px 12px', borderRadius: '12px',
                  fontSize: '11px', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase'
                }}>
                  👑 Staff & Teacher Operations
                </span>
                <span style={{ fontSize: '12px', opacity: 0.85 }}>
                  Today: {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
              <h1 style={{ margin: '0 0 6px', fontSize: '26px', fontWeight: 800 }}>
                School Human Resource Management System
              </h1>
              <p style={{ margin: 0, fontSize: '13.5px', opacity: 0.9, maxWidth: '600px' }}>
                Complete employee lifecycle: teachers, administrative staff, GPS attendance, leave balances, and deterministic monthly payroll.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                onClick={() => navigate('/hrms/employees?action=add')}
                style={{
                  background: '#ffffff', color: '#1e3a8a', border: 'none', padding: '10px 18px',
                  borderRadius: '10px', fontWeight: 700, fontSize: '13px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}
              >
                <i className="ti ti-user-plus" /> Add Employee
              </button>
              <button
                onClick={() => navigate('/hrms/payroll')}
                style={{
                  background: 'rgba(255,255,255,0.18)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.3)',
                  padding: '10px 18px', borderRadius: '10px', fontWeight: 600, fontSize: '13px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                <i className="ti ti-cash" /> Run Payroll
              </button>
              <button
                onClick={() => navigate('/hrms/leaves')}
                style={{
                  background: 'rgba(255,255,255,0.18)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.3)',
                  padding: '10px 18px', borderRadius: '10px', fontWeight: 600, fontSize: '13px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                <i className="ti ti-calendar-event" /> Leave Queue ({m.pending_leave_requests || 0})
              </button>
            </div>
          </div>

          {/* ══ Top KPI Stats Cards ══ */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div className="stat-card" style={cardBg} onClick={() => navigate('/hrms/employees')}>
              <div className="stat-icon" style={{ background: '#3b82f616' }}>
                <i className="ti ti-users" style={{ color: '#3b82f6', fontSize: '20px' }} />
              </div>
              <div className="stat-label">Total Active Staff</div>
              <div className="stat-value" style={{ color: '#3b82f6' }}>{m.active_employees ?? '—'}</div>
              <div className="stat-sub">{m.teachers_count || 0} Teachers • {m.staff_count || 0} Non-Teaching</div>
            </div>

            <div className="stat-card" style={cardBg} onClick={() => navigate('/staff/attendance')}>
              <div className="stat-icon" style={{ background: '#10b98116' }}>
                <i className="ti ti-user-check" style={{ color: '#10b981', fontSize: '20px' }} />
              </div>
              <div className="stat-label">Present Today</div>
              <div className="stat-value" style={{ color: '#10b981' }}>{m.present_today ?? '—'}</div>
              <div className="stat-sub">{m.late_today || 0} Late • {m.half_day_today || 0} Half-Day</div>
            </div>

            <div className="stat-card" style={cardBg} onClick={() => navigate('/staff/attendance')}>
              <div className="stat-icon" style={{ background: '#ef444416' }}>
                <i className="ti ti-user-x" style={{ color: '#ef4444', fontSize: '20px' }} />
              </div>
              <div className="stat-label">Absent / Unmarked</div>
              <div className="stat-value" style={{ color: '#ef4444' }}>{m.absent_today ?? '—'}</div>
              <div className="stat-sub">{m.on_leave_today || 0} on Approved Leave</div>
            </div>

            <div className="stat-card" style={cardBg} onClick={() => navigate('/hrms/leaves')}>
              <div className="stat-icon" style={{ background: '#f59e0b16' }}>
                <i className="ti ti-clock" style={{ color: '#f59e0b', fontSize: '20px' }} />
              </div>
              <div className="stat-label">Pending Approvals</div>
              <div className="stat-value" style={{ color: '#f59e0b' }}>
                {(m.pending_attendance_approvals || 0) + (m.pending_leave_requests || 0)}
              </div>
              <div className="stat-sub">{m.pending_attendance_approvals || 0} Att. • {m.pending_leave_requests || 0} Leaves</div>
            </div>

            <div className="stat-card" style={cardBg} onClick={() => navigate('/hrms/payroll')}>
              <div className="stat-icon" style={{ background: '#8b5cf616' }}>
                <i className="ti ti-wallet" style={{ color: '#8b5cf6', fontSize: '20px' }} />
              </div>
              <div className="stat-label">Month Payroll ({new Date().toLocaleString('en-US', { month: 'short' })})</div>
              <div className="stat-value" style={{ color: '#8b5cf6', fontSize: '20px' }}>
                ₹{(payroll.total_net || 0).toLocaleString('en-IN')}
              </div>
              <div className="stat-sub">Status: <b>{payroll.status || 'Draft'}</b></div>
            </div>
          </div>

          {/* ══ Middle Section: Attendance Trend & Department Distribution ══ */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', marginBottom: '24px' }}>
            
            {/* 7-Day Attendance Trend */}
            <div style={{ ...cardBg, borderRadius: '16px', border: '1px solid', padding: '22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                <div>
                  <h3 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 700 }}>Staff Attendance Trend (Last 7 Days)</h3>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>Daily attendance rate across teaching and non-teaching teams</span>
                </div>
                <button
                  onClick={() => navigate('/staff/attendance')}
                  style={{ background: 'none', border: 'none', color: '#3b82f6', fontWeight: 600, fontSize: '12.5px', cursor: 'pointer' }}
                >
                  View Live Attendance →
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '14px', height: '180px', padding: '10px 0' }}>
                {trend.map((t, idx) => (
                  <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: t.pct >= 85 ? '#10b981' : t.pct >= 70 ? '#f59e0b' : '#ef4444' }}>
                      {t.pct}%
                    </span>
                    <div style={{
                      width: '100%', maxWidth: '36px', height: `${Math.max(12, (t.pct / 100) * 120)}px`,
                      background: t.pct >= 85
                        ? 'linear-gradient(180deg, #10b981 0%, #059669 100%)'
                        : t.pct >= 70
                          ? 'linear-gradient(180deg, #f59e0b 0%, #d97706 100%)'
                          : 'linear-gradient(180deg, #ef4444 0%, #dc2626 100%)',
                      borderRadius: '8px',
                      transition: 'all 0.3s ease'
                    }} />
                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>{t.date}</span>
                    <span style={{ fontSize: '10px', color: '#94a3b8' }}>{t.present}/{t.total}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Department Breakdown */}
            <div style={{ ...cardBg, borderRadius: '16px', border: '1px solid', padding: '22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Department Distribution</h3>
                <button
                  onClick={() => navigate('/hrms/employees')}
                  style={{ background: 'none', border: 'none', color: '#3b82f6', fontWeight: 600, fontSize: '12.5px', cursor: 'pointer' }}
                >
                  Directory
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {depts.length === 0 ? (
                  <p style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center', margin: '30px 0' }}>No departments configured yet.</p>
                ) : (
                  depts.map((d, i) => {
                    const total = m.active_employees || 1;
                    const pct = Math.round((d.count / total) * 100);
                    return (
                      <div key={i}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '4px' }}>
                          <span style={{ fontWeight: 600 }}>{d.name}</span>
                          <span style={{ color: '#64748b' }}>{d.count} staff ({pct}%)</span>
                        </div>
                        <div style={{ width: '100%', height: '6px', background: darkMode ? '#1e293b' : '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: '#3b82f6', borderRadius: '4px' }} />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* ══ Quick Navigation Grid ══ */}
          <h3 style={{ fontSize: '17px', fontWeight: 700, margin: '0 0 16px', color: darkMode ? '#f8fafc' : '#0f172a' }}>
            HRMS Management Modules
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
            
            <div
              style={{ ...cardBg, borderRadius: '14px', border: '1px solid', padding: '20px', cursor: 'pointer', transition: 'all 0.2s' }}
              onClick={() => navigate('/hrms/employees')}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#3b82f616', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                  <i className="ti ti-users" />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>Employee Directory</h4>
                  <span style={{ fontSize: '11.5px', color: '#64748b' }}>Manage Teachers &amp; Staff Master</span>
                </div>
              </div>
              <p style={{ margin: 0, fontSize: '12.5px', color: '#64748b' }}>
                Personal profiles, employment status, academic assignments, KYC verification, and lifecycle changes.
              </p>
            </div>

            <div
              style={{ ...cardBg, borderRadius: '14px', border: '1px solid', padding: '20px', cursor: 'pointer', transition: 'all 0.2s' }}
              onClick={() => navigate('/staff/attendance')}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#10b98116', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                  <i className="ti ti-map-pin" />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>GPS Attendance &amp; Tracking</h4>
                  <span style={{ fontSize: '11.5px', color: '#64748b' }}>Location Verification &amp; Shifts</span>
                </div>
              </div>
              <p style={{ margin: 0, fontSize: '12.5px', color: '#64748b' }}>
                Haversine distance verification, shift grace periods, official duty exemptions, and manual approvals.
              </p>
            </div>

            <div
              style={{ ...cardBg, borderRadius: '14px', border: '1px solid', padding: '20px', cursor: 'pointer', transition: 'all 0.2s' }}
              onClick={() => navigate('/hrms/leaves')}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#f59e0b16', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                  <i className="ti ti-calendar-event" />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>Leave &amp; Official Duty</h4>
                  <span style={{ fontSize: '11.5px', color: '#64748b' }}>Balances &amp; Approvals</span>
                </div>
              </div>
              <p style={{ margin: 0, fontSize: '12.5px', color: '#64748b' }}>
                CL/SL/EL quotas, leave approval queue, outdoor exam/event duties, and automated attendance synchronization.
              </p>
            </div>

            <div
              style={{ ...cardBg, borderRadius: '14px', border: '1px solid', padding: '20px', cursor: 'pointer', transition: 'all 0.2s' }}
              onClick={() => navigate('/hrms/payroll')}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#8b5cf616', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                  <i className="ti ti-cash" />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>Payroll &amp; PDF Payslips</h4>
                  <span style={{ fontSize: '11.5px', color: '#64748b' }}>Deterministic Calculation</span>
                </div>
              </div>
              <p style={{ margin: 0, fontSize: '12.5px', color: '#64748b' }}>
                Unexcused absence LOP deduction, Sunday/holiday zero deduction, PDF payslip generation, and payroll locking.
              </p>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}
