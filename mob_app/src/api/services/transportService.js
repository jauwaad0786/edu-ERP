import apiClient from '../client';

export const transportService = {
  async getVehicles() {
    const { data } = await apiClient.get('/transport/vehicles');
    return data;
  },

  async getRoutes() {
    const { data } = await apiClient.get('/transport/routes');
    return data;
  },

  async getStops(routeId = null) {
    const params = routeId ? { route_id: routeId } : {};
    const { data } = await apiClient.get('/transport/stops', { params });
    return data;
  },

  async getDriverAssigned() {
    const { data } = await apiClient.get('/transport/driver/assigned');
    return data;
  },

  async getStudentTransport() {
    const { data } = await apiClient.get('/transport/student');
    return data;
  },
};

export default transportService;
