// frontend/src/pages/developer/ErrorDashboard.jsx
// frontend/src/pages/developer/ErrorDashboard.jsx
import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { usePermission } from '../../hooks/usePermission';

// Mirrors backend/app/models/developer_center.py exactly — assign_error()
// 400s if these don't match (case-sensitive).
const ASSIGNMENT_TEAMS = ['BACKEND', 'FRONTEND', 'QA', 'DEVOPS'];
const PRIORITY_LEVELS  = ['P0_CRITICAL', 'P1_HIGH', 'P2_MEDIUM', 'P3_LOW'];

export default function ErrorDashboard({ darkMode }) {
  const [errors, setErrors] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [perPage] = useState(20);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({
    status: '',
    severity: '',
    error_type: '',
    school_id: '',
  });
  const [selectedError, setSelectedError] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const canAssign = usePermission('developer.manage');

  useEffect(() => {
    fetchStats();
    fetchErrors();
  }, [page, filters]);

  const fetchStats = async () => {
    try {
      // Backend route is /errors/summary, not /errors/stats — this 404'd
      // every time, which is why the stat cards always showed blank.
      const res = await api.get('/developer/errors/summary');
      setStats(res.data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  const fetchErrors = async () => {
    setLoading(true);
    try {
      const params = { page, per_page: perPage, ...filters };
      Object.keys(params).forEach(key => {
        if (!params[key]) delete params[key];
      });
      
      const res = await api.get('/developer/errors', { params });
      setErrors(res.data.errors || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      console.error('Failed to fetch errors:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async errorId => {
    const team = prompt(`Assign to team (${ASSIGNMENT_TEAMS.join(' / ')}):`, 'BACKEND');
    if (!team) return;
    const normalizedTeam = team.trim().toUpperCase();
    if (!ASSIGNMENT_TEAMS.includes(normalizedTeam)) {
      alert(`Invalid team — must be one of: ${ASSIGNMENT_TEAMS.join(', ')}`);
      return;
    }

    const priority = prompt(`Priority (${PRIORITY_LEVELS.join(' / ')}):`, 'P2_MEDIUM');
    if (!priority) return;
    const normalizedPriority = priority.trim().toUpperCase();
    if (!PRIORITY_LEVELS.includes(normalizedPriority)) {
      alert(`Invalid priority — must be one of: ${PRIORITY_LEVELS.join(', ')}`);
      return;
    }

    setAssigning(true);
    try {
      // Field names must match assign_error()'s body exactly — this was
      // previously sending { assigned_to: 'backend' }, which the backend
      // silently ignored (unknown key), so nothing ever actually saved.
      await api.post(`/developer/errors/${errorId}/assign`, {
        assigned_team: normalizedTeam,
        priority: normalizedPriority,
      });
      fetchErrors();
      fetchStats();
      alert('Error assigned successfully');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to assign error');
    } finally {
      setAssigning(false);
    }
  };

  const handleResolve = async (errorId) => {
    const note = prompt('Resolution note:');
    if (note === null) return;
    try {
      await api.post(`/developer/errors/${errorId}/resolve`, { resolution_note: note });
      fetchErrors();
      fetchStats();
      alert('Error resolved!');
    } catch (err) {
      alert('Failed to resolve error');
    }
  };

  const getSeverityColor = (severity) => {
    const colors = {
      CRITICAL: '#dc2626',
      HIGH: '#d97706',
      MEDIUM: '#f59e0b',
      LOW: '#3b82f6',
    };
    return colors[severity] || '#64748b';
  };

  const getStatusColor = (status) => {
    const colors = {
      NEW: '#dc2626',
      ASSIGNED: '#d97706',
      IN_PROGRESS: '#3b82f6',
      TESTING: '#8b5cf6',
      RESOLVED: '#16a34a',
      CLOSED: '#64748b',
    };
    return colors[status] || '#64748b';
  };

  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2 className="page-title">Error Dashboard</h2>
          <p className="page-subtitle">Monitor and manage application errors</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid-4 mb-6">
        <div className="stat-card" style={{ background: darkMode ? '#141b2d' : undefined }}>
          <div className="stat-label">Open Errors</div>
          <div className="stat-value" style={{ color: '#dc2626' }}>{stats?.open || 0}</div>
        </div>
        <div className="stat-card" style={{ background: darkMode ? '#141b2d' : undefined }}>
          <div className="stat-label">Resolved Today</div>
          <div className="stat-value" style={{ color: '#16a34a' }}>{stats?.resolved_today || 0}</div>
        </div>
        <div className="stat-card" style={{ background: darkMode ? '#141b2d' : undefined }}>
          <div className="stat-label">Critical</div>
          <div className="stat-value" style={{ color: '#dc2626' }}>{stats?.critical || 0}</div>
        </div>
        <div className="stat-card" style={{ background: darkMode ? '#141b2d' : undefined }}>
          <div className="stat-label">Recent Errors</div>
          <div className="stat-value" style={{ color: '#3b82f6' }}>{stats?.recent || 0}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 20, background: darkMode ? '#141b2d' : undefined }}>
        <div className="card-body" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: 16 }}>
          <select
            className="form-select"
            value={filters.status}
            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
            style={{ width: 140 }}
          >
            <option value="">All Status</option>
            <option value="NEW">New</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="TESTING">Testing</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
          </select>
          <select
            className="form-select"
            value={filters.severity}
            onChange={(e) => setFilters(prev => ({ ...prev, severity: e.target.value }))}
            style={{ width: 120 }}
          >
            <option value="">All Severity</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
          <select
            className="form-select"
            value={filters.error_type}
            onChange={(e) => setFilters(prev => ({ ...prev, error_type: e.target.value }))}
            style={{ width: 140 }}
          >
            <option value="">All Types</option>
            <option value="SQL">SQL</option>
            <option value="VALIDATION">Validation</option>
            <option value="EXTERNAL_API">External API</option>
            <option value="PAYMENT">Payment</option>
            <option value="OTP">OTP</option>
            <option value="WHATSAPP">WhatsApp</option>
            <option value="UNKNOWN">Unknown</option>
          </select>
          <button className="btn btn-primary btn-sm" onClick={fetchErrors}>
            <i className="ti ti-search" /> Apply
          </button>
          <button className="btn btn-neutral btn-sm" onClick={() => {
            setFilters({ status: '', severity: '', error_type: '', school_id: '' });
            setPage(1);
          }}>
            <i className="ti ti-x" /> Clear
          </button>
        </div>
      </div>

      {/* Errors List */}
      <div className="card" style={{ background: darkMode ? '#141b2d' : undefined }}>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Error</th>
                <th>Type</th>
                <th>Severity</th>
                <th>Status</th>
                <th>School</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40 }}>Loading...</td></tr>
              ) : errors.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40 }}>
                  <i className="ti ti-circle-check" style={{ fontSize: 40, color: '#16a34a', display: 'block', marginBottom: 8 }} />
                  No errors found — Everything is healthy!
                </td></tr>
              ) : (
                errors.map(error => (
                  <tr key={error.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{error.exception_type}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>
                        {error.module} · {error.api_endpoint}
                      </div>
                    </td>
                    <td>
                      <span style={{
                        padding: '2px 10px',
                        borderRadius: 20,
                        fontSize: 11,
                        fontWeight: 700,
                        background: '#f1f5f9',
                        color: '#64748b',
                      }}>
                        {error.error_type}
                      </span>
                    </td>
                    <td>
                      <span style={{
                        padding: '2px 10px',
                        borderRadius: 20,
                        fontSize: 11,
                        fontWeight: 700,
                        background: error.severity === 'CRITICAL' ? '#fee2e2' : error.severity === 'HIGH' ? '#fef3c7' : '#f1f5f9',
                        color: getSeverityColor(error.severity),
                      }}>
                        {error.severity}
                      </span>
                    </td>
                    <td>
                      <span style={{
                        padding: '2px 10px',
                        borderRadius: 20,
                        fontSize: 11,
                        fontWeight: 700,
                        background: error.status === 'NEW' ? '#fee2e2' : error.status === 'RESOLVED' ? '#dcfce7' : '#f1f5f9',
                        color: getStatusColor(error.status),
                      }}>
                        {error.status}
                      </span>
                    </td>
                    <td style={{ fontSize: 12 }}>{error.school_name || `School ${error.school_id}`}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        <button
                          className="btn btn-neutral btn-sm"
                          onClick={() => {
                            setSelectedError(error);
                            setShowDetail(true);
                          }}
                        >
                          <i className="ti ti-eye" />
                        </button>
                        {canAssign && error.status !== 'RESOLVED' && error.status !== 'CLOSED' && (
                          <>
                            <button
                              className="btn btn-neutral btn-sm"
                              onClick={() => handleAssign(error.id)}
                              disabled={assigning}
                            >
                              <i className="ti ti-user-check" /> Assign
                            </button>
                            <button
                              className="btn btn-success btn-sm"
                              onClick={() => handleResolve(error.id)}
                            >
                              <i className="ti ti-check" /> Resolve
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="card-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px' }}>
            <span style={{ fontSize: 12, color: '#64748b' }}>{total} errors · Page {page} of {totalPages}</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button className="btn btn-neutral btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button>
              <button className="btn btn-neutral btn-sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Error Detail Modal */}
      {showDetail && selectedError && (
        <div className="modal-overlay" onClick={() => setShowDetail(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600, background: darkMode ? '#141b2d' : undefined }}>
            <div className="modal-header">
              <h3>Error Details</h3>
              <button className="btn-close" onClick={() => setShowDetail(false)}>×</button>
            </div>
            <div className="modal-body" style={{ maxHeight: 500, overflowY: 'auto' }}>
              <div style={{ display: 'grid', gap: 12 }}>
                <div><strong>Type:</strong> {selectedError.exception_type}</div>
                <div><strong>Message:</strong> {selectedError.exception_message}</div>
                <div><strong>Module:</strong> {selectedError.module}</div>
                <div><strong>API:</strong> {selectedError.api_endpoint}</div>
                <div><strong>Method:</strong> {selectedError.http_method}</div>
                <div><strong>School:</strong> {selectedError.school_name || `School ${selectedError.school_id}`}</div>
                <div><strong>User:</strong> {selectedError.user_name || `User ${selectedError.user_id}`}</div>
                <div><strong>IP:</strong> {selectedError.ip_address}</div>
                <div><strong>Browser:</strong> {selectedError.browser}</div>
                <div><strong>OS:</strong> {selectedError.os}</div>
                <div>
                  <strong>Stack Trace:</strong>
                  <pre style={{
                    background: darkMode ? '#0f172a' : '#f1f5f9',
                    padding: 12,
                    borderRadius: 6,
                    fontSize: 11,
                    maxHeight: 200,
                    overflow: 'auto',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                  }}>
                    {selectedError.stack_trace}
                  </pre>
                </div>
                {selectedError.payload && (
                  <div>
                    <strong>Payload:</strong>
                    <pre style={{
                      background: darkMode ? '#0f172a' : '#f1f5f9',
                      padding: 12,
                      borderRadius: 6,
                      fontSize: 11,
                      maxHeight: 200,
                      overflow: 'auto',
                    }}>
                      {selectedError.payload}
                    </pre>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-neutral" onClick={() => setShowDetail(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
