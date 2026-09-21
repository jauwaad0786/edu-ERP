import apiClient from '../client';

export const principalService = {
  async getDashboard() {
    const { data } = await apiClient.get('/principal/dashboard');
    return data;
  },

  async getStudents(page = 1, search = '', classId = null) {
    const params = { page, search };
    if (classId) params.class_id = classId;
    const { data } = await apiClient.get('/principal/students', { params });
    return data;
  },

  async getTeachers() {
    const { data } = await apiClient.get('/principal/teachers');
    return data;
  },

  async getClasses() {
    const { data } = await apiClient.get('/principal/classes');
    return data;
  },

  async getFeeStats() {
    const { data } = await apiClient.get('/principal/fees/stats');
    return data;
  },

  async getExams() {
    const { data } = await apiClient.get('/principal/exams');
    return data;
  },

  async getHolidays() {
    const { data } = await apiClient.get('/principal/holidays');
    return data;
  },

  async getAttendanceSummary(date = '') {
    const params = date ? { date } : {};
    const { data } = await apiClient.get('/principal/attendance/summary', { params });
    return data;
  },
};

export default principalService;
