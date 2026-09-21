import apiClient from '../client';

export const teacherService = {
  async getClasses() {
    const { data } = await apiClient.get('/teacher/classes');
    return data;
  },

  async getAttendance(classId, date = '') {
    const params = date ? { date } : {};
    const { data } = await apiClient.get(`/teacher/attendance/${classId}`, { params });
    return data;
  },

  async saveAttendance(classId, date, attendanceList) {
    const { data } = await apiClient.post('/teacher/attendance', {
      class_id: classId,
      date,
      attendance: attendanceList,
    });
    return data;
  },

  async getMarks(classId, examType = 'MID_TERM') {
    const { data } = await apiClient.get(`/teacher/marks/${classId}`, {
      params: { exam_type: examType }
    });
    return data;
  },

  async saveMarks(classId, examType, subjectId, marksList) {
    const { data } = await apiClient.post('/teacher/marks', {
      class_id: classId,
      exam_type: examType,
      subject_id: subjectId,
      marks: marksList,
    });
    return data;
  },

  async getNotes(classId = null) {
    const params = classId ? { class_id: classId } : {};
    const { data } = await apiClient.get('/teacher/notes', { params });
    return data;
  },

  async uploadNote(formData) {
    const { data } = await apiClient.post('/teacher/notes', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return data;
  },

  async getAssignments(classId = null) {
    const params = classId ? { class_id: classId } : {};
    const { data } = await apiClient.get('/assignments', { params });
    return data;
  },

  async createAssignment(payload) {
    const { data } = await apiClient.post('/assignments', payload);
    return data;
  },
};

export default teacherService;
