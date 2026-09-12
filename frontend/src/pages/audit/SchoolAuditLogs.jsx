// frontend/src/pages/audit/SchoolAuditLogs.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api from '../../api/axios';
import { usePermission, usePermissions } from '../../hooks/usePermission';

function formatTimestamp(isoStr) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

function timeAgo(isoStr) {
  if (!isoStr) return '';
  const seconds = Math.floor((new Date() - new Date(isoStr)) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getSeverityBadge(severity) {
  const sev = (severity || 'INFO').toUpperCase();
  switch (sev) {
    case 'CRITICAL':
      return { bg: '#fee2e2', text: '#991b1b', border: '#f87171' };
    case 'HIGH':
      return { bg: '#ffedd5', text: '#9a3412', border: '#fb923c' };
    case 'MEDIUM':
      return { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' };
    case 'LOW':
      return { bg: '#e0f2fe', text: '#075985', border: '#7dd3fc' };
    default:
      return { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' };
  }
}

function getStatusBadge(status) {
  if (status === 'FAILURE') {
    return { bg: '#fee2e2', text: '#dc2626', border: '#fca5a5', label: 'FAILED' };
  }
  return { bg: '#dcfce7', text: '#15803d', border: '#86efac', label: 'SUCCESS' };
}

export default function SchoolAuditLogs() {
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('ederp_theme') === 'dark');
  useEffect(() => { localStorage.setItem('ederp_theme', darkMode ? 'dark' : 'light'); }, [darkMode]);

  // Data state
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({
    total_logs: 0,
    today_logs: 0,
    critical_logs: 0,
    failed_logs: 0,
    delegated_logs: 0,
    purge_eligible_logs: 0,
    retention_days: 180,
  });
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);

  // Filters state
  const [filters, setFilters] = useState({
    module: '',
    action: '',
    severity: '',
    status: '',
    is_delegated: '',
    date_preset: '',
    from_date: '',
    to_date: '',
    q: '',
  });

  // Selected Log Drawer
  const [selectedLog, setSelectedLog] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Retention & Purge Modal
  const [showRetentionModal, setShowRetentionModal] = useState(false);
  const [retentionDaysInput, setRetentionDaysInput] = useState(180);
  const [purgeConfirmationText, setPurgeConfirmationText] = useState('');
  const [purgeReason, setPurgeReason] = useState('');
  const [purging, setPurging] = useState(false);
  const [updatingRetention, setUpdatingRetention] = useState(false);

  // Export state
  const [exporting, setExporting] = useState(false);

  // Permissions
  const canExport = usePermission('audit.logs.export');
  const canPurge = usePermissions(['audit.purge', 'audit.logs.delete']);
  const canManageRetention = usePermission('audit.retention.manage');

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await api.get('/audit/school/logs/stats');
      setStats(res.data);
      setRetentionDaysInput(res.data.retention_days || 180);
    } catch (err) {
      console.error('Failed to load audit stats:', err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page,
        per_page: perPage,
        ...filters,
      };
      Object.keys(params).forEach(key => {
        if (params[key] === '' || params[key] === null || params[key] === undefined) {
          delete params[key];
        }
      });

      const res = await api.get('/audit/school/logs', { params });
      setLogs(res.data.logs || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
    } finally {
      setLoading(false);
    }
  }, [page, perPage, filters]);

  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Sync with URL query params from sidebar navigation
  useEffect(() => {
    const urlModule = searchParams.get('module');
    const urlDelegated = searchParams.get('is_delegated');
    const urlTab = searchParams.get('tab');
    const urlSeverity = searchParams.get('severity');
    const urlStatus = searchParams.get('status');

    if (urlTab === 'retention') {
      setShowRetentionModal(true);
    }

    setFilters(prev => {
      let changed = false;
      const next = { ...prev };

      const targetModule = urlModule || '';
      if (next.module !== targetModule) {
        next.module = targetModule;
        changed = true;
      }

      const targetDelegated = urlDelegated || '';
      if (next.is_delegated !== targetDelegated) {
        next.is_delegated = targetDelegated;
        changed = true;
      }

      const targetSeverity = urlSeverity || '';
      if (next.severity !== targetSeverity) {
        next.severity = targetSeverity;
        changed = true;
      }

      const targetStatus = urlStatus || '';
      if (next.status !== targetStatus) {
        next.status = targetStatus;
        changed = true;
      }

      return changed ? next : prev;
    });
    setPage(1);
  }, [searchParams]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => {
      const next = { ...prev, [key]: value };
      if (key === 'date_preset') {
        const today = new Date();
        if (value === 'today') {
          const iso = today.toISOString().split('T')[0];
          next.from_date = iso;
          next.to_date = iso;
        } else if (value === '7days') {
          const past = new Date(today);
          past.setDate(past.getDate() - 7);
          next.from_date = past.toISOString().split('T')[0];
          next.to_date = today.toISOString().split('T')[0];
        } else if (value === '30days') {
          const past = new Date(today);
          past.setDate(past.getDate() - 30);
          next.from_date = past.toISOString().split('T')[0];
          next.to_date = today.toISOString().split('T')[0];
        } else if (value === 'all') {
          next.from_date = '';
          next.to_date = '';
        }
      }
      return next;
    });
    setPage(1);
  };

  const clearFilters = () => {
    setSearchParams({});
    setFilters({
      module: '',
      action: '',
      severity: '',
      status: '',
      is_delegated: '',
      date_preset: '',
      from_date: '',
      to_date: '',
      q: '',
    });
    setPage(1);
  };

  const handleViewDetail = async (logId) => {
    setLoadingDetail(true);
    try {
      const res = await api.get(`/audit/school/logs/${logId}`);
      setSelectedLog(res.data);
    } catch (err) {
      console.error('Failed to load log detail:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const params = { ...filters };
      Object.keys(params).forEach(key => {
        if (!params[key]) delete params[key];
      });

      const res = await api.get('/audit/school/logs/export', {
        params,
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `School_Audit_Trail_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert('Failed to export audit logs');
    } finally {
      setExporting(false);
    }
  };

  const handleUpdateRetention = async () => {
    setUpdatingRetention(true);
    try {
      await api.put('/audit/school/retention', {
        retention_days: parseInt(retentionDaysInput, 10),
      });
      alert('Retention policy updated successfully.');
      fetchStats();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update retention policy');
    } finally {
      setUpdatingRetention(false);
    }
  };

  const handlePurgeLogs = async () => {
    if (purgeConfirmationText !== 'CONFIRM PURGE') {
      alert('Please type "CONFIRM PURGE" exactly to proceed.');
      return;
    }
    if (!purgeReason.trim()) {
      alert('A mandatory reason is required for compliance audit trails.');
      return;
    }

    setPurging(true);
    try {
      const res = await api.post('/audit/school/logs/purge', {
        older_than_days: parseInt(retentionDaysInput, 10),
        reason: purgeReason,
        confirmation: purgeConfirmationText,
      });
      alert(`Purge completed: ${res.data.deleted_count} logs securely archived/purged.`);
      setShowRetentionModal(false);
      setPurgeConfirmationText('');
      setPurgeReason('');
      fetchStats();
      fetchLogs();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to purge audit logs');
    } finally {
      setPurging(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return (
    <div className={`app-shell${darkMode ? ' theme-dark' : ''}`}>
      <Sidebar darkMode={darkMode} />
      <div className="main-content">
        <Navbar title="Audit Command Center" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />
        <div className="page-body" style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 20px' }}>

          {/* Header Title & Actions */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: darkMode ? '#f8fafc' : '#0f172a' }}>
                🛡️ Enterprise Audit Command Center
              </h1>
              <p style={{ margin: '6px 0 0', fontSize: 13, color: '#64748b' }}>
                Immutable, real-time chronological compliance logs across all school operations and delegated actions
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {canExport && (
                <button
                  className="btn btn-neutral btn-sm"
                  onClick={handleExportCSV}
                  disabled={exporting}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <i className={`ti ti-download ${exporting ? 'spin' : ''}`} />
                  {exporting ? 'Exporting CSV...' : 'Export Filtered CSV'}
                </button>
              )}
              {canPurge && (
                <button
                  className="btn btn-sm"
                  onClick={() => setShowRetentionModal(true)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    background: '#ef4444',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 6,
                    padding: '7px 14px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  <i className="ti ti-shield-lock" /> Retention & Purge
                </button>
              )}
            </div>
          </div>

          {/* Metric Cards Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 14,
            marginBottom: 24
          }}>
            {/* Total Logs */}
            <div style={{
              background: darkMode ? '#1e293b' : '#ffffff',
              border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
              borderRadius: 10,
              padding: '16px 18px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: 12, fontWeight: 600 }}>
                <span>TOTAL EVENTS</span>
                <i className="ti ti-list-check" style={{ fontSize: 18, color: '#3b82f6' }} />
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, marginTop: 8, color: darkMode ? '#f8fafc' : '#0f172a' }}>
                {statsLoading ? '...' : stats.total_logs?.toLocaleString()}
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>All-time recorded</div>
            </div>

            {/* Today's Logs */}
            <div style={{
              background: darkMode ? '#1e293b' : '#ffffff',
              border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
              borderRadius: 10,
              padding: '16px 18px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: 12, fontWeight: 600 }}>
                <span>TODAY'S ACTIVITY</span>
                <i className="ti ti-calendar-event" style={{ fontSize: 18, color: '#10b981' }} />
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, marginTop: 8, color: '#10b981' }}>
                {statsLoading ? '...' : stats.today_logs?.toLocaleString()}
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Events since 00:00 UTC</div>
            </div>

            {/* Critical & High */}
            <div style={{
              background: darkMode ? '#1e293b' : '#ffffff',
              border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
              borderRadius: 10,
              padding: '16px 18px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: 12, fontWeight: 600 }}>
                <span>HIGH / CRITICAL</span>
                <i className="ti ti-alert-triangle" style={{ fontSize: 18, color: '#f59e0b' }} />
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, marginTop: 8, color: '#f59e0b' }}>
                {statsLoading ? '...' : stats.critical_logs?.toLocaleString()}
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Elevated severity logs</div>
            </div>

            {/* Failed Operations */}
            <div style={{
              background: darkMode ? '#1e293b' : '#ffffff',
              border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
              borderRadius: 10,
              padding: '16px 18px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: 12, fontWeight: 600 }}>
                <span>FAILURES</span>
                <i className="ti ti-circle-x" style={{ fontSize: 18, color: '#ef4444' }} />
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, marginTop: 8, color: '#ef4444' }}>
                {statsLoading ? '...' : stats.failed_logs?.toLocaleString()}
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Rejected or failed</div>
            </div>

            {/* Delegated Proxy Actions */}
            <div style={{
              background: darkMode ? '#1e293b' : '#ffffff',
              border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
              borderRadius: 10,
              padding: '16px 18px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: 12, fontWeight: 600 }}>
                <span>DELEGATED ACTIONS</span>
                <i className="ti ti-bolt" style={{ fontSize: 18, color: '#8b5cf6' }} />
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, marginTop: 8, color: '#8b5cf6' }}>
                {statsLoading ? '...' : stats.delegated_logs?.toLocaleString()}
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Substitute teacher proxy</div>
            </div>

            {/* Purge Eligible */}
            <div style={{
              background: darkMode ? '#1e293b' : '#ffffff',
              border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
              borderRadius: 10,
              padding: '16px 18px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: 12, fontWeight: 600 }}>
                <span>PURGE ELIGIBLE</span>
                <i className="ti ti-clock-pause" style={{ fontSize: 18, color: '#64748b' }} />
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, marginTop: 8, color: darkMode ? '#f8fafc' : '#0f172a' }}>
                {statsLoading ? '...' : stats.purge_eligible_logs?.toLocaleString()}
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Older than {stats.retention_days}d</div>
            </div>
          </div>

          {/* Filter Bar */}
          <div style={{
            background: darkMode ? '#1e293b' : '#ffffff',
            border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
            borderRadius: 10,
            padding: 16,
            marginBottom: 20,
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
              {/* Search */}
              <div style={{ flex: '1 1 200px', minWidth: 200, position: 'relative' }}>
                <i className="ti ti-search" style={{ position: 'absolute', left: 10, top: 10, color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Search remarks, user, action..."
                  className="form-input"
                  value={filters.q}
                  onChange={(e) => handleFilterChange('q', e.target.value)}
                  style={{ width: '100%', paddingLeft: 32 }}
                />
              </div>

              {/* Module Filter */}
              <select
                className="form-select"
                value={filters.module}
                onChange={(e) => handleFilterChange('module', e.target.value)}
                style={{ width: 140 }}
              >
                <option value="">All Modules</option>
                <option value="admissions">Admissions</option>
                <option value="students">Students</option>
                <option value="attendance">Attendance</option>
                <option value="marks">Marks</option>
                <option value="finance">Finance / Fees</option>
                <option value="auth">Auth / Security</option>
                <option value="rbac">RBAC / Roles</option>
                <option value="delegation">Delegation</option>
                <option value="settings">Settings</option>
                <option value="academic">Academic</option>
              </select>

              {/* Severity Filter */}
              <select
                className="form-select"
                value={filters.severity}
                onChange={(e) => handleFilterChange('severity', e.target.value)}
                style={{ width: 130 }}
              >
                <option value="">All Severities</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
                <option value="INFO">Info</option>
              </select>

              {/* Status Filter */}
              <select
                className="form-select"
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                style={{ width: 120 }}
              >
                <option value="">All Status</option>
                <option value="SUCCESS">Success</option>
                <option value="FAILURE">Failure</option>
              </select>

              {/* Date Presets */}
              <select
                className="form-select"
                value={filters.date_preset}
                onChange={(e) => handleFilterChange('date_preset', e.target.value)}
                style={{ width: 130 }}
              >
                <option value="">Date Presets</option>
                <option value="today">Today</option>
                <option value="7days">Last 7 Days</option>
                <option value="30days">Last 30 Days</option>
                <option value="all">All Time</option>
              </select>

              {/* Custom Date Range */}
              <input
                type="date"
                className="form-input"
                value={filters.from_date}
                onChange={(e) => handleFilterChange('from_date', e.target.value)}
                style={{ width: 140 }}
                title="From Date"
              />
              <input
                type="date"
                className="form-input"
                value={filters.to_date}
                onChange={(e) => handleFilterChange('to_date', e.target.value)}
                style={{ width: 140 }}
                title="To Date"
              />

              {/* Delegated Only Toggle */}
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: darkMode ? '#cbd5e1' : '#475569', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={filters.is_delegated === 'true'}
                  onChange={(e) => handleFilterChange('is_delegated', e.target.checked ? 'true' : '')}
                />
                ⚡ Delegated Only
              </label>

              {/* Action Buttons */}
              <button className="btn btn-neutral btn-sm" onClick={clearFilters} title="Reset filters">
                <i className="ti ti-filter-off" /> Reset
              </button>
            </div>
          </div>

          {/* Audit Logs Table */}
          <div style={{
            background: darkMode ? '#1e293b' : '#ffffff',
            border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
            borderRadius: 10,
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}>
            <div className="table-container">
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: darkMode ? '#0f172a' : '#f8fafc', borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}` }}>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: darkMode ? '#94a3b8' : '#64748b' }}>TIMESTAMP</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: darkMode ? '#94a3b8' : '#64748b' }}>ACTOR</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: darkMode ? '#94a3b8' : '#64748b' }}>MODULE / ACTION</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: darkMode ? '#94a3b8' : '#64748b' }}>TARGET SCOPE</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: darkMode ? '#94a3b8' : '#64748b' }}>ACCESS TYPE</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: darkMode ? '#94a3b8' : '#64748b' }}>STATUS</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: darkMode ? '#94a3b8' : '#64748b', textAlign: 'right' }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '50px 20px', color: '#64748b' }}>
                        <i className="ti ti-loader spin" style={{ fontSize: 24, display: 'block', marginBottom: 8 }} />
                        Loading secure audit log stream...
                      </td>
                    </tr>
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '50px 20px', color: '#94a3b8' }}>
                        <i className="ti ti-file-search" style={{ fontSize: 32, display: 'block', marginBottom: 8 }} />
                        No audit events match your selected filters.
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => {
                      const sevBadge = getSeverityBadge(log.severity);
                      const stBadge = getStatusBadge(log.status);

                      return (
                        <tr
                          key={log.id}
                          style={{
                            borderBottom: `1px solid ${darkMode ? '#334155' : '#f1f5f9'}`,
                            transition: 'background 0.15s ease',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = darkMode ? '#26334d' : '#f8fafc'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                        >
                          {/* Timestamp */}
                          <td style={{ padding: '12px 14px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                            <div style={{ fontWeight: 600, color: darkMode ? '#f8fafc' : '#1e293b' }}>
                              {timeAgo(log.created_at)}
                            </div>
                            <div style={{ fontSize: 11, color: '#94a3b8' }} title={log.created_at}>
                              {formatTimestamp(log.created_at)}
                            </div>
                          </td>

                          {/* Actor */}
                          <td style={{ padding: '12px 14px', verticalAlign: 'middle' }}>
                            <div style={{ fontWeight: 600, color: darkMode ? '#f8fafc' : '#1e293b' }}>
                              {log.user_name || (log.user_id ? `User #${log.user_id}` : 'System Task')}
                            </div>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 3 }}>
                              {log.role_snapshot && (
                                <span style={{
                                  fontSize: 10,
                                  fontWeight: 600,
                                  background: darkMode ? '#334155' : '#e2e8f0',
                                  color: darkMode ? '#cbd5e1' : '#475569',
                                  padding: '1px 6px',
                                  borderRadius: 4
                                }}>
                                  {log.role_snapshot}
                                </span>
                              )}
                              {log.employee_id && (
                                <span style={{ fontSize: 10, color: '#94a3b8' }}>
                                  {log.employee_id}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Module / Action */}
                          <td style={{ padding: '12px 14px', verticalAlign: 'middle' }}>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                              <span style={{
                                fontSize: 11,
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: 6,
                                background: sevBadge.bg,
                                color: sevBadge.text,
                                border: `1px solid ${sevBadge.border}`
                              }}>
                                {log.action}
                              </span>
                              <span style={{ fontSize: 12, fontWeight: 600, color: darkMode ? '#cbd5e1' : '#475569' }}>
                                {log.module}
                              </span>
                            </div>
                            {log.remarks && (
                              <div style={{
                                fontSize: 11,
                                color: '#64748b',
                                marginTop: 4,
                                maxWidth: 280,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }} title={log.remarks}>
                                {log.remarks}
                              </div>
                            )}
                          </td>

                          {/* Target Scope */}
                          <td style={{ padding: '12px 14px', verticalAlign: 'middle', fontSize: 12 }}>
                            {log.student_name && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: darkMode ? '#e2e8f0' : '#334155' }}>
                                <i className="ti ti-user" style={{ color: '#3b82f6' }} />
                                <span>{log.student_name}</span>
                              </div>
                            )}
                            {log.teacher_name && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: darkMode ? '#e2e8f0' : '#334155' }}>
                                <i className="ti ti-school" style={{ color: '#8b5cf6' }} />
                                <span>{log.teacher_name}</span>
                              </div>
                            )}
                            {log.class_name && (
                              <div style={{ fontSize: 11, color: '#64748b' }}>
                                Class: {log.class_name}
                              </div>
                            )}
                            {log.subject_name && (
                              <div style={{ fontSize: 11, color: '#64748b' }}>
                                Subject: {log.subject_name}
                              </div>
                            )}
                            {!log.student_name && !log.teacher_name && !log.class_name && !log.subject_name && (
                              <span style={{ color: '#94a3b8' }}>
                                {log.entity_type ? `${log.entity_type} #${log.entity_id || ''}` : '—'}
                              </span>
                            )}
                          </td>

                          {/* Access Type */}
                          <td style={{ padding: '12px 14px', verticalAlign: 'middle' }}>
                            {log.is_delegated ? (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                fontSize: 11,
                                fontWeight: 700,
                                background: '#fef3c7',
                                color: '#b45309',
                                border: '1px solid #fcd34d',
                                padding: '2px 7px',
                                borderRadius: 6
                              }} title="Action performed by Substitute Teacher under active delegation">
                                ⚡ Delegated Proxy
                              </span>
                            ) : (
                              <span style={{
                                fontSize: 11,
                                color: '#64748b',
                                background: darkMode ? '#334155' : '#f1f5f9',
                                padding: '2px 7px',
                                borderRadius: 6
                              }}>
                                Direct
                              </span>
                            )}
                          </td>

                          {/* Status */}
                          <td style={{ padding: '12px 14px', verticalAlign: 'middle' }}>
                            <span style={{
                              fontSize: 10,
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 12,
                              background: stBadge.bg,
                              color: stBadge.text,
                              border: `1px solid ${stBadge.border}`
                            }}>
                              {stBadge.label}
                            </span>
                          </td>

                          {/* Action */}
                          <td style={{ padding: '12px 14px', verticalAlign: 'middle', textAlign: 'right' }}>
                            <button
                              className="btn btn-neutral btn-sm"
                              onClick={() => handleViewDetail(log.id)}
                              style={{ padding: '4px 10px', fontSize: 11, fontWeight: 600 }}
                            >
                              <i className="ti ti-eye" /> Details
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '14px 20px',
              borderTop: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
              background: darkMode ? '#0f172a' : '#ffffff',
              fontSize: 12,
              color: '#64748b',
              flexWrap: 'wrap',
              gap: 12
            }}>
              <div>
                Showing <strong>{logs.length}</strong> of <strong>{total.toLocaleString()}</strong> events · Page <strong>{page}</strong> of <strong>{totalPages}</strong>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <select
                  className="form-select"
                  value={perPage}
                  onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
                  style={{ width: 90, height: 32, fontSize: 12 }}
                >
                  <option value={25}>25 / page</option>
                  <option value={50}>50 / page</option>
                  <option value={100}>100 / page</option>
                </select>

                <button
                  className="btn btn-neutral btn-sm"
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  style={{ height: 32 }}
                >
                  Previous
                </button>
                <button
                  className="btn btn-neutral btn-sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  style={{ height: 32 }}
                >
                  Next
                </button>
              </div>
            </div>
          </div>

          {/* Slide-Over Detail Drawer */}
          {selectedLog && (
            <div
              style={{
                position: 'fixed',
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
                background: 'rgba(0, 0, 0, 0.5)',
                zIndex: 1000,
                display: 'flex',
                justifyContent: 'flex-end',
                animation: 'fadeIn 0.2s ease-out'
              }}
              onClick={() => setSelectedLog(null)}
            >
              <div
                style={{
                  width: '100%',
                  maxWidth: 620,
                  height: '100%',
                  background: darkMode ? '#1e293b' : '#ffffff',
                  boxShadow: '-4px 0 25px rgba(0,0,0,0.2)',
                  display: 'flex',
                  flexDirection: 'column',
                  overflowY: 'auto',
                  padding: 24,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Drawer Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 16, borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}` }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        fontSize: 12,
                        fontWeight: 800,
                        padding: '3px 10px',
                        borderRadius: 6,
                        ...getSeverityBadge(selectedLog.severity)
                      }}>
                        {selectedLog.action}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: darkMode ? '#cbd5e1' : '#475569' }}>
                        {selectedLog.module}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                      Event ID: #{selectedLog.id} · {formatTimestamp(selectedLog.created_at)}
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedLog(null)}
                    style={{ background: 'none', border: 'none', fontSize: 20, color: '#94a3b8', cursor: 'pointer' }}
                  >
                    ✕
                  </button>
                </div>

                {/* Drawer Body */}
                <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>

                  {/* Remarks Box */}
                  {selectedLog.remarks && (
                    <div style={{
                      padding: 14,
                      background: darkMode ? '#0f172a' : '#f8fafc',
                      borderRadius: 8,
                      border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
                      fontSize: 13,
                      color: darkMode ? '#f8fafc' : '#1e293b'
                    }}>
                      <strong>Remarks:</strong> {selectedLog.remarks}
                    </div>
                  )}

                  {/* Delegation Linkage Card */}
                  {selectedLog.is_delegated && (
                    <div style={{
                      padding: 14,
                      background: darkMode ? '#3b2f15' : '#fffbeb',
                      border: '1px solid #fde047',
                      borderRadius: 8
                    }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#b45309', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <i className="ti ti-bolt" /> Delegated Proxy Execution
                      </div>
                      <div style={{ marginTop: 8, fontSize: 12, color: darkMode ? '#fef08a' : '#854d0e' }}>
                        <div><strong>Substitute Teacher:</strong> {selectedLog.user_name || `User #${selectedLog.user_id}`}</div>
                        {selectedLog.delegation_details && (
                          <>
                            <div style={{ marginTop: 4 }}><strong>On Behalf Of:</strong> {selectedLog.delegation_details.source_teacher_name}</div>
                            {selectedLog.delegation_details.reason && (
                              <div style={{ marginTop: 4 }}><strong>Delegation Reason:</strong> {selectedLog.delegation_details.reason}</div>
                            )}
                            <div style={{ marginTop: 4, fontSize: 11, color: '#a16207' }}>
                              Delegation Reference ID: #{selectedLog.delegation_details.delegation_id}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Target Scope Card */}
                  <div style={{
                    padding: 14,
                    background: darkMode ? '#0f172a' : '#f8fafc',
                    borderRadius: 8,
                    border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 8 }}>TARGET SCOPE</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12 }}>
                      <div>
                        <span style={{ color: '#94a3b8' }}>Student:</span>{' '}
                        <strong>{selectedLog.student_name || (selectedLog.student_id ? `#${selectedLog.student_id}` : 'None')}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#94a3b8' }}>Teacher:</span>{' '}
                        <strong>{selectedLog.teacher_name || (selectedLog.teacher_id ? `#${selectedLog.teacher_id}` : 'None')}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#94a3b8' }}>Class:</span>{' '}
                        <strong>{selectedLog.class_name || (selectedLog.class_id ? `#${selectedLog.class_id}` : 'None')}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#94a3b8' }}>Subject:</span>{' '}
                        <strong>{selectedLog.subject_name || (selectedLog.subject_id ? `#${selectedLog.subject_id}` : 'None')}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Before vs After Diff Section */}
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: darkMode ? '#f8fafc' : '#1e293b', marginBottom: 8 }}>
                      Visual Field Diffs (Before vs After)
                    </div>

                    {selectedLog.changed_fields && Object.keys(selectedLog.changed_fields).length > 0 ? (
                      <div style={{
                        border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
                        borderRadius: 8,
                        overflow: 'hidden'
                      }}>
                        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ background: darkMode ? '#0f172a' : '#f1f5f9', borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}` }}>
                              <th style={{ padding: '8px 12px', textAlign: 'left' }}>Field</th>
                              <th style={{ padding: '8px 12px', textAlign: 'left', color: '#dc2626' }}>Previous (Old)</th>
                              <th style={{ padding: '8px 12px', textAlign: 'left', color: '#16a34a' }}>Updated (New)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(selectedLog.changed_fields).map(([field, diff]) => (
                              <tr key={field} style={{ borderBottom: `1px solid ${darkMode ? '#334155' : '#f1f5f9'}` }}>
                                <td style={{ padding: '8px 12px', fontWeight: 600, color: darkMode ? '#e2e8f0' : '#334155' }}>
                                  {field}
                                </td>
                                <td style={{ padding: '8px 12px', color: '#dc2626', background: darkMode ? 'rgba(239, 68, 68, 0.08)' : '#fef2f2' }}>
                                  {diff?.old === null || diff?.old === undefined || diff?.old === '' ? '—' : String(diff.old)}
                                </td>
                                <td style={{ padding: '8px 12px', color: '#16a34a', background: darkMode ? 'rgba(34, 197, 94, 0.08)' : '#f0fdf4' }}>
                                  {diff?.new === null || diff?.new === undefined || diff?.new === '' ? '—' : String(diff.new)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : selectedLog.old_value || selectedLog.new_value ? (
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: 10,
                        fontSize: 12
                      }}>
                        <div style={{ padding: 10, background: darkMode ? '#261b1b' : '#fef2f2', borderRadius: 6, border: '1px solid #fca5a5' }}>
                          <strong style={{ color: '#dc2626' }}>Previous State:</strong>
                          <pre style={{ margin: '6px 0 0', fontSize: 11, whiteSpace: 'pre-wrap' }}>
                            {typeof selectedLog.old_value === 'object' ? JSON.stringify(selectedLog.old_value, null, 2) : String(selectedLog.old_value || 'None')}
                          </pre>
                        </div>
                        <div style={{ padding: 10, background: darkMode ? '#19281f' : '#f0fdf4', borderRadius: 6, border: '1px solid #86efac' }}>
                          <strong style={{ color: '#16a34a' }}>New State:</strong>
                          <pre style={{ margin: '6px 0 0', fontSize: 11, whiteSpace: 'pre-wrap' }}>
                            {typeof selectedLog.new_value === 'object' ? JSON.stringify(selectedLog.new_value, null, 2) : String(selectedLog.new_value || 'None')}
                          </pre>
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic', padding: '10px 0' }}>
                        No state modifications recorded for this event.
                      </div>
                    )}
                  </div>

                  {/* Client Context Box */}
                  <div style={{
                    padding: 14,
                    background: darkMode ? '#0f172a' : '#f8fafc',
                    borderRadius: 8,
                    border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 8 }}>CLIENT CONTEXT & SECURITY</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                      <div><span style={{ color: '#94a3b8' }}>IP Address:</span> {selectedLog.ip_address || '—'}</div>
                      <div><span style={{ color: '#94a3b8' }}>Browser:</span> {selectedLog.browser || '—'}</div>
                      <div><span style={{ color: '#94a3b8' }}>Operating System:</span> {selectedLog.os || '—'}</div>
                      <div><span style={{ color: '#94a3b8' }}>Execution Time:</span> {selectedLog.execution_time_ms ? `${selectedLog.execution_time_ms}ms` : '—'}</div>
                      <div style={{ gridColumn: 'span 2' }}>
                        <span style={{ color: '#94a3b8' }}>Request ID:</span>{' '}
                        <code style={{ fontSize: 11, background: darkMode ? '#334155' : '#e2e8f0', padding: '2px 4px', borderRadius: 4 }}>
                          {selectedLog.request_id || '—'}
                        </code>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          )}

          {/* Retention & Protected Purge Modal */}
          {showRetentionModal && (
            <div
              style={{
                position: 'fixed',
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
                background: 'rgba(0, 0, 0, 0.6)',
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 16
              }}
              onClick={() => setShowRetentionModal(false)}
            >
              <div
                style={{
                  width: '100%',
                  maxWidth: 520,
                  background: darkMode ? '#1e293b' : '#ffffff',
                  borderRadius: 12,
                  padding: 24,
                  boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: darkMode ? '#f8fafc' : '#0f172a' }}>
                    ⚙️ Audit Retention & Compliance Policy
                  </h3>
                  <button
                    onClick={() => setShowRetentionModal(false)}
                    style={{ background: 'none', border: 'none', fontSize: 20, color: '#94a3b8', cursor: 'pointer' }}
                  >
                    ✕
                  </button>
                </div>

                {/* Retention Setting */}
                <div style={{ marginBottom: 24, paddingBottom: 20, borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}` }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: darkMode ? '#cbd5e1' : '#334155' }}>
                    Retention Window (Days):
                  </label>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <input
                      type="number"
                      min={30}
                      className="form-input"
                      value={retentionDaysInput}
                      onChange={(e) => setRetentionDaysInput(e.target.value)}
                      style={{ width: 140 }}
                    />
                    {canManageRetention && (
                      <button
                        className="btn btn-neutral btn-sm"
                        onClick={handleUpdateRetention}
                        disabled={updatingRetention}
                      >
                        {updatingRetention ? 'Updating...' : 'Update Policy'}
                      </button>
                    )}
                  </div>
                  <small style={{ color: '#64748b', display: 'block', marginTop: 4 }}>
                    Minimum retention window is 30 days. Logs within this period cannot be purged under any circumstance.
                  </small>
                </div>

                {/* Protected Purge Section */}
                <div style={{ background: darkMode ? '#261b1b' : '#fef2f2', border: '1px solid #f87171', borderRadius: 8, padding: 16 }}>
                  <h4 style={{ margin: '0 0 6px', color: '#b91c1c', fontSize: 14, fontWeight: 700 }}>
                    ⚠️ Protected Immutable Purge
                  </h4>
                  <p style={{ margin: '0 0 12px', fontSize: 12, color: '#991b1b' }}>
                    Currently, <strong>{stats.purge_eligible_logs?.toLocaleString()}</strong> logs are older than {stats.retention_days} days and eligible for permanent purge.
                    Purge operations generate indelible audit markers that survive the purge.
                  </p>

                  <div style={{ marginBottom: 10 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#991b1b', marginBottom: 4 }}>
                      1. Mandatory Regulatory Reason:
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Annual data sanitization approved by governing body"
                      value={purgeReason}
                      onChange={(e) => setPurgeReason(e.target.value)}
                      style={{ width: '100%', fontSize: 12 }}
                    />
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#991b1b', marginBottom: 4 }}>
                      2. Type "CONFIRM PURGE" to unlock:
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="CONFIRM PURGE"
                      value={purgeConfirmationText}
                      onChange={(e) => setPurgeConfirmationText(e.target.value)}
                      style={{ width: '100%', fontSize: 12 }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button
                      className="btn btn-neutral btn-sm"
                      onClick={() => setShowRetentionModal(false)}
                    >
                      Cancel
                    </button>
                    <button
                      className="btn btn-sm"
                      onClick={handlePurgeLogs}
                      disabled={purging || purgeConfirmationText !== 'CONFIRM PURGE' || !purgeReason.trim()}
                      style={{
                        background: purgeConfirmationText === 'CONFIRM PURGE' && purgeReason.trim() ? '#dc2626' : '#94a3b8',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: 6,
                        padding: '6px 14px',
                        fontWeight: 600,
                        cursor: purgeConfirmationText === 'CONFIRM PURGE' && purgeReason.trim() ? 'pointer' : 'not-allowed'
                      }}
                    >
                      {purging ? 'Purging...' : 'Execute Protected Purge'}
                    </button>
                  </div>
                </div>

              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
