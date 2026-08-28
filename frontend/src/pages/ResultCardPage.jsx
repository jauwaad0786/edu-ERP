import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

function formatDate(d) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return d;
  }
}

function getGrade(pct) {
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B+';
  if (pct >= 60) return 'B';
  if (pct >= 50) return 'C';
  if (pct >= 33) return 'D';
  return 'F';
}

function getGradeBadgeColor(grade) {
  switch (grade) {
    case 'A+': case 'A': return { bg: '#ecfdf5', text: '#059669', border: '#a7f3d0' };
    case 'B+': case 'B': return { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' };
    case 'C': return { bg: '#fffbeb', text: '#d97706', border: '#fde68a' };
    case 'D': return { bg: '#fef3c7', text: '#b45309', border: '#fcd34d' };
    default:  return { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' };
  }
}

export default function ResultCardPage() {
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

  // Live preview modal state
  const [previewStudent, setPreviewStudent] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Student specific data
  const [studentProfile, setStudentProfile] = useState(null);

  // 1. Load exams
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

  // 2. Load classes for admin/teacher
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

  // 3. Load students when class changes
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

  // 4. Fetch Live Result Card data when preview modal opens
  useEffect(() => {
    if (!previewStudent || !selectedExamId) {
      setPreviewData(null);
      return;
    }
    async function fetchPreview() {
      try {
        setLoadingPreview(true);
        const res = await api.get(`/principal/result-card/${previewStudent.id}/${selectedExamId}/data`);
        setPreviewData(res.data);
      } catch (err) {
        console.error('Failed to load result card preview data', err);
        toast.error('Failed to load student result card details');
      } finally {
        setLoadingPreview(false);
      }
    }
    fetchPreview();
  }, [previewStudent, selectedExamId]);

  // 5. Download Single Result Card PDF
  const handleDownload = async (studentId, studentName) => {
    if (!selectedExamId) {
      toast.error('Please select an examination first');
      return;
    }
    setDownloadingId(studentId);
    try {
      const res = await api.get(`/principal/result-card/${studentId}/${selectedExamId}`, {
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const cleanName = (studentName || 'Student').replace(/\s+/g, '_');
      const examName = (selectedExam?.exam_name || 'Exam').replace(/\s+/g, '_');
      link.download = `ResultCard_${cleanName}_${examName}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success(`Result Card downloaded for ${studentName || 'student'}`);
    } catch (err) {
      console.error('Failed to download result card', err);
      toast.error('Failed to generate result card. Make sure marks are entered and exam is published.');
    } finally {
      setDownloadingId(null);
    }
  };

  // 5.1 Print Single Result Card via Backend PDF (Guarantees exact 1-page output)
  const handlePrint = async (studentId, studentName) => {
    if (!selectedExamId) {
      toast.error('Please select an examination first');
      return;
    }
    const toastId = toast.loading('Preparing 1-page Result Card for printing...');
    try {
      const res = await api.get(`/principal/result-card/${studentId}/${selectedExamId}`, {
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const blobUrl = window.URL.createObjectURL(blob);
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.src = blobUrl;
      document.body.appendChild(iframe);
      iframe.onload = () => {
        setTimeout(() => {
          toast.dismiss(toastId);
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        }, 400);
      };
    } catch (err) {
      toast.dismiss(toastId);
      console.error('Failed to print result card', err);
      toast.error('Failed to prepare result card for print');
    }
  };

  // 6. Bulk Download Result Cards for All Students in list
  const handleBulkDownload = async () => {
    const targetStudents = filteredStudents;
    if (!targetStudents.length) {
      toast.error('No students in list to download');
      return;
    }
    if (!selectedExamId) {
      toast.error('Please select an examination first');
      return;
    }
    setBulkDownloading(true);
    let successCount = 0;
    toast.loading(`Starting download of ${targetStudents.length} result cards...`, { id: 'bulk-res-dl' });

    for (let i = 0; i < targetStudents.length; i++) {
      const s = targetStudents[i];
      try {
        const res = await api.get(`/principal/result-card/${s.id}/${selectedExamId}`, {
          responseType: 'blob',
        });
        const blob = new Blob([res.data], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const cleanName = (s.name || `Student_${s.id}`).replace(/\s+/g, '_');
        link.download = `ResultCard_${cleanName}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        successCount++;
        await new Promise(r => setTimeout(r, 400));
      } catch (err) {
        console.error(`Failed to download result card for ${s.name}`, err);
      }
    }

    setBulkDownloading(false);
    toast.dismiss('bulk-res-dl');
    toast.success(`Downloaded ${successCount} of ${targetStudents.length} result cards successfully!`);
  };

  // Filter students based on search query (Name, Roll No, Admission No, Class)
  const filteredStudents = students.filter(s => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const nameMatch = (s.name || '').toLowerCase().includes(q);
    const rollMatch = String(s.roll_number || '').toLowerCase().includes(q);
    const admMatch = String(s.admission_number || s.admission_no || '').toLowerCase().includes(q);
    const classMatch = String(s.class_name || s.class?.name || '').toLowerCase().includes(q);
    return nameMatch || rollMatch || admMatch || classMatch;
  });

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar title="Result Card & Marksheet Portal" />
        <div className="page-body">

          {/* Top Banner Header */}
          <div style={{
            background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
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
                  <i className="ti ti-file-certificate" /> Official Academic Marksheet & Report Card Hub
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
                Student Result Cards & Marksheets
              </h1>
              <p style={{ margin: '6px 0 0', fontSize: 13, opacity: 0.9, maxWidth: 620, lineHeight: 1.5 }}>
                View class-wise, roll number-wise, and student-wise marks breakdown, grades, pass/fail status, and generate official printable PDF report cards.
              </p>
            </div>

            {!isStudentOrParent && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button
                  onClick={() => navigate('/result-management')}
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
                    backdropFilter: 'blur(8px)'
                  }}
                >
                  <i className="ti ti-clipboard-check" /> Result Management
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

          {/* Controls Filter Bar */}
          <div style={{
            background: '#ffffff',
            borderRadius: 14,
            padding: 20,
            boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
            border: '1px solid #e2e8f0',
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
                    outline: 'none'
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

              {/* Class Filter (Admin/Teacher) */}
              {!isStudentOrParent && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 6 }}>
                    Filter by Class &amp; Section
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
                      outline: 'none'
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

              {/* Search Filter (Admin/Teacher) */}
              {!isStudentOrParent && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 6 }}>
                    Search Student (Name, Roll, Adm No)
                  </label>
                  <div style={{ position: 'relative' }}>
                    <i className="ti ti-search" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input
                      type="text"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Student name, roll number..."
                      style={{
                        width: '100%',
                        padding: '10px 12px 10px 36px',
                        borderRadius: 8,
                        border: '1.5px solid #cbd5e1',
                        fontSize: 13,
                        boxSizing: 'border-box',
                        outline: 'none'
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
                  <div>📅 <strong>Exam Date:</strong> {formatDate(selectedExam.start_date)} → {formatDate(selectedExam.end_date)}</div>
                  <div>🏷 <strong>Type:</strong> {selectedExam.exam_type || 'Annual'}</div>
                  <div>🎓 <strong>Academic Session:</strong> {selectedExam.session || 'Current'}</div>
                </div>
                <div style={{ fontWeight: 600, color: selectedExam.status === 'PUBLISHED' || selectedExam.is_published ? '#16a34a' : '#f59e0b' }}>
                  {selectedExam.status === 'PUBLISHED' || selectedExam.is_published ? '✓ Result Published &amp; Official' : '⚠️ Results in Draft / Processing'}
                </div>
              </div>
            )}
          </div>

          {/* Student/Parent Mode Card */}
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
                <i className="ti ti-award" />
              </div>
              <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800, color: '#0f172a' }}>
                Your Academic Result &amp; Marksheet
              </h2>
              <p style={{ margin: '0 0 20px', fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>
                View your detailed marks breakdown across all subjects, overall percentage, assigned grade, and download the official signed Result Card PDF.
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
                  <div><span style={{ color: '#64748b' }}>Class &amp; Section:</span> <strong>{studentProfile.class_display || studentProfile.class_name || studentProfile.class?.name || '—'} {studentProfile.section ? `(${studentProfile.section})` : ''}</strong></div>
                  <div><span style={{ color: '#64748b' }}>Admission No:</span> <strong>{studentProfile.admission_number || studentProfile.admission_no || '—'}</strong></div>
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
                    <i className="ti ti-eye" /> Live Report Card
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
                    {downloadingId !== null ? 'Generating PDF...' : 'Download Official Result Card (PDF)'}
                  </button>
                </div>
              ) : (
                <div style={{ padding: 20, color: '#94a3b8', fontSize: 13 }}>
                  No published examination results available for your class.
                </div>
              )}
            </div>
          ) : (
            /* Admin & Teacher Grid View */
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>
                  Students Result Roster <span style={{ color: '#64748b', fontWeight: 500, fontSize: 12 }}>({filteredStudents.length} Students found)</span>
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

              {loadingStudents ? (
                <div style={{ padding: 60, textAlign: 'center', color: '#64748b' }}>
                  <i className="ti ti-loader" style={{ fontSize: 28, animation: 'spin 1s infinite' }} />
                  <p style={{ marginTop: 10, fontSize: 14 }}>Loading student results roster...</p>
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
                  <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: '#334155' }}>No student records found</h3>
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
                        <div style={{ display: 'flex', gap: 6, borderTop: '1px solid #f1f5f9', paddingTop: 12 }}>
                          <button
                            onClick={() => setPreviewStudent(student)}
                            style={{
                              flex: 1,
                              padding: '8px 6px',
                              borderRadius: 8,
                              border: '1px solid #e2e8f0',
                              background: '#ffffff',
                              color: '#475569',
                              fontSize: 11.5,
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
                            onClick={() => handlePrint(student.id, student.name)}
                            style={{
                              flex: 1,
                              padding: '8px 6px',
                              borderRadius: 8,
                              border: '1px solid #93c5fd',
                              background: '#eff6ff',
                              color: '#0b3b7b',
                              fontSize: 11.5,
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 4
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = '#dbeafe'}
                            onMouseLeave={e => e.currentTarget.style.background = '#eff6ff'}
                          >
                            <i className="ti ti-printer" /> Print (1-Page)
                          </button>
                          <button
                            onClick={() => handleDownload(student.id, student.name)}
                            disabled={isDownloading}
                            style={{
                              flex: 1,
                              padding: '8px 6px',
                              borderRadius: 8,
                              border: 'none',
                              background: '#0b3b7b',
                              color: '#ffffff',
                              fontSize: 11.5,
                              fontWeight: 700,
                              cursor: isDownloading ? 'wait' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 4
                            }}
                          >
                            <i className={isDownloading ? 'ti ti-loader' : 'ti ti-download'} />
                            {isDownloading ? '...' : 'PDF'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Live Result Card Preview Modal */}
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
                maxWidth: 820,
                maxHeight: '94vh',
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
                    <i className="ti ti-file-certificate" style={{ fontSize: 18, color: '#0b3b7b' }} />
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
                      Mark Sheet Official Preview
                    </h3>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button
                      onClick={() => handlePrint(previewStudent.id, previewStudent.name)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 6,
                        border: '1px solid #93c5fd',
                        background: '#eff6ff',
                        color: '#0b3b7b',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                      }}
                    >
                      <i className="ti ti-printer" /> Print (1-Page PDF)
                    </button>
                    <button
                      onClick={() => setPreviewStudent(null)}
                      style={{ background: 'none', border: 'none', fontSize: 18, color: '#64748b', cursor: 'pointer' }}
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Printable Result Card Content */}
                <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
                  {loadingPreview ? (
                    <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                      <i className="ti ti-loader" style={{ fontSize: 28, animation: 'spin 1s infinite' }} />
                      <p style={{ marginTop: 10, fontSize: 13 }}>Generating report card view...</p>
                    </div>
                  ) : (
                    <div id="printable-marksheet-area" style={{
                      border: '2px solid #0b3b7b',
                      borderRadius: 10,
                      padding: 20,
                      background: '#ffffff',
                      position: 'relative',
                      boxShadow: 'inset 0 0 0 1.5px #93c5fd'
                    }}>
                      {/* School Letterhead */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16, borderBottom: '1px solid #cbd5e1', paddingBottom: 12, marginBottom: 12 }}>
                        {previewData?.school?.logo_url ? (
                          <img src={previewData.school.logo_url} alt="Logo" style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'contain' }} />
                        ) : (
                          <div style={{
                            width: 56, height: 56, borderRadius: 8,
                            background: '#0b3b7b', color: '#fff',
                            display: 'flex', flexDirection: 'column',
                            alignItems: 'center', justifyContent: 'center',
                            fontWeight: 800, fontSize: 18,
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                          }}>
                            <span>★</span>
                            <span style={{ fontSize: 7, letterSpacing: '0.05em' }}>SCHOOL</span>
                          </div>
                        )}
                        <div style={{ flex: 1, textAlign: 'center' }}>
                          <h2 style={{ margin: '0 0 2px', fontSize: 20, fontWeight: 900, color: '#0b3b7b', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                            {previewData?.school?.name || user?.school?.name || user?.school_name || 'School Name'}
                          </h2>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#1e293b', marginBottom: 2 }}>
                            {previewData?.school?.affiliation || 'AFFILIATED TO CBSE, NEW DELHI'} | SCHOOL CODE: {previewData?.school?.code || previewData?.school?.school_code || (previewData?.school?.id ? `SCH${previewData.school.id}` : 'XYZ123')}
                          </div>
                          {(previewData?.school?.address || user?.school?.address) && (
                            <div style={{ fontSize: 10.5, color: '#475569', marginBottom: 2 }}>
                              📍 {previewData?.school?.address || user?.school?.address}
                            </div>
                          )}
                          {(previewData?.school?.phone || user?.school?.phone || previewData?.school?.email || user?.school?.email) && (
                            <div style={{ fontSize: 10, color: '#64748b' }}>
                              {[
                                (previewData?.school?.phone || user?.school?.phone) ? `📞 ${previewData?.school?.phone || user?.school?.phone}` : null,
                                (previewData?.school?.email || user?.school?.email) ? `✉ ${previewData?.school?.email || user?.school?.email}` : null,
                              ].filter(Boolean).join('   |   ')}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* MARK SHEET Ribbon Banner */}
                      <div style={{ textAlign: 'center', marginBottom: 14 }}>
                        <div style={{
                          background: '#0b3b7b',
                          color: '#ffffff',
                          padding: '5px 32px',
                          fontSize: 13,
                          fontWeight: 900,
                          letterSpacing: '0.08em',
                          display: 'inline-block',
                          borderRadius: 3,
                          boxShadow: '0 2px 4px rgba(11,59,123,0.2)'
                        }}>
                          MARK SHEET
                        </div>
                        <div style={{ fontSize: 11.5, fontWeight: 800, color: '#0b3b7b', marginTop: 4 }}>
                          {selectedExam?.exam_name || 'Annual Examination'} {selectedExam?.session || previewStudent?.session || '2024-25'}
                        </div>
                      </div>

                      {/* Student Profile Info Box */}
                      <div style={{
                        border: '1px solid #93c5fd',
                        borderRadius: 8,
                        padding: '10px 14px',
                        marginBottom: 14,
                        display: 'grid',
                        gridTemplateColumns: '1.2fr 1.1fr auto',
                        gap: 16,
                        alignItems: 'center',
                        background: '#ffffff'
                      }}>
                        {/* Column 1 */}
                        <div style={{ fontSize: 11.5, lineHeight: 1.7 }}>
                          <div><span style={{ color: '#64748b', display: 'inline-block', width: 95 }}>Student Name</span> : <strong style={{ color: '#0f172a' }}>{previewStudent.name || '—'}</strong></div>
                          <div><span style={{ color: '#64748b', display: 'inline-block', width: 95 }}>Father's Name</span> : <strong style={{ color: '#0f172a' }}>{previewStudent.father_name || previewStudent.parent_name || '—'}</strong></div>
                          <div><span style={{ color: '#64748b', display: 'inline-block', width: 95 }}>Mother's Name</span> : <strong style={{ color: '#0f172a' }}>{previewStudent.mother_name || '—'}</strong></div>
                          <div><span style={{ color: '#64748b', display: 'inline-block', width: 95 }}>Admission No.</span> : <strong style={{ color: '#0f172a' }}>{previewStudent.admission_number || previewStudent.admission_no || '—'}</strong></div>
                          <div><span style={{ color: '#64748b', display: 'inline-block', width: 95 }}>Roll No.</span> : <strong style={{ color: '#0b3b7b' }}>{previewStudent.roll_number || '—'}</strong></div>
                          <div><span style={{ color: '#64748b', display: 'inline-block', width: 95 }}>Class / Section</span> : <strong style={{ color: '#0f172a' }}>{previewStudent.class_display || previewStudent.class_name || '—'} {previewStudent.section ? `/ ${previewStudent.section}` : ''}</strong></div>
                        </div>

                        {/* Column 2 */}
                        <div style={{ fontSize: 11.5, lineHeight: 1.7 }}>
                          <div><span style={{ color: '#64748b', display: 'inline-block', width: 95 }}>Date of Birth</span> : <strong style={{ color: '#0f172a' }}>{previewStudent.dob ? formatDate(previewStudent.dob) : '—'}</strong></div>
                          <div><span style={{ color: '#64748b', display: 'inline-block', width: 95 }}>Session</span> : <strong style={{ color: '#0f172a' }}>{selectedExam?.session || previewStudent.session || '2024-25'}</strong></div>
                          <div><span style={{ color: '#64748b', display: 'inline-block', width: 95 }}>Exam Type</span> : <strong style={{ color: '#0f172a' }}>{selectedExam?.exam_name || 'Annual Examination'}</strong></div>
                          <div><span style={{ color: '#64748b', display: 'inline-block', width: 95 }}>School Code</span> : <strong style={{ color: '#0f172a' }}>{previewData?.school?.code || previewData?.school?.school_code || (previewData?.school?.id ? `SCH${previewData.school.id}` : '—')}</strong></div>
                          <div><span style={{ color: '#64748b', display: 'inline-block', width: 95 }}>Date of Result</span> : <strong style={{ color: '#0f172a' }}>{new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-')}</strong></div>
                        </div>

                        {/* Column 3: Photo */}
                        <div>
                          {previewStudent.photo_url ? (
                            <img
                              src={previewStudent.photo_url}
                              alt="Student"
                              style={{ width: 72, height: 86, borderRadius: 6, objectFit: 'cover', border: '1px solid #cbd5e1' }}
                            />
                          ) : (
                            <div style={{
                              width: 72,
                              height: 86,
                              borderRadius: 6,
                              background: '#f1f5f9',
                              border: '1px solid #cbd5e1',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 10,
                              color: '#94a3b8',
                              fontWeight: 700
                            }}>
                              <i className="ti ti-user" style={{ fontSize: 24, marginBottom: 2 }} />
                              PHOTO
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 5. Marks Breakdown Table */}
                      <div style={{ marginBottom: 14 }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, border: '1px solid #93c5fd' }}>
                          <thead>
                            <tr style={{ background: '#0b3b7b', color: '#ffffff' }}>
                              <th style={{ padding: '6px 8px', textAlign: 'center', width: 45 }}>S.No.</th>
                              <th style={{ padding: '6px 12px', textAlign: 'left' }}>Subject</th>
                              <th style={{ padding: '6px 10px', textAlign: 'center', width: 95 }}>Max. Marks</th>
                              <th style={{ padding: '6px 10px', textAlign: 'center', width: 110 }}>Marks Obtained</th>
                              <th style={{ padding: '6px 10px', textAlign: 'center', width: 110 }}>Percentage (%)</th>
                              <th style={{ padding: '6px 10px', textAlign: 'center', width: 70 }}>Grade</th>
                            </tr>
                          </thead>
                          <tbody>
                            {previewData?.marks && previewData.marks.length > 0 ? (
                              previewData.marks.map((m, idx) => {
                                const pct = m.max_marks ? Number(((m.marks_obtained / m.max_marks) * 100).toFixed(2)) : 0.00;
                                return (
                                  <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0', background: idx % 2 === 1 ? '#f8fafc' : '#ffffff' }}>
                                    <td style={{ padding: '6px 8px', textAlign: 'center', color: '#64748b' }}>{idx + 1}</td>
                                    <td style={{ padding: '6px 12px', fontWeight: 600, color: '#1e293b' }}>{m.subject_name}</td>
                                    <td style={{ padding: '6px 10px', textAlign: 'center' }}>{m.max_marks}</td>
                                    <td style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 700 }}>{m.marks_obtained}</td>
                                    <td style={{ padding: '6px 10px', textAlign: 'center' }}>{pct.toFixed(2)}</td>
                                    <td style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 800, color: '#0b3b7b' }}>{m.grade || getGrade(pct)}</td>
                                  </tr>
                                );
                              })
                            ) : (
                              <tr>
                                <td colSpan="6" style={{ padding: 18, textAlign: 'center', color: '#64748b', fontStyle: 'italic' }}>
                                  No marks entered for this student in this exam yet.
                                </td>
                              </tr>
                            )}
                          </tbody>
                          {previewData?.marks && previewData.marks.length > 0 && (
                            <tfoot>
                              <tr style={{ background: '#eff6ff', fontWeight: 900, borderTop: '1.5px solid #0b3b7b', color: '#0b3b7b' }}>
                                <td colSpan="2" style={{ padding: '7px 12px', textAlign: 'center', letterSpacing: '0.05em' }}>TOTAL</td>
                                <td style={{ padding: '7px 10px', textAlign: 'center' }}>{previewData.total_max || 0}</td>
                                <td style={{ padding: '7px 10px', textAlign: 'center' }}>{previewData.total_obtained || 0}</td>
                                <td style={{ padding: '7px 10px', textAlign: 'center' }}>{Number(previewData.overall_percentage || 0).toFixed(2)}</td>
                                <td style={{ padding: '7px 10px', textAlign: 'center', fontSize: 12 }}>{getGrade(previewData.overall_percentage || 0)}</td>
                              </tr>
                            </tfoot>
                          )}
                        </table>
                      </div>

                      {/* 6. Side-by-Side Cards: Performance Summary & Grade Scale */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                        
                        {/* Left Card: Performance Summary */}
                        <div style={{ border: '1px solid #93c5fd', borderRadius: 6, overflow: 'hidden', background: '#ffffff' }}>
                          <div style={{ background: '#0b3b7b', color: '#ffffff', padding: '5px 12px', fontSize: 11, fontWeight: 800, textAlign: 'center', letterSpacing: '0.03em' }}>
                            PERFORMANCE SUMMARY
                          </div>
                          <div style={{ padding: '10px 14px', fontSize: 11.5, lineHeight: 1.9 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: '#475569' }}>Total Marks</span>
                              <strong style={{ color: '#0f172a' }}>{previewData?.total_max || 0}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: '#475569' }}>Marks Obtained</span>
                              <strong style={{ color: '#0f172a' }}>{previewData?.total_obtained || 0}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: '#475569' }}>Percentage</span>
                              <strong style={{ color: '#0f172a' }}>{previewData?.marks?.length ? `${Number(previewData.overall_percentage || 0).toFixed(2)} %` : '—'}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: '#475569' }}>Overall Grade</span>
                              <strong style={{ color: '#0b3b7b', fontSize: 12 }}>{previewData?.marks?.length ? getGrade(previewData.overall_percentage || 0) : '—'}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: 4, marginTop: 4 }}>
                              <span style={{ color: '#475569', fontWeight: 700 }}>Result</span>
                              <strong style={{
                                color: (previewData?.overall_result === 'PASS' || (!previewData?.overall_result && previewData?.overall_percentage >= 33)) ? '#16a34a' : '#dc2626',
                                fontSize: 12
                              }}>
                                {previewData?.marks?.length ? (previewData?.overall_result || (previewData?.overall_percentage >= 33 ? 'PASS' : 'FAIL')) : '—'}
                              </strong>
                            </div>
                          </div>
                        </div>

                        {/* Right Card: Grade Scale */}
                        <div style={{ border: '1px solid #93c5fd', borderRadius: 6, overflow: 'hidden', background: '#ffffff' }}>
                          <div style={{ background: '#0b3b7b', color: '#ffffff', padding: '5px 12px', fontSize: 11, fontWeight: 800, textAlign: 'center', letterSpacing: '0.03em' }}>
                            GRADE SCALE
                          </div>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, textAlign: 'center' }}>
                            <thead>
                              <tr style={{ background: '#eff6ff', color: '#0b3b7b', fontWeight: 800, borderBottom: '1px solid #cbd5e1' }}>
                                <th style={{ padding: '3px 8px' }}>Percentage Range</th>
                                <th style={{ padding: '3px 8px' }}>Grade</th>
                              </tr>
                            </thead>
                            <tbody>
                              {[
                                ['91 - 100', 'A+'],
                                ['81 - 90', 'A'],
                                ['71 - 80', 'B+'],
                                ['61 - 70', 'B'],
                                ['51 - 60', 'C'],
                                ['33 - 50', 'D'],
                                ['Below 33', 'E (Fail)'],
                              ].map((row, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                  <td style={{ padding: '2px 8px', color: '#475569' }}>{row[0]}</td>
                                  <td style={{ padding: '2px 8px', fontWeight: 700, color: row[1] === 'E (Fail)' ? '#dc2626' : '#0b3b7b' }}>{row[1]}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                      </div>

                      {/* 7. Footer: Date, Place & Signatures (Class Teacher + Principal) */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', alignItems: 'end', paddingTop: 8 }}>
                        <div style={{ fontSize: 11, lineHeight: 1.8, color: '#0f172a' }}>
                          <div><strong>Date :</strong> {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-')}</div>
                          <div><strong>Place :</strong> {previewData?.school?.city || user?.school?.city || 'School Campus'}</div>
                        </div>

                        <div style={{ textAlign: 'center' }}>
                          <div style={{ width: 140, margin: '0 auto 4px', borderTop: '1.5px solid #64748b' }}></div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#475569' }}>Class Teacher</div>
                        </div>

                        <div style={{ textAlign: 'center' }}>
                          <div style={{ width: 140, margin: '0 auto 4px', borderTop: '1.5px solid #0b3b7b' }}></div>
                          <div style={{ fontSize: 11, fontWeight: 800, color: '#0b3b7b' }}>Principal</div>
                          {previewData?.school?.principal_name && (
                            <div style={{ fontSize: 10, color: '#64748b' }}>({previewData.school.principal_name})</div>
                          )}
                        </div>
                      </div>

                    </div>
                  )}
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
                    Close
                  </button>
                  <button
                    onClick={() => handlePrint(previewStudent.id, previewStudent.name)}
                    style={{
                      padding: '8px 18px',
                      borderRadius: 8,
                      border: '1px solid #93c5fd',
                      background: '#eff6ff',
                      color: '#0b3b7b',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    <i className="ti ti-printer" /> Print (1-Page PDF)
                  </button>
                  <button
                    onClick={() => handleDownload(previewStudent.id, previewStudent.name)}
                    style={{
                      padding: '8px 20px',
                      borderRadius: 8,
                      border: 'none',
                      background: '#0b3b7b',
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

          {/* Global Print Stylesheet for Result Card */}
          <style>{`
            @media print {
              body * {
                visibility: hidden !important;
              }
              #printable-marksheet-area, #printable-marksheet-area * {
                visibility: visible !important;
              }
              #printable-marksheet-area {
                position: fixed !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                max-width: 100% !important;
                margin: 0 !important;
                padding: 15px !important;
                border: 2px solid #0b3b7b !important;
                box-shadow: none !important;
                background: white !important;
                z-index: 9999999 !important;
              }
              @page {
                size: A4 portrait;
                margin: 10mm;
              }
            }
          `}</style>

        </div>
      </div>
    </div>
  );
}
