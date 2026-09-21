import apiClient from '../client';

export const hostelService = {
  async getHostels() {
    const { data } = await apiClient.get('/hostel/hostels');
    return data;
  },

  async getRooms(hostelId = null) {
    const params = hostelId ? { hostel_id: hostelId } : {};
    const { data } = await apiClient.get('/hostel/rooms', { params });
    return data;
  },

  async getAllocations() {
    const { data } = await apiClient.get('/hostel/allocations');
    return data;
  },

  async getOutings() {
    const { data } = await apiClient.get('/hostel/outings');
    return data;
  },

  async updateOutingStatus(outingId, status) {
    const { data } = await apiClient.put(`/hostel/outings/${outingId}`, { status });
    return data;
  },
};

export default hostelService;
