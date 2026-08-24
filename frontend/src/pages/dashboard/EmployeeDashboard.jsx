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
            borderRadius: '20px', padding: '24px 28px', marginBottom: '22px',
            background: darkMode
              ? 'linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)'
              : 'linear-gradient(135deg, #312e81 0%, #4338ca 50%, #6366f1 100%)',
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
                    💻 Internal Team Hub
                  </span>
                  <span style={{ fontSize: '12px', opacity: 0.9 }}>
                    {user?.active_role?.name || 'Staff Member'}
                  </span>
                </div>
                <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em', color: '#ffffff' }}>
                  Welcome back, {user?.name} 👋
                </h1>
                <p style={{ margin: '4px 0 0', fontSize: '13.5px', color: 'rgba(255,255,255,0.85)' }}>
                  {canTriage ? 'You have system triage privileges for Error Center & Health monitoring.' : 'Your active tasks, error triage queue, and daily work streams.'}
                </p>
              </div>

              {canTriage && (
                <a
                  href="/developer/errors"
                  style={{
                    background: '#ffffff', color: '#4f46e5', textDecoration: 'none', borderRadius: '10px',
                    padding: '10px 16px', fontSize: '13px', fontWeight: 800, cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', gap: '6px'
                  }}
                >
                  <i className="ti ti-bug" /> Open Full Error Center
                </a>
              )}
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
