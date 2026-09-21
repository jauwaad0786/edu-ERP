import axios from 'axios';
import { getApiBaseUrl } from './config';
import { storage } from '../auth/storage';

const apiClient = axios.create({
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  timeout: 30000,
});

// Dynamic BaseURL before each request
apiClient.interceptors.request.use(async (config) => {
  config.baseURL = getApiBaseUrl();
  const token = await storage.get('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-refresh token on 401
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    const isAuthRoute = originalRequest?.url?.includes('/auth/login') ||
                        originalRequest?.url?.includes('/auth/student-login') ||
                        originalRequest?.url?.includes('/auth/refresh');

    if (error.response?.status === 401 && !originalRequest?._retry && !isAuthRoute) {
      originalRequest._retry = true;
      try {
        const refreshToken = await storage.get('refresh_token');
        if (!refreshToken) throw new Error('No refresh token available');

        const refreshBase = getApiBaseUrl();
        const { data } = await axios.post(
          `${refreshBase}/auth/refresh`,
          {},
          { headers: { Authorization: `Bearer ${refreshToken}` } }
        );

        if (data?.access_token) {
          await storage.set('access_token', data.access_token);
          originalRequest.headers.Authorization = `Bearer ${data.access_token}`;
          return apiClient(originalRequest);
        }
      } catch (refreshErr) {
        await storage.clear();
        window.dispatchEvent(new CustomEvent('auth-logout'));
        return Promise.reject(refreshErr);
      }
    }

    // Format readable error message
    let readableMessage = 'An unexpected error occurred. Please try again.';
    if (!error.response) {
      readableMessage = 'Network error. Please check your internet connection.';
    } else if (error.response.data?.error) {
      readableMessage = typeof error.response.data.error === 'string'
        ? error.response.data.error
        : JSON.stringify(error.response.data.error);
    } else if (error.response.data?.message) {
      readableMessage = error.response.data.message;
    } else if (error.response.status === 403) {
      readableMessage = 'Access denied. You do not have permission for this module.';
    } else if (error.response.status === 404) {
      readableMessage = 'Requested record not found.';
    } else if (error.response.status >= 500) {
      readableMessage = 'Server error. School systems are temporarily processing requests.';
    }

    error.readableMessage = readableMessage;
    return Promise.reject(error);
  }
);

export default apiClient;
