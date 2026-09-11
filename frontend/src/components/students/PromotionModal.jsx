import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function PromotionModal({ isOpen, onClose, onSuccess, classes = [], sessions = [] }) {
  const [step, setStep] = useState(1);
  const [sourceSession, setSourceSession] = useState(sessions[0] || '2024-25');
  const [targetSession, setTargetSession] = useState('2025-26');
  const [sourceClassId, setSourceClassId] = useState('');
  const [targetClassId, setTargetClassId] = useState('');
  const [previewList, setPreviewList] = useState([]);
  const [studentActions, setStudentActions] = useState({});
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);

  useEffect(() => {
    if (sessions.length > 0) {
      setSourceSession(sessions[0]);
      if (sessions.length > 1) {
        setTargetSession(sessions[1]);
      } else {
        const parts = sessions[0].split('-');
        if (parts.length === 2 && !isNaN(parts[0])) {
          setTargetSession(`${parseInt(parts[0]) + 1}-${parseInt(parts[1]) + 1}`);
        } else {
          setTargetSession('2025-26');
        }
      }
    }
  }, [sessions]);

  if (!isOpen) return null;

  async function handleLoadPreview() {
    if (!sourceSession || !sourceClassId || !targetSession) {
      toast.error('Please select Source Session, Source Class, and Target Session');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/principal/students/promote/preview', {
        source_session: sourceSession,
        source_class_id: parseInt(sourceClassId),
        target_session: targetSession,
        target_class_id: targetClassId ? parseInt(targetClassId) : null,
      });

      const list = res.data.preview || [];
      if (list.length === 0) {
        toast.error('No students found in the selected source class and session');
        setLoading(false);
        return;
      }

      setPreviewList(list);

      const initial = {};
      list.forEach(s => {
        initial[s.student_id] = {
          action: s.recommended_action || 'PROMOTE',
          target_class_id: s.suggested_class_id || (targetClassId ? parseInt(targetClassId) : s.current_class_id),
          target_section: s.current_section || 'A',
          target_roll_number: s.current_roll_no || '',
          remarks: s.has_conflict ? s.conflict_reason : '',
        };
      });
      setStudentActions(initial);
      setStep(2);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to generate promotion preview');
    }
    setLoading(false);
  }

  function updateStudentAction(studentId, field, val) {
    setStudentActions(prev => {
      const current = prev[studentId] || {};
      const updated = { ...current, [field]: val };

      // Auto-adjust target class when action changes
      if (field === 'action') {
        const student = previewList.find(s => s.student_id === studentId);
        if (val === 'RETAIN') {
          updated.target_class_id = student ? student.current_class_id : current.target_class_id;
        } else if (val === 'PROMOTE') {
          updated.target_class_id = (student && student.suggested_class_id) || (targetClassId ? parseInt(targetClassId) : current.target_class_id);
        }
      }
      return { ...prev, [studentId]: updated };
    });
  }

  function setAllActions(actionType) {
    setStudentActions(prev => {
      const next = { ...prev };
      previewList.forEach(s => {
        const targetClass = actionType === 'RETAIN' ? s.current_class_id : (s.suggested_class_id || (targetClassId ? parseInt(targetClassId) : s.current_class_id));
        next[s.student_id] = {
          ...next[s.student_id],
          action: actionType,
          target_class_id: targetClass,
        };
      });
      return next;
    });
    toast.success(`Set all students to ${actionType}`);
  }

  function setAllToRecommended() {
    setStudentActions(prev => {
      const next = { ...prev };
      previewList.forEach(s => {
        const rec = s.recommended_action || 'PROMOTE';
        const targetClass = rec === 'RETAIN' ? s.current_class_id : (s.suggested_class_id || (targetClassId ? parseInt(targetClassId) : s.current_class_id));
        next[s.student_id] = {
          ...next[s.student_id],
          action: rec,
          target_class_id: targetClass,
        };
      });
      return next;
    });
    toast.success('Applied all system-recommended actions');
  }

  async function handleConfirmPromotion() {
    setExecuting(true);
    try {
      const payload = {
        source_session: sourceSession,
        target_session: targetSession,
        students: previewList.map(s => {
          const act = studentActions[s.student_id] || {};
          return {
            student_id: s.student_id,
            action: act.action || 'PROMOTE',
            target_class_id: act.target_class_id ? parseInt(act.target_class_id) : undefined,
            target_section: act.target_section || undefined,
            target_roll_number: act.target_roll_number || undefined,
            remarks: act.remarks || undefined,
          };
        }),
      };

      const res = await api.post('/principal/students/promote/confirm', payload);
      toast.success(res.data.message || 'Promotion successfully processed!');
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Promotion execution failed');
    }
    setExecuting(false);
  }

  // Calculate summary counts
  const promoteCount = Object.values(studentActions).filter(a => a.action === 'PROMOTE').length;
  const retainCount = Object.values(studentActions).filter(a => a.action === 'RETAIN').length;
  const graduateCount = Object.values(studentActions).filter(a => a.action === 'GRADUATE').length;
  const otherCount = Object.values(studentActions).filter(a => a.action === 'WITHDRAWN' || a.action === 'LEFT').length;

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && !executing && onClose()}>
      <div className="modal" style={{ maxWidth: step === 2 ? 1080 : 640, width: '95%' }}>
        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>🚀</span> Annual Academic Rollover & Promotion
            </h3>
            <span style={{ fontSize: 12, color: 'var(--neutral-5)' }}>
              Step {step} of 3: {step === 1 ? 'Configure Sessions & Classes' : step === 2 ? 'Individual Student Review & Action' : 'Final Review & Confirmation'}
            </span>
          </div>
          <button className="modal-close" disabled={executing} onClick={onClose}>✕</button>
        </div>

        {/* ── STEP 1: CONFIGURE ── */}
        {step === 1 && (
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: '#1e40af' }}>
              💡 <strong>Safe Rollover Guarantee:</strong> Student profiles and admission numbers remain permanent. Promotion creates new enrollment rows in the target academic year while fully preserving historical attendance, marks, and fee records.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: 13, color: 'var(--neutral-7)' }}>FROM (Source)</h4>
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label">Source Session *</label>
                  <input
                    className="form-input"
                    value={sourceSession}
                    onChange={e => setSourceSession(e.target.value)}
                    placeholder="e.g. 2024-25"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Source Class & Section *</label>
                  <select
                    className="form-select"
                    value={sourceClassId}
                    onChange={e => setSourceClassId(e.target.value)}
                  >
                    <option value="">Select class to promote...</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name} — {c.section}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: 13, color: 'var(--neutral-7)' }}>TO (Target)</h4>
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label">Target New Session *</label>
                  <input
                    className="form-input"
                    value={targetSession}
                    onChange={e => setTargetSession(e.target.value)}
                    placeholder="e.g. 2025-26"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Default Target Class (Optional)</label>
                  <select
                    className="form-select"
                    value={targetClassId}
                    onChange={e => setTargetClassId(e.target.value)}
                  >
                    <option value="">Auto-determine next class (Class 5 → Class 6)</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name} — {c.section}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 2: REVIEW GRID ── */}
        {step === 2 && (
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Quick action bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, background: '#f8fafc', padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--neutral-8)' }}>
                {previewList.length} Students in {previewList[0]?.current_class_name} ({sourceSession})
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-neutral btn-sm" onClick={setAllToRecommended}>
                  ⭐ Apply All Recommended
                </button>
                <button type="button" className="btn btn-neutral btn-sm" onClick={() => setAllActions('PROMOTE')}>
                  ✅ Set All: PROMOTE
                </button>
                <button type="button" className="btn btn-neutral btn-sm" onClick={() => setAllActions('RETAIN')}>
                  ⚠️ Set All: RETAIN
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="table-container" style={{ maxHeight: 420, overflowY: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Student Info</th>
                    <th>Attendance</th>
                    <th>RMS Marks</th>
                    <th>Recommendation</th>
                    <th>Action</th>
                    <th>Target Class</th>
                    <th>Target Sec</th>
                    <th>Target Roll</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {previewList.map(s => {
                    const act = studentActions[s.student_id] || {};
                    const isPromote = act.action === 'PROMOTE';
                    const isRetain = act.action === 'RETAIN';

                    return (
                      <tr key={s.student_id} style={{ background: s.has_conflict ? '#fff7ed' : 'inherit' }}>
                        <td>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{s.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--neutral-5)' }}>
                            Adm: {s.admission_no} | Roll: {s.current_roll_no || '—'}
                          </div>
                          {s.has_conflict && (
                            <div style={{ fontSize: 11, color: '#c2410c', fontWeight: 600, marginTop: 2 }}>
                              ⚠️ {s.conflict_reason}
                            </div>
                          )}
                        </td>
                        <td>
                          <span style={{
                            padding: '3px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700,
                            background: s.attendance_pct >= 75 ? '#dcfce7' : '#fee2e2',
                            color: s.attendance_pct >= 75 ? '#15803d' : '#b91c1c',
                          }}>
                            {s.attendance_pct}%
                          </span>
                        </td>
                        <td>
                          <span style={{
                            padding: '3px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700,
                            background: s.marks_pct >= 33 ? '#dcfce7' : '#fee2e2',
                            color: s.marks_pct >= 33 ? '#15803d' : '#b91c1c',
                          }}>
                            {s.marks_pct}%
                          </span>
                        </td>
                        <td>
                          <span style={{
                            padding: '3px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700,
                            background: s.recommended_action === 'PROMOTE' ? '#e0e7ff' : '#fef3c7',
                            color: s.recommended_action === 'PROMOTE' ? '#3730a3' : '#92400e',
                          }}>
                            {s.recommended_action}
                          </span>
                        </td>
                        <td>
                          <select
                            className="form-select"
                            style={{
                              padding: '4px 8px', fontSize: 12, fontWeight: 700,
                              color: isPromote ? '#15803d' : isRetain ? '#b45309' : 'inherit'
                            }}
                            value={act.action || 'PROMOTE'}
                            onChange={e => updateStudentAction(s.student_id, 'action', e.target.value)}
                          >
                            <option value="PROMOTE">PROMOTE</option>
                            <option value="RETAIN">RETAIN</option>
                            <option value="GRADUATE">GRADUATE</option>
                            <option value="WITHDRAWN">WITHDRAWN</option>
                            <option value="LEFT">LEFT</option>
                          </select>
                        </td>
                        <td>
                          {(act.action === 'PROMOTE' || act.action === 'RETAIN') ? (
                            <select
                              className="form-select"
                              style={{ padding: '4px 8px', fontSize: 12, minWidth: 120 }}
                              value={act.target_class_id || ''}
                              onChange={e => updateStudentAction(s.student_id, 'target_class_id', parseInt(e.target.value))}
                            >
                              {classes.map(c => (
                                <option key={c.id} value={c.id}>{c.name} — {c.section}</option>
                              ))}
                            </select>
                          ) : (
                            <span style={{ fontSize: 12, color: 'var(--neutral-4)' }}>N/A</span>
                          )}
                        </td>
                        <td>
                          {(act.action === 'PROMOTE' || act.action === 'RETAIN') ? (
                            <input
                              className="form-input"
                              style={{ width: 50, padding: '4px 6px', fontSize: 12 }}
                              value={act.target_section || ''}
                              onChange={e => updateStudentAction(s.student_id, 'target_section', e.target.value)}
                            />
                          ) : '—'}
                        </td>
                        <td>
                          {(act.action === 'PROMOTE' || act.action === 'RETAIN') ? (
                            <input
                              className="form-input"
                              style={{ width: 60, padding: '4px 6px', fontSize: 12 }}
                              value={act.target_roll_number || ''}
                              onChange={e => updateStudentAction(s.student_id, 'target_roll_number', e.target.value)}
                            />
                          ) : '—'}
                        </td>
                        <td>
                          <input
                            className="form-input"
                            style={{ minWidth: 90, padding: '4px 6px', fontSize: 11 }}
                            placeholder="Optional"
                            value={act.remarks || ''}
                            onChange={e => updateStudentAction(s.student_id, 'remarks', e.target.value)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── STEP 3: SUMMARY & CONFIRM ── */}
        {step === 3 && (
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: '#f8fafc', padding: 16, borderRadius: 10, border: '1px solid #e2e8f0' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: 15 }}>📊 Promotion & Rollover Execution Summary</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                <div style={{ background: '#dcfce7', padding: 12, borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#15803d' }}>{promoteCount}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#166534' }}>To Promote</div>
                </div>
                <div style={{ background: '#fef3c7', padding: 12, borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#b45309' }}>{retainCount}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e' }}>To Retain</div>
                </div>
                <div style={{ background: '#f3e8ff', padding: 12, borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#7c3aed' }}>{graduateCount}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#6b21a8' }}>To Graduate</div>
                </div>
                <div style={{ background: '#fee2e2', padding: 12, borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#dc2626' }}>{otherCount}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#991b1b' }}>Withdrawn / Left</div>
                </div>
              </div>
            </div>

            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '14px 16px', fontSize: 13, color: '#1e40af' }}>
              <strong>Execution Target:</strong> All promoted and retained students will be enrolled in session <strong>{targetSession}</strong> with new active pointers. Source session <strong>{sourceSession}</strong> records are permanently archived and remain immutable.
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            {step > 1 && (
              <button
                type="button"
                className="btn btn-neutral"
                disabled={executing}
                onClick={() => setStep(s => s - 1)}
              >
                ← Back
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="btn btn-neutral" disabled={executing} onClick={onClose}>
              Cancel
            </button>
            {step === 1 && (
              <button
                type="button"
                className="btn btn-primary"
                disabled={loading || !sourceClassId}
                onClick={handleLoadPreview}
              >
                {loading ? 'Loading Students...' : 'Load Review Grid →'}
              </button>
            )}
            {step === 2 && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setStep(3)}
              >
                Review Summary →
              </button>
            )}
            {step === 3 && (
              <button
                type="button"
                className="btn btn-primary"
                disabled={executing}
                onClick={handleConfirmPromotion}
                style={{ background: '#15803d', borderColor: '#15803d' }}
              >
                {executing ? 'Executing Rollover...' : '🚀 Confirm & Execute Promotion'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
