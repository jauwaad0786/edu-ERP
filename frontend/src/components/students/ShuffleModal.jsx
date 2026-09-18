import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function ShuffleModal({ isOpen, onClose, onSuccess, classes = [], sessions = [] }) {
  const [session, setSession] = useState(sessions[0] || '2024-25');
  const [className, setClassName] = useState('');
  const [sourceClassId, setSourceClassId] = useState('');
  const [targetSection, setTargetSection] = useState('B');
  const [mode, setMode] = useState('MANUAL'); // 'MANUAL' | 'SMART'

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

  // Distinct class names (e.g. "Class 6", "Class 7")
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

  if (!isOpen) return null;

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
    setLoadingPreview(true);
    try {
      let payload = {
        session,
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
        session,
        class_name: className,
        moves: previewData.proposed_moves.map(m => ({
          student_id: m.student_id,
          target_section: m.target_section,
          target_roll_number: m.target_roll_number || undefined,
        })),
      };

      const res = await api.post('/principal/students/shuffle/confirm', payload);
      const token = res.data.rollback_token;
      toast.success(res.data.message || 'Section shuffle executed successfully!');
      onSuccess(token);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Shuffle execution failed');
    }
    setExecuting(false);
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={e => e.target === e.currentTarget && !executing && onClose()} onKeyDown={e => e.key === "Escape" && (!executing && onClose())}>
      <div className="modal" style={{ maxWidth: 960, width: '95%' }}>
        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>🔀</span> Section Shuffle & Class Balancing
            </h3>
            <span style={{ fontSize: 12, color: 'var(--neutral-5)' }}>
              Reorganize sections within the current session. Historical academic years and permanent profiles remain intact.
            </span>
          </div>
          <button className="modal-close" disabled={executing} onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Top Controls */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="shuffle-f1">Academic Session</label>
              <input id="shuffle-f1"
                className="form-input"
                value={session}
                onChange={e => setSession(e.target.value)}
                placeholder="2024-25"
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="shuffle-f2">Select Class</label>
              <select id="shuffle-f2"
                className="form-select"
                value={className}
                onChange={e => { setClassName(e.target.value); setSourceClassId(''); setPreviewData(null); }}
              >
                {distinctClassNames.map(cn => (
                  <option key={cn} value={cn}>{cn}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="shuffle-f3">Shuffle Mode</label>
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => { setMode('MANUAL'); setPreviewData(null); }}
                  style={{
                    flex: 1, padding: '6px 10px', fontSize: 12, fontWeight: 700, borderRadius: 6,
                    border: '1px solid', cursor: 'pointer',
                    borderColor: mode === 'MANUAL' ? '#0176d3' : '#cbd5e1',
                    background: mode === 'MANUAL' ? '#0176d3' : '#fff',
                    color: mode === 'MANUAL' ? '#fff' : 'var(--neutral-7)',
                  }}
                >
                  Manual Move
                </button>
                <button
                  type="button"
                  onClick={() => { setMode('SMART'); setPreviewData(null); }}
                  style={{
                    flex: 1, padding: '6px 10px', fontSize: 12, fontWeight: 700, borderRadius: 6,
                    border: '1px solid', cursor: 'pointer',
                    borderColor: mode === 'SMART' ? '#7c3aed' : '#cbd5e1',
                    background: mode === 'SMART' ? '#7c3aed' : '#fff',
                    color: mode === 'SMART' ? '#fff' : 'var(--neutral-7)',
                  }}
                >
                  ⚡ Smart Balance
                </button>
              </div>
            </div>
          </div>

          {/* ── Mode 1: MANUAL MOVE ── */}
          {mode === 'MANUAL' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="shuffle-f4">From Section (Source) *</label>
                  <select id="shuffle-f4"
                    className="form-select"
                    value={sourceClassId}
                    onChange={e => setSourceClassId(e.target.value)}
                  >
                    <option value="">Select source section...</option>
                    {sectionsForClass.map(c => (
                      <option key={c.id} value={c.id}>Section {c.section}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="shuffle-f5">To Section (Target) *</label>
                  <input id="shuffle-f5"
                    className="form-input"
                    value={targetSection}
                    onChange={e => setTargetSection(e.target.value.toUpperCase())}
                    placeholder="e.g. B"
                  />
                </div>
              </div>

              {sourceClassId && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--neutral-7)' }}>
                      Select Students to Move ({selectedStudentIds.size} of {classStudents.length} selected)
                    </span>
                    <button type="button" className="btn btn-neutral btn-sm" onClick={toggleSelectAll}>
                      {selectedStudentIds.size === classStudents.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>

                  {loadingStudents ? (
                    <div style={{ padding: 24, textAlign: 'center', color: 'var(--neutral-5)' }}>Loading students...</div>
                  ) : classStudents.length === 0 ? (
                    <div style={{ padding: 24, textAlign: 'center', color: 'var(--neutral-4)' }}>No students in this section</div>
                  ) : (
                    <div className="table-container" style={{ maxHeight: 220, overflowY: 'auto' }}>
                      <table>
                        <thead>
                          <tr>
                            <th style={{ width: 40 }}>Pick</th>
                            <th>Roll No</th>
                            <th>Name</th>
                            <th>Gender</th>
                            <th>House</th>
                          </tr>
                        </thead>
                        <tbody>
                          {classStudents.map(s => (
                            <tr key={s.id} onClick={() => toggleStudent(s.id)} style={{ cursor: 'pointer', background: selectedStudentIds.has(s.id) ? '#f0f9ff' : 'inherit' }}>
                              <td>
                                <input
                                  type="checkbox"
                                  checked={selectedStudentIds.has(s.id)}
                                  onChange={() => {}}
                                />
                              </td>
                              <td style={{ fontWeight: 600 }}>{s.roll_number || '—'}</td>
                              <td style={{ fontWeight: 700 }}>{s.name}</td>
                              <td>{s.gender || '—'}</td>
                              <td>{s.house || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Mode 2: SMART BALANCED SHUFFLE ── */}
          {mode === 'SMART' && (
            <div style={{ background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 8, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 13, color: '#6b21a8' }}>
                ⚡ <strong>Smart Shuffle Engine:</strong> Automatically redistributes all enrolled students in {className} across specified sections while balancing count, gender parity, and house diversity.
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="shuffle-f6">Target Sections (Comma-separated) *</label>
                <input id="shuffle-f6"
                  className="form-input"
                  value={smartSectionsInput}
                  onChange={e => setSmartSectionsInput(e.target.value)}
                  placeholder="e.g. A, B, C"
                />
              </div>
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                  <input type="checkbox" checked={balanceCount} onChange={e => setBalanceCount(e.target.checked)} />
                  Equal Student Count
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                  <input type="checkbox" checked={balanceGender} onChange={e => setBalanceGender(e.target.checked)} />
                  Balanced Gender Ratio
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                  <input type="checkbox" checked={balanceHouse} onChange={e => setBalanceHouse(e.target.checked)} />
                  Balanced House Distribution
                </label>
              </div>
            </div>
          )}

          {/* Generate Preview Button */}
          {!previewData && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-primary"
                disabled={loadingPreview}
                onClick={handleGeneratePreview}
              >
                {loadingPreview ? 'Generating Preview...' : 'Generate Shuffle Preview →'}
              </button>
            </div>
          )}

          {/* ── PREVIEW SECTION ── */}
          {previewData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, borderTop: '2px solid #e2e8f0', paddingTop: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ margin: 0, fontSize: 14 }}>
                  📋 Shuffle Preview: {previewData.total_moves} Student {previewData.total_moves === 1 ? 'Move' : 'Moves'}
                </h4>
                <button type="button" className="btn btn-neutral btn-sm" onClick={() => setPreviewData(null)}>
                  Change Settings
                </button>
              </div>

              {/* Distribution summary cards */}
              {previewData.after_distribution && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                  {Object.entries(previewData.after_distribution).map(([sec, count]) => {
                    const before = previewData.before_distribution?.[sec] ?? 0;
                    return (
                      <div key={sec} style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--neutral-5)' }}>SECTION {sec}</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: '#0176d3', marginTop: 2 }}>
                          {count} Students
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--neutral-5)' }}>
                          Previously: {before} ({count >= before ? `+${count - before}` : count - before})
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Moves table */}
              <div className="table-container" style={{ maxHeight: 240, overflowY: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Previous Section</th>
                      <th>Proposed Section</th>
                      <th>House</th>
                      <th>Gender</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.proposed_moves.map(m => (
                      <tr key={m.student_id}>
                        <td style={{ fontWeight: 700 }}>{m.name}</td>
                        <td>
                          <span className="badge badge-neutral">Sec {m.current_section}</span>
                        </td>
                        <td>
                          <span className="badge badge-success" style={{ fontWeight: 800 }}>
                            Sec {m.target_section}
                          </span>
                        </td>
                        <td>{m.house || '—'}</td>
                        <td>{m.gender || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" className="btn btn-neutral" disabled={executing} onClick={onClose}>
            Cancel
          </button>
          {previewData && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={executing || previewData.total_moves === 0}
              onClick={handleConfirmShuffle}
              style={{ background: '#0176d3' }}
            >
              {executing ? 'Executing Shuffle...' : `Confirm & Move ${previewData.total_moves} Students`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
