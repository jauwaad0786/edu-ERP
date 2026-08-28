import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60)    return 'Just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function fmtTime(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit'
  });
}

export default function ChatWindow() {
  const location  = useLocation();
  const { user }  = useAuth();
  const [darkMode] = useState(() => localStorage.getItem('ederp_theme') === 'dark');

  const [inbox,         setInbox]         = useState([]);
  const [active,        setActive]        = useState(null); // { user_id, name, role }
  const [messages,      setMessages]      = useState([]);
  const [draft,         setDraft]         = useState('');
  const [search,        setSearch]        = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [file,          setFile]          = useState(null);
  const [sending,       setSending]       = useState(false);
  const [loadingConv,   setLoadingConv]   = useState(false);
  const bottomRef = useRef(null);

  const fetchInbox = useCallback(() => {
    api.get('/support/chat/inbox')
      .then(r => setInbox(r.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => { fetchInbox(); }, [fetchInbox]);

  // Handle startChatWith passed via navigation state
  useEffect(() => {
    if (location.state?.startChatWith) {
      const target = location.state.startChatWith;
      openConversation({
        user_id: target.user_id || target.id,
        name: target.name,
        role: target.role
      });
    }
  }, [location.state]);

  const openConversation = useCallback((targetUser) => {
    setActive(targetUser);
    setLoadingConv(true);
    api.get(`/support/chat/conversation/${targetUser.user_id}`, { params: { per_page: 100 } })
      .then(r => {
        setMessages(r.data.data || []);
        fetchInbox();
      })
      .catch(() => {})
      .finally(() => setLoadingConv(false));
  }, [fetchInbox]);

  // Poll conversation periodically (every 5 seconds)
  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => {
      api.get(`/support/chat/conversation/${active.user_id}`, { params: { per_page: 100 } })
        .then(r => setMessages(r.data.data || []))
        .catch(() => {});
      fetchInbox();
    }, 5000);
    return () => clearInterval(interval);
  }, [active, fetchInbox]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const searchUsers = (q) => {
    setSearch(q);
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }
    api.get('/support/chat/users', { params: { search: q.trim() } })
      .then(r => setSearchResults(r.data || []))
      .catch(() => {});
  };

  const send = async () => {
    if (!active) return;
    if (!draft.trim() && !file) return;
    setSending(true);
    try {
      if (file) {
        const fd = new FormData();
        fd.append('receiver_id', active.user_id);
        fd.append('file', file);
        fd.append('caption', draft.trim());
        await api.post('/support/chat/send-file', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        setFile(null);
      } else {
        await api.post('/support/chat', { receiver_id: active.user_id, message: draft.trim() });
      }
      setDraft('');
      // Refresh current conversation & inbox
      const res = await api.get(`/support/chat/conversation/${active.user_id}`, { params: { per_page: 100 } });
      setMessages(res.data.data || []);
      fetchInbox();
    } catch (err) {
      alert(err.response?.data?.error || 'Message could not be sent');
    }
    setSending(false);
  };

  const border  = darkMode ? '#1e293b' : '#e2e8f0';
  const bg      = darkMode ? '#141b2d' : '#ffffff';
  const textPri = darkMode ? '#f1f5f9' : '#0f172a';
  const textSec = darkMode ? '#94a3b8' : '#64748b';

  return (
    <div className={`app-shell${darkMode ? ' theme-dark' : ''}`}>
      <Sidebar darkMode={darkMode} />
      <div className="main-content">
        <Navbar title="Direct Messages" darkMode={darkMode} onToggleDark={() => {}} />
        <div className="page-body" style={{ height: 'calc(100vh - 110px)', padding: '16px 24px' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '320px 1fr', height: '100%',
            border: `1px solid ${border}`, borderRadius: 12, overflow: 'hidden', background: bg,
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
          }}>

            {/* Left Panel: Conversations & Contact Search */}
            <div style={{ borderRight: `1px solid ${border}`, display: 'flex', flexDirection: 'column', background: darkMode ? '#0f172a' : '#f8fafc' }}>
              <div style={{ padding: '14px 16px', borderBottom: `1px solid ${border}` }}>
                <div style={{ position: 'relative' }}>
                  <i className="ti ti-search" style={{ position: 'absolute', left: 12, top: 10, color: textSec, fontSize: 14 }} />
                  <input
                    value={search}
                    onChange={e => searchUsers(e.target.value)}
                    placeholder="Search staff, teachers..."
                    style={{
                      width: '100%', padding: '8px 12px 8px 34px', borderRadius: 8, fontSize: 13,
                      border: `1px solid ${border}`, background: darkMode ? '#1e293b' : '#fff', color: textPri,
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto' }}>
                {/* Search Results / Start New Chat */}
                {search.trim() && searchResults.length > 0 && (
                  <div>
                    <div style={{ padding: '10px 16px 6px', fontSize: 11, color: '#4f46e5', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Contacts Found ({searchResults.length})
                    </div>
                    {searchResults.map(u => (
                      <div
                        key={u.id}
                        onClick={() => {
                          openConversation({ user_id: u.id, name: u.name, role: u.role });
                          setSearch('');
                          setSearchResults([]);
                        }}
                        style={{
                          padding: '10px 16px', cursor: 'pointer', borderBottom: `1px solid ${border}`,
                          display: 'flex', alignItems: 'center', gap: 10, transition: 'background 0.15s'
                        }}
                      >
                        <div style={{
                          width: 34, height: 34, borderRadius: '50%', background: '#4f46e518',
                          color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 700, fontSize: 13, flexShrink: 0
                        }}>
                          {u.name?.charAt(0).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: textPri }}>{u.name}</div>
                          <div style={{ fontSize: 11, color: textSec }}>{u.role}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Existing Conversations Inbox List */}
                {!search.trim() && inbox.length === 0 ? (
                  <div style={{ padding: 32, textAlign: 'center', fontSize: 13, color: textSec }}>
                    <i className="ti ti-messages-off" style={{ fontSize: 28, color: darkMode ? '#475569' : '#cbd5e1', display: 'block', marginBottom: 8 }} />
                    No conversation threads yet.<br />Search a colleague to start chatting.
                  </div>
                ) : !search.trim() && inbox.map(c => {
                  const isSelected = active?.user_id === c.user_id;
                  return (
                    <div
                      key={c.user_id}
                      onClick={() => openConversation(c)}
                      style={{
                        padding: '12px 16px', cursor: 'pointer', borderBottom: `1px solid ${border}`,
                        background: isSelected ? (darkMode ? '#1e293b' : '#eef2ff') : 'transparent',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
                        borderLeft: isSelected ? '3px solid #4f46e5' : '3px solid transparent',
                        transition: 'all 0.15s'
                      }}
                    >
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%',
                        background: isSelected ? '#4f46e5' : (darkMode ? '#334155' : '#e2e8f0'),
                        color: isSelected ? '#fff' : (darkMode ? '#f1f5f9' : '#475569'),
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: 14, flexShrink: 0
                      }}>
                        {c.name?.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                          <div style={{ fontSize: 13, fontWeight: c.unread_count > 0 ? 700 : 600, color: textPri, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {c.name}
                          </div>
                          <span style={{ fontSize: 10, color: textSec, flexShrink: 0 }}>{timeAgo(c.last_time)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ fontSize: 11.5, color: textSec, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {c.last_type === 'IMAGE' ? '📷 Image' : c.last_type === 'PDF' ? '📄 PDF' : c.last_message || 'File attachment'}
                          </div>
                          {c.unread_count > 0 && (
                            <span style={{
                              background: '#4f46e5', color: '#fff', fontSize: 10, fontWeight: 800,
                              borderRadius: 20, padding: '1px 6px', flexShrink: 0
                            }}>
                              {c.unread_count}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Panel: Active Chat Thread */}
            <div style={{ display: 'flex', flexDirection: 'column', background: bg }}>
              {!active ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: textSec, fontSize: 13.5, gap: 10 }}>
                  <div style={{ width: 54, height: 54, borderRadius: '50%', background: darkMode ? '#1e293b' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className="ti ti-message-2" style={{ fontSize: 28, color: '#4f46e5' }} />
                  </div>
                  <div>Select a conversation from the left to start messaging</div>
                </div>
              ) : (
                <>
                  {/* Chat Top Header */}
                  <div style={{ padding: '12px 20px', borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: '50%', background: '#4f46e518',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#4f46e5', fontSize: 15,
                    }}>
                      {active.name?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: 14.5, fontWeight: 700, color: textPri }}>{active.name}</div>
                      <div style={{ fontSize: 11.5, color: textSec }}>{active.role}</div>
                    </div>
                  </div>

                  {/* Messages Bubble Area */}
                  <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {loadingConv && messages.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: 40, color: textSec, fontSize: 13 }}>Loading conversation...</div>
                    ) : messages.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: 40, color: textSec, fontSize: 13 }}>
                        No messages exchanged yet. Send a message to start the conversation!
                      </div>
                    ) : messages.map(m => {
                      const mine = m.sender_id === user?.id || m.sender_id !== active.user_id;
                      return (
                        <div key={m.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                          <div style={{
                            maxWidth: '68%', padding: '10px 14px', borderRadius: 14, fontSize: 13.5,
                            background: mine ? '#4f46e5' : (darkMode ? '#1e293b' : '#f1f5f9'),
                            color: mine ? '#ffffff' : textPri,
                            boxShadow: '0 2px 4px rgba(0,0,0,0.04)',
                            borderBottomRightRadius: mine ? 2 : 14,
                            borderBottomLeftRadius: mine ? 14 : 2,
                          }}>
                            {m.file_url ? (
                              <div style={{ marginBottom: 6 }}>
                                {m.message_type === 'IMAGE' ? (
                                  <img src={m.file_url} alt="attachment" style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 8, display: 'block', marginBottom: 6 }} />
                                ) : null}
                                <a href={m.file_url} target="_blank" rel="noreferrer" style={{
                                  color: mine ? '#e0e7ff' : '#4f46e5', display: 'inline-flex', alignItems: 'center', gap: 6,
                                  fontWeight: 600, textDecoration: 'none', background: mine ? 'rgba(255,255,255,0.15)' : 'rgba(79,70,229,0.1)',
                                  padding: '4px 8px', borderRadius: 6
                                }}>
                                  <i className="ti ti-paperclip" style={{ fontSize: 14 }} aria-hidden="true" /> {m.file_name || 'View Attachment'}
                                </a>
                              </div>
                            ) : null}
                            <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{m.message}</div>
                            <div style={{ fontSize: 10, opacity: 0.75, marginTop: 4, textAlign: 'right' }}>
                              {fmtTime(m.created_at)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={bottomRef} />
                  </div>

                  {/* Message Input Bar */}
                  <div style={{ padding: '12px 16px', borderTop: `1px solid ${border}`, display: 'flex', gap: 10, alignItems: 'center' }}>
                    <label style={{ cursor: 'pointer', color: textSec, padding: '6px 8px', borderRadius: 6, background: darkMode ? '#1e293b' : '#f1f5f9' }} title="Attach file">
                      <i className="ti ti-paperclip" style={{ fontSize: 18 }} aria-hidden="true" />
                      <input type="file" hidden onChange={e => setFile(e.target.files?.[0] || null)} />
                    </label>

                    <input
                      value={draft}
                      onChange={e => setDraft(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) send(); }}
                      placeholder={file ? `Attached: ${file.name}` : 'Write a message...'}
                      style={{
                        flex: 1, padding: '10px 16px', borderRadius: 24, fontSize: 13,
                        border: `1px solid ${border}`, background: darkMode ? '#0f172a' : '#f8fafc', color: textPri,
                        outline: 'none'
                      }}
                    />

                    {file && (
                      <button onClick={() => setFile(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 12 }}>
                        <i className="ti ti-x" />
                      </button>
                    )}

                    <button
                      onClick={send}
                      disabled={sending || (!draft.trim() && !file)}
                      style={{
                        width: 40, height: 40, borderRadius: '50%', border: 'none',
                        background: '#4f46e5', color: '#fff', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        opacity: sending || (!draft.trim() && !file) ? 0.6 : 1
                      }}
                    >
                      <i className="ti ti-send" style={{ fontSize: 16 }} aria-hidden="true" />
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .theme-dark { background: #0b1220; }
        .theme-dark .main-content { background: #0b1220; }
      `}</style>
    </div>
  );
}
