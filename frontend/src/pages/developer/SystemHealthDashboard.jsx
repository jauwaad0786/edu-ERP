// frontend/src/pages/developer/SystemHealthDashboard.jsx
import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api from '../../api/axios';

export default function SystemHealthDashboard() {
  // Self-managed darkMode + Sidebar/Navbar — same fix as ErrorDashboard.jsx
  // and IssueBoard.jsx. This was the third page missing a layout entirely.
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('ederp_theme') === 'dark');
  useEffect(() => { localStorage.setItem('ederp_theme', darkMode ? 'dark' : 'light'); }, [darkMode]);

  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    fetchHealth();
    
    let interval;
    if (autoRefresh) {
      interval = setInterval(fetchHealth, 30000); // Refresh every 30 seconds
    }
    
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const fetchHealth = async () => {
    try {
      const res = await api.get('/developer/health');
      setHealth(res.data);
    } catch (err) {
      console.error('Failed to fetch health data:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    if (status === 'healthy' || status === 'up') return '#16a34a';
    if (status === 'degraded' || status === 'warning') return '#d97706';
    if (status === 'down' || status === 'error') return '#dc2626';
    return '#64748b';
  };

  const getStatusIcon = (status) => {
    if (status === 'healthy' || status === 'up') return 'ti-circle-check';
    if (status === 'degraded' || status === 'warning') return 'ti-alert-triangle';
    if (status === 'down' || status === 'error') return 'ti-circle-x';
    return 'ti-circle';
  };

  if (loading) {
    return (
      <div className={`app-shell${darkMode ? ' theme-dark' : ''}`}>
        <Sidebar darkMode={darkMode} />
        <div className="main-content">
          <Navbar title="System Health" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />
          <div className="page-body">
            <div className="loading-spinner">Loading system health...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`app-shell${darkMode ? ' theme-dark' : ''}`}>
      <Sidebar darkMode={darkMode} />
      <div className="main-content">
        <Navbar title="System Health" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />
        <div className="page-body">
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2 className="page-title">System Health Dashboard</h2>
          <p className="page-subtitle">Real-time monitoring of platform infrastructure</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className={`btn ${autoRefresh ? 'btn-primary' : 'btn-neutral'} btn-sm`}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <i className={`ti ${autoRefresh ? 'ti-pause' : 'ti-play'}`} />
            {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
          </button>
          <button className="btn btn-neutral btn-sm" onClick={fetchHealth}>
            <i className="ti ti-refresh" /> Refresh Now
          </button>
        </div>
      </div>

      {/* Status Overview */}
      <div className="grid-4 mb-6">
        <div className="stat-card" style={{ background: darkMode ? '#141b2d' : undefined }}>
          <div className="stat-label">Overall Status</div>
          <div className="stat-value" style={{ color: getStatusColor(health?.overall_status) }}>
            <i className={`ti ${getStatusIcon(health?.overall_status)}`} style={{ fontSize: 24, marginRight: 8 }} />
            {health?.overall_status?.toUpperCase() || 'UNKNOWN'}
          </div>
        </div>
        <div className="stat-card" style={{ background: darkMode ? '#141b2d' : undefined }}>
          <div className="stat-label">Schools Online</div>
          <div className="stat-value" style={{ color: '#16a34a' }}>{health?.schools_online || 0}</div>
        </div>
        <div className="stat-card" style={{ background: darkMode ? '#141b2d' : undefined }}>
          <div className="stat-label">Active Users</div>
          <div className="stat-value" style={{ color: '#3b82f6' }}>{health?.active_users || 0}</div>
        </div>
        <div className="stat-card" style={{ background: darkMode ? '#141b2d' : undefined }}>
          <div className="stat-label">API Response Time</div>
          <div className="stat-value" style={{ color: health?.api_response_time < 200 ? '#16a34a' : '#d97706' }}>
            {health?.api_response_time || 0}ms
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* System Resources */}
        <div className="card" style={{ background: darkMode ? '#141b2d' : undefined }}>
          <div className="card-header">
            <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <i className="ti ti-cpu" style={{ color: '#4f46e5' }} /> System Resources
            </h4>
          </div>
          <div className="card-body">
            {health?.system ? (
              <div style={{ display: 'grid', gap: 16 }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13 }}>CPU Usage</span>
                    <span style={{ fontWeight: 700, color: health.system.cpu_usage > 80 ? '#dc2626' : health.system.cpu_usage > 60 ? '#d97706' : '#16a34a' }}>
                      {health.system.cpu_usage}%
                    </span>
                  </div>
                  <div className="progress-bar" style={{ height: 8 }}>
                    <div className="progress-fill" style={{
                      width: `${health.system.cpu_usage}%`,
                      background: health.system.cpu_usage > 80 ? '#dc2626' : health.system.cpu_usage > 60 ? '#d97706' : '#16a34a',
                      borderRadius: 99,
                    }} />
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13 }}>Memory Usage</span>
                    <span style={{ fontWeight: 700, color: health.system.memory_usage > 80 ? '#dc2626' : health.system.memory_usage > 60 ? '#d97706' : '#16a34a' }}>
                      {health.system.memory_usage}%
                    </span>
                  </div>
                  <div className="progress-bar" style={{ height: 8 }}>
                    <div className="progress-fill" style={{
                      width: `${health.system.memory_usage}%`,
                      background: health.system.memory_usage > 80 ? '#dc2626' : health.system.memory_usage > 60 ? '#d97706' : '#16a34a',
                      borderRadius: 99,
                    }} />
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span>Total Memory</span>
                  <span style={{ fontWeight: 700 }}>{health.system.total_memory || 'N/A'}</span>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: '#64748b' }}>System metrics not available</div>
            )}
          </div>
        </div>

        {/* Services Status */}
        <div className="card" style={{ background: darkMode ? '#141b2d' : undefined }}>
          <div className="card-header">
            <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <i className="ti ti-server" style={{ color: '#7c3aed' }} /> Services Status
            </h4>
          </div>
          <div className="card-body">
            <div style={{ display: 'grid', gap: 12 }}>
              {health?.services ? Object.entries(health.services).map(([name, status]) => (
                <div key={name} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 12px',
                  background: darkMode ? '#0f172a' : '#f8fafc',
                  borderRadius: 6,
                }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{name.replace('_', ' ').toUpperCase()}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: getStatusColor(status),
                    }} />
                    <span style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: getStatusColor(status),
                    }}>
                      {status?.toUpperCase() || 'UNKNOWN'}
                    </span>
                  </div>
                </div>
              )) : (
                <div style={{ textAlign: 'center', color: '#64748b' }}>Service status not available</div>
              )}
            </div>
          </div>
        </div>

        {/* Queue Status */}
        <div className="card" style={{ background: darkMode ? '#141b2d' : undefined }}>
          <div className="card-header">
            <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <i className="ti ti-queue" style={{ color: '#d97706' }} /> Queue Status
            </h4>
          </div>
          <div className="card-body">
            {health?.queues ? (
              <div style={{ display: 'grid', gap: 12 }}>
                {Object.entries(health.queues).map(([name, data]) => (
                  <div key={name} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    background: darkMode ? '#0f172a' : '#f8fafc',
                    borderRadius: 6,
                  }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{name.replace('_', ' ').toUpperCase()}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 12 }}>
                        Pending: <strong>{data.pending || 0}</strong>
                      </span>
                      <span style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: data.status === 'healthy' ? '#16a34a' : '#d97706',
                      }}>
                        {data.status?.toUpperCase() || 'OK'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: '#64748b', padding: 20 }}>
                <i className="ti ti-info-circle" style={{ fontSize: 30, display: 'block', marginBottom: 8 }} />
                No queue system configured<br />
                <span style={{ fontSize: 12 }}>Mail and WhatsApp queues require Redis/Celery setup</span>
              </div>
            )}
          </div>
        </div>

        {/* Recent Health Log */}
        <div className="card" style={{ background: darkMode ? '#141b2d' : undefined }}>
          <div className="card-header">
            <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <i className="ti ti-clock" style={{ color: '#64748b' }} /> Last Updated
            </h4>
          </div>
          <div className="card-body">
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 14, color: '#64748b' }}>
                <i className="ti ti-clock" style={{ fontSize: 20, display: 'block', marginBottom: 8 }} />
                {health?.last_updated ? new Date(health.last_updated).toLocaleString() : 'Never'}
              </div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>
                {autoRefresh ? 'Auto-refreshing every 30 seconds' : 'Auto-refresh paused'}
              </div>
              <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginTop: 12 }}>
                {Object.entries(health?.services || {}).map(([name, status]) => (
                  <span
                    key={name}
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: getStatusColor(status),
                      display: 'inline-block',
                    }}
                    title={name}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
          </div>
        </div>
      </div>
    </div>
  );
}
