import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

function fmtBytes(b) {
  if (!b) return '';
  if (b < 1048576) return (b / 1024).toFixed(0) + ' KB';
  return (b / 1048576).toFixed(1) + ' MB';
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function fmtDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function AssignmentsPage() {
  const { user } = useAuth();
  const role = user?.role || '';
  const isPrincipal = ['PRINCIPAL', 'SUPER_ADMIN', 'ADMIN', 'VICE_PRINCIPAL', 'DIRECTOR'].includes(role);
  const isTeacher = role === 'TEACHER';
  const isStudent = role === 'STUDENT' || role === 'PARENT';
  const canCreate = isPrincipal || isTeacher;

  // ─── STATE ───────────────────────────────────────────────────────────────────
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);

  // Filters
  const [filterClass, setFilterClass] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [filterTeacher, setFilterTeacher] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');

  // Create/Edit Assignment Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formClassId, setFormClassId] = useState('');
  const [formSubjectId, setFormSubjectId] = useState('');
  const [formSubjects, setFormSubjects] = useState([]);
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formMaxMarks, setFormMaxMarks] = useState('20');
  const [formDueDate, setFormDueDate] = useState('');
  const [formAttachment, setFormAttachment] = useState(null);

  // Submissions Evaluation Modal / Drawer (Teacher / Principal)
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [assignmentDetails, setAssignmentDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [gradingState, setGradingState] = useState({}); // { student_id: { marks, feedback, saving } }

  // Student Submission Box State (Student View)
  const [studentFiles, setStudentFiles] = useState({}); // { assignment_id: File }
  const [studentComments, setStudentComments] = useState({}); // { assignment_id: comment }
  const [submittingMap, setSubmittingMap] = useState({}); // { assignment_id: boolean }

  // ─── 1. LOAD ASSIGNMENTS ────────────────────────────────────────────────────
  const loadAssignments = useCallback(() => {
    setLoading(true);
    let url = `/academic/assignments?search=${encodeURIComponent(search)}`;
    if (filterClass)   url += `&class_id=${filterClass}`;
    if (filterSubject) url += `&subject_id=${filterSubject}`;
    if (filterTeacher) url += `&teacher_id=${filterTeacher}`;
    if (filterStatus)  url += `&status=${filterStatus}`;

    api.get(url)
      .then(r => setAssignments(r.data?.assignments || []))
      .catch(() => toast.error('Failed to load assignments'))
      .finally(() => setLoading(false));
  }, [filterClass, filterSubject, filterTeacher, filterStatus, search]);

  // Load Classes & Teachers for filter dropdowns
  useEffect(() => {
    if (canCreate) {
      api.get('/principal/classes').then(r => setClasses(r.data || [])).catch(() => {});
      api.get('/principal/teachers').then(r => setTeachers(r.data || [])).catch(() => {});
    }
  }, [canCreate]);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  // Load subjects when form class changes in Create modal
  useEffect(() => {
    if (formClassId) {
      api.get(`/principal/classes/${formClassId}/subjects`)
        .then(r => setFormSubjects(r.data || []))
        .catch(() => setFormSubjects([]));
    } else {
      setFormSubjects([]);
    }
  }, [formClassId]);

  // ─── 2. CREATE ASSIGNMENT ───────────────────────────────────────────────────
  async function handleCreateAssignment(e) {
    e.preventDefault();
    if (!formClassId || !formSubjectId || !formTitle.trim() || !formDueDate) {
      return toast.error('Please fill all required fields');
    }

    setCreating(true);
    try {
      const fd = new FormData();
      fd.append('title', formTitle.trim());
      fd.append('description', formDescription.trim());
      fd.append('class_id', formClassId);
      fd.append('subject_id', formSubjectId);
      fd.append('max_marks', formMaxMarks || '20');
      fd.append('due_date', formDueDate);
      if (formAttachment) {
        fd.append('attachment', formAttachment);
      }

      const res = await api.post('/academic/assignments', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      toast.success(res.data?.message || 'Assignment created successfully!');
      setShowCreateModal(false);
      setFormTitle('');
      setFormDescription('');
      setFormClassId('');
      setFormSubjectId('');
      setFormMaxMarks('20');
      setFormDueDate('');
      setFormAttachment(null);
      loadAssignments();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create assignment');
    } finally {
      setCreating(false);
    }
  }

  // ─── 3. LOAD ASSIGNMENT DETAILS & STUDENT SUBMISSIONS ───────────────────────
  const openSubmissionsDrawer = (assignment) => {
    setSelectedAssignment(assignment);
    setLoadingDetails(true);
    api.get(`/academic/assignments/${assignment.id}`)
      .then(r => {
        setAssignmentDetails(r.data);
        // Initialize grading state
        const initialGrading = {};
        (r.data?.student_submissions || []).forEach(st => {
          initialGrading[st.student_id] = {
            marks: st.marks_obtained !== null && st.marks_obtained !== undefined ? st.marks_obtained : '',
            feedback: st.feedback || '',
            saving: false,
          };
        });
        setGradingState(initialGrading);
      })
      .catch(() => toast.error('Failed to load submissions'))
      .finally(() => setLoadingDetails(false));
  };

  // ─── 4. TEACHER GRADE SUBMISSION ────────────────────────────────────────────
  async function handleGradeSubmission(studentId, submissionId) {
    if (!selectedAssignment || !submissionId) return;
    const g = gradingState[studentId] || {};
    if (g.marks === '' || g.marks === null) {
      return toast.error('Please enter marks');
    }

    const marksNum = parseFloat(g.marks);
    if (isNaN(marksNum) || marksNum < 0 || marksNum > selectedAssignment.max_marks) {
      return toast.error(`Marks must be between 0 and ${selectedAssignment.max_marks}`);
    }

    setGradingState(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], saving: true },
    }));

    try {
      await api.post(`/academic/assignments/${selectedAssignment.id}/submissions/${submissionId}/grade`, {
        marks_obtained: marksNum,
        teacher_feedback: g.feedback,
      });

      toast.success('Grade & feedback saved!');
      openSubmissionsDrawer(selectedAssignment);
      loadAssignments();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Grading failed');
      setGradingState(prev => ({
        ...prev,
        [studentId]: { ...prev[studentId], saving: false },
      }));
    }
  }

  // ─── 5. STUDENT SUBMIT ASSIGNMENT ───────────────────────────────────────────
  async function handleStudentSubmit(assignmentId) {
    const file = studentFiles[assignmentId];
    if (!file) return toast.error('Please select your assignment file to submit');

    setSubmittingMap(prev => ({ ...prev, [assignmentId]: true }));
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('student_comment', studentComments[assignmentId] || '');

      const res = await api.post(`/academic/assignments/${assignmentId}/submit`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      toast.success(res.data?.message || 'Assignment submitted successfully!');
      setStudentFiles(prev => ({ ...prev, [assignmentId]: null }));
      setStudentComments(prev => ({ ...prev, [assignmentId]: '' }));
      loadAssignments();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Submission failed');
    } finally {
      setSubmittingMap(prev => ({ ...prev, [assignmentId]: false }));
    }
  }

  // ─── 6. DELETE ASSIGNMENT ───────────────────────────────────────────────────
  async function handleDeleteAssignment(assignmentId) {
    if (!window.confirm('Are you sure you want to delete this assignment and all student submissions?')) return;
    try {
      await api.delete(`/academic/assignments/${assignmentId}`);
      toast.success('Assignment deleted');
      if (selectedAssignment?.id === assignmentId) setSelectedAssignment(null);
      loadAssignments();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Delete failed');
    }
  }

  // ─── COMPUTED METRICS (PRINCIPAL / TEACHER) ─────────────────────────────────
  const metrics = useMemo(() => {
    const total = assignments.length;
    const active = assignments.filter(a => a.status === 'ACTIVE').length;
    let totalSubmissions = 0;
    let totalMarked = 0;
    let sumAvg = 0;
    let scoredCount = 0;

    assignments.forEach(a => {
      if (a.stats) {
        totalSubmissions += (a.stats.submitted_count || 0);
        totalMarked += (a.stats.marked_count || 0);
        if (a.stats.average_marks > 0) {
          sumAvg += a.stats.average_marks;
          scoredCount++;
        }
      }
    });

    const overallAvg = scoredCount > 0 ? (sumAvg / scoredCount).toFixed(1) : '—';

    return { total, active, totalSubmissions, totalMarked, overallAvg };
  }, [assignments]);

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar title="Assignments & Academic Work" />
        <div className="page-body">

          {/* HEADER */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 12,
                  background: 'linear-gradient(135deg, #0b3b7b, #1d4ed8)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 24, color: '#fff', boxShadow: '0 4px 14px rgba(11,59,123,0.25)'
                }}>
                  <i className="ti ti-clipboard-list" />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: 21, fontWeight: 800, color: '#0f172a' }}>
                    {isStudent ? 'My Course Assignments' : 'Academic Assignments & Evaluation'}
                  </h2>
                  <p style={{ margin: '2px 0 0', fontSize: 13, color: '#64748b' }}>
                    {isStudent
                      ? 'View your class assignments, upload submissions directly, and track grades & teacher feedback'
                      : 'Create assignments, evaluate student submissions with marks and feedback, and track class progress'}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={loadAssignments} style={S.btnGhost}>
                  <i className="ti ti-refresh" /> Refresh
                </button>
                {canCreate && (
                  <button onClick={() => setShowCreateModal(true)} style={S.btnPrimary}>
                    <i className="ti ti-plus" /> Create Assignment
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* METRIC OVERVIEW CARDS (PRINCIPAL / TEACHER) */}
          {!isStudent && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14, marginBottom: 20 }}>
              <div style={{ ...S.metricCard, borderLeft: '4px solid #0b3b7b' }}>
                <div style={S.metricLabel}><i className="ti ti-clipboard-list" /> TOTAL ASSIGNMENTS</div>
                <div style={S.metricVal}>{metrics.total}</div>
                <div style={S.metricSub}>All recorded assignments</div>
              </div>

              <div style={{ ...S.metricCard, borderLeft: '4px solid #16a34a' }}>
                <div style={{ ...S.metricLabel, color: '#16a34a' }}><i className="ti ti-check" /> ACTIVE ASSIGNMENTS</div>
                <div style={{ ...S.metricVal, color: '#16a34a' }}>{metrics.active}</div>
                <div style={S.metricSub}>Open for student submissions</div>
              </div>

              <div style={{ ...S.metricCard, borderLeft: '4px solid #2563eb' }}>
                <div style={{ ...S.metricLabel, color: '#2563eb' }}><i className="ti ti-file-upload" /> SUBMISSIONS</div>
                <div style={{ ...S.metricVal, color: '#2563eb' }}>{metrics.totalSubmissions}</div>
                <div style={S.metricSub}>Total student files turned in</div>
              </div>

              <div style={{ ...S.metricCard, borderLeft: '4px solid #7c3aed' }}>
                <div style={{ ...S.metricLabel, color: '#7c3aed' }}><i className="ti ti-certificate" /> EVALUATED</div>
                <div style={{ ...S.metricVal, color: '#7c3aed' }}>{metrics.totalMarked}</div>
                <div style={S.metricSub}>Marked & feedback given</div>
              </div>

              <div style={{ ...S.metricCard, borderLeft: '4px solid #d97706' }}>
                <div style={{ ...S.metricLabel, color: '#d97706' }}><i className="ti ti-chart-line" /> AVERAGE SCORE</div>
                <div style={{ ...S.metricVal, color: '#d97706' }}>{metrics.overallAvg}</div>
                <div style={S.metricSub}>Overall performance avg</div>
              </div>
            </div>
          )}

          {/* FILTERS & SEARCH BAR */}
          <div style={{ ...S.card, marginBottom: 20, padding: '14px 18px' }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              {!isStudent && (
                <>
                  <div style={{ flex: '1 1 170px' }}>
                    <label style={S.label}>Class</label>
                    <select value={filterClass} onChange={e => setFilterClass(e.target.value)} style={S.select}>
                      <option value="">🏫 All Classes</option>
                      {classes.map(c => <option key={c.id} value={c.id}>{c.name} - {c.section}</option>)}
                    </select>
                  </div>

                  {isPrincipal && (
                    <div style={{ flex: '1 1 180px' }}>
                      <label style={S.label}>Teacher</label>
                      <select value={filterTeacher} onChange={e => setFilterTeacher(e.target.value)} style={S.select}>
                        <option value="">👨‍🏫 All Teachers</option>
                        {teachers.map(t => <option key={t.id} value={t.id}>{t.name} ({t.department || 'Academic'})</option>)}
                      </select>
                    </div>
                  )}
                </>
              )}

              <div style={{ flex: '1 1 140px' }}>
                <label style={S.label}>Status</label>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={S.select}>
                  <option value="">All Statuses</option>
                  <option value="ACTIVE">Active</option>
                  <option value="CLOSED">Closed / Expired</option>
                </select>
              </div>

              <div style={{ flex: '2 1 240px' }}>
                <label style={S.label}>Search</label>
                <div style={{ position: 'relative' }}>
                  <i className="ti ti-search" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input
                    style={{ ...S.input, paddingLeft: 32 }}
                    placeholder="Search assignment title, UID, instructions..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && loadAssignments()}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={loadAssignments} style={S.btnPrimary}>
                  <i className="ti ti-filter" /> Filter
                </button>
                {(filterClass || filterSubject || filterTeacher || filterStatus || search) && (
                  <button
                    onClick={() => {
                      setFilterClass('');
                      setFilterSubject('');
                      setFilterTeacher('');
                      setFilterStatus('');
                      setSearch('');
                    }}
                    style={S.btnGhost}
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* STUDENT VIEW: INDIVIDUAL ASSIGNMENT CARDS WITH INLINE SUBMISSION  */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {isStudent && (
            <div>
              {loading ? (
                <div style={S.emptyBox}>⏳ Loading your assignments...</div>
              ) : assignments.length === 0 ? (
                <div style={{ ...S.emptyBox, padding: 60 }}>
                  <div style={{ fontSize: 40, marginBottom: 10 }}>🎉</div>
                  <h3 style={{ margin: 0, color: '#0f172a' }}>No assignments due!</h3>
                  <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>You are all caught up with your school work.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 18 }}>
                  {assignments.map(a => {
                    const mySub = a.my_submission;
                    const isSubmitted = !!mySub;
                    const isGraded = mySub && mySub.status === 'MARKED' && mySub.marks_obtained !== null;
                    const isOverdue = !isSubmitted && a.due_date && new Date(a.due_date) < new Date();

                    return (
                      <div key={a.id} style={{
                        ...S.card,
                        borderTop: isGraded ? '4px solid #16a34a' : isSubmitted ? '4px solid #2563eb' : isOverdue ? '4px solid #ef4444' : '4px solid #0b3b7b',
                        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                      }}>
                        <div>
                          {/* Card Header */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                            <div>
                              <span style={{
                                background: '#eff6ff', color: '#0b3b7b', fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 6
                              }}>
                                📚 {a.subject_name || 'Academic'}
                              </span>
                              <span style={{ marginLeft: 6, fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>
                                #{a.assignment_uid}
                              </span>
                            </div>

                            {/* Status Badge */}
                            {isGraded ? (
                              <span style={{ background: '#dcfce7', color: '#16a34a', fontSize: 11.5, fontWeight: 900, padding: '3px 10px', borderRadius: 12 }}>
                                ✅ MARKED ({mySub.marks_obtained}/{a.max_marks})
                              </span>
                            ) : isSubmitted ? (
                              <span style={{ background: '#dbeafe', color: '#1e40af', fontSize: 11.5, fontWeight: 800, padding: '3px 10px', borderRadius: 12 }}>
                                📥 SUBMITTED
                              </span>
                            ) : isOverdue ? (
                              <span style={{ background: '#fee2e2', color: '#ef4444', fontSize: 11.5, fontWeight: 800, padding: '3px 10px', borderRadius: 12 }}>
                                ⚠️ OVERDUE
                              </span>
                            ) : (
                              <span style={{ background: '#fef3c7', color: '#d97706', fontSize: 11.5, fontWeight: 800, padding: '3px 10px', borderRadius: 12 }}>
                                ⏳ PENDING
                              </span>
                            )}
                          </div>

                          <h3 style={{ margin: '6px 0 4px', fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
                            {a.title}
                          </h3>

                          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>
                            Assigned by: <strong>{a.teacher_name}</strong> &nbsp;·&nbsp; Max Marks: <strong>{a.max_marks}</strong>
                          </div>

                          {a.description && (
                            <p style={{ fontSize: 13, color: '#334155', background: '#f8fafc', padding: '10px 12px', borderRadius: 8, margin: '8px 0 12px', lineHeight: 1.5 }}>
                              {a.description}
                            </p>
                          )}

                          {/* Teacher Attachment if available */}
                          {a.attachment_url && (
                            <div style={{ marginBottom: 12 }}>
                              <a
                                href={a.attachment_url} target="_blank" rel="noreferrer"
                                style={{ ...S.btnOutline, textDecoration: 'none', fontSize: 12, padding: '5px 10px' }}
                              >
                                <i className="ti ti-download" /> Download Question Paper / Material ({fmtBytes(a.attachment_size)})
                              </a>
                            </div>
                          )}

                          <div style={{ fontSize: 11.5, color: isOverdue ? '#ef4444' : '#475569', fontWeight: 600, marginBottom: 14 }}>
                            🕒 Due Date: <strong>{fmtDateTime(a.due_date)}</strong>
                          </div>
                        </div>

                        {/* Submission Section INSIDE THIS EXACT ASSIGNMENT */}
                        <div style={{ borderTop: '1px dashed #e2e8f0', paddingTop: 12, marginTop: 6 }}>
                          {isSubmitted ? (
                            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 12px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                <span style={{ fontSize: 12, fontWeight: 800, color: '#166534' }}>
                                  ✅ Your Submission ({fmtDate(mySub.submitted_at)})
                                </span>
                                <a href={mySub.file_url} target="_blank" rel="noreferrer" style={{ fontSize: 11.5, color: '#2563eb', fontWeight: 700 }}>
                                  View File ↗
                                </a>
                              </div>

                              {isGraded && (
                                <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed #86efac' }}>
                                  <div style={{ fontSize: 13, fontWeight: 900, color: '#14532d' }}>
                                    🏆 Marks Awarded: {mySub.marks_obtained} / {a.max_marks} ({Math.round(mySub.marks_obtained / a.max_marks * 100)}%)
                                  </div>
                                  {mySub.teacher_feedback && (
                                    <div style={{ fontSize: 12, color: '#166534', marginTop: 4 }}>
                                      💬 <em>"{mySub.teacher_feedback}"</em>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 800, color: '#0b3b7b', marginBottom: 6 }}>
                                📤 Upload Your Work For This Assignment:
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <input
                                  type="file"
                                  accept="image/*,application/pdf,.doc,.docx,.ppt,.pptx,.txt"
                                  onChange={e => setStudentFiles(prev => ({ ...prev, [a.id]: e.target.files[0] || null }))}
                                  style={{ fontSize: 12 }}
                                />
                                <input
                                  style={S.input}
                                  placeholder="Optional note for your teacher..."
                                  value={studentComments[a.id] || ''}
                                  onChange={e => setStudentComments(prev => ({ ...prev, [a.id]: e.target.value }))}
                                />
                                <button
                                  type="button"
                                  disabled={submittingMap[a.id] || !studentFiles[a.id]}
                                  onClick={() => handleStudentSubmit(a.id)}
                                  style={S.btnPrimary}
                                >
                                  {submittingMap[a.id] ? 'Submitting...' : '🚀 Submit Assignment'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* TEACHER / PRINCIPAL VIEW: ASSIGNMENTS LIST TABLE + EVALUATION DRAWER */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {!isStudent && (
            <div style={S.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h3 style={S.cardTitle}>
                  <i className="ti ti-list-check" /> Active Course Assignments ({assignments.length})
                </h3>
              </div>

              {loading ? (
                <div style={S.emptyBox}>⏳ Loading assignments...</div>
              ) : assignments.length === 0 ? (
                <div style={{ ...S.emptyBox, padding: 50 }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>📝</div>
                  <div>No assignments found. Click "+ Create Assignment" to create one.</div>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', color: '#475569', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
                        <th style={{ padding: '10px 12px', textAlign: 'left' }}>Assignment Title & UID</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left' }}>Class & Subject</th>
                        {isPrincipal && <th style={{ padding: '10px 12px', textAlign: 'left' }}>Teacher</th>}
                        <th style={{ padding: '10px 12px', textAlign: 'left' }}>Due Date</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left' }}>Max Marks</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left' }}>Submissions Progress</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assignments.map(a => {
                        const stats = a.stats || { total_students: 0, submitted_count: 0, marked_count: 0, pending_count: 0, average_marks: 0 };
                        const subPct = stats.total_students > 0 ? Math.round(stats.submitted_count / stats.total_students * 100) : 0;

                        return (
                          <tr key={a.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '11px 12px' }}>
                              <div style={{ fontWeight: 800, color: '#0b3b7b', fontSize: 13.5 }}>{a.title}</div>
                              <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>#{a.assignment_uid}</div>
                            </td>

                            <td style={{ padding: '11px 12px' }}>
                              <div style={{ fontWeight: 700, color: '#0f172a' }}>{a.class_name || 'Class'}</div>
                              <div style={{ fontSize: 11, color: '#64748b' }}>{a.subject_name}</div>
                            </td>

                            {isPrincipal && (
                              <td style={{ padding: '11px 12px' }}>
                                <span style={{ fontWeight: 700, color: '#334155' }}>{a.teacher_name}</span>
                              </td>
                            )}

                            <td style={{ padding: '11px 12px', color: '#475569', fontSize: 12 }}>
                              {fmtDateTime(a.due_date)}
                            </td>

                            <td style={{ padding: '11px 12px', fontWeight: 800, color: '#0f172a' }}>
                              {a.max_marks} pts
                            </td>

                            <td style={{ padding: '11px 12px', minWidth: 160 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, marginBottom: 3 }}>
                                <span>{stats.submitted_count} / {stats.total_students} submitted</span>
                                <span style={{ color: '#16a34a' }}>{stats.marked_count} marked</span>
                              </div>
                              <div style={{ height: 6, width: '100%', background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${subPct}%`, background: '#2563eb', borderRadius: 3 }} />
                              </div>
                            </td>

                            <td style={{ padding: '11px 12px' }}>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button
                                  onClick={() => openSubmissionsDrawer(a)}
                                  style={{ ...S.btnPrimary, padding: '5px 11px', fontSize: 11.5 }}
                                >
                                  <i className="ti ti-users" /> Evaluate Submissions
                                </button>
                                {a.attachment_url && (
                                  <a
                                    href={a.attachment_url} target="_blank" rel="noreferrer"
                                    style={{ ...S.btnOutline, padding: '5px 8px', fontSize: 11.5, textDecoration: 'none' }}
                                    title="Download Question Paper"
                                  >
                                    <i className="ti ti-file" />
                                  </a>
                                )}
                                <button
                                  onClick={() => handleDeleteAssignment(a.id)}
                                  style={{ background: '#fee2e2', color: '#ef4444', border: 'none', padding: '5px 8px', borderRadius: 6, fontSize: 11.5, cursor: 'pointer' }}
                                  title="Delete Assignment"
                                >
                                  <i className="ti ti-trash" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* SUBMISSIONS EVALUATION & GRADEBOOK MODAL                           */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {selectedAssignment && (
            <div style={S.modalOverlay} onClick={() => setSelectedAssignment(null)}>
              <div style={{ ...S.modalContent, maxWidth: 900 }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, borderBottom: '1px solid #e2e8f0', paddingBottom: 12 }}>
                  <div>
                    <span style={{ background: '#eff6ff', color: '#0b3b7b', fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 4 }}>
                      #{selectedAssignment.assignment_uid} · {selectedAssignment.class_name} · {selectedAssignment.subject_name}
                    </span>
                    <h3 style={{ margin: '6px 0 2px', fontSize: 18, fontWeight: 900, color: '#0f172a' }}>
                      {selectedAssignment.title}
                    </h3>
                    <div style={{ fontSize: 12, color: '#64748b' }}>
                      Teacher: <strong>{selectedAssignment.teacher_name}</strong> &nbsp;·&nbsp; Max Marks: <strong>{selectedAssignment.max_marks}</strong> &nbsp;·&nbsp; Due: <strong>{fmtDateTime(selectedAssignment.due_date)}</strong>
                    </div>
                  </div>
                  <button onClick={() => setSelectedAssignment(null)} style={S.modalCloseBtn}>✕</button>
                </div>

                {loadingDetails ? (
                  <div style={S.emptyBox}>⏳ Loading student submissions...</div>
                ) : (
                  <div>
                    <div style={{ marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: '#334155' }}>
                        Enrolled Students & Submissions ({(assignmentDetails?.student_submissions || []).length})
                      </span>
                    </div>

                    <div style={{ maxHeight: 440, overflowY: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                        <thead>
                          <tr style={{ background: '#f8fafc', color: '#475569', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
                            <th style={{ padding: '8px 10px', textAlign: 'left' }}>Student</th>
                            <th style={{ padding: '8px 10px', textAlign: 'left' }}>Status</th>
                            <th style={{ padding: '8px 10px', textAlign: 'left' }}>Submitted File</th>
                            <th style={{ padding: '8px 10px', textAlign: 'left' }}>Marks (Max: {selectedAssignment.max_marks})</th>
                            <th style={{ padding: '8px 10px', textAlign: 'left' }}>Teacher Feedback</th>
                            <th style={{ padding: '8px 10px', textAlign: 'left' }}>Save</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(assignmentDetails?.student_submissions || []).map(st => {
                            const sub = st.submission;
                            const isSub = !!sub;
                            const g = gradingState[st.student_id] || { marks: '', feedback: '', saving: false };

                            return (
                              <tr key={st.student_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '10px' }}>
                                  <div style={{ fontWeight: 800, color: '#0f172a' }}>{st.name}</div>
                                  <div style={{ fontSize: 11, color: '#64748b' }}>Roll: {st.roll_number} · Adm: {st.admission_no}</div>
                                </td>

                                <td style={{ padding: '10px' }}>
                                  {isSub ? (
                                    <span style={{
                                      background: sub.status === 'MARKED' ? '#dcfce7' : '#dbeafe',
                                      color: sub.status === 'MARKED' ? '#16a34a' : '#1e40af',
                                      padding: '2px 7px', borderRadius: 4, fontSize: 10.5, fontWeight: 800
                                    }}>
                                      {sub.status === 'MARKED' ? '✅ Evaluated' : '📥 Turned In'}
                                    </span>
                                  ) : (
                                    <span style={{ background: '#fee2e2', color: '#dc2626', padding: '2px 7px', borderRadius: 4, fontSize: 10.5, fontWeight: 800 }}>
                                      ⏳ Missing
                                    </span>
                                  )}
                                </td>

                                <td style={{ padding: '10px' }}>
                                  {isSub ? (
                                    <div>
                                      <a
                                        href={sub.file_url} target="_blank" rel="noreferrer"
                                        style={{ color: '#2563eb', fontWeight: 700, fontSize: 12, textDecoration: 'none' }}
                                      >
                                        <i className="ti ti-file" /> {sub.file_name || 'Download File'}
                                      </a>
                                      {sub.student_comment && (
                                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                                          Note: "{sub.student_comment}"
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <span style={{ color: '#94a3b8', fontSize: 11 }}>No file</span>
                                  )}
                                </td>

                                <td style={{ padding: '10px', width: 110 }}>
                                  <input
                                    type="number"
                                    min="0"
                                    max={selectedAssignment.max_marks}
                                    step="0.5"
                                    placeholder="Marks"
                                    disabled={!isSub}
                                    style={{ ...S.input, padding: '5px 8px', fontSize: 12, fontWeight: 800 }}
                                    value={g.marks}
                                    onChange={e => {
                                      const val = e.target.value;
                                      setGradingState(prev => ({
                                        ...prev,
                                        [st.student_id]: { ...prev[st.student_id], marks: val }
                                      }));
                                    }}
                                  />
                                </td>

                                <td style={{ padding: '10px' }}>
                                  <input
                                    placeholder="e.g. Excellent presentation"
                                    disabled={!isSub}
                                    style={{ ...S.input, padding: '5px 8px', fontSize: 12 }}
                                    value={g.feedback}
                                    onChange={e => {
                                      const val = e.target.value;
                                      setGradingState(prev => ({
                                        ...prev,
                                        [st.student_id]: { ...prev[st.student_id], feedback: val }
                                      }));
                                    }}
                                  />
                                </td>

                                <td style={{ padding: '10px' }}>
                                  {isSub && (
                                    <button
                                      disabled={g.saving}
                                      onClick={() => handleGradeSubmission(st.student_id, sub.id)}
                                      style={{ ...S.btnPrimary, padding: '5px 9px', fontSize: 11 }}
                                    >
                                      {g.saving ? '...' : 'Save'}
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* CREATE ASSIGNMENT MODAL                                            */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {showCreateModal && (
            <div style={S.modalOverlay} onClick={() => setShowCreateModal(false)}>
              <div style={S.modalContent} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
                    📝 Create New Course Assignment
                  </h3>
                  <button onClick={() => setShowCreateModal(false)} style={S.modalCloseBtn}>✕</button>
                </div>

                <form onSubmit={handleCreateAssignment} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={S.label}>Class & Section *</label>
                      <select value={formClassId} onChange={e => setFormClassId(e.target.value)} style={S.select} required>
                        <option value="">Select Class</option>
                        {classes.map(c => <option key={c.id} value={c.id}>{c.name} - {c.section}</option>)}
                      </select>
                    </div>

                    <div>
                      <label style={S.label}>Subject *</label>
                      <select value={formSubjectId} onChange={e => setFormSubjectId(e.target.value)} style={S.select} required>
                        <option value="">Select Subject</option>
                        {formSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label style={S.label}>Assignment Title *</label>
                    <input
                      style={S.input}
                      placeholder="e.g. Chapter 4 Trigonometry Problem Set"
                      value={formTitle}
                      onChange={e => setFormTitle(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label style={S.label}>Instructions / Description</label>
                    <textarea
                      style={{ ...S.input, minHeight: 65 }}
                      placeholder="Detailed instructions for students..."
                      value={formDescription}
                      onChange={e => setFormDescription(e.target.value)}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={S.label}>Maximum Marks *</label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        style={S.input}
                        value={formMaxMarks}
                        onChange={e => setFormMaxMarks(e.target.value)}
                        required
                      />
                    </div>

                    <div>
                      <label style={S.label}>Due Date & Time *</label>
                      <input
                        type="datetime-local"
                        style={S.input}
                        value={formDueDate}
                        onChange={e => setFormDueDate(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div style={{ background: '#f8fafc', border: '1.5px dashed #cbd5e1', borderRadius: 8, padding: 14, textAlign: 'center' }}>
                    <label style={{ ...S.btnOutline, cursor: 'pointer', display: 'inline-flex' }}>
                      <i className="ti ti-upload" /> Attach Question Paper / Reference Doc
                      <input
                        type="file"
                        accept="image/*,application/pdf,.doc,.docx,.ppt,.pptx,.txt"
                        style={{ display: 'none' }}
                        onChange={e => setFormAttachment(e.target.files[0] || null)}
                      />
                    </label>
                    {formAttachment ? (
                      <div style={{ marginTop: 8, fontSize: 12, color: '#0b3b7b', fontWeight: 700 }}>
                        ✅ {formAttachment.name} ({fmtBytes(formAttachment.size)})
                        <button type="button" onClick={() => setFormAttachment(null)} style={{ marginLeft: 6, background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>✕</button>
                      </div>
                    ) : (
                      <div style={{ marginTop: 4, fontSize: 11, color: '#94a3b8' }}>PDF, DOCX, PPT, JPG · Max 25 MB</div>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
                    <button type="button" onClick={() => setShowCreateModal(false)} style={S.btnGhost}>Cancel</button>
                    <button type="submit" disabled={creating} style={S.btnPrimary}>
                      {creating ? 'Creating Assignment...' : 'Publish Assignment'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const S = {
  card: {
    background: '#ffffff',
    borderRadius: 14,
    border: '1px solid #e2e8f0',
    padding: '18px 20px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
  },
  cardTitle: {
    margin: 0,
    fontSize: 14.5,
    fontWeight: 800,
    color: '#0b3b7b',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  metricCard: {
    background: '#ffffff',
    borderRadius: 12,
    border: '1px solid #e2e8f0',
    padding: '14px 16px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: 800,
    color: '#0b3b7b',
    letterSpacing: 0.5,
    marginBottom: 4,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  metricVal: {
    fontSize: 24,
    fontWeight: 900,
    color: '#0f172a',
    lineHeight: 1,
    marginBottom: 3,
  },
  metricSub: {
    fontSize: 11,
    color: '#64748b',
  },
  label: {
    display: 'block',
    fontSize: 11.5,
    fontWeight: 700,
    color: '#334155',
    marginBottom: 4,
  },
  input: {
    width: '100%',
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid #cbd5e1',
    fontSize: 12.5,
    outline: 'none',
    boxSizing: 'border-box',
    background: '#fff',
  },
  select: {
    width: '100%',
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid #cbd5e1',
    fontSize: 12.5,
    background: '#fff',
    outline: 'none',
    boxSizing: 'border-box',
  },
  btnPrimary: {
    background: '#0b3b7b',
    color: '#fff',
    border: 'none',
    padding: '8px 16px',
    borderRadius: 8,
    fontSize: 12.5,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    transition: 'background 0.15s',
  },
  btnOutline: {
    background: '#fff',
    color: '#0b3b7b',
    border: '1.5px solid #0b3b7b',
    padding: '7px 12px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 700,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    cursor: 'pointer',
  },
  btnGhost: {
    background: 'transparent',
    color: '#64748b',
    border: '1px solid #e2e8f0',
    padding: '7px 12px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  emptyBox: {
    textAlign: 'center',
    padding: 24,
    background: '#f8fafc',
    borderRadius: 10,
    color: '#94a3b8',
    fontSize: 12.5,
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15,23,42,0.6)',
    backdropFilter: 'blur(3px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: 16,
  },
  modalContent: {
    background: '#ffffff',
    borderRadius: 14,
    padding: '20px 22px',
    width: '100%',
    maxWidth: 520,
    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
  },
  modalCloseBtn: {
    background: 'none',
    border: 'none',
    fontSize: 18,
    color: '#64748b',
    cursor: 'pointer',
    padding: 4,
  },
};
