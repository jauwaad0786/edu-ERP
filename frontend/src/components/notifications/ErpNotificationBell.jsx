import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { resolveTenantPath } from '../../utils/routeBuilder';

const CATEGORY_META = {
  FEES: { icon: 'ti-receipt', color: '#16a34a', bg: '#dcfce7', label: 'Fees' },
  ATTENDANCE: { icon: 'ti-calendar-check', color: '#ea580c', bg: '#ffedd5', label: 'Attendance' },
  EXAMS: { icon: 'ti-notebook', color: '#2563eb', bg: '#dbeafe', label: 'Exams' },
  RESULTS: { icon: 'ti-award', color: '#9333ea', bg: '#f3e8ff', label: 'Results' },
  HOSTEL: { icon: 'ti-building', color: '#d97706', bg: '#fef3c7', label: 'Hostel' },
  TRANSPORT: { icon: 'ti-bus', color: '#0284c7', bg: '#e0f2fe', label: 'Transport' },
  HRMS: { icon: 'ti-briefcase', color: '#4f46e5', bg: '#e0e7ff', label: 'HRMS' },
  COMMUNICATION: { icon: 'ti-speakerphone', color: '#0d9488', bg: '#ccfbf1', label: 'Announcement' },
  GENERAL: { icon: 'ti-bell', color: '#64748b', bg: '#f1f5f9', label: 'General' },
};

function formatRelativeTime(dateStr) {
  if (!dateStr) return '';
  const now = new Date();
  const date = new Date(dateStr);
  const diffSec = Math.floor((now - date) / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

export default function ErpNotificationBell({ darkMode }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('ALL');
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hover, setHover] = useState(false);

  const dropdownRef = useRef(null);

  // Fetch unread count & recent notifications
  const fetchNotifications = useCallback(async () => {
    const token = localStorage.getItem('access_token');
    if (!token) return;

    try {
      const [countRes, listRes] = await Promise.all([
        api.get('/support/notifications/unread-count').catch(() => ({ data: { unread: 0 } })),
        api.get('/support/notifications', { params: { limit: 15 } }).catch(() => ({ data: [] })),
      ]);

      const count = Number(countRes.data?.unread ?? 0);
      setUnreadCount(Number.isNaN(count) ? 0 : count);

      const items = Array.isArray(listRes.data)
        ? listRes.data
        : listRes.data?.notifications || listRes.data?.data || [];
      setNotifications(items);
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const timer = setInterval(() => {
      fetchNotifications();
    }, 35000);
    return () => clearInterval(timer);
  }, [fetchNotifications]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Mark all as read
  const handleMarkAllRead = async () => {
    try {
      await api.post('/support/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true, read: true })));
      setUnreadCount(0);
    } catch {
      // ignore
    }
  };

  // Mark single as read & navigate
  const handleItemClick = async (notif) => {
    if (!notif.is_read && !notif.read) {
      try {
        await api.post(`/support/notifications/${notif.id}/read`);
        setNotifications(prev =>
          prev.map(n => (n.id === notif.id ? { ...n, is_read: true, read: true } : n))
        );
        setUnreadCount(c => Math.max(0, c - 1));
      } catch {
        // ignore
      }
    }

    setIsOpen(false);

    // Deep link or module navigation
    const deepLink = notif.deep_link;
    const cat = (notif.category || '').toUpperCase();

    if (deepLink) {
      navigate(deepLink);
    } else if (cat.includes('FEE')) {
      navigate('/fees');
    } else if (cat.includes('ATTENDANCE')) {
      navigate('/attendance');
    } else if (cat.includes('EXAM')) {
      navigate('/exams');
    } else if (cat.includes('RESULT')) {
      navigate('/results');
    } else if (cat.includes('HOSTEL')) {
      navigate('/hostel');
    } else if (cat.includes('TRANSPORT')) {
      navigate('/transport');
    } else if (cat.includes('HRMS') || cat.includes('PAYROLL')) {
      navigate('/hrms');
    }
  };

  const handleOpenNotificationCenter = () => {
    setIsOpen(false);
    const centerPath = resolveTenantPath(user, '/notifications/center');
    navigate(centerPath || '/notifications/center');
  };

  const filteredNotifications = notifications.filter(n => {
    if (activeTab === 'ALL') return true;
    const cat = (n.category || '').toUpperCase();
    if (activeTab === 'FINANCE') return cat.includes('FEE') || cat.includes('FINANCE');
    if (activeTab === 'ACADEMIC') return cat.includes('ATTENDANCE') || cat.includes('EXAM') || cat.includes('RESULT');
    return cat === activeTab;
  });

  const isLeader = ['PRINCIPAL', 'SUPER_ADMIN', 'VICE_PRINCIPAL', 'ADMIN'].includes(user?.role);

  return (
    <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-flex' }}>
      {/* Bell Button */}
      <button
        type="button"
        title="Institutional Notifications"
        onClick={() => {
          setIsOpen(o => !o);
          if (!isOpen) fetchNotifications();
        }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          position: 'relative',
          width: 36,
          height: 36,
          borderRadius: 9,
          border: isOpen
            ? '1.5px solid #2563eb'
            : `1px solid ${darkMode ? '#1e293b' : '#e8edf3'}`,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: isOpen
            ? (darkMode ? 'rgba(37,99,235,0.18)' : '#eff6ff')
            : hover
              ? (darkMode ? '#1e293b' : '#f1f5f9')
              : (darkMode ? '#0f172a' : '#f8fafc'),
          transition: 'all 0.15s ease',
          outline: 'none',
        }}
      >
        <i
          className="ti ti-bell"
          style={{
            fontSize: 18,
            color: isOpen
              ? '#2563eb'
              : (darkMode ? '#94a3b8' : '#475569'),
          }}
        />

        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -3,
              right: -3,
              minWidth: 17,
              height: 17,
              padding: '0 4px',
              borderRadius: 20,
              background: '#ef4444',
              color: '#ffffff',
              fontSize: 9,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
              border: `2px solid ${darkMode ? '#0f172a' : '#ffffff'}`,
              zIndex: 10,
              boxShadow: '0 2px 4px rgba(239, 68, 68, 0.4)',
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 44,
            right: 0,
            width: 375,
            maxHeight: 520,
            background: darkMode ? '#0f172a' : '#ffffff',
            borderRadius: 14,
            boxShadow: '0 12px 36px rgba(0, 0, 0, 0.22), 0 0 0 1px rgba(0, 0, 0, 0.08)',
            border: `1px solid ${darkMode ? '#1e293b' : '#e2e8f0'}`,
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            animation: 'fadeIn 0.15s ease-out',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '12px 16px',
              borderBottom: `1px solid ${darkMode ? '#1e293b' : '#f1f5f9'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: darkMode ? '#111c33' : '#fafafa',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: darkMode ? '#f8fafc' : '#0f172a' }}>
                Notifications
              </span>
              {unreadCount > 0 && (
                <span
                  style={{
                    background: '#eff6ff',
                    color: '#2563eb',
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '2px 7px',
                    borderRadius: 12,
                    border: '1px solid #bfdbfe',
                  }}
                >
                  {unreadCount} new
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#2563eb',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '4px 6px',
                  borderRadius: 6,
                }}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Category Tabs */}
          <div
            style={{
              display: 'flex',
              gap: 6,
              padding: '8px 12px',
              borderBottom: `1px solid ${darkMode ? '#1e293b' : '#f1f5f9'}`,
              background: darkMode ? '#0b1324' : '#ffffff',
            }}
          >
            {['ALL', 'FINANCE', 'ACADEMIC'].map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '4px 10px',
                  fontSize: 11,
                  fontWeight: 600,
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                  background: activeTab === tab
                    ? '#2563eb'
                    : (darkMode ? '#1e293b' : '#f1f5f9'),
                  color: activeTab === tab ? '#ffffff' : (darkMode ? '#94a3b8' : '#64748b'),
                  transition: 'background 0.15s ease',
                }}
              >
                {tab === 'ALL' ? 'All' : tab === 'FINANCE' ? 'Fees & Pay' : 'Academics'}
              </button>
            ))}
          </div>

          {/* Notification List */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              maxHeight: 360,
            }}
          >
            {filteredNotifications.length === 0 ? (
              <div
                style={{
                  padding: '36px 20px',
                  textAlign: 'center',
                  color: darkMode ? '#64748b' : '#94a3b8',
                }}
              >
                <i className="ti ti-bell-off" style={{ fontSize: 32, marginBottom: 8, display: 'block' }} />
                <div style={{ fontSize: 13, fontWeight: 600, color: darkMode ? '#94a3b8' : '#475569' }}>
                  No notifications
                </div>
                <div style={{ fontSize: 11, marginTop: 4 }}>
                  You're all caught up with your school updates!
                </div>
              </div>
            ) : (
              filteredNotifications.map(notif => {
                const isUnread = !notif.is_read && !notif.read;
                const cat = (notif.category || notif.notif_type || 'GENERAL').toUpperCase();
                const meta = CATEGORY_META[cat] || CATEGORY_META.GENERAL;

                return (
                  <div
                    key={notif.id}
                    onClick={() => handleItemClick(notif)}
                    style={{
                      padding: '12px 16px',
                      display: 'flex',
                      gap: 12,
                      cursor: 'pointer',
                      borderBottom: `1px solid ${darkMode ? '#1e293b' : '#f8fafc'}`,
                      background: isUnread
                        ? (darkMode ? 'rgba(37, 99, 235, 0.08)' : '#f8faff')
                        : 'transparent',
                      transition: 'background 0.15s ease',
                    }}
                  >
                    {/* Icon */}
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 10,
                        background: meta.bg,
                        color: meta.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 16,
                        flexShrink: 0,
                      }}
                    >
                      <i className={`ti ${meta.icon}`} />
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 6,
                          marginBottom: 2,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 12.5,
                            fontWeight: isUnread ? 700 : 600,
                            color: darkMode ? '#f8fafc' : '#0f172a',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {notif.title || notif.subject || 'School Notification'}
                        </span>

                        <span style={{ fontSize: 10, color: darkMode ? '#64748b' : '#94a3b8', flexShrink: 0 }}>
                          {formatRelativeTime(notif.created_at)}
                        </span>
                      </div>

                      <div
                        style={{
                          fontSize: 11.5,
                          lineHeight: 1.4,
                          color: darkMode ? '#94a3b8' : '#475569',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {notif.message || notif.body || notif.content}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <span
                          style={{
                            fontSize: 9.5,
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: 4,
                            background: meta.bg,
                            color: meta.color,
                          }}
                        >
                          {meta.label}
                        </span>

                        {isUnread && (
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              background: '#2563eb',
                            }}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {isLeader && (
            <div
              style={{
                padding: '10px 16px',
                borderTop: `1px solid ${darkMode ? '#1e293b' : '#f1f5f9'}`,
                background: darkMode ? '#111c33' : '#fafafa',
                textAlign: 'center',
              }}
            >
              <button
                type="button"
                onClick={handleOpenNotificationCenter}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#2563eb',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span>Open Notification Center</span>
                <i className="ti ti-arrow-right" style={{ fontSize: 13 }} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
