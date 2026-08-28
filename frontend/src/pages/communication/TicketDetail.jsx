import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { StatusBadge, PriorityBadge } from '../../components/communication/StatusBadge';

const STATUS_OPTIONS = ['OPEN', 'PENDING', 'IN_PROGRESS', 'WAITING', 'RESOLVED', 'CLOSED', 'REJECTED'];

function timeAgo(dateStr) {
  if (!dateStr) return '—';
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60)    return 'Just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

export default function TicketDetail() {
  const { id }    = useParams();
  const navigate  = useNavigate();
  const { user }  = useAuth();
  const [darkMode] = useState(() => localStorage.getItem('ederp_theme') === 'dark');
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const [ticket,   setTicket]   = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [reply,    setReply]    = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [sending,  setSending]  = useState(false);
  const [file,     setFile]     = useState(null);
  const [statusUpdating, setStatusUpdating] = useState(false);

  const fetchTicket = useCallback(() => {
    api.get(`/support/tickets/${id}`)
      .then(r => setTicket(r.data))
      .catch((err) => {
        if (err.response?.status === 403) {
          alert('You are not authorized to view this ticket.');
          navigate('/support/tickets');
        }
      })
      .finally(() => setLoading(false));
  }, [id, navigate]);

  useEffect(() => { fetchTicket(); }, [fetchTicket]);

  const sendReply = async () => {
    if (!reply.trim() && !file) return;
    setSending(true);
    try {
      if (reply.trim()) {
        await api.post(`/support/tickets/${id}/reply`, {
          message: reply.trim(),
          is_internal: isSuperAdmin ? isInternal : false
        });
      }
      if (file) {
        const fd = new FormData();
        fd.append('file', file);
        await api.post(`/support/tickets/${id}/attachment`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        setFile(null);
      }
      setReply('');
      setIsInternal(false);
      fetchTicket();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to send reply');
    }
    setSending(false);
  };

  const updateStatus = async (newStatus) => {
    setStatusUpdating(true);
    try {
      await api.patch(`/support/tickets/${id}/status`, { status: newStatus });
      fetchTicket();
    } catch (err) {
      alert(err.response?.data?.error || 'Status update failed');
    }
    setStatusUpdating(false);
  };

  const cardBg = { background: darkMode ? '#141b2d' : '#ffffff', borderColor: darkMode ? '#1e293b' : '#e2e8f0' };
  const border = darkMode ? '#1e293b' : '#e2e8f0';
  const textPri = darkMode ? '#f1f5f9' : '#0f172a';
  const textSec = darkMode ? '#94a3b8' : '#64748b';

  if (loading) {
    return (
      <div className={`app-shell${darkMode ? ' theme-dark' : ''}`}>
        <Sidebar darkMode={darkMode} />
        <div className="main-content">
          <Navbar title="Ticket Detail" darkMode={darkMode} onToggleDark={() => {}} />
          <div className="page-body" style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>Loading ticket details...</div>
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className={`app-shell${darkMode ? ' theme-dark' : ''}`}>
        <Sidebar darkMode={darkMode} />
        <div className="main-content">
          <Navbar title="Ticket Detail" darkMode={darkMode} onToggleDark={() => {}} />
          <div className="page-body" style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>Ticket not found</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`app-shell${darkMode ? ' theme-dark' : ''}`}>
      <Sidebar darkMode={darkMode} />
      <div className="main-content">
        <Navbar title={ticket.ticket_no} darkMode={darkMode} onToggleDark={() => {}} />
        <div className="page-body">

          <button onClick={() => navigate('/support/tickets')} style={{
            background: 'none', border: 'none', cursor: 'pointer', fontSize: 12,
            color: textSec, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <i className="ti ti-arrow-left" style={{ fontSize: 13 }} aria-hidden="true" /> Back to Tickets
          </button>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>

            {/* Main thread */}
            <div>
              {/* Ticket Summary Header */}
              <div className="card" style={{ marginBottom: 16, ...cardBg }}>
                <div style={{ padding: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#4f46e5', fontFamily: 'monospace' }}>{ticket.ticket_no}</span>
                      <h2 style={{ margin: '4px 0 0', fontSize: 18, color: textPri }}>{ticket.subject}</h2>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <PriorityBadge priority={ticket.priority} />
                      <StatusBadge status={ticket.status} />
                    </div>
                  </div>

                  <div style={{ fontSize: 12, color: textSec, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    <span><i className="ti ti-user" style={{ fontSize: 12, marginRight: 4 }} aria-hidden="true" />{ticket.raiser_name} ({ticket.raiser_role})</span>
                    <span><i className="ti ti-building" style={{ fontSize: 12, marginRight: 4 }} aria-hidden="true" />{ticket.school_name || 'System'}</span>
                    {ticket.module_name && <span><i className="ti ti-apps" style={{ fontSize: 12, marginRight: 4 }} aria-hidden="true" />{ticket.module_name}</span>}
                    <span><i className="ti ti-clock" style={{ fontSize: 12, marginRight: 4 }} aria-hidden="true" />{timeAgo(ticket.created_at)}</span>
                  </div>

                  {ticket.description && (
                    <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${border}`, fontSize: 13.5, lineHeight: 1.6, color: darkMode ? '#cbd5e1' : '#334155', whiteSpace: 'pre-wrap' }}>
                      {ticket.description}
                    </div>
                  )}

                  {/* Root attachments */}
                  {(ticket.attachments || []).length > 0 && (
                    <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      {ticket.attachments.map(a => (
                        <a key={a.id} href={a.file_url} target="_blank" rel="noreferrer" style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px',
                          borderRadius: 8, background: darkMode ? '#1e293b' : '#f1f5f9',
                          fontSize: 12, color: '#4f46e5', textDecoration: 'none', border: `1px solid ${border}`
                        }}>
                          <i className="ti ti-paperclip" style={{ fontSize: 13 }} aria-hidden="true" /> {a.file_name || 'Attachment'}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Replies conversation timeline */}
              <div className="card" style={{ ...cardBg }}>
                <div className="card-header" style={{ padding: '12px 18px', borderBottom: `1px solid ${border}` }}>
                  <h4 style={{ margin: 0, fontSize: 13.5, color: textPri }}>
                    <i className="ti ti-messages" style={{ fontSize: 15, marginRight: 6, color: '#4f46e5' }} aria-hidden="true" />
                    Conversation ({ticket.replies?.length || 0})
                  </h4>
                </div>

                <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {(ticket.replies || []).length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 24, fontSize: 12.5, color: textSec }}>
                      No replies yet in this conversation thread.
                    </div>
                  ) : ticket.replies.map(r => (
                    <div key={r.id} style={{
                      padding: '12px 14px', borderRadius: 10,
                      background: r.is_internal
                        ? (darkMode ? 'rgba(217,119,6,0.12)' : '#fffbeb')
                        : (darkMode ? '#0f172a' : '#f8fafc'),
                      border: r.is_internal ? '1px dashed #d97706' : `1px solid ${border}`,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: textPri }}>
                          {r.reply_name} <span style={{ fontWeight: 400, color: textSec }}>· {r.reply_role}</span>
                          {r.is_internal && <span style={{ marginLeft: 6, fontSize: 10, color: '#d97706', fontWeight: 800, padding: '1px 6px', borderRadius: 4, background: 'rgba(217,119,6,0.15)' }}>INTERNAL NOTE</span>}
                        </span>
                        <span style={{ fontSize: 11, color: textSec }}>{timeAgo(r.created_at)}</span>
                      </div>
                      <div style={{ fontSize: 13, color: darkMode ? '#cbd5e1' : '#334155', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{r.message}</div>
                      {(r.attachments || []).map(a => (
                        <a key={a.id} href={a.file_url} target="_blank" rel="noreferrer" style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 8,
                          fontSize: 11.5, color: '#4f46e5', textDecoration: 'none'
                        }}>
                          <i className="ti ti-paperclip" style={{ fontSize: 12 }} aria-hidden="true" /> {a.file_name}
                        </a>
                      ))}
                    </div>
                  ))}
                </div>

                {/* Reply box */}
                {!['CLOSED', 'REJECTED'].includes(ticket.status) && (
                  <div style={{ padding: '14px 18px', borderTop: `1px solid ${border}` }}>
                    <textarea
                      value={reply}
                      onChange={e => setReply(e.target.value)}
                      placeholder="Write your reply or support update here..."
                      style={{
                        width: '100%', minHeight: 85, padding: 10, borderRadius: 8, resize: 'vertical',
                        fontFamily: 'inherit', fontSize: 13,
                        border: `1px solid ${border}`, background: darkMode ? '#0f172a' : '#fff',
                        color: textPri,
                      }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <label style={{ fontSize: 11.5, color: textSec, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                          <i className="ti ti-paperclip" style={{ fontSize: 14 }} aria-hidden="true" />
                          {file ? file.name.slice(0, 20) : 'Attach file'}
                          <input type="file" hidden onChange={e => setFile(e.target.files?.[0] || null)} />
                        </label>
                        {isSuperAdmin && (
                          <label style={{ fontSize: 11.5, color: '#d97706', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                            <input type="checkbox" checked={isInternal} onChange={e => setIsInternal(e.target.checked)} />
                            Internal Staff Note (hidden from client)
                          </label>
                        )}
                      </div>
                      <button className="btn btn-primary btn-sm" disabled={sending || (!reply.trim() && !file)} onClick={sendReply}>
                        {sending ? 'Sending...' : 'Send Reply'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar metadata & actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Metadata Card */}
              <div className="card" style={{ ...cardBg }}>
                <div className="card-header" style={{ padding: '12px 16px', borderBottom: `1px solid ${border}` }}>
                  <h4 style={{ margin: 0, fontSize: 13, color: textPri }}>Ticket Information</h4>
                </div>
                <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12 }}>
                  <div><span style={{ color: textSec }}>Ticket Number:</span> <strong style={{ color: textPri, fontFamily: 'monospace' }}>{ticket.ticket_no}</strong></div>
                  <div><span style={{ color: textSec }}>Category:</span> <strong style={{ color: textPri }}>{ticket.category}</strong></div>
                  <div><span style={{ color: textSec }}>Product:</span> <strong style={{ color: textPri }}>{ticket.product_type}</strong></div>
                  <div><span style={{ color: textSec }}>Created Date:</span> <strong style={{ color: textPri }}>{fmtDate(ticket.created_at)}</strong></div>
                  <div><span style={{ color: textSec }}>Last Updated:</span> <strong style={{ color: textPri }}>{fmtDate(ticket.updated_at)}</strong></div>
                  <div><span style={{ color: textSec }}>Assigned To:</span> <strong style={{ color: textPri }}>{ticket.assigned_to ? `Agent #${ticket.assigned_to}` : 'Unassigned'}</strong></div>
                  {isSuperAdmin && ticket.linked_error_id && (
                    <div style={{ padding: '6px 8px', borderRadius: 6, background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }}>
                      <i className="ti ti-bug" style={{ marginRight: 4 }} /> Linked Error #{ticket.linked_error_id}
                    </div>
                  )}
                </div>
              </div>

              {/* Status / Actions Card */}
              {isSuperAdmin ? (
                <div className="card" style={{ ...cardBg }}>
                  <div className="card-header" style={{ padding: '12px 16px', borderBottom: `1px solid ${border}` }}>
                    <h4 style={{ margin: 0, fontSize: 13, color: textPri }}>Manage Status</h4>
                  </div>
                  <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: textSec, display: 'block', marginBottom: 5 }}>Set Status</label>
                      <select
                        className="form-select"
                        style={{ width: '100%', fontSize: 12.5, padding: '6px 10px', borderRadius: 6, border: `1px solid ${border}`, background: darkMode ? '#0f172a' : '#fff', color: textPri }}
                        value={ticket.status}
                        disabled={statusUpdating}
                        onChange={e => updateStatus(e.target.value)}
                      >
                        {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="card" style={{ ...cardBg }}>
                  <div className="card-header" style={{ padding: '12px 16px', borderBottom: `1px solid ${border}` }}>
                    <h4 style={{ margin: 0, fontSize: 13, color: textPri }}>Ticket Actions</h4>
                  </div>
                  <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {!['CLOSED', 'RESOLVED', 'REJECTED'].includes(ticket.status) && (
                      <button className="btn btn-sm" disabled={statusUpdating} onClick={() => updateStatus('CLOSED')} style={{
                        background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6,
                        padding: '8px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center',
                      }}>
                        <i className="ti ti-x" style={{ fontSize: 14 }} aria-hidden="true" /> Close Ticket
                      </button>
                    )}
                    {['RESOLVED', 'CLOSED'].includes(ticket.status) && (
                      <button className="btn btn-sm" disabled={statusUpdating} onClick={() => updateStatus('OPEN')} style={{
                        background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 6,
                        padding: '8px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center',
                      }}>
                        <i className="ti ti-refresh" style={{ fontSize: 14 }} aria-hidden="true" /> Reopen Ticket
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      <style>{`
        .theme-dark { background: #0b1220; }
        .theme-dark .main-content { background: #0b1220; }
        .theme-dark .card { background: #141b2d !important; border-color: #1e293b !important; }
        .theme-dark .card-header { border-color: #1e293b !important; }
        .theme-dark h2, .theme-dark h4 { color: #f1f5f9 !important; }
      `}</style>
    </div>
  );
}
