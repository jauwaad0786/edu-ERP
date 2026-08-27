import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar  from '../components/Navbar';
import api from '../api/axios';

// ─── Constants ────────────────────────────────────────────────────────────────
const EXAM_TYPES  = ['MID_TERM','FINAL','UNIT_TEST','PRE_BOARD','ANNUAL','HALF_YEARLY','CLASS_TEST','PRACTICALS'];
const SESSIONS    = ['2023-24','2024-25','2025-26','2026-27'];
const GRADING_SCHEMES = [
  { id: 'STANDARD', label: 'Standard (A+, A, B+, B, C, D, F)' },
  { id: 'CBSE', label: 'CBSE 9-Point Scale (A1 to E2)' },
  { id: 'PERCENTAGE', label: 'Percentage Only' },
];

const STATUS_META = {
  DRAFT:             { label: 'Draft',     color: '#f59e0b', bg: '#fffbeb', icon: '✏️' },
  READY_FOR_REVIEW:  { label: 'Review',    color: '#3b82f6', bg: '#eff6ff', icon: '🔍' },
  PUBLISHED:         { label: 'Published', color: '#10b981', bg: '#ecfdf5', icon: '✅' },
  ONGOING:           { label: 'Ongoing',   color: '#8b5cf6', bg: '#f5f3ff', icon: '⏳' },
  COMPLETED:         { label: 'Completed', color: '#059669', bg: '#d1fae5', icon: '🏁' },
  CANCELLED:         { label: 'Cancelled', color: '#ef4444', bg: '#fef2f2', icon: '❌' },
  ARCHIVED:          { label: 'Archived',  color: '#94a3b8', bg: '#f8fafc', icon: '📦' },
};

const TYPE_META = {
  MID_TERM:    { label: 'Mid Term',    color: '#3b82f6', bg: '#eff6ff' },
  FINAL:       { label: 'Final/Annual',color: '#ef4444', bg: '#fef2f2' },
  UNIT_TEST:   { label: 'Unit Test',   color: '#8b5cf6', bg: '#f5f3ff' },
  PRE_BOARD:   { label: 'Pre Board',   color: '#f97316', bg: '#fff7ed' },
  ANNUAL:      { label: 'Annual',      color: '#dc2626', bg: '#fef2f2' },
  HALF_YEARLY: { label: 'Half Yearly', color: '#0284c7', bg: '#f0f9ff' },
  CLASS_TEST:  { label: 'Class Test',  color: '#64748b', bg: '#f8fafc' },
  PRACTICALS:  { label: 'Practicals',  color: '#0d9488', bg: '#f0fdfa' },
};

const TIME_OPTIONS = [
  '08:00 AM','08:30 AM','09:00 AM','09:30 AM','10:00 AM','10:30 AM',
  '11:00 AM','11:30 AM','12:00 PM','12:30 PM','01:00 PM','01:30 PM',
  '02:00 PM','02:30 PM','03:00 PM','03:30 PM','04:00 PM',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = d => d ? new Date(d).toLocaleDateString('en-IN',{ day:'2-digit', month:'short', year:'numeric' }) : '—';
const flash = (setMsg, text, dur = 3500) => { setMsg(text); setTimeout(() => setMsg(''), dur); };

function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META.DRAFT;
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:4,
      background: m.bg, color: m.color,
      border: `1px solid ${m.color}33`,
      borderRadius: 20, padding: '3px 10px',
      fontSize: 11, fontWeight: 700, letterSpacing: 0.3,
    }}>
      {m.icon} {m.label}
    </span>
  );
}

function TypeBadge({ type }) {
  const m = TYPE_META[type] || { label: type, color:'#64748b', bg:'#f1f5f9' };
  return (
    <span style={{
      background: m.bg, color: m.color,
      borderRadius: 4, padding: '2px 8px',
      fontSize: 11, fontWeight: 600,
    }}>
      {m.label}
    </span>
  );
}

// ─── Timetable Builder Component ─────────────────────────────────────────────
function TimetableBuilder({ exam, onUpdate }) {
  const [classes,  setClasses]  = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [items,    setItems]    = useState([]);
  const [selClass, setSelClass] = useState('');
  const [adding,   setAdding]   = useState(false);
  const [form,     setForm]     = useState({
    subject_id:'', exam_date:'', start_time:'10:00 AM',
    end_time:'01:00 PM', venue:'Main Hall', max_marks:100, pass_marks:33, instructions:'',
  });
  const [saving, setSaving] = useState(false);
  const [msg,    setMsg]    = useState('');

  const loadClasses = useCallback(() => {
    api.get('/principal/classes').then(r => {
      const clsData = Array.isArray(r.data) ? r.data : [];
      setClasses(clsData);
      // Auto-select first participating class or first class if none selected
      if (!selClass && clsData.length > 0) {
        setSelClass(String(clsData[0].id));
      }
    }).catch(() => {});
  }, [selClass]);

  const loadTimetable = useCallback(() => {
    if (!exam?.id) return;
    const url = selClass
      ? `/principal/exams/${exam.id}/timetable?class_id=${selClass}`
      : `/principal/exams/${exam.id}/timetable`;
    api.get(url).then(r => setItems(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, [exam?.id, selClass]);

  const loadSubjects = useCallback(() => {
    if (!selClass) { setSubjects([]); return; }
    // Fetch subjects with primary + fallback endpoint
    api.get(`/principal/classes/${selClass}/subjects`)
      .then(r => {
        if (Array.isArray(r.data) && r.data.length > 0) {
          setSubjects(r.data);
        } else {
          api.get(`/principal/subjects?class_id=${selClass}`)
            .then(res => setSubjects(Array.isArray(res.data) ? res.data : []))
            .catch(() => setSubjects([]));
        }
      })
      .catch(() => {
        api.get(`/principal/subjects?class_id=${selClass}`)
          .then(res => setSubjects(Array.isArray(res.data) ? res.data : []))
          .catch(() => setSubjects([]));
      });
  }, [selClass]);

  useEffect(() => { loadClasses(); }, [loadClasses]);
  useEffect(() => { loadTimetable(); }, [loadTimetable]);
  useEffect(() => { loadSubjects(); }, [loadSubjects]);

  const startAdding = () => {
    const defaultDate = exam?.start_date ? String(exam.start_date).split('T')[0] : '';
    setForm({
      subject_id: subjects.length > 0 ? String(subjects[0].id) : '',
      subject_name: '',
      exam_date: defaultDate,
      start_time: '10:00 AM',
      end_time: '01:00 PM',
      venue: 'Main Hall',
      max_marks: subjects.length > 0 ? (subjects[0].max_marks || 100) : 100,
      pass_marks: subjects.length > 0 ? (subjects[0].pass_marks || 33) : 33,
      instructions: '',
    });
    setAdding(true);
  };

  const addItem = async e => {
    e.preventDefault(); setSaving(true);
    try {
      await api.post(`/principal/exams/${exam.id}/timetable`, {
        ...form,
        class_id: selClass,
        subject_name_manual: form.subject_name || '',
      });
      setAdding(false);
      setForm({ subject_id:'', exam_date:'', start_time:'10:00 AM', end_time:'01:00 PM', venue:'Main Hall', max_marks:100, pass_marks:33, instructions:'' });
      loadTimetable();
      onUpdate?.();
      flash(setMsg, '✅ Paper added!');
    } catch(err) {
      flash(setMsg, '❌ ' + (err.response?.data?.error || 'Error'));
    }
    setSaving(false);
  };

  const deleteItem = async id => {
    if (!window.confirm('Remove this paper?')) return;
    await api.delete(`/principal/exams/timetable/${id}`);
    loadTimetable(); onUpdate?.();
  };

  const isPublished = exam?.status === 'PUBLISHED';
  const startDateStr = exam?.start_date ? String(exam.start_date).split('T')[0] : '';
  const endDateStr = exam?.end_date ? String(exam.end_date).split('T')[0] : '';

  return (
    <div style={{ marginTop: 12 }}>
      {/* Class filter tabs */}
      <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          <button
            onClick={() => setSelClass('')}
            style={{
              padding:'5px 12px', borderRadius:20, fontSize:11, fontWeight:600, cursor:'pointer',
              border: selClass === '' ? '2px solid #0176d3' : '1px solid #e2e8f0',
              background: selClass === '' ? '#eff6ff' : 'white',
              color: selClass === '' ? '#0176d3' : '#64748b',
            }}>All Classes</button>
          {classes.map(c => (
            <button key={c.id} onClick={() => setSelClass(String(c.id))}
              style={{
                padding:'5px 12px', borderRadius:20, fontSize:11, fontWeight:600, cursor:'pointer',
                border: selClass === String(c.id) ? '2px solid #0176d3' : '1px solid #e2e8f0',
                background: selClass === String(c.id) ? '#eff6ff' : 'white',
                color: selClass === String(c.id) ? '#0176d3' : '#64748b',
              }}>{c.name} {c.section}</button>
          ))}
        </div>
        {!isPublished && selClass && (
          <button onClick={() => adding ? setAdding(false) : startAdding()}
            style={{
              padding:'6px 14px', borderRadius:6, fontSize:12, fontWeight:700,
              background: adding ? '#f1f5f9' : '#0176d3', color: adding ? '#64748b' : 'white',
              border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:6,
            }}>
            {adding ? '✕ Cancel' : '+ Add Paper'}
          </button>
        )}
      </div>

      {msg && (
        <div style={{
          padding:'8px 14px', borderRadius:6, marginBottom:10, fontSize:12,
          background: msg.startsWith('✅') ? '#ecfdf5' : '#fef2f2',
          color: msg.startsWith('✅') ? '#10b981' : '#ef4444',
          border: `1px solid ${msg.startsWith('✅') ? '#a7f3d0' : '#fecaca'}`,
        }}>{msg}</div>
      )}

      {/* Add paper inline form */}
      {adding && selClass && (
        <div style={{
          background:'#f8faff', border:'1.5px solid #93c5fd', borderRadius:10,
          padding:'16px 18px', marginBottom:14, boxShadow:'0 4px 12px rgba(1,118,211,0.06)',
        }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <div style={{ fontWeight:800, fontSize:13, color:'#0176d3' }}>
              📋 Add Paper for {classes.find(c => String(c.id) === String(selClass))?.name || 'Class'}
            </div>
            {startDateStr && endDateStr && (
              <span style={{ fontSize:11, background:'#e0f2fe', color:'#0369a1', padding:'2px 8px', borderRadius:12, fontWeight:600 }}>
                📅 Exam Period: {fmt(startDateStr)} – {fmt(endDateStr)}
              </span>
            )}
          </div>
          <form onSubmit={addItem}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(170px,1fr))', gap:12 }}>
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:'#334155', display:'block', marginBottom:3 }}>Subject *</label>
                {subjects.length > 0 ? (
                  <select value={form.subject_id} required
                    onChange={e => {
                      const sId = e.target.value;
                      const selSub = subjects.find(s => String(s.id) === String(sId));
                      setForm(f => ({
                        ...f,
                        subject_id: sId,
                        max_marks: selSub?.max_marks || f.max_marks || 100,
                        pass_marks: selSub?.pass_marks || f.pass_marks || 33,
                      }));
                    }}
                    style={{ width:'100%', padding:'7px 9px', borderRadius:6, border:'1.5px solid #cbd5e1', fontSize:12, background:'white' }}>
                    <option value=''>-- Select Subject ({subjects.length} available) --</option>
                    {subjects.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.code ? `[${s.code}]` : ''} {s.teacher_name ? `(${s.teacher_name})` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div>
                    <input required
                      placeholder='Type subject name (e.g. Maths)'
                      value={form.subject_name || ''}
                      onChange={e => setForm(f => ({...f, subject_name: e.target.value, subject_id: ''}))}
                      style={{ width:'100%', padding:'7px 9px', borderRadius:6, border:'1.5px solid #f59e0b', fontSize:12, background:'#fffbeb' }} />
                    <span style={{ fontSize:10, color:'#b45309', marginTop:2, display:'block' }}>
                      ⚠️ No subjects found for this class. Enter manually or add in Subjects Page.
                    </span>
                  </div>
                )}
              </div>
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:'#334155', display:'block', marginBottom:3 }}>
                  Exam Date *
                </label>
                <input required type='date' value={form.exam_date}
                  min={startDateStr || undefined}
                  max={endDateStr || undefined}
                  onChange={e => setForm(f => ({...f, exam_date: e.target.value}))}
                  style={{ width:'100%', padding:'7px 9px', borderRadius:6, border:'1.5px solid #cbd5e1', fontSize:12, background:'white', boxSizing:'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:'#334155', display:'block', marginBottom:3 }}>Start Time</label>
                <select value={form.start_time}
                  onChange={e => setForm(f => ({...f, start_time: e.target.value}))}
                  style={{ width:'100%', padding:'7px 9px', borderRadius:6, border:'1.5px solid #cbd5e1', fontSize:12, background:'white' }}>
                  {TIME_OPTIONS.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:'#334155', display:'block', marginBottom:3 }}>End Time</label>
                <select value={form.end_time}
                  onChange={e => setForm(f => ({...f, end_time: e.target.value}))}
                  style={{ width:'100%', padding:'7px 9px', borderRadius:6, border:'1.5px solid #cbd5e1', fontSize:12, background:'white' }}>
                  {TIME_OPTIONS.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:'#334155', display:'block', marginBottom:3 }}>Venue / Room</label>
                <input value={form.venue} placeholder='e.g. Room 101 / Hall'
                  onChange={e => setForm(f => ({...f, venue: e.target.value}))}
                  style={{ width:'100%', padding:'7px 9px', borderRadius:6, border:'1.5px solid #cbd5e1', fontSize:12, boxSizing:'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:'#334155', display:'block', marginBottom:3 }}>Max Marks</label>
                <input type='number' value={form.max_marks} min={1}
                  onChange={e => setForm(f => ({...f, max_marks: Number(e.target.value)}))}
                  style={{ width:'100%', padding:'7px 9px', borderRadius:6, border:'1.5px solid #cbd5e1', fontSize:12, boxSizing:'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:'#334155', display:'block', marginBottom:3 }}>Pass Marks</label>
                <input type='number' value={form.pass_marks} min={0}
                  onChange={e => setForm(f => ({...f, pass_marks: Number(e.target.value)}))}
                  style={{ width:'100%', padding:'7px 9px', borderRadius:6, border:'1.5px solid #cbd5e1', fontSize:12, boxSizing:'border-box' }} />
              </div>
            </div>
            <div style={{ marginTop:14, display:'flex', justifyContent:'flex-end', gap:8 }}>
              <button type='button' onClick={() => setAdding(false)}
                style={{ padding:'7px 16px', borderRadius:6, fontSize:12, background:'white', border:'1px solid #cbd5e1', cursor:'pointer' }}>
                Cancel
              </button>
              <button type='submit' disabled={saving}
                style={{ padding:'7px 18px', borderRadius:6, fontSize:12, fontWeight:700, background:'#0176d3', color:'white', border:'none', cursor:'pointer' }}>
                {saving ? 'Saving…' : '+ Add Paper'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Timetable table */}
      {items.length > 0 ? (
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead>
              <tr style={{ background:'#f1f5f9' }}>
                {['Subject','Date','Time','Venue/Room','Max','Pass',''].map(h => (
                  <th key={h} style={{ padding:'8px 10px', textAlign:'left', fontWeight:700, color:'#475569', borderBottom:'1px solid #e2e8f0', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={item.id} style={{ background: i%2 ? '#f8fafc' : 'white' }}>
                  <td style={{ padding:'8px 10px', fontWeight:600, color:'#1e293b' }}>{item.subject_name}</td>
                  <td style={{ padding:'8px 10px', color:'#475569' }}>{fmt(item.exam_date)}</td>
                  <td style={{ padding:'8px 10px', color:'#475569', whiteSpace:'nowrap' }}>
                    {item.start_time} – {item.end_time}
                  </td>
                  <td style={{ padding:'8px 10px', color:'#475569' }}>{item.venue || item.room || 'Main Hall'}</td>
                  <td style={{ padding:'8px 10px', fontWeight:600, color:'#0176d3' }}>{item.max_marks}</td>
                  <td style={{ padding:'8px 10px', color:'#64748b' }}>{item.pass_marks}</td>
                  <td style={{ padding:'8px 10px' }}>
                    {!isPublished && (
                      <button onClick={() => deleteItem(item.id)}
                        style={{ background:'none', border:'none', color:'#ef4444', cursor:'pointer', fontSize:13 }}
                        title='Remove'>🗑</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ textAlign:'center', padding:'24px 0', color:'#94a3b8', fontSize:13 }}>
          {selClass ? 'No papers added yet. Click "+ Add Paper" above.' : 'Select a class to view papers.'}
        </div>
      )}
    </div>
  );
}

// ─── Pre-Publish Validation Checklist Component ─────────────────────────────
function ValidationChecklist({ exam, onPublishSuccess }) {
  const [valData, setValData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [msg, setMsg] = useState('');

  const runValidation = useCallback(() => {
    if (!exam?.id) return;
    setLoading(true);
    api.get(`/principal/exams/${exam.id}/validate`)
      .then(r => setValData(r.data))
      .catch(() => setValData(null))
      .finally(() => setLoading(false));
  }, [exam?.id]);

  useEffect(() => { runValidation(); }, [runValidation]);

  const doPublish = async () => {
    if (!window.confirm(`Publish examination '${exam.exam_name}'? Students and teachers will get access.`)) return;
    setPublishing(true);
    try {
      await api.post(`/principal/exams/${exam.id}/publish`);
      flash(setMsg, '✅ Exam published successfully!');
      onPublishSuccess?.();
    } catch(ex) {
      flash(setMsg, '❌ ' + (ex.response?.data?.error || 'Publish failed'));
    }
    setPublishing(false);
  };

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
        <h4 style={{ margin:0, fontSize:13, fontWeight:700, color:'#0f172a' }}>
          🛡 Pre-Publish Validation Engine
        </h4>
        <button onClick={runValidation} disabled={loading}
          style={{ padding:'4px 10px', fontSize:11, borderRadius:5, background:'white', border:'1px solid #cbd5e1', cursor:'pointer' }}>
          {loading ? 'Validating…' : '🔄 Refresh Check'}
        </button>
      </div>

      {msg && (
        <div style={{ padding:'8px 12px', borderRadius:6, marginBottom:12, fontSize:12,
          background: msg.startsWith('✅') ? '#ecfdf5' : '#fef2f2',
          color: msg.startsWith('✅') ? '#10b981' : '#ef4444' }}>{msg}</div>
      )}

      {loading ? (
        <div style={{ padding:20, textAlign:'center', color:'#94a3b8' }}>Checking exam prerequisites…</div>
      ) : valData ? (
        <div>
          {/* Status banner */}
          <div style={{
            padding:'12px 16px', borderRadius:8, marginBottom:14,
            background: valData.ready_to_publish ? '#ecfdf5' : '#fef2f2',
            border: `1px solid ${valData.ready_to_publish ? '#a7f3d0' : '#fecaca'}`,
            display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10,
          }}>
            <div>
              <div style={{ fontWeight:800, fontSize:13, color: valData.ready_to_publish ? '#065f46' : '#991b1b' }}>
                {valData.ready_to_publish ? '✅ READY TO PUBLISH' : '❌ CANNOT PUBLISH YET'}
              </div>
              <div style={{ fontSize:11, color: valData.ready_to_publish ? '#047857' : '#b91c1c', marginTop:2 }}>
                {valData.ready_to_publish
                  ? 'All mandatory requirements satisfied. You can publish this exam now.'
                  : `There are ${valData.blockers.length} blocker(s) that must be resolved before publishing.`}
              </div>
            </div>
            {valData.ready_to_publish && exam.status !== 'PUBLISHED' && (
              <button onClick={doPublish} disabled={publishing}
                style={{ padding:'8px 18px', borderRadius:7, background:'#10b981', color:'white', border:'none', fontWeight:700, fontSize:12, cursor:'pointer' }}>
                {publishing ? 'Publishing…' : '📢 Publish Exam Now'}
              </button>
            )}
          </div>

          {/* Blockers list */}
          {valData.blockers?.length > 0 && (
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'#b91c1c', marginBottom:6 }}>🛑 Critical Blockers:</div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {valData.blockers.map((b, idx) => (
                  <div key={idx} style={{ padding:'8px 12px', borderRadius:6, background:'#fff5f5', border:'1px solid #fed7d7', fontSize:12, color:'#991b1b' }}>
                    • {b}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Warnings list */}
          {valData.warnings?.length > 0 && (
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'#d97706', marginBottom:6 }}>⚠️ Non-blocking Recommendations:</div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {valData.warnings.map((w, idx) => (
                  <div key={idx} style={{ padding:'8px 12px', borderRadius:6, background:'#fffbeb', border:'1px solid #fef3c7', fontSize:12, color:'#b45309' }}>
                    • {w}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

// ─── Admit Card Download Panel ────────────────────────────────────────────────
function AdmitCardPanel({ exam }) {
  const [classes,  setClasses]  = useState([]);
  const [students, setStudents] = useState([]);
  const [selClass, setSelClass] = useState('');
  const [downloading, setDownloading] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api.get('/principal/classes').then(r => setClasses(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    const url = selClass ? `/principal/students?class_id=${selClass}` : '/principal/students';
    api.get(url).then(r => {
      const raw = r.data;
      setStudents(Array.isArray(raw) ? raw : (Array.isArray(raw?.data) ? raw.data : []));
    }).catch(() => {});
  }, [selClass]);

  const downloadOne = async (studentId, studentName) => {
    setDownloading(String(studentId));
    try {
      const res = await api.get(`/principal/admit-card/${studentId}/${exam.id}`, { responseType:'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `AdmitCard_${studentName || studentId}.pdf`;
      a.click();
    } catch {
      flash(setMsg, '❌ Error generating admit card');
    }
    setDownloading('');
  };

  const downloadBulk = async () => {
    setDownloading('bulk');
    try {
      const url = selClass
        ? `/principal/admit-card/class/${selClass}/${exam.id}`
        : `/principal/exams/${exam.id}/admit-cards/bulk`;
      const res = await api.get(url, { responseType:'blob' });
      const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `AdmitCards_${exam.exam_name}${selClass ? `_Class_${selClass}` : '_All'}.pdf`;
      a.click();
    } catch {
      flash(setMsg, '❌ Bulk admit cards generation failed');
    }
    setDownloading('');
  };

  return (
    <div style={{ marginTop:12 }}>
      {msg && (
        <div style={{ padding:'8px 14px', borderRadius:6, marginBottom:10, fontSize:12, background:'#fef2f2', color:'#ef4444', border:'1px solid #fecaca' }}>{msg}</div>
      )}
      {/* Class filter and Bulk download */}
      <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          <button onClick={() => setSelClass('')}
            style={{
              padding:'5px 12px', borderRadius:20, fontSize:11, fontWeight:600, cursor:'pointer',
              border: !selClass ? '2px solid #0176d3' : '1px solid #e2e8f0',
              background: !selClass ? '#eff6ff' : 'white', color: !selClass ? '#0176d3' : '#64748b',
            }}>All Classes</button>
          {classes.map(c => (
            <button key={c.id} onClick={() => setSelClass(String(c.id))}
              style={{
                padding:'5px 12px', borderRadius:20, fontSize:11, fontWeight:600, cursor:'pointer',
                border: selClass === String(c.id) ? '2px solid #0176d3' : '1px solid #e2e8f0',
                background: selClass === String(c.id) ? '#eff6ff' : 'white',
                color: selClass === String(c.id) ? '#0176d3' : '#64748b',
              }}>{c.name} {c.section}</button>
          ))}
        </div>
        <button onClick={downloadBulk} disabled={!students.length || !!downloading}
          style={{
            padding:'6px 14px', borderRadius:6, fontSize:12, fontWeight:700,
            background:'#0176d3', color:'white', border:'none', cursor:'pointer',
          }}>
          {downloading === 'bulk' ? '⏳ Generating Bulk PDF…' : `⬇ Download Bulk Admit Cards (${students.length})`}
        </button>
      </div>

      {/* Student list */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px,1fr))', gap:10 }}>
        {students.map(s => (
          <div key={s.id} style={{
            background:'white', border:'1px solid #e2e8f0', borderRadius:8,
            padding:'10px 12px', display:'flex', alignItems:'center', gap:10,
          }}>
            <div style={{
              width:36, height:36, borderRadius:'50%', flexShrink:0,
              background:'#eff6ff', color:'#0176d3', display:'flex',
              alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:14,
            }}>{s.name?.charAt(0).toUpperCase() || 'S'}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontWeight:600, fontSize:12, color:'#1e293b', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.name}</div>
              <div style={{ fontSize:11, color:'#94a3b8' }}>Roll: {s.roll_number || '—'}</div>
            </div>
            <button onClick={() => downloadOne(s.id, s.name)}
              disabled={downloading === String(s.id)}
              style={{
                background: downloading === String(s.id) ? '#f1f5f9' : '#eff6ff',
                color:'#0176d3', border:'none', borderRadius:5,
                padding:'5px 8px', fontSize:11, cursor:'pointer', fontWeight:700, flexShrink:0,
              }}>
              {downloading === String(s.id) ? '…' : '🎟 PDF'}
            </button>
          </div>
        ))}
        {!students.length && (
          <div style={{ gridColumn:'1/-1', textAlign:'center', padding:24, color:'#94a3b8', fontSize:13 }}>
            No students found.
          </div>
        )}
      </div>
    </div>
  );
}
// ─── Result Card Download Panel ───────────────────────────────────────────────
function ResultCardPanel({ exam }) {
  const [classes,     setClasses]     = useState([]);
  const [students,    setStudents]    = useState([]);
  const [selClass,    setSelClass]    = useState('');
  const [downloading, setDownloading] = useState('');
  const [msg,         setMsg]         = useState('');

  useEffect(() => {
    api.get('/principal/classes').then(r => setClasses(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    const url = selClass ? `/principal/students?class_id=${selClass}` : '/principal/students';
    api.get(url).then(r => setStudents(r.data)).catch(() => {});
  }, [selClass]);

  const downloadOne = async (studentId, studentName) => {
    setDownloading(String(studentId));
    try {
      const res = await api.get(`/principal/result-card/${studentId}/${exam.id}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url; a.download = `ResultCard_${studentName}.pdf`; a.click();
    } catch { flash(setMsg, '❌ Error generating result card'); }
    setDownloading('');
  };

  const downloadAll = async () => {
    for (const s of students) await downloadOne(s.id, s.name);
  };

  return (
    <div style={{ marginTop: 12 }}>
      {msg && (
        <div style={{ padding: '8px 14px', borderRadius: 6, marginBottom: 10, fontSize: 12, background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca' }}>{msg}</div>
      )}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button onClick={() => setSelClass('')}
            style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: !selClass ? '2px solid #0176d3' : '1px solid #e2e8f0', background: !selClass ? '#eff6ff' : 'white', color: !selClass ? '#0176d3' : '#64748b' }}>
            All Classes
          </button>
          {classes.map(c => (
            <button key={c.id} onClick={() => setSelClass(String(c.id))}
              style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: selClass === String(c.id) ? '2px solid #0176d3' : '1px solid #e2e8f0', background: selClass === String(c.id) ? '#eff6ff' : 'white', color: selClass === String(c.id) ? '#0176d3' : '#64748b' }}>
              {c.name} {c.section}
            </button>
          ))}
        </div>
        <button onClick={downloadAll} disabled={!students.length || !!downloading}
          style={{ padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700, background: '#0176d3', color: 'white', border: 'none', cursor: 'pointer' }}>
          {downloading ? '⏳ Downloading…' : `⬇ Download All (${students.length})`}
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px,1fr))', gap: 10 }}>
        {students.map(s => (
          <div key={s.id} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
            {s.photo_url
              ? <img src={s.photo_url} alt={s.name} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
              : <div style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, background: '#eff6ff', color: '#0176d3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>{s.name?.charAt(0).toUpperCase()}</div>
            }
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 12, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>Roll: {s.roll_number || '—'}</div>
            </div>
            <button onClick={() => downloadOne(s.id, s.name)} disabled={downloading === String(s.id)}
              style={{ background: downloading === String(s.id) ? '#f1f5f9' : '#f0fdf4', color: '#16a34a', border: 'none', borderRadius: 5, padding: '5px 8px', fontSize: 11, cursor: 'pointer', fontWeight: 700, flexShrink: 0 }}>
              {downloading === String(s.id) ? '…' : '📊 PDF'}
            </button>
          </div>
        ))}
        {!students.length && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 24, color: '#94a3b8', fontSize: 13 }}>No students found.</div>
        )}
      </div>
    </div>
  );
}

// ─── Exam Detail Panel (Drawer style) ────────────────────────────────────────
function ExamDetailPanel({ exam, onClose, onUpdate }) {
  const [activeTab, setActiveTab] = useState('timetable'); // timetable | validation | admitcards
  const [editing, setEditing] = useState(false);
  const [reopenModal, setReopenModal] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [form, setForm] = useState({
    exam_name: exam.exam_name,
    exam_type: exam.exam_type,
    session:   exam.session,
    start_date: exam.start_date,
    end_date:   exam.end_date,
    grading_system: exam.grading_system || 'STANDARD',
    description: exam.description || '',
    instructions: exam.instructions || '',
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const isPublished = exam.status === 'PUBLISHED';
  const isArchived  = exam.status === 'ARCHIVED';

  const saveEdit = async e => {
    e.preventDefault(); setSaving(true);
    try {
      await api.patch(`/principal/exams/${exam.id}`, form);
      flash(setMsg, '✅ Saved!');
      setEditing(false);
      onUpdate?.();
    } catch(err) {
      flash(setMsg, '❌ ' + (err.response?.data?.error || 'Error'));
    }
    setSaving(false);
  };

  const doReopen = async () => {
    if (!reopenReason.trim()) {
      alert('Please provide a reason for reopening this published exam.');
      return;
    }
    try {
      await api.post(`/principal/exams/${exam.id}/reopen`, { reason: reopenReason });
      flash(setMsg, '✅ Exam reopened to Draft!');
      setReopenModal(false);
      setReopenReason('');
      onUpdate?.();
    } catch(err) {
      flash(setMsg, '❌ ' + (err.response?.data?.error || 'Error'));
    }
  };

  const doDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete exam '${exam.exam_name}'? All scheduled papers and timetable data will be permanently removed.`)) return;
    try {
      await api.delete(`/principal/exams/${exam.id}?force=true`);
      onClose?.();
      onUpdate?.();
    } catch(ex) {
      flash(setMsg, '❌ ' + (ex.response?.data?.error || 'Delete failed'));
    }
  };

  return (
    <div style={{
      position:'fixed', top:0, right:0, bottom:0, width:680, maxWidth:'95vw',
      background:'white', zIndex:1000, boxShadow:'-4px 0 24px rgba(0,0,0,0.15)',
      display:'flex', flexDirection:'column', overflow:'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding:'16px 20px', borderBottom:'1px solid #e2e8f0',
        display:'flex', justifyContent:'space-between', alignItems:'flex-start',
        background:'#f8faff', flexShrink:0,
      }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
            <StatusBadge status={exam.status || (exam.is_published ? 'PUBLISHED' : 'DRAFT')} />
            <TypeBadge type={exam.exam_type} />
          </div>
          <h3 style={{ margin:0, fontSize:16, fontWeight:800, color:'#0f172a' }}>{exam.exam_name}</h3>
          <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>
            {fmt(exam.start_date)} → {fmt(exam.end_date)} &nbsp;|&nbsp; Session: {exam.session}
          </div>
        </div>
        <button onClick={onClose}
          style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#94a3b8', lineHeight:1, padding:4 }}>✕</button>
      </div>

      {msg && (
        <div style={{
          padding:'8px 20px', fontSize:12, flexShrink:0,
          background: msg.startsWith('✅') ? '#ecfdf5' : '#fef2f2',
          color: msg.startsWith('✅') ? '#10b981' : '#ef4444',
          borderBottom:'1px solid #e2e8f0',
        }}>{msg}</div>
      )}

      {/* Action buttons */}
      <div style={{
        padding:'10px 20px', borderBottom:'1px solid #e2e8f0',
        display:'flex', gap:8, flexWrap:'wrap', flexShrink:0,
      }}>
        {!isPublished && !isArchived && (
          <>
            <button onClick={() => setEditing(e => !e)}
              style={{ padding:'6px 14px', borderRadius:6, fontSize:12, fontWeight:600, cursor:'pointer', background: editing ? '#f1f5f9' : '#eff6ff', color:'#0176d3', border:'1px solid #bfdbfe' }}>
              {editing ? '✕ Cancel Edit' : '✏️ Edit Setup'}
            </button>
            <button onClick={() => setActiveTab('validation')}
              style={{ padding:'6px 14px', borderRadius:6, fontSize:12, fontWeight:700, cursor:'pointer', background:'#10b981', color:'white', border:'none' }}>
              🛡 Validate & Publish
            </button>
            <button onClick={doDelete}
              style={{ padding:'6px 14px', borderRadius:6, fontSize:12, fontWeight:600, cursor:'pointer', background:'#fef2f2', color:'#ef4444', border:'1px solid #fecaca' }}>
              🗑 Delete
            </button>
          </>
        )}
        {isPublished && (
          <>
            <button onClick={() => setReopenModal(true)}
              style={{ padding:'6px 14px', borderRadius:6, fontSize:12, fontWeight:600, cursor:'pointer', background:'#fffbeb', color:'#f59e0b', border:'1px solid #fde68a' }}>
              ↩ Reopen / Edit
            </button>
          </>
        )}
      </div>

      {/* Edit form */}
      {editing && (
        <div style={{ padding:'16px 20px', borderBottom:'1px solid #e2e8f0', flexShrink:0 }}>
          <form onSubmit={saveEdit}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div style={{ gridColumn:'1/-1' }}>
                <label style={{ fontSize:11, fontWeight:600, color:'#475569', display:'block', marginBottom:3 }}>Exam Name *</label>
                <input required value={form.exam_name}
                  onChange={e => setForm(f => ({...f, exam_name: e.target.value}))}
                  style={{ width:'100%', padding:'7px 10px', borderRadius:6, border:'1px solid #cbd5e1', fontSize:13, boxSizing:'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize:11, fontWeight:600, color:'#475569', display:'block', marginBottom:3 }}>Type</label>
                <select value={form.exam_type} onChange={e => setForm(f => ({...f, exam_type: e.target.value}))}
                  style={{ width:'100%', padding:'7px 10px', borderRadius:6, border:'1px solid #cbd5e1', fontSize:13 }}>
                  {EXAM_TYPES.map(t => <option key={t} value={t}>{TYPE_META[t]?.label || t}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize:11, fontWeight:600, color:'#475569', display:'block', marginBottom:3 }}>Grading Scheme</label>
                <select value={form.grading_system} onChange={e => setForm(f => ({...f, grading_system: e.target.value}))}
                  style={{ width:'100%', padding:'7px 10px', borderRadius:6, border:'1px solid #cbd5e1', fontSize:13 }}>
                  {GRADING_SCHEMES.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize:11, fontWeight:600, color:'#475569', display:'block', marginBottom:3 }}>Start Date</label>
                <input type='date' value={form.start_date || ''}
                  onChange={e => setForm(f => ({...f, start_date: e.target.value}))}
                  style={{ width:'100%', padding:'7px 10px', borderRadius:6, border:'1px solid #cbd5e1', fontSize:13, boxSizing:'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize:11, fontWeight:600, color:'#475569', display:'block', marginBottom:3 }}>End Date</label>
                <input type='date' value={form.end_date || ''}
                  onChange={e => setForm(f => ({...f, end_date: e.target.value}))}
                  style={{ width:'100%', padding:'7px 10px', borderRadius:6, border:'1px solid #cbd5e1', fontSize:13, boxSizing:'border-box' }} />
              </div>
            </div>
            <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:10 }}>
              <button type='button' onClick={() => setEditing(false)}
                style={{ padding:'7px 16px', borderRadius:6, fontSize:12, background:'white', border:'1px solid #e2e8f0', cursor:'pointer' }}>Cancel</button>
              <button type='submit' disabled={saving}
                style={{ padding:'7px 16px', borderRadius:6, fontSize:12, fontWeight:700, background:'#0176d3', color:'white', border:'none', cursor:'pointer' }}>
                {saving ? 'Saving…' : '💾 Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display:'flex', borderBottom:'1px solid #e2e8f0', flexShrink:0, paddingLeft:20 }}>
        {[
          { key:'timetable',   label:'📋 Timetable & Papers',    show: true },
          { key:'validation',  label:'🛡 Validation & Publish', show: true },
          { key:'admitcards',  label:'🎟 Admit Cards',           show: isPublished },
          { key:'resultcards', label:'📊 Result Cards',          show: isPublished },
        ].filter(t => t.show).map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            style={{
              padding:'10px 16px', background:'none', border:'none', cursor:'pointer',
              fontSize:12, fontWeight:700,
              color: activeTab === t.key ? '#0176d3' : '#64748b',
              borderBottom: activeTab === t.key ? '2px solid #0176d3' : '2px solid transparent',
              marginBottom:-1,
            }}>{t.label}</button>
        ))}
      </div>

      {/* ⚠️ Warning: Published but timetable is empty */}
      {isPublished && exam.timetable_count === 0 && (
        <div style={{
          margin:'10px 20px 0', padding:'10px 14px', borderRadius:8,
          background:'#fffbeb', border:'1px solid #fcd34d',
          fontSize:12, color:'#92400e', flexShrink:0,
        }}>
          ⚠️ <strong>Timetable empty hai!</strong> Admit cards mein koi subject nahi dikhega.
          Pehle &quot;📋 Timetable & Papers&quot; tab mein class-wise subjects add karo.
        </div>
      )}

      {/* Tab content */}
      <div style={{ padding:'12px 20px 20px', flex:1, overflow:'auto' }}>
        {activeTab === 'timetable' && (
          <TimetableBuilder exam={exam} onUpdate={onUpdate} />
        )}
        {activeTab === 'validation' && (
          <ValidationChecklist exam={exam} onPublishSuccess={() => { onUpdate?.(); }} />
        )}
        {activeTab === 'admitcards' && (
          <AdmitCardPanel exam={exam} />
        )}
        {activeTab === 'resultcards' && (
          <ResultCardPanel exam={exam} />
        )}
      </div>

      {/* Reopen Reason Modal */}
      {reopenModal && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(15,23,42,0.5)',
          display:'flex', alignItems:'center', justifyContent:'center', zIndex:1200, padding:16,
        }}>
          <div style={{ background:'white', borderRadius:10, width:440, maxWidth:'100%', padding:20, boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>
            <h4 style={{ margin:'0 0 8px', fontSize:14, fontWeight:800, color:'#0f172a' }}>↩ Reopen Exam to Draft</h4>
            <p style={{ fontSize:12, color:'#64748b', margin:'0 0 12px' }}>
              Reopening will return the exam to Draft status and log an audit record. Please specify the mandatory reason:
            </p>
            <textarea
              required rows={3}
              value={reopenReason}
              onChange={e => setReopenReason(e.target.value)}
              placeholder='Reason for reopening (e.g., Timetable schedule modification for Class 8)...'
              style={{ width:'100%', padding:'8px 10px', borderRadius:6, border:'1px solid #cbd5e1', fontSize:12, boxSizing:'border-box', marginBottom:14 }}
            />
            <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
              <button onClick={() => setReopenModal(false)}
                style={{ padding:'6px 14px', borderRadius:6, background:'white', border:'1px solid #e2e8f0', fontSize:12, cursor:'pointer' }}>
                Cancel
              </button>
              <button onClick={doReopen}
                style={{ padding:'6px 16px', borderRadius:6, background:'#f59e0b', color:'white', border:'none', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                Confirm Reopen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Create Exam Wizard Modal ────────────────────────────────────────────────
function CreateExamModal({ onClose, onCreated }) {
  const [classes, setClasses] = useState([]);
  const [selectedClasses, setSelectedClasses] = useState([]);
  const [form, setForm] = useState({
    exam_name:'', exam_type:'MID_TERM', session:'2025-26',
    start_date:'', end_date:'', grading_system:'STANDARD',
    instructions:'', description:'',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const set = (k, v) => setForm(f => ({...f, [k]: v}));

  useEffect(() => {
    api.get('/principal/classes').then(r => setClasses(r.data)).catch(() => {});
  }, []);

  const toggleClass = (cid) => {
    setSelectedClasses(prev => prev.includes(cid) ? prev.filter(id => id !== cid) : [...prev, cid]);
  };

  const submit = async e => {
    e.preventDefault(); setSaving(true); setErr('');
    try {
      const res = await api.post('/principal/exams', {
        ...form,
        class_ids: selectedClasses,
      });
      onCreated?.(res.data);
      onClose?.();
    } catch(ex) {
      setErr(ex.response?.data?.error || 'Something went wrong');
    }
    setSaving(false);
  };

  return (
    <div style={{
      position:'fixed', inset:0, background:'rgba(15,23,42,0.5)',
      display:'flex', alignItems:'center', justifyContent:'center', zIndex:1100,
    }} onClick={e => e.target === e.currentTarget && onClose?.()}>
      <div style={{
        background:'white', borderRadius:12, width:600, maxWidth:'95vw',
        maxHeight:'90vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.2)',
      }}>
        <div style={{
          padding:'16px 20px', borderBottom:'1px solid #e2e8f0',
          display:'flex', justifyContent:'space-between', alignItems:'center',
        }}>
          <div>
            <h3 style={{ margin:0, fontSize:15, fontWeight:800, color:'#0f172a' }}>📝 Create New Examination</h3>
            <p style={{ margin:'2px 0 0', fontSize:12, color:'#64748b' }}>Configure basic details and select participating classes</p>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:'#94a3b8' }}>✕</button>
        </div>

        <form onSubmit={submit}>
          <div style={{ padding:'16px 20px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
            <div style={{ gridColumn:'1/-1' }}>
              <label style={{ fontSize:11, fontWeight:700, color:'#475569', display:'block', marginBottom:4 }}>Exam Name *</label>
              <input required value={form.exam_name} placeholder='e.g. Annual Examination 2026'
                onChange={e => set('exam_name', e.target.value)}
                style={{ width:'100%', padding:'9px 12px', borderRadius:7, border:'1.5px solid #e2e8f0', fontSize:13, boxSizing:'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize:11, fontWeight:700, color:'#475569', display:'block', marginBottom:4 }}>Exam Type</label>
              <select value={form.exam_type} onChange={e => set('exam_type', e.target.value)}
                style={{ width:'100%', padding:'9px 12px', borderRadius:7, border:'1.5px solid #e2e8f0', fontSize:13 }}>
                {EXAM_TYPES.map(t => <option key={t} value={t}>{TYPE_META[t]?.label || t}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:11, fontWeight:700, color:'#475569', display:'block', marginBottom:4 }}>Session</label>
              <select value={form.session} onChange={e => set('session', e.target.value)}
                style={{ width:'100%', padding:'9px 12px', borderRadius:7, border:'1.5px solid #e2e8f0', fontSize:13 }}>
                {SESSIONS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:11, fontWeight:700, color:'#475569', display:'block', marginBottom:4 }}>Start Date *</label>
              <input required type='date' value={form.start_date}
                onChange={e => set('start_date', e.target.value)}
                style={{ width:'100%', padding:'9px 12px', borderRadius:7, border:'1.5px solid #e2e8f0', fontSize:13, boxSizing:'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize:11, fontWeight:700, color:'#475569', display:'block', marginBottom:4 }}>End Date *</label>
              <input required type='date' value={form.end_date}
                onChange={e => set('end_date', e.target.value)}
                style={{ width:'100%', padding:'9px 12px', borderRadius:7, border:'1.5px solid #e2e8f0', fontSize:13, boxSizing:'border-box' }} />
            </div>

            {/* Participating Classes Selection */}
            <div style={{ gridColumn:'1/-1' }}>
              <label style={{ fontSize:11, fontWeight:700, color:'#475569', display:'block', marginBottom:6 }}>
                Participating Classes & Sections:
              </label>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6, maxHeight:120, overflowY:'auto', padding:8, background:'#f8fafc', borderRadius:8, border:'1px solid #e2e8f0' }}>
                {classes.map(c => {
                  const active = selectedClasses.includes(c.id);
                  return (
                    <button type='button' key={c.id} onClick={() => toggleClass(c.id)}
                      style={{
                        padding:'5px 12px', borderRadius:20, fontSize:11, fontWeight:600, cursor:'pointer',
                        border: active ? '1.5px solid #0176d3' : '1px solid #cbd5e1',
                        background: active ? '#eff6ff' : 'white',
                        color: active ? '#0176d3' : '#475569',
                      }}>
                      {active ? '✓ ' : '+ '}{c.name} {c.section}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ gridColumn:'1/-1' }}>
              <label style={{ fontSize:11, fontWeight:700, color:'#475569', display:'block', marginBottom:4 }}>General Instructions</label>
              <textarea rows={2} value={form.instructions}
                onChange={e => set('instructions', e.target.value)}
                placeholder='e.g. Students must carry admit card, No electronic devices...'
                style={{ width:'100%', padding:'9px 12px', borderRadius:7, border:'1.5px solid #e2e8f0', fontSize:13, resize:'vertical', boxSizing:'border-box' }} />
            </div>
          </div>

          {err && (
            <div style={{ margin:'0 20px 12px', padding:'8px 12px', background:'#fef2f2', color:'#ef4444', borderRadius:6, fontSize:12 }}>{err}</div>
          )}

          <div style={{ padding:'12px 20px 16px', borderTop:'1px solid #f1f5f9', display:'flex', justifyContent:'flex-end', gap:8 }}>
            <button type='button' onClick={onClose}
              style={{ padding:'8px 18px', borderRadius:7, fontSize:13, background:'white', border:'1px solid #e2e8f0', cursor:'pointer' }}>
              Cancel
            </button>
            <button type='submit' disabled={saving}
              style={{ padding:'8px 22px', borderRadius:7, fontSize:13, fontWeight:700, background:'#0176d3', color:'white', border:'none', cursor:'pointer' }}>
              {saving ? 'Creating…' : 'Create Exam'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Exams Page ─────────────────────────────────────────────────────────
export default function ExamsPage() {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('ALL'); // ALL | DRAFT | PUBLISHED | ARCHIVED
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api.get('/principal/exams')
      .then(r => setExams(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = exams.filter(e => {
    const st = e.status || (e.is_published ? 'PUBLISHED' : 'DRAFT');
    if (tab !== 'ALL' && st !== tab) return false;
    if (search && !e.exam_name?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const countFor = s => exams.filter(e => (e.status || (e.is_published ? 'PUBLISHED' : 'DRAFT')) === s).length;
  const tabs = [
    { key:'ALL', label:'All Exams', count: exams.length },
    { key:'DRAFT', label:'Drafts', count: countFor('DRAFT') },
    { key:'PUBLISHED', label:'Published', count: countFor('PUBLISHED') },
    { key:'ARCHIVED', label:'Archived', count: countFor('ARCHIVED') },
  ];

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar title="Examination Management" />
        <div className="page-body">
          {/* Header */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
            <div>
              <h1 style={{ margin:0, fontSize:22, fontWeight:800, color:'#0f172a' }}>📋 Examination Management</h1>
              <p style={{ margin:'4px 0 0', fontSize:13, color:'#64748b' }}>
                Setup exam schedules, configure class participation, manage papers, validate readiness, and generate admit cards.
              </p>
            </div>
            <button onClick={() => setShowCreate(true)}
              style={{
                padding:'9px 20px', borderRadius:8, background:'#0176d3', color:'white',
                border:'none', fontSize:13, fontWeight:700, cursor:'pointer',
                display:'flex', alignItems:'center', gap:6, boxShadow:'0 2px 6px rgba(1,118,211,0.3)',
              }}>
              + Create Exam
            </button>
          </div>

          {msg && (
            <div style={{
              padding:'10px 16px', borderRadius:8, marginBottom:16, fontSize:13,
              background: msg.startsWith('✅') ? '#ecfdf5' : '#fef2f2',
              color: msg.startsWith('✅') ? '#10b981' : '#ef4444',
              border: `1px solid ${msg.startsWith('✅') ? '#a7f3d0' : '#fecaca'}`,
            }}>{msg}</div>
          )}

          {/* Filter Bar */}
          <div style={{
            display:'flex', justifyContent:'space-between', alignItems:'center',
            borderBottom:'1px solid #e2e8f0', marginBottom:16, gap:12,
          }}>
            <div style={{ display:'flex', gap:0 }}>
              {tabs.map(t => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  style={{
                    padding:'9px 16px', background:'none', border:'none', cursor:'pointer',
                    fontSize:12, fontWeight:700,
                    color: tab === t.key ? '#0176d3' : '#64748b',
                    borderBottom: tab === t.key ? '2px solid #0176d3' : '2px solid transparent',
                    marginBottom:-1, display:'flex', alignItems:'center', gap:6,
                  }}>
                  {t.label}
                  <span style={{
                    background: tab === t.key ? '#0176d3' : '#f1f5f9',
                    color: tab === t.key ? 'white' : '#64748b',
                    borderRadius:20, padding:'1px 6px', fontSize:10, fontWeight:700,
                  }}>{t.count}</span>
                </button>
              ))}
            </div>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder='🔍 Search exams...'
              style={{
                padding:'7px 12px', borderRadius:7, border:'1px solid #e2e8f0',
                fontSize:12, width:200, outline:'none',
              }} />
          </div>

          {/* Exam Cards Grid */}
          {loading ? (
            <div style={{ textAlign:'center', padding:40, color:'#94a3b8' }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={{
              textAlign:'center', padding:'48px 20px',
              background:'#f8fafc', borderRadius:12, border:'1px dashed #e2e8f0',
            }}>
              <div style={{ fontSize:40, marginBottom:12 }}>📋</div>
              <div style={{ fontWeight:700, color:'#475569', marginBottom:6 }}>No exams found</div>
              <div style={{ fontSize:13, color:'#94a3b8', marginBottom:16 }}>
                {tab === 'ALL' ? 'Create your first exam to get started.' : `No ${tab.toLowerCase()} exams.`}
              </div>
              <button onClick={() => setShowCreate(true)}
                style={{ padding:'8px 20px', borderRadius:7, background:'#0176d3', color:'white', border:'none', cursor:'pointer', fontSize:13, fontWeight:700 }}>
                + Create Exam
              </button>
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px,1fr))', gap:14 }}>
              {filtered.map(exam => {
                const status = exam.status || (exam.is_published ? 'PUBLISHED' : 'DRAFT');
                const sm = STATUS_META[status] || STATUS_META.DRAFT;
                const tm = TYPE_META[exam.exam_type] || { label: exam.exam_type, color:'#64748b', bg:'#f1f5f9' };
                return (
                  <div key={exam.id}
                    onClick={() => setSelected(exam)}
                    style={{
                      background:'white', borderRadius:10, padding:'14px 16px',
                      border: selected?.id === exam.id ? '2px solid #0176d3' : '1px solid #e2e8f0',
                      cursor:'pointer', transition:'all 0.15s',
                      boxShadow: selected?.id === exam.id ? '0 0 0 3px #bfdbfe' : '0 1px 3px rgba(0,0,0,0.06)',
                    }}
                    onMouseEnter={e => { if (selected?.id !== exam.id) e.currentTarget.style.borderColor = '#93c5fd'; }}
                    onMouseLeave={e => { if (selected?.id !== exam.id) e.currentTarget.style.borderColor = '#e2e8f0'; }}
                  >
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                      <span style={{ background: sm.bg, color: sm.color, borderRadius:20, padding:'3px 9px', fontSize:10, fontWeight:700, border:`1px solid ${sm.color}33` }}>
                        {sm.icon} {sm.label}
                      </span>
                      <span style={{ background: tm.bg, color: tm.color, borderRadius:4, padding:'2px 7px', fontSize:10, fontWeight:700 }}>
                        {tm.label}
                      </span>
                    </div>

                    <h4 style={{ margin:'0 0 6px', fontSize:14, fontWeight:800, color:'#0f172a', lineHeight:1.3 }}>
                      {exam.exam_name}
                    </h4>

                    <div style={{ fontSize:11, color:'#64748b', marginBottom:10, display:'flex', flexDirection:'column', gap:3 }}>
                      <span>📅 {fmt(exam.start_date)} → {fmt(exam.end_date)}</span>
                      <span>🎓 Session: {exam.session}</span>
                    </div>

                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', paddingTop:10, borderTop:'1px solid #f1f5f9' }}>
                      <div style={{ display:'flex', gap:6 }}>
                        {(exam.classes || []).slice(0,3).map((c, i) => (
                          <span key={i} style={{ background:'#f1f5f9', color:'#475569', borderRadius:4, padding:'2px 6px', fontSize:10, fontWeight:600 }}>
                            {c.name || c.class_name} {c.section}
                          </span>
                        ))}
                        {(exam.classes || []).length > 3 && (
                          <span style={{ fontSize:10, color:'#94a3b8' }}>+{exam.classes.length - 3}</span>
                        )}
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ fontSize:11, color:'#0176d3', fontWeight:700 }}>
                          Configure →
                        </span>
                        <button
                          type="button"
                          title="Delete Exam"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`Delete exam '${exam.exam_name}'?`)) {
                              api.delete(`/principal/exams/${exam.id}?force=true`)
                                .then(() => {
                                  flash(setMsg, `✅ Exam '${exam.exam_name}' deleted.`);
                                  load();
                                })
                                .catch(err => {
                                  flash(setMsg, '❌ ' + (err.response?.data?.error || 'Delete failed'));
                                });
                            }
                          }}
                          style={{
                            background:'none', border:'none', color:'#ef4444',
                            cursor:'pointer', fontSize:13, padding:'2px 4px',
                            borderRadius:4, display:'inline-flex', alignItems:'center'
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = '#fee2e2'}
                          onMouseLeave={e => e.currentTarget.style.background = 'none'}
                        >
                          🗑
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Overlay */}
          {selected && (
            <div
              style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.3)', zIndex:999 }}
              onClick={() => setSelected(null)}
            />
          )}

      {/* Detail Drawer */}
      {selected && (
        <ExamDetailPanel
          exam={selected}
          onClose={() => setSelected(null)}
          onUpdate={() => {
            load();
            setTimeout(() => {
              setExams(prev => {
                const updated = prev.find(e => e.id === selected?.id);
                if (updated) setSelected(updated);
                return prev;
              });
            }, 300);
          }}
        />
      )}

      {/* Create Modal */}
      {showCreate && (
        <CreateExamModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { load(); flash(setMsg, '✅ Exam created as Draft!'); }}
        />
      )}
        </div>
      </div>
    </div>
  );
}
