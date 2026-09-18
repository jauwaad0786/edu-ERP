import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api/axios';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const [unreadTickets,  setUnreadTickets]  = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [loading,        setLoading]        = useState(false);

  const fetchCounts = useCallback(async () => {
  const token = localStorage.getItem('access_token');
  if (!token) return;                          // token nahi → skip
  try {
    const [notifRes, chatRes] = await Promise.all([
      api.get('/support/notifications/unread-count'),
      api.get('/support/chat/unread-count'),
    ]);
    // ✅ Sirf number extract karo — object kabhi set mat karo
    const notifCount = Number(notifRes.data?.unread ?? 0);
    const chatCount  = Number(chatRes.data?.unread  ?? 0);
    setUnreadTickets(Number.isNaN(notifCount)  ? 0 : notifCount);
    setUnreadMessages(Number.isNaN(chatCount) ? 0 : chatCount);
  } catch (err) {
    // ✅ 401 pe interval band karo — infinite loop rokne ke liye
    if (err?.response?.status === 401) {
      setUnreadTickets(0);
      setUnreadMessages(0);
    }
    // baaki errors silently ignore
  }
}, []);

useEffect(() => {
  // ✅ Token check karke hi interval start karo
  const token = localStorage.getItem('access_token');
  if (!token) return;

  fetchCounts();
  const interval = setInterval(() => {
    // ✅ Har tick pe bhi token check — logout ke baad interval rok do
    const t = localStorage.getItem('access_token');
    if (t) fetchCounts();
  }, 30000);
  return () => clearInterval(interval);
}, [fetchCounts]);
    // Only fetch if logged in
    

  // Manual refresh — kisi bhi component se call kar sako
  const refresh = useCallback(() => {
    fetchCounts();
  }, [fetchCounts]);

  // Badge string — "99+" agar 99 se zyada
  const ticketBadge  = unreadTickets  > 99 ? '99+' : String(unreadTickets  || '');
  const messageBadge = unreadMessages > 99 ? '99+' : String(unreadMessages || '');
  const totalUnread  = unreadTickets + unreadMessages;
  const totalBadge   = totalUnread   > 99 ? '99+' : String(totalUnread   || '');

  return (
    <NotificationContext.Provider value={{
      unreadTickets,
      unreadMessages,
      totalUnread,
      ticketBadge,
      messageBadge,
      totalBadge,
      loading,
      refresh,
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

// Hook — kisi bhi component mein use karo
export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used inside NotificationProvider');
  return ctx;
}

export default NotificationContext;
