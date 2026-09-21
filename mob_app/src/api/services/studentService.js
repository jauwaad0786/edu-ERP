import apiClient from '../client';

export const studentService = {
  async getProfile(studentId = null) {
    const params = studentId ? { student_id: studentId } : {};
    const { data } = await apiClient.get('/student/profile', { params });
    return data;
  },

  async getAttendance(studentId = null) {
    const params = studentId ? { student_id: studentId } : {};
    const { data } = await apiClient.get('/student/attendance', { params });
    return data;
  },

  async getMarks(examId = null, studentId = null) {
    const params = {};
    if (examId) params.exam_id = examId;
    if (studentId) params.student_id = studentId;
    const { data } = await apiClient.get('/student/marks', { params });
    return data;
  },

  async getFees(studentId = null) {
    const params = studentId ? { student_id: studentId } : {};
    const { data } = await apiClient.get('/student/fees', { params });
    return data;
  },

  async getLibrary() {
    const { data } = await apiClient.get('/student/library');
    return data;
  },

  async getHostel() {
    const { data } = await apiClient.get('/student/hostel');
    return data;
  },

  async getStudyNotes() {
    const { data } = await apiClient.get('/teacher/notes');
    return data;
  },

  async getInternalMarks() {
    const { data } = await apiClient.get('/student/internal-marks');
    return data;
  },

  async requestGatePass(payload) {
    const { data } = await apiClient.post('/hostel/outings', payload);
    return data;
  },

  async submitComplaint(payload) {
    const { data } = await apiClient.post('/hostel/complaints', payload);
    return data;
  },
};

export default studentService;
