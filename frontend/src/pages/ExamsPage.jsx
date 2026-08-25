import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Navbar  from '../components/Navbar';
import api from '../api/axios';

// ─── Constants ────────────────────────────────────────────────────────────────
const EXAM_TYPES  = ['MID_TERM','FINAL','UNIT_TEST','PRE_BOARD'];
const SESSIONS    = ['2023-24','2024-25','2025-26','2026-27'];
const STATUS_META = {
  DRAFT:     { label: 'Draft',     color: '#f59e0b', bg: '#fffbeb', icon: '✏️' },
  PUBLISHED: { label: 'Published', color: '#10b981', bg: '#ecfdf5', icon: '✅' },
  ARCHIVED:  { label: 'Archived',  color: '#94a3b8', bg: '#f8fafc', icon: '📦' },
};
const TYPE_META = {
  MID_TERM:  { label: 'Mid Term',    color: '#3b82f6', bg: '#eff6ff' },
  FINAL:     { label: 'Final/Annual',color: '#ef4444', bg: '#fef2f2' },
  UNIT_TEST: { label: 'Unit Test',   color: '#8b5cf6', bg: '#f5f3ff' },
  PRE_BOARD: { label: 'Pre Board',   color: '#f97316', bg: '#fff7ed' },
};
const TIME_OPTIONS = [
  '08:00 AM','08:30 AM','09:00 AM','09:30 AM','10:00 AM','10:30 AM',
  '11:00 AM','11:30 AM','12:00 PM','12:30 PM','01:00 PM','01:30 PM',
  '02:00 PM','02:30 PM','03:00 PM','03:30 PM','04:00 PM',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = d => d ? new Date(d).toLocaleDateString('en-IN',{ day:'2-digit', month:'short', year:'numeric' }) : '—';
const flash = (setMsg, text, dur = 3500) => { setMsg(text); setTimeout(() => setMsg(''), dur); };

// ─── Sub-components ───────────────────────────────────────────────────────────

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

// ─── Timetable Builder (inside exam detail panel) ─────────────────────────────
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
    api.get('/principal/classes').then(r => setClasses(r.data)).catch(() => {});
  }, []);

  const loadTimetable = useCallback(() => {
    if (!exam?.id) return;
    const url = selClass
      ? `/principal/exams/${exam.id}/timetable?class_id=${selClass}`
      : `/principal/exams/${exam.id}/timetable`;
    api.get(url).then(r => setItems(r.data)).catch(() => {});
  }, [exam?.id, selClass]);

  const loadSubjects = useCallback(() => {
    if (!selClass) { setSubjects([]); return; }
    api.get(`/principal/classes/${selClass}/subjects`).then(r => setSubjects(r.data)).catch(() => {});
  }, [selClass]);

  useEffect(() => { loadClasses(); }, [loadClasses]);
  useEffect(() => { loadTimetable(); }, [loadTimetable]);
  useEffect(() => { loadSubjects(); }, [loadSubjects]);

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
          <button onClick={() => setAdding(a => !a)}
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
          background:'#f8faff', border:'1px solid #bfdbfe', borderRadius:8,
          padding:'14px 16px', marginBottom:12,
        }}>
          <div style={{ fontWeight:700, fontSize:12, color:'#0176d3', marginBottom:10 }}>📋 Add New Paper</div>
          <form onSubmit={addItem}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px,1fr))', gap:10 }}>
              <div>
                <label style={{ fontSize:11, fontWeight:600, color:'#475569', display:'block', marginBottom:3 }}>Subject *</label>
                {subjects.length > 0 ? (
                  <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                    <select value={form.subject_id}
                      onChange={e => setForm(f => ({...f, subject_id: e.target.value, subject_name: ''}))}
                      style={{ width:'100%', padding:'6px 8px', borderRadius:5, border:'1px solid #cbd5e1', fontSize:12 }}>
                      <option value=''>-- Select from list --</option>
                      {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <div style={{ fontSize:10, color:'#94a3b8', textAlign:'center' }}>— ya —</div>
                    <input
                      placeholder='Type subject name manually'
                      value={form.subject_name || ''}
                      onChange={e => setForm(f => ({...f, subject_name: e.target.value, subject_id: ''}))}
                      style={{ width:'100%', padding:'6px 8px', borderRadius:5, border:'1px solid #cbd5e1', fontSize:12 }} />
                  </div>
                ) : (
                  <input required
                    placeholder='e.g. Mathematics, Science...'
                    value={form.subject_name || ''}
                    onChange={e => setForm(f => ({...f, subject_name: e.target.value, subject_id: ''}))}
                    style={{ width:'100%', padding:'6px 8px', borderRadius:5, border:'1px solid #cbd5e1', fontSize:12 }} />
                )}
              </div>
              <div>
                <label style={{ fontSize:11, fontWeight:600, color:'#475569', display:'block', marginBottom:3 }}>Date *</label>
                <input required type='date' value={form.exam_date}
                  onChange={e => setForm(f => ({...f, exam_date: e.target.value}))}
                  style={{ width:'100%', padding:'6px 8px', borderRadius:5, border:'1px solid #cbd5e1', fontSize:12 }} />
              </div>
              <div>
                <label style={{ fontSize:11, fontWeight:600, color:'#475569', display:'block', marginBottom:3 }}>Start Time</label>
                <select value={form.start_time}
                  onChange={e => setForm(f => ({...f, start_time: e.target.value}))}
                  style={{ width:'100%', padding:'6px 8px', borderRadius:5, border:'1px solid #cbd5e1', fontSize:12 }}>
                  {TIME_OPTIONS.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize:11, fontWeight:600, color:'#475569', display:'block', marginBottom:3 }}>End Time</label>
                <select value={form.end_time}
                  onChange={e => setForm(f => ({...f, end_time: e.target.value}))}
                  style={{ width:'100%', padding:'6px 8px', borderRadius:5, border:'1px solid #cbd5e1', fontSize:12 }}>
                  {TIME_OPTIONS.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize:11, fontWeight:600, color:'#475569', display:'block', marginBottom:3 }}>Venue</label>
                <input value={form.venue}
                  onChange={e => setForm(f => ({...f, venue: e.target.value}))}
                  style={{ width:'100%', padding:'6px 8px', borderRadius:5, border:'1px solid #cbd5e1', fontSize:12 }} />
              </div>
              <div>
                <label style={{ fontSize:11, fontWeight:600, color:'#475569', display:'block', marginBottom:3 }}>Max Marks</label>
                <input type='number' value={form.max_marks}
                  onChange={e => setForm(f => ({...f, max_marks: Number(e.target.value)}))}
                  style={{ width:'100%', padding:'6px 8px', borderRadius:5, border:'1px solid #cbd5e1', fontSize:12 }} />
              </div>
              <div>
                <label style={{ fontSize:11, fontWeight:600, color:'#475569', display:'block', marginBottom:3 }}>Pass Marks</label>
                <input type='number' value={form.pass_marks}
                  onChange={e => setForm(f => ({...f, pass_marks: Number(e.target.value)}))}
                  style={{ width:'100%', padding:'6px 8px', borderRadius:5, border:'1px solid #cbd5e1', fontSize:12 }} />
              </div>
            </div>
            <div style={{ marginTop:10 }}>
              <label style={{ fontSize:11, fontWeight:600, color:'#475569', display:'block', marginBottom:3 }}>Instructions (optional)</label>
              <textarea value={form.instructions} rows={2}
                onChange={e => setForm(f => ({...f, instructions: e.target.value}))}
                placeholder='Bring calculator, No mobile phones...'
                style={{ width:'100%', padding:'6px 8px', borderRadius:5, border:'1px solid #cbd5e1', fontSize:12, resize:'vertical' }} />
            </div>
            <div style={{ marginTop:10, display:'flex', justifyContent:'flex-end', gap:8 }}>
              <button type='button' onClick={() => setAdding(false)}
                style={{ padding:'6px 14px', borderRadius:5, fontSize:12, background:'white', border:'1px solid #e2e8f0', cursor:'pointer' }}>
                Cancel
              </button>
              <button type='submit' disabled={saving}
                style={{ padding:'6px 16px', borderRadius:5, fontSize:12, fontWeight:700, background:'#0176d3', color:'white', border:'none', cursor:'pointer' }}>
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
                {['Subject','Date','Time','Venue','Max','Pass',''].map(h => (
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
                  <td style={{ padding:'8px 10px', color:'#475569' }}>{item.venue}</td>
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
    api.get(url).then(r => { const raw = r.data; setStudents(Array.isArray(raw) ? raw : (Array.isArray(raw?.data) ? raw.data : [])); }).catch(() => {});
  }, [selClass]);

  const downloadOne = async (studentId, studentName) => {
    const key = `${studentId}`;
    setDownloading(key);
    try {
      const res = await api.get(`/principal/admit-card/${studentId}/${exam.id}`, { responseType:'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url; a.download = `AdmitCard_${studentName}.pdf`; a.click();
    } catch { flash(setMsg, '❌ Error generating admit card'); }
    setDownloading('');
  };

  const downloadAll = async () => {
    for (const s of students) {
      await downloadOne(s.id, s.name);
    }
  };

  return (
    <div style={{ marginTop:12 }}>
      {msg && (
        <div style={{ padding:'8px 14px', borderRadius:6, marginBottom:10, fontSize:12, background:'#fef2f2', color:'#ef4444', border:'1px solid #fecaca' }}>{msg}</div>
      )}
      {/* Class filter */}
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
        <button onClick={downloadAll} disabled={!students.length || !!downloading}
          style={{
            padding:'6px 14px', borderRadius:6, fontSize:12, fontWeight:700,
            background:'#0176d3', color:'white', border:'none', cursor:'pointer',
          }}>
          {downloading ? '⏳ Downloading…' : `⬇ Download All (${students.length})`}
        </button>
      </div>

      {/* Student list */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px,1fr))', gap:10 }}>
        {students.map(s => (
          <div key={s.id} style={{
            background:'white', border:'1px solid #e2e8f0', borderRadius:8,
            padding:'10px 12px', display:'flex', alignItems:'center', gap:10,
          }}>
            {s.photo_url
              ? <img src={s.photo_url} alt={s.name}
                  style={{ width:36, height:36, borderRadius:'50%', objectFit:'cover', flexShrink:0 }} />
              : <div style={{
                  width:36, height:36, borderRadius:'50%', flexShrink:0,
                  background:'#eff6ff', color:'#0176d3', display:'flex',
                  alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:14,
                }}>{s.name?.charAt(0).toUpperCase()}</div>
            }
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

// ─── Exam Detail Panel (right drawer style, inline) ──────────────────────────
function ExamDetailPanel({ exam, onClose, onUpdate }) {
  const [activeTab, setActiveTab] = useState('timetable'); // timetable | admitcards
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    exam_name: exam.exam_name,
    exam_type: exam.exam_type,
    session:   exam.session,
    start_date: exam.start_date,
    end_date:   exam.end_date,
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

  const doPublish = async () => {
    if (!window.confirm('Publish this exam? Students will see admit cards.')) return;
    try {
      await api.post(`/principal/exams/${exam.id}/publish`);
      flash(setMsg, '✅ Exam published!');
      onUpdate?.();
    } catch(err) {
      flash(setMsg, '❌ ' + (err.response?.data?.error || 'Error'));
    }
  };

  const doUnpublish = async () => {
    if (!window.confirm('Unpublish? Students will lose access to admit cards.')) return;
    try {
      await api.post(`/principal/exams/${exam.id}/unpublish`);
      flash(setMsg, '✅ Unpublished');
      onUpdate?.();
    } catch(err) {
      flash(setMsg, '❌ ' + (err.response?.data?.error || 'Error'));
    }
  };

  const doArchive = async () => {
    if (!window.confirm('Archive this exam?')) return;
    try {
      await api.post(`/principal/exams/${exam.id}/archive`);
      flash(setMsg, '✅ Archived');
      onUpdate?.();
    } catch(err) {
      flash(setMsg, '❌ ' + (err.response?.data?.error || 'Error'));
    }
  };

  const doDelete = async () => {
    if (!window.confirm('Delete this exam? This cannot be undone.')) return;
    try {
      await api.delete(`/principal/exams/${exam.id}`);
      onClose?.();
      onUpdate?.();
    } catch(err) {
      flash(setMsg, '❌ ' + (err.response?.data?.error || 'Error'));
    }
  };

  return (
    <div style={{
      position:'fixed', top:0, right:0, bottom:0, width:720,
      background:'white', boxShadow:'-4px 0 24px rgba(0,0,0,0.12)',
      zIndex:1000, display:'flex', flexDirection:'column', overflowY:'auto',
    }}>
      {/* Header */}
      <div style={{
        padding:'16px 20px', borderBottom:'1px solid #e2e8f0',
        display:'flex', alignItems:'flex-start', justifyContent:'space-between',
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
              {editing ? '✕ Cancel Edit' : '✏️ Edit'}
            </button>
            <button onClick={doPublish}
              style={{ padding:'6px 14px', borderRadius:6, fontSize:12, fontWeight:700, cursor:'pointer', background:'#10b981', color:'white', border:'none' }}>
              📢 Publish
            </button>
            <button onClick={doDelete}
              style={{ padding:'6px 14px', borderRadius:6, fontSize:12, fontWeight:600, cursor:'pointer', background:'#fef2f2', color:'#ef4444', border:'1px solid #fecaca' }}>
              🗑 Delete
            </button>
          </>
        )}
        {isPublished && (
          <>
            <button onClick={doUnpublish}
              style={{ padding:'6px 14px', borderRadius:6, fontSize:12, fontWeight:600, cursor:'pointer', background:'#fffbeb', color:'#f59e0b', border:'1px solid #fde68a' }}>
              ↩ Unpublish
            </button>
            <button onClick={doArchive}
              style={{ padding:'6px 14px', borderRadius:6, fontSize:12, fontWeight:600, cursor:'pointer', background:'#f8fafc', color:'#64748b', border:'1px solid #e2e8f0' }}>
              📦 Archive
            </button>
          </>
        )}
        {isArchived && (
          <span style={{ fontSize:12, color:'#94a3b8', padding:'6px 0' }}>Archived — read only</span>
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
                <label style={{ fontSize:11, fontWeight:600, color:'#475569', display:'block', marginBottom:3 }}>Session</label>
                <select value={form.session} onChange={e => setForm(f => ({...f, session: e.target.value}))}
                  style={{ width:'100%', padding:'7px 10px', borderRadius:6, border:'1px solid #cbd5e1', fontSize:13 }}>
                  {SESSIONS.map(s => <option key={s}>{s}</option>)}
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
              <div style={{ gridColumn:'1/-1' }}>
                <label style={{ fontSize:11, fontWeight:600, color:'#475569', display:'block', marginBottom:3 }}>Instructions</label>
                <textarea rows={3} value={form.instructions}
                  onChange={e => setForm(f => ({...f, instructions: e.target.value}))}
                  placeholder='General exam instructions...'
                  style={{ width:'100%', padding:'7px 10px', borderRadius:6, border:'1px solid #cbd5e1', fontSize:13, resize:'vertical', boxSizing:'border-box' }} />
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
          { key:'timetable',  label:'📋 Subject Papers', show: true },
          { key:'admitcards', label:'🎟 Admit Cards',    show: isPublished },
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
        {exam.timetable_count > 0 && (
          <span style={{
            alignSelf:'center', marginLeft:4,
            background:'#eff6ff', color:'#0176d3',
            borderRadius:20, padding:'2px 8px', fontSize:10, fontWeight:700,
          }}>{exam.timetable_count}</span>
        )}
      </div>

      {/* Tab content */}
      <div style={{ padding:'12px 20px 20px', flex:1, overflow:'auto' }}>
        {activeTab === 'timetable' && (
          <TimetableBuilder exam={exam} onUpdate={onUpdate} />
        )}
        {activeTab === 'admitcards' && (
          <AdmitCardPanel exam={exam} />
        )}
      </div>
    </div>
  );
}

// ─── Create Exam Modal ────────────────────────────────────────────────────────
function CreateExamModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    exam_name:'', exam_type:'MID_TERM', session:'2025-26',
    start_date:'', end_date:'', instructions:'',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const set = (k, v) => setForm(f => ({...f, [k]: v}));

  const submit = async e => {
    e.preventDefault(); setSaving(true); setErr('');
    try {
      const res = await api.post('/principal/exams', form);
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
        background:'white', borderRadius:12, width:560, maxWidth:'95vw',
        maxHeight:'90vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.2)',
      }}>
        <div style={{
          padding:'16px 20px', borderBottom:'1px solid #e2e8f0',
          display:'flex', justifyContent:'space-between', alignItems:'center',
        }}>
          <div>
            <h3 style={{ margin:0, fontSize:15, fontWeight:800, color:'#0f172a' }}>📝 Create New Exam</h3>
            <p style={{ margin:'2px 0 0', fontSize:12, color:'#64748b' }}>Fill details — papers can be added after creation</p>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:'#94a3b8' }}>✕</button>
        </div>

        <form onSubmit={submit}>
          <div style={{ padding:'16px 20px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
            <div style={{ gridColumn:'1/-1' }}>
              <label style={{ fontSize:11, fontWeight:700, color:'#475569', display:'block', marginBottom:4 }}>Exam Name *</label>
              <input required value={form.exam_name} placeholder='e.g. Half Yearly Examination 2025'
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
            <div style={{ gridColumn:'1/-1' }}>
              <label style={{ fontSize:11, fontWeight:700, color:'#475569', display:'block', marginBottom:4 }}>General Instructions</label>
              <textarea rows={3} value={form.instructions}
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
              style={{ padding:'8px 20px', borderRadius:7, fontSize:13, fontWeight:700, background:'#0176d3', color:'white', border:'none', cursor:'pointer' }}>
              {saving ? 'Creating…' : '📝 Create Exam (Draft)'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main ExamsPage ───────────────────────────────────────────────────────────
export default function ExamsPage() {
  const navigate = useNavigate();
  const [exams,      setExams]      = useState([]);
  const [tab,        setTab]        = useState('ALL'); // ALL | DRAFT | PUBLISHED | ARCHIVED
  const [search,     setSearch]     = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [selected,   setSelected]   = useState(null); // exam object for detail panel
  const [msg,        setMsg]        = useState('');
  const [loading,    setLoading]    = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await api.get('/principal/exams');
      setExams(r.data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Re-fetch selected exam data after updates
  const reload = useCallback(() => {
    load().then(() => {
      if (selected) {
        // refresh selected from latest data
        setExams(prev => {
          const updated = prev.find(e => e.id === selected.id);
          if (updated) setSelected(updated);
          return prev;
        });
      }
    });
  }, [load, selected]);

  const handleUpdate = useCallback(() => {
    load();
    setSelected(prev => {
      if (!prev) return null;
      // will be updated via load
      return prev;
    });
    // Re-sync selected
    setTimeout(() => {
      setExams(prev => {
        const updated = prev.find(e => e.id === selected?.id);
        if (updated) setSelected(updated);
        return prev;
      });
    }, 400);
  }, [load, selected]);

  const tabs = [
    { key:'ALL',       label:'All',       count: exams.length },
    { key:'DRAFT',     label:'Draft',     count: exams.filter(e => (e.status||'DRAFT') === 'DRAFT').length },
    { key:'PUBLISHED', label:'Published', count: exams.filter(e => e.status === 'PUBLISHED').length },
    { key:'ARCHIVED',  label:'Archived',  count: exams.filter(e => e.status === 'ARCHIVED').length },
  ];

  const filtered = exams.filter(e => {
    const status = e.status || (e.is_published ? 'PUBLISHED' : 'DRAFT');
    const matchTab = tab === 'ALL' || status === tab;
    const matchSearch = !search || e.exam_name.toLowerCase().includes(search.toLowerCase());
    return matchTab && matchSearch;
  });

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar title="Exam Management" />
        <div className="page-body" style={{ position:'relative' }}>

          {/* Page header */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, flexWrap:'wrap', gap:12 }}>
            <div>
              <h2 style={{ margin:0, fontSize:20, fontWeight:800, color:'#0f172a' }}>Examination Management & Controller</h2>
              <p style={{ margin:'3px 0 0', fontSize:13, color:'#64748b' }}>
                Create, schedule, and publish examinations — datesheets, admit cards, and result analytics
              </p>
            </div>
            <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
              <button onClick={() => navigate('/result-management')}
                style={{
                  padding:'9px 16px', borderRadius:8, fontSize:13, fontWeight:700,
                  background:'#eff6ff', color:'#0176d3', border:'1px solid #bfdbfe', cursor:'pointer',
                  display:'flex', alignItems:'center', gap:6,
                }}>
                📊 Result & Analytics Hub
              </button>
              <button onClick={() => navigate('/marks')}
                style={{
                  padding:'9px 16px', borderRadius:8, fontSize:13, fontWeight:700,
                  background:'#fdf4ff', color:'#9333ea', border:'1px solid #f5d0fe', cursor:'pointer',
                  display:'flex', alignItems:'center', gap:6,
                }}>
                📝 Mark Entry Roster
              </button>
              <button onClick={() => setShowCreate(true)}
                style={{
                  padding:'9px 18px', borderRadius:8, fontSize:13, fontWeight:700,
                  background:'#0176d3', color:'white', border:'none', cursor:'pointer',
                  display:'flex', alignItems:'center', gap:7, boxShadow:'0 2px 8px rgba(1,118,211,0.3)',
                }}>
                + Create Exam
              </button>
            </div>
          </div>

          {msg && (
            <div style={{
              padding:'10px 16px', borderRadius:7, marginBottom:14, fontSize:13,
              background: msg.startsWith('✅') ? '#ecfdf5' : '#fef2f2',
              color: msg.startsWith('✅') ? '#10b981' : '#ef4444',
              border: `1px solid ${msg.startsWith('✅') ? '#a7f3d0' : '#fecaca'}`,
            }}>{msg}</div>
          )}

          {/* Stats row */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
            {[
              { label:'Total Exams',  value: exams.length, color:'#0176d3', bg:'#eff6ff', icon:'📋' },
              { label:'Draft',        value: exams.filter(e => (e.status||'DRAFT') === 'DRAFT').length, color:'#f59e0b', bg:'#fffbeb', icon:'✏️' },
              { label:'Published',    value: exams.filter(e => e.status === 'PUBLISHED').length, color:'#10b981', bg:'#ecfdf5', icon:'✅' },
              { label:'Archived',     value: exams.filter(e => e.status === 'ARCHIVED').length, color:'#94a3b8', bg:'#f8fafc', icon:'📦' },
            ].map(s => (
              <div key={s.label} style={{
                background: s.bg, borderRadius:10, padding:'14px 16px',
                border: `1px solid ${s.color}22`,
              }}>
                <div style={{ fontSize:20, marginBottom:4 }}>{s.icon}</div>
                <div style={{ fontSize:22, fontWeight:800, color: s.color, lineHeight:1 }}>{s.value}</div>
                <div style={{ fontSize:11, color:'#94a3b8', marginTop:3, fontWeight:600 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Tabs + Search */}
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

          {/* Exam cards grid */}
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
                    {/* Card top */}
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

                    {/* Footer */}
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', paddingTop:10, borderTop:'1px solid #f1f5f9' }}>
                      <div style={{ display:'flex', gap:6 }}>
                        {(exam.classes || []).slice(0,3).map(c => (
                          <span key={c.id} style={{ background:'#f1f5f9', color:'#475569', borderRadius:4, padding:'2px 6px', fontSize:10, fontWeight:600 }}>
                            {c.name} {c.section}
                          </span>
                        ))}
                        {(exam.classes || []).length > 3 && (
                          <span style={{ fontSize:10, color:'#94a3b8' }}>+{exam.classes.length - 3}</span>
                        )}
                      </div>
                      <span style={{ fontSize:11, color:'#94a3b8', fontWeight:600 }}>
                        {exam.timetable_count || 0} papers →
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Overlay for drawer */}
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
  );
}
