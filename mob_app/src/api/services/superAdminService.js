import apiClient from '../client';

export const superAdminService = {
  async getStats() {
    const { data } = await apiClient.get('/admin/stats');
    return data;
  },

  async getSchools(page = 1, search = '') {
    const { data } = await apiClient.get('/admin/schools', {
      params: { page, search }
    });
    return data;
  },

  async onboardSchool(payload) {
    const { data } = await apiClient.post('/admin/schools/onboard', payload);
    return data;
  },

  async getUsers(page = 1, role = '') {
    const params = { page };
    if (role) params.role = role;
    const { data } = await apiClient.get('/admin/users', { params });
    return data;
  },

  async getFeatureCatalog() {
    const { data } = await apiClient.get('/admin/features/catalog');
    return data;
  },
};

export default superAdminService;
