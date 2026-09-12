import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function PromotionPage() {
  const navigate = useNavigate();

  const [classes, setClasses] = useState([]);
  const [sessions, setSessions] = useState([]);

  const [step, setStep] = useState(1);
  const [sourceSession, setSourceSession] = useState('');
  const [targetSession, setTargetSession] = useState('');
  const [sourceClassId, setSourceClassId] = useState('');
  const [targetClassId, setTargetClassId] = useState('');

  const [previewList, setPreviewList] = useState([]);
  const [studentActions, setStudentActions] = useState({});
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);

  useEffect(() => {
    api.get('/principal/classes')
      .then(r => setClasses(Array.isArray(r.data) ? r.data : []))
      .catch(() => {});

    api.get('/principal/students/sessions')
      .then(r => {
        const sess = r.data.sessions || [];
        setSessions(sess);
        if (sess.length > 0) {
          setSourceSession(sess[0]);
          if (sess.length > 1) {
            setTargetSession(sess[1]);
          } else {
            const parts = sess[0].split('-');
            if (parts.length === 2 && !isNaN(parts[0])) {
              setTargetSession(`${parseInt(parts[0], 10) + 1}-${parseInt(parts[1], 10) + 1}`);
            } else {
              setTargetSession('2025-26');
            }
          }
        }
      })
      .catch(() => {});
  }, []);

  async function handleLoadPreview() {
    if (!sourceSession || !sourceClassId || !targetSession) {
      toast.error('Please select Source Session, Source Class, and Target Session');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/principal/students/promote/preview', {
        source_session: sourceSession,
        source_class_id: parseInt(sourceClassId, 10),
        target_session: targetSession,
        target_class_id: targetClassId ? parseInt(targetClassId, 10) : null,
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
          target_class_id: s.suggested_class_id || (targetClassId ? parseInt(targetClassId, 10) : s.current_class_id),
          target_section: s.current_section || 'A',
          target_roll_number: s.current_roll_no || '',
          remarks: s.has_conflict ? s.conflict_reason : '',
        };
      });
      setStudentActions(initial);
      setStep(2);
      toast.success(`Loaded ${list.length} student records for promotion review`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to generate promotion preview');
    }
    setLoading(false);
  }

  function handleActionChange(studentId, field, value) {
    setStudentActions(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: value,
      },
    }));
  }

  function handleBatchAction(actionType) {
    setStudentActions(prev => {
      const updated = { ...prev };
      previewList.forEach(s => {
        if (!s.has_conflict) {
          updated[s.student_id] = {
            ...updated[s.student_id],
            action: actionType,
          };
        }
      });
      return updated;
    });
    toast.success(`Marked all eligible students as ${actionType}`);
  }

  async function handleConfirmPromotion() {
    setExecuting(true);
    try {
      const promotions = Object.entries(studentActions).map(([studentId, data]) => ({
        student_id: parseInt(studentId, 10),
        action: data.action,
        target_class_id: data.target_class_id ? parseInt(data.target_class_id, 10) : null,
        target_section: data.target_section,
        target_roll_number: data.target_roll_number || undefined,
        remarks: data.remarks || undefined,
      }));

      const payload = {
        source_session: sourceSession,
        target_session: targetSession,
        promotions,
      };

      const res = await api.post('/principal/students/promote/confirm', payload);
      toast.success(res.data.message || 'Promotion executed successfully!');
      setStep(1);
      setPreviewList([]);
      setStudentActions({});
    } catch (err) {
      toast.error(err.response?.data?.error || 'Promotion execution failed');
    }
    setExecuting(false);
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar title="Annual Rollover & Student Promotion" />
        <div className="page-body">

          {/* Breadcrumb & Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#64748b', marginBottom: 4 }}>
                <span style={{ cursor: 'pointer', color: '#0176d3' }} onClick={() => navigate('/students')}>Student Management</span>
                <span>/</span>
                <span style={{ fontWeight: 600, color: '#1e293b' }}>Promote & Rollover</span>
              </div>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span>🚀</span> Annual Rollover & Student Promotion
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
                Promote students to the next academic year, retain in existing class, or mark graduated.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="btn btn-neutral"
                onClick={() => navigate('/students')}
                style={{ fontSize: 13 }}
              >
                ← Back to Students
              </button>
            </div>
          </div>

          {/* Step 1: Configuration Form */}
          {step === 1 && (
            <div style={{
              background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12,
              padding: 24, maxWidth: 900, boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px', color: '#1e293b' }}>
                Step 1: Configure Academic Sessions & Classes
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                {/* Source Column */}
                <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 12 }}>
                    From (Current Roster)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                        Source Academic Session
                      </label>
                      <input
                        className="form-input"
                        value={sourceSession}
                        onChange={e => setSourceSession(e.target.value)}
                        placeholder="e.g. 2024-25"
                        style={{ width: '100%' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                        Source Class & Section *
                      </label>
                      <select
                        className="form-select"
                        value={sourceClassId}
                        onChange={e => setSourceClassId(e.target.value)}
                        style={{ width: '100%' }}
                      >
                        <option value="">-- Select Source Class --</option>
                        {classes.map(c => (
                          <option key={c.id} value={c.id}>{c.name} - Section {c.section}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Target Column */}
                <div style={{ background: '#f0fdf4', padding: 16, borderRadius: 8, border: '1px solid #bbf7d0' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#166534', marginBottom: 12 }}>
                    To (New Rollover Session)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#166534', marginBottom: 4 }}>
                        Target Academic Session *
                      </label>
                      <input
                        className="form-input"
                        value={targetSession}
                        onChange={e => setTargetSession(e.target.value)}
                        placeholder="e.g. 2025-26"
                        style={{ width: '100%' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#166534', marginBottom: 4 }}>
                        Default Target Class (Optional)
                      </label>
                      <select
                        className="form-select"
                        value={targetClassId}
                        onChange={e => setTargetClassId(e.target.value)}
                        style={{ width: '100%' }}
                      >
                        <option value="">-- Auto-promote to Next Level --</option>
                        {classes.map(c => (
                          <option key={c.id} value={c.id}>{c.name} - Section {c.section}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={loading || !sourceClassId}
                  onClick={handleLoadPreview}
                  style={{ minWidth: 200, fontWeight: 700 }}
                >
                  {loading ? 'Loading Student Data...' : 'Next: Review Promotion Roster →'}
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Interactive Review Roster */}
          {step === 2 && (
            <div style={{
              background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12,
              padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}>
              {/* Header Toolbar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: '#1e293b' }}>
                    Step 2: Review & Finalize Student Actions ({previewList.length} Students)
                  </h3>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                    Session Rollover: <strong>{sourceSession}</strong> → <strong>{targetSession}</strong>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-neutral"
                    onClick={() => handleBatchAction('PROMOTE')}
                    style={{ fontSize: 12, background: '#f0fdf4', color: '#166534', borderColor: '#bbf7d0', fontWeight: 700 }}
                  >
                    🚀 Mark All PROMOTE
                  </button>
                  <button
                    type="button"
                    className="btn btn-neutral"
                    onClick={() => handleBatchAction('RETAIN')}
                    style={{ fontSize: 12, background: '#fef3c7', color: '#92400e', borderColor: '#fde68a', fontWeight: 700 }}
                  >
                    🔄 Mark All RETAIN
                  </button>
                  <button
                    type="button"
                    className="btn btn-neutral"
                    onClick={() => setStep(1)}
                    style={{ fontSize: 12 }}
                  >
                    ← Change Criteria
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={executing}
                    onClick={handleConfirmPromotion}
                    style={{ background: '#16a34a', borderColor: '#16a34a', fontWeight: 700, fontSize: 13 }}
                  >
                    {executing ? 'Executing Rollover...' : '✓ Confirm & Execute Rollover'}
                  </button>
                </div>
              </div>

              {/* Roster Table */}
              <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                      <th style={{ padding: '10px 14px', fontSize: 12, textAlign: 'left' }}>Student</th>
                      <th style={{ padding: '10px 14px', fontSize: 12, textAlign: 'left' }}>Current Status</th>
                      <th style={{ padding: '10px 14px', fontSize: 12, textAlign: 'left' }}>Academic Standing</th>
                      <th style={{ padding: '10px 14px', fontSize: 12, textAlign: 'left', minWidth: 160 }}>Action Decision</th>
                      <th style={{ padding: '10px 14px', fontSize: 12, textAlign: 'left', minWidth: 180 }}>Target Class</th>
                      <th style={{ padding: '10px 14px', fontSize: 12, textAlign: 'center', width: 90 }}>Section</th>
                      <th style={{ padding: '10px 14px', fontSize: 12, textAlign: 'center', width: 100 }}>New Roll No</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewList.map(s => {
                      const curAction = studentActions[s.student_id] || {};
                      const isConflict = s.has_conflict;

                      return (
                        <tr
                          key={s.student_id}
                          style={{
                            borderBottom: '1px solid #f1f5f9',
                            background: isConflict ? '#fff1f2' : '#ffffff'
                          }}
                        >
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>{s.student_name}</div>
                            <div style={{ fontSize: 11, color: '#64748b' }}>Adm: {s.admission_number || '—'}</div>
                            {isConflict && (
                              <div style={{ fontSize: 10, color: '#e11d48', fontWeight: 700, marginTop: 2 }}>
                                ⚠️ {s.conflict_reason}
                              </div>
                            )}
                          </td>

                          <td style={{ padding: '10px 14px', fontSize: 12, color: '#475569' }}>
                            <div>{s.current_class_name} - {s.current_section}</div>
                            <div style={{ fontSize: 11, color: '#64748b' }}>Roll: {s.current_roll_no || '—'}</div>
                          </td>

                          <td style={{ padding: '10px 14px', fontSize: 12 }}>
                            {s.academic_standing ? (
                              <div>
                                <span style={{
                                  fontWeight: 700,
                                  color: s.academic_standing.passed ? '#16a34a' : '#dc2626'
                                }}>
                                  {s.academic_standing.percentage ? `${s.academic_standing.percentage}%` : 'Evaluated'}
                                </span>
                                <div style={{ fontSize: 10, color: '#64748b' }}>
                                  Att: {s.academic_standing.attendance_pct ? `${s.academic_standing.attendance_pct}%` : '—'}
                                </div>
                              </div>
                            ) : (
                              <span style={{ color: '#94a3b8', fontSize: 11 }}>No exam records</span>
                            )}
                          </td>

                          <td style={{ padding: '10px 14px' }}>
                            <select
                              className="form-select"
                              value={curAction.action || 'PROMOTE'}
                              disabled={isConflict}
                              onChange={e => handleActionChange(s.student_id, 'action', e.target.value)}
                              style={{
                                width: '100%', fontSize: 12, padding: '5px 8px', fontWeight: 700,
                                color: curAction.action === 'PROMOTE' ? '#15803d' : curAction.action === 'RETAIN' ? '#b45309' : '#475569'
                              }}
                            >
                              <option value="PROMOTE">🚀 PROMOTE</option>
                              <option value="RETAIN">🔄 RETAIN</option>
                              <option value="GRADUATED">🎓 GRADUATE</option>
                              <option value="LEFT">🚪 LEFT / WITHDRAWN</option>
                            </select>
                          </td>

                          <td style={{ padding: '10px 14px' }}>
                            <select
                              className="form-select"
                              value={curAction.target_class_id || ''}
                              disabled={isConflict || curAction.action === 'GRADUATED' || curAction.action === 'LEFT'}
                              onChange={e => handleActionChange(s.student_id, 'target_class_id', e.target.value)}
                              style={{ width: '100%', fontSize: 12, padding: '5px 8px' }}
                            >
                              <option value="">-- Target Class --</option>
                              {classes.map(c => (
                                <option key={c.id} value={c.id}>{c.name} - Section {c.section}</option>
                              ))}
                            </select>
                          </td>

                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            <input
                              className="form-input"
                              value={curAction.target_section || ''}
                              disabled={isConflict || curAction.action === 'GRADUATED' || curAction.action === 'LEFT'}
                              onChange={e => handleActionChange(s.student_id, 'target_section', e.target.value.toUpperCase())}
                              style={{ width: 50, textAlign: 'center', fontSize: 12, padding: '5px 4px' }}
                            />
                          </td>

                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            <input
                              className="form-input"
                              value={curAction.target_roll_number || ''}
                              disabled={isConflict || curAction.action === 'GRADUATED' || curAction.action === 'LEFT'}
                              onChange={e => handleActionChange(s.student_id, 'target_roll_number', e.target.value)}
                              placeholder="Auto"
                              style={{ width: 70, textAlign: 'center', fontSize: 12, padding: '5px 4px' }}
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

        </div>
      </div>
    </div>
  );
}
