// mob_app/src/services/notificationService.js
import client from '../api/client';

export const notificationService = {
  // Fetch user notifications list
  async getNotifications(params = {}) {
    try {
      const res = await client.get('/support/notifications', { params });
      return res.data;
    } catch (err) {
      // Fallback alias
      const res = await client.get('/notifications', { params });
      return res.data;
    }
  },

  // Fetch unread count badge
  async getUnreadCount() {
    try {
      const res = await client.get('/support/notifications/unread-count');
      return Number(res.data?.unread ?? 0);
    } catch (err) {
      return 0;
    }
  },

  // Mark single notification as read
  async markAsRead(notificationId) {
    try {
      const res = await client.patch(`/support/notifications/${notificationId}/read`);
      return res.data;
    } catch (err) {
      return null;
    }
  },

  // Mark all notifications as read
  async markAllAsRead() {
    try {
      const res = await client.post('/support/notifications/read-all');
      return res.data;
    } catch (err) {
      return null;
    }
  },

  // Delete notification
  async deleteNotification(notificationId) {
    try {
      const res = await client.delete(`/support/notifications/${notificationId}`);
      return res.data;
    } catch (err) {
      return null;
    }
  },

  // Register device push token with backend
  async registerDeviceToken(tokenData) {
    try {
      const res = await client.post('/support/notifications/devices/register', tokenData);
      return res.data;
    } catch (err) {
      console.warn('[NotificationService] Device registration error:', err?.message);
      return null;
    }
  },

  // Unregister device push token (on logout)
  async unregisterDeviceToken(deviceToken) {
    try {
      const res = await client.post('/support/notifications/devices/unregister', {
        device_token: deviceToken,
      });
      return res.data;
    } catch (err) {
      return null;
    }
  },
};

export default notificationService;
