import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { useNotifications } from '../../context/NotificationContext';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TYPE_ICON = {
  TICKET:       { icon: 'ti-ticket',        color: '#4f46e5' },
  CHAT:         { icon: 'ti-message',        color: '#0891b2' },
  MEETING:      { icon: 'ti-calendar-event', color: '#7c3aed' },
  ANNOUNCEMENT: { icon: 'ti-speakerphone',   color: '#16a34a' },
  SYSTEM:       { icon: 'ti-info-circle',    color: '#d97706' },
};

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60)    return 'Just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ─── Tab definitions ──────────────────────────────────────────────────────────
const TABS = [
  { key: 'notifications', icon: 'ti-bell',    label: 'Alerts'   },
  { key: 'quick',         icon: 'ti-apps',    label: 'Support'  },
  { key: 'chat',          icon: 'ti-messages', label: 'Messages' },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SupportPanel({ isOpen, onClose, darkMode, unreadMessages }) {
  const navigate         = useNavigate();
  const { refresh }      = useNotifications();
  const [tab, setTab]    = useState('notifications');
  const [notifs, setNotifs]   = useState([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose();
    }
    if (isOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen, onClose]);

  // Reset to notifications tab on open
  useEffect(() => {
    if (isOpen) setTab('notifications');
  }, [isOpen]);

  // Fetch notifications when Alerts tab is active
  useEffect(() => {
    if (!isOpen || tab !== 'notifications') return;
    setLoading(true);
    api.get('/support/notifications?per_page=15')
      .then(r => setNotifs(r.data?.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isOpen, tab]);

  const markAllRead = async () => {
    await api.patch('/support/notifications/mark-all-read').catch(() => {});
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
    refresh();
  };

  const markRead = async (notif) => {
    if (!notif.is_read) {
      await api.patch(`/support/notifications/${notif.id}/read`).catch(() => {});
      setNotifs(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
      refresh();
    }
    if (notif.ticket_id && notif.notif_type === 'TICKET') {
      navigate(`/support/tickets/${notif.ticket_id}`); onClose();
    } else if (notif.notif_type === 'MEETING') {
      navigate('/support/meetings'); onClose();
    } else if (notif.notif_type === 'ANNOUNCEMENT') {
      navigate('/support/announcements'); onClose();
    }
  };

  // ── Theme tokens ────────────────────────────────────────────────────────────
  const bg      = darkMode ? '#141b2d' : '#ffffff';
  const border  = darkMode ? '#1e293b' : '#e2e8f0';
  const textPri = darkMode ? '#f1f5f9' : '#0f172a';
  const textSec = darkMode ? '#64748b' : '#94a3b8';
  const hoverBg = darkMode ? '#1e2236' : '#f8fafc';
  const tabBg   = darkMode ? '#0f172a' : '#f1f5f9';

  const unreadCount = notifs.filter(n => !n.is_read).length;

  if (!isOpen) return null;

  // ── Quick actions for "Support" tab ─────────────────────────────────────────
  const QUICK_ACTIONS = [
    {
      icon: 'ti-ticket',
      color: '#4f46e5',
      bg: '#eef2ff',
      label: 'Raise a Ticket',
      sub: 'Report an issue or request help',
      onClick: () => { navigate('/support/tickets/new'); onClose(); },
    },
    {
      icon: 'ti-calendar-plus',
      color: '#7c3aed',
      bg: '#f5f3ff',
      label: 'Book a Meeting',
      sub: 'Schedule a call with our team',
      onClick: () => { navigate('/support/meetings/new'); onClose(); },
    },
    {
      icon: 'ti-inbox',
      color: '#0891b2',
      bg: '#ecfeff',
      label: 'My Support Requests',
      sub: 'View all your open tickets',
      onClick: () => { navigate('/support/tickets'); onClose(); },
    },
    {
      icon: 'ti-book',
      color: '#16a34a',
      bg: '#f0fdf4',
      label: 'Help Center',
      sub: 'Browse articles & guides',
      onClick: () => { navigate('/support/help'); onClose(); },
    },
    {
      icon: 'ti-speakerphone',
      color: '#d97706',
      bg: '#fffbeb',
      label: 'Announcements',
      sub: 'Latest updates from your school',
      onClick: () => { navigate('/support/announcements'); onClose(); },
    },
  ];

  return (
    <>
      {/* Invisible backdrop */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 999 }} />

      {/* Panel */}
      <div ref={panelRef} style={{
        position:      'fixed',
        top:           58,
        right:         16,
        width:         380,
        maxHeight:     560,
        background:    bg,
        border:        `1px solid ${border}`,
        borderRadius:  16,
        boxShadow:     '0 16px 48px rgba(0,0,0,0.16)',
        zIndex:        1000,
        display:       'flex',
        flexDirection: 'column',
        overflow:      'hidden',
        animation:     'spSlideIn 0.18s ease',
      }}>

        {/* ── Header ── */}
        <div style={{
          padding:        '14px 16px 0',
          borderBottom:   `1px solid ${border}`,
        }}>
          <div style={{
            display:        'flex',
            justifyContent: 'space-between',
            alignItems:     'center',
            marginBottom:   12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 30, height: 30, borderRadius: 8,
                background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <i className="ti ti-headset" style={{ fontSize: 15, color: '#fff' }} />
              </div>
              <span style={{ fontWeight: 700, fontSize: 14, color: textPri }}>
                Help & Support
              </span>
            </div>
            <button onClick={onClose} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: textSec, fontSize: 18, lineHeight: 1,
              display: 'flex', alignItems: 'center',
            }}>
              <i className="ti ti-x" style={{ fontSize: 16 }} />
            </button>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 2, background: tabBg, borderRadius: 10, padding: 3 }}>
            {TABS.map(t => {
              const isActive = tab === t.key;
              const showBadge = t.key === 'notifications' && unreadCount > 0;
              const showMsgBadge = t.key === 'chat' && Number(unreadMessages) > 0;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  style={{
                    flex:         1,
                    padding:      '6px 4px',
                    borderRadius: 8,
                    border:       'none',
                    cursor:       'pointer',
                    background:   isActive ? bg : 'transparent',
                    color:        isActive ? '#4f46e5' : textSec,
                    fontWeight:   isActive ? 700 : 500,
                    fontSize:     12,
                    transition:   'all 0.15s',
                    display:      'flex',
                    alignItems:   'center',
                    justifyContent: 'center',
                    gap:          5,
                    boxShadow:    isActive ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                    position:     'relative',
                  }}
                >
                  <i className={`ti ${t.icon}`} style={{ fontSize: 14 }} />
                  {t.label}
                  {(showBadge || showMsgBadge) && (
                    <span style={{
                      background: '#ef4444', color: '#fff',
                      fontSize: 9, fontWeight: 800,
                      padding: '0 4px', borderRadius: 20,
                      minWidth: 14, height: 14,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {showBadge ? unreadCount : unreadMessages}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {/* Spacer below tabs */}
          <div style={{ height: 1 }} />
        </div>

        {/* ── Body ── */}
        <div style={{ overflowY: 'auto', flex: 1 }}>

          {/* ── Alerts Tab ── */}
          {tab === 'notifications' && (
            <>
              {/* Mark all read row */}
              {unreadCount > 0 && (
                <div style={{
                  display: 'flex', justifyContent: 'flex-end',
                  padding: '8px 16px 4px',
                }}>
                  <button onClick={markAllRead} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 11, color: '#4f46e5', fontWeight: 600,
                  }}>
                    Mark all as read
                  </button>
                </div>
              )}

              {loading ? (
                <div style={{ padding: 32, textAlign: 'center', color: textSec, fontSize: 13 }}>
                  <i className="ti ti-loader-2" style={{ fontSize: 20, display: 'block', marginBottom: 6 }} />
                  Loading...
                </div>
              ) : notifs.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center' }}>
                  <i className="ti ti-bell-off" style={{ fontSize: 36, color: textSec, display: 'block', marginBottom: 8 }} />
                  <div style={{ color: textSec, fontSize: 13, fontWeight: 500 }}>No alerts yet</div>
                  <div style={{ color: textSec, fontSize: 11, marginTop: 4 }}>
                    Ticket updates and meeting replies will appear here
                  </div>
                </div>
              ) : (
                notifs.map(n => {
                  const cfg = TYPE_ICON[n.notif_type] || TYPE_ICON.SYSTEM;
                  return (
                    <div
                      key={n.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => markRead(n)}
                      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && markRead(n)}
                      style={{
                        display:      'flex',
                        gap:          12,
                        padding:      '12px 16px',
                        cursor:       'pointer',
                        background:   n.is_read ? 'transparent' : (darkMode ? 'rgba(79,70,229,0.07)' : '#f5f3ff'),
                        borderBottom: `1px solid ${border}`,
                        transition:   'background 0.12s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = hoverBg}
                      onMouseLeave={e => e.currentTarget.style.background = n.is_read ? 'transparent' : (darkMode ? 'rgba(79,70,229,0.07)' : '#f5f3ff')}
                    >
                      <div style={{
                        width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                        background: cfg.color + '1a',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <i className={`ti ${cfg.icon}`} style={{ fontSize: 15, color: cfg.color }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 12.5, fontWeight: n.is_read ? 500 : 700,
                          color: textPri, marginBottom: 2,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {n.title}
                        </div>
                        <div style={{
                          fontSize: 11, color: textSec,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {n.message}
                        </div>
                        <div style={{ fontSize: 10, color: textSec, marginTop: 3 }}>
                          {timeAgo(n.created_at)}
                        </div>
                      </div>
                      {!n.is_read && (
                        <div style={{
                          width: 7, height: 7, borderRadius: '50%',
                          background: '#4f46e5', flexShrink: 0, marginTop: 6,
                        }} />
                      )}
                    </div>
                  );
                })
              )}

              {/* View all link */}
              {notifs.length > 0 && (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => { navigate('/support/notifications'); onClose(); }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      navigate('/support/notifications');
                      onClose();
                    }
                  }}
                  style={{
                    padding: '11px 16px', textAlign: 'center',
                    fontSize: 12, color: '#4f46e5', fontWeight: 600,
                    cursor: 'pointer', borderTop: `1px solid ${border}`,
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = hoverBg}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  View all alerts
                  <i className="ti ti-arrow-right" style={{ fontSize: 12, marginLeft: 4 }} />
                </div>
              )}
            </>
          )}

          {/* ── Support Tab ── */}
          {tab === 'quick' && (
            <div style={{ padding: '12px 12px' }}>
              {/* Banner */}
              <div style={{
                background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
                borderRadius: 10, padding: '14px 16px', marginBottom: 10,
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <i className="ti ti-headset" style={{ fontSize: 28, color: 'rgba(255,255,255,0.9)' }} />
                <div>
                  <div style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>
                    Customer Support
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, marginTop: 2 }}>
                    We typically respond within a few hours
                  </div>
                </div>
              </div>

              {/* Quick action cards */}
              {QUICK_ACTIONS.map((action, i) => (
                <div
                  key={i}
                  role="button"
                  tabIndex={0}
                  onClick={action.onClick}
                  onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && action.onClick()}
                  style={{
                    display:       'flex',
                    alignItems:    'center',
                    gap:           12,
                    padding:       '10px 12px',
                    borderRadius:  10,
                    cursor:        'pointer',
                    marginBottom:  6,
                    border:        `1px solid ${border}`,
                    background:    bg,
                    transition:    'all 0.12s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = '#4f46e5';
                    e.currentTarget.style.background  = hoverBg;
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = border;
                    e.currentTarget.style.background  = bg;
                  }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                    background: action.bg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <i className={`ti ${action.icon}`} style={{ fontSize: 17, color: action.color }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: textPri }}>
                      {action.label}
                    </div>
                    <div style={{ fontSize: 11, color: textSec, marginTop: 1 }}>
                      {action.sub}
                    </div>
                  </div>
                  <i className="ti ti-chevron-right" style={{ fontSize: 14, color: textSec }} />
                </div>
              ))}
            </div>
          )}

          {/* ── Messages Tab ── */}
          {tab === 'chat' && (
            <div style={{ padding: '28px 16px', textAlign: 'center' }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: darkMode ? '#1e293b' : '#ecfeff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 12px',
              }}>
                <i className="ti ti-messages" style={{ fontSize: 26, color: '#0891b2' }} />
              </div>
              <div style={{ fontWeight: 700, fontSize: 14, color: textPri, marginBottom: 4 }}>
                Direct Messages
              </div>
              <div style={{ fontSize: 12, color: textSec, marginBottom: 20, lineHeight: 1.5 }}>
                Chat with teachers, staff, or<br />support team directly
              </div>
              <button
                onClick={() => { navigate('/support/chat'); onClose(); }}
                style={{
                  padding: '9px 24px', borderRadius: 9,
                  background: '#0891b2', color: '#fff',
                  border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: 600,
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}
              >
                <i className="ti ti-message-circle" style={{ fontSize: 14 }} />
                Open Messages
              </button>
            </div>
          )}
        </div>

        {/* ── Footer (only on Alerts tab) ── */}
        {tab === 'notifications' && (
          <div style={{
            padding:   '10px 12px',
            borderTop: `1px solid ${border}`,
            display:   'flex',
            gap:       8,
          }}>
            <button
              onClick={() => { navigate('/support/tickets/new'); onClose(); }}
              style={{
                flex: 1, padding: '8px 0', borderRadius: 9,
                background: '#4f46e5', color: '#fff',
                border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              }}
            >
              <i className="ti ti-plus" style={{ fontSize: 13 }} />
              Raise a Ticket
            </button>
            <button
              onClick={() => { navigate('/support/meetings/new'); onClose(); }}
              style={{
                flex: 1, padding: '8px 0', borderRadius: 9,
                background: darkMode ? '#1e293b' : '#f1f5f9',
                color: darkMode ? '#cbd5e1' : '#475569',
                border: `1px solid ${border}`, cursor: 'pointer',
                fontSize: 12, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              }}
            >
              <i className="ti ti-calendar-plus" style={{ fontSize: 13 }} />
              Book Meeting
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spSlideIn {
          from { opacity: 0; transform: translateY(-8px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)   scale(1);    }
        }
      `}</style>
    </>
  );
}
