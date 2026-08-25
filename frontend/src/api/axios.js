import axios from 'axios';

const rawBase = process.env.REACT_APP_API_URL || 'https://edu-erp-backend-xoas.onrender.com';
const cleanBase = rawBase.endsWith('/') ? rawBase.slice(0, -1) : rawBase;

const api = axios.create({
  baseURL: cleanBase.endsWith('/api') ? cleanBase : `${cleanBase}/api`,
  headers: { 'Content-Type': 'application/json' }
});

// Attach JWT token to every request
api.interceptors.request.use(config => {
  const token = localStorage.getItem('access_token');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

// Auto-refresh on 401
// Auto-refresh on 401 + feature-locked handling
api.interceptors.response.use(
  res => res,
  async err => {
    const originalReq = err.config;

    // ── Locked feature (403 from feature_required decorator) ──
    if (err.response?.status === 403 && err.response?.data?.error === 'feature_locked') {
      window.dispatchEvent(new CustomEvent('feature-locked', {
        detail: {
          feature: err.response.data.feature,
          message: err.response.data.message,
        }
      }));
      return Promise.reject(err);
    }

    const skipRefresh = originalReq.url?.includes('/auth/login')
      || originalReq.url?.includes('/auth/student-login')
      || originalReq.url?.includes('/auth/refresh');
    
    if (err.response?.status === 401 && !originalReq._retry && !skipRefresh) {
      originalReq._retry = true;

      try {
        const refresh = localStorage.getItem('refresh_token');
        if (!refresh) throw new Error('No refresh token');

        const refreshBase = cleanBase.endsWith('/api') ? cleanBase : `${cleanBase}/api`;
        const { data } = await axios.post(
          `${refreshBase}/auth/refresh`,
          {},
          {
            headers: {
              Authorization: `Bearer ${refresh}`
            }
          }
        );

        localStorage.setItem('access_token', data.access_token);

        originalReq.headers.Authorization =
          `Bearer ${data.access_token}`;

        return api(originalReq);

      } catch {
        localStorage.clear();
        window.location.href = '/login';
      }
    }

    return Promise.reject(err);
  }
);

export default api;

