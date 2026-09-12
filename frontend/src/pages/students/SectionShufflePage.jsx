import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function SectionShufflePage() {
  const navigate = useNavigate();

  const [classes, setClasses] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [session, setSession] = useState('');
  const [className, setClassName] = useState('');
  const [sourceClassId, setSourceClassId] = useState('');
  const [targetSection, setTargetSection] = useState('B');
  const [mode, setMode] = useState('SMART'); // 'SMART' | 'MANUAL'

  // Manual mode state
  const [classStudents, setClassStudents] = useState([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState(new Set());
  const [loadingStudents, setLoadingStudents] = useState(false);

  // Smart mode state
  const [smartSectionsInput, setSmartSectionsInput] = useState('A, B');
  const [balanceCount, setBalanceCount] = useState(true);
  const [balanceGender, setBalanceGender] = useState(true);
  const [balanceHouse, setBalanceHouse] = useState(true);

  // Preview & Confirm state
  const [previewData, setPreviewData] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [executing, setExecuting] = useState(false);

  // Rollback state
  const [lastRollbackToken, setLastRollbackToken] = useState(
    () => sessionStorage.getItem('sis_last_shuffle_token') || null
  );
  const [revertingShuffle, setRevertingShuffle] = useState(false);

  // Load classes & sessions
  useEffect(() => {
    api.get('/principal/classes')
      .then(r => setClasses(Array.isArray(r.data) ? r.data : []))
      .catch(() => {});

    api.get('/principal/students/sessions')
      .then(r => {
        const sess = r.data.sessions || [];
        setSessions(sess);
        if (sess.length > 0) {
          setSession(sess[0]);
        }
      })
      .catch(() => {});
  }, []);

  const distinctClassNames = Array.from(new Set(classes.map(c => c.name))).filter(Boolean);

  useEffect(() => {
    if (distinctClassNames.length > 0 && !className) {
      setClassName(distinctClassNames[0]);
    }
  }, [classes]);

  // Load students for manual move when sourceClassId changes
  useEffect(() => {
    if (mode === 'MANUAL' && sourceClassId) {
      setLoadingStudents(true);
      api.get(`/principal/students?class_id=${sourceClassId}`)
        .then(r => {
          const list = Array.isArray(r.data) ? r.data : (r.data.data || []);
          setClassStudents(list);
          setSelectedStudentIds(new Set());
        })
        .catch(() => toast.error('Failed to load students'))
        .finally(() => setLoadingStudents(false));
    } else {
      setClassStudents([]);
      setSelectedStudentIds(new Set());
    }
  }, [sourceClassId, mode]);

  const sectionsForClass = classes.filter(c => c.name === className);

  function toggleStudent(id) {
    setSelectedStudentIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedStudentIds.size === classStudents.length) {
      setSelectedStudentIds(new Set());
    } else {
      setSelectedStudentIds(new Set(classStudents.map(s => s.id)));
    }
  }

  async function handleGeneratePreview() {
    if (!className) {
      toast.error('Please select a class');
      return;
    }

    setLoadingPreview(true);
    try {
      const payload = {
        session: session || '2024-25',
        class_name: className,
        mode,
      };

      if (mode === 'MANUAL') {
        if (!sourceClassId) {
          toast.error('Please select source section');
          setLoadingPreview(false);
          return;
        }
        if (selectedStudentIds.size === 0) {
          toast.error('Please select at least 1 student to move');
          setLoadingPreview(false);
          return;
        }
        const srcCls = classes.find(c => String(c.id) === String(sourceClassId));
        payload.source_section = srcCls ? srcCls.section : 'A';
        payload.target_section = targetSection;
        payload.student_ids = Array.from(selectedStudentIds);
      } else {
        const parsedSections = smartSectionsInput.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
        if (parsedSections.length < 2) {
          toast.error('Enter at least 2 target sections separated by comma (e.g. A, B)');
          setLoadingPreview(false);
          return;
        }
        payload.target_sections = parsedSections;
        payload.balance_by_count = balanceCount;
        payload.balance_by_gender = balanceGender;
        payload.balance_by_house = balanceHouse;
      }

      const res = await api.post('/principal/students/shuffle/preview', payload);
      setPreviewData(res.data);
      toast.success('Shuffle preview generated successfully');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to generate shuffle preview');
    }
    setLoadingPreview(false);
  }

  async function handleConfirmShuffle() {
    if (!previewData || !previewData.proposed_moves || previewData.proposed_moves.length === 0) {
      toast.error('No student moves to confirm');
      return;
    }
    setExecuting(true);
    try {
      const payload = {
        session: session || '2024-25',
        class_name: className,
        moves: previewData.proposed_moves.map(m => ({
          student_id: m.student_id,
          target_section: m.target_section,
          target_roll_number: m.target_roll_number || undefined,
        })),
      };

      const res = await api.post('/principal/students/shuffle/confirm', payload);
      const token = res.data.rollback_token;
      if (token) {
        sessionStorage.setItem('sis_last_shuffle_token', token);
        setLastRollbackToken(token);
      }
      toast.success(res.data.message || 'Section shuffle executed successfully!');
      setPreviewData(null);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Shuffle execution failed');
    }
    setExecuting(false);
  }

  async function handleRollbackShuffle() {
    if (!lastRollbackToken) return;
    if (!window.confirm('Are you sure you want to revert the last section shuffle? Students will be restored to their previous sections.')) {
      return;
    }
    setRevertingShuffle(true);
    try {
      const res = await api.post('/principal/students/shuffle/rollback', {
        rollback_token: lastRollbackToken,
      });
      toast.success(res.data.message || 'Section shuffle reverted successfully!');
      sessionStorage.removeItem('sis_last_shuffle_token');
      setLastRollbackToken(null);
      setPreviewData(null);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Rollback failed');
    }
    setRevertingShuffle(false);
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar title="Student Section Shuffle & Class Balancing" />
        <div className="page-body">

          {/* Breadcrumb & Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#64748b', marginBottom: 4 }}>
                <span style={{ cursor: 'pointer', color: '#0176d3' }} onClick={() => navigate('/students')}>Student Management</span>
                <span>/</span>
                <span style={{ fontWeight: 600, color: '#1e293b' }}>Section Shuffle</span>
              </div>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span>🔀</span> Section Shuffle & Class Balancing
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
                Reorganize and rebalance students across sections within the academic session without affecting historical records.
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

          {/* Rollback Alert Banner */}
          {lastRollbackToken && (
            <div style={{
              background: '#eff6ff', border: '1px solid #93c5fd', borderRadius: 10,
              padding: '12px 18px', marginBottom: 18, display: 'flex',
              justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10,
              boxShadow: '0 2px 6px rgba(37,99,235,0.08)'
            }}>
              <div style={{ fontSize: 13, color: '#1e40af' }}>
                ⚡ <strong>Recent Section Shuffle Active</strong> (Token: <code>{lastRollbackToken.slice(0, 12)}...</code>). If any students were misassigned, you can undo the entire shuffle in 1 click.
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={handleRollbackShuffle}
                  disabled={revertingShuffle}
                  style={{
                    background: '#2563eb', color: '#fff', border: 'none',
                    borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  {revertingShuffle ? 'Reverting...' : '↩️ Undo / Revert Last Shuffle'}
                </button>
                <button
                  type="button"
                  onClick={() => { sessionStorage.removeItem('sis_last_shuffle_token'); setLastRollbackToken(null); }}
                  style={{ background: 'none', border: 'none', fontSize: 12, color: '#64748b', cursor: 'pointer' }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Main Configuration Card */}
          <div style={{
            background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12,
            padding: 20, marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 16px', color: '#1e293b' }}>
              Step 1: Select Class & Shuffle Mode
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 18 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
                  Academic Session
                </label>
                <input
                  className="form-input"
                  value={session}
                  onChange={e => setSession(e.target.value)}
                  placeholder="e.g. 2024-25"
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
                  Select Class
                </label>
                <select
                  className="form-select"
                  value={className}
                  onChange={e => {
                    setClassName(e.target.value);
                    setSourceClassId('');
                    setPreviewData(null);
                  }}
                  style={{ width: '100%' }}
                >
                  {distinctClassNames.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
                  Shuffle Strategy
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => { setMode('SMART'); setPreviewData(null); }}
                    style={{
                      flex: 1, padding: '8px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      background: mode === 'SMART' ? '#0176d3' : '#f1f5f9',
                      color: mode === 'SMART' ? '#fff' : '#475569',
                      border: mode === 'SMART' ? '1px solid #0176d3' : '1px solid #cbd5e1'
                    }}
                  >
                    🤖 Smart Balancing
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMode('MANUAL'); setPreviewData(null); }}
                    style={{
                      flex: 1, padding: '8px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      background: mode === 'MANUAL' ? '#0176d3' : '#f1f5f9',
                      color: mode === 'MANUAL' ? '#fff' : '#475569',
                      border: mode === 'MANUAL' ? '1px solid #0176d3' : '1px solid #cbd5e1'
                    }}
                  >
                    ✋ Manual Move
                  </button>
                </div>
              </div>
            </div>

            {/* Smart Balancing Configuration */}
            {mode === 'SMART' && (
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, marginTop: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 10 }}>
                  Smart Balancing Options:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, alignItems: 'center' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                      Target Sections (comma-separated)
                    </label>
                    <input
                      className="form-input"
                      value={smartSectionsInput}
                      onChange={e => setSmartSectionsInput(e.target.value)}
                      placeholder="e.g. A, B, C"
                      style={{ width: '100%' }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 4 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#334155', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={balanceCount}
                        onChange={e => setBalanceCount(e.target.checked)}
                      />
                      Equal student headcount distribution
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#334155', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={balanceGender}
                        onChange={e => setBalanceGender(e.target.checked)}
                      />
                      Balanced gender ratio (Boys / Girls)
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#334155', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={balanceHouse}
                        onChange={e => setBalanceHouse(e.target.checked)}
                      />
                      Balanced house allocation
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Manual Relocation Configuration */}
            {mode === 'MANUAL' && (
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, marginTop: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                      Source Section
                    </label>
                    <select
                      className="form-select"
                      value={sourceClassId}
                      onChange={e => setSourceClassId(e.target.value)}
                      style={{ width: '100%' }}
                    >
                      <option value="">-- Choose Source Section --</option>
                      {sectionsForClass.map(c => (
                        <option key={c.id} value={c.id}>Section {c.section}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                      Move Selected Students To Section
                    </label>
                    <input
                      className="form-input"
                      value={targetSection}
                      onChange={e => setTargetSection(e.target.value.toUpperCase())}
                      placeholder="e.g. B"
                      maxLength={4}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>

                {sourceClassId && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>
                        Select Students to Relocate ({selectedStudentIds.size} of {classStudents.length} selected):
                      </span>
                      <button
                        type="button"
                        onClick={toggleSelectAll}
                        style={{ background: 'none', border: 'none', color: '#0176d3', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
                      >
                        {selectedStudentIds.size === classStudents.length ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>

                    {loadingStudents ? (
                      <div style={{ padding: 20, textAlign: 'center', color: '#64748b', fontSize: 13 }}>Loading students...</div>
                    ) : classStudents.length === 0 ? (
                      <div style={{ padding: 20, textAlign: 'center', color: '#64748b', fontSize: 13 }}>No active students in this section.</div>
                    ) : (
                      <div style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff' }}>
                        {classStudents.map(s => (
                          <div
                            key={s.id}
                            onClick={() => toggleStudent(s.id)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                              borderBottom: '1px solid #f1f5f9', cursor: 'pointer',
                              background: selectedStudentIds.has(s.id) ? '#eff6ff' : '#fff'
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={selectedStudentIds.has(s.id)}
                              onChange={() => {}}
                            />
                            <span style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>{s.name}</span>
                            <span style={{ fontSize: 11, color: '#64748b' }}>Roll: {s.roll_number || '—'}</span>
                            <span style={{ fontSize: 11, color: '#64748b' }}>Adm: {s.admission_number || '—'}</span>
                            <span style={{ fontSize: 11, color: '#64748b', marginLeft: 'auto' }}>Gender: {s.gender || '—'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Action Bar */}
            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button
                type="button"
                className="btn btn-primary"
                disabled={loadingPreview}
                onClick={handleGeneratePreview}
                style={{ minWidth: 180, fontWeight: 700 }}
              >
                {loadingPreview ? 'Calculating...' : '🔍 Generate Shuffle Preview'}
              </button>
            </div>
          </div>

          {/* Preview Results Section */}
          {previewData && (
            <div style={{
              background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12,
              padding: 20, marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: '#1e293b' }}>
                    Step 2: Review Proposed Section Allocations
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>
                    Verify proposed changes before committing to the database.
                  </p>
                </div>

                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={executing || !previewData.proposed_moves || previewData.proposed_moves.length === 0}
                  onClick={handleConfirmShuffle}
                  style={{ background: '#16a34a', borderColor: '#16a34a', fontWeight: 700 }}
                >
                  {executing ? 'Executing Shuffle...' : `✓ Confirm & Execute Shuffle (${previewData.proposed_moves?.length || 0} Students)`}
                </button>
              </div>

              {/* Statistics Distribution Cards */}
              {previewData.distribution && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 18 }}>
                  {Object.entries(previewData.distribution).map(([sec, stats]) => (
                    <div key={sec} style={{
                      background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 8,
                      padding: '12px 14px', textAlign: 'center'
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                        Section {sec}
                      </div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: '#0284c7', margin: '4px 0' }}>
                        {stats.total ?? stats.count ?? 0} Students
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>
                        Boys: <strong>{stats.boys ?? stats.male ?? '—'}</strong> | Girls: <strong>{stats.girls ?? stats.female ?? '—'}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Diff Table */}
              <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                      <th style={{ padding: '10px 14px', fontSize: 12, textAlign: 'left' }}>Student Name</th>
                      <th style={{ padding: '10px 14px', fontSize: 12, textAlign: 'left' }}>Admission No</th>
                      <th style={{ padding: '10px 14px', fontSize: 12, textAlign: 'center' }}>Gender</th>
                      <th style={{ padding: '10px 14px', fontSize: 12, textAlign: 'center' }}>Current Section</th>
                      <th style={{ padding: '10px 14px', fontSize: 12, textAlign: 'center' }}>Proposed Section</th>
                      <th style={{ padding: '10px 14px', fontSize: 12, textAlign: 'center' }}>New Roll No</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(!previewData.proposed_moves || previewData.proposed_moves.length === 0) ? (
                      <tr>
                        <td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#64748b', fontSize: 13 }}>
                          No section changes required; distribution is already balanced.
                        </td>
                      </tr>
                    ) : (
                      previewData.proposed_moves.map(m => {
                        const changed = m.current_section !== m.target_section;
                        return (
                          <tr key={m.student_id} style={{ borderBottom: '1px solid #f1f5f9', background: changed ? '#fefce8' : '#fff' }}>
                            <td style={{ padding: '10px 14px', fontWeight: 600, fontSize: 13, color: '#0f172a' }}>
                              {m.student_name}
                            </td>
                            <td style={{ padding: '10px 14px', fontSize: 12, color: '#64748b' }}>
                              {m.admission_number || '—'}
                            </td>
                            <td style={{ padding: '10px 14px', fontSize: 12, textAlign: 'center', color: '#64748b' }}>
                              {m.gender || '—'}
                            </td>
                            <td style={{ padding: '10px 14px', fontSize: 12, textAlign: 'center' }}>
                              <span style={{ padding: '2px 8px', borderRadius: 4, background: '#f1f5f9', fontWeight: 700 }}>
                                Section {m.current_section}
                              </span>
                            </td>
                            <td style={{ padding: '10px 14px', fontSize: 12, textAlign: 'center' }}>
                              <span style={{
                                padding: '3px 10px', borderRadius: 4, fontWeight: 700,
                                background: changed ? '#dcfce7' : '#f1f5f9',
                                color: changed ? '#15803d' : '#475569'
                              }}>
                                Section {m.target_section}
                              </span>
                            </td>
                            <td style={{ padding: '10px 14px', fontSize: 12, textAlign: 'center', color: '#0f172a', fontWeight: 600 }}>
                              {m.target_roll_number || m.current_roll_no || '—'}
                            </td>
                          </tr>
                        );
                      })
                    )}
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
