// frontend/src/pages/dashboard/EmployeeDashboard.jsx
//
// Internal dashboard for a real (non-admin) COMPANY-side employee --
// Manager, Software Engineer, QA, Sales, HR, Intern, etc. Previously
// DashboardRouter sent every one of these straight to AdminDashboard
// because legacy user.role is 'SUPER_ADMIN' for every company account
// (see admin.py's _resolve_creation_role). This is the actual "internal
// user" UI: only what's assigned to them, only what they've been given
// permission for -- nothing borrowed from the CEO's dashboard.
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
      // Server already scopes this to "assigned to me" when the caller
      // lacks 'developer.manage' -- see routes/developer_center.py's
      // list_errors(). No client-side filtering needed either way.
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
        <Navbar title="Dashboard" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />
        <div className="page-body">
          <div className="page-container">
            <div className="page-header">
              <div>
                <h2 className="page-title">Welcome, {user?.name}</h2>
                <p className="page-subtitle">
                  {user?.active_role?.name || 'Team Member'}
                  {canTriage && ' · You can triage the full Error Center'}
                </p>
              </div>
            </div>

            <div className="grid-4 mb-6">
              <div className="stat-card" style={{ background: darkMode ? '#141b2d' : undefined }}>
                <div className="stat-label">Assigned To Me (Open)</div>
                <div className="stat-value" style={{ color: '#3b82f6' }}>{stats?.assigned_to_me ?? 0}</div>
              </div>
              <div className="stat-card" style={{ background: darkMode ? '#141b2d' : undefined }}>
                <div className="stat-label">{canTriage ? 'Open Errors (All)' : 'Open (Mine)'}</div>
                <div className="stat-value" style={{ color: '#dc2626' }}>{stats?.open_count ?? 0}</div>
              </div>
              <div className="stat-card" style={{ background: darkMode ? '#141b2d' : undefined }}>
                <div className="stat-label">Critical</div>
                <div className="stat-value" style={{ color: '#dc2626' }}>{stats?.critical_open ?? 0}</div>
              </div>
              <div className="stat-card" style={{ background: darkMode ? '#141b2d' : undefined }}>
                <div className="stat-label">Resolved Today</div>
                <div className="stat-value" style={{ color: '#16a34a' }}>{stats?.resolved_today ?? 0}</div>
              </div>
            </div>

            <div className="card" style={{ background: darkMode ? '#141b2d' : undefined }}>
              <div className="card-header" style={{ padding: '14px 20px', fontWeight: 700 }}>
                My Assigned Errors
              </div>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Error</th>
                      <th>Severity</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={4} style={{ textAlign: 'center', padding: 40 }}>Loading...</td></tr>
                    ) : errors.length === 0 ? (
                      <tr><td colSpan={4} style={{ textAlign: 'center', padding: 40 }}>
                        <i className="ti ti-circle-check" style={{ fontSize: 32, color: '#16a34a', display: 'block', marginBottom: 8 }} />
                        Nothing assigned to you right now.
                      </td></tr>
                    ) : (
                      errors.map(error => (
                        <tr key={error.id}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{error.exception_type}</div>
                            <div style={{ fontSize: 11, color: '#64748b' }}>{error.module} · {error.api_endpoint}</div>
                          </td>
                          <td>{error.severity}</td>
                          <td>{error.status}</td>
                          <td>
                            {error.status !== 'RESOLVED' && error.status !== 'CLOSED' && (
                              <button className="btn btn-success btn-sm" onClick={() => handleResolve(error.id)}>
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
              {canTriage && (
                <div className="card-footer" style={{ padding: '12px 20px' }}>
                  <a href="/developer/errors" className="btn btn-neutral btn-sm">
                    <i className="ti ti-bug" /> Open Full Error Center
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
