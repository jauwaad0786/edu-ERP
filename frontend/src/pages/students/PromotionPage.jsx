import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import {
  Calendar,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Search,
  DollarSign,
  Plus,
  Edit3,
  Undo2,
  GraduationCap,
  Sparkles
} from 'lucide-react';

export default function PromotionPage() {
  const navigate = useNavigate();

  // Core metadata
  const [currentSchoolSession, setCurrentSchoolSession] = useState('');
  const [sessions, setSessions] = useState([]);
  const [classes, setClasses] = useState([]);
  const [classMappings, setClassMappings] = useState([]);

  // Step wizard navigation (1 to 6)
  const [step, setStep] = useState(1);

  // Step 1: Sessions & Scope
  const [sourceSession, setSourceSession] = useState('');
  const [targetSession, setTargetSession] = useState('');
  const [scopeClassId, setScopeClassId] = useState('ALL');
  const [showAddSessionModal, setShowAddSessionModal] = useState(false);
  const [newSessionInput, setNewSessionInput] = useState('');

  // Step 2: Class Mapping Overrides
  const [customClassMap, setCustomClassMap] = useState({});

  // Step 3: Student Roster & Decisions
  const [previewList, setPreviewList] = useState([]);
  const [studentActions, setStudentActions] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAction, setFilterAction] = useState('ALL');

  // Step 4: Safety & Financial Settings
  const [generateTargetFees, setGenerateTargetFees] = useState(true);
  const [previewSummary, setPreviewSummary] = useState(null);

  // Step 5: Confirmation state
  const [confirmedCheck, setConfirmedCheck] = useState(false);
  const [executing, setExecuting] = useState(false);

  // Step 6: Summary & Correction
  const [executionResult, setExecutionResult] = useState(null);
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [selectedCorrectionStudent, setSelectedCorrectionStudent] = useState(null);
  const [correctionData, setCorrectionData] = useState({
    target_class_id: '',
    target_section: '',
    target_roll_no: '',
    action: 'PROMOTE',
    reason: ''
  });
  const [correcting, setCorrecting] = useState(false);

  // Loading flags
  const [loadingMetadata, setLoadingMetadata] = useState(true);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Load initial school sessions & classes
  useEffect(() => {
    loadMetadata();
  }, []);

  async function loadMetadata() {
    setLoadingMetadata(true);
    try {
      const res = await api.get('/principal/students/sessions');
      const cur = res.data.current_session || '2024-25';
      const sessList = res.data.sessions || [];
      const clsList = res.data.classes || [];

      setCurrentSchoolSession(cur);
      setSessions(sessList);
      setClasses(clsList);

      setSourceSession(cur);

      // Deduce next target session
      const parts = cur.split('-');
      if (parts.length === 2 && !isNaN(parts[0])) {
        const nextStart = parseInt(parts[0], 10) + 1;
        const nextEnd = parts[1].length === 2 ? String(parseInt(parts[1], 10) + 1).padStart(2, '0') : parseInt(parts[1], 10) + 1;
        setTargetSession(`${nextStart}-${nextEnd}`);
      } else {
        setTargetSession('2025-26');
      }
    } catch (err) {
      toast.error('Failed to load academic session metadata');
    }
    setLoadingMetadata(false);
  }

  // Load class mappings when moving to Step 2
  async function handleLoadClassMappings() {
    if (!sourceSession || !targetSession) {
      toast.error('Please specify both source and target sessions.');
      return;
    }
    if (sourceSession === targetSession) {
      toast.error('Target session must be different from source session.');
      return;
    }

    try {
      const res = await api.get(`/principal/students/promote/class-mappings?source_session=${encodeURIComponent(sourceSession)}`);
      const maps = res.data.mappings || [];
      setClassMappings(maps);

      // Initialize custom mapping overrides
      const initialMap = {};
      maps.forEach(m => {
        initialMap[m.source_class_id] = m.target_class_id;
      });
      setCustomClassMap(initialMap);
      setStep(2);
    } catch (err) {
      toast.error('Failed to load class progression mappings');
    }
  }

  // Load Student Preview when moving to Step 3
  async function handleLoadStudentPreview() {
    setLoadingPreview(true);
    try {
      const payload = {
        source_session: sourceSession,
        target_session: targetSession,
        class_id: scopeClassId === 'ALL' ? null : parseInt(scopeClassId, 10),
        class_mappings: customClassMap,
      };

      const res = await api.post('/principal/students/promote/preview', payload);
      const students = res.data.students || res.data.preview || [];
      const summary = res.data.summary || null;

      if (students.length === 0) {
        toast.error('No eligible students found in the selected session and scope.');
        setLoadingPreview(false);
        return;
      }

      setPreviewList(students);
      setPreviewSummary(summary);

      // Build default student action decisions
      const actions = {};
      students.forEach(s => {
        actions[s.student_id] = {
          action: s.recommended_action || 'PROMOTE',
          target_class_id: s.suggested_class_id || s.current_class_id,
          target_section: s.suggested_section || s.current_section || 'A',
          target_roll_no: s.suggested_roll_no || s.current_roll_no || '',
          remarks: s.has_conflict ? s.conflict_reason : '',
        };
      });
      setStudentActions(actions);
      setStep(3);
      toast.success(`Loaded ${students.length} students for promotion review.`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to generate promotion preview.');
    }
    setLoadingPreview(false);
  }

  // Quick session create
  async function handleCreateSession() {
    if (!newSessionInput.trim()) {
      toast.error('Please enter a session string (e.g. 2026-27).');
      return;
    }
    try {
      const res = await api.post('/principal/students/sessions/create', { session: newSessionInput.trim() });
      toast.success(res.data.message || 'New session created!');
      setSessions(res.data.sessions || [...sessions, newSessionInput.trim()]);
      setTargetSession(newSessionInput.trim());
      setShowAddSessionModal(false);
      setNewSessionInput('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create academic session.');
    }
  }

  // Switch current active session
  async function handleSwitchActiveSession(sessToSwitch) {
    const target = sessToSwitch || targetSession;
    if (!window.confirm(`Are you sure you want to set "${target}" as the school's active current session?`)) return;

    try {
      const res = await api.post('/principal/students/sessions/switch', { session: target });
      toast.success(res.data.message || `Switched active session to ${target}`);
      setCurrentSchoolSession(target);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to switch active session.');
    }
  }

  // Update individual student decision
  function handleStudentActionChange(studentId, field, value) {
    setStudentActions(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: value
      }
    }));
  }

  // Bulk action on filtered students
  function handleBatchAction(actionType) {
    const filteredIds = filteredStudents.map(s => s.student_id);
    setStudentActions(prev => {
      const updated = { ...prev };
      filteredIds.forEach(id => {
        const student = previewList.find(s => s.student_id === id);
        if (student && !student.has_conflict) {
          updated[id] = {
            ...updated[id],
            action: actionType,
            // If retaining, default target class to current class
            target_class_id: actionType === 'RETAIN' ? student.current_class_id : (updated[id]?.target_class_id || student.suggested_class_id),
          };
        }
      });
      return updated;
    });
    toast.success(`Marked ${filteredIds.length} students as ${actionType}.`);
  }

  // Execute Rollover
  async function handleConfirmRollover() {
    if (!confirmedCheck) {
      toast.error('Please confirm the verification checkbox to proceed.');
      return;
    }

    setExecuting(true);
    try {
      const promotions = Object.entries(studentActions).map(([studentId, data]) => ({
        student_id: parseInt(studentId, 10),
        action: data.action,
        target_class_id: data.target_class_id ? parseInt(data.target_class_id, 10) : null,
        target_section: data.target_section,
        target_roll_no: data.target_roll_no || undefined,
        remarks: data.remarks || undefined,
      }));

      const payload = {
        source_session: sourceSession,
        target_session: targetSession,
        generate_target_fees: generateTargetFees,
        promotions,
      };

      const res = await api.post('/principal/students/promote/confirm', payload);
      setExecutionResult(res.data.summary || {});
      setStep(6);
      toast.success(res.data.message || 'Academic session rollover executed successfully!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Rollover execution encountered an error.');
    }
    setExecuting(false);
  }

  // Correction submission
  async function handleSubmitCorrection() {
    if (!selectedCorrectionStudent) return;
    setCorrecting(true);
    try {
      const payload = {
        student_id: selectedCorrectionStudent.student_id,
        session: targetSession,
        target_class_id: correctionData.target_class_id ? parseInt(correctionData.target_class_id, 10) : undefined,
        target_section: correctionData.target_section,
        target_roll_no: correctionData.target_roll_no,
        action: correctionData.action,
        reason: correctionData.reason || 'Administrative correction',
      };
      const res = await api.post('/principal/students/promote/correct', payload);
      toast.success(res.data.message || 'Student promotion record corrected!');
      setShowCorrectionModal(false);
      setSelectedCorrectionStudent(null);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit correction.');
    }
    setCorrecting(false);
  }

  // Revert single student
  async function handleRevertStudent(studentId, admissionNo) {
    if (!window.confirm(`Are you sure you want to revert rollover for student ${admissionNo}? This will restore their active enrollment in ${sourceSession} and remove target session records.`)) {
      return;
    }
    try {
      const res = await api.post('/principal/students/promote/revert', {
        student_id: studentId,
        source_session: sourceSession,
        target_session: targetSession,
        reason: 'Administrative rollover revert',
      });
      toast.success(res.data.message || `Reverted student ${admissionNo} successfully!`);
      // Update local state if in execution view
      setShowCorrectionModal(false);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to revert student.');
    }
  }

  // Filtered students computation
  const filteredStudents = useMemo(() => {
    return previewList.filter(s => {
      const matchesSearch = searchQuery === '' ||
        s.student_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.admission_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(s.current_roll_no || '').includes(searchQuery);

      const curAction = studentActions[s.student_id]?.action || s.recommended_action || 'PROMOTE';
      const matchesAction = filterAction === 'ALL' ||
        (filterAction === 'CONFLICT' && s.has_conflict) ||
        (filterAction === curAction);

      return matchesSearch && matchesAction;
    });
  }, [previewList, studentActions, searchQuery, filterAction]);

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar title="Academic Session Rollover & Promotion" />
        <div className="page-body">

          {/* Breadcrumb & Title */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#64748b', marginBottom: 4 }}>
                <span style={{ cursor: 'pointer', color: '#0176d3' }} onClick={() => navigate('/students')}>Student Management</span>
                <span>/</span>
                <span style={{ fontWeight: 600, color: '#1e293b' }}>Academic Session Rollover</span>
              </div>
              <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span>🎓</span> Academic Session Rollover & Student Promotion
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
                Seamless end-of-year class progression, grade advancement, and historical preservation.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                background: '#e0f2fe', color: '#0369a1', padding: '6px 14px', borderRadius: 20,
                fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #bae6fd'
              }}>
                <Calendar size={14} /> Active Session: <strong>{loadingMetadata ? 'Loading...' : (currentSchoolSession || '2024-25')}</strong>
              </div>
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

          {/* Guided 6-Step Stepper Bar */}
          <div style={{
            background: '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0',
            padding: '16px 20px', marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
              {[
                { num: 1, title: '1. Sessions & Scope', desc: 'Select Years' },
                { num: 2, title: '2. Class Mapping', desc: 'Progression Matrix' },
                { num: 3, title: '3. Student Roster', desc: 'Review Decisions' },
                { num: 4, title: '4. Safety & Fees', desc: 'Financial Safeguards' },
                { num: 5, title: '5. Confirmation', desc: 'Atomic Execution' },
                { num: 6, title: '6. Summary', desc: 'Audit & Outcome' },
              ].map(s => {
                const isActive = step === s.num;
                const isCompleted = step > s.num;
                return (
                  <div
                    key={s.num}
                    style={{
                      borderBottom: isActive ? '3px solid #0176d3' : isCompleted ? '3px solid #16a34a' : '3px solid #e2e8f0',
                      paddingBottom: 8,
                      opacity: isActive || isCompleted ? 1 : 0.6,
                      cursor: isCompleted ? 'pointer' : 'default',
                    }}
                    onClick={() => { if (isCompleted && !executing) setStep(s.num); }}
                  >
                    <div style={{
                      fontSize: 12, fontWeight: 700,
                      color: isActive ? '#0176d3' : isCompleted ? '#16a34a' : '#64748b',
                      display: 'flex', alignItems: 'center', gap: 6
                    }}>
                      {isCompleted ? <CheckCircle2 size={14} color="#16a34a" /> : null}
                      {s.title}
                    </div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{s.desc}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────── */}
          {/* STEP 1: SESSIONS & SCOPE SELECTION                         */}
          {/* ─────────────────────────────────────────────────────────── */}
          {step === 1 && (
            <div style={{
              background: '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0',
              padding: 24, maxWidth: 960, boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}>
              <h3 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 4px', color: '#0f172a' }}>
                Step 1: Select Academic Sessions & Scope
              </h3>
              <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 20px' }}>
                Specify the source academic year to promote from, the destination target year, and choose whether to process school-wide or a specific class.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
                {/* Source Session Card */}
                <div style={{ background: '#f8fafc', padding: 20, borderRadius: 10, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Calendar size={16} color="#0284c7" /> Source Session (Current Roster)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 6 }}>
                        Source Academic Year *
                      </label>
                      <select
                        className="form-select"
                        value={sourceSession}
                        onChange={e => setSourceSession(e.target.value)}
                        style={{ width: '100%' }}
                      >
                        {sessions.map(s => (
                          <option key={s} value={s}>{s} {s === currentSchoolSession ? '(Current Active)' : ''}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 6 }}>
                        Rollover Scope *
                      </label>
                      <select
                        className="form-select"
                        value={scopeClassId}
                        onChange={e => setScopeClassId(e.target.value)}
                        style={{ width: '100%' }}
                      >
                        <option value="ALL">🌟 All Classes (Whole School Rollover)</option>
                        {classes.map(c => (
                          <option key={c.id} value={c.id}>{c.name} - Section {c.section}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Target Session Card */}
                <div style={{ background: '#f0fdf4', padding: 20, borderRadius: 10, border: '1px solid #bbf7d0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#166534', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <GraduationCap size={16} color="#16a34a" /> Destination Target Session
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAddSessionModal(true)}
                      style={{
                        background: '#dcfce7', border: '1px solid #86efac', borderRadius: 6,
                        padding: '4px 8px', fontSize: 11, fontWeight: 700, color: '#15803d', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 4
                      }}
                    >
                      <Plus size={12} /> Add Session
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#166534', marginBottom: 6 }}>
                        Target Academic Year *
                      </label>
                      <input
                        className="form-input"
                        value={targetSession}
                        onChange={e => setTargetSession(e.target.value)}
                        placeholder="e.g. 2025-26"
                        style={{ width: '100%' }}
                      />
                      <div style={{ fontSize: 11, color: '#15803d', marginTop: 4 }}>
                        Students promoted will receive active enrollment in this academic session.
                      </div>
                    </div>

                    <div style={{
                      background: '#ffffff', borderRadius: 8, padding: 12, border: '1px solid #dcfce7',
                      fontSize: 12, color: '#166534'
                    }}>
                      💡 <strong>Safe Rollover Guarantee:</strong> Historical records, past session grades, attendance, and fee transactions remain completely unchanged.
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleLoadClassMappings}
                  style={{ minWidth: 220, fontWeight: 700 }}
                >
                  Next: Map Class Progression →
                </button>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────── */}
          {/* STEP 2: CLASS & SECTION PROGRESSION MAPPING                 */}
          {/* ─────────────────────────────────────────────────────────── */}
          {step === 2 && (
            <div style={{
              background: '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0',
              padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                <div>
                  <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: '#0f172a' }}>
                    Step 2: Class & Section Progression Matrix
                  </h3>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                    Session Flow: <strong>{sourceSession}</strong> ➔ <strong>{targetSession}</strong>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className="btn btn-neutral"
                    onClick={() => setStep(1)}
                    style={{ fontSize: 12 }}
                  >
                    ← Back to Sessions
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={loadingPreview}
                    onClick={handleLoadStudentPreview}
                    style={{ fontWeight: 700, fontSize: 13 }}
                  >
                    {loadingPreview ? 'Loading Student Data...' : 'Next: Review Student Roster →'}
                  </button>
                </div>
              </div>

              <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 8, marginBottom: 20 }}>
                <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ padding: '10px 14px', fontSize: 12, textAlign: 'left' }}>Current Source Class</th>
                      <th style={{ padding: '10px 14px', fontSize: 12, textAlign: 'center', width: 120 }}>Enrolled Students</th>
                      <th style={{ padding: '10px 14px', fontSize: 12, textAlign: 'center', width: 140 }}>Progression Type</th>
                      <th style={{ padding: '10px 14px', fontSize: 12, textAlign: 'left', minWidth: 260 }}>Destination Target Class</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classMappings.map(m => {
                      const selectedTargetId = customClassMap[m.source_class_id] ?? m.target_class_id;
                      const isGraduate = m.suggested_action === 'GRADUATE';

                      return (
                        <tr key={m.source_class_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>{m.source_display}</div>
                            <div style={{ fontSize: 11, color: '#64748b' }}>Level {m.source_class_name}</div>
                          </td>

                          <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                            <span style={{
                              background: '#f1f5f9', color: '#334155', padding: '4px 10px',
                              borderRadius: 12, fontSize: 12, fontWeight: 700
                            }}>
                              {m.student_count} Students
                            </span>
                          </td>

                          <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                            {isGraduate ? (
                              <span style={{ background: '#fef3c7', color: '#92400e', padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>
                                🎓 Terminal (Pass Out)
                              </span>
                            ) : (
                              <span style={{ background: '#f0fdf4', color: '#166534', padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>
                                🚀 Advance Level
                              </span>
                            )}
                          </td>

                          <td style={{ padding: '12px 14px' }}>
                            {isGraduate ? (
                              <div style={{ fontSize: 12, color: '#64748b', fontStyle: 'italic' }}>
                                Class 12 students are marked GRADUATED / PASS OUT by default
                              </div>
                            ) : (
                              <select
                                className="form-select"
                                value={selectedTargetId || ''}
                                onChange={e => {
                                  const val = e.target.value ? parseInt(e.target.value, 10) : null;
                                  setCustomClassMap(prev => ({ ...prev, [m.source_class_id]: val }));
                                }}
                                style={{ width: '100%', fontSize: 12, padding: '6px 10px' }}
                              >
                                <option value="">-- No Direct Target (Configure individually) --</option>
                                {classes.map(c => (
                                  <option key={c.id} value={c.id}>
                                    {c.name} - Section {c.section}
                                  </option>
                                ))}
                              </select>
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

          {/* ─────────────────────────────────────────────────────────── */}
          {/* STEP 3: STUDENT ROSTER REVIEW & INDIVIDUAL OVERRIDES        */}
          {/* ─────────────────────────────────────────────────────────── */}
          {step === 3 && (
            <div style={{
              background: '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0',
              padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}>
              {/* Header Toolbar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                <div>
                  <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: '#0f172a' }}>
                    Step 3: Review Student Decisions ({previewList.length} Total)
                  </h3>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                    Session: <strong>{sourceSession}</strong> ➔ <strong>{targetSession}</strong>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-neutral"
                    onClick={() => handleBatchAction('PROMOTE')}
                    style={{ fontSize: 12, background: '#f0fdf4', color: '#166534', borderColor: '#bbf7d0', fontWeight: 700 }}
                  >
                    🚀 Mark Filtered PROMOTE
                  </button>
                  <button
                    type="button"
                    className="btn btn-neutral"
                    onClick={() => handleBatchAction('RETAIN')}
                    style={{ fontSize: 12, background: '#fef3c7', color: '#92400e', borderColor: '#fde68a', fontWeight: 700 }}
                  >
                    🔄 Mark Filtered RETAIN
                  </button>
                  <button
                    type="button"
                    className="btn btn-neutral"
                    onClick={() => handleBatchAction('GRADUATE')}
                    style={{ fontSize: 12, background: '#e0e7ff', color: '#3730a3', borderColor: '#c7d2fe', fontWeight: 700 }}
                  >
                    🎓 Mark Filtered GRADUATE
                  </button>
                  <button
                    type="button"
                    className="btn btn-neutral"
                    onClick={() => setStep(2)}
                    style={{ fontSize: 12 }}
                  >
                    ← Back to Mapping
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setStep(4)}
                    style={{ fontWeight: 700, fontSize: 13 }}
                  >
                    Next: Safety & Financial Checks →
                  </button>
                </div>
              </div>

              {/* Filter Pills & Search */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {[
                    { key: 'ALL', label: `All (${previewList.length})` },
                    { key: 'PROMOTE', label: 'Promote' },
                    { key: 'RETAIN', label: 'Retain' },
                    { key: 'GRADUATE', label: 'Graduate' },
                    { key: 'CONFLICT', label: 'Conflicts' },
                  ].map(f => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => setFilterAction(f.key)}
                      style={{
                        padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                        border: filterAction === f.key ? '1px solid #0176d3' : '1px solid #e2e8f0',
                        background: filterAction === f.key ? '#eff6ff' : '#ffffff',
                        color: filterAction === f.key ? '#0176d3' : '#64748b',
                        cursor: 'pointer'
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <div style={{ position: 'relative', width: 280 }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: '#94a3b8' }} />
                  <input
                    className="form-input"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search student, adm no, roll..."
                    style={{ width: '100%', paddingLeft: 32, fontSize: 12 }}
                  />
                </div>
              </div>

              {/* Interactive Roster Table */}
              <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                      <th style={{ padding: '10px 14px', fontSize: 12, textAlign: 'left' }}>Student Profile</th>
                      <th style={{ padding: '10px 14px', fontSize: 12, textAlign: 'left' }}>Current Status</th>
                      <th style={{ padding: '10px 14px', fontSize: 12, textAlign: 'left' }}>Academic Standing</th>
                      <th style={{ padding: '10px 14px', fontSize: 12, textAlign: 'left' }}>Historical Dues</th>
                      <th style={{ padding: '10px 14px', fontSize: 12, textAlign: 'left', minWidth: 150 }}>Rollover Decision</th>
                      <th style={{ padding: '10px 14px', fontSize: 12, textAlign: 'left', minWidth: 200 }}>Target Class</th>
                      <th style={{ padding: '10px 14px', fontSize: 12, textAlign: 'center', width: 80 }}>Section</th>
                      <th style={{ padding: '10px 14px', fontSize: 12, textAlign: 'center', width: 90 }}>Roll No</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map(s => {
                      const curAction = studentActions[s.student_id] || {};
                      const isConflict = s.has_conflict;
                      const hasDues = (s.outstanding_dues || 0) > 0;

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
                              <div style={{ fontSize: 11, color: '#e11d48', fontWeight: 700, marginTop: 2 }}>
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

                          <td style={{ padding: '10px 14px', fontSize: 12 }}>
                            {hasDues ? (
                              <span style={{
                                background: '#fef3c7', color: '#b45309', padding: '3px 8px',
                                borderRadius: 12, fontSize: 11, fontWeight: 700
                              }}>
                                ₹{s.outstanding_dues} due
                              </span>
                            ) : (
                              <span style={{ color: '#16a34a', fontSize: 11, fontWeight: 600 }}>Cleared ✓</span>
                            )}
                          </td>

                          <td style={{ padding: '10px 14px' }}>
                            <select
                              className="form-select"
                              value={curAction.action || 'PROMOTE'}
                              disabled={isConflict}
                              onChange={e => handleStudentActionChange(s.student_id, 'action', e.target.value)}
                              style={{
                                width: '100%', fontSize: 12, padding: '5px 8px', fontWeight: 700,
                                color: curAction.action === 'PROMOTE' ? '#15803d' : curAction.action === 'RETAIN' ? '#b45309' : '#475569'
                              }}
                            >
                              <option value="PROMOTE">🚀 PROMOTE</option>
                              <option value="RETAIN">🔄 RETAIN</option>
                              <option value="GRADUATE">🎓 GRADUATE</option>
                              <option value="WITHDRAW">🚪 WITHDRAW / LEFT</option>
                            </select>
                          </td>

                          <td style={{ padding: '10px 14px' }}>
                            <select
                              className="form-select"
                              value={curAction.target_class_id || ''}
                              disabled={isConflict || curAction.action === 'GRADUATE' || curAction.action === 'WITHDRAW'}
                              onChange={e => handleStudentActionChange(s.student_id, 'target_class_id', e.target.value)}
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
                              disabled={isConflict || curAction.action === 'GRADUATE' || curAction.action === 'WITHDRAW'}
                              onChange={e => handleStudentActionChange(s.student_id, 'target_section', e.target.value.toUpperCase())}
                              style={{ width: 45, textAlign: 'center', fontSize: 12, padding: '5px 4px' }}
                            />
                          </td>

                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            <input
                              className="form-input"
                              value={curAction.target_roll_no || ''}
                              disabled={isConflict || curAction.action === 'GRADUATE' || curAction.action === 'WITHDRAW'}
                              onChange={e => handleStudentActionChange(s.student_id, 'target_roll_no', e.target.value)}
                              placeholder="Auto"
                              style={{ width: 65, textAlign: 'center', fontSize: 12, padding: '5px 4px' }}
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

          {/* ─────────────────────────────────────────────────────────── */}
          {/* STEP 4: SAFETY VALIDATION & FINANCIAL IMPLICATIONS          */}
          {/* ─────────────────────────────────────────────────────────── */}
          {step === 4 && (
            <div style={{
              background: '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0',
              padding: 24, maxWidth: 960, boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}>
              <h3 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 4px', color: '#0f172a' }}>
                Step 4: Safety Safeguards & Financial Implications Preview
              </h3>
              <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 20px' }}>
                Review pre-flight validation checks, total outstanding dues preserved, and target session fee generation options.
              </p>

              {/* Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
                <div style={{ background: '#f0fdf4', padding: 14, borderRadius: 8, border: '1px solid #bbf7d0' }}>
                  <div style={{ fontSize: 11, color: '#166534', fontWeight: 700 }}>TO PROMOTE</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#15803d', marginTop: 4 }}>
                    {Object.values(studentActions).filter(a => a.action === 'PROMOTE').length}
                  </div>
                </div>

                <div style={{ background: '#fef3c7', padding: 14, borderRadius: 8, border: '1px solid #fde68a' }}>
                  <div style={{ fontSize: 11, color: '#92400e', fontWeight: 700 }}>TO RETAIN</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#b45309', marginTop: 4 }}>
                    {Object.values(studentActions).filter(a => a.action === 'RETAIN').length}
                  </div>
                </div>

                <div style={{ background: '#e0e7ff', padding: 14, borderRadius: 8, border: '1px solid #c7d2fe' }}>
                  <div style={{ fontSize: 11, color: '#3730a3', fontWeight: 700 }}>GRADUATING</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#4338ca', marginTop: 4 }}>
                    {Object.values(studentActions).filter(a => a.action === 'GRADUATE').length}
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>HISTORICAL DUES PRESERVED</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginTop: 4 }}>
                    ₹{previewSummary?.total_outstanding_dues || 0}
                  </div>
                </div>
              </div>

              {/* Financial Safety Options */}
              <div style={{
                background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10,
                padding: 16, marginBottom: 20
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <DollarSign size={16} color="#059669" /> Target Session Finance & Billing Integration
                </div>

                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={generateTargetFees}
                    onChange={e => setGenerateTargetFees(e.target.checked)}
                    style={{ marginTop: 3 }}
                  />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>
                      Automatically generate pending target session fee demands for promoted and retained students
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                      Applies the active Fee Structure of each student's new class in session <strong>{targetSession}</strong>. Idempotent: repeated rollover runs never generate duplicate demands.
                    </div>
                  </div>
                </label>
              </div>

              {/* Pre-flight Safeguard Verification */}
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: 16, marginBottom: 24 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#166534', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ShieldCheck size={16} color="#16a34a" /> Verified Enterprise Safeguards
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12, color: '#166534' }}>
                  <div>✓ Original admission dates and numbers strictly preserved</div>
                  <div>✓ Historical attendance and report cards remain intact</div>
                  <div>✓ Previous session fee balances and receipts untouched</div>
                  <div>✓ Multi-tenant school isolation verified in database transaction</div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn btn-neutral"
                  onClick={() => setStep(3)}
                  style={{ fontSize: 13 }}
                >
                  ← Back to Roster
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setStep(5)}
                  style={{ minWidth: 200, fontWeight: 700 }}
                >
                  Proceed to Confirmation →
                </button>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────── */}
          {/* STEP 5: CONFIRMATION & EXECUTION                           */}
          {/* ─────────────────────────────────────────────────────────── */}
          {step === 5 && (
            <div style={{
              background: '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0',
              padding: 28, maxWidth: 760, margin: '0 auto', boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
            }}>
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <div style={{
                  width: 54, height: 54, background: '#fef3c7', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px'
                }}>
                  <AlertTriangle size={28} color="#d97706" />
                </div>
                <h3 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: '0 0 6px' }}>
                  Confirm Academic Rollover Execution
                </h3>
                <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
                  You are about to execute promotion for <strong>{previewList.length} students</strong> from session <strong>{sourceSession}</strong> to <strong>{targetSession}</strong>.
                </p>
              </div>

              <div style={{ background: '#f8fafc', padding: 18, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 20, fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: '#64748b' }}>Students to Promote:</span>
                  <strong style={{ color: '#16a34a' }}>{Object.values(studentActions).filter(a => a.action === 'PROMOTE').length}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: '#64748b' }}>Students to Retain:</span>
                  <strong style={{ color: '#d97706' }}>{Object.values(studentActions).filter(a => a.action === 'RETAIN').length}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: '#64748b' }}>Graduating Students:</span>
                  <strong style={{ color: '#4338ca' }}>{Object.values(studentActions).filter(a => a.action === 'GRADUATE').length}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Target Session Billing:</span>
                  <strong>{generateTargetFees ? 'Generate Active Demands' : 'Do Not Generate'}</strong>
                </div>
              </div>

              <label style={{
                display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer',
                marginBottom: 24, padding: 12, background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0'
              }}>
                <input
                  type="checkbox"
                  checked={confirmedCheck}
                  onChange={e => setConfirmedCheck(e.target.checked)}
                  style={{ marginTop: 2 }}
                />
                <span style={{ fontSize: 12, color: '#166534', fontWeight: 600 }}>
                  I confirm that all student promotion outcomes and class progressions have been verified, and authorize this annual rollover.
                </span>
              </label>

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <button
                  type="button"
                  className="btn btn-neutral"
                  disabled={executing}
                  onClick={() => setStep(4)}
                >
                  ← Back
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!confirmedCheck || executing}
                  onClick={handleConfirmRollover}
                  style={{ background: '#16a34a', borderColor: '#16a34a', fontWeight: 700, minWidth: 220 }}
                >
                  {executing ? 'Executing Rollover Transaction...' : '✓ Confirm & Execute Rollover'}
                </button>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────── */}
          {/* STEP 6: EXECUTION SUMMARY & POST-ROLLOVER MANAGEMENT        */}
          {/* ─────────────────────────────────────────────────────────── */}
          {step === 6 && executionResult && (
            <div style={{
              background: '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0',
              padding: 28, maxWidth: 860, margin: '0 auto', boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
            }}>
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <div style={{
                  width: 60, height: 60, background: '#dcfce7', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px'
                }}>
                  <CheckCircle2 size={36} color="#16a34a" />
                </div>
                <h3 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: '0 0 6px' }}>
                  Session Rollover Completed Successfully!
                </h3>
                <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
                  All student records and class progressions have been updated for academic session <strong>{targetSession}</strong>.
                </p>
              </div>

              {/* Metrics Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
                <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>PROCESSED</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', marginTop: 4 }}>
                    {executionResult.total_processed}
                  </div>
                </div>

                <div style={{ background: '#f0fdf4', padding: 16, borderRadius: 8, border: '1px solid #bbf7d0', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: '#166534', fontWeight: 700 }}>PROMOTED</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#15803d', marginTop: 4 }}>
                    {executionResult.promoted}
                  </div>
                </div>

                <div style={{ background: '#fef3c7', padding: 16, borderRadius: 8, border: '1px solid #fde68a', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: '#92400e', fontWeight: 700 }}>RETAINED</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#b45309', marginTop: 4 }}>
                    {executionResult.retained}
                  </div>
                </div>

                <div style={{ background: '#f0fdf4', padding: 16, borderRadius: 8, border: '1px solid #bbf7d0', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: '#166534', fontWeight: 700 }}>FEES DEMANDS</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#16a34a', marginTop: 4 }}>
                    {executionResult.fees_generated || 0}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
                {currentSchoolSession !== targetSession && (
                  <button
                    type="button"
                    onClick={() => handleSwitchActiveSession(targetSession)}
                    className="btn btn-primary"
                    style={{
                      background: '#0284c7', borderColor: '#0284c7', padding: '12px 18px',
                      fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                    }}
                  >
                    <Sparkles size={16} /> Switch School Active Session to "{targetSession}"
                  </button>
                )}

                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    type="button"
                    className="btn btn-neutral"
                    onClick={() => navigate('/students')}
                    style={{ flex: 1, padding: '10px 14px', fontSize: 13, fontWeight: 600 }}
                  >
                    👥 Open Student Directory
                  </button>
                  <button
                    type="button"
                    className="btn btn-neutral"
                    onClick={() => {
                      setStep(1);
                      setPreviewList([]);
                      setExecutionResult(null);
                    }}
                    style={{ flex: 1, padding: '10px 14px', fontSize: 13, fontWeight: 600 }}
                  >
                    🔄 Run Another Class Rollover
                  </button>
                </div>
              </div>

              {/* Controlled Correction Note */}
              <div style={{
                background: '#f8fafc', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
                    Need to correct an individual student's outcome?
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    Use the controlled correction tool to modify target class, section, or revert a mistake.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCorrectionModal(true)}
                  style={{
                    background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 6,
                    padding: '6px 12px', fontSize: 12, fontWeight: 700, color: '#0f172a', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6
                  }}
                >
                  <Edit3 size={14} /> Open Correction Tool
                </button>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────── */}
          {/* MODAL: ADD ACADEMIC SESSION                                 */}
          {/* ─────────────────────────────────────────────────────────── */}
          {showAddSessionModal && (
            <div style={{
              position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16
            }}>
              <div style={{
                background: '#ffffff', borderRadius: 12, padding: 24, width: '100%', maxWidth: 440,
                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
              }}>
                <h4 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                  Create New Academic Session
                </h4>
                <p style={{ margin: '0 0 16px', fontSize: 12, color: '#64748b' }}>
                  Register a new academic year format (e.g. 2026-27).
                </p>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                    Session Name *
                  </label>
                  <input
                    className="form-input"
                    value={newSessionInput}
                    onChange={e => setNewSessionInput(e.target.value)}
                    placeholder="e.g. 2026-27"
                    style={{ width: '100%' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button
                    type="button"
                    className="btn btn-neutral"
                    onClick={() => setShowAddSessionModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleCreateSession}
                  >
                    Create Session
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────── */}
          {/* MODAL: INDIVIDUAL STUDENT CORRECTION & REVERT TOOL          */}
          {/* ─────────────────────────────────────────────────────────── */}
          {showCorrectionModal && (
            <div style={{
              position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16
            }}>
              <div style={{
                background: '#ffffff', borderRadius: 12, padding: 24, width: '100%', maxWidth: 640,
                maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h4 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#0f172a' }}>
                    Post-Rollover Correction & Revert Tool
                  </h4>
                  <button
                    type="button"
                    onClick={() => { setShowCorrectionModal(false); setSelectedCorrectionStudent(null); }}
                    style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#64748b' }}
                  >
                    ✕
                  </button>
                </div>

                {!selectedCorrectionStudent ? (
                  <div>
                    <p style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
                      Select a student from the processed roster to adjust class placement or revert back:
                    </p>
                    <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                      {previewList.map(s => (
                        <div
                          key={s.student_id}
                          style={{
                            padding: '10px 14px', borderBottom: '1px solid #f1f5f9',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer'
                          }}
                          onClick={() => {
                            setSelectedCorrectionStudent(s);
                            const act = studentActions[s.student_id] || {};
                            setCorrectionData({
                              target_class_id: act.target_class_id || s.suggested_class_id || '',
                              target_section: act.target_section || s.suggested_section || 'A',
                              target_roll_no: act.target_roll_no || s.suggested_roll_no || '',
                              action: act.action || 'PROMOTE',
                              reason: ''
                            });
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>{s.student_name}</div>
                            <div style={{ fontSize: 11, color: '#64748b' }}>Adm: {s.admission_number} | Class: {s.current_class_name}</div>
                          </div>
                          <button type="button" className="btn btn-neutral" style={{ fontSize: 11 }}>
                            Select →
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{
                      background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0',
                      marginBottom: 16
                    }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>
                        {selectedCorrectionStudent.student_name}
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>
                        Adm No: {selectedCorrectionStudent.admission_number} | Source Session: {sourceSession} | Target Session: {targetSession}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                          Corrected Action *
                        </label>
                        <select
                          className="form-select"
                          value={correctionData.action}
                          onChange={e => setCorrectionData(prev => ({ ...prev, action: e.target.value }))}
                          style={{ width: '100%', fontSize: 12 }}
                        >
                          <option value="PROMOTE">PROMOTE</option>
                          <option value="RETAIN">RETAIN</option>
                          <option value="GRADUATE">GRADUATE</option>
                          <option value="WITHDRAW">WITHDRAW</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                          Target Class *
                        </label>
                        <select
                          className="form-select"
                          value={correctionData.target_class_id}
                          onChange={e => setCorrectionData(prev => ({ ...prev, target_class_id: e.target.value }))}
                          style={{ width: '100%', fontSize: 12 }}
                        >
                          <option value="">-- Select Class --</option>
                          {classes.map(c => (
                            <option key={c.id} value={c.id}>{c.name} - Section {c.section}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                          Section
                        </label>
                        <input
                          className="form-input"
                          value={correctionData.target_section}
                          onChange={e => setCorrectionData(prev => ({ ...prev, target_section: e.target.value.toUpperCase() }))}
                          style={{ width: '100%', fontSize: 12 }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                          Roll Number
                        </label>
                        <input
                          className="form-input"
                          value={correctionData.target_roll_no}
                          onChange={e => setCorrectionData(prev => ({ ...prev, target_roll_no: e.target.value }))}
                          style={{ width: '100%', fontSize: 12 }}
                        />
                      </div>
                    </div>

                    <div style={{ marginBottom: 16 }}>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                        Reason for Correction (Recorded in Audit Log) *
                      </label>
                      <input
                        className="form-input"
                        value={correctionData.reason}
                        onChange={e => setCorrectionData(prev => ({ ...prev, reason: e.target.value }))}
                        placeholder="e.g. Administrative section change requested by parent"
                        style={{ width: '100%', fontSize: 12 }}
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <button
                        type="button"
                        onClick={() => handleRevertStudent(selectedCorrectionStudent.student_id, selectedCorrectionStudent.admission_number)}
                        style={{
                          background: '#fff1f2', border: '1px solid #fecdd3', color: '#be123c',
                          padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: 6
                        }}
                      >
                        <Undo2 size={14} /> Revert to Source Session
                      </button>

                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          type="button"
                          className="btn btn-neutral"
                          onClick={() => setSelectedCorrectionStudent(null)}
                        >
                          Back to List
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={correcting}
                          onClick={handleSubmitCorrection}
                        >
                          {correcting ? 'Saving Correction...' : 'Save Correction'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
