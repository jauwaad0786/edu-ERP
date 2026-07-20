// frontend/src/pages/audit/SchoolAuditLogs.jsx
import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api from '../../api/axios';
import { usePermission } from '../../hooks/usePermission';

// old_value/new_value from the backend can be a plain string OR a parsed
// JSON object (audit.py's to_dict() runs json.loads() on them) -- e.g.
// delegation logs store {status, end_date, role_key, ...}. Rendering an
// object directly as a JSX child crashes with React error #31, so this
// flattens it into a readable "key: value, key: value" string first.
function formatAuditValue(val) {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'object') {
    return Object.entries(val)
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
  }
  return String(val);
}

export default function SchoolAuditLogs() {
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('ederp_theme') === 'dark');
  useEffect(() => { localStorage.setItem('ederp_theme', darkMode ? 'dark' : 'light'); }, [darkMode]);

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage] = useState(25);
  
  // Filters
  const [filters, setFilters] = useState({
    module: '',
    submodule: '',
    action: '',
    user_id: '',
    from_date: '',
    to_date: '',
    q: '',
  });
  
  const [exporting, setExporting] = useState(false);
  const [purging, setPurging] = useState(false);
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [purgeDays, setPurgeDays] = useState(180);
  
  const canPurge = usePermission('audit.logs.delete');

  useEffect(() => {
    fetchLogs();
  }, [page, filters]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = {
        page,
        per_page: perPage,
        ...filters,
      };
      // Remove empty filters
      Object.keys(params).forEach(key => {
        if (!params[key]) delete params[key];
      });
      
      const res = await api.get('/audit/school/logs', { params });
      setLogs(res.data.logs || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const handleExport = async () => {
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
      link.setAttribute('download', `audit_log_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert('Failed to export logs');
    } finally {
      setExporting(false);
    }
  };

  const handlePurge = async () => {
    setPurging(true);
    try {
      await api.delete('/audit/school/logs/purge', {
        data: { older_than_days: purgeDays, reason: 'Manual cleanup' },
      });
      alert(`Deleted logs older than ${purgeDays} days`);
      setShowPurgeModal(false);
      fetchLogs();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to purge logs');
    } finally {
      setPurging(false);
    }
  };

  const totalPages = Math.ceil(total / perPage);

  return (
    <div className={`app-shell${darkMode ? ' theme-dark' : ''}`}>
      <Sidebar darkMode={darkMode} />
      <div className="main-content">
        <Navbar title="Audit Logs" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />
        <div className="page-body">
      <div className="page-header">
        <div>
          <h2 className="page-title">Audit Logs</h2>
          <p className="page-subtitle">Complete activity history for your school</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-neutral btn-sm" onClick={handleExport} disabled={exporting}>
            <i className="ti ti-download" /> {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
          {canPurge && (
            <button className="btn btn-danger btn-sm" onClick={() => setShowPurgeModal(true)}>
              <i className="ti ti-trash" /> Purge Old Logs
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 20, background: darkMode ? '#141b2d' : undefined }}>
        <div className="card-body" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: 16 }}>
          <input
            className="form-input"
            placeholder="Search..."
            value={filters.q}
            onChange={(e) => handleFilterChange('q', e.target.value)}
            style={{ flex: 1, minWidth: 150 }}
          />
          <select
            className="form-select"
            value={filters.module}
            onChange={(e) => handleFilterChange('module', e.target.value)}
            style={{ width: 140 }}
          >
            <option value="">All Modules</option>
            <option value="fees">Fees</option>
            <option value="attendance">Attendance</option>
            <option value="student">Student</option>
            <option value="teacher">Teacher</option>
            <option value="exam">Exam</option>
            <option value="hostel">Hostel</option>
            <option value="library">Library</option>
            <option value="rbac">RBAC</option>
            <option value="auth">Auth</option>
          </select>
          <select
            className="form-select"
            value={filters.action}
            onChange={(e) => handleFilterChange('action', e.target.value)}
            style={{ width: 120 }}
          >
            <option value="">All Actions</option>
            <option value="CREATE">Create</option>
            <option value="EDIT">Edit</option>
            <option value="DELETE">Delete</option>
            <option value="LOGIN">Login</option>
            <option value="LOGOUT">Logout</option>
          </select>
          <input
            type="date"
            className="form-input"
            value={filters.from_date}
            onChange={(e) => handleFilterChange('from_date', e.target.value)}
            style={{ width: 150 }}
          />
          <input
            type="date"
            className="form-input"
            value={filters.to_date}
            onChange={(e) => handleFilterChange('to_date', e.target.value)}
            style={{ width: 150 }}
          />
          <button className="btn btn-primary btn-sm" onClick={fetchLogs}>
            <i className="ti ti-search" /> Apply
          </button>
          <button className="btn btn-neutral btn-sm" onClick={() => {
            setFilters({ module: '', submodule: '', action: '', user_id: '', from_date: '', to_date: '', q: '' });
            setPage(1);
          }}>
            <i className="ti ti-x" /> Clear
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="card" style={{ background: darkMode ? '#141b2d' : undefined }}>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User</th>
                <th>Module</th>
                <th>Action</th>
                <th>Details</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40 }}>Loading...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40 }}>No logs found</td></tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id}>
                    <td style={{ fontSize: 12 }}>
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{log.user_name || `User ${log.user_id}`}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{log.role_snapshot}</div>
                    </td>
                    <td>
                      <div>{log.module}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{log.submodule}</div>
                    </td>
                    <td>
                      <span style={{
                        padding: '2px 10px',
                        borderRadius: 20,
                        fontSize: 11,
                        fontWeight: 700,
                        background: log.action === 'CREATE' ? '#dcfce7' : log.action === 'DELETE' ? '#fee2e2' : '#fef3c7',
                        color: log.action === 'CREATE' ? '#16a34a' : log.action === 'DELETE' ? '#dc2626' : '#d97706',
                      }}>
                        {log.action}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, maxWidth: 200 }}>
                      {formatAuditValue(log.old_value) && (
                        <span style={{ color: '#64748b' }}>Old: {formatAuditValue(log.old_value)}</span>
                      )}
                      {formatAuditValue(log.new_value) && (
                        <span style={{ color: '#16a34a' }}> New: {formatAuditValue(log.new_value)}</span>
                      )}
                      {log.remarks && <div style={{ color: '#64748b', fontSize: 11 }}>{log.remarks}</div>}
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {log.ip_address}
                      {log.browser && <div style={{ fontSize: 10, color: '#64748b' }}>{log.browser}</div>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="card-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px' }}>
            <span style={{ fontSize: 12, color: '#64748b' }}>
              {total} records · Page {page} of {totalPages}
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                className="btn btn-neutral btn-sm"
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
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
        )}
      </div>

      {/* Purge Modal */}
      {showPurgeModal && (
        <div className="modal-overlay" onClick={() => setShowPurgeModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400, background: darkMode ? '#141b2d' : undefined }}>
            <div className="modal-header">
              <h3 style={{ color: '#dc2626' }}>⚠️ Purge Old Logs</h3>
              <button className="btn-close" onClick={() => setShowPurgeModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ color: '#64748b', marginBottom: 16 }}>
                This will permanently delete all audit logs older than the specified days.
                <strong style={{ color: '#dc2626', display: 'block', marginTop: 8 }}>
                  This action cannot be undone!
                </strong>
              </p>
              <div className="form-group">
                <label>Delete logs older than (days):</label>
                <input
                  type="number"
                  className="form-input"
                  value={purgeDays}
                  onChange={(e) => setPurgeDays(Math.max(30, parseInt(e.target.value) || 30))}
                  min="30"
                  step="30"
                />
                <small style={{ color: '#64748b' }}>Minimum: 30 days</small>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-neutral" onClick={() => setShowPurgeModal(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handlePurge} disabled={purging}>
                {purging ? 'Purging...' : 'Purge Logs'}
              </button>
            </div>
          </div>
        </div>
      )}
        </div>
      </div>
    </div>
  );
}
