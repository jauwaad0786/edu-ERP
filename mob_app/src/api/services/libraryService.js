import apiClient from '../client';

export const libraryService = {
  async getBooks(params = {}) {
    const queryParams = typeof params === 'string' ? { search: params } : params;
    const { data } = await apiClient.get('/library/books', { params: queryParams });
    return data;
  },

  async issueBook(payload) {
    const { data } = await apiClient.post('/library/issues', payload);
    return data;
  },

  async returnBook(issueId) {
    const { data } = await apiClient.post(`/library/issues/${issueId}/return`);
    return data;
  },

  async getMembers(search = '') {
    const { data } = await apiClient.get('/library/members', { params: { search } });
    return data;
  },
};

export default libraryService;
