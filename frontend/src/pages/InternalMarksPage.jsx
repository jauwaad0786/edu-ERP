import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

export default function InternalMarksPage() {
  const { user } = useAuth();
  const role = user?.role || '';
  const isPrincipal = ['PRINCIPAL', 'SUPER_ADMIN', 'ADMIN', 'VICE_PRINCIPAL', 'DIRECTOR'].includes(role);
  const isTeacher = role === 'TEACHER';
  const isStudent = role === 'STUDENT' || role === 'PARENT';
  const canEdit = isPrincipal || isTeacher;

  // ─── STATE (TEACHER / PRINCIPAL GRADEBOOK) ──────────────────────────────────
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [academicYear, setAcademicYear] = useState('2026');
  const [term, setTerm] = useState('Continuous Assessment');
  const [defaultMaxMarks, setDefaultMaxMarks] = useState(20);

  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [subjectName, setSubjectName] = useState('');

  // ─── STATE (STUDENT / PARENT VIEW) ──────────────────────────────────────────
  const [myInternalMarks, setMyInternalMarks] = useState([]);
  const [loadingMyMarks, setLoadingMyMarks] = useState(false);
  const [myStudentName, setMyStudentName] = useState('');
  const [myClassDisplay, setMyClassDisplay] = useState('');

  // ─── 1. LOAD CLASSES (TEACHER / PRINCIPAL) ──────────────────────────────────
  useEffect(() => {
    if (canEdit) {
      api.get('/principal/classes').then(r => setClasses(r.data || [])).catch(() => {});
    }
  }, [canEdit]);

  // Load subjects when class selected
  useEffect(() => {
    if (selectedClassId) {
      api.get(`/principal/classes/${selectedClassId}/subjects`)
        .then(r => {
          const list = r.data || [];
          setSubjects(list);
          if (list.length > 0) setSelectedSubjectId(list[0].id);
          else setSelectedSubjectId('');
        })
        .catch(() => setSubjects([]));
    } else {
      setSubjects([]);
      setSelectedSubjectId('');
    }
  }, [selectedClassId]);

  // ─── 2. LOAD INTERNAL MARKS GRADEBOOK ───────────────────────────────────────
  const loadGradebook = useCallback(() => {
    if (!selectedClassId || !selectedSubjectId) {
      setStudents([]);
      return;
    }
    setLoading(true);
    api.get(`/academic/internal-marks?class_id=${selectedClassId}&subject_id=${selectedSubjectId}&academic_year=${academicYear}&term=${encodeURIComponent(term)}`)
      .then(r => {
        setStudents(r.data?.students || []);
        setSubjectName(r.data?.subject_name || '');
        if (r.data?.default_max) setDefaultMaxMarks(r.data.default_max);
      })
      .catch(() => toast.error('Failed to load internal marks'))
      .finally(() => setLoading(false));
  }, [selectedClassId, selectedSubjectId, academicYear, term]);

  useEffect(() => {
    if (canEdit && selectedClassId && selectedSubjectId) {
      loadGradebook();
    }
  }, [canEdit, selectedClassId, selectedSubjectId, loadGradebook]);

  // ─── 3. LOAD STUDENT SELF INTERNAL MARKS ────────────────────────────────────
  const loadStudentMarks = useCallback(() => {
    setLoadingMyMarks(true);
    api.get('/academic/student/internal-marks')
      .then(r => {
        setMyInternalMarks(r.data?.internal_marks || []);
        setMyStudentName(r.data?.student_name || '');
        setMyClassDisplay(r.data?.class_display || '');
      })
      .catch(() => toast.error('Failed to load internal marks'))
      .finally(() => setLoadingMyMarks(false));
  }, []);

  useEffect(() => {
    if (isStudent) {
      loadStudentMarks();
    }
  }, [isStudent, loadStudentMarks]);

  // ─── 4. HANDLE BATCH SAVE INTERNAL MARKS ────────────────────────────────────
  async function handleBatchSave(e) {
    if (e) e.preventDefault();
    if (!selectedClassId || !selectedSubjectId) return toast.error('Please select Class and Subject');

    setSaving(true);
    try {
      const payload = {
        class_id: parseInt(selectedClassId),
        subject_id: parseInt(selectedSubjectId),
        academic_year: academicYear,
        term: term,
        marks: students.map(s => ({
          student_id: s.student_id,
          marks_obtained: parseFloat(s.marks_obtained || 0),
          max_marks: parseFloat(s.max_marks || defaultMaxMarks),
          remarks: s.remarks || '',
        })),
      };

      const res = await api.post('/academic/internal-marks/batch-save', payload);
      toast.success(res.data?.message || 'Internal marks saved successfully!');
      loadGradebook();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save internal marks');
    } finally {
      setSaving(false);
    }
  }

  // Update mark obtained in local state
  const handleMarkChange = (index, val) => {
    const copy = [...students];
    copy[index].marks_obtained = val;
    const max = parseFloat(copy[index].max_marks || defaultMaxMarks);
    const obt = parseFloat(val || 0);
    copy[index].percentage = max > 0 ? Math.round((obt / max) * 100) : 0;
    setStudents(copy);
  };

  // Update remark in local state
  const handleRemarkChange = (index, val) => {
    const copy = [...students];
    copy[index].remarks = val;
    setStudents(copy);
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar title="Continuous Internal Marks" />
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
                  <i className="ti ti-chart-dots" />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: 21, fontWeight: 800, color: '#0f172a' }}>
                    {isStudent ? 'My Continuous Internal Assessment Marks' : 'Continuous Internal Assessment Gradebook'}
                  </h2>
                  <p style={{ margin: '2px 0 0', fontSize: 13, color: '#64748b' }}>
                    {isStudent
                      ? 'Live transparent view of continuous assessment, periodic tests & internal marks across all subjects'
                      : 'Enter and update subject-wise internal assessment marks with real-time student visibility'}
                  </p>
                </div>
              </div>

              {canEdit && (
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={loadGradebook} style={S.btnGhost}>
                    <i className="ti ti-refresh" /> Refresh
                  </button>
                  <button
                    onClick={handleBatchSave}
                    disabled={saving || students.length === 0}
                    style={S.btnPrimary}
                  >
                    {saving ? 'Saving...' : '💾 Save & Update All Marks'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* TEACHER / PRINCIPAL GRADEBOOK CONTROLS                             */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {canEdit && (
            <div>
              <div style={{ ...S.card, marginBottom: 20, padding: '16px 20px' }}>
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div style={{ flex: '1 1 200px' }}>
                    <label style={S.label}>Class & Section *</label>
                    <select value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)} style={S.select}>
                      <option value="">Select Class</option>
                      {classes.map(c => <option key={c.id} value={c.id}>{c.name} - {c.section}</option>)}
                    </select>
                  </div>

                  <div style={{ flex: '1 1 200px' }}>
                    <label style={S.label}>Subject *</label>
                    <select value={selectedSubjectId} onChange={e => setSelectedSubjectId(e.target.value)} style={S.select}>
                      <option value="">Select Subject</option>
                      {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>

                  <div style={{ flex: '1 1 180px' }}>
                    <label style={S.label}>Assessment Term / Component</label>
                    <select value={term} onChange={e => setTerm(e.target.value)} style={S.select}>
                      <option value="Continuous Assessment">Continuous Assessment</option>
                      <option value="Term 1 Internal">Term 1 Internal</option>
                      <option value="Term 2 Internal">Term 2 Internal</option>
                      <option value="Periodic Test 1">Periodic Test 1</option>
                      <option value="Periodic Test 2">Periodic Test 2</option>
                      <option value="Practical & Viva">Practical & Viva</option>
                    </select>
                  </div>

                  <div style={{ flex: '1 1 130px' }}>
                    <label style={S.label}>Academic Session</label>
                    <input style={S.input} value={academicYear} onChange={e => setAcademicYear(e.target.value)} placeholder="2026" />
                  </div>
                </div>
              </div>

              {/* GRADEBOOK TABLE */}
              <div style={S.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <h3 style={S.cardTitle}>
                    <i className="ti ti-table" />
                    {subjectName ? `${subjectName} — Internal Assessment Marks Sheet` : 'Internal Assessment Score Sheet'}
                    {students.length > 0 && ` (${students.length} Enrolled Students)`}
                  </h3>
                  <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 800 }}>
                    ⚡ Instant Student Visibility (No separate publish step required)
                  </span>
                </div>

                {!selectedClassId || !selectedSubjectId ? (
                  <div style={{ ...S.emptyBox, padding: 50 }}>
                    👈 Please select Class and Subject from the dropdowns above to open the score sheet.
                  </div>
                ) : loading ? (
                  <div style={S.emptyBox}>⏳ Loading class students...</div>
                ) : students.length === 0 ? (
                  <div style={S.emptyBox}>No students enrolled in this class.</div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', color: '#475569', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
                          <th style={{ padding: '10px 12px', textAlign: 'left' }}>Roll No</th>
                          <th style={{ padding: '10px 12px', textAlign: 'left' }}>Student Name & Adm No</th>
                          <th style={{ padding: '10px 12px', textAlign: 'left', width: 140 }}>Marks Obtained</th>
                          <th style={{ padding: '10px 12px', textAlign: 'left', width: 110 }}>Max Marks</th>
                          <th style={{ padding: '10px 12px', textAlign: 'left', width: 90 }}>Percentage</th>
                          <th style={{ padding: '10px 12px', textAlign: 'left' }}>Teacher Remarks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {students.map((st, idx) => (
                          <tr key={st.student_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '10px 12px', fontWeight: 800, color: '#0b3b7b' }}>
                              {st.roll_number}
                            </td>

                            <td style={{ padding: '10px 12px' }}>
                              <div style={{ fontWeight: 800, color: '#0f172a' }}>{st.name}</div>
                              <div style={{ fontSize: 11, color: '#64748b' }}>Adm: {st.admission_no}</div>
                            </td>

                            <td style={{ padding: '10px 12px' }}>
                              <input
                                type="number"
                                min="0"
                                max={st.max_marks || defaultMaxMarks}
                                step="0.5"
                                style={{ ...S.input, fontWeight: 900, fontSize: 13, color: '#0b3b7b' }}
                                value={st.marks_obtained}
                                onChange={e => handleMarkChange(idx, e.target.value)}
                              />
                            </td>

                            <td style={{ padding: '10px 12px' }}>
                              <input
                                type="number"
                                min="1"
                                style={{ ...S.input, background: '#f8fafc', color: '#64748b' }}
                                value={st.max_marks}
                                onChange={e => {
                                  const copy = [...students];
                                  copy[idx].max_marks = e.target.value;
                                  setStudents(copy);
                                }}
                              />
                            </td>

                            <td style={{ padding: '10px 12px' }}>
                              <span style={{
                                fontWeight: 800,
                                color: (st.percentage || 0) >= 75 ? '#16a34a' : (st.percentage || 0) >= 40 ? '#2563eb' : '#dc2626'
                              }}>
                                {st.percentage || 0}%
                              </span>
                            </td>

                            <td style={{ padding: '10px 12px' }}>
                              <input
                                style={S.input}
                                placeholder="e.g. Good grasp of concepts"
                                value={st.remarks}
                                onChange={e => handleRemarkChange(idx, e.target.value)}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                      <button onClick={handleBatchSave} disabled={saving} style={S.btnPrimary}>
                        {saving ? 'Saving...' : '💾 Save Internal Marks'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* STUDENT / PARENT VIEW: TRANSPARENT INTERNAL MARKS CARD             */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {isStudent && (
            <div style={S.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <h3 style={S.cardTitle}>
                    <i className="ti ti-report-analytics" /> {myStudentName} — Subject-Wise Continuous Assessment
                  </h3>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                    Class: <strong>{myClassDisplay}</strong> &nbsp;·&nbsp; Session: <strong>{academicYear}</strong>
                  </div>
                </div>
                <button onClick={loadStudentMarks} style={S.btnGhost}><i className="ti ti-refresh" /></button>
              </div>

              {loadingMyMarks ? (
                <div style={S.emptyBox}>⏳ Loading your marks...</div>
              ) : myInternalMarks.length === 0 ? (
                <div style={{ ...S.emptyBox, padding: 50 }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>📊</div>
                  <div>No internal assessment marks recorded yet for this session.</div>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', color: '#475569', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
                        <th style={{ padding: '10px 12px', textAlign: 'left' }}>Subject</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left' }}>Component / Term</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left' }}>Teacher</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left' }}>Score</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left' }}>Percentage</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left' }}>Teacher Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {myInternalMarks.map(m => (
                        <tr key={m.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 12px', fontWeight: 800, color: '#0b3b7b' }}>
                            {m.subject_name}
                          </td>

                          <td style={{ padding: '10px 12px', color: '#475569' }}>
                            <span style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: 6, fontSize: 11.5, fontWeight: 700 }}>
                              {m.term}
                            </span>
                          </td>

                          <td style={{ padding: '10px 12px', color: '#334155' }}>
                            {m.teacher_name || 'Subject Teacher'}
                          </td>

                          <td style={{ padding: '10px 12px', fontWeight: 900, color: '#0f172a', fontSize: 14 }}>
                            {m.marks_obtained} <span style={{ fontSize: 11.5, color: '#64748b', fontWeight: 600 }}>/ {m.max_marks}</span>
                          </td>

                          <td style={{ padding: '10px 12px' }}>
                            <span style={{
                              fontWeight: 800,
                              color: m.percentage >= 75 ? '#16a34a' : m.percentage >= 40 ? '#2563eb' : '#dc2626'
                            }}>
                              {m.percentage}%
                            </span>
                          </td>

                          <td style={{ padding: '10px 12px', color: '#475569' }}>
                            {m.remarks || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
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
};
