// frontend/src/components/audit/EntityAuditTimeline.jsx
import React, { useState, useEffect } from 'react';
import api from '../../api/axios';

function formatTimestamp(isoStr) {
  if (!isoStr) return '';
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

function getActionColor(action, status) {
  if (status === 'FAILURE') return { bg: '#fee2e2', text: '#dc2626', border: '#f87171' };
  const act = (action || '').toUpperCase();
  if (act.includes('DELETE') || act.includes('PURGE')) return { bg: '#fee2e2', text: '#dc2626', border: '#fca5a5' };
  if (act.includes('CREATE') || act.includes('ADMIT')) return { bg: '#dcfce7', text: '#16a34a', border: '#86efac' };
  if (act.includes('COLLECT') || act.includes('PAY')) return { bg: '#e0e7ff', text: '#4338ca', border: '#a5b4fc' };
  if (act.includes('ATTENDANCE')) return { bg: '#e0f2fe', text: '#0369a1', border: '#7dd3fc' };
  if (act.includes('MARKS')) return { bg: '#fef3c7', text: '#b45309', border: '#fcd34d' };
  return { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' };
}

export default function EntityAuditTimeline({ entityType, entityId, darkMode = false }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedLogId, setExpandedLogId] = useState(null);

  const fetchTimeline = async () => {
    if (!entityId) return;
    setLoading(true);
    setError(null);
    try {
      const endpoint = entityType === 'student'
        ? `/audit/school/logs/student/${entityId}`
        : `/audit/school/logs/teacher/${entityId}`;
      const res = await api.get(endpoint);
      setLogs(res.data.logs || []);
    } catch (err) {
      console.error('Failed to load audit timeline:', err);
      setError('Failed to load activity history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimeline();
  }, [entityType, entityId]);

  return (
    <div style={{
      background: darkMode ? '#111827' : '#ffffff',
      borderRadius: 12,
      border: `1px solid ${darkMode ? '#374151' : '#e2e8f0'}`,
      padding: 20,
      marginTop: 16
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: darkMode ? '#f3f4f6' : '#1e293b' }}>
            📜 Activity & Audit History
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b' }}>
            Immutable chronological audit log of all changes and events linked to this {entityType}
          </p>
        </div>
        <button
          onClick={fetchTimeline}
          disabled={loading}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            fontSize: 12,
            fontWeight: 600,
            borderRadius: 6,
            border: `1px solid ${darkMode ? '#4b5563' : '#cbd5e1'}`,
            background: darkMode ? '#1f2937' : '#f8fafc',
            color: darkMode ? '#f3f4f6' : '#334155',
            cursor: 'pointer'
          }}
        >
          <i className={`ti ti-refresh ${loading ? 'spin' : ''}`} /> Refresh
        </button>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b', fontSize: 13 }}>
          <i className="ti ti-loader spin" style={{ fontSize: 22, display: 'block', marginBottom: 8 }} />
          Loading audit trail...
        </div>
      )}

      {error && !loading && (
        <div style={{
          padding: 12,
          background: '#fee2e2',
          border: '1px solid #f87171',
          borderRadius: 8,
          color: '#b91c1c',
          fontSize: 13
        }}>
          {error}
        </div>
      )}

      {!loading && !error && logs.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
          <i className="ti ti-history-off" style={{ fontSize: 32, display: 'block', marginBottom: 8 }} />
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>No audit events recorded yet.</p>
          <p style={{ margin: '4px 0 0', fontSize: 11 }}>All future modifications to this record will appear here.</p>
        </div>
      )}

      {!loading && !error && logs.length > 0 && (
        <div style={{ position: 'relative', paddingLeft: 24, borderLeft: `2px solid ${darkMode ? '#374151' : '#e2e8f0'}` }}>
          {logs.map((log) => {
            const colors = getActionColor(log.action, log.status);
            const isExpanded = expandedLogId === log.id;
            const hasDiff = log.changed_fields && Object.keys(log.changed_fields).length > 0;

            return (
              <div key={log.id} style={{ position: 'relative', marginBottom: 24 }}>
                {/* Timeline node */}
                <div style={{
                  position: 'absolute',
                  left: -31,
                  top: 4,
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: colors.text,
                  border: `3px solid ${darkMode ? '#111827' : '#ffffff'}`,
                  boxShadow: `0 0 0 2px ${colors.border}`
                }} />

                {/* Event Card */}
                <div style={{
                  background: darkMode ? '#1f2937' : '#f8fafc',
                  border: `1px solid ${darkMode ? '#374151' : '#e2e8f0'}`,
                  borderRadius: 8,
                  padding: 14
                }}>
                  {/* Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 700,
                        background: colors.bg,
                        color: colors.text,
                        border: `1px solid ${colors.border}`
                      }}>
                        {log.action}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: darkMode ? '#e2e8f0' : '#334155' }}>
                        {log.module}
                      </span>
                      {log.is_delegated && (
                        <span style={{
                          padding: '2px 6px',
                          borderRadius: 4,
                          fontSize: 10,
                          fontWeight: 700,
                          background: '#fef3c7',
                          color: '#b45309',
                          border: '1px solid #fcd34d'
                        }}>
                          ⚡ Delegated Proxy
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', textAlign: 'right' }}>
                      <span title={formatTimestamp(log.created_at)} style={{ cursor: 'help', fontWeight: 600 }}>
                        {timeAgo(log.created_at)}
                      </span>
                      <div style={{ fontSize: 10 }}>{formatTimestamp(log.created_at)}</div>
                    </div>
                  </div>

                  {/* Actor details */}
                  <div style={{ marginTop: 8, fontSize: 12, color: darkMode ? '#cbd5e1' : '#475569' }}>
                    <strong>Actor:</strong> {log.user_name || `User #${log.user_id || 'System'}`}
                    {log.employee_id && <span style={{ color: '#94a3b8' }}> ({log.employee_id})</span>}
                    {log.role_snapshot && (
                      <span style={{
                        marginLeft: 6,
                        fontSize: 10,
                        padding: '1px 5px',
                        background: darkMode ? '#374151' : '#e2e8f0',
                        borderRadius: 4
                      }}>
                        {log.role_snapshot}
                      </span>
                    )}
                  </div>

                  {/* Delegation detail if applicable */}
                  {log.is_delegated && log.delegation_details && (
                    <div style={{
                      marginTop: 6,
                      padding: '6px 10px',
                      background: darkMode ? '#3b2f15' : '#fffbeb',
                      border: '1px solid #fef08a',
                      borderRadius: 6,
                      fontSize: 11,
                      color: darkMode ? '#fef08a' : '#854d0e'
                    }}>
                      ⚡ <strong>Substitute Teacher Action:</strong> Acted on behalf of <em>{log.delegation_details.source_teacher_name}</em>
                      {log.delegation_details.reason && <span> (Reason: {log.delegation_details.reason})</span>}
                    </div>
                  )}

                  {/* Remarks */}
                  {log.remarks && (
                    <div style={{ marginTop: 6, fontSize: 12, color: darkMode ? '#94a3b8' : '#64748b' }}>
                      {log.remarks}
                    </div>
                  )}

                  {/* Diff preview */}
                  {hasDiff && (
                    <div style={{ marginTop: 8 }}>
                      <button
                        onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#3b82f6',
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: 'pointer',
                          padding: 0,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                      >
                        <i className={`ti ti-chevron-${isExpanded ? 'up' : 'down'}`} />
                        {isExpanded ? 'Hide Changed Fields' : `View Changed Fields (${Object.keys(log.changed_fields).length})`}
                      </button>

                      {isExpanded && (
                        <div style={{
                          marginTop: 8,
                          background: darkMode ? '#111827' : '#ffffff',
                          border: `1px solid ${darkMode ? '#374151' : '#e2e8f0'}`,
                          borderRadius: 6,
                          overflow: 'hidden'
                        }}>
                          <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                            <thead>
                              <tr style={{ background: darkMode ? '#1e293b' : '#f1f5f9', borderBottom: `1px solid ${darkMode ? '#374151' : '#e2e8f0'}` }}>
                                <th style={{ padding: '6px 10px', textAlign: 'left' }}>Field</th>
                                <th style={{ padding: '6px 10px', textAlign: 'left', color: '#dc2626' }}>Previous Value</th>
                                <th style={{ padding: '6px 10px', textAlign: 'left', color: '#16a34a' }}>New Value</th>
                              </tr>
                            </thead>
                            <tbody>
                              {Object.entries(log.changed_fields).map(([k, diff]) => (
                                <tr key={k} style={{ borderBottom: `1px solid ${darkMode ? '#1f2937' : '#f1f5f9'}` }}>
                                  <td style={{ padding: '6px 10px', fontWeight: 600, color: darkMode ? '#e2e8f0' : '#334155' }}>{k}</td>
                                  <td style={{ padding: '6px 10px', color: '#dc2626', background: darkMode ? 'rgba(239, 68, 68, 0.1)' : '#fef2f2' }}>
                                    {diff?.old === null || diff?.old === undefined || diff?.old === '' ? '—' : String(diff.old)}
                                  </td>
                                  <td style={{ padding: '6px 10px', color: '#16a34a', background: darkMode ? 'rgba(34, 197, 94, 0.1)' : '#f0fdf4' }}>
                                    {diff?.new === null || diff?.new === undefined || diff?.new === '' ? '—' : String(diff.new)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Client Context footer */}
                  <div style={{ marginTop: 8, paddingTop: 6, borderTop: `1px dashed ${darkMode ? '#374151' : '#e2e8f0'}`, display: 'flex', gap: 12, fontSize: 10, color: '#94a3b8' }}>
                    {log.ip_address && <span>🌐 IP: {log.ip_address}</span>}
                    {log.browser && <span>💻 {log.browser} on {log.os || 'Unknown OS'}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
