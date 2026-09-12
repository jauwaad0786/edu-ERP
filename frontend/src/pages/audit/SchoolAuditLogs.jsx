// frontend/src/pages/audit/SchoolAuditLogs.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
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
  const s = (status || '').toUpperCase();
  if (s === 'FAILURE' || s === 'FAILED' || s === 'DENIED') {
    return { bg: '#fee2e2', text: '#dc2626', border: '#fca5a5', label: 'FAILED' };
  }
  return { bg: '#dcfce7', text: '#15803d', border: '#86efac', label: 'SUCCESS' };
}

export default function SchoolAuditLogs() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('ederp_theme') === 'dark');
  useEffect(() => { localStorage.setItem('ederp_theme', darkMode ? 'dark' : 'light'); }, [darkMode]);

  // Determine current specialized view
  const urlModule = (searchParams.get('module') || '').toUpperCase();
  const urlDelegated = searchParams.get('is_delegated') === 'true';
  const urlTab = searchParams.get('tab') || '';

  const currentView = useMemo(() => {
    if (urlTab === 'retention') return 'RETENTION';
    if (urlDelegated) return 'DELEGATED';
    if (urlModule === 'AUTH') return 'SECURITY';
    if (urlModule === 'ATTENDANCE' || urlModule === 'STUDENT' || urlModule === 'MARKS') return 'ACADEMIC';
    if (urlModule === 'FINANCE') return 'FINANCE';
    return 'OVERVIEW';
  }, [urlTab, urlDelegated, urlModule]);

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
    auth_events: 0,
    auth_failed: 0,
    academic_events: 0,
    finance_events: 0,
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

  // Retention & Purge state
  const [retentionDaysInput, setRetentionDaysInput] = useState(180);
  const [purgeConfirmationText, setPurgeConfirmationText] = useState('');
  const [purgeReason, setPurgeReason] = useState('');
  const [purging, setPurging] = useState(false);
  const [updatingRetention, setUpdatingRetention] = useState(false);
  const [purgeHistory, setPurgeHistory] = useState([]);
  const [loadingPurgeHistory, setLoadingPurgeHistory] = useState(false);

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

  const fetchPurgeHistory = useCallback(async () => {
    setLoadingPurgeHistory(true);
    try {
      const res = await api.get('/audit/school/logs', {
        params: { action: 'AUDIT_PURGE', per_page: 15 }
      });
      setPurgeHistory(res.data.logs || []);
    } catch (err) {
      console.error('Failed to load purge history:', err);
    } finally {
      setLoadingPurgeHistory(false);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    if (currentView === 'RETENTION') {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params = {
        page,
        per_page: perPage,
        ...filters,
      };

      // Enforce current view scope if not explicitly overridden
      if (currentView === 'SECURITY' && !params.module) params.module = 'AUTH';
      if (currentView === 'ACADEMIC' && !params.module) params.module = 'ATTENDANCE';
      if (currentView === 'FINANCE' && !params.module) params.module = 'FINANCE';
      if (currentView === 'DELEGATED') params.is_delegated = 'true';

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
  }, [page, perPage, filters, currentView]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    if (currentView === 'RETENTION') {
      fetchPurgeHistory();
    }
  }, [currentView, fetchPurgeHistory]);

  // Sync with URL query params from sidebar navigation
  useEffect(() => {
    const mod = searchParams.get('module') || '';
    const del = searchParams.get('is_delegated') || '';
    const sev = searchParams.get('severity') || '';
    const st = searchParams.get('status') || '';

    setFilters(prev => {
      let changed = false;
      const next = { ...prev };

      if (next.module !== mod) {
        next.module = mod;
        changed = true;
      }
      if (next.is_delegated !== del) {
        next.is_delegated = del;
        changed = true;
      }
      if (next.severity !== sev) {
        next.severity = sev;
        changed = true;
      }
      if (next.status !== st) {
        next.status = st;
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
    const preserved = {};
    if (currentView === 'SECURITY') preserved.module = 'AUTH';
    if (currentView === 'ACADEMIC') preserved.module = 'ATTENDANCE';
    if (currentView === 'FINANCE') preserved.module = 'FINANCE';
    if (currentView === 'DELEGATED') preserved.is_delegated = 'true';

    setSearchParams(preserved);
    setFilters({
      module: preserved.module || '',
      action: '',
      severity: '',
      status: '',
      is_delegated: preserved.is_delegated || '',
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
      if (currentView === 'SECURITY' && !params.module) params.module = 'AUTH';
      if (currentView === 'ACADEMIC' && !params.module) params.module = 'ATTENDANCE';
      if (currentView === 'FINANCE' && !params.module) params.module = 'FINANCE';
      if (currentView === 'DELEGATED') params.is_delegated = 'true';

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
      link.setAttribute('download', `School_Audit_${currentView}_${new Date().toISOString().split('T')[0]}.csv`);
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
    const days = parseInt(retentionDaysInput, 10);
    if (isNaN(days) || days < 30) {
      alert('Retention period must be at least 30 days.');
      return;
    }
    setUpdatingRetention(true);
    try {
      await api.put('/audit/school/retention', { retention_days: days });
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
      setPurgeConfirmationText('');
      setPurgeReason('');
      fetchStats();
      fetchPurgeHistory();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to purge audit logs');
    } finally {
      setPurging(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  // View configuration
  const viewMeta = useMemo(() => {
    switch (currentView) {
      case 'SECURITY':
        return {
          title: 'Security & Access Control Audit',
          icon: 'ti-shield-lock',
          color: '#2563eb',
          badge: 'AUTHENTICATION & ACCESS',
          subtitle: 'Authentication tracking, login verification, failed attempts, password changes, and IP diagnostics',
          emptyMessage: 'No security or login activity found matching current filters.'
        };
      case 'ACADEMIC':
        return {
          title: 'Academic & Attendance Audit Trail',
          icon: 'ti-clipboard-check',
          color: '#059669',
          badge: 'STUDENTS & ACADEMICS',
          subtitle: 'Chronological provenance for attendance marking, student admissions, profile edits, and grades',
          emptyMessage: 'No academic or attendance events found matching current filters.'
        };
      case 'FINANCE':
        return {
          title: 'Financial Operations & Fee Ledger Audit',
          icon: 'ti-currency-rupee',
          color: '#d97706',
          badge: 'REVENUE & BILLING',
          subtitle: 'Immutable transaction audit log for fee collections, receipts, discount waivers, and refunds',
          emptyMessage: 'No financial transaction events found matching current filters.'
        };
      case 'DELEGATED':
        return {
          title: 'Substitute Teacher & Proxy Activity Audit',
          icon: 'ti-switch-horizontal',
          color: '#7c3aed',
          badge: 'ZERO-ROLE PROXY LAYER',
          subtitle: 'Forensic audit log of all operational duties executed by substitute teachers under temporary delegation',
          emptyMessage: 'No delegated substitute teacher operations recorded yet.'
        };
      case 'RETENTION':
        return {
          title: 'Data Retention & Compliance Governance',
          icon: 'ti-archive',
          color: '#dc2626',
          badge: 'LEGAL & ARCHIVAL POLICY',
          subtitle: 'Configure school audit log retention windows, inspect purge eligibility, and execute protected compliance purges',
          emptyMessage: ''
        };
      default:
        return {
          title: 'Enterprise Audit Command Center',
          icon: 'ti-shield-check',
          color: '#0284c7',
          badge: 'FULL AUDIT STREAM',
          subtitle: 'System-wide immutable audit trail and compliance provenance across all school departments',
          emptyMessage: 'No audit events match your selected filters.'
        };
    }
  }, [currentView]);

  return (
    <div className={`app-shell${darkMode ? ' theme-dark' : ''}`}>
      <Sidebar darkMode={darkMode} />
      <div className="main-content">
        <Navbar title={viewMeta.title} darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />

        {/* ── Page Body (Edge-to-edge layout, no awkward gaps) ── */}
        <div className="page-body" style={{ padding: '24px 28px', width: '100%', minHeight: 'calc(100vh - 52px)' }}>

          {/* ══ Hero Header Banner ══ */}
          <div style={{
            background: darkMode ? '#141b2d' : '#ffffff',
            border: `1px solid ${darkMode ? '#1e293b' : '#e2e8f0'}`,
            borderRadius: 14,
            padding: '22px 26px',
            marginBottom: 20,
            boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8,
                  background: `${viewMeta.color}15`,
                  color: viewMeta.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20
                }}>
                  <i className={`ti ${viewMeta.icon}`} />
                </div>
                <div>
                  <span style={{
                    fontSize: 10, fontWeight: 800, letterSpacing: '0.06em',
                    padding: '3px 8px', borderRadius: 4,
                    background: `${viewMeta.color}18`, color: viewMeta.color
                  }}>
                    {viewMeta.badge}
                  </span>
                </div>
              </div>
              <h1 style={{ fontSize: 22, fontWeight: 800, margin: '4px 0 2px', color: darkMode ? '#f8fafc' : '#0f172a' }}>
                {viewMeta.title}
              </h1>
              <p style={{ margin: 0, fontSize: 13, color: '#64748b', maxWidth: 750 }}>
                {viewMeta.subtitle}
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              {currentView !== 'RETENTION' && canExport && (
                <button
                  className="btn btn-neutral btn-sm"
                  onClick={handleExportCSV}
                  disabled={exporting}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <i className={`ti ti-download ${exporting ? 'spin' : ''}`} />
                  {exporting ? 'Exporting...' : 'Export Filtered CSV'}
                </button>
              )}

              {currentView === 'DELEGATED' && (
                <button
                  className="btn btn-sm"
                  onClick={() => navigate('/delegations')}
                  style={{
                    background: '#7c3aed', color: '#fff', border: 'none',
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '7px 14px', borderRadius: 6, fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  <i className="ti ti-switch-horizontal" /> View Delegation Settings
                </button>
              )}

              {currentView !== 'RETENTION' && canPurge && (
                <button
                  className="btn btn-sm"
                  onClick={() => setSearchParams({ tab: 'retention' })}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    background: darkMode ? '#1e293b' : '#f8fafc',
                    color: darkMode ? '#cbd5e1' : '#475569',
                    border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
                    borderRadius: 6, padding: '7px 14px', fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  <i className="ti ti-archive" /> Retention &amp; Purge Policy
                </button>
              )}
            </div>
          </div>

          {/* ══ View Specific KPI Metric Cards ══ */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 14,
            marginBottom: 20
          }}>
            {currentView === 'SECURITY' && (
              <>
                <div style={{ background: darkMode ? '#1e293b' : '#fff', border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, borderRadius: 10, padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: 12, fontWeight: 700 }}>
                    <span>TOTAL AUTH EVENTS</span>
                    <i className="ti ti-lock" style={{ fontSize: 18, color: '#2563eb' }} />
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 800, marginTop: 8, color: darkMode ? '#f8fafc' : '#0f172a' }}>
                    {statsLoading ? '...' : (stats.auth_events || stats.total_logs || 0)}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Logins, resets &amp; token checks</div>
                </div>

                <div style={{ background: darkMode ? '#1e293b' : '#fff', border: `1px solid ${stats.auth_failed > 0 ? '#fca5a5' : darkMode ? '#334155' : '#e2e8f0'}`, borderRadius: 10, padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: 12, fontWeight: 700 }}>
                    <span>FAILED ATTEMPTS</span>
                    <i className="ti ti-alert-octagon" style={{ fontSize: 18, color: '#ef4444' }} />
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 800, marginTop: 8, color: stats.auth_failed > 0 ? '#ef4444' : '#10b981' }}>
                    {statsLoading ? '...' : (stats.auth_failed || stats.failed_logs || 0)}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                    {stats.auth_failed > 0 ? '⚠️ Suspicious authentication attempts' : 'Zero auth failures recorded'}
                  </div>
                </div>

                <div style={{ background: darkMode ? '#1e293b' : '#fff', border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, borderRadius: 10, padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: 12, fontWeight: 700 }}>
                    <span>CRITICAL SECURITY ALERTS</span>
                    <i className="ti ti-shield-alert" style={{ fontSize: 18, color: '#f59e0b' }} />
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 800, marginTop: 8, color: '#f59e0b' }}>
                    {statsLoading ? '...' : (stats.critical_logs || 0)}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>High severity access events</div>
                </div>

                <div style={{ background: darkMode ? '#1e293b' : '#fff', border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, borderRadius: 10, padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: 12, fontWeight: 700 }}>
                    <span>CLIENT IP TRACKING</span>
                    <i className="ti ti-world" style={{ fontSize: 18, color: '#10b981' }} />
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 800, marginTop: 8, color: '#10b981' }}>
                    100%
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Full IP &amp; User Agent provenance</div>
                </div>
              </>
            )}

            {currentView === 'ACADEMIC' && (
              <>
                <div style={{ background: darkMode ? '#1e293b' : '#fff', border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, borderRadius: 10, padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: 12, fontWeight: 700 }}>
                    <span>ACADEMIC OPERATIONS</span>
                    <i className="ti ti-school" style={{ fontSize: 18, color: '#059669' }} />
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 800, marginTop: 8, color: '#059669' }}>
                    {statsLoading ? '...' : (stats.academic_events || 0)}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Attendance, admissions &amp; marks</div>
                </div>

                <div style={{ background: darkMode ? '#1e293b' : '#fff', border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, borderRadius: 10, padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: 12, fontWeight: 700 }}>
                    <span>TODAY'S OPERATIONS</span>
                    <i className="ti ti-calendar-check" style={{ fontSize: 18, color: '#0284c7' }} />
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 800, marginTop: 8, color: '#0284c7' }}>
                    {statsLoading ? '...' : (stats.today_logs || 0)}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Actions recorded since 00:00 UTC</div>
                </div>

                <div style={{ background: darkMode ? '#1e293b' : '#fff', border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, borderRadius: 10, padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: 12, fontWeight: 700 }}>
                    <span>SUBSTITUTE PROXY ACTIONS</span>
                    <i className="ti ti-bolt" style={{ fontSize: 18, color: '#7c3aed' }} />
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 800, marginTop: 8, color: '#7c3aed' }}>
                    {statsLoading ? '...' : (stats.delegated_logs || 0)}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Marked by substitute teachers</div>
                </div>

                <div style={{ background: darkMode ? '#1e293b' : '#fff', border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, borderRadius: 10, padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: 12, fontWeight: 700 }}>
                    <span>FIELD DIFF TRACKING</span>
                    <i className="ti ti-git-compare" style={{ fontSize: 18, color: '#10b981' }} />
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 800, marginTop: 8, color: '#10b981' }}>
                    Active
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Before / After values preserved</div>
                </div>
              </>
            )}

            {currentView === 'FINANCE' && (
              <>
                <div style={{ background: darkMode ? '#1e293b' : '#fff', border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, borderRadius: 10, padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: 12, fontWeight: 700 }}>
                    <span>FINANCIAL OPERATIONS</span>
                    <i className="ti ti-cash" style={{ fontSize: 18, color: '#d97706' }} />
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 800, marginTop: 8, color: '#d97706' }}>
                    {statsLoading ? '...' : (stats.finance_events || 0)}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Fee collections &amp; vouchers</div>
                </div>

                <div style={{ background: darkMode ? '#1e293b' : '#fff', border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, borderRadius: 10, padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: 12, fontWeight: 700 }}>
                    <span>FAILED PAYMENTS</span>
                    <i className="ti ti-credit-card-off" style={{ fontSize: 18, color: '#ef4444' }} />
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 800, marginTop: 8, color: stats.failed_logs > 0 ? '#ef4444' : '#10b981' }}>
                    {statsLoading ? '...' : (stats.failed_logs || 0)}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Rejected transactions</div>
                </div>

                <div style={{ background: darkMode ? '#1e293b' : '#fff', border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, borderRadius: 10, padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: 12, fontWeight: 700 }}>
                    <span>HIGH VALUE ALERTS</span>
                    <i className="ti ti-alert-triangle" style={{ fontSize: 18, color: '#f59e0b' }} />
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 800, marginTop: 8, color: '#f59e0b' }}>
                    {statsLoading ? '...' : (stats.critical_logs || 0)}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Audited fee events</div>
                </div>

                <div style={{ background: darkMode ? '#1e293b' : '#fff', border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, borderRadius: 10, padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: 12, fontWeight: 700 }}>
                    <span>IMMUTABLE LEDGER</span>
                    <i className="ti ti-shield-check" style={{ fontSize: 18, color: '#10b981' }} />
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 800, marginTop: 8, color: '#10b981' }}>
                    Protected
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Append-only cash tracking</div>
                </div>
              </>
            )}

            {currentView === 'DELEGATED' && (
              <>
                <div style={{ background: darkMode ? '#1e293b' : '#fff', border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, borderRadius: 10, padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: 12, fontWeight: 700 }}>
                    <span>DELEGATED PROXY ACTIONS</span>
                    <i className="ti ti-bolt" style={{ fontSize: 18, color: '#7c3aed' }} />
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 800, marginTop: 8, color: '#7c3aed' }}>
                    {statsLoading ? '...' : (stats.delegated_logs || 0)}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Executed by substitute teachers</div>
                </div>

                <div style={{ background: darkMode ? '#1e293b' : '#fff', border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, borderRadius: 10, padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: 12, fontWeight: 700 }}>
                    <span>SECURITY MODEL</span>
                    <i className="ti ti-shield-check" style={{ fontSize: 18, color: '#10b981' }} />
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, marginTop: 8, color: '#10b981' }}>
                    Zero-Role Mutation
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Permanent role is always TEACHER</div>
                </div>

                <div style={{ background: darkMode ? '#1e293b' : '#fff', border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, borderRadius: 10, padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: 12, fontWeight: 700 }}>
                    <span>DUAL ATTRIBUTION</span>
                    <i className="ti ti-link" style={{ fontSize: 18, color: '#0284c7' }} />
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, marginTop: 8, color: '#0284c7' }}>
                    Active Linkage
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Substitute ↔ Absent Teacher</div>
                </div>

                <div style={{ background: darkMode ? '#1e293b' : '#fff', border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, borderRadius: 10, padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: 12, fontWeight: 700 }}>
                    <span>ACTIVE RETENTION</span>
                    <i className="ti ti-clock-check" style={{ fontSize: 18, color: '#d97706' }} />
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 800, marginTop: 8, color: '#d97706' }}>
                    {stats.retention_days || 180}d
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>School compliance window</div>
                </div>
              </>
            )}

            {currentView === 'OVERVIEW' && (
              <>
                <div style={{ background: darkMode ? '#1e293b' : '#fff', border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, borderRadius: 10, padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: 12, fontWeight: 700 }}>
                    <span>TOTAL EVENTS</span>
                    <i className="ti ti-list-check" style={{ fontSize: 18, color: '#3b82f6' }} />
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 800, marginTop: 8, color: darkMode ? '#f8fafc' : '#0f172a' }}>
                    {statsLoading ? '...' : (stats.total_logs || 0)}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>All-time recorded events</div>
                </div>

                <div style={{ background: darkMode ? '#1e293b' : '#fff', border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, borderRadius: 10, padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: 12, fontWeight: 700 }}>
                    <span>TODAY'S ACTIVITY</span>
                    <i className="ti ti-calendar-event" style={{ fontSize: 18, color: '#10b981' }} />
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 800, marginTop: 8, color: '#10b981' }}>
                    {statsLoading ? '...' : (stats.today_logs || 0)}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Events since 00:00 UTC</div>
                </div>

                <div style={{ background: darkMode ? '#1e293b' : '#fff', border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, borderRadius: 10, padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: 12, fontWeight: 700 }}>
                    <span>HIGH / CRITICAL</span>
                    <i className="ti ti-alert-triangle" style={{ fontSize: 18, color: '#f59e0b' }} />
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 800, marginTop: 8, color: '#f59e0b' }}>
                    {statsLoading ? '...' : (stats.critical_logs || 0)}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Elevated severity logs</div>
                </div>

                <div style={{ background: darkMode ? '#1e293b' : '#fff', border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, borderRadius: 10, padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: 12, fontWeight: 700 }}>
                    <span>FAILURES</span>
                    <i className="ti ti-circle-x" style={{ fontSize: 18, color: '#ef4444' }} />
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 800, marginTop: 8, color: '#ef4444' }}>
                    {statsLoading ? '...' : (stats.failed_logs || 0)}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Rejected or failed ops</div>
                </div>

                <div style={{ background: darkMode ? '#1e293b' : '#fff', border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, borderRadius: 10, padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: 12, fontWeight: 700 }}>
                    <span>DELEGATED ACTIONS</span>
                    <i className="ti ti-bolt" style={{ fontSize: 18, color: '#8b5cf6' }} />
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 800, marginTop: 8, color: '#8b5cf6' }}>
                    {statsLoading ? '...' : (stats.delegated_logs || 0)}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Substitute teacher proxy</div>
                </div>

                <div style={{ background: darkMode ? '#1e293b' : '#fff', border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, borderRadius: 10, padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: 12, fontWeight: 700 }}>
                    <span>PURGE ELIGIBLE</span>
                    <i className="ti ti-clock-pause" style={{ fontSize: 18, color: '#64748b' }} />
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 800, marginTop: 8, color: darkMode ? '#f8fafc' : '#0f172a' }}>
                    {statsLoading ? '...' : (stats.purge_eligible_logs || 0)}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Older than {stats.retention_days}d</div>
                </div>
              </>
            )}
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              VIEW BRANCH: RETENTION & COMPLIANCE CONSOLE (FULL PAGE)
             ═══════════════════════════════════════════════════════════════ */}
          {currentView === 'RETENTION' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* 3 Status Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
                <div style={{ background: darkMode ? '#1e293b' : '#fff', border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, borderRadius: 12, padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>⏳ Current Retention Policy</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: '#2563eb', marginTop: 8 }}>
                    {stats.retention_days || 180} Days
                  </div>
                  <p style={{ margin: '6px 0 0', fontSize: 12, color: '#94a3b8' }}>Logs older than this threshold become eligible for compliance purge.</p>
                </div>

                <div style={{ background: darkMode ? '#1e293b' : '#fff', border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, borderRadius: 12, padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>📦 Purge-Eligible Records</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: stats.purge_eligible_logs > 0 ? '#ef4444' : '#10b981', marginTop: 8 }}>
                    {stats.purge_eligible_logs || 0} Logs
                  </div>
                  <p style={{ margin: '6px 0 0', fontSize: 12, color: '#94a3b8' }}>
                    {stats.purge_eligible_logs > 0 ? 'Eligible for regulatory clean-up' : 'All logs are within the protected retention window'}
                  </p>
                </div>

                <div style={{ background: darkMode ? '#1e293b' : '#fff', border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, borderRadius: 12, padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>🛡️ Protected Purge Guard</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: '#10b981', marginTop: 8 }}>
                    ACTIVE
                  </div>
                  <p style={{ margin: '6px 0 0', fontSize: 12, color: '#94a3b8' }}>Permanent survival of AUDIT_PURGE_STARTED &amp; COMPLETED records.</p>
                </div>
              </div>

              {/* 2 Configuration Panels */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 20 }}>
                {/* Retention Setting Form */}
                <div style={{ background: darkMode ? '#1e293b' : '#fff', border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <h3 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 8px', color: darkMode ? '#f8fafc' : '#0f172a' }}>
                    ⚙️ Configure Retention Period
                  </h3>
                  <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5, margin: '0 0 18px' }}>
                    Specify the mandatory number of days audit trails must be retained before they are marked eligible for legal deletion. The minimum compliance floor is <strong>30 days</strong>.
                  </p>

                  <div style={{ marginBottom: 18 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: darkMode ? '#cbd5e1' : '#475569', marginBottom: 6 }}>
                      Retention Period (Days) *
                    </label>
                    <input
                      type="number"
                      min={30}
                      max={3650}
                      className="form-input"
                      value={retentionDaysInput}
                      onChange={(e) => setRetentionDaysInput(e.target.value)}
                      disabled={!canManageRetention || updatingRetention}
                      style={{ width: '100%', maxWidth: 260 }}
                    />
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>
                      Standard options: 90 days (1 Quarter), 180 days (6 Months), 365 days (1 Year).
                    </div>
                  </div>

                  {canManageRetention ? (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={handleUpdateRetention}
                      disabled={updatingRetention}
                    >
                      {updatingRetention ? 'Saving...' : '💾 Save Retention Policy'}
                    </button>
                  ) : (
                    <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>
                      🔒 You need <code>audit.retention.manage</code> permission to update this setting.
                    </div>
                  )}
                </div>

                {/* Protected Compliance Purge */}
                <div style={{ background: darkMode ? '#1e293b' : '#fff', border: '1px solid #fecaca', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <h3 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 8px', color: '#dc2626' }}>
                    🚨 Protected Compliance Purge
                  </h3>
                  <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5, margin: '0 0 16px' }}>
                    Permanently purges historical records older than {retentionDaysInput} days ({stats.purge_eligible_logs || 0} records eligible). Pre- and post-purge audit events will be permanently committed to preserve chain of custody.
                  </p>

                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#dc2626', marginBottom: 6 }}>
                      Type "CONFIRM PURGE" to authorize *
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="CONFIRM PURGE"
                      value={purgeConfirmationText}
                      onChange={(e) => setPurgeConfirmationText(e.target.value)}
                      disabled={!canPurge || purging}
                      style={{ borderColor: '#fca5a5' }}
                    />
                  </div>

                  <div style={{ marginBottom: 18 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: darkMode ? '#cbd5e1' : '#475569', marginBottom: 6 }}>
                      Regulatory / Auditor Reason *
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Annual data minimization cycle as per policy"
                      value={purgeReason}
                      onChange={(e) => setPurgeReason(e.target.value)}
                      disabled={!canPurge || purging}
                    />
                  </div>

                  {canPurge ? (
                    <button
                      onClick={handlePurgeLogs}
                      disabled={purging || purgeConfirmationText !== 'CONFIRM PURGE' || !purgeReason.trim()}
                      style={{
                        background: (purgeConfirmationText === 'CONFIRM PURGE' && purgeReason.trim()) ? '#dc2626' : '#94a3b8',
                        color: '#fff', border: 'none', borderRadius: 6, padding: '8px 18px',
                        fontSize: 13, fontWeight: 700, cursor: (purgeConfirmationText === 'CONFIRM PURGE' && purgeReason.trim()) ? 'pointer' : 'not-allowed'
                      }}
                    >
                      {purging ? 'Purging Records...' : '⚠️ Execute Compliance Purge'}
                    </button>
                  ) : (
                    <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>
                      🔒 You need <code>audit.purge</code> permission to execute purges.
                    </div>
                  )}
                </div>
              </div>

              {/* Historic Purge Audit Records Table */}
              <div style={{ background: darkMode ? '#1e293b' : '#fff', border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div style={{ padding: '16px 20px', borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: darkMode ? '#f8fafc' : '#0f172a' }}>
                      📜 Permanent Compliance Purge Ledger
                    </h4>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>
                      Audit markers proving who authorized purges, when they occurred, and exact record counts deleted
                    </p>
                  </div>
                  <button className="btn btn-neutral btn-sm" onClick={fetchPurgeHistory} disabled={loadingPurgeHistory}>
                    <i className={`ti ti-refresh ${loadingPurgeHistory ? 'spin' : ''}`} /> Refresh
                  </button>
                </div>

                <div className="table-container">
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: darkMode ? '#0f172a' : '#f8fafc', borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}` }}>
                        <th style={{ padding: '10px 14px', fontWeight: 700, color: '#64748b' }}>TIMESTAMP</th>
                        <th style={{ padding: '10px 14px', fontWeight: 700, color: '#64748b' }}>ACTION</th>
                        <th style={{ padding: '10px 14px', fontWeight: 700, color: '#64748b' }}>EXECUTED BY</th>
                        <th style={{ padding: '10px 14px', fontWeight: 700, color: '#64748b' }}>REASON GIVEN</th>
                        <th style={{ padding: '10px 14px', fontWeight: 700, color: '#64748b' }}>CLIENT IP</th>
                        <th style={{ padding: '10px 14px', fontWeight: 700, color: '#64748b' }}>STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingPurgeHistory ? (
                        <tr><td colSpan={6} style={{ textAlign: 'center', padding: 30, color: '#94a3b8' }}>Loading purge records...</td></tr>
                      ) : purgeHistory.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
                            <i className="ti ti-shield-check" style={{ fontSize: 24, display: 'block', marginBottom: 6, color: '#10b981' }} />
                            No historical purges executed. The audit log has never been purged.
                          </td>
                        </tr>
                      ) : (
                        purgeHistory.map(row => (
                          <tr key={row.id} style={{ borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}` }}>
                            <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>{formatTimestamp(row.created_at)}</td>
                            <td style={{ padding: '12px 14px' }}>
                              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: '#fee2e2', color: '#991b1b' }}>
                                {row.action}
                              </span>
                            </td>
                            <td style={{ padding: '12px 14px' }}><strong>{row.user_name || 'Administrator'}</strong></td>
                            <td style={{ padding: '12px 14px', color: '#64748b' }}>{row.remarks || '—'}</td>
                            <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontSize: 12 }}>{row.ip_address || '—'}</td>
                            <td style={{ padding: '12px 14px' }}>
                              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: '#dcfce7', color: '#15803d' }}>
                                COMPLIANT
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            /* ═══════════════════════════════════════════════════════════════
                VIEW BRANCH: STANDARD AUDIT STREAM (WITH DOMAIN FILTERS)
               ═══════════════════════════════════════════════════════════════ */
            <>
              {/* Quick Preset Filter Pills for Specialized Context */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', alignSelf: 'center', marginRight: 4 }}>
                  Quick Filter:
                </span>

                {currentView === 'SECURITY' && (
                  <>
                    <button
                      className="btn btn-sm"
                      onClick={() => handleFilterChange('action', '')}
                      style={{
                        background: !filters.action ? '#2563eb' : (darkMode ? '#1e293b' : '#fff'),
                        color: !filters.action ? '#fff' : (darkMode ? '#cbd5e1' : '#475569'),
                        border: `1px solid ${!filters.action ? '#2563eb' : darkMode ? '#334155' : '#e2e8f0'}`
                      }}
                    >
                      All Auth Logs
                    </button>
                    <button
                      className="btn btn-sm"
                      onClick={() => handleFilterChange('action', 'LOGIN')}
                      style={{
                        background: filters.action === 'LOGIN' ? '#2563eb' : (darkMode ? '#1e293b' : '#fff'),
                        color: filters.action === 'LOGIN' ? '#fff' : (darkMode ? '#cbd5e1' : '#475569'),
                        border: `1px solid ${filters.action === 'LOGIN' ? '#2563eb' : darkMode ? '#334155' : '#e2e8f0'}`
                      }}
                    >
                      🔑 Logins Only
                    </button>
                    <button
                      className="btn btn-sm"
                      onClick={() => handleFilterChange('status', 'FAILURE')}
                      style={{
                        background: filters.status === 'FAILURE' ? '#dc2626' : (darkMode ? '#1e293b' : '#fff'),
                        color: filters.status === 'FAILURE' ? '#fff' : (darkMode ? '#cbd5e1' : '#475569'),
                        border: `1px solid ${filters.status === 'FAILURE' ? '#dc2626' : darkMode ? '#334155' : '#e2e8f0'}`
                      }}
                    >
                      🚨 Failed Attempts Only
                    </button>
                    <button
                      className="btn btn-sm"
                      onClick={() => handleFilterChange('action', 'PASSWORD')}
                      style={{
                        background: filters.action === 'PASSWORD' ? '#2563eb' : (darkMode ? '#1e293b' : '#fff'),
                        color: filters.action === 'PASSWORD' ? '#fff' : (darkMode ? '#cbd5e1' : '#475569'),
                        border: `1px solid ${filters.action === 'PASSWORD' ? '#2563eb' : darkMode ? '#334155' : '#e2e8f0'}`
                      }}
                    >
                      🔄 Password Changes / Resets
                    </button>
                  </>
                )}

                {currentView === 'ACADEMIC' && (
                  <>
                    <button
                      className="btn btn-sm"
                      onClick={() => handleFilterChange('module', '')}
                      style={{
                        background: !filters.module ? '#059669' : (darkMode ? '#1e293b' : '#fff'),
                        color: !filters.module ? '#fff' : (darkMode ? '#cbd5e1' : '#475569'),
                        border: `1px solid ${!filters.module ? '#059669' : darkMode ? '#334155' : '#e2e8f0'}`
                      }}
                    >
                      All Academic
                    </button>
                    <button
                      className="btn btn-sm"
                      onClick={() => handleFilterChange('module', 'ATTENDANCE')}
                      style={{
                        background: filters.module === 'ATTENDANCE' ? '#059669' : (darkMode ? '#1e293b' : '#fff'),
                        color: filters.module === 'ATTENDANCE' ? '#fff' : (darkMode ? '#cbd5e1' : '#475569'),
                        border: `1px solid ${filters.module === 'ATTENDANCE' ? '#059669' : darkMode ? '#334155' : '#e2e8f0'}`
                      }}
                    >
                      📅 Attendance Marking
                    </button>
                    <button
                      className="btn btn-sm"
                      onClick={() => handleFilterChange('module', 'STUDENT')}
                      style={{
                        background: filters.module === 'STUDENT' ? '#059669' : (darkMode ? '#1e293b' : '#fff'),
                        color: filters.module === 'STUDENT' ? '#fff' : (darkMode ? '#cbd5e1' : '#475569'),
                        border: `1px solid ${filters.module === 'STUDENT' ? '#059669' : darkMode ? '#334155' : '#e2e8f0'}`
                      }}
                    >
                      🎓 Student Admissions &amp; Edits
                    </button>
                    <button
                      className="btn btn-sm"
                      onClick={() => handleFilterChange('module', 'MARKS')}
                      style={{
                        background: filters.module === 'MARKS' ? '#059669' : (darkMode ? '#1e293b' : '#fff'),
                        color: filters.module === 'MARKS' ? '#fff' : (darkMode ? '#cbd5e1' : '#475569'),
                        border: `1px solid ${filters.module === 'MARKS' ? '#059669' : darkMode ? '#334155' : '#e2e8f0'}`
                      }}
                    >
                      📝 Marks &amp; Exam Records
                    </button>
                  </>
                )}

                {currentView === 'FINANCE' && (
                  <>
                    <button
                      className="btn btn-sm"
                      onClick={() => handleFilterChange('action', '')}
                      style={{
                        background: !filters.action ? '#d97706' : (darkMode ? '#1e293b' : '#fff'),
                        color: !filters.action ? '#fff' : (darkMode ? '#cbd5e1' : '#475569'),
                        border: `1px solid ${!filters.action ? '#d97706' : darkMode ? '#334155' : '#e2e8f0'}`
                      }}
                    >
                      All Financial
                    </button>
                    <button
                      className="btn btn-sm"
                      onClick={() => handleFilterChange('action', 'COLLECT')}
                      style={{
                        background: filters.action === 'COLLECT' ? '#d97706' : (darkMode ? '#1e293b' : '#fff'),
                        color: filters.action === 'COLLECT' ? '#fff' : (darkMode ? '#cbd5e1' : '#475569'),
                        border: `1px solid ${filters.action === 'COLLECT' ? '#d97706' : darkMode ? '#334155' : '#e2e8f0'}`
                      }}
                    >
                      💰 Fee Collections
                    </button>
                    <button
                      className="btn btn-sm"
                      onClick={() => handleFilterChange('status', 'FAILURE')}
                      style={{
                        background: filters.status === 'FAILURE' ? '#dc2626' : (darkMode ? '#1e293b' : '#fff'),
                        color: filters.status === 'FAILURE' ? '#fff' : (darkMode ? '#cbd5e1' : '#475569'),
                        border: `1px solid ${filters.status === 'FAILURE' ? '#dc2626' : darkMode ? '#334155' : '#e2e8f0'}`
                      }}
                    >
                      ❌ Failed / Voided
                    </button>
                  </>
                )}

                {currentView === 'DELEGATED' && (
                  <>
                    <button
                      className="btn btn-sm"
                      onClick={() => handleFilterChange('action', '')}
                      style={{
                        background: !filters.action ? '#7c3aed' : (darkMode ? '#1e293b' : '#fff'),
                        color: !filters.action ? '#fff' : (darkMode ? '#cbd5e1' : '#475569'),
                        border: `1px solid ${!filters.action ? '#7c3aed' : darkMode ? '#334155' : '#e2e8f0'}`
                      }}
                    >
                      All Delegated Proxy Logs
                    </button>
                    <button
                      className="btn btn-sm"
                      onClick={() => handleFilterChange('action', 'ATTENDANCE')}
                      style={{
                        background: filters.action === 'ATTENDANCE' ? '#7c3aed' : (darkMode ? '#1e293b' : '#fff'),
                        color: filters.action === 'ATTENDANCE' ? '#fff' : (darkMode ? '#cbd5e1' : '#475569'),
                        border: `1px solid ${filters.action === 'ATTENDANCE' ? '#7c3aed' : darkMode ? '#334155' : '#e2e8f0'}`
                      }}
                    >
                      📋 Delegated Attendance
                    </button>
                    <button
                      className="btn btn-sm"
                      onClick={() => handleFilterChange('action', 'MARKS')}
                      style={{
                        background: filters.action === 'MARKS' ? '#7c3aed' : (darkMode ? '#1e293b' : '#fff'),
                        color: filters.action === 'MARKS' ? '#fff' : (darkMode ? '#cbd5e1' : '#475569'),
                        border: `1px solid ${filters.action === 'MARKS' ? '#7c3aed' : darkMode ? '#334155' : '#e2e8f0'}`
                      }}
                    >
                      📝 Delegated Marks
                    </button>
                  </>
                )}

                {currentView === 'OVERVIEW' && (
                  <>
                    <button
                      className="btn btn-sm"
                      onClick={() => handleFilterChange('date_preset', 'today')}
                      style={{
                        background: filters.date_preset === 'today' ? '#0284c7' : (darkMode ? '#1e293b' : '#fff'),
                        color: filters.date_preset === 'today' ? '#fff' : (darkMode ? '#cbd5e1' : '#475569'),
                        border: `1px solid ${filters.date_preset === 'today' ? '#0284c7' : darkMode ? '#334155' : '#e2e8f0'}`
                      }}
                    >
                      📅 Today's Logs
                    </button>
                    <button
                      className="btn btn-sm"
                      onClick={() => handleFilterChange('severity', 'CRITICAL')}
                      style={{
                        background: filters.severity === 'CRITICAL' ? '#dc2626' : (darkMode ? '#1e293b' : '#fff'),
                        color: filters.severity === 'CRITICAL' ? '#fff' : (darkMode ? '#cbd5e1' : '#475569'),
                        border: `1px solid ${filters.severity === 'CRITICAL' ? '#dc2626' : darkMode ? '#334155' : '#e2e8f0'}`
                      }}
                    >
                      ⚠️ Critical Severity Only
                    </button>
                    <button
                      className="btn btn-sm"
                      onClick={() => handleFilterChange('is_delegated', 'true')}
                      style={{
                        background: filters.is_delegated === 'true' ? '#7c3aed' : (darkMode ? '#1e293b' : '#fff'),
                        color: filters.is_delegated === 'true' ? '#fff' : (darkMode ? '#cbd5e1' : '#475569'),
                        border: `1px solid ${filters.is_delegated === 'true' ? '#7c3aed' : darkMode ? '#334155' : '#e2e8f0'}`
                      }}
                    >
                      ⚡ Delegated Proxy Only
                    </button>
                  </>
                )}
              </div>

              {/* Filter Toolbar */}
              <div style={{
                background: darkMode ? '#1e293b' : '#ffffff',
                border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
                borderRadius: 10,
                padding: 16,
                marginBottom: 20,
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
              }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                  {/* Search */}
                  <div style={{ flex: '1 1 200px', minWidth: 200, position: 'relative' }}>
                    <i className="ti ti-search" style={{ position: 'absolute', left: 10, top: 10, color: '#94a3b8' }} />
                    <input
                      type="text"
                      placeholder="Search actor, remarks, action..."
                      className="form-input"
                      value={filters.q}
                      onChange={(e) => handleFilterChange('q', e.target.value)}
                      style={{ width: '100%', paddingLeft: 32 }}
                    />
                  </div>

                  {/* Module Filter (Dropdown options match uppercase keys in DB) */}
                  {currentView === 'OVERVIEW' && (
                    <select
                      className="form-select"
                      value={filters.module}
                      onChange={(e) => handleFilterChange('module', e.target.value)}
                      style={{ width: 150 }}
                    >
                      <option value="">All Modules</option>
                      <option value="AUTH">Auth &amp; Security</option>
                      <option value="ATTENDANCE">Attendance</option>
                      <option value="STUDENT">Student Mgmt</option>
                      <option value="MARKS">Marks &amp; Exams</option>
                      <option value="FINANCE">Finance &amp; Fees</option>
                      <option value="RBAC">RBAC &amp; Roles</option>
                      <option value="DELEGATION">Delegations</option>
                      <option value="SETTINGS">Settings</option>
                    </select>
                  )}

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
                    style={{ width: 135 }}
                    title="From Date"
                  />
                  <input
                    type="date"
                    className="form-input"
                    value={filters.to_date}
                    onChange={(e) => handleFilterChange('to_date', e.target.value)}
                    style={{ width: 135 }}
                    title="To Date"
                  />

                  {/* Delegated Only Toggle (if in OVERVIEW) */}
                  {currentView === 'OVERVIEW' && (
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: darkMode ? '#cbd5e1' : '#475569', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={filters.is_delegated === 'true'}
                        onChange={(e) => handleFilterChange('is_delegated', e.target.checked ? 'true' : '')}
                      />
                      ⚡ Proxy Only
                    </label>
                  )}

                  {/* Reset Filters */}
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
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
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
                            Loading {viewMeta.title.toLowerCase()} stream...
                          </td>
                        </tr>
                      ) : logs.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ textAlign: 'center', padding: '60px 20px' }}>
                            <i className={`ti ${viewMeta.icon}`} style={{ fontSize: 36, color: '#94a3b8', display: 'block', marginBottom: 10 }} />
                            <div style={{ fontSize: 15, fontWeight: 700, color: darkMode ? '#f8fafc' : '#0f172a' }}>
                              {viewMeta.emptyMessage}
                            </div>
                            <p style={{ margin: '4px 0 16px', fontSize: 13, color: '#64748b' }}>
                              Try selecting a broader date preset or clearing active search keywords.
                            </p>
                            <button className="btn btn-neutral btn-sm" onClick={clearFilters}>
                              Clear Active Filters
                            </button>
                          </td>
                        </tr>
                      ) : (
                        logs.map(log => {
                          const statusBadge = getStatusBadge(log.status);
                          const sevBadge = getSeverityBadge(log.severity);
                          const isDelegated = log.is_delegated;

                          return (
                            <tr
                              key={log.id}
                              style={{
                                borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
                                transition: 'background 0.1s ease',
                                background: isDelegated ? (darkMode ? 'rgba(124, 58, 237, 0.04)' : '#faf5ff') : 'transparent'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = darkMode ? '#1e293b' : '#f8fafc'}
                              onMouseLeave={(e) => e.currentTarget.style.background = isDelegated ? (darkMode ? 'rgba(124, 58, 237, 0.04)' : '#faf5ff') : 'transparent'}
                            >
                              {/* Timestamp */}
                              <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                                <div style={{ fontWeight: 700, color: darkMode ? '#f8fafc' : '#0f172a' }}>
                                  {timeAgo(log.created_at)}
                                </div>
                                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                                  {formatTimestamp(log.created_at)}
                                </div>
                              </td>

                              {/* Actor */}
                              <td style={{ padding: '12px 14px' }}>
                                <div style={{ fontWeight: 600, color: darkMode ? '#f8fafc' : '#0f172a' }}>
                                  {log.user_name || 'System / Anonymous'}
                                </div>
                                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 3 }}>
                                  <span style={{
                                    fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                                    background: darkMode ? '#334155' : '#e2e8f0',
                                    color: darkMode ? '#cbd5e1' : '#475569'
                                  }}>
                                    {log.role_snapshot || 'USER'}
                                  </span>
                                  {log.employee_id && (
                                    <span style={{ fontSize: 11, color: '#94a3b8' }}>
                                      EMP: {log.employee_id}
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Module & Action */}
                              <td style={{ padding: '12px 14px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{
                                    fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                                    background: darkMode ? '#0f172a' : '#f1f5f9',
                                    color: darkMode ? '#94a3b8' : '#475569',
                                    border: `1px solid ${darkMode ? '#334155' : '#cbd5e1'}`
                                  }}>
                                    {log.action}
                                  </span>
                                  <span style={{ fontSize: 12, fontWeight: 600, color: darkMode ? '#cbd5e1' : '#475569' }}>
                                    {log.module}
                                  </span>
                                </div>
                                {log.remarks && (
                                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.remarks}>
                                    {log.remarks}
                                  </div>
                                )}
                              </td>

                              {/* Target Scope */}
                              <td style={{ padding: '12px 14px' }}>
                                {log.student_name ? (
                                  <div>
                                    <span style={{ fontWeight: 600, color: '#2563eb' }}>{log.student_name}</span>
                                    {log.class_name && (
                                      <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 4 }}>
                                        ({log.class_name})
                                      </span>
                                    )}
                                  </div>
                                ) : log.class_name ? (
                                  <div>
                                    <span style={{ fontWeight: 600, color: '#0f172a' }}>Class {log.class_name}</span>
                                    {log.subject_name && (
                                      <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 4 }}>
                                        &bull; {log.subject_name}
                                      </span>
                                    )}
                                  </div>
                                ) : log.entity_type ? (
                                  <div style={{ fontSize: 12, color: '#64748b' }}>
                                    {log.entity_type} {log.entity_id ? `#${log.entity_id}` : ''}
                                  </div>
                                ) : (
                                  <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>
                                )}
                              </td>

                              {/* Access Type (Normal vs Proxy) */}
                              <td style={{ padding: '12px 14px' }}>
                                {isDelegated ? (
                                  <span style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 4,
                                    fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20,
                                    background: '#f3e8ff', color: '#7e22ce', border: '1px solid #d8b4fe'
                                  }}>
                                    ⚡ Substitute Proxy
                                  </span>
                                ) : (
                                  <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500 }}>
                                    Direct
                                  </span>
                                )}
                              </td>

                              {/* Status & Severity */}
                              <td style={{ padding: '12px 14px' }}>
                                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                  <span style={{
                                    fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                                    background: statusBadge.bg, color: statusBadge.text, border: `1px solid ${statusBadge.border}`
                                  }}>
                                    {statusBadge.label}
                                  </span>
                                  {log.severity && log.severity !== 'INFO' && (
                                    <span style={{
                                      fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                                      background: sevBadge.bg, color: sevBadge.text
                                    }}>
                                      {log.severity}
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Actions */}
                              <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                                <button
                                  className="btn btn-neutral btn-sm"
                                  onClick={() => handleViewDetail(log.id)}
                                  style={{ padding: '4px 10px', fontSize: 12 }}
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

                {/* Pagination Footer */}
                <div style={{
                  padding: '12px 18px',
                  borderTop: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10,
                  background: darkMode ? '#141b2d' : '#f8fafc'
                }}>
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    Showing {logs.length} of {total} events &bull; Page {page} of {totalPages}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <select
                      className="form-select"
                      value={perPage}
                      onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
                      style={{ height: 30, fontSize: 12, padding: '0 8px' }}
                    >
                      <option value={10}>10 / page</option>
                      <option value={25}>25 / page</option>
                      <option value={50}>50 / page</option>
                      <option value={100}>100 / page</option>
                    </select>

                    <button
                      className="btn btn-neutral btn-sm"
                      disabled={page <= 1}
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                    >
                      Previous
                    </button>
                    <button
                      className="btn btn-neutral btn-sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage(p => p + 1)}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

        </div>
      </div>

      {/* ═════════════════════════════════════════════════════════════════
          SLIDE-OVER DRAWER FOR COMPLETE AUDIT DETAIL & BEFORE/AFTER DIFFS
         ═════════════════════════════════════════════════════════════════ */}
      {selectedLog && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(3px)',
          display: 'flex', justifyContent: 'flex-end', animation: 'fadeIn 0.15s ease'
        }}>
          <div style={{
            background: darkMode ? '#0f172a' : '#ffffff',
            width: '100%', maxWidth: 580,
            height: '100%',
            overflowY: 'auto',
            padding: '24px 28px',
            boxShadow: '-4px 0 24px rgba(0,0,0,0.2)',
            display: 'flex', flexDirection: 'column'
          }}>
            {/* Drawer Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 16, borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}` }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>
                  Log Record #{selectedLog.id}
                </span>
                <h3 style={{ margin: '2px 0 0', fontSize: 18, fontWeight: 800, color: darkMode ? '#f8fafc' : '#0f172a' }}>
                  {selectedLog.action} &bull; {selectedLog.module}
                </h3>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                style={{ background: 'none', border: 'none', fontSize: 22, color: '#94a3b8', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            {/* Drawer Body */}
            <div style={{ flex: 1, padding: '20px 0', display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Substitute Proxy Notice if Delegated */}
              {selectedLog.is_delegated && (
                <div style={{
                  background: '#faf5ff', border: '1px solid #d8b4fe', borderRadius: 8,
                  padding: '12px 16px', color: '#6b21a8', fontSize: 12
                }}>
                  <div style={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                    ⚡ Delegated Proxy Operation
                  </div>
                  <div style={{ marginTop: 4 }}>
                    This action was executed by <strong>{selectedLog.user_name}</strong> acting under an authorized substitute teacher delegation.
                  </div>
                  {selectedLog.delegation_details?.source_teacher && (
                    <div style={{ marginTop: 4, fontSize: 11, color: '#7e22ce' }}>
                      On behalf of absent regular teacher: <strong>{selectedLog.delegation_details.source_teacher.name}</strong>
                    </div>
                  )}
                </div>
              )}

              {/* Actor & Execution Metadata */}
              <div style={{ background: darkMode ? '#1e293b' : '#f8fafc', borderRadius: 8, padding: 16, border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 10 }}>
                  Actor &amp; Client Diagnostics
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 12 }}>
                  <div>
                    <span style={{ color: '#64748b' }}>User Name:</span>
                    <div style={{ fontWeight: 700, marginTop: 2 }}>{selectedLog.user_name || 'System / Anonymous'}</div>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Role Snapshot:</span>
                    <div style={{ fontWeight: 700, marginTop: 2 }}>{selectedLog.role_snapshot || '—'}</div>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Client IP:</span>
                    <div style={{ fontWeight: 600, fontFamily: 'monospace', marginTop: 2 }}>{selectedLog.ip_address || '—'}</div>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Timestamp (UTC):</span>
                    <div style={{ fontWeight: 600, marginTop: 2 }}>{formatTimestamp(selectedLog.created_at)}</div>
                  </div>
                </div>
                {selectedLog.user_agent && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, fontSize: 11, color: '#64748b' }}>
                    <span style={{ fontWeight: 600 }}>Browser / Device:</span> {selectedLog.user_agent}
                  </div>
                )}
              </div>

              {/* Target Entity Scope */}
              <div style={{ background: darkMode ? '#1e293b' : '#f8fafc', borderRadius: 8, padding: 16, border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 10 }}>
                  Target Record Scope
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 12 }}>
                  <div>
                    <span style={{ color: '#64748b' }}>Entity Type:</span>
                    <div style={{ fontWeight: 600, marginTop: 2 }}>{selectedLog.entity_type || '—'}</div>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Entity ID:</span>
                    <div style={{ fontWeight: 600, marginTop: 2 }}>{selectedLog.entity_id || '—'}</div>
                  </div>
                  {selectedLog.student_name && (
                    <div>
                      <span style={{ color: '#64748b' }}>Student Name:</span>
                      <div style={{ fontWeight: 700, color: '#2563eb', marginTop: 2 }}>{selectedLog.student_name}</div>
                    </div>
                  )}
                  {selectedLog.class_name && (
                    <div>
                      <span style={{ color: '#64748b' }}>Class / Section:</span>
                      <div style={{ fontWeight: 600, marginTop: 2 }}>{selectedLog.class_name}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Before & After State Changes Table */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 8 }}>
                  Diff Analysis &bull; Modified Fields
                </div>
                {selectedLog.changed_fields && Object.keys(selectedLog.changed_fields).length > 0 ? (
                  <div style={{ border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, borderRadius: 8, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: darkMode ? '#1e293b' : '#f1f5f9', borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}` }}>
                          <th style={{ padding: '8px 12px', fontWeight: 700, color: '#64748b', width: '30%' }}>FIELD</th>
                          <th style={{ padding: '8px 12px', fontWeight: 700, color: '#dc2626', width: '35%' }}>PREVIOUS VALUE</th>
                          <th style={{ padding: '8px 12px', fontWeight: 700, color: '#16a34a', width: '35%' }}>NEW VALUE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(selectedLog.changed_fields).map(([fieldName, diff]) => {
                          const oldVal = diff && typeof diff === 'object' && 'old' in diff ? String(diff.old ?? 'null') : '—';
                          const newVal = diff && typeof diff === 'object' && 'new' in diff ? String(diff.new ?? 'null') : String(diff ?? '');

                          return (
                            <tr key={fieldName} style={{ borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}` }}>
                              <td style={{ padding: '8px 12px', fontWeight: 600 }}>{fieldName}</td>
                              <td style={{ padding: '8px 12px', color: '#dc2626', background: darkMode ? 'rgba(239, 68, 68, 0.05)' : '#fef2f2', wordBreak: 'break-word' }}>
                                {oldVal}
                              </td>
                              <td style={{ padding: '8px 12px', color: '#16a34a', background: darkMode ? 'rgba(22, 163, 74, 0.05)' : '#f0fdf4', wordBreak: 'break-word' }}>
                                {newVal}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ padding: '16px', background: darkMode ? '#1e293b' : '#f8fafc', borderRadius: 8, fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>
                    No field-level diff recorded for this event (snapshot or action marker).
                  </div>
                )}
              </div>
            </div>

            {/* Drawer Footer */}
            <div style={{ paddingTop: 16, borderTop: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-neutral btn-sm" onClick={() => setSelectedLog(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
