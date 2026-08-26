import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { usePermission } from '../../hooks/usePermission';
import { useAuth } from '../../context/AuthContext';

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('ederp_theme') === 'dark');
  useEffect(() => { localStorage.setItem('ederp_theme', darkMode ? 'dark' : 'light'); }, [darkMode]);

  const canTriage = usePermission('developer.manage');

  const [stats, setStats]   = useState(null);
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      api.get('/developer/errors/summary'),
      api.get('/developer/errors', { params: { per_page: 10 } }),
    ])
      .then(([summaryRes, errorsRes]) => {
        if (cancelled) return;
        setStats(summaryRes.data);
        setErrors(errorsRes.data.errors || []);
      })
      .catch(() => { if (!cancelled) toast.error('Failed to load your dashboard'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const handleResolve = async (errorId) => {
    const note = prompt('Resolution note:');
    if (note === null) return;
    try {
      await api.post(`/developer/errors/${errorId}/resolve`, { resolution_note: note });
      setErrors(prev => prev.map(e => e.id === errorId ? { ...e, status: 'RESOLVED' } : e));
      toast.success('Marked resolved');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to resolve');
    }
  };

  return (
    <div className={`app-shell${darkMode ? ' theme-dark' : ''}`}>
      <Sidebar darkMode={darkMode} />
      <div className="main-content">
        <Navbar title="Staff &amp; Engineering Hub" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />
        <div className="page-body">

          {/* ══ Hero Command Banner ══ */}
          <div style={{
            position: 'relative', overflow: 'hidden',
            borderRadius: '24px', padding: '28px 34px', marginBottom: '24px',
            background: darkMode
              ? 'radial-gradient(circle at 85% 20%, rgba(99,102,241,0.25) 0%, transparent 60%), linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #030712 100%)'
              : 'radial-gradient(circle at 85% 20%, rgba(255,255,255,0.18) 0%, transparent 50%), linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #4338ca 80%, #6366f1 100%)',
            color: '#ffffff',
            boxShadow: darkMode
              ? '0 12px 35px -5px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1)'
              : '0 15px 35px -5px rgba(79,70,229,0.35), inset 0 1px 0 rgba(255,255,255,0.3)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '24px',
            border: darkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(255,255,255,0.25)'
          }}>
            {/* Ambient Background Glows */}
            <div style={{
              position: 'absolute', top: '-50px', right: '280px', width: '220px', height: '220px',
              borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none', filter: 'blur(30px)'
            }} />
            <div style={{
              position: 'absolute', bottom: '-40px', left: '15%', width: '180px', height: '180px',
              borderRadius: '50%', background: 'rgba(129,140,248,0.2)', pointerEvents: 'none', filter: 'blur(40px)'
            }} />

            <div style={{ flex: 1, minWidth: '300px', zIndex: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                <span style={{
                  padding: '4px 12px', borderRadius: '20px',
                  background: 'rgba(255,255,255,0.2)', fontSize: '11.5px', fontWeight: 800, textTransform: 'uppercase',
                  backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.25)',
                  display: 'flex', alignItems: 'center', gap: '6px', color: '#ffffff'
                }}>
                  💻 Internal Team Operations Hub
                </span>
                <span style={{
                  padding: '4px 12px', borderRadius: '20px',
                  background: 'rgba(255,255,255,0.12)', color: '#e0e7ff',
                  fontSize: '11.5px', fontWeight: 700, backdropFilter: 'blur(6px)'
                }}>
                  {user?.active_role?.name || 'Company Engineer'}
                </span>
              </div>

              <h1 style={{
                margin: '0 0 8px', fontSize: '32px', fontWeight: 900, letterSpacing: '-0.02em', color: '#ffffff',
                textShadow: '0 2px 10px rgba(0,0,0,0.2)'
              }}>
                Welcome back, {user?.name} 👋
              </h1>

              <p style={{
                margin: '0 0 20px', fontSize: '14.5px', color: 'rgba(255,255,255,0.92)',
                maxWidth: '540px', lineHeight: 1.5, fontWeight: 500
              }}>
                {canTriage
                  ? 'System triage privileges active. Real-time platform errors, telemetry health streams, and active assignees.'
                  : 'Your active company sprints, assigned support tickets, error queue triage, and daily workflow streams.'}
              </p>

              {canTriage && (
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <a
                    href="/developer/errors"
                    style={{
                      background: '#ffffff', color: '#312e81', textDecoration: 'none', borderRadius: '12px',
                      padding: '11px 20px', fontSize: '13.5px', fontWeight: 800, cursor: 'pointer',
                      boxShadow: '0 6px 18px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', gap: '8px',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
                  >
                    <i className="ti ti-bug" style={{ color: '#ef4444' }} /> Open Error Triage Center
                  </a>
                  <a
                    href="/developer/health"
                    style={{
                      background: 'rgba(255,255,255,0.16)', color: '#ffffff', textDecoration: 'none',
                      border: '1.5px solid rgba(255,255,255,0.35)', borderRadius: '12px',
                      padding: '11px 20px', fontSize: '13.5px', fontWeight: 700, cursor: 'pointer',
                      backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', gap: '8px',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.28)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.16)'}
                  >
                    <i className="ti ti-activity" /> System Health
                  </a>
                </div>
              )}
            </div>

            {/* Framed 3D Isometric Command Center Card */}
            <div style={{
              width: '320px', height: '160px', borderRadius: '18px', overflow: 'hidden',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              background: 'rgba(255,255,255,0.12)',
              border: '1.5px solid rgba(255,255,255,0.25)',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
              padding: '6px',
              position: 'relative'
            }}>
              <img
                src="/assets/illustrations/admin_hero.jpg"
                alt="Command Center"
                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '14px' }}
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
              <div style={{
                position: 'absolute', bottom: '12px', right: '14px',
                background: 'rgba(30,27,75,0.85)', color: '#ffffff',
                padding: '3px 8px', borderRadius: '6px', fontSize: '10.5px',
                fontWeight: 800, backdropFilter: 'blur(6px)', letterSpacing: '0.04em'
              }}>
                ⚡ OPERATIONS DESK
              </div>
            </div>
          </div>

          {/* ══ Bento Stat Cards ══ */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: '14px', marginBottom: '22px',
          }}>
            <div style={{
              background: darkMode ? '#111827' : '#ffffff',
              border: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : '#e2e8f0'}`,
              borderRadius: '16px', padding: '18px',
              boxShadow: darkMode ? '0 4px 16px rgba(0,0,0,0.3)' : '0 4px 16px rgba(15,23,42,0.03)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11.5px', color: darkMode ? '#94a3b8' : '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                  Assigned To Me
                </span>
                <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'rgba(99,102,241,0.15)', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="ti ti-user" />
                </div>
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#6366f1' }}>
                {stats?.assigned_to_me ?? 0}
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Open issues in your queue</div>
            </div>

            <div style={{
              background: darkMode ? '#111827' : '#ffffff',
              border: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : '#e2e8f0'}`,
              borderRadius: '16px', padding: '18px',
              boxShadow: darkMode ? '0 4px 16px rgba(0,0,0,0.3)' : '0 4px 16px rgba(15,23,42,0.03)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11.5px', color: darkMode ? '#94a3b8' : '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                  {canTriage ? 'Open Errors (System)' : 'Open (Mine)'}
                </span>
                <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'rgba(239,68,68,0.15)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="ti ti-alert-triangle" />
                </div>
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#ef4444' }}>
                {stats?.open_count ?? 0}
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Awaiting investigation</div>
            </div>

            <div style={{
              background: darkMode ? '#111827' : '#ffffff',
              border: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : '#e2e8f0'}`,
              borderRadius: '16px', padding: '18px',
              boxShadow: darkMode ? '0 4px 16px rgba(0,0,0,0.3)' : '0 4px 16px rgba(15,23,42,0.03)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11.5px', color: darkMode ? '#94a3b8' : '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                  Critical Priority
                </span>
                <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'rgba(239,68,68,0.15)', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="ti ti-flame" />
                </div>
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#dc2626' }}>
                {stats?.critical_open ?? 0}
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Requires immediate triage</div>
            </div>

            <div style={{
              background: darkMode ? '#111827' : '#ffffff',
              border: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : '#e2e8f0'}`,
              borderRadius: '16px', padding: '18px',
              boxShadow: darkMode ? '0 4px 16px rgba(0,0,0,0.3)' : '0 4px 16px rgba(15,23,42,0.03)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11.5px', color: darkMode ? '#94a3b8' : '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                  Resolved Today
                </span>
                <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'rgba(16,185,129,0.15)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="ti ti-circle-check" />
                </div>
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#10b981' }}>
                {stats?.resolved_today ?? 0}
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Completed resolutions</div>
            </div>
          </div>

          {/* ══ Assigned Errors Table ══ */}
          <div className="card" style={{
            borderRadius: '18px',
            background: darkMode ? '#111827' : '#ffffff',
            border: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : '#e2e8f0'}`,
            boxShadow: darkMode ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 20px rgba(15,23,42,0.03)'
          }}>
            <div className="card-header" style={{ padding: '16px 20px', borderBottom: `1px solid ${darkMode ? '#1f2937' : '#f1f5f9'}` }}>
              <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a' }}>
                My Assigned Issue Queue
              </h4>
            </div>
            <div className="table-container" style={{ border: 'none' }}>
              <table>
                <thead>
                  <tr>
                    <th>Exception &amp; Endpoint</th>
                    <th>Severity</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={4} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>Loading assignments...</td></tr>
                  ) : errors.length === 0 ? (
                    <tr><td colSpan={4} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                      <i className="ti ti-circle-check" style={{ fontSize: '32px', color: '#10b981', display: 'block', marginBottom: '8px' }} />
                      Nothing assigned to you right now. Great job!
                    </td></tr>
                  ) : (
                    errors.map(error => (
                      <tr key={error.id}>
                        <td>
                          <div style={{ fontWeight: 700, fontSize: '13.5px', color: darkMode ? '#ffffff' : '#0f172a' }}>{error.exception_type}</div>
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>{error.module} · {error.api_endpoint}</div>
                        </td>
                        <td>
                          <span style={{
                            padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 800,
                            background: error.severity === 'CRITICAL' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                            color: error.severity === 'CRITICAL' ? '#ef4444' : '#f59e0b'
                          }}>
                            {error.severity}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${error.status === 'RESOLVED' ? 'badge-success' : 'badge-warning'}`}>
                            {error.status}
                          </span>
                        </td>
                        <td>
                          {error.status !== 'RESOLVED' && error.status !== 'CLOSED' && (
                            <button
                              className="btn btn-success btn-sm"
                              style={{ borderRadius: '8px', fontSize: '12px', fontWeight: 700 }}
                              onClick={() => handleResolve(error.id)}
                            >
                              <i className="ti ti-check" /> Resolve
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
