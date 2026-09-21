import apiClient from '../client';

export const hrmsService = {
  async getEmployees() {
    const { data } = await apiClient.get('/hrms/employees');
    return data;
  },

  async getLeaves() {
    const { data } = await apiClient.get('/hrms/leaves');
    return data;
  },

  async getMyLeaves() {
    try {
      const { data } = await apiClient.get('/hrms/leaves');
      return data;
    } catch {
      return [];
    }
  },

  async applyLeave(payload) {
    const { data } = await apiClient.post('/hrms/leaves', payload);
    return data;
  },

  async clockIn(lat = null, lng = null) {
    const payload = lat && lng ? { latitude: lat, longitude: lng } : {};
    const { data } = await apiClient.post('/staff-attendance/clock-in', payload);
    return data;
  },

  async clockOut(lat = null, lng = null) {
    const payload = lat && lng ? { latitude: lat, longitude: lng } : {};
    const { data } = await apiClient.post('/staff-attendance/clock-out', payload);
    return data;
  },

  async clockInOut(payload) {
    const { data } = await apiClient.post('/staff-attendance/clock-in', payload);
    return data;
  },

  async getMySalaryRecords() {
    const { data } = await apiClient.get('/auth/me/salary-records');
    return data;
  },
};

export default hrmsService;
