import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar  from '../components/Navbar';
import api     from '../api/axios';
import toast   from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

/* ═══════════════════════════════════════════════════════════════════════
   SHARED HELPERS + SMALL COMPONENTS
   ═══════════════════════════════════════════════════════════════════════ */

const STATUS_META = {
  DRAFT:                    { label: 'Draft',      color: '#747474', bg: '#f3f2f2' },
  SUBMITTED:                { label: 'Submitted',  color: '#0176d3', bg: '#e8f4fd' },
  RESUBMITTED:              { label: 'Resubmitted',color: '#0176d3', bg: '#e8f4fd' },
  RETURNED_FOR_CORRECTION:  { label: 'Returned',   color: '#ba0517', bg: '#fdecea' },
  APPROVED:                 { label: 'Approved',   color: '#2e844a', bg: '#e6f4ea' },
  PUBLISHED:                { label: 'Published',  color: '#2e844a', bg: '#e6f4ea' },
  NOT_PUBLISHED:            { label: 'Not Published', color: '#dd7a01', bg: '#fef3c7' },
  REOPENED:                 { label: 'Reopened',   color: '#dd7a01', bg: '#fef3c7' },
};

function StatusBadge({ status, style }) {
  const m = STATUS_META[status] || { label: status || '—', color: '#747474', bg: '#f3f2f2' };
  return (
    <span className="badge" style={{ background: m.bg, color: m.color, fontWeight: 700, ...style }}>
      {m.label}
    </span>
  );
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const STUDENT_STATUS_OPTIONS = [
  { value: 'PASS',          label: 'Pass' },
  { value: 'FAIL',          label: 'Fail' },
  { value: 'ABSENT',        label: 'Absent' },
  { value: 'MEDICAL_LEAVE', label: 'Medical Leave' },
  { value: 'NOT_EVALUATED', label: 'Not Evaluated' },
];

/* Small modal shell shared by History / Return / Preview / Reopen */
function Modal({ title, onClose, children, width = 620 }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }} onClick={onClose}>
      <div className="card" style={{ margin: 0, width: '100%', maxWidth: width, maxHeight: '86vh', display: 'flex', flexDirection: 'column' }}
           onClick={e => e.stopPropagation()}>
        <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <strong>{title}</strong>
          <button className="btn btn-neutral btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="card-body" style={{ overflowY: 'auto' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

/* ── History timeline modal (spec section 5) ── */
function HistoryModal({ studentId, subjectId, examId, studentName, rollNo, subjectName, onClose }) {
  const [logs, setLogs] = useState(null);
  useEffect(() => {
    api.get(`/results/history?student_id=${studentId}&subject_id=${subjectId}&exam_id=${examId}`)
      .then(r => setLogs(r.data || []))
      .catch(() => toast.error('History load nahi hui'));
  }, [studentId, subjectId, examId]);

  return (
    <Modal title="Mark Change History" onClose={onClose}>
      <div style={{ marginBottom: 14, fontSize: 13, color: 'var(--neutral-6)' }}>
        <div><strong style={{ color: 'var(--neutral-9)' }}>{studentName}</strong> · Roll {rollNo}</div>
        <div>{subjectName}</div>
      </div>
      {logs === null ? (
        <div style={{ fontSize: 13, color: 'var(--neutral-6)' }}>Loading…</div>
      ) : logs.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--neutral-6)', textAlign: 'center', padding: '20px 0' }}>No changes recorded yet.</div>
      ) : (
        <div style={{ position: 'relative', paddingLeft: 18 }}>
          <div style={{ position: 'absolute', left: 5, top: 4, bottom: 4, width: 2, background: 'var(--neutral-2)' }} />
          {logs.map(l => (
            <div key={l.id} style={{ position: 'relative', marginBottom: 18 }}>
              <div style={{
                position: 'absolute', left: -18, top: 2, width: 10, height: 10, borderRadius: '50%',
                background: l.action_type === 'RETURNED' ? '#ba0517' : l.action_type?.includes('PUBLISH') ? '#2e844a' : '#0176d3',
                border: '2px solid #fff', boxShadow: '0 0 0 1px var(--neutral-2)',
              }} />
              <div style={{ fontSize: 11, color: 'var(--neutral-6)', fontWeight: 600 }}>{fmtDate(l.created_at)}</div>
              <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>
                {l.action_type === 'MARK_CREATED' && 'Marks Added'}
                {l.action_type === 'MARK_UPDATED' && 'Marks Edited'}
                {l.action_type === 'SUBMITTED' && 'Submitted to Principal'}
                {l.action_type === 'RESUBMITTED' && 'Resubmitted to Principal'}
                {l.action_type === 'RETURNED' && 'Returned for Correction'}
                {l.action_type === 'APPROVED' && 'Approved'}
                {l.action_type === 'RESULT_PUBLISHED' && 'Result Published'}
                {l.action_type === 'RESULT_REOPENED' && 'Result Reopened'}
                {l.action_type === 'RESULT_REPUBLISHED' && 'Result Republished'}
              </div>
              {(l.old_marks !== null || l.new_marks !== null) && (l.action_type === 'MARK_CREATED' || l.action_type === 'MARK_UPDATED') && (
                <div style={{ fontSize: 13, marginTop: 2 }}>
                  <span style={{ color: 'var(--neutral-6)' }}>{l.old_marks ?? '—'}</span>
                  {' → '}
                  <span style={{ fontWeight: 700, color: '#0176d3' }}>{l.new_marks ?? '—'}</span>
                </div>
              )}
              <div style={{ fontSize: 12, color: 'var(--neutral-6)', marginTop: 2 }}>
                By: {l.changed_by_name} {l.changed_by_role ? `(${l.changed_by_role.replace('_',' ')})` : ''}
              </div>
              {l.change_reason && (
                <div style={{ fontSize: 12, color: 'var(--neutral-6)', marginTop: 2 }}>Reason: {l.change_reason}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   ROOT — routes to Teacher or Principal view based on role
   ═══════════════════════════════════════════════════════════════════════ */

export default function ResultManagement() {
  const { user } = useAuth();
  if (!user) return null;
  const isTeacher = user.role === 'TEACHER';
  return isTeacher ? <TeacherMarkEntry user={user} /> : <PrincipalResultManagement user={user} />;
}

/* ═══════════════════════════════════════════════════════════════════════
   TEACHER — MARK ENTRY (Draft → Submit, with History + Return handling)
   ═══════════════════════════════════════════════════════════════════════ */

function TeacherMarkEntry({ user }) {
  const [assignments, setAssignments] = useState([]);
  const [exams, setExams]           = useState([]);
  const [classId, setClassId]       = useState('');
  const [subjectId, setSubjectId]   = useState('');
  const [examId, setExamId]         = useState('');

  const [data, setData]             = useState(null);   // full /results/roster response
  const [cells, setCells]           = useState({});      // studentId -> {marks_obtained,is_absent,student_status,remarks,version}
  const [loading, setLoading]       = useState(false);
  const [saving, setSaving]         = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reason, setReason]         = useState('');
  const [historyFor, setHistoryFor] = useState(null);

  useEffect(() => {
    api.get('/results/my-assignments').then(r => setAssignments(r.data || [])).catch(() => toast.error('Assignments load nahi hue'));
    api.get('/principal/exams').then(r => setExams(r.data || [])).catch(() => {});
  }, []);

  const selectedClass = assignments.find(c => String(c.id) === String(classId));
  const subjectsForClass = selectedClass?.subjects || [];

  const loadRoster = useCallback(() => {
    if (!classId || !examId || !subjectId) { setData(null); setCells({}); return; }
    setLoading(true);
    api.get(`/results/roster?class_id=${classId}&exam_id=${examId}&subject_id=${subjectId}`)
      .then(r => {
        setData(r.data);
        const c = {};
        (r.data.roster || []).forEach(row => {
          c[row.student_id] = {
            marks_obtained: row.marks_obtained,
            is_absent: row.is_absent,
            student_status: row.student_status,
            remarks: row.remarks || '',
            version: row.version || 0,
          };
        });
        setCells(c);
        setReason('');
      })
      .catch(() => toast.error('Roster load nahi hua'))
      .finally(() => setLoading(false));
  }, [classId, examId, subjectId]);

  useEffect(() => { loadRoster(); }, [loadRoster]);

  function updateCell(studentId, field, value) {
    setCells(prev => ({ ...prev, [studentId]: { ...(prev[studentId] || {}), [field]: value } }));
  }

  function buildEntries() {
    return (data?.roster || []).map(row => {
      const c = cells[row.student_id] || {};
      return {
        student_id: row.student_id,
        marks_obtained: c.is_absent || c.student_status === 'MEDICAL_LEAVE' ? null : c.marks_obtained,
        max_marks: row.max_marks,
        is_absent: !!c.is_absent,
        student_status: c.student_status,
        remarks: c.remarks || '',
        version: c.version || 0,
      };
    });
  }

  async function handleSaveDraft() {
    if (!data) return;
    const needsReason = ['SUBMITTED', 'RESUBMITTED'].includes(data.status?.status);
    if (needsReason && !reason.trim()) {
      toast.error('Already-submitted marks ko correct karne ke liye reason likhna zaroori hai');
      return;
    }
    setSaving(true);
    try {
      const res = await api.post('/results/save-draft', {
        class_id: classId, exam_id: examId, subject_id: subjectId,
        entries: buildEntries(), reason,
      });
      toast.success(res.data.message || 'Saved');
      loadRoster();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Save nahi hua');
    }
    setSaving(false);
  }

  async function handleSubmit() {
    if (!window.confirm('Submit karne ke baad aap freely edit nahi kar sakenge jab tak Principal return na kare. Continue?')) return;
    setSubmitting(true);
    try {
      const res = await api.post('/results/submit', { class_id: classId, exam_id: examId, subject_id: subjectId });
      toast.success(res.data.message || 'Submitted');
      loadRoster();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Submit nahi hua');
    }
    setSubmitting(false);
  }

  const status = data?.status?.status;
  const canEdit = data?.can_edit;
  const canSubmit = ['DRAFT', 'RETURNED_FOR_CORRECTION'].includes(status);

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar title="Mark Entry" />
        <div className="page-body">
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header"><strong>Mark Entry</strong></div>
            <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
              <div>
                <label className="form-label">Class / Section</label>
                <select className="form-select" value={classId} onChange={e => { setClassId(e.target.value); setSubjectId(''); }}>
                  <option value="">Select class</option>
                  {assignments.map(c => <option key={c.id} value={c.id}>{c.name} - {c.section}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Subject</label>
                <select className="form-select" value={subjectId} onChange={e => setSubjectId(e.target.value)} disabled={!classId}>
                  <option value="">Select subject</option>
                  {subjectsForClass.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Exam</label>
                <select className="form-select" value={examId} onChange={e => setExamId(e.target.value)}>
                  <option value="">Select exam</option>
                  {exams.map(e => <option key={e.id} value={e.id}>{e.exam_name}</option>)}
                </select>
              </div>
            </div>
          </div>

          {!classId || !examId || !subjectId ? (
            <div className="card"><div className="card-body" style={{ textAlign: 'center', color: 'var(--neutral-6)', padding: 40 }}>
              ☝️ Class, Subject aur Exam select karo — student list dikhegi
            </div></div>
          ) : loading ? (
            <div className="card"><div className="card-body">Loading…</div></div>
          ) : !data ? null : (
            <>
              {status === 'RETURNED_FOR_CORRECTION' && (
                <div className="card" style={{ marginBottom: 16, borderColor: '#f5c6cb' }}>
                  <div className="card-body" style={{ background: '#fdecea', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 18 }}>⚠️</span>
                    <div>
                      <div style={{ fontWeight: 700, color: '#ba0517' }}>Returned for Correction</div>
                      <div style={{ fontSize: 13, color: '#7f1d1d', marginTop: 2 }}>{data.status.return_reason}</div>
                    </div>
                  </div>
                </div>
              )}

              <div className="card">
                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <strong>{data.subject.name} — {data.class.name} {data.class.section}</strong>
                    <StatusBadge status={status} />
                  </div>
                  {canEdit && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-neutral btn-sm" disabled={saving} onClick={handleSaveDraft}>
                        {saving ? 'Saving…' : '💾 Save Draft'}
                      </button>
                      {canSubmit && (
                        <button className="btn btn-primary btn-sm" disabled={submitting} onClick={handleSubmit}>
                          {submitting ? 'Submitting…' : '📤 Submit to Principal'}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {!canEdit && (
                  <div style={{ padding: '10px 20px', background: '#fff8e6', fontSize: 12.5, color: '#92600a' }}>
                    🔒 Marks are <strong>{STATUS_META[status]?.label || status}</strong> — editing is locked. {status === 'SUBMITTED' || status === 'RESUBMITTED' ? 'Waiting for Principal review.' : ''}
                  </div>
                )}

                {['SUBMITTED', 'RESUBMITTED'].includes(status) && canEdit && (
                  <div style={{ padding: '10px 20px' }}>
                    <input className="form-input" placeholder="Reason for correcting already-submitted marks (required to save)"
                      value={reason} onChange={e => setReason(e.target.value)} />
                  </div>
                )}

                <div className="card-body" style={{ padding: 0 }}>
                  <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr>
                          <th style={{ padding: '10px 12px' }}>Roll No.</th>
                          <th style={{ padding: '10px 12px' }}>Student</th>
                          <th style={{ padding: '10px 12px', textAlign: 'center' }}>Max Marks</th>
                          <th style={{ padding: '10px 12px', textAlign: 'center' }}>Marks Obtained</th>
                          <th style={{ padding: '10px 12px', textAlign: 'center' }}>Grade</th>
                          <th style={{ padding: '10px 12px', textAlign: 'center' }}>Status</th>
                          <th style={{ padding: '10px 12px' }}>Remarks</th>
                          <th style={{ padding: '10px 12px', textAlign: 'center' }}>History</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.roster.map(row => {
                          const c = cells[row.student_id] || {};
                          const disabled = !canEdit || c.is_absent || c.student_status === 'MEDICAL_LEAVE';
                          const grade = row.grade || '—';
                          return (
                            <tr key={row.student_id} style={{ borderBottom: '1px solid var(--neutral-2)', background: row.flagged_for_correction ? '#fff8f8' : 'transparent' }}>
                              <td style={{ padding: '8px 12px', fontWeight: 600 }}>{row.roll_number || '—'}</td>
                              <td style={{ padding: '8px 12px' }}>
                                {row.name}
                                {row.flagged_for_correction && <span title="Principal flagged this student" style={{ marginLeft: 6, color: '#ba0517' }}>⚑</span>}
                                {row.was_modified && <span title="Marks were edited after entry" className="badge" style={{ marginLeft: 6, background: '#fef3c7', color: '#92600a', fontSize: 10 }}>Modified</span>}
                              </td>
                              <td style={{ padding: '8px 12px', textAlign: 'center' }}>{row.max_marks}</td>
                              <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                <input type="number" min={0} max={row.max_marks} className="form-input" style={{ width: 80, textAlign: 'center', padding: '4px 6px' }}
                                  disabled={disabled}
                                  value={c.marks_obtained ?? ''}
                                  onChange={e => updateCell(row.student_id, 'marks_obtained', e.target.value === '' ? null : Number(e.target.value))}
                                />
                              </td>
                              <td style={{ padding: '8px 12px', textAlign: 'center' }}>{grade}</td>
                              <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                <select className="form-select" style={{ padding: '4px 6px', fontSize: 12 }} disabled={!canEdit}
                                  value={c.student_status || 'NOT_EVALUATED'}
                                  onChange={e => {
                                    const v = e.target.value;
                                    updateCell(row.student_id, 'student_status', v);
                                    updateCell(row.student_id, 'is_absent', v === 'ABSENT');
                                  }}>
                                  {STUDENT_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                              </td>
                              <td style={{ padding: '8px 12px' }}>
                                <input className="form-input" style={{ padding: '4px 8px', fontSize: 12 }} disabled={!canEdit}
                                  value={c.remarks || ''} onChange={e => updateCell(row.student_id, 'remarks', e.target.value)} />
                              </td>
                              <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                <button className="btn btn-neutral btn-sm" onClick={() => setHistoryFor(row)}>🕘</button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {historyFor && (
        <HistoryModal
          studentId={historyFor.student_id} subjectId={subjectId} examId={examId}
          studentName={historyFor.name} rollNo={historyFor.roll_number} subjectName={data?.subject?.name}
          onClose={() => setHistoryFor(null)}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   PRINCIPAL — RESULT MANAGEMENT DASHBOARD
   (Subject Submission Status / Review & Approve / Publish Result)
   ═══════════════════════════════════════════════════════════════════════ */

function PrincipalResultManagement({ user }) {
  const [classes, setClasses] = useState([]);
  const [exams, setExams]     = useState([]);
  const [classId, setClassId] = useState('');
  const [examId, setExamId]   = useState('');
  const [tab, setTab]         = useState('status'); // status | review | publish

  const [dash, setDash]       = useState(null);
  const [activity, setActivity] = useState([]);
  const [loadingDash, setLoadingDash] = useState(false);

  const [reviewSubjectId, setReviewSubjectId] = useState('');
  const [roster, setRoster] = useState(null);
  const [cells, setCells]   = useState({});
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [saving, setSaving] = useState(false);

  const [returnModal, setReturnModal] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [returnScope, setReturnScope] = useState('ALL'); // ALL | SPECIFIC
  const [returnStudentIds, setReturnStudentIds] = useState([]);

  const [historyFor, setHistoryFor] = useState(null);
  const [precheck, setPrecheck] = useState(null);
  const [preview, setPreview] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const [forcePublish, setForcePublish] = useState(false);
  const [forceReason, setForceReason] = useState('');
  const [showReopen, setShowReopen] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    api.get('/principal/classes').then(r => setClasses(r.data || [])).catch(() => {});
    api.get('/principal/exams').then(r => setExams(r.data || [])).catch(() => {});
  }, []);

  const loadDashboard = useCallback(() => {
    if (!classId || !examId) { setDash(null); return; }
    setLoadingDash(true);
    Promise.all([
      api.get(`/results/principal/dashboard?class_id=${classId}&exam_id=${examId}`),
      api.get(`/results/activity?class_id=${classId}&exam_id=${examId}&limit=15`),
    ]).then(([d, a]) => { setDash(d.data); setActivity(a.data || []); })
      .catch(() => toast.error('Dashboard load nahi hua'))
      .finally(() => setLoadingDash(false));
  }, [classId, examId]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  const loadReview = useCallback(() => {
    if (!classId || !examId || !reviewSubjectId) { setRoster(null); return; }
    setLoadingRoster(true);
    api.get(`/results/roster?class_id=${classId}&exam_id=${examId}&subject_id=${reviewSubjectId}`)
      .then(r => {
        setRoster(r.data);
        const c = {};
        (r.data.roster || []).forEach(row => {
          c[row.student_id] = { marks_obtained: row.marks_obtained, is_absent: row.is_absent, student_status: row.student_status, remarks: row.remarks || '', version: row.version || 0 };
        });
        setCells(c);
      })
      .catch(() => toast.error('Roster load nahi hua'))
      .finally(() => setLoadingRoster(false));
  }, [classId, examId, reviewSubjectId]);

  useEffect(() => { loadReview(); }, [loadReview]);

  useEffect(() => {
    if (tab === 'publish' && classId && examId) {
      api.get(`/results/publish/precheck?class_id=${classId}&exam_id=${examId}`).then(r => setPrecheck(r.data)).catch(() => {});
    }
  }, [tab, classId, examId, dash]);

  function openReview(subjectId) { setReviewSubjectId(subjectId); setTab('review'); }
  function updateCell(studentId, field, value) { setCells(prev => ({ ...prev, [studentId]: { ...(prev[studentId] || {}), [field]: value } })); }

  async function handlePrincipalSave() {
    if (!roster) return;
    setSaving(true);
    try {
      const entries = roster.roster.map(row => {
        const c = cells[row.student_id] || {};
        return {
          student_id: row.student_id,
          marks_obtained: c.is_absent || c.student_status === 'MEDICAL_LEAVE' ? null : c.marks_obtained,
          max_marks: row.max_marks, is_absent: !!c.is_absent, student_status: c.student_status,
          remarks: c.remarks || '', version: c.version || 0,
        };
      });
      const reason = window.prompt('Reason for this correction (shown in audit history):', 'Verified against answer sheet');
      if (reason === null) { setSaving(false); return; }
      await api.post('/results/save-draft', { class_id: classId, exam_id: examId, subject_id: reviewSubjectId, entries, reason });
      toast.success('Marks updated');
      loadReview();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Save nahi hua');
    }
    setSaving(false);
  }

  async function handleApprove() {
    try {
      await api.post('/results/principal/approve', { class_id: classId, exam_id: examId, subject_id: reviewSubjectId });
      toast.success('Subject approved');
      loadReview(); loadDashboard();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Approve nahi hua');
    }
  }

  async function handleDeleteMark(row) {
     const reason = window.prompt(`Delete ${row.name}'s marks — reason:`);
     if (!reason || !reason.trim()) return;
     try {
       await api.post('/results/principal/delete-mark', {
         student_id: row.student_id, subject_id: reviewSubjectId, exam_id: examId, reason,
       });
       toast.success('Mark entry deleted');
       loadReview();
     } catch (err) {
       toast.error(err?.response?.data?.error || 'Delete nahi hua');
     }
   }

  async function handleReturn() {
    if (!returnReason.trim()) { toast.error('Reason is mandatory'); return; }
    try {
      await api.post('/results/principal/return', {
        class_id: classId, exam_id: examId, subject_id: reviewSubjectId,
        reason: returnReason, student_ids: returnScope === 'SPECIFIC' ? returnStudentIds : [],
      });
      toast.success('Returned for correction');
      setReturnModal(false); setReturnReason(''); setReturnStudentIds([]); setReturnScope('ALL');
      loadReview(); loadDashboard();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Return nahi hua');
    }
  }

  async function openPreview() {
    try {
      const r = await api.get(`/results/publish/preview?class_id=${classId}&exam_id=${examId}`);
      setPreview(r.data); setShowPreview(true);
    } catch { toast.error('Preview load nahi hua'); }
  }

  async function handlePublish() {
     if (forcePublish && !forceReason.trim()) { toast.error('Reason is mandatory for force publish'); return; }
     setPublishing(true);
     try {
       await api.post('/results/publish', { class_id: classId, exam_id: examId, force: forcePublish, reason: forceReason });
      toast.success('🎉 Result published!');
      setShowPublishConfirm(false); setShowPreview(false);
      loadDashboard();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Publish nahi hua');
    }
    setPublishing(false);
  }

  async function handleReopen() {
    if (!reopenReason.trim()) { toast.error('Reason is mandatory'); return; }
    try {
      await api.post('/results/reopen', { class_id: classId, exam_id: examId, reason: reopenReason });
      toast.success('Result reopened');
      setShowReopen(false); setReopenReason('');
      loadDashboard();
    } catch (err) { toast.error(err?.response?.data?.error || 'Reopen nahi hua'); }
  }

  async function handleRepublish() {
    try {
      await api.post('/results/republish', { class_id: classId, exam_id: examId });
      toast.success('Result republished');
      loadDashboard();
    } catch (err) { toast.error(err?.response?.data?.error || 'Republish nahi hua'); }
  }

  const counts = dash?.counts;
  const pieData = counts ? [
    { name: 'Submitted', value: counts.submitted, color: '#0176d3' },
    { name: 'Pending',   value: counts.pending,   color: '#dd7a01' },
    { name: 'Returned',  value: counts.returned,  color: '#ba0517' },
    { name: 'Approved',  value: counts.approved,  color: '#2e844a' },
  ].filter(d => d.value > 0) : [];

  const pubStatus = dash?.publication?.status || 'NOT_PUBLISHED';

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar title="Result Management" />
        <div className="page-body">
          <div style={{ marginBottom: 18 }}>
            <h2 style={{ margin: 0 }}>Result Management</h2>
            <p style={{ margin: '4px 0 0' }}>Manage marks, review and publish results</p>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 14, alignItems: 'end' }}>
              <div>
                <label className="form-label">Class</label>
                <select className="form-select" value={classId} onChange={e => { setClassId(e.target.value); setTab('status'); }}>
                  <option value="">Select class</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name} - {c.section}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Exam</label>
                <select className="form-select" value={examId} onChange={e => { setExamId(e.target.value); setTab('status'); }}>
                  <option value="">Select exam</option>
                  {exams.map(e => <option key={e.id} value={e.id}>{e.exam_name}</option>)}
                </select>
              </div>
              <div><StatusBadge status={pubStatus} /></div>
            </div>
          </div>

          {!classId || !examId ? (
            <div className="card"><div className="card-body" style={{ textAlign: 'center', color: 'var(--neutral-6)', padding: 40 }}>
              ☝️ Class aur Exam select karo
            </div></div>
          ) : loadingDash || !dash ? (
            <div className="card"><div className="card-body">Loading…</div></div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '2.4fr 1fr', gap: 18 }}>
              {/* ── LEFT: tabs ── */}
              <div>
                <div style={{ display: 'flex', gap: 4, marginBottom: 12, borderBottom: '2px solid var(--neutral-2)' }}>
                  {[
                    { key: 'status', label: 'Subject Submission Status' },
                    { key: 'review', label: 'Review & Approve Results' },
                    { key: 'publish', label: 'Publish Result' },
                  ].map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)}
                      style={{
                        padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer',
                        fontWeight: 700, fontSize: 13,
                        color: tab === t.key ? '#0176d3' : 'var(--neutral-6)',
                        borderBottom: tab === t.key ? '2px solid #0176d3' : '2px solid transparent', marginBottom: -2,
                      }}>{t.label}</button>
                  ))}
                </div>

                {tab === 'status' && (
                  <div className="card">
                    <div className="card-header">
                      <strong>Subject Submission Status — {dash.class.name} - {dash.class.section} | {dash.exam.exam_name}</strong>
                    </div>
                    <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead><tr>
                          <th style={{ padding: '10px 12px' }}>#</th>
                          <th style={{ padding: '10px 12px' }}>Subject</th>
                          <th style={{ padding: '10px 12px' }}>Teacher</th>
                          <th style={{ padding: '10px 12px' }}>Status</th>
                          <th style={{ padding: '10px 12px' }}>Submitted On</th>
                          <th style={{ padding: '10px 12px' }}>Action</th>
                        </tr></thead>
                        <tbody>
                          {dash.subjects.map((s, i) => (
                            <tr key={s.subject_id} style={{ borderBottom: '1px solid var(--neutral-2)' }}>
                              <td style={{ padding: '8px 12px' }}>{i + 1}</td>
                              <td style={{ padding: '8px 12px', fontWeight: 600 }}>{s.subject_name}</td>
                              <td style={{ padding: '8px 12px' }}>{s.teacher_name}</td>
                              <td style={{ padding: '8px 12px' }}><StatusBadge status={s.status} /></td>
                              <td style={{ padding: '8px 12px' }}>{fmtDate(s.submitted_at)}</td>
                              <td style={{ padding: '8px 12px' }}>
                                <button className="btn btn-neutral btn-sm" onClick={() => openReview(s.subject_id)}>
                                  {s.status === 'RETURNED_FOR_CORRECTION' ? 'Review' : 'View Marks'}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div style={{ padding: '12px 20px', background: '#eef6ff', fontSize: 12.5, color: '#014486' }}>
                      ℹ️ Result will be visible to students and parents only after you publish the result.
                    </div>
                  </div>
                )}

                {tab === 'review' && (
                  <div className="card">
                    <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                      <select className="form-select" style={{ width: 220 }} value={reviewSubjectId} onChange={e => setReviewSubjectId(e.target.value)}>
                        <option value="">Select subject to review</option>
                        {dash.subjects.map(s => <option key={s.subject_id} value={s.subject_id}>{s.subject_name} ({STATUS_META[s.status]?.label})</option>)}
                      </select>
                      {roster && ['SUBMITTED', 'RESUBMITTED'].includes(roster.status.status) && (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className="btn btn-destructive btn-sm" onClick={() => setReturnModal(true)}>↩️ Return for Correction</button>
                          <button className="btn btn-primary btn-sm" onClick={handleApprove}>✅ Approve</button>
                        </div>
                      )}
                    </div>
                    {!reviewSubjectId ? (
                      <div className="card-body" style={{ textAlign: 'center', color: 'var(--neutral-6)' }}>Select a subject above</div>
                    ) : loadingRoster || !roster ? (
                      <div className="card-body">Loading…</div>
                    ) : (
                      <>
                        {roster.status.status === 'APPROVED' && (
                          <div style={{ padding: '10px 20px', background: '#e6f4ea', fontSize: 12.5, color: '#155724' }}>
                            ✅ Approved — corrections still possible via <strong>Reopen Result</strong> once published, or edit now before publishing the class.
                          </div>
                        )}
                        <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                            <thead><tr>
                              <th style={{ padding: '10px 12px' }}>Roll No</th>
                              <th style={{ padding: '10px 12px' }}>Student</th>
                              <th style={{ padding: '10px 12px', textAlign: 'center' }}>Marks</th>
                              <th style={{ padding: '10px 12px', textAlign: 'center' }}>Max</th>
                              <th style={{ padding: '10px 12px', textAlign: 'center' }}>Grade</th>
                              <th style={{ padding: '10px 12px', textAlign: 'center' }}>Status</th>
                              <th style={{ padding: '10px 12px' }}>Remarks</th>
                              <th style={{ padding: '10px 12px', textAlign: 'center' }}>History</th>
                            </tr></thead>
                            <tbody>
                              {roster.roster.map(row => {
                                const c = cells[row.student_id] || {};
                                const editable = !!roster.can_edit;
                                return (
                                  <tr key={row.student_id} style={{ borderBottom: '1px solid var(--neutral-2)' }}>
                                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>{row.roll_number}</td>
                                    <td style={{ padding: '8px 12px' }}>
                                      {row.name}
                                      {row.was_modified && <span className="badge" style={{ marginLeft: 6, background: '#fef3c7', color: '#92600a', fontSize: 10 }}>Modified</span>}
                                    </td>
                                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                      {editable ? (
                                        <input type="number" className="form-input" style={{ width: 70, textAlign: 'center', padding: '4px 6px' }}
                                          value={c.marks_obtained ?? ''} disabled={c.is_absent}
                                          onChange={e => updateCell(row.student_id, 'marks_obtained', e.target.value === '' ? null : Number(e.target.value))} />
                                      ) : (row.marks_obtained ?? '—')}
                                    </td>
                                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>{row.max_marks}</td>
                                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>{row.grade || '—'}</td>
                                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>{STUDENT_STATUS_OPTIONS.find(o => o.value === (c.student_status || row.student_status))?.label || row.student_status}</td>
                                    <td style={{ padding: '8px 12px' }}>{editable ? (
                                      <input className="form-input" style={{ padding: '4px 8px', fontSize: 12 }} value={c.remarks || ''}
                                        onChange={e => updateCell(row.student_id, 'remarks', e.target.value)} />
                                    ) : (row.remarks || '—')}</td>
                                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                      <button className="btn btn-neutral btn-sm" onClick={() => setHistoryFor(row)}>🕘</button>
                                      {row.marks_record_id && (
                                        <button className="btn btn-destructive btn-sm" style={{ marginLeft: 4 }}
                                          onClick={() => handleDeleteMark(row)}>🗑️</button>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        {['SUBMITTED', 'RESUBMITTED'].includes(roster.status.status) && (
                          <div className="card-footer" style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button className="btn btn-neutral btn-sm" disabled={saving} onClick={handlePrincipalSave}>
                              {saving ? 'Saving…' : '💾 Save Corrections'}
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {tab === 'publish' && (
                  <div className="card">
                    <div className="card-header"><strong>Publish Result</strong></div>
                    <div className="card-body">
                      {pubStatus === 'PUBLISHED' ? (
                        <div>
                          <div style={{ background: '#e6f4ea', color: '#155724', padding: 12, borderRadius: 8, marginBottom: 14 }}>
                            ✅ Published on {fmtDate(dash.publication.published_at)}. Students &amp; parents can now view this result.
                          </div>
                          <button className="btn btn-destructive btn-sm" onClick={() => setShowReopen(true)}>🔓 Reopen Result / Request Correction</button>
                        </div>
                      ) : pubStatus === 'REOPENED' ? (
                        <div>
                          <div style={{ background: '#fef3c7', color: '#92600a', padding: 12, borderRadius: 8, marginBottom: 14 }}>
                            🔓 Reopened — {dash.publication.reopen_reason}. Make corrections in Review tab, then republish.
                          </div>
                          <button className="btn btn-primary btn-sm" onClick={handleRepublish}>📤 Republish Result</button>
                        </div>
                      ) : precheck?.can_publish ? (
                        <div>
                          <div style={{ background: '#e6f4ea', color: '#155724', padding: 12, borderRadius: 8, marginBottom: 14 }}>
                            ✅ All subjects approved — ready to publish.
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn btn-neutral btn-sm" onClick={openPreview}>👁️ Preview Final Result</button>
                            <button className="btn btn-primary btn-sm" onClick={() => setShowPublishConfirm(true)}>🚀 Publish Result</button>
                          </div>
                        </div>
                      ) : (
                       <div>
                         <div style={{ background: '#fdecea', color: '#7f1d1d', padding: 12, borderRadius: 8, marginBottom: 10, fontWeight: 700 }}>
                           Cannot Publish Result
                         </div>
                         <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: '#7f1d1d', marginBottom: 14 }}>
                           {(precheck?.blockers || []).map((b, i) => <li key={i} style={{ marginBottom: 4 }}>{b}</li>)}
                         </ul>
                         <button className="btn btn-destructive btn-sm" onClick={() => { setForcePublish(true); setShowPublishConfirm(true); }}>
                           ⚠️ Force Publish Anyway (Override)
                         </button>
                       </div>
                     )}
                    </div>
                  </div>
                )}
              </div>

              {/* ── RIGHT: progress + quick actions + activity ── */}
              <div>
                <div className="card" style={{ marginBottom: 16 }}>
                  <div className="card-header"><strong>Overall Progress</strong></div>
                  <div className="card-body" style={{ textAlign: 'center' }}>
                    <div style={{ height: 170, position: 'relative' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={pieData.length ? pieData : [{ name: 'None', value: 1, color: '#e5e5e5' }]}
                               dataKey="value" innerRadius={55} outerRadius={78} paddingAngle={2}>
                            {(pieData.length ? pieData : [{ color: '#e5e5e5' }]).map((d, i) => <Cell key={i} fill={d.color} />)}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center' }}>
                        <div style={{ fontSize: 22, fontWeight: 800 }}>{counts.approved + counts.submitted + counts.returned}/{dash.total_subjects}</div>
                        <div style={{ fontSize: 11, color: 'var(--neutral-6)' }}>Subjects Touched</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'left', fontSize: 12.5, marginTop: 6 }}>
                      {pieData.map(d => (
                        <div key={d.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 4px' }}>
                          <span><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: d.color, marginRight: 6 }} />{d.name}</span>
                          <strong>{d.value}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="card" style={{ marginBottom: 16 }}>
                  <div className="card-header"><strong>Result Visibility Status</strong></div>
                  <div className="card-body" style={{ fontSize: 13 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                      <span>Students</span><StatusBadge status={pubStatus === 'PUBLISHED' ? 'PUBLISHED' : 'NOT_PUBLISHED'} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                      <span>Parents</span><StatusBadge status={pubStatus === 'PUBLISHED' ? 'PUBLISHED' : 'NOT_PUBLISHED'} />
                    </div>
                    {pubStatus !== 'PUBLISHED' && (
                      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--neutral-6)' }}>🔒 Result will be visible only after publishing.</div>
                    )}
                  </div>
                </div>

                <div className="card">
                  <div className="card-header"><strong>Recent Activity</strong></div>
                  <div className="card-body" style={{ maxHeight: 300, overflowY: 'auto' }}>
                    {activity.length === 0 ? (
                      <div style={{ fontSize: 12, color: 'var(--neutral-6)', textAlign: 'center' }}>No activity yet</div>
                    ) : activity.map(a => (
                      <div key={a.id} style={{ marginBottom: 12, fontSize: 12.5 }}>
                        <div style={{ fontWeight: 700 }}>{a.changed_by_name}</div>
                        <div style={{ color: 'var(--neutral-6)' }}>
                          {a.subject_name ? `${a.subject_name} — ` : ''}
                          {a.action_type === 'MARK_UPDATED' ? `Roll ${a.roll_number}: ${a.old_marks} → ${a.new_marks}` : a.action_type?.replaceAll('_', ' ').toLowerCase()}
                        </div>
                        <div style={{ color: 'var(--neutral-4)', fontSize: 11 }}>{fmtDate(a.created_at)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {historyFor && (
        <HistoryModal studentId={historyFor.student_id} subjectId={reviewSubjectId} examId={examId}
          studentName={historyFor.name} rollNo={historyFor.roll_number} subjectName={roster?.subject?.name}
          onClose={() => setHistoryFor(null)} />
      )}

      {returnModal && (
        <Modal title="Return for Correction" onClose={() => setReturnModal(false)}>
          <div style={{ marginBottom: 12 }}>
            <label className="form-label">Scope</label>
            <div style={{ display: 'flex', gap: 14, marginTop: 6 }}>
              <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="radio" checked={returnScope === 'ALL'} onChange={() => setReturnScope('ALL')} /> Entire subject
              </label>
              <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="radio" checked={returnScope === 'SPECIFIC'} onChange={() => setReturnScope('SPECIFIC')} /> Specific students
              </label>
            </div>
          </div>
          {returnScope === 'SPECIFIC' && (
            <div style={{ marginBottom: 12, maxHeight: 180, overflowY: 'auto', border: '1px solid var(--neutral-2)', borderRadius: 8, padding: 8 }}>
              {(roster?.roster || []).map(r => (
                <label key={r.student_id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '4px 0' }}>
                  <input type="checkbox" checked={returnStudentIds.includes(r.student_id)}
                    onChange={e => setReturnStudentIds(prev => e.target.checked ? [...prev, r.student_id] : prev.filter(id => id !== r.student_id))} />
                  Roll {r.roll_number} — {r.name}
                </label>
              ))}
            </div>
          )}
          <label className="form-label">Reason (mandatory)</label>
          <textarea className="form-textarea" rows={3} value={returnReason} onChange={e => setReturnReason(e.target.value)}
            placeholder="e.g. Please verify marks against answer sheets." />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
            <button className="btn btn-neutral btn-sm" onClick={() => setReturnModal(false)}>Cancel</button>
            <button className="btn btn-destructive btn-sm" onClick={handleReturn}>Return for Correction</button>
          </div>
        </Modal>
      )}

      {showPreview && preview && (
        <Modal title="Final Result Preview" onClose={() => setShowPreview(false)} width={760}>
          <div style={{ fontSize: 12, color: 'var(--neutral-6)', marginBottom: 10 }}>
            {preview.class.name} - {preview.class.section} · {preview.exam.exam_name} · {preview.exam.session}
          </div>
          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
            {preview.students.map(s => (
              <div key={s.student_id} className="card" style={{ margin: '0 0 10px' }}>
                <div className="card-body" style={{ padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <strong>{s.name} (Roll {s.roll_number})</strong>
                    <StatusBadge status={s.result === 'PASS' ? 'APPROVED' : 'RETURNED_FOR_CORRECTION'} style={{ background: s.result === 'PASS' ? '#e6f4ea' : '#fdecea', color: s.result === 'PASS' ? '#2e844a' : '#ba0517' }} />
                  </div>
                  <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                    <thead><tr style={{ color: 'var(--neutral-6)' }}>
                      <td>Subject</td><td style={{ textAlign: 'center' }}>Marks</td><td style={{ textAlign: 'center' }}>Grade</td>
                    </tr></thead>
                    <tbody>
                      {s.subjects.map((sub, i) => (
                        <tr key={i}><td>{sub.subject_name}</td>
                          <td style={{ textAlign: 'center' }}>{sub.marks_obtained ?? '—'}/{sub.max_marks}</td>
                          <td style={{ textAlign: 'center' }}>{sub.grade}</td></tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 13, fontWeight: 700 }}>
                    <span>{s.total_obtained}/{s.total_max} ({s.percentage}%)</span>
                    <span>Grade: {s.overall_grade}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
            <button className="btn btn-neutral btn-sm" onClick={() => setShowPreview(false)}>Close</button>
            <button className="btn btn-primary btn-sm" onClick={() => setShowPublishConfirm(true)}>Publish Result</button>
          </div>
        </Modal>
      )}

      {showPublishConfirm && (
        <Modal title={forcePublish ? 'Force Publish — Override' : 'Confirm Publish'} onClose={() => { setShowPublishConfirm(false); setForcePublish(false); setForceReason(''); }}>
          <p>You are about to publish results for <strong>{dash?.class?.name} - {dash?.class?.section}</strong>, <strong>{dash?.exam?.exam_name}</strong>.</p>
          <p style={{ color: 'var(--neutral-6)', fontSize: 13 }}>After publishing, results will become visible to students and parents.</p>
          {forcePublish && (
            <>
              <div style={{ background: '#fef3c7', color: '#92600a', padding: 10, borderRadius: 8, margin: '10px 0', fontSize: 13 }}>
                ⚠️ Some subjects are not yet approved. They will be auto-approved and published as-is.
              </div>
              <label className="form-label">Reason (mandatory)</label>
              <textarea className="form-textarea" rows={2} value={forceReason} onChange={e => setForceReason(e.target.value)}
                placeholder="e.g. Publishing before all subjects reviewed — board deadline." />
            </>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
            <button className="btn btn-neutral btn-sm" onClick={() => { setShowPublishConfirm(false); setForcePublish(false); setForceReason(''); }}>Cancel</button>
            <button className={forcePublish ? 'btn btn-destructive btn-sm' : 'btn btn-primary btn-sm'} disabled={publishing} onClick={handlePublish}>
              {publishing ? 'Publishing…' : forcePublish ? '⚠️ Force Publish' : 'Publish Result'}
            </button>
          </div>
        </Modal>
      )}

      {showReopen && (
        <Modal title="Reopen Result" onClose={() => setShowReopen(false)}>
          <label className="form-label">Reason (mandatory)</label>
          <textarea className="form-textarea" rows={3} value={reopenReason} onChange={e => setReopenReason(e.target.value)}
            placeholder="e.g. Marks correction requested after answer sheet re-evaluation." />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
            <button className="btn btn-neutral btn-sm" onClick={() => setShowReopen(false)}>Cancel</button>
            <button className="btn btn-destructive btn-sm" onClick={handleReopen}>Reopen Result</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
