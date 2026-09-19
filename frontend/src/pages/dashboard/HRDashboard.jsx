// frontend/src/pages/dashboard/HRDashboard.jsx
// HR — Human Resources Operations Center

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api     from '../../api/axios';
import toast   from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { resolveTenantPath } from '../../utils/routeBuilder';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const C = {
  bg:      '#f0f4f8',
  surface: '#ffffff',
  border:  '#e2e8f0',
  primary: '#0176d3',
  rose:    '#be123c',
  green:   '#16a34a',
  warning: '#d97706',
  error:   '#dc2626',
  purple:  '#7c3aed',
  text:    '#1e293b',
  muted:   '#64748b',
  light:   '#f8fafc',
};

const PIE_COLORS = ['#16a34a', '#d97706', '#dc2626', '#7c3aed'];

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
          <i className={`ti ${icon}`} style={{ fontSize: 15, color: C.rose }} />
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

export default function HRDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('ederp_theme') === 'dark');
  useEffect(() => { localStorage.setItem('ederp_theme', darkMode ? 'dark' : 'light'); }, [darkMode]);

  const goTo = useCallback((path) => navigate(resolveTenantPath(path, user)), [navigate, user]);

  const [employees,    setEmployees]    = useState([]);
  const [leaveReqs,    setLeaveReqs]    = useState([]);
  const [payrollSumm,  setPayrollSumm]  = useState(null);
  const [attSummary,   setAttSummary]   = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [reviewingId,  setReviewingId]  = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    const month = new Date().toISOString().slice(0, 7);
    Promise.all([
      api.get('/hrms/employees', { params: { per_page: 20 } }).catch(() => ({ data: { employees: [] } })),
      api.get('/hrms/leaves/requests', { params: { status: 'PENDING', per_page: 10 } }).catch(() => ({ data: [] })),
      api.get('/hrms/payroll', { params: { month } }).catch(() => ({ data: null })),
      api.get('/staff-attendance/summary').catch(() => ({ data: null })),
    ]).then(([emp, lr, pay, att]) => {
      const empList = emp.data?.employees || emp.data?.staff || [];
      setEmployees(empList);
      setLeaveReqs(Array.isArray(lr.data) ? lr.data : lr.data?.requests || []);
      setPayrollSumm(pay.data);
      setAttSummary(att.data);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleReview = async (reqId, approve) => {
    setReviewingId(reqId);
    try {
      await api.post(`/hrms/leaves/requests/${reqId}/review`, {
        approve,
        remarks: approve ? 'Approved by HR' : 'Rejected by HR',
      });
      toast.success(approve ? 'Leave approved' : 'Leave rejected');
      setLeaveReqs(prev => prev.filter(r => r.id !== reqId));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Action failed');
    } finally {
      setReviewingId(null);
    }
  };

  const totalEmp    = employees.length;
  const presentToday = attSummary?.present ?? attSummary?.today_present ?? null;
  const absentToday  = attSummary?.absent  ?? attSummary?.today_absent  ?? null;
  const onLeave      = attSummary?.on_leave ?? null;
  const attPct       = presentToday != null && totalEmp > 0
    ? Math.round((presentToday / totalEmp) * 100) : null;

  // Department distribution
  const deptCounts = {};
  employees.forEach(e => {
    const dept = e.department || e.role || 'Other';
    deptCounts[dept] = (deptCounts[dept] || 0) + 1;
  });
  const deptData = Object.entries(deptCounts)
    .map(([dept, count]) => ({ dept, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  // Leave type breakdown
  const leaveTypes = {};
  leaveReqs.forEach(r => {
    const t = r.leave_type || 'Other';
    leaveTypes[t] = (leaveTypes[t] || 0) + 1;
  });
  const leaveTypePie = Object.entries(leaveTypes).map(([name, value]) => ({ name, value }));

  const todayStr = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className={`app-shell${darkMode ? ' theme-dark' : ''}`}>
      <Sidebar darkMode={darkMode} />
      <div className="main-content">
        <Navbar title="Human Resources Operations" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />
        <div className="page-body" style={{ background: C.bg, padding: '20px 24px', minHeight: '100vh' }}>

          {/* ── Hero ── */}
          <div style={{
            borderRadius: 18, padding: '26px 32px', marginBottom: 24,
            background: 'linear-gradient(135deg, #4c0519 0%, #881337 40%, #9f1239 80%, #be123c 100%)',
            color: '#fff', position: 'relative', overflow: 'hidden',
            boxShadow: '0 8px 30px rgba(190,18,60,0.35)',
          }}>
            <div style={{ position: 'absolute', top: -50, right: -30, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', opacity: 0.75, marginBottom: 6 }}>
                  {todayStr.toUpperCase()} · HUMAN RESOURCES
                </div>
                <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>HR Operations Center</h1>
                <p style={{ margin: '8px 0 0', opacity: 0.8, fontSize: 14 }}>
                  {totalEmp} employees · {leaveReqs.length} pending leave requests
                  {attPct != null ? ` · ${attPct}% attendance today` : ''}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => goTo('/hrms/employees')} style={{
                  padding: '10px 20px', borderRadius: 10, border: 'none',
                  background: '#fff', color: '#be123c', fontWeight: 700, cursor: 'pointer', fontSize: 13,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <i className="ti ti-users" /> Employee Directory
                </button>
                <button onClick={() => goTo('/hrms/payroll')} style={{
                  padding: '10px 20px', borderRadius: 10, border: '1.5px solid rgba(255,255,255,0.5)',
                  background: 'rgba(255,255,255,0.15)', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13,
                  display: 'flex', alignItems: 'center', gap: 6, backdropFilter: 'blur(4px)',
                }}>
                  <i className="ti ti-cash" /> Payroll
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: C.muted }}>
              <i className="ti ti-loader-2" style={{ fontSize: 32, animation: 'spin 1s linear infinite' }} />
              <p style={{ marginTop: 12 }}>Loading HR data…</p>
            </div>
          ) : (
            <>
              {/* ── KPIs ── */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 20 }}>
                <KPI icon="ti-users" label="Total Employees" value={totalEmp} color={C.rose} onClick={() => goTo('/hrms/employees')} />
                <KPI icon="ti-circle-check" label="Present Today" value={presentToday ?? '—'}
                     color={C.green} onClick={() => goTo('/staff/attendance')} />
                <KPI icon="ti-user-x" label="Absent Today" value={absentToday ?? '—'}
                     color={absentToday > 0 ? C.error : C.green}
                     badge={absentToday > 0 ? { text: `${absentToday} ABSENT`, color: C.error } : null}
                     onClick={() => goTo('/staff/attendance')} />
                <KPI icon="ti-calendar-off" label="On Leave" value={onLeave ?? '—'}
                     color={C.warning} onClick={() => goTo('/hrms/leaves')} />
                <KPI icon="ti-calendar-event" label="Pending Leaves" value={leaveReqs.length}
                     color={leaveReqs.length > 0 ? C.warning : C.green}
                     badge={leaveReqs.length > 0 ? { text: 'REVIEW', color: C.warning } : { text: 'CLEAR', color: C.green }}
                     onClick={() => goTo('/hrms/leaves')} />
                <KPI icon="ti-cash" label="Payroll Processed"
                     value={payrollSumm?.processed_count != null ? payrollSumm.processed_count : '—'}
                     sub={payrollSumm?.total_amount != null ? `₹${Number(payrollSumm.total_amount).toLocaleString('en-IN')} total` : ''}
                     color={C.purple} onClick={() => goTo('/hrms/payroll')} />
              </div>

              {/* ── Row 2: Dept Chart + Quick Actions ── */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 20 }}>

                <Card title="Employee Distribution by Department" icon="ti-chart-bar">
                  {deptData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={deptData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 10, fill: C.muted }} />
                        <YAxis dataKey="dept" type="category" tick={{ fontSize: 10, fill: C.muted }} width={100} />
                        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                        <Bar dataKey="count" fill={C.rose} radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ textAlign: 'center', padding: 40, color: C.muted, fontSize: 13 }}>
                      <i className="ti ti-chart-bar" style={{ fontSize: 28, opacity: 0.4 }} />
                      <p>No employee data available</p>
                    </div>
                  )}
                </Card>

                <Card title="Quick Actions" icon="ti-bolt">
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <QA icon="ti-users"           label="Employees"       color={C.rose}    onClick={() => goTo('/hrms/employees')} />
                    <QA icon="ti-calendar-event"  label="Leaves"          color={C.warning} onClick={() => goTo('/hrms/leaves')} />
                    <QA icon="ti-cash"            label="Payroll"         color={C.purple}  onClick={() => goTo('/hrms/payroll')} />
                    <QA icon="ti-map-pin"         label="GPS Attendance"  color={C.primary} onClick={() => goTo('/staff/attendance')} />
                    <QA icon="ti-chart-bar"       label="Analytics"       color={C.green}   onClick={() => goTo('/staff/attendance/analytics')} />
                    <QA icon="ti-settings"        label="Att. Settings"   color={C.muted}   onClick={() => goTo('/staff/attendance/settings')} />
                  </div>
                </Card>
              </div>

              {/* ── Row 3: Pending Leave Requests + Employee Directory Preview ── */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>

                {/* Pending Leave Requests */}
                <Card
                  title={`Pending Leave Requests (${leaveReqs.length})`}
                  icon="ti-calendar-event"
                  action={
                    <button onClick={() => goTo('/hrms/leaves')} style={{
                      fontSize: 12, color: C.rose, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600,
                    }}>View All →</button>
                  }
                >
                  {leaveReqs.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px 0', color: C.muted, fontSize: 13 }}>
                      <i className="ti ti-circle-check" style={{ fontSize: 28, color: C.green, opacity: 0.7 }} />
                      <p style={{ marginTop: 8 }}>No pending leave requests</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {leaveReqs.slice(0, 5).map(req => (
                        <div key={req.id} style={{
                          padding: '12px 14px', borderRadius: 10, background: '#fff7ed',
                          border: `1px solid #fed7aa`, display: 'flex', alignItems: 'center', gap: 12,
                        }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{req.employee_name || req.user_name || 'Employee'}</div>
                            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                              {req.leave_type} · {req.from_date} → {req.to_date}
                              {req.total_days ? ` (${req.total_days} day${req.total_days !== 1 ? 's' : ''})` : ''}
                            </div>
                            {req.reason && (
                              <div style={{ fontSize: 11, color: C.muted, marginTop: 1, fontStyle: 'italic' }}>"{req.reason}"</div>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                            <button
                              onClick={() => handleReview(req.id, true)}
                              disabled={reviewingId === req.id}
                              style={{
                                padding: '5px 10px', borderRadius: 7, border: 'none',
                                background: C.green, color: '#fff', fontWeight: 600, fontSize: 11,
                                cursor: 'pointer', opacity: reviewingId === req.id ? 0.6 : 1,
                              }}
                            >✓ Approve</button>
                            <button
                              onClick={() => handleReview(req.id, false)}
                              disabled={reviewingId === req.id}
                              style={{
                                padding: '5px 10px', borderRadius: 7, border: `1px solid ${C.error}`,
                                background: '#fff', color: C.error, fontWeight: 600, fontSize: 11,
                                cursor: 'pointer', opacity: reviewingId === req.id ? 0.6 : 1,
                              }}
                            >✗ Reject</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                {/* Employee Directory Preview */}
                <Card
                  title="Recent Employees"
                  icon="ti-users"
                  action={
                    <button onClick={() => goTo('/hrms/employees')} style={{
                      fontSize: 12, color: C.rose, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600,
                    }}>Full Directory →</button>
                  }
                >
                  {employees.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px 0', color: C.muted, fontSize: 13 }}>
                      <i className="ti ti-users" style={{ fontSize: 28, opacity: 0.4 }} />
                      <p style={{ marginTop: 8 }}>No employees found</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {employees.slice(0, 6).map((emp, i) => {
                        const initials = (emp.name || emp.full_name || 'E').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
                        const colors = [C.rose, C.primary, C.purple, C.green, C.warning, '#0891b2'];
                        const clr = colors[i % colors.length];
                        return (
                          <div
                            key={i}
                            onClick={() => emp.user_id || emp.id ? goTo(`/hrms/employees/${emp.user_id || emp.id}`) : null}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                              borderRadius: 9, cursor: 'pointer', transition: 'background 0.12s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = C.light; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                          >
                            <div style={{
                              width: 36, height: 36, borderRadius: '50%', background: `${clr}20`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontWeight: 700, fontSize: 13, color: clr, flexShrink: 0,
                            }}>{initials}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 600, fontSize: 13, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {emp.name || emp.full_name || 'Employee'}
                              </div>
                              <div style={{ fontSize: 10, color: C.muted, marginTop: 1 }}>
                                {emp.designation || emp.role || emp.department || '—'}
                              </div>
                            </div>
                            <span style={{
                              fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 99, flexShrink: 0,
                              background: emp.is_active !== false ? `${C.green}15` : `${C.error}15`,
                              color: emp.is_active !== false ? C.green : C.error,
                            }}>{emp.is_active !== false ? 'ACTIVE' : 'INACTIVE'}</span>
                          </div>
                        );
                      })}
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
