// frontend/src/pages/audit/CompanyAuditLogs.jsx
import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api from '../../api/axios';

export default function CompanyAuditLogs() {
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('ederp_theme') === 'dark');
  useEffect(() => { localStorage.setItem('ederp_theme', darkMode ? 'dark' : 'light'); }, [darkMode]);

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage] = useState(25);
  const [filters, setFilters] = useState({
    module: '',
    action: '',
    actor_user_id: '',
    affected_school_id: '',
    from_date: '',
    to_date: '',
  });
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchLogs();
  }, [page, filters]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = { page, per_page: perPage, ...filters };
      Object.keys(params).forEach(key => {
        if (!params[key]) delete params[key];
      });
      
      const res = await api.get('/audit/company/logs', { params });
      setLogs(res.data.logs || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      console.error('Failed to fetch company logs:', err);
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
      
      const res = await api.get('/audit/company/logs/export', {
        params,
        responseType: 'blob',
      });
      
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `company_audit_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert('Failed to export logs');
    } finally {
      setExporting(false);
    }
  };

  const totalPages = Math.ceil(total / perPage);

  return (
    <div className={`app-shell${darkMode ? ' theme-dark' : ''}`}>
      <Sidebar darkMode={darkMode} />
      <div className="main-content">
        <Navbar title="Company Audit Logs" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />
        <div className="page-body">
      <div className="page-header">
        <div>
          <h2 className="page-title">Company Audit Logs</h2>
          <p className="page-subtitle">Platform-wide activity tracking</p>
        </div>
        <button className="btn btn-neutral btn-sm" onClick={handleExport} disabled={exporting}>
          <i className="ti ti-download" /> {exporting ? 'Exporting...' : 'Export CSV'}
        </button>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 20, background: darkMode ? '#141b2d' : undefined }}>
        <div className="card-body" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: 16 }}>
          <select
            className="form-select"
            value={filters.module}
            onChange={(e) => handleFilterChange('module', e.target.value)}
            style={{ width: 140 }}
          >
            <option value="">All Modules</option>
            <option value="auth">Auth</option>
            <option value="user">User Management</option>
            <option value="school">School</option>
            <option value="rbac">RBAC</option>
            <option value="audit">Audit</option>
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
            <option value="PERMISSION_CHANGE">Permission Change</option>
          </select>
          <input
            type="text"
            className="form-input"
            placeholder="Actor ID"
            value={filters.actor_user_id}
            onChange={(e) => handleFilterChange('actor_user_id', e.target.value)}
            style={{ width: 120 }}
          />
          <input
            type="text"
            className="form-input"
            placeholder="School ID"
            value={filters.affected_school_id}
            onChange={(e) => handleFilterChange('affected_school_id', e.target.value)}
            style={{ width: 120 }}
          />
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
            setFilters({ module: '', action: '', actor_user_id: '', affected_school_id: '', from_date: '', to_date: '' });
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
                <th>Actor</th>
                <th>Module</th>
                <th>Action</th>
                <th>Details</th>
                <th>School</th>
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
                    <td style={{ fontSize: 12 }}>{new Date(log.created_at).toLocaleString()}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{log.actor_name || `User ${log.actor_user_id}`}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{log.role_snapshot}</div>
                    </td>
                    <td>{log.module}</td>
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
                      {log.old_value && <span style={{ color: '#64748b' }}>Old: {log.old_value}</span>}
                      {log.new_value && <span style={{ color: '#16a34a' }}> New: {log.new_value}</span>}
                      {log.remarks && <div style={{ color: '#64748b', fontSize: 11 }}>{log.remarks}</div>}
                    </td>
                    <td style={{ fontSize: 12 }}>{log.affected_school_id || 'N/A'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="card-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px' }}>
            <span style={{ fontSize: 12, color: '#64748b' }}>{total} records · Page {page} of {totalPages}</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button className="btn btn-neutral btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button>
              <button className="btn btn-neutral btn-sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
            </div>
          </div>
        )}
      </div>
        </div>
      </div>
    </div>
  );
}
