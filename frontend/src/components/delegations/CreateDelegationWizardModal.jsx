import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function CreateDelegationWizardModal({ isOpen, onClose, onSuccess, session = '2024-25' }) {
  const [step, setStep] = useState(1);
  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loadingTeachers, setLoadingTeachers] = useState(false);

  // Step 1: Who
  const [sourceTeacherId, setSourceTeacherId] = useState('');
  const [delegateTeacherId, setDelegateTeacherId] = useState('');

  // Step 2: Scope
  const [selectedClassIds, setSelectedClassIds] = useState(new Set());
  const [selectedSubjectMap, setSelectedSubjectMap] = useState({}); // classId -> [subjectIds] or empty for all
  const [availableSubjectsByClass, setAvailableSubjectsByClass] = useState({});

  // Step 3: Access / Permissions
  const [selectedPermissions, setSelectedPermissions] = useState(
    new Set(['ATTENDANCE_MARK', 'MARKS_ENTER', 'STUDENT_VIEW', 'NOTES_MANAGE'])
  );

  // Step 4: When & Reason
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });
  const [startTime, setStartTime] = useState('08:00');
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().slice(0, 10);
  });
  const [endTime, setEndTime] = useState('16:00');
  const [reason, setReason] = useState('Medical Leave / Teacher Absent');
  const [notes, setNotes] = useState('');

  // Conflicts state
  const [conflicts, setConflicts] = useState([]);
  const [checkingConflicts, setCheckingConflicts] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoadingTeachers(true);
      api.get('/principal/delegations/teachers-lookup')
        .then(r => setTeachers(Array.isArray(r.data) ? r.data : []))
        .catch(() => toast.error('Failed to load teachers'))
        .finally(() => setLoadingTeachers(false));

      api.get('/principal/classes')
        .then(r => setClasses(Array.isArray(r.data) ? r.data : []))
        .catch(() => {});
    }
  }, [isOpen]);

  // When source teacher changes, auto-populate their classes
  useEffect(() => {
    if (sourceTeacherId) {
      const src = teachers.find(t => String(t.id) === String(sourceTeacherId));
      if (src && src.assignments && src.assignments.length > 0) {
        const cids = new Set(src.assignments.map(a => a.class_id));
        setSelectedClassIds(cids);

        // Pre-fill subjects
        const subMap = {};
        src.assignments.forEach(a => {
          if (!subMap[a.class_id]) subMap[a.class_id] = [];
          if (a.subject_id) subMap[a.class_id].push(a.subject_id);
        });
        setSelectedSubjectMap(subMap);
      }
    }
  }, [sourceTeacherId, teachers]);

  // Load subjects for selected classes
  useEffect(() => {
    Array.from(selectedClassIds).forEach(cid => {
      if (!availableSubjectsByClass[cid]) {
        api.get(`/principal/classes/${cid}`)
          .then(r => {
            const subjs = r.data.subjects || [];
            setAvailableSubjectsByClass(prev => ({ ...prev, [cid]: subjs }));
          })
          .catch(() => {});
      }
    });
  }, [selectedClassIds]);

  // Conflict detection
  useEffect(() => {
    if (delegateTeacherId && selectedClassIds.size > 0 && startDate && endDate) {
      setCheckingConflicts(true);
      const starts_at = `${startDate}T${startTime}:00`;
      const expires_at = `${endDate}T${endTime}:00`;

      const scopes = [];
      selectedClassIds.forEach(cid => {
        const sids = selectedSubjectMap[cid] || [];
        if (sids.length > 0) {
          sids.forEach(sid => scopes.push({ class_id: cid, subject_id: sid }));
        } else {
          scopes.push({ class_id: cid, subject_id: null });
        }
      });

      api.post('/principal/delegations/check-conflicts', {
        delegate_teacher_id: delegateTeacherId,
        starts_at,
        expires_at,
        scopes,
      })
        .then(r => setConflicts(r.data.conflicts || []))
        .catch(() => {})
        .finally(() => setCheckingConflicts(false));
    } else {
      setConflicts([]);
    }
  }, [delegateTeacherId, selectedClassIds, selectedSubjectMap, startDate, startTime, endDate, endTime]);

  if (!isOpen) return null;

  const sourceTeacher = teachers.find(t => String(t.id) === String(sourceTeacherId));
  const delegateTeacher = teachers.find(t => String(t.id) === String(delegateTeacherId));

  function togglePermission(code) {
    setSelectedPermissions(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function toggleClass(classId) {
    setSelectedClassIds(prev => {
      const next = new Set(prev);
      if (next.has(classId)) {
        next.delete(classId);
        const copy = { ...selectedSubjectMap };
        delete copy[classId];
        setSelectedSubjectMap(copy);
      } else {
        next.add(classId);
      }
      return next;
    });
  }

  function toggleSubject(classId, subjectId) {
    setSelectedSubjectMap(prev => {
      const cur = prev[classId] || [];
      const next = cur.includes(subjectId)
        ? cur.filter(id => id !== subjectId)
        : [...cur, subjectId];
      return { ...prev, [classId]: next };
    });
  }

  async function handleCreateDelegation() {
    if (!sourceTeacherId || !delegateTeacherId) {
      toast.error('Please select both absent teacher and substitute teacher.');
      return;
    }
    if (selectedClassIds.size === 0) {
      toast.error('Please select at least one class scope.');
      return;
    }
    if (selectedPermissions.size === 0) {
      toast.error('Please grant at least one permission.');
      return;
    }

    const starts_at = `${startDate}T${startTime}:00`;
    const expires_at = `${endDate}T${endTime}:00`;

    if (new Date(starts_at) >= new Date(expires_at)) {
      toast.error('End date/time must be strictly after start date/time.');
      return;
    }

    const scopes = [];
    selectedClassIds.forEach(cid => {
      const sids = selectedSubjectMap[cid] || [];
      if (sids.length > 0) {
        sids.forEach(sid => scopes.push({ class_id: cid, subject_id: sid }));
      } else {
        scopes.push({ class_id: cid, subject_id: null });
      }
    });

    setSubmitting(true);
    try {
      const payload = {
        source_teacher_id: Number.parseInt(sourceTeacherId, 10),
        delegate_teacher_id: Number.parseInt(delegateTeacherId, 10),
        session,
        starts_at,
        expires_at,
        reason,
        notes,
        scopes,
        permissions: Array.from(selectedPermissions),
      };

      const res = await api.post('/principal/delegations', payload);
      toast.success(res.data.message || 'Delegation created successfully!');
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create delegation.');
    }
    setSubmitting(false);
  }

  const permissionCategories = [
    {
      category: 'Academic Operations',
      items: [
        { code: 'ATTENDANCE_MARK', label: 'Take Attendance', desc: 'Mark student attendance for delegated classes' },
        { code: 'ATTENDANCE_EDIT', label: 'Edit Attendance', desc: 'Modify previously marked attendance records' },
        { code: 'MARKS_ENTER', label: 'Enter Exam Marks', desc: 'Enter student marks for exams & assessments' },
        { code: 'MARKS_EDIT', label: 'Edit Exam Marks', desc: 'Revise entered marks before approval' },
        { code: 'STUDENT_VIEW', label: 'View Student Profiles', desc: 'View student contact, attendance %, and roll no' },
        { code: 'NOTES_MANAGE', label: 'Manage Notes & Materials', desc: 'Upload notes and syllabus resources' },
      ],
    },
    {
      category: 'Timetable & Exams',
      items: [
        { code: 'TIMETABLE_VIEW', label: 'View Class Timetable', desc: 'Access class schedule and period roster' },
        { code: 'EXAM_VIEW', label: 'View Exam Schedule', desc: 'View timetable dates and exam dates' },
      ],
    },
    {
      category: 'Fees & Counter Operations (Optional)',
      items: [
        { code: 'FEE_VIEW', label: 'View Fee Information', desc: 'Read-only fee status for delegated students' },
        { code: 'FEE_COLLECT', label: 'Collect Fees', desc: 'Accept fee payments at counter' },
        { code: 'FEE_RECEIPT', label: 'Issue Fee Receipts', desc: 'Generate & print fee transaction receipt' },
      ],
    },
  ];

  return (
    <div className="modal-backdrop" role="presentation" onClick={e => e.target === e.currentTarget && !submitting && onClose()} onKeyDown={e => e.key === "Escape" && (!submitting && onClose())}>
      <div className="modal" style={{ maxWidth: 840, width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>

        {/* Modal Header with Progress Steps */}
        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', padding: '16px 20px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>🤝</span> Create Temporary Teacher Delegation
            </h3>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
              Step {step} of 4: {step === 1 ? 'Select Teachers' : step === 2 ? 'Define Scope' : step === 3 ? 'Choose Access' : 'Confirm & Review'}
            </div>
          </div>
          <button className="modal-close" disabled={submitting} onClick={onClose}>✕</button>
        </div>

        {/* Wizard Step Progress Tracker */}
        <div style={{ display: 'flex', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '10px 20px', gap: 12 }}>
          {[
            { n: 1, label: '1. Who' },
            { n: 2, label: '2. Scope' },
            { n: 3, label: '3. Access' },
            { n: 4, label: '4. Schedule' },
          ].map(s => (
            <button
              type="button"
              key={s.n}
              disabled={step <= s.n}
              onClick={() => { if (step > s.n) setStep(s.n); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700,
                color: step === s.n ? '#0176d3' : step > s.n ? '#16a34a' : '#94a3b8',
                cursor: step > s.n ? 'pointer' : 'default',
                background: 'transparent',
                border: 'none',
                padding: 0,
              }}
            >
              <span style={{
                width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: step === s.n ? '#0176d3' : step > s.n ? '#dcfce7' : '#e2e8f0',
                color: step === s.n ? '#fff' : step > s.n ? '#16a34a' : '#64748b',
                fontSize: 11
              }}>
                {step > s.n ? '✓' : s.n}
              </span>
              <span>{s.label}</span>
            </div>
          ))}
        </div>

        {/* Modal Body */}
        <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: 20 }}>

          {/* ── STEP 1: WHO ── */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px', fontSize: 12.5, color: '#1e40af' }}>
                💡 Select the teacher who is absent or on leave, and the colleague who will temporarily substitute for them.
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {/* Absent Teacher */}
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: 16 }}>
                  <label htmlFor="delegwiz-f1" style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#991b1b', marginBottom: 6 }}>
                    1. Teacher who is Unavailable / Absent *
                  </label>
                  <select id="delegwiz-f1"
                    className="form-select"
                    value={sourceTeacherId}
                    onChange={e => setSourceTeacherId(e.target.value)}
                    style={{ width: '100%', borderColor: '#fca5a5' }}
                  >
                    <option value="">-- Select Absent Teacher --</option>
                    {teachers.map(t => (
                      <option key={t.id} value={t.id} disabled={String(t.id) === String(delegateTeacherId)}>
                        {t.name} ({t.employee_id || 'No Emp ID'}) — {t.department || t.designation}
                      </option>
                    ))}
                  </select>

                  {sourceTeacher && (
                    <div style={{ marginTop: 12, fontSize: 12, color: '#7f1d1d', background: '#fff', padding: 10, borderRadius: 6 }}>
                      <div><strong>{sourceTeacher.name}</strong></div>
                      <div>Dept: {sourceTeacher.department || '—'} | Role: {sourceTeacher.designation}</div>
                      <div style={{ marginTop: 4, color: '#475569' }}>
                        Assigned: <strong>{sourceTeacher.assignments?.length || 0} classes/subjects</strong>
                      </div>
                    </div>
                  )}
                </div>

                {/* Substitute Teacher */}
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: 16 }}>
                  <label htmlFor="delegwiz-f2" style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#166534', marginBottom: 6 }}>
                    2. Substitute Teacher (Receives Access) *
                  </label>
                  <select id="delegwiz-f2"
                    className="form-select"
                    value={delegateTeacherId}
                    onChange={e => setDelegateTeacherId(e.target.value)}
                    style={{ width: '100%', borderColor: '#86efac' }}
                  >
                    <option value="">-- Select Substitute Teacher --</option>
                    {teachers.map(t => (
                      <option key={t.id} value={t.id} disabled={String(t.id) === String(sourceTeacherId)}>
                        {t.name} ({t.employee_id || 'No Emp ID'}) — {t.department || t.designation}
                      </option>
                    ))}
                  </select>

                  {delegateTeacher && (
                    <div style={{ marginTop: 12, fontSize: 12, color: '#14532d', background: '#fff', padding: 10, borderRadius: 6 }}>
                      <div><strong>{delegateTeacher.name}</strong></div>
                      <div>Dept: {delegateTeacher.department || '—'} | Role: {delegateTeacher.designation}</div>
                      <div style={{ marginTop: 4, color: '#475569' }}>
                        Status: <span style={{ color: '#16a34a', fontWeight: 700 }}>Active Faculty</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Conflict Warnings */}
              {conflicts.length > 0 && (
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e', marginBottom: 4 }}>
                    ⚠️ Potential Scheduling Conflicts Detected:
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12, color: '#b45309' }}>
                    {conflicts.map((c, i) => (
                      <li key={i}>{c.message}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 2: SCOPE ── */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
                  Select Classes & Subjects for Temporary Access
                </div>
                {sourceTeacher && sourceTeacher.assignments?.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-neutral btn-sm"
                    onClick={() => {
                      const cids = new Set(sourceTeacher.assignments.map(a => a.class_id));
                      setSelectedClassIds(cids);
                    }}
                    style={{ fontSize: 11 }}
                  >
                    Select All Absent Teacher's Classes
                  </button>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, maxHeight: 360, overflowY: 'auto' }}>
                {classes.map(c => {
                  const isChecked = selectedClassIds.has(c.id);
                  const subjs = availableSubjectsByClass[c.id] || [];
                  const pickedSubs = selectedSubjectMap[c.id] || [];

                  return (
                    <div
                      key={c.id}
                      style={{
                        border: isChecked ? '2px solid #0176d3' : '1px solid #cbd5e1',
                        borderRadius: 8, padding: 12, background: isChecked ? '#f0f9ff' : '#fff',
                        transition: 'all 0.15s'
                      }}
                    >
                      <label htmlFor="delegwiz-f3" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13, color: '#0f172a' }}>
                        <input id="delegwiz-f3"
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleClass(c.id)}
                        />
                        {c.name} {c.section}
                      </label>

                      {isChecked && (
                        <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid #bae6fd' }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: '#0369a1', marginBottom: 6 }}>
                            Subjects ({pickedSubs.length === 0 ? 'All in Class' : `${pickedSubs.length} Selected`}):
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {subjs.length === 0 ? (
                              <span style={{ fontSize: 11, color: '#64748b' }}>All Class Operations</span>
                            ) : (
                              subjs.map(s => {
                                const subChecked = pickedSubs.includes(s.id);
                                return (
                                  <button
                                    type="button"
                                    key={s.id}
                                    onClick={() => toggleSubject(c.id, s.id)}
                                    style={{
                                      fontSize: 11, padding: '2px 8px', borderRadius: 4, cursor: 'pointer',
                                      background: subChecked ? '#0284c7' : '#e0f2fe',
                                      color: subChecked ? '#fff' : '#0369a1',
                                      fontWeight: subChecked ? 700 : 500,
                                      border: 'none',
                                    }}
                                  >
                                    {s.name}
                                  </button>
                                );
                              })
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── STEP 3: ACCESS PERMISSIONS ── */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
                  What is the substitute teacher allowed to do?
                </div>
                <button
                  type="button"
                  className="btn btn-neutral btn-sm"
                  onClick={() => {
                    setSelectedPermissions(new Set(['ATTENDANCE_MARK', 'MARKS_ENTER', 'STUDENT_VIEW', 'NOTES_MANAGE', 'TIMETABLE_VIEW']));
                  }}
                  style={{ fontSize: 11 }}
                >
                  Standard Teaching Pack
                </button>
              </div>

              {permissionCategories.map(cat => (
                <div key={cat.category} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
                    {cat.category}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
                    {cat.items.map(item => {
                      const isChecked = selectedPermissions.has(item.code);
                      return (
                        <label
                          key={item.code}
                          style={{
                            padding: '8px 10px', borderRadius: 6, cursor: 'pointer', border: isChecked ? '1.5px solid #0176d3' : '1px solid #cbd5e1',
                            background: isChecked ? '#eff6ff' : '#fff', display: 'flex', alignItems: 'flex-start', gap: 8
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => togglePermission(item.code)}
                            style={{ marginTop: 2 }}
                          />
                          <div>
                            <div style={{ fontSize: 12.5, fontWeight: 700, color: isChecked ? '#0176d3' : '#1e293b' }}>
                              {item.label}
                            </div>
                            <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.3 }}>
                              {item.desc}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── STEP 4: SCHEDULE & REVIEW ── */}
          {step === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Date Time Range */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>
                  Delegation Time Window
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                  <div>
                    <label htmlFor="delegwiz-f4" style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 4 }}>Start Date *</label>
                    <input id="delegwiz-f4"
                      type="date"
                      className="form-input"
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <label htmlFor="delegwiz-f5" style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 4 }}>Start Time</label>
                    <input id="delegwiz-f5"
                      type="time"
                      className="form-input"
                      value={startTime}
                      onChange={e => setStartTime(e.target.value)}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <label htmlFor="delegwiz-f6" style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 4 }}>End Date *</label>
                    <input id="delegwiz-f6"
                      type="date"
                      className="form-input"
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <label htmlFor="delegwiz-f7" style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 4 }}>End Time</label>
                    <input id="delegwiz-f7"
                      type="time"
                      className="form-input"
                      value={endTime}
                      onChange={e => setEndTime(e.target.value)}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                  <div>
                    <label htmlFor="delegwiz-f8" style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 4 }}>Reason for Delegation *</label>
                    <input id="delegwiz-f8"
                      className="form-input"
                      value={reason}
                      onChange={e => setReason(e.target.value)}
                      placeholder="e.g. On Sick Leave / Official Duty"
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <label htmlFor="delegwiz-f9" style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 4 }}>Internal Notes / Instructions</label>
                    <input id="delegwiz-f9"
                      className="form-input"
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="e.g. Complete chapter 4 and conduct test"
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>
              </div>

              {/* 30-Second Summary Card */}
              <div style={{
                background: '#ffffff', border: '2px solid #22c55e', borderRadius: 10,
                padding: 16, boxShadow: '0 2px 8px rgba(34,197,94,0.1)'
              }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#15803d', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>✓</span> Delegation Summary & Confirmation
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, fontSize: 12 }}>
                  <div>
                    <span style={{ color: '#64748b' }}>Absent Teacher:</span>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>{sourceTeacher?.name || '—'}</div>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Substitute Teacher:</span>
                    <div style={{ fontWeight: 700, color: '#166534' }}>{delegateTeacher?.name || '—'}</div>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Classes Covered:</span>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>{selectedClassIds.size} Class(es)</div>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Valid Window:</span>
                    <div style={{ fontWeight: 700, color: '#0284c7' }}>
                      {startDate} → {endDate}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid #e2e8f0', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  <span style={{ fontSize: 11, color: '#64748b', marginRight: 4 }}>Granted Access:</span>
                  {Array.from(selectedPermissions).map(p => (
                    <span key={p} style={{ fontSize: 10.5, fontWeight: 700, background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: 4 }}>
                      {p.replace('_', ' ')}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="modal-footer" style={{ borderTop: '1px solid #e2e8f0', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            {step > 1 && (
              <button
                type="button"
                className="btn btn-neutral"
                disabled={submitting}
                onClick={() => setStep(step - 1)}
              >
                ← Back
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="btn btn-neutral"
              disabled={submitting}
              onClick={onClose}
            >
              Cancel
            </button>

            {step < 4 ? (
              <button
                type="button"
                className="btn btn-primary"
                disabled={
                  (step === 1 && (!sourceTeacherId || !delegateTeacherId)) ||
                  (step === 2 && selectedClassIds.size === 0) ||
                  (step === 3 && selectedPermissions.size === 0)
                }
                onClick={() => setStep(step + 1)}
                style={{ fontWeight: 700 }}
              >
                Next Step →
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                disabled={submitting || checkingConflicts}
                onClick={handleCreateDelegation}
                style={{ background: '#16a34a', borderColor: '#16a34a', fontWeight: 800, minWidth: 180 }}
              >
                {submitting ? 'Creating Delegation...' : '✓ Grant Temporary Access'}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
