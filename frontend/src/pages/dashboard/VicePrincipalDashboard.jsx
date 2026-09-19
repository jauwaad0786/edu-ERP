// frontend/src/pages/dashboard/VicePrincipalDashboard.jsx
// Vice Principal — Academic Monitoring Command Center

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api     from '../../api/axios';
import toast   from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { resolveTenantPath } from '../../utils/routeBuilder';
import {
  BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

/* ─── Design tokens ──────────────────────────────────────────────────────── */
const C = {
  bg:        '#f0f4f8',
  surface:   '#ffffff',
  border:    '#e2e8f0',
  primary:   '#0176d3',
  accent:    '#7c3aed',
  success:   '#16a34a',
  warning:   '#d97706',
  error:     '#dc2626',
  text:      '#1e293b',
  muted:     '#64748b',
  lightBg:   '#f8fafc',
};

const card = (extra = {}) => ({
  background: C.surface,
  borderRadius: 14,
  border: `1px solid ${C.border}`,
  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  padding: '20px 22px',
  ...extra,
});

/* ─── KPI Card ───────────────────────────────────────────────────────────── */
function KPI({ icon, label, value, sub, color = C.primary, onClick, badge }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...card(),
        cursor: onClick ? 'pointer' : 'default',
        transform: hover && onClick ? 'translateY(-2px)' : 'none',
        boxShadow: hover && onClick ? '0 6px 20px rgba(0,0,0,0.1)' : '0 1px 4px rgba(0,0,0,0.06)',
        transition: 'all 0.2s ease',
        display: 'flex', alignItems: 'center', gap: 14,
      }}
    >
      <div style={{
        width: 52, height: 52, borderRadius: 12,
        background: `${color}18`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <i className={`ti ${icon}`} style={{ fontSize: 22, color }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: C.muted, fontWeight: 500, marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 26, fontWeight: 800, color: C.text, lineHeight: 1 }}>{value ?? '—'}</div>
        {sub && <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{sub}</div>}
      </div>
      {badge && (
        <span style={{
          padding: '3px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700,
          background: `${badge.color}20`, color: badge.color,
        }}>{badge.text}</span>
      )}
    </div>
  );
}

/* ─── Section Header ─────────────────────────────────────────────────────── */
function Section({ title, icon, action, children }) {
  return (
    <div style={card()}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className={`ti ${icon}`} style={{ fontSize: 16, color: C.primary }} />
          <span style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{title}</span>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

/* ─── Quick Action Button ────────────────────────────────────────────────── */
function QA({ icon, label, color, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        padding: '14px 12px',
        background: hover ? `${color}12` : `${color}08`,
        border: `1px solid ${hover ? color + '50' : color + '25'}`,
        borderRadius: 12, cursor: 'pointer',
        transition: 'all 0.18s ease',
        flex: 1, minWidth: 80,
      }}
    >
      <i className={`ti ${icon}`} style={{ fontSize: 20, color }} />
      <span style={{ fontSize: 11, fontWeight: 600, color: C.text, textAlign: 'center', lineHeight: 1.3 }}>{label}</span>
    </button>
  );
}

/* ─── Main Component ─────────────────────────────────────────────────────── */
export default function VicePrincipalDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('ederp_theme') === 'dark');
  useEffect(() => { localStorage.setItem('ederp_theme', darkMode ? 'dark' : 'light'); }, [darkMode]);

  const goTo = useCallback((path) => navigate(resolveTenantPath(path, user)), [navigate, user]);

  /* data */
  const [stats,        setStats]        = useState(null);
  const [classes,      setClasses]      = useState([]);
  const [leaveReqs,    setLeaveReqs]    = useState([]);
  const [trendData,    setTrendData]    = useState([]);
  const [announcements,setAnnouncements]= useState([]);
  const [loading,      setLoading]      = useState(true);
  const [reviewingId,  setReviewingId]  = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get('/principal/dashboard').catch(() => ({ data: null })),
      api.get('/principal/classes').catch(() => ({ data: [] })),
      api.get('/hrms/leaves/requests', { params: { status: 'PENDING' } }).catch(() => ({ data: [] })),
      api.get('/finance/monthly-trend', { params: { months: 6 } }).catch(() => ({ data: [] })),
      api.get('/support/announcements/latest').catch(() => ({ data: [] })),
    ]).then(([s, c, lr, trend, ann]) => {
      setStats(s.data);
      setClasses(c.data || []);
      setLeaveReqs(Array.isArray(lr.data) ? lr.data : []);
      setTrendData(trend.data || []);
      setAnnouncements(ann.data || []);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleReview = async (reqId, approve) => {
    setReviewingId(reqId);
    try {
      await api.post(`/hrms/leaves/requests/${reqId}/review`, {
        approve,
        remarks: approve ? 'Approved by Vice Principal' : 'Rejected by Vice Principal',
      });
      toast.success(approve ? 'Request approved' : 'Request rejected');
      setLeaveReqs(prev => prev.filter(r => r.id !== reqId));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Action failed');
    } finally {
      setReviewingId(null);
    }
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  const todayStr = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  const presentPct = stats && stats.students_present != null && stats.total_students
    ? Math.round((stats.students_present / stats.total_students) * 100)
    : null;

  const teacherPresentPct = stats && stats.teachers_present != null && stats.total_teachers
    ? Math.round((stats.teachers_present / stats.total_teachers) * 100)
    : null;

  return (
    <div className={`app-shell${darkMode ? ' theme-dark' : ''}`}>
      <Sidebar darkMode={darkMode} />
      <div className="main-content">
        <Navbar
          title="Vice Principal — Academic Command"
          darkMode={darkMode}
          onToggleDark={() => setDarkMode(d => !d)}
        />
        <div className="page-body" style={{ background: C.bg, padding: '20px 24px', minHeight: '100vh' }}>

          {/* ── Hero Banner ── */}
          <div style={{
            borderRadius: 18, padding: '28px 32px', marginBottom: 24,
            background: 'linear-gradient(135deg, #3b0764 0%, #4c1d95 40%, #6d28d9 80%, #7c3aed 100%)',
            color: '#fff', position: 'relative', overflow: 'hidden',
            boxShadow: '0 8px 30px rgba(124,58,237,0.35)',
          }}>
            <div style={{
              position: 'absolute', top: -60, right: -40, width: 200, height: 200,
              borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none',
            }} />
            <div style={{
              position: 'absolute', bottom: -40, left: '30%', width: 160, height: 160,
              borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none',
            }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', opacity: 0.75, marginBottom: 6 }}>
                  {todayStr.toUpperCase()} · VICE PRINCIPAL PORTAL
                </div>
                <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, lineHeight: 1.2 }}>
                  {greeting}, {user?.name?.split(' ')[0] || 'Vice Principal'}!
                </h1>
                <p style={{ margin: '8px 0 0', opacity: 0.8, fontSize: 14 }}>
                  Academic oversight — {stats?.total_students || 0} students · {stats?.total_teachers || 0} teachers
                </p>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button onClick={() => goTo('/attendance')} style={{
                  padding: '10px 18px', borderRadius: 10, border: '1.5px solid rgba(255,255,255,0.5)',
                  background: 'rgba(255,255,255,0.15)', color: '#fff', fontWeight: 600,
                  cursor: 'pointer', fontSize: 13, backdropFilter: 'blur(4px)',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <i className="ti ti-clipboard-check" /> View Attendance
                </button>
                <button onClick={() => goTo('/exams')} style={{
                  padding: '10px 18px', borderRadius: 10, border: 'none',
                  background: 'rgba(255,255,255,0.95)', color: '#6d28d9', fontWeight: 700,
                  cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <i className="ti ti-pencil" /> Exam Management
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: C.muted }}>
              <i className="ti ti-loader-2" style={{ fontSize: 32, animation: 'spin 1s linear infinite' }} />
              <p style={{ marginTop: 12 }}>Loading academic overview…</p>
            </div>
          ) : (
            <>
              {/* ── KPI Row ── */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
                <KPI icon="ti-users" label="Total Students" value={stats?.total_students?.toLocaleString()} color={C.primary}
                     onClick={() => goTo('/students')} />
                <KPI icon="ti-clipboard-check" label="Student Attendance" value={presentPct != null ? `${presentPct}%` : '—'}
                     sub={`${stats?.students_present ?? 0} present today`}
                     color={presentPct >= 85 ? C.success : C.warning}
                     badge={presentPct != null ? { text: presentPct >= 85 ? 'GOOD' : 'LOW', color: presentPct >= 85 ? C.success : C.warning } : null}
                     onClick={() => goTo('/attendance')} />
                <KPI icon="ti-chalkboard" label="Teacher Attendance" value={teacherPresentPct != null ? `${teacherPresentPct}%` : '—'}
                     sub={`${stats?.teachers_present ?? 0} of ${stats?.total_teachers ?? 0}`}
                     color={teacherPresentPct >= 90 ? C.success : C.warning}
                     onClick={() => goTo('/staff/attendance')} />
                <KPI icon="ti-list" label="Total Classes" value={classes.length}
                     color={C.accent} onClick={() => goTo('/classes')} />
                <KPI icon="ti-calendar-event" label="Pending Leave Requests" value={leaveReqs.length}
                     color={leaveReqs.length > 0 ? C.warning : C.success}
                     badge={leaveReqs.length > 0 ? { text: 'ACTION NEEDED', color: C.warning } : { text: 'ALL CLEAR', color: C.success }} />
              </div>

              {/* ── Row 2: Attendance Trend + Quick Actions ── */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 20 }}>

                {/* Attendance Trend Chart */}
                <Section title="Fee Collection Trend (6 Months)" icon="ti-chart-line">
                  {trendData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <AreaChart data={trendData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="vpGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="month" tick={{ fontSize: 10, fill: C.muted }} />
                        <YAxis tick={{ fontSize: 10, fill: C.muted }} />
                        <Tooltip
                          formatter={(v) => [`₹${Number(v).toLocaleString('en-IN')}`, 'Collected']}
                          contentStyle={{ fontSize: 12, borderRadius: 8 }}
                        />
                        <Area type="monotone" dataKey="collected" stroke="#7c3aed" fill="url(#vpGrad)" strokeWidth={2.5} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ textAlign: 'center', padding: 40, color: C.muted, fontSize: 13 }}>
                      <i className="ti ti-chart-bar" style={{ fontSize: 28, opacity: 0.4 }} />
                      <p>No trend data available yet</p>
                    </div>
                  )}
                </Section>

                {/* Quick Actions */}
                <Section title="Quick Actions" icon="ti-bolt">
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <QA icon="ti-clipboard-check" label="Attendance" color={C.primary} onClick={() => goTo('/attendance')} />
                    <QA icon="ti-pencil" label="Exams" color={C.accent} onClick={() => goTo('/exams')} />
                    <QA icon="ti-chart-bar" label="Marks" color={C.success} onClick={() => goTo('/marks')} />
                    <QA icon="ti-books" label="Classes" color={C.warning} onClick={() => goTo('/classes')} />
                    <QA icon="ti-calendar-time" label="Timetable" color="#0891b2" onClick={() => goTo('/timetable')} />
                    <QA icon="ti-notes" label="Notes" color="#db2777" onClick={() => goTo('/notes')} />
                    <QA icon="ti-certificate" label="Results" color="#7c3aed" onClick={() => goTo('/result-management')} />
                    <QA icon="ti-shield-lock" label="Audit Logs" color={C.muted} onClick={() => goTo('/audit-logs')} />
                  </div>
                </Section>
              </div>

              {/* ── Row 3: Class Summary + Leave Requests ── */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>

                {/* Class Performance Summary */}
                <Section
                  title="Class Attendance Today"
                  icon="ti-building-community"
                  action={
                    <button onClick={() => goTo('/classes')} style={{
                      fontSize: 12, color: C.primary, background: 'none', border: 'none',
                      cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4,
                    }}>View All <i className="ti ti-chevron-right" /></button>
                  }
                >
                  {stats?.class_attendance_today?.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {(stats.class_attendance_today || []).slice(0, 6).map((cls, i) => {
                        const pct = cls.total > 0 ? Math.round((cls.present / cls.total) * 100) : 0;
                        return (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 80, fontSize: 12, fontWeight: 600, color: C.text, flexShrink: 0 }}>
                              {cls.class_name}
                            </div>
                            <div style={{ flex: 1, height: 8, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
                              <div style={{
                                width: `${pct}%`, height: '100%', borderRadius: 99,
                                background: pct >= 85 ? C.success : pct >= 70 ? C.warning : C.error,
                                transition: 'width 0.4s ease',
                              }} />
                            </div>
                            <div style={{ width: 38, fontSize: 12, fontWeight: 700, color: pct >= 85 ? C.success : pct >= 70 ? C.warning : C.error, textAlign: 'right', flexShrink: 0 }}>
                              {pct}%
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '30px 0', color: C.muted, fontSize: 13 }}>
                      <i className="ti ti-clipboard" style={{ fontSize: 28, opacity: 0.4 }} />
                      <p style={{ marginTop: 8 }}>Class attendance data not yet available for today</p>
                    </div>
                  )}
                </Section>

                {/* Pending Leave Requests */}
                <Section
                  title={`Pending Leave Requests (${leaveReqs.length})`}
                  icon="ti-calendar-event"
                  action={
                    <button onClick={() => goTo('/hrms/leaves')} style={{
                      fontSize: 12, color: C.primary, background: 'none', border: 'none',
                      cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4,
                    }}>All Leaves <i className="ti ti-chevron-right" /></button>
                  }
                >
                  {leaveReqs.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px 0', color: C.muted, fontSize: 13 }}>
                      <i className="ti ti-circle-check" style={{ fontSize: 28, color: C.success, opacity: 0.7 }} />
                      <p style={{ marginTop: 8 }}>No pending leave requests</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {leaveReqs.slice(0, 4).map(req => (
                        <div key={req.id} style={{
                          padding: '12px 14px', borderRadius: 10,
                          background: C.lightBg, border: `1px solid ${C.border}`,
                          display: 'flex', alignItems: 'center', gap: 12,
                        }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{req.employee_name || req.user_name || 'Staff Member'}</div>
                            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                              {req.leave_type} · {req.from_date} → {req.to_date}
                            </div>
                            {req.reason && (
                              <div style={{ fontSize: 11, color: C.muted, marginTop: 2, fontStyle: 'italic' }}>
                                "{req.reason}"
                              </div>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                            <button
                              onClick={() => handleReview(req.id, true)}
                              disabled={reviewingId === req.id}
                              style={{
                                padding: '5px 10px', borderRadius: 7, border: 'none',
                                background: C.success, color: '#fff', fontWeight: 600, fontSize: 11,
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
                      {leaveReqs.length > 4 && (
                        <button onClick={() => goTo('/hrms/leaves')} style={{
                          background: 'none', border: `1px dashed ${C.border}`, borderRadius: 8,
                          padding: '10px', color: C.primary, fontWeight: 600, fontSize: 12, cursor: 'pointer',
                        }}>
                          +{leaveReqs.length - 4} more requests → View All
                        </button>
                      )}
                    </div>
                  )}
                </Section>
              </div>

              {/* ── Row 4: Announcements + Class List ── */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>

                {/* Recent Announcements */}
                <Section
                  title="Recent Announcements"
                  icon="ti-speakerphone"
                  action={
                    <button onClick={() => goTo('/announcements/create')} style={{
                      fontSize: 12, color: '#fff', background: C.primary, border: 'none',
                      borderRadius: 7, padding: '5px 12px', cursor: 'pointer', fontWeight: 600,
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}><i className="ti ti-plus" /> New</button>
                  }
                >
                  {announcements.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px 0', color: C.muted, fontSize: 13 }}>
                      <i className="ti ti-speakerphone" style={{ fontSize: 28, opacity: 0.4 }} />
                      <p style={{ marginTop: 8 }}>No recent announcements</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {announcements.slice(0, 4).map((ann, i) => (
                        <div key={i} style={{
                          padding: '10px 12px', borderRadius: 9,
                          background: C.lightBg, border: `1px solid ${C.border}`,
                          borderLeft: `3px solid ${C.primary}`,
                        }}>
                          <div style={{ fontWeight: 600, fontSize: 13, color: C.text }}>{ann.title || ann.subject}</div>
                          <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>
                            {ann.audience || 'All'} · {ann.created_at ? new Date(ann.created_at).toLocaleDateString('en-IN') : ''}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Section>

                {/* Classes Overview */}
                <Section
                  title="All Classes"
                  icon="ti-building-community"
                  action={
                    <button onClick={() => goTo('/classes')} style={{
                      fontSize: 12, color: C.primary, background: 'none', border: 'none',
                      cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4,
                    }}>Manage <i className="ti ti-chevron-right" /></button>
                  }
                >
                  {classes.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px 0', color: C.muted, fontSize: 13 }}>
                      <i className="ti ti-building" style={{ fontSize: 28, opacity: 0.4 }} />
                      <p style={{ marginTop: 8 }}>No classes found</p>
                    </div>
                  ) : (
                    <div style={{
                      display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 8,
                    }}>
                      {classes.slice(0, 12).map((cls, i) => (
                        <div
                          key={i}
                          onClick={() => goTo(`/classes/${cls.id}`)}
                          style={{
                            padding: '10px 8px', borderRadius: 10, textAlign: 'center',
                            background: `${C.accent}10`, border: `1px solid ${C.accent}25`,
                            cursor: 'pointer', transition: 'all 0.15s',
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background = `${C.accent}20`;
                            e.currentTarget.style.transform = 'scale(1.03)';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = `${C.accent}10`;
                            e.currentTarget.style.transform = 'scale(1)';
                          }}
                        >
                          <div style={{ fontWeight: 700, fontSize: 13, color: C.accent }}>{cls.name}</div>
                          {cls.section && (
                            <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>Sec {cls.section}</div>
                          )}
                          {cls.total_students != null && (
                            <div style={{ fontSize: 10, color: C.muted }}>{cls.total_students} students</div>
                          )}
                        </div>
                      ))}
                      {classes.length > 12 && (
                        <div
                          onClick={() => goTo('/classes')}
                          style={{
                            padding: '10px 8px', borderRadius: 10, textAlign: 'center',
                            background: '#f1f5f9', border: `1px dashed ${C.border}`,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          <span style={{ fontSize: 12, color: C.muted }}>+{classes.length - 12} more</span>
                        </div>
                      )}
                    </div>
                  )}
                </Section>
              </div>
            </>
          )}
        </div>
      </div>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
