// frontend/src/pages/developer/IssueBoard.jsx
import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api from '../../api/axios';
import { usePermission } from '../../hooks/usePermission';

const STATUSES = ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'TESTING', 'RESOLVED', 'CLOSED'];

export default function IssueBoard() {
  // Self-managed, like every other page (DelegationPage.jsx, etc.) --
  // the darkMode prop App.jsx was passing only read localStorage once at
  // route-mount and never reacted to the theme toggle. This also fixes
  // the real bug: this page never rendered Sidebar/Navbar at all, which
  // is why the sidebar disappeared on this route -- there's no shared
  // layout in this app, every page renders its own.
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('ederp_theme') === 'dark');
  useEffect(() => { localStorage.setItem('ederp_theme', darkMode ? 'dark' : 'light'); }, [darkMode]);

  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [updating, setUpdating] = useState(false);

  const canManage = usePermission('developer.manage');

  useEffect(() => {
    fetchIssues();
  }, []);

  const fetchIssues = async () => {
    setLoading(true);
    try {
      const res = await api.get('/developer/issues');
      setIssues(res.data || []);
    } catch (err) {
      console.error('Failed to fetch issues:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (issueId, newStatus) => {
    setUpdating(true);
    try {
      await api.put(`/developer/issues/${issueId}/status`, { status: newStatus });
      fetchIssues();
    } catch (err) {
      alert('Failed to update issue status');
    } finally {
      setUpdating(false);
    }
  };

  const getIssuesByStatus = (status) => {
    return issues.filter(i => i.status === status);
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

  const getSeverityColor = (severity) => {
    const colors = {
      CRITICAL: '#dc2626',
      HIGH: '#d97706',
      MEDIUM: '#f59e0b',
      LOW: '#3b82f6',
    };
    return colors[severity] || '#64748b';
  };

  if (loading) {
    return (
      <div className={`app-shell${darkMode ? ' theme-dark' : ''}`}>
        <Sidebar darkMode={darkMode} />
        <div className="main-content">
          <Navbar title="Issue Board" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />
          <div className="page-body">
            <div className="loading-spinner">Loading issue board...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`app-shell${darkMode ? ' theme-dark' : ''}`}>
      <Sidebar darkMode={darkMode} />
      <div className="main-content">
        <Navbar title="Issue Board" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />
        <div className="page-body">
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2 className="page-title">Issue Board</h2>
          <p className="page-subtitle">Jira-style kanban board for error tracking</p>
        </div>
        <button className="btn btn-neutral btn-sm" onClick={fetchIssues}>
          <i className="ti ti-refresh" /> Refresh
        </button>
      </div>

      {/* Kanban Board */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${STATUSES.length}, 1fr)`,
        gap: 16,
        overflowX: 'auto',
      }}>
        {STATUSES.map(status => (
          <div
            key={status}
            className="card"
            style={{
              background: darkMode ? '#141b2d' : undefined,
              minWidth: 200,
            }}
          >
            <div style={{
              padding: '12px 16px',
              borderBottom: `3px solid ${getStatusColor(status)}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span style={{ fontWeight: 700, fontSize: 13 }}>
                {status.replace('_', ' ')}
              </span>
              <span style={{
                padding: '2px 8px',
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 700,
                background: darkMode ? '#1e293b' : '#f1f5f9',
                color: '#64748b',
              }}>
                {getIssuesByStatus(status).length}
              </span>
            </div>

            <div style={{ padding: 8, minHeight: 200 }}>
              {getIssuesByStatus(status).length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '20px 8px',
                  fontSize: 12,
                  color: '#64748b',
                }}>
                  No issues
                </div>
              ) : (
                getIssuesByStatus(status).map(issue => (
                  <div
                    key={issue.id}
                    style={{
                      background: darkMode ? '#0f172a' : 'white',
                      border: `1px solid ${darkMode ? '#1e293b' : '#e2e8f0'}`,
                      borderRadius: 8,
                      padding: '12px 14px',
                      marginBottom: 8,
                      cursor: 'pointer',
                      transition: 'box-shadow 0.15s',
                    }}
                    onClick={() => {
                      setSelectedIssue(issue);
                      setShowModal(true);
                    }}
                    onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'}
                    onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                        {issue.exception_type || `Issue #${issue.id}`}
                      </div>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: 20,
                        fontSize: 10,
                        fontWeight: 700,
                        background: getSeverityColor(issue.severity) + '20',
                        color: getSeverityColor(issue.severity),
                      }}>
                        {issue.severity}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>
                      {issue.module} · {issue.api_endpoint}
                    </div>
                    <div style={{ fontSize: 10, color: '#64748b', display: 'flex', gap: 8 }}>
                      <span><i className="ti ti-building-school" /> {issue.school_name || `School ${issue.school_id}`}</span>
                      <span><i className="ti ti-clock" /> {new Date(issue.created_at).toLocaleDateString()}</span>
                    </div>
                    {issue.assigned_to && (
                      <div style={{ fontSize: 10, color: '#3b82f6', marginTop: 4 }}>
                        <i className="ti ti-user" /> Assigned: {issue.assigned_to}
                      </div>
                    )}
                    {canManage && status !== 'CLOSED' && (
                      <div style={{ marginTop: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {STATUSES.filter(s => s !== status).slice(0, 3).map(nextStatus => (
                          <button
                            key={nextStatus}
                            className="btn btn-neutral btn-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              updateStatus(issue.id, nextStatus);
                            }}
                            disabled={updating}
                            style={{ fontSize: 10, padding: '2px 8px' }}
                          >
                            → {nextStatus.replace('_', ' ')}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {showModal && selectedIssue && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600, background: darkMode ? '#141b2d' : undefined }}>
            <div className="modal-header">
              <h3>Issue Details</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <div className="modal-body" style={{ maxHeight: 500, overflowY: 'auto' }}>
              <div style={{ display: 'grid', gap: 12 }}>
                <div><strong>ID:</strong> #{selectedIssue.id}</div>
                <div><strong>Status:</strong>
                  <span style={{
                    padding: '2px 10px',
                    borderRadius: 20,
                    fontSize: 11,
                    fontWeight: 700,
                    marginLeft: 8,
                    background: getStatusColor(selectedIssue.status) + '20',
                    color: getStatusColor(selectedIssue.status),
                  }}>
                    {selectedIssue.status}
                  </span>
                </div>
                <div><strong>Severity:</strong>
                  <span style={{
                    padding: '2px 10px',
                    borderRadius: 20,
                    fontSize: 11,
                    fontWeight: 700,
                    marginLeft: 8,
                    background: getSeverityColor(selectedIssue.severity) + '20',
                    color: getSeverityColor(selectedIssue.severity),
                  }}>
                    {selectedIssue.severity}
                  </span>
                </div>
                <div><strong>Type:</strong> {selectedIssue.exception_type}</div>
                <div><strong>Message:</strong> {selectedIssue.exception_message}</div>
                <div><strong>Module:</strong> {selectedIssue.module}</div>
                <div><strong>API:</strong> {selectedIssue.api_endpoint}</div>
                <div><strong>School:</strong> {selectedIssue.school_name || `School ${selectedIssue.school_id}`}</div>
                <div><strong>User:</strong> {selectedIssue.user_name || `User ${selectedIssue.user_id}`}</div>
                {selectedIssue.assigned_to && (
                  <div><strong>Assigned To:</strong> {selectedIssue.assigned_to}</div>
                )}
                {selectedIssue.resolution_note && (
                  <div>
                    <strong>Resolution Note:</strong>
                    <div style={{
                      background: darkMode ? '#0f172a' : '#f1f5f9',
                      padding: 8,
                      borderRadius: 4,
                      marginTop: 4,
                    }}>
                      {selectedIssue.resolution_note}
                    </div>
                  </div>
                )}
                <div><strong>Created:</strong> {new Date(selectedIssue.created_at).toLocaleString()}</div>
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
                    {selectedIssue.stack_trace}
                  </pre>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              {canManage && selectedIssue.status !== 'CLOSED' && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {STATUSES.filter(s => s !== selectedIssue.status).map(nextStatus => (
                    <button
                      key={nextStatus}
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        updateStatus(selectedIssue.id, nextStatus);
                        setShowModal(false);
                      }}
                      disabled={updating}
                    >
                      Move to {nextStatus.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              )}
              <button className="btn btn-neutral" onClick={() => setShowModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
          </div>
        </div>
      </div>
    </div>
  );
}
