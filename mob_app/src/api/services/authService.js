import apiClient from '../client';
import { storage } from '../../auth/storage';

export const authService = {
  async login(identifier, password) {
    const { data } = await apiClient.post('/auth/login', { identifier, password });
    if (data.access_token) {
      await storage.set('access_token', data.access_token);
      if (data.refresh_token) {
        await storage.set('refresh_token', data.refresh_token);
      }
      if (data.user) {
        await storage.set('cached_user', JSON.stringify(data.user));
      }
    }
    return data;
  },

  async studentLogin(phone, name, password, fatherName = '') {
    const payload = { phone, name, password };
    if (fatherName) payload.father_name = fatherName;
    const { data } = await apiClient.post('/auth/student-login', payload);
    if (data.access_token) {
      await storage.set('access_token', data.access_token);
      if (data.refresh_token) {
        await storage.set('refresh_token', data.refresh_token);
      }
      if (data.user) {
        await storage.set('cached_user', JSON.stringify(data.user));
      }
    }
    return data;
  },

  async getMe() {
    const { data } = await apiClient.get('/auth/me');
    if (data) {
      await storage.set('cached_user', JSON.stringify(data));
    }
    return data;
  },

  async changePassword(oldPassword, newPassword) {
    // Handle both object payload or two arguments
    let payload = {};
    if (typeof oldPassword === 'object') {
      payload = oldPassword;
    } else {
      payload = {
        old_password: oldPassword,
        new_password: newPassword,
      };
    }
    const { data } = await apiClient.put('/auth/change-password', payload);
    return data;
  },

  async forgotPassword(identifier) {
    const { data } = await apiClient.post('/auth/forgot-password', { identifier });
    return data;
  },

  async logout() {
    await storage.clear();
  },
};

export default authService;
