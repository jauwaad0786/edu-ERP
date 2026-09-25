import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Navbar  from '../components/Navbar';
import api     from '../api/axios';
import toast   from 'react-hot-toast';

/* ── helpers ── */
function _grade(marks, max) {
  const pct = max ? (marks / max) * 100 : 0;
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B+';
  if (pct >= 60) return 'B';
  if (pct >= 50) return 'C';
  if (pct >= 33) return 'D';
  return 'F';
}
const GRADE_COLOR = {
  'A+':'#2e844a','A':'#2e844a','B+':'#0176d3','B':'#0176d3',
  'C':'#dd7a01','D':'#dd7a01','F':'#ba0517','AB':'#747474','—':'#c9c9c9',
};
const gc = g => GRADE_COLOR[g] || '#747474';
const MEDAL = { 1:'🥇', 2:'🥈', 3:'🥉' };

/* ── TopperCard ── */
function TopperCard({ icon, title, subtitle, toppers, loading, valueLabel='percentage', onStudentClick }) {
  return (
    <div className="card">
      <div className="card-header" style={{ display:'flex', alignItems:'center', gap:8 }}>
        <span style={{ fontSize:18 }}>{icon}</span>
        <div>
          <div style={{ fontWeight:700, fontSize:13 }}>{title}</div>
          {subtitle && <div style={{ fontSize:11, color:'var(--neutral-6)' }}>{subtitle}</div>}
        </div>
      </div>
      <div className="card-body" style={{ paddingTop:8 }}>
        {loading ? [1,2,3].map(i => (
          <div key={i} style={{ height:46, borderRadius:8, marginBottom:8,
            background:'linear-gradient(90deg,var(--neutral-1) 25%,var(--neutral-2) 37%,var(--neutral-1) 63%)',
            backgroundSize:'400px 100%', animation:'shimmer 1.4s infinite' }} />
        )) : toppers.length === 0 ? (
          <div style={{ fontSize:12, color:'var(--neutral-6)', textAlign:'center', padding:'20px 0' }}>
            No results yet
          </div>
        ) : toppers.map(t => (
          <div key={t.student_id}
            role="button"
            tabIndex={0}
            onClick={() => onStudentClick(t.student_id)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onStudentClick(t.student_id); } }}
            style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px',
              borderRadius:8, border:'1px solid var(--neutral-2)', cursor:'pointer',
              marginBottom:6, transition:'background 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background='var(--neutral-1)'}
            onMouseLeave={e => e.currentTarget.style.background='transparent'}>
            <span style={{ fontSize:18, width:24, textAlign:'center' }}>{MEDAL[t.rank] || `#${t.rank}`}</span>
            <div className="avatar avatar-sm" style={{ background:'var(--blue-10)', color:'var(--blue-80)' }}>
              {(t.name||'?').charAt(0).toUpperCase()}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:13, fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{t.name}</div>
              <div style={{ fontSize:11, color:'var(--neutral-6)' }}>
                {t.class_name}{t.roll_number ? ` · Roll ${t.roll_number}` : ''}{t.subject_name ? ` · ${t.subject_name}` : ''}
              </div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:14, fontWeight:800, color:'var(--blue-80)' }}>
                {valueLabel==='marks' ? `${t.marks_obtained}/${t.max_marks}` : `${t.percentage}%`}
              </div>
              <span className="badge" style={{ background:`${gc(t.grade)}1A`, color:gc(t.grade) }}>{t.grade}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ════════════ MarksPage ════════════ */
export default function MarksPage() {
  const navigate = useNavigate();

  /* filter state */
  const [classes,  setClasses]  = useState([]);
  const [exams,    setExams]    = useState([]);
  const [classId,  setClassId]  = useState('');
  const [examId,   setExamId]   = useState('');

  /* grid state */
  const [grid,     setGrid]     = useState(null);   // full API response
  const [cells,    setCells]    = useState({});      // { "studentId-subjectId": value }
  const [maxEdits, setMaxEdits] = useState({});      // { subjectId: newMax } — per-subject max override
  const [search,   setSearch]   = useState('');
  const [loadingGrid, setLoadingGrid] = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [publishing, setPublishing] = useState(false);

  /* toppers */
  const [schoolToppers,  setSchoolToppers]  = useState([]);
  const [classToppers,   setClassToppers]   = useState([]);
  const [loadingTop, setLoadingTop] = useState(false);

  /* ── initial load ── */
  useEffect(() => {
    Promise.all([api.get('/principal/classes'), api.get('/principal/exams')])
      .then(([c, e]) => { setClasses(c.data||[]); setExams(e.data||[]); })
      .catch(() => toast.error('Failed to load marks'));
  }, []);

  /* ── toppers ── */
  const fetchToppers = useCallback(() => {
    if (!examId) { setSchoolToppers([]); setClassToppers([]); return; }
    setLoadingTop(true);
    const calls = [api.get(`/marks/toppers/school?exam_id=${examId}`)];
    if (classId) calls.push(api.get(`/marks/toppers/class?exam_id=${examId}&class_id=${classId}`));
    Promise.all(calls)
      .then(([s, c]) => { setSchoolToppers(s.data||[]); setClassToppers(c?.data||[]); })
      .catch(() => {})
      .finally(() => setLoadingTop(false));
  }, [examId, classId]);

  useEffect(() => { fetchToppers(); }, [fetchToppers]);

  /* ── grid load ── */
  const loadGrid = useCallback(() => {
    if (!classId || !examId) { setGrid(null); setCells({}); setMaxEdits({}); return; }
    setLoadingGrid(true);
    api.get(`/marks/grid?class_id=${classId}&exam_id=${examId}`)
      .then(res => {
        setGrid(res.data);
        const c = {};
        (res.data.rows || []).forEach(row => {
          Object.entries(row.cells).forEach(([sid, cell]) => {
            c[`${row.student_id}-${sid}`] = {
              marks_obtained: (cell.marks_obtained !== null && cell.marks_obtained !== undefined)
                              ? Number(cell.marks_obtained) : null,
              is_absent:      !!cell.is_absent,
              remarks:        cell.remarks || '',
              is_locked:      !!cell.is_locked,
            };
          });
        });
        setCells(c);
      })
      .catch(() => toast.error('Failed to load Grid'))
      .finally(() => setLoadingGrid(false));
  }, [classId, examId]);

  useEffect(() => { loadGrid(); }, [loadGrid]);

  /* ── cell updater ── */
  function updateCell(studentId, subjectId, field, value) {
    const key = `${studentId}-${subjectId}`;
    setCells(prev => ({
      ...prev,
      [key]: { ...(prev[key] || {}), [field]: value },
    }));
  }

  /* ── save grid ── */
  async function handleSave() {
    if (!grid) return;
    setSaving(true);
    try {
      const entries = (grid.rows || []).map(row => ({
        student_id: row.student_id,
        subjects: (grid.subjects || []).map(subj => {
          const key  = `${row.student_id}-${subj.id}`;
          const cell = cells[key] || {};
          const max  = Number.parseFloat(maxEdits[subj.id] ?? subj.max_marks);
          return {
            subject_id:     subj.id,
            marks_obtained: cell.is_absent ? 0 : (cell.marks_obtained ?? null),
            max_marks:      max,
            is_absent:      !!cell.is_absent,
            remarks:        cell.remarks || '',
          };
        }),
      }));

      await api.post('/marks/grid/save', {
        class_id: classId, exam_id: examId, entries,
      });
      toast.success('✅ Marks saved!');
      loadGrid();
      fetchToppers();
    } catch {
      toast.error('Failed to save');
    }
    setSaving(false);
  }

  /* ── publish ── */
  async function handlePublish() {
    if (!window.confirm('Publishing results will make them visible to students and parents. Confirm?')) return;
    setPublishing(true);
    try {
      await api.post('/marks/publish', { exam_id: examId, class_id: classId || undefined });
      toast.success('🎉 Results published!');
      loadGrid();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to publish');
    }
    setPublishing(false);
  }

  /* ── derived ── */
  const selectedClass = classes.find(c => String(c.id) === String(classId));
  const selectedExam  = exams.find(e => String(e.id) === String(examId));

  const filteredRows = (grid?.rows || []).filter(r =>
    !search ||
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    (r.roll_number||'').toLowerCase().includes(search.toLowerCase())
  );

  /* live totals per student */
  function liveTotal(row) {
    let obt = 0, max = 0;
    (grid?.subjects || []).forEach(subj => {
      const key  = `${row.student_id}-${subj.id}`;
      const cell = cells[key] || {};
      const m    = Number.parseFloat(maxEdits[subj.id] ?? subj.max_marks);
      if (!cell.is_absent && cell.marks_obtained !== null && cell.marks_obtained !== undefined && cell.marks_obtained !== '') {
        obt += Number.parseFloat(cell.marks_obtained);
        max += m;
      }
    });
    return { obt, max, pct: max ? Math.round(obt / max * 100) : 0 };
  }

  const isPublished  = grid?.is_published;
  const isGridLocked = grid?.is_locked;
  const canEdit      = !isGridLocked;

  /* ════════════════════ RENDER ════════════════════ */
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar title="Marks Management" />
        <div className="page-body">
          <style>{`
            @keyframes shimmer {
              0%{background-position:-200px 0}
              100%{background-position:calc(200px + 100%) 0}
            }
            .marks-grid th { position:sticky; top:0; z-index:2; background:var(--neutral-1); }
            .marks-grid td, .marks-grid th { white-space:nowrap; }
            .marks-grid .col-freeze { position:sticky; left:0; z-index:3; background:#fff; }
            .marks-grid thead .col-freeze { z-index:4; }
            .marks-grid tr:hover td { background:#f8fafc; }
            .marks-num-input {
              width:80px; padding:5px 8px; border:1.5px solid var(--neutral-3);
              border-radius:6px; font-size:13px; font-weight:600; text-align:center;
              outline:none; transition:border 0.15s;
            }
            .marks-num-input:focus { border-color:#0176d3; background:#f0f7ff; }
            .marks-num-input:disabled { background:var(--neutral-1); color:var(--neutral-5); border-color:var(--neutral-2); }
            .max-edit-input {
              width:55px; padding:3px 6px; border:1.5px dashed #0176d3;
              border-radius:5px; font-size:11px; text-align:center; color:#0176d3; font-weight:700;
              background:#f0f7ff; outline:none;
            }
          `}</style>

          <div className="page-header">
            <div>
              <h2 className="page-title">Marks Management</h2>
              <p className="page-subtitle">Multi-subject grid entry · Topper analytics · Result publishing</p>
            </div>
          </div>

          {/* ── Filters ── */}
          <div className="card mb-6">
            <div className="card-body" style={{ display:'flex', gap:16, flexWrap:'wrap', alignItems:'flex-end' }}>
              <div className="form-group" style={{ minWidth:180, marginBottom:0 }}>
                <label className="form-label" htmlFor="marks-class-filter">Class</label>
                <select id="marks-class-filter" className="form-select" value={classId} onChange={e => setClassId(e.target.value)}>
                  <option value="">Select class</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name} - {c.section}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ minWidth:220, marginBottom:0 }}>
                <label className="form-label" htmlFor="marks-exam-filter">Exam</label>
                <select id="marks-exam-filter" className="form-select" value={examId} onChange={e => setExamId(e.target.value)}>
                  <option value="">Select exam</option>
                  {exams.map(ex => <option key={ex.id} value={ex.id}>{ex.exam_name} ({ex.session})</option>)}
                </select>
              </div>
              {isPublished && (
                <div style={{ padding:'8px 16px', borderRadius:8, background:'#dcfce7',
                  color:'#16a34a', fontWeight:700, fontSize:13, display:'flex', alignItems:'center', gap:6 }}>
                  ✅ Results Published
                </div>
              )}
            </div>
          </div>

          {/* ── Toppers ── */}
          <div className="grid-3 mb-6">
            <TopperCard icon="🏆" title="School Toppers"
              subtitle={selectedExam?.exam_name || 'Select exam'}
              toppers={schoolToppers} loading={loadingTop}
              onStudentClick={id => navigate(`/students/${id}`)} />
            <TopperCard icon="🎓" title="Class Toppers"
              subtitle={selectedClass ? `${selectedClass.name} - ${selectedClass.section}` : 'Select class'}
              toppers={classToppers} loading={loadingTop}
              onStudentClick={id => navigate(`/students/${id}`)} />
            <div className="card">
              <div className="card-header" style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize:18 }}>📊</span>
                <div>
                  <div style={{ fontWeight:700, fontSize:13 }}>Result Status</div>
                  <div style={{ fontSize:11, color:'var(--neutral-6)' }}>
                    {selectedExam?.exam_name || 'Select exam'}
                  </div>
                </div>
              </div>
              <div className="card-body" style={{ paddingTop:8 }}>
                {grid ? (
                  <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:13 }}>
                      <span style={{ color:'var(--neutral-6)' }}>Total Students</span>
                      <strong>{grid.rows?.length || 0}</strong>
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:13 }}>
                      <span style={{ color:'var(--neutral-6)' }}>Subjects</span>
                      <strong>{grid.subjects?.length || 0}</strong>
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:13 }}>
                      <span style={{ color:'var(--neutral-6)' }}>Status</span>
                      <span style={{ fontWeight:700,
                        color: isPublished ? '#16a34a' : isGridLocked ? '#d97706' : '#0176d3' }}>
                        {isPublished ? '✅ Published' : isGridLocked ? '🔒 Locked' : '📝 Draft'}
                      </span>
                    </div>
                    {isPublished ? (
                      <div style={{ marginTop:6, padding:'6px 12px', borderRadius:8,
                        background:'#dcfce7', color:'#16a34a', fontWeight:700, fontSize:12,
                        textAlign:'center' }}>
                        ✅ Already Published
                      </div>
                    ) : (
                      <button
                        className="btn btn-sm"
                        style={{ marginTop:6, background:'#16a34a', color:'#fff',
                          fontWeight:700, border:'none', opacity: publishing ? 0.7 : 1 }}
                        disabled={publishing || !grid}
                        onClick={handlePublish}>
                        {publishing ? 'Publishing…' : '🚀 Publish Results'}
                      </button>
                    
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize:12, color:'var(--neutral-6)', textAlign:'center', padding:'20px 0' }}>
                    Select class &amp; exam
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Grid ── */}
          <div className="card">
            <div className="card-header" style={{ display:'flex', justifyContent:'space-between',
              alignItems:'center', flexWrap:'wrap', gap:12 }}>
              <div style={{ fontWeight:700, fontSize:14 }}>
                📋 Marks Entry Grid
                {selectedClass && selectedExam &&
                  ` — ${selectedClass.name} ${selectedClass.section} · ${selectedExam.exam_name}`}
              </div>
              {grid && (
                <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
                  <input className="form-input" style={{ width:200 }}
                    placeholder="🔍 Search student / roll no"
                    value={search} onChange={e => setSearch(e.target.value)} />
                  {isGridLocked ? (
                    <span style={{ padding:'6px 16px', borderRadius:8, fontSize:12,
                      background:'#fef3c7', color:'#d97706', fontWeight:700 }}>🔒 Marks Locked</span>
                  ) : (
                    <button className="btn btn-primary btn-sm" disabled={saving} onClick={handleSave}>
                      {saving ? 'Saving…' : '💾 Save All Marks'}
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="card-body" style={{ padding:0 }}>
              {(!classId || !examId) ? (
                <div style={{ padding:'48px 20px', textAlign:'center', color:'var(--neutral-6)', fontSize:13 }}>
                  ☝️ Select Class and Examination to view the subject grade matrix
                </div>
              ) : loadingGrid ? (
                <div style={{ padding:16 }}>
                  {[1,2,3,4].map(i => (
                    <div key={i} style={{ height:44, borderRadius:6, marginBottom:8,
                      background:'linear-gradient(90deg,var(--neutral-1) 25%,var(--neutral-2) 37%,var(--neutral-1) 63%)',
                      backgroundSize:'400px 100%', animation:'shimmer 1.4s infinite' }} />
                  ))}
                </div>
              ) : !grid?.subjects?.length ? (
                <div style={{ padding:'48px 20px', textAlign:'center', color:'var(--neutral-6)', fontSize:13 }}>
                  ⚠️ No subjects assigned to this class — please add subjects in{' '}
                  <a href="/subjects" style={{ color:'#0176d3', fontWeight:600 }}>Subjects page</a>{' '}
                  Curriculum first
                </div>
              ) : filteredRows.length === 0 ? (
                <div style={{ padding:'48px 20px', textAlign:'center', color:'var(--neutral-6)', fontSize:13 }}>
                  No students found
                </div>
              ) : (
                <div style={{ overflowX:'auto', maxHeight:560, overflowY:'auto' }}>
                  <table className="marks-grid" style={{ borderCollapse:'collapse', width:'100%', fontSize:13 }}>
                    <thead>
                      <tr style={{ borderBottom:'2px solid var(--neutral-3)' }}>
                        {/* Freeze: Roll + Name */}
                        <th className="col-freeze" style={{ padding:'10px 14px', textAlign:'left', minWidth:60 }}>Roll</th>
                        <th className="col-freeze" style={{ padding:'10px 14px', textAlign:'left', minWidth:160, left:60 }}>Student</th>
                        {/* Dynamic subject columns */}
                        {grid.subjects.map(subj => (
                          <th key={subj.id} style={{ padding:'8px 12px', textAlign:'center', minWidth:110 }}>
                            <div style={{ fontWeight:700 }}>{subj.name}</div>
                            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:4, marginTop:2 }}>
                              <span style={{ fontSize:10, color:'var(--neutral-6)', fontWeight:400 }}>Max:</span>
                              {canEdit ? (
                                <input
                                  className="max-edit-input"
                                  type="number"
                                  value={maxEdits[subj.id] ?? subj.max_marks}
                                  onChange={e => setMaxEdits(prev => ({ ...prev, [subj.id]: e.target.value }))}
                                  title="Edit maximum marks"
                                />
                              ) : (
                                <span style={{ fontSize:11, fontWeight:700, color:'#0176d3' }}>{subj.max_marks}</span>
                              )}
                            </div>
                          </th>
                        ))}
                        <th style={{ padding:'10px 12px', textAlign:'center', minWidth:80 }}>Total</th>
                        <th style={{ padding:'10px 12px', textAlign:'center', minWidth:60 }}>%</th>
                        <th style={{ padding:'10px 12px', textAlign:'center', minWidth:60 }}>Grade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRows.map((row, ri) => {
                        const { obt, max, pct } = liveTotal(row);
                        const grade = max ? _grade(obt, max) : '—';
                        return (
                          <tr key={row.student_id}
                            style={{ borderBottom:'1px solid var(--neutral-2)',
                              background: ri % 2 === 0 ? '#fff' : '#fafbfc' }}>
                            {/* Frozen cells */}
                            <td className="col-freeze" style={{ padding:'8px 14px', fontWeight:600, color:'var(--neutral-6)' }}>
                              {row.roll_number || '—'}
                            </td>
                            <td className="col-freeze" style={{ padding:'8px 14px', fontWeight:700,
                              cursor:'pointer', color:'#0176d3', left:60 }}
                              onClick={() => navigate(`/students/${row.student_id}`)}>
                              {row.name}
                            </td>
                            {/* Subject mark cells */}
                            {grid.subjects.map(subj => {
                              const key  = `${row.student_id}-${subj.id}`;
                              const cell = cells[key] || {};
                              const max  = Number.parseFloat(maxEdits[subj.id] ?? subj.max_marks);
                              const mo   = cell.marks_obtained;
                              const locked = cell.is_locked || isGridLocked;
                              return (
                                <td key={subj.id} style={{ padding:'6px 10px', textAlign:'center' }}>
                                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
                                    <input
                                      className="marks-num-input"
                                      type="number"
                                      min={0} max={max}
                                      disabled={cell.is_absent || locked}
                                      value={mo !== null && mo !== undefined ? mo : ''}
                                      onChange={e => updateCell(row.student_id, subj.id, 'marks_obtained', e.target.value === '' ? null : Number(e.target.value))}
                                      placeholder="—"
                                    />
                                    <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                                      <input type="checkbox"
                                        checked={!!cell.is_absent}
                                        disabled={locked}
                                        onChange={e => updateCell(row.student_id, subj.id, 'is_absent', e.target.checked)}
                                        style={{ width:12, height:12 }}
                                      />
                                      <span style={{ fontSize:10, color:'var(--neutral-6)' }}>Absent</span>
                                    </div>
                                    {/* show x/max below */}
                                    {mo !== null && mo !== undefined && mo !== '' && !cell.is_absent && (
                                      <span style={{ fontSize:10, color:'var(--neutral-6)' }}>
                                        {mo}/{max}
                                      </span>
                                    )}
                                    {cell.is_absent && (
                                      <span style={{ fontSize:10, color:'#ba0517', fontWeight:700 }}>AB</span>
                                    )}
                                  </div>
                                </td>
                              );
                            })}
                            {/* Total / % / Grade */}
                            <td style={{ padding:'8px 12px', textAlign:'center', fontWeight:700 }}>
                              {max > 0 ? `${obt}/${max}` : '—'}
                            </td>
                            <td style={{ padding:'8px 12px', textAlign:'center' }}>
                              {max > 0 ? (
                                <span style={{ fontWeight:800,
                                  color: pct>=60?'#16a34a':pct>=33?'#dd7a01':'#ba0517' }}>
                                  {pct}%
                                </span>
                              ) : '—'}
                            </td>
                            <td style={{ padding:'8px 12px', textAlign:'center' }}>
                              <span className="badge"
                                style={{ background:`${gc(grade)}1A`, color:gc(grade) }}>
                                {grade}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
