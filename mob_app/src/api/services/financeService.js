import apiClient from '../client';

export const financeService = {
  async getFeeHeads() {
    const { data } = await apiClient.get('/finance/fee-heads');
    return data;
  },

  async getStudentFeeOverview(studentId) {
    const { data } = await apiClient.get(`/finance/students/${studentId}/fee-overview`);
    return data;
  },

  async collectFee(payload) {
    const { data } = await apiClient.post('/finance/collect-fee', payload);
    return data;
  },

  async getExpenses(page = 1) {
    const { data } = await apiClient.get('/finance/expenses', { params: { page } });
    return data;
  },

  async addExpense(payload) {
    const { data } = await apiClient.post('/finance/expenses', payload);
    return data;
  },

  async getFinanceSummary() {
    try {
      const { data } = await apiClient.get('/principal/fees/stats');
      return data;
    } catch {
      return { total_collected: 0, total_pending: 0 };
    }
  },

  async getFeePayments(params = {}) {
    try {
      const { data } = await apiClient.get('/finance/payments', { params });
      return data;
    } catch {
      return [];
    }
  },
};

export default financeService;
