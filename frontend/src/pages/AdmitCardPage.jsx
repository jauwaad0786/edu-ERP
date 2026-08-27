import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

// Helper format date
function formatDate(d) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return d;
  }
}

export default function AdmitCardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const isStudentOrParent = user?.role === 'STUDENT' || user?.role === 'PARENT';

  const [exams, setExams] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState('');
  const [loadingExams, setLoadingExams] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [previewStudent, setPreviewStudent] = useState(null);
  const [timetable, setTimetable] = useState([]);
  const [loadingTimetable, setLoadingTimetable] = useState(false);

  // Student specific data
  const [studentProfile, setStudentProfile] = useState(null);
  const [schoolSettings, setSchoolSettings] = useState(null);

  // 1. Load school settings
  useEffect(() => {
    api.get('/principal/school/settings')
      .then(res => setSchoolSettings(res.data))
      .catch(() => {});
  }, []);

  // 2. Load exams
  useEffect(() => {
    async function fetchExams() {
      try {
        setLoadingExams(true);
        if (isStudentOrParent) {
          const [profileRes, examsRes] = await Promise.all([
            api.get('/student/profile').catch(() => null),
            api.get('/principal/exams').catch(() => ({ data: [] }))
          ]);
          if (profileRes?.data) {
            setStudentProfile(profileRes.data);
          }
          const published = (examsRes?.data || []).filter(e => e.status === 'PUBLISHED' || e.is_published);
          setExams(published);
          if (published.length > 0) {
            setSelectedExamId(String(published[0].id));
          }
        } else {
          const res = await api.get('/principal/exams');
          const allExams = res.data || [];
          setExams(allExams);
          // Default to first published exam, or first exam
          const defaultEx = allExams.find(e => e.status === 'PUBLISHED' || e.is_published) || allExams[0];
          if (defaultEx) {
            setSelectedExamId(String(defaultEx.id));
          }
        }
      } catch (err) {
        console.error('Failed to load exams', err);
        toast.error('Failed to load exams list');
      } finally {
        setLoadingExams(false);
      }
    }
    fetchExams();
  }, [isStudentOrParent]);

  // 3. Load classes for admin/teacher
  useEffect(() => {
    if (isStudentOrParent) return;
    async function fetchClasses() {
      try {
        const res = await api.get('/principal/classes');
        setClasses(res.data || []);
      } catch (err) {
        console.error('Failed to load classes', err);
      }
    }
    fetchClasses();
  }, [isStudentOrParent]);

  // 3. Load students when exam or class changes (for admin/teacher)
  const fetchStudents = useCallback(async () => {
    if (isStudentOrParent) return;
    try {
      setLoadingStudents(true);
      const url = selectedClassId
        ? `/principal/students?class_id=${selectedClassId}`
        : '/principal/students';
      const res = await api.get(url);
      const raw = res.data;
      setStudents(Array.isArray(raw) ? raw : (Array.isArray(raw?.data) ? raw.data : []));
    } catch (err) {
      console.error('Failed to load students', err);
      toast.error('Failed to load students');
    } finally {
      setLoadingStudents(false);
    }
  }, [selectedClassId, isStudentOrParent]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const selectedExam = exams.find(e => String(e.id) === String(selectedExamId));

  // 4. Load Timetable when previewing a student
  useEffect(() => {
    if (!previewStudent || !selectedExamId) {
      setTimetable([]);
      return;
    }
    async function fetchTimetable() {
      try {
        setLoadingTimetable(true);
        const classId = previewStudent.class_id || previewStudent.class?.id;
        const res = await api.get(`/principal/exams/${selectedExamId}/timetable${classId ? `?class_id=${classId}` : ''}`);
        setTimetable(res.data || []);
      } catch (err) {
        console.error('Error fetching exam timetable', err);
      } finally {
        setLoadingTimetable(false);
      }
    }
    fetchTimetable();
  }, [previewStudent, selectedExamId]);

  // 5. Download Single Admit Card
  const handleDownload = async (studentId, studentName) => {
    if (!selectedExamId) {
      toast.error('Please select an examination');
      return;
    }
    setDownloadingId(studentId);
    try {
      const res = await api.get(`/principal/admit-card/${studentId}/${selectedExamId}`, {
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const cleanName = (studentName || 'Student').replace(/\s+/g, '_');
      const examName = (selectedExam?.exam_name || 'Exam').replace(/\s+/g, '_');
      link.download = `AdmitCard_${cleanName}_${examName}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success(`Admit card downloaded for ${studentName || 'student'}`);
    } catch (err) {
      console.error('Failed to download admit card', err);
      toast.error('Failed to generate admit card. Make sure the exam is published and datesheet is created.');
    } finally {
      setDownloadingId(null);
    }
  };

  // 6. Bulk Download All Students
  const handleBulkDownload = async () => {
    const targetStudents = filteredStudents;
    if (!targetStudents.length) {
      toast.error('No students to download');
      return;
    }
    if (!selectedExamId) {
      toast.error('Please select an exam first');
      return;
    }
    setBulkDownloading(true);
    let successCount = 0;
    toast.loading(`Starting download of ${targetStudents.length} admit cards...`, { id: 'bulk-dl' });

    for (let i = 0; i < targetStudents.length; i++) {
      const s = targetStudents[i];
      try {
        const res = await api.get(`/principal/admit-card/${s.id}/${selectedExamId}`, {
          responseType: 'blob',
        });
        const blob = new Blob([res.data], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const cleanName = (s.name || `Student_${s.id}`).replace(/\s+/g, '_');
        link.download = `AdmitCard_${cleanName}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        successCount++;
        // slight throttle so browser does not block multiple downloads
        await new Promise(r => setTimeout(r, 400));
      } catch (err) {
        console.error(`Failed to download for student ${s.name}`, err);
      }
    }

    setBulkDownloading(false);
    toast.dismiss('bulk-dl');
    toast.success(`Successfully downloaded ${successCount} of ${targetStudents.length} admit cards!`);
  };

  // Filter students based on search query
  const filteredStudents = students.filter(s => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const nameMatch = (s.name || '').toLowerCase().includes(q);
    const rollMatch = String(s.roll_number || '').toLowerCase().includes(q);
    const admMatch = String(s.admission_number || '').toLowerCase().includes(q);
    const classMatch = String(s.class_name || s.class?.name || '').toLowerCase().includes(q);
    return nameMatch || rollMatch || admMatch || classMatch;
  });

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar title="Admit Card Generator" />
        <div className="page-body">

          {/* Top Banner & Header */}
          <div style={{
            background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 50%, #075985 100%)',
            borderRadius: 16,
            padding: '24px 28px',
            color: '#ffffff',
            marginBottom: 24,
            boxShadow: '0 10px 25px -5px rgba(2, 132, 199, 0.3)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16,
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <div style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  padding: '6px 12px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 700,
                  backdropFilter: 'blur(4px)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}>
                  <i className="ti ti-ticket" /> Official Examination Portal
                </div>
                {selectedExam && (
                  <div style={{
                    background: selectedExam.status === 'PUBLISHED' || selectedExam.is_published ? 'rgba(34, 197, 94, 0.3)' : 'rgba(245, 158, 11, 0.3)',
                    padding: '4px 10px',
                    borderRadius: 20,
                    fontSize: 11,
                    fontWeight: 700,
                    border: '1px solid rgba(255,255,255,0.3)'
                  }}>
                    {selectedExam.status === 'PUBLISHED' || selectedExam.is_published ? '● PUBLISHED' : '● DRAFT'}
                  </div>
                )}
              </div>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}>
                Admit Cards & Hall Tickets
              </h1>
              <p style={{ margin: '6px 0 0', fontSize: 13, opacity: 0.9, maxWidth: 600, lineHeight: 1.5 }}>
                Generate, preview, and download official student admit cards with subject datesheet schedules, roll numbers, and examination instructions.
              </p>
            </div>

            {!isStudentOrParent && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button
                  onClick={() => navigate('/exams')}
                  style={{
                    background: 'rgba(255, 255, 255, 0.15)',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    color: '#fff',
                    padding: '9px 16px',
                    borderRadius: 10,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    backdropFilter: 'blur(8px)',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'}
                >
                  <i className="ti ti-calendar" /> Manage Exams
                </button>
                <button
                  onClick={handleBulkDownload}
                  disabled={bulkDownloading || !filteredStudents.length || !selectedExamId}
                  style={{
                    background: '#ffffff',
                    color: '#0369a1',
                    border: 'none',
                    padding: '10px 18px',
                    borderRadius: 10,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: bulkDownloading || !filteredStudents.length ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    opacity: bulkDownloading || !filteredStudents.length ? 0.7 : 1
                  }}
                >
                  <i className={bulkDownloading ? 'ti ti-loader' : 'ti ti-download'} />
                  {bulkDownloading ? 'Downloading...' : `Download All (${filteredStudents.length})`}
                </button>
              </div>
            )}
          </div>

          {/* Main Controls Card */}
          <div style={{
            background: 'var(--card-bg, #ffffff)',
            borderRadius: 14,
            padding: 20,
            boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
            border: '1px solid var(--border-color, #e2e8f0)',
            marginBottom: 20
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: isStudentOrParent ? '1fr' : 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, alignItems: 'center' }}>
              
              {/* Exam Selector */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 6 }}>
                  Select Examination <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  value={selectedExamId}
                  onChange={e => setSelectedExamId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1.5px solid #cbd5e1',
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#0f172a',
                    background: '#fff',
                    outline: 'none',
                  }}
                >
                  {loadingExams ? (
                    <option value="">Loading examinations...</option>
                  ) : exams.length === 0 ? (
                    <option value="">No examinations available</option>
                  ) : (
                    exams.map(e => (
                      <option key={e.id} value={e.id}>
                        {e.exam_name} ({e.session || 'Current'}) - {e.status || (e.is_published ? 'PUBLISHED' : 'DRAFT')}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Class Filter (Admin/Teacher only) */}
              {!isStudentOrParent && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 6 }}>
                    Filter by Class & Section
                  </label>
                  <select
                    value={selectedClassId}
                    onChange={e => setSelectedClassId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: '1.5px solid #cbd5e1',
                      fontSize: 13,
                      fontWeight: 500,
                      color: '#0f172a',
                      background: '#fff',
                      outline: 'none',
                    }}
                  >
                    <option value="">All Classes ({students.length} students)</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.section ? `(${c.section})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Search (Admin/Teacher only) */}
              {!isStudentOrParent && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 6 }}>
                    Search Student
                  </label>
                  <div style={{ position: 'relative' }}>
                    <i className="ti ti-search" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input
                      type="text"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Name, Roll No, Admission No..."
                      style={{
                        width: '100%',
                        padding: '10px 12px 10px 36px',
                        borderRadius: 8,
                        border: '1.5px solid #cbd5e1',
                        fontSize: 13,
                        boxSizing: 'border-box',
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>
              )}

            </div>

            {/* Selected Exam Information Details */}
            {selectedExam && (
              <div style={{
                marginTop: 16,
                padding: '12px 16px',
                background: '#f8fafc',
                borderRadius: 10,
                border: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 12,
                fontSize: 12,
                color: '#475569'
              }}>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  <div>📅 <strong>Schedule:</strong> {formatDate(selectedExam.start_date)} → {formatDate(selectedExam.end_date)}</div>
                  <div>🏷 <strong>Type:</strong> {selectedExam.exam_type || 'Regular'}</div>
                  <div>🎓 <strong>Session:</strong> {selectedExam.session || 'Current'}</div>
                  {selectedExam.instructions && (
                    <div>📝 <strong>Rules:</strong> {selectedExam.instructions.slice(0, 50)}...</div>
                  )}
                </div>
                <div style={{ fontWeight: 600, color: selectedExam.status === 'PUBLISHED' || selectedExam.is_published ? '#16a34a' : '#f59e0b' }}>
                  {selectedExam.status === 'PUBLISHED' || selectedExam.is_published ? '✓ Ready for Student Download' : '⚠️ Draft mode (Unpublished)'}
                </div>
              </div>
            )}
          </div>

          {/* Student View Mode */}
          {isStudentOrParent ? (
            <div style={{
              background: '#fff',
              borderRadius: 16,
              padding: 28,
              boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
              border: '1px solid #e2e8f0',
              textAlign: 'center',
              maxWidth: 600,
              margin: '0 auto'
            }}>
              <div style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: '#e0f2fe',
                color: '#0284c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 28,
                margin: '0 auto 16px'
              }}>
                <i className="ti ti-ticket" />
              </div>
              <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800, color: '#0f172a' }}>
                Your Official Examination Admit Card
              </h2>
              <p style={{ margin: '0 0 20px', fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>
                Admit card contains your roll number, exam center, subject datesheet, and general rules.
                Please ensure you download and bring a printed copy to the examination hall.
              </p>

              {studentProfile && (
                <div style={{
                  background: '#f8fafc',
                  borderRadius: 12,
                  padding: '16px 20px',
                  marginBottom: 24,
                  textAlign: 'left',
                  border: '1px solid #e2e8f0',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 10,
                  fontSize: 13
                }}>
                  <div><span style={{ color: '#64748b' }}>Student Name:</span> <strong>{studentProfile.name}</strong></div>
                  <div><span style={{ color: '#64748b' }}>Roll Number:</span> <strong>{studentProfile.roll_number || '—'}</strong></div>
                  <div><span style={{ color: '#64748b' }}>Class & Section:</span> <strong>{studentProfile.class_name || studentProfile.class?.name || '—'} {studentProfile.section ? `(${studentProfile.section})` : ''}</strong></div>
                  <div><span style={{ color: '#64748b' }}>Admission No:</span> <strong>{studentProfile.admission_number || '—'}</strong></div>
                </div>
              )}

              {selectedExam ? (
                <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setPreviewStudent(studentProfile || { id: user?.student_id, name: user?.name, roll_number: user?.roll_number })}
                    style={{
                      background: '#eff6ff',
                      color: '#0284c7',
                      border: '1px solid #bfdbfe',
                      padding: '12px 24px',
                      borderRadius: 10,
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8
                    }}
                  >
                    <i className="ti ti-eye" /> Preview Admit Card
                  </button>
                  <button
                    onClick={() => handleDownload(studentProfile?.id || user?.student_id, studentProfile?.name || user?.name)}
                    disabled={downloadingId !== null}
                    style={{
                      background: '#0284c7',
                      color: '#ffffff',
                      border: 'none',
                      padding: '12px 28px',
                      borderRadius: 10,
                      fontSize: 14,
                      fontWeight: 800,
                      cursor: downloadingId !== null ? 'wait' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      boxShadow: '0 4px 14px rgba(2,132,199,0.3)'
                    }}
                  >
                    <i className={downloadingId !== null ? 'ti ti-loader' : 'ti ti-download'} />
                    {downloadingId !== null ? 'Generating PDF...' : 'Download Official Admit Card (PDF)'}
                  </button>
                </div>
              ) : (
                <div style={{ padding: 20, color: '#94a3b8', fontSize: 13 }}>
                  No published examinations currently active for your class.
                </div>
              )}
            </div>
          ) : (
            /* Admin & Teacher Grid View */
            <div>
              {/* Header count info */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>
                  Student List <span style={{ color: '#64748b', fontWeight: 500, fontSize: 12 }}>({filteredStudents.length} Students found)</span>
                </div>
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  >
                    Clear Filter
                  </button>
                )}
              </div>

              {/* Student Cards Grid */}
              {loadingStudents ? (
                <div style={{ padding: 60, textAlign: 'center', color: '#64748b' }}>
                  <i className="ti ti-loader" style={{ fontSize: 28, animation: 'spin 1s infinite' }} />
                  <p style={{ marginTop: 10, fontSize: 14 }}>Loading students roster...</p>
                </div>
              ) : filteredStudents.length === 0 ? (
                <div style={{
                  background: '#fff',
                  borderRadius: 12,
                  padding: 48,
                  textAlign: 'center',
                  border: '1.5px dashed #cbd5e1',
                  color: '#64748b'
                }}>
                  <i className="ti ti-mood-empty" style={{ fontSize: 42, color: '#94a3b8', marginBottom: 12 }} />
                  <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: '#334155' }}>No students found</h3>
                  <p style={{ margin: 0, fontSize: 13 }}>Try changing your search keywords or class selection.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                  {filteredStudents.map(student => {
                    const isDownloading = downloadingId === student.id;
                    const initial = (student.name || 'S').charAt(0).toUpperCase();
                    const clsObj = classes.find(c => String(c.id) === String(student.class_id));
                    const classText = student.class_display || (student.class_name ? `${student.class_name} ${student.section || ''}`.trim() : (clsObj ? `${clsObj.name} ${clsObj.section || ''}`.trim() : (student.class?.name || 'Class')));
                    const parentText = student.parent_name || student.father_name || 'Guardian';

                    return (
                      <div
                        key={student.id}
                        style={{
                          background: '#ffffff',
                          borderRadius: 12,
                          border: '1px solid #e2e8f0',
                          padding: 16,
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                          transition: 'all 0.2s',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.borderColor = '#0284c7';
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow = '0 6px 16px rgba(2,132,199,0.12)';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.borderColor = '#e2e8f0';
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.03)';
                        }}
                      >
                        <div>
                          {/* Student Header */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                            {student.photo_url ? (
                              <img
                                src={student.photo_url}
                                alt={student.name}
                                style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover', border: '1.5px solid #e2e8f0' }}
                              />
                            ) : (
                              <div style={{
                                width: 44,
                                height: 44,
                                borderRadius: 10,
                                background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                                color: '#fff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 800,
                                fontSize: 16,
                                flexShrink: 0
                              }}>
                                {initial}
                              </div>
                            )}
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{
                                fontSize: 14,
                                fontWeight: 700,
                                color: '#0f172a',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}>
                                {student.name}
                              </div>
                              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                                Roll: <strong>{student.roll_number || '—'}</strong> | Adm: <strong>{student.admission_number || student.admission_no || '—'}</strong>
                              </div>
                            </div>
                          </div>

                          {/* Student Meta Details */}
                          <div style={{
                            background: '#f8fafc',
                            borderRadius: 8,
                            padding: '8px 10px',
                            fontSize: 11.5,
                            color: '#475569',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: 14,
                            gap: 8,
                          }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={classText}>
                              🎓 <strong>{classText}</strong>
                            </span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={parentText}>
                              👨‍👦 {parentText}
                            </span>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div style={{ display: 'flex', gap: 8, borderTop: '1px solid #f1f5f9', paddingTop: 12 }}>
                          <button
                            onClick={() => setPreviewStudent(student)}
                            style={{
                              flex: 1,
                              padding: '8px 10px',
                              borderRadius: 8,
                              border: '1px solid #e2e8f0',
                              background: '#ffffff',
                              color: '#475569',
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 4
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                            onMouseLeave={e => e.currentTarget.style.background = '#ffffff'}
                          >
                            <i className="ti ti-eye" /> Preview
                          </button>
                          <button
                            onClick={() => handleDownload(student.id, student.name)}
                            disabled={isDownloading}
                            style={{
                              flex: 1.2,
                              padding: '8px 12px',
                              borderRadius: 8,
                              border: 'none',
                              background: '#0284c7',
                              color: '#ffffff',
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: isDownloading ? 'wait' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 6
                            }}
                          >
                            <i className={isDownloading ? 'ti ti-loader' : 'ti ti-download'} />
                            {isDownloading ? 'Generating...' : 'PDF Card'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Live Admit Card Preview Modal */}
          {previewStudent && (
            <div style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(4px)',
              zIndex: 1200,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20
            }}
            onClick={e => e.target === e.currentTarget && setPreviewStudent(null)}
            >
              <div style={{
                background: '#ffffff',
                borderRadius: 16,
                width: '100%',
                maxWidth: 640,
                maxHeight: '92vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                overflow: 'hidden'
              }}>
                {/* Modal Header */}
                <div style={{
                  padding: '16px 20px',
                  borderBottom: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: '#f8fafc'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <i className="ti ti-ticket" style={{ fontSize: 18, color: '#0284c7' }} />
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
                      Admit Card Preview
                    </h3>
                  </div>
                  <button
                    onClick={() => setPreviewStudent(null)}
                    style={{ background: 'none', border: 'none', fontSize: 18, color: '#64748b', cursor: 'pointer' }}
                  >
                    ✕
                  </button>
                </div>

                {/* Modal Printable Card Body */}
                <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
                  <div style={{
                    border: '1.5px solid #1e3a8a',
                    borderRadius: 12,
                    padding: 24,
                    background: '#ffffff',
                    position: 'relative'
                  }}>
                    {/* School Letterhead */}
                    <div style={{ textAlign: 'center', marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                        {schoolSettings?.logo_url ? (
                          <img src={schoolSettings.logo_url} alt="Logo" style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'contain' }} />
                        ) : (
                          <div style={{ width: 44, height: 44, borderRadius: 8, background: '#1e3a8a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16 }}>
                            ★
                          </div>
                        )}
                        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: '#0f2942', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                          {schoolSettings?.name || user?.school?.name || user?.school_name || 'School Name'}
                        </h2>
                      </div>
                      {(schoolSettings?.address || user?.school?.address) && (
                        <p style={{ margin: '2px 0', fontSize: 11, color: '#475569' }}>
                          {schoolSettings?.address || user?.school?.address}
                        </p>
                      )}
                      {(schoolSettings?.phone || user?.school?.phone || schoolSettings?.email || user?.school?.email) && (
                        <p style={{ margin: 0, fontSize: 10.5, color: '#64748b' }}>
                          {[
                            (schoolSettings?.phone || user?.school?.phone) ? `Phone: ${schoolSettings?.phone || user?.school?.phone}` : null,
                            (schoolSettings?.email || user?.school?.email) ? `Email: ${schoolSettings?.email || user?.school?.email}` : null,
                          ].filter(Boolean).join(' | ')}
                        </p>
                      )}
                      
                      <div style={{
                        display: 'inline-block',
                        background: '#1e3a8a',
                        color: '#ffffff',
                        padding: '4px 18px',
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 800,
                        marginTop: 10,
                        letterSpacing: '0.05em'
                      }}>
                        ADMIT CARD
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: '#1e3a8a', marginTop: 4 }}>
                        {selectedExam?.exam_name || 'ANNUAL EXAMINATION'} {selectedExam?.session || '2024-25'}
                      </div>
                    </div>

                    {/* Student Info & Photo Row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 16, padding: '10px 0', borderTop: '1px solid #f1f5f9' }}>
                      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', fontSize: 11.5 }}>
                        <div><span style={{ color: '#64748b' }}>Student Name</span> : <strong style={{ color: '#0f172a' }}>{previewStudent.name || '—'}</strong></div>
                        <div><span style={{ color: '#64748b' }}>Father's Name</span> : <strong style={{ color: '#0f172a' }}>{previewStudent.father_name || previewStudent.parent_name || '—'}</strong></div>
                        <div><span style={{ color: '#64748b' }}>Class / Section</span> : <strong style={{ color: '#0f172a' }}>{previewStudent.class_name || previewStudent.class?.name || '—'} {previewStudent.section || ''}</strong></div>
                        <div><span style={{ color: '#64748b' }}>Date of Birth</span> : <strong style={{ color: '#0f172a' }}>{previewStudent.dob ? formatDate(previewStudent.dob) : '—'}</strong></div>
                        <div><span style={{ color: '#64748b' }}>Roll No.</span> : <strong style={{ color: '#1e3a8a' }}>{previewStudent.roll_number || '—'}</strong></div>
                        <div><span style={{ color: '#64748b' }}>School Code</span> : <strong style={{ color: '#0f172a' }}>{previewStudent.school_code || (selectedExam?.session ? `SPS/${selectedExam.session.slice(0, 4)}` : '—')}</strong></div>
                        <div><span style={{ color: '#64748b' }}>Admission No.</span> : <strong style={{ color: '#0f172a' }}>{previewStudent.admission_number || previewStudent.admission_no || '—'}</strong></div>
                      </div>

                      <div>
                        {previewStudent.photo_url ? (
                          <img
                            src={previewStudent.photo_url}
                            alt="Student"
                            style={{ width: 74, height: 86, borderRadius: 6, objectFit: 'cover', border: '1px solid #cbd5e1' }}
                          />
                        ) : (
                          <div style={{
                            width: 74,
                            height: 86,
                            borderRadius: 6,
                            background: '#f8fafc',
                            border: '1px solid #cbd5e1',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 12,
                            color: '#64748b',
                            fontWeight: 700
                          }}>
                            PHOTO
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Timetable Table */}
                    <div style={{ marginBottom: 16 }}>
                      {loadingTimetable ? (
                        <div style={{ padding: 16, textAlign: 'center', color: '#64748b', fontSize: 12 }}>
                          Loading timetable...
                        </div>
                      ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, border: '1px solid #cbd5e1' }}>
                          <thead>
                            <tr style={{ background: '#1e3a8a', color: '#ffffff' }}>
                              <th style={{ padding: '7px 8px', textAlign: 'center' }}>Date</th>
                              <th style={{ padding: '7px 8px', textAlign: 'center' }}>Day</th>
                              <th style={{ padding: '7px 8px', textAlign: 'center' }}>Subject</th>
                              <th style={{ padding: '7px 8px', textAlign: 'center' }}>Time</th>
                              <th style={{ padding: '7px 8px', textAlign: 'center' }}>Max Marks</th>
                              <th style={{ padding: '7px 8px', textAlign: 'center' }}>Venue</th>
                            </tr>
                          </thead>
                          <tbody>
                            {timetable.length > 0 ? (
                              timetable.map((item, idx) => (
                                <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0', background: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                                  <td style={{ padding: '6px 8px', textAlign: 'center' }}>{formatDate(item.exam_date)}</td>
                                  <td style={{ padding: '6px 8px', textAlign: 'center' }}>{item.day || (item.exam_date ? new Date(item.exam_date).toLocaleDateString('en-US', { weekday: 'short' }) : '—')}</td>
                                  <td style={{ padding: '6px 8px', fontWeight: 700, textAlign: 'center' }}>{item.subject_name || item.subject?.name || 'Subject'}</td>
                                  <td style={{ padding: '6px 8px', textAlign: 'center' }}>{item.start_time ? `${item.start_time} - ${item.end_time || ''}` : '—'}</td>
                                  <td style={{ padding: '6px 8px', textAlign: 'center' }}>{item.max_marks || 100}</td>
                                  <td style={{ padding: '6px 8px', textAlign: 'center' }}>{item.venue || item.room || item.room_no || '—'}</td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan="6" style={{ padding: 18, textAlign: 'center', color: '#64748b', fontStyle: 'italic' }}>
                                  No timetable schedule added for this exam / class yet.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      )}
                    </div>

                    {/* Instructions & Signatures */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 14, paddingTop: 10 }}>
                      <div style={{ fontSize: 10.5, color: '#475569' }}>
                        <strong style={{ color: '#0f172a', display: 'block', marginBottom: 4 }}>Instructions:</strong>
                        <ul style={{ margin: 0, paddingLeft: 16, lineHeight: 1.4 }}>
                          <li>Bring this admit card to the examination hall.</li>
                          <li>Carry your school ID card.</li>
                          <li>Reach at least 30 minutes before the exam time.</li>
                        </ul>
                      </div>

                      <div style={{ textAlign: 'center', width: 160 }}>
                        <div style={{ fontStyle: 'italic', color: '#1e3a8a', fontWeight: 800, fontSize: 13, marginBottom: 2 }}>Authorized</div>
                        <div style={{ borderTop: '1px solid #64748b', paddingTop: 4, fontSize: 10, fontWeight: 700, color: '#0f172a' }}>
                          Principal's Signature
                        </div>
                      </div>
                    </div>

                  </div>
                </div>

                {/* Modal Footer */}
                <div style={{
                  padding: '14px 20px',
                  borderTop: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 10,
                  background: '#f8fafc'
                }}>
                  <button
                    onClick={() => setPreviewStudent(null)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 8,
                      border: '1px solid #cbd5e1',
                      background: '#fff',
                      color: '#475569',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Close Preview
                  </button>
                  <button
                    onClick={() => {
                      handleDownload(previewStudent.id, previewStudent.name);
                    }}
                    style={{
                      padding: '8px 20px',
                      borderRadius: 8,
                      border: 'none',
                      background: '#0284c7',
                      color: '#fff',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    <i className="ti ti-download" /> Download Official PDF
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
