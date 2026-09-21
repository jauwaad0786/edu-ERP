import apiClient from '../client';

export const communicationService = {
  async getNotifications() {
    const { data } = await apiClient.get('/notifications');
    return Array.isArray(data) ? data : (data?.notifications || []);
  },

  async getAnnouncements() {
    const { data } = await apiClient.get('/support/announcements');
    return data;
  },

  async getTickets() {
    const { data } = await apiClient.get('/support/tickets');
    return data;
  },

  async createTicket(payload) {
    const { data } = await apiClient.post('/support/tickets', payload);
    return data;
  },
};

export default communicationService;
