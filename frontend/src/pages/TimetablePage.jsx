import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar  from '../components/Navbar';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

// ─── Constants ────────────────────────────────────────────────────────────────
const DAYS = ['MON','TUE','WED','THU','FRI','SAT'];
const DAY_LABELS = { MON:'Monday', TUE:'Tuesday', WED:'Wednesday', THU:'Thursday', FRI:'Friday', SAT:'Saturday' };
const PERIODS = [1,2,3,4,5,6,7,8];
const SESSIONS = ['2023-24','2024-25','2025-26','2026-27'];
const TIME_OPTIONS = [
  '07:30 AM','08:00 AM','08:30 AM','08:45 AM','09:00 AM','09:30 AM',
  '10:00 AM','10:15 AM','10:30 AM','11:00 AM','11:15 AM','11:30 AM',
  '12:00 PM','12:30 PM','01:00 PM','01:15 PM','01:30 PM',
  '02:00 PM','02:30 PM','03:00 PM','03:30 PM','04:00 PM','04:30 PM',
];
const SUBJECT_COLORS = [
  '#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6',
  '#06b6d4','#f97316','#84cc16','#ec4899','#6366f1',
];
// ─── PDF Generator ───────────────────────────────────────────────────────────
const escapeHtml = (str) => {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

function generateTimetablePDF({ timetable, periods, subjects, teachers, className, schoolName }) {
  const doc = document.createElement('div');
  doc.id = '__tt_pdf_root';

  const subjectColorMap = {};
  subjects.forEach((s, i) => { subjectColorMap[s.id] = SUBJECT_COLORS[i % SUBJECT_COLORS.length]; });

  const periodMap = {};
  periods.forEach(p => { periodMap[`${p.day}-${p.period_no}`] = p; });

  const teacherMap = {};
  teachers.forEach(t => { teacherMap[t.id] = t.name; });

  const subjectMap = {};
  subjects.forEach(s => { subjectMap[s.id] = s.name; });

  const now = escapeHtml(new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }));
  const safeSchoolName = escapeHtml(schoolName || 'EduERP School');
  const safeTitle = escapeHtml(timetable.title || 'Timetable');
  const safeClassName = escapeHtml(className || '');
  const safeSession = escapeHtml(timetable.session || '');
  const safeStatus = escapeHtml(timetable.status || '');

  const rows = PERIODS.map(pNo => {
    const cells = DAYS.map(day => {
      const p = periodMap[`${day}-${pNo}`];
      if (!p) return `<td style="padding:5px 4px;border:1px solid #e2e8f0;min-width:90px;height:52px;background:#f8fafc;"></td>`;
      if (p.is_break) return `<td style="padding:5px 4px;border:1px solid #e2e8f0;background:#fffbeb;text-align:center;">
        <div style="font-size:9px;font-weight:700;color:#92400e;">☕ ${escapeHtml(p.break_label || 'Break')}</div>
        ${p.start_time ? `<div style="font-size:8px;color:#a16207;">${escapeHtml(p.start_time)}–${escapeHtml(p.end_time)}</div>` : ''}
      </td>`;
      const color = subjectColorMap[p.subject_id] || '#64748b';
      const subName = escapeHtml(subjectMap[p.subject_id] || p.subject_name || '—');
      const tchName = escapeHtml(teacherMap[p.teacher_id] || p.teacher_name || '');
      const startTime = escapeHtml(p.start_time || '');
      const endTime = escapeHtml(p.end_time || '');
      const room = escapeHtml(p.room || '');
      return `<td style="padding:5px 4px;border:1px solid #e2e8f0;background:${color}10;">
        <div style="font-weight:700;font-size:9px;color:${color};line-height:1.2;">${subName}</div>
        ${tchName ? `<div style="font-size:8px;color:#64748b;margin-top:1px;">👤 ${tchName}</div>` : ''}
        ${startTime ? `<div style="font-size:7px;color:#94a3b8;margin-top:2px;">${startTime}–${endTime}${room ? ` · ${room}` : ''}</div>` : ''}
      </td>`;
    }).join('');
    return `<tr>
      <td style="padding:5px 6px;border:1px solid #e2e8f0;text-align:center;font-weight:700;font-size:10px;color:#0176d3;background:#eff6ff;">P${pNo}</td>
      ${cells}
    </tr>`;
  }).join('');

  const legend = subjects.slice(0, 10).map((s, i) => {
    const c = SUBJECT_COLORS[i % SUBJECT_COLORS.length];
    return `<span style="display:inline-flex;align-items:center;gap:4px;background:${c}15;border:1px solid ${c}44;border-radius:20px;padding:2px 8px;font-size:9px;font-weight:600;color:${c};margin:2px;">
      <span style="width:6px;height:6px;border-radius:50%;background:${c};display:inline-block;"></span>${escapeHtml(s.name)}
    </span>`;
  }).join('');

  doc.innerHTML = `
  <style>
    @media print {
      @page { size: A4 landscape; margin: 10mm; }
      body { margin: 0; font-family: 'Segoe UI', Arial, sans-serif; }
      #__tt_pdf_root { display: block !important; }
    }
    #__tt_pdf_root { font-family: 'Segoe UI', Arial, sans-serif; padding: 16px; }
  </style>
  <div style="border:2px solid #0176d3;border-radius:8px;overflow:hidden;">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#032d60,#0176d3);padding:14px 20px;display:flex;justify-content:space-between;align-items:center;">
      <div>
        <div style="color:#fff;font-size:18px;font-weight:800;letter-spacing:0.02em;">${safeSchoolName}</div>
        <div style="color:rgba(255,255,255,0.75);font-size:11px;margin-top:2px;">Weekly Timetable — ${safeTitle}</div>
      </div>
      <div style="text-align:right;">
        <div style="color:#fff;font-size:14px;font-weight:700;">${safeClassName}</div>
        <div style="color:rgba(255,255,255,0.75);font-size:10px;">Session: ${safeSession}</div>
        <span style="background:${timetable.status === 'PUBLISHED' ? '#10b981' : '#f59e0b'};color:#fff;font-size:9px;font-weight:700;padding:2px 8px;border-radius:20px;">${safeStatus}</span>
      </div>
    </div>

    <!-- Grid -->
    <div style="padding:12px 14px;background:#fff;">
      <table style="width:100%;border-collapse:collapse;border-spacing:0;">
        <thead>
          <tr>
            <th style="padding:7px 6px;background:#f1f5f9;border:1px solid #e2e8f0;font-size:10px;color:#94a3b8;width:42px;text-align:center;">Period</th>
            ${DAYS.map(d => `<th style="padding:7px 6px;background:#f1f5f9;border:1px solid #e2e8f0;font-size:10px;font-weight:700;color:#475569;text-align:center;min-width:90px;">${DAY_LABELS[d]}<br><span style="font-size:8px;color:#94a3b8;font-weight:600;">${d}</span></th>`).join('')}
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>

    <!-- Legend -->
    ${subjects.length > 0 ? `<div style="padding:8px 14px;border-top:1px solid #f1f5f9;background:#fafafa;">${legend}</div>` : ''}

    <!-- Signature Row -->
    <div style="padding:16px 20px;border-top:2px solid #e2e8f0;background:#fff;display:flex;justify-content:space-around;align-items:flex-end;gap:20px;">
      ${[
        { label: 'Director', line: true },
        { label: 'Principal', line: true },
        { label: 'Class Teacher', line: true },
      ].map(s => `
        <div style="flex:1;text-align:center;">
          <div style="height:36px;border-bottom:1.5px solid #334155;margin-bottom:4px;"></div>
          <div style="font-size:10px;font-weight:700;color:#0f172a;">${escapeHtml(s.label)}</div>
          <div style="font-size:8px;color:#94a3b8;margin-top:1px;">Signature &amp; Seal</div>
        </div>
      `).join('')}
    </div>

    <!-- Footer -->
    <div style="padding:7px 14px;background:#f8fafc;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;">
      <div style="font-size:8px;color:#94a3b8;">Generated by EduERP · ${now}</div>
      <div style="font-size:8px;color:#94a3b8;">Confidential — For internal use only</div>
    </div>
  </div>`;

  return doc;
}

function downloadTimetablePDF({ timetable, periods, subjects, teachers, className, schoolName }) {
  const node = generateTimetablePDF({ timetable, periods, subjects, teachers, className, schoolName });
  document.body.appendChild(node);
  const style = document.createElement('style');
  style.id = '__tt_print_style';
  style.innerHTML = `
    @media print {
      body > *:not(#__tt_pdf_root) { display: none !important; }
      #__tt_pdf_root { display: block !important; position: fixed; inset: 0; z-index: 99999; background: #fff; }
    }
  `;
  document.head.appendChild(style);
  window.print();
  setTimeout(() => {
    document.body.removeChild(node);
    document.head.removeChild(style);
  }, 1000);
}


const flash = (setMsg, text, dur = 3500) => {
  setMsg(text); setTimeout(() => setMsg(''), dur);
};

// ─── Period Cell Component ────────────────────────────────────────────────────
function PeriodCell({ period, subjects, teachers, isPublished, onClick }) {
  if (!period) {
    return (
      <div onClick={onClick}
        style={{
          minHeight: 68, borderRadius: 6, border: '1.5px dashed #e2e8f0',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: isPublished ? 'default' : 'pointer',
          color: '#cbd5e1', fontSize: 11,
          transition: 'all 0.15s',
          background: 'white',
        }}
        onMouseEnter={e => { if (!isPublished) { e.currentTarget.style.borderColor = '#93c5fd'; e.currentTarget.style.background = '#f8faff'; }}}
        onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = 'white'; }}
      >
        {!isPublished && <span style={{ fontSize: 18, opacity: 0.4 }}>+</span>}
      </div>
    );
  }

  if (period.is_break) {
    return (
      <div style={{
        minHeight: 68, borderRadius: 6,
        background: 'linear-gradient(135deg, #fef9c3, #fef3c7)',
        border: '1px solid #fde68a',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 2,
      }}>
        <span style={{ fontSize: 14 }}>☕</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#92400e' }}>
          {period.break_label || 'Break'}
        </span>
        {period.start_time && (
          <span style={{ fontSize: 9, color: '#a16207' }}>
            {period.start_time}–{period.end_time}
          </span>
        )}
      </div>
    );
  }

  const subjectIdx = subjects.findIndex(s => s.id === period.subject_id);
  const color = SUBJECT_COLORS[subjectIdx % SUBJECT_COLORS.length] || '#64748b';

  return (
    <div onClick={!isPublished ? onClick : undefined}
      style={{
        minHeight: 68, borderRadius: 6,
        background: `${color}12`,
        border: `1.5px solid ${color}44`,
        padding: '6px 8px',
        cursor: isPublished ? 'default' : 'pointer',
        transition: 'all 0.15s',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      }}
      onMouseEnter={e => { if (!isPublished) e.currentTarget.style.borderColor = color; }}
      onMouseLeave={e => { if (!isPublished) e.currentTarget.style.borderColor = `${color}44`; }}
    >
      <div style={{ fontWeight: 700, fontSize: 11, color, lineHeight: 1.2 }}>
        {period.subject_name || '—'}
      </div>
      {period.teacher_name && (
        <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
          👤 {period.teacher_name}
        </div>
      )}
      <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 2 }}>
        {period.start_time && `${period.start_time}–${period.end_time}`}
        {period.room && ` · ${period.room}`}
      </div>
    </div>
  );
}

// ─── Period Edit Modal ────────────────────────────────────────────────────────
function PeriodModal({ day, periodNo, existing, subjects, teachers, onSave, onDelete, onClose }) {
  const [form, setForm] = useState({
    subject_id:  existing?.subject_id  || '',
    teacher_id:  existing?.teacher_id  || '',
    start_time:  existing?.start_time  || '',
    end_time:    existing?.end_time    || '',
    room:        existing?.room        || '',
    is_break:    existing?.is_break    || false,
    break_label: existing?.break_label || 'Lunch Break',
  });
  const set = (k, v) => {
    setForm(f => {
      const updated = { ...f, [k]: v };
      if (k === 'subject_id' && v && !f.teacher_id) {
        const sub = subjects.find(s => String(s.id) === String(v));
        if (sub?.teacher_id) updated.teacher_id = String(sub.teacher_id);
      }
      return updated;
    });
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'white', borderRadius: 10, width: 420, maxWidth: '95vw',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        <div style={{
          padding: '14px 18px', borderBottom: '1px solid #e2e8f0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, color: '#0f172a' }}>
              {DAY_LABELS[day]} — Period {periodNo}
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>
              {existing ? 'Edit period' : 'Add period'}
            </div>
          </div>
          <button onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#94a3b8' }}>✕</button>
        </div>

        <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Break toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.is_break}
              onChange={e => set('is_break', e.target.checked)}
              style={{ width: 14, height: 14 }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>☕ This is a Break / Recess</span>
          </label>

          {form.is_break ? (
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 3 }}>Break Label</label>
              <input value={form.break_label}
                onChange={e => set('break_label', e.target.value)}
                placeholder="e.g. Lunch Break, Recess"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12, boxSizing: 'border-box' }} />
            </div>
          ) : (
            <>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 3 }}>Subject</label>
                <select value={form.subject_id} onChange={e => set('subject_id', e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12 }}>
                  <option value=''>— Select Subject —</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 3 }}>
                  Teacher
                  {form.subject_id && (() => {
                    const sub = subjects.find(s => String(s.id) === String(form.subject_id));
                    return sub?.teacher_id
                      ? <span style={{ marginLeft: 6, fontSize: 10, color: '#10b981', fontWeight: 500 }}>
                          (Subject teacher auto-selected)
                        </span>
                      : null;
                  })()}
                </label>
                <select value={form.teacher_id} onChange={e => set('teacher_id', e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12 }}>
                  <option value=''>— Select Teacher —</option>
                  {teachers.map(t => {
                    const isSubjectTeacher = subjects.find(
                      s => String(s.id) === String(form.subject_id) && String(s.teacher_id) === String(t.id)
                    );
                    return (
                      <option key={t.id} value={t.id}>
                        {t.name}{isSubjectTeacher ? ' ✓ Subject Teacher' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 3 }}>Room / Venue</label>
                <input value={form.room} onChange={e => set('room', e.target.value)}
                  placeholder="e.g. Room 12, Lab 2"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
            </>
          )}

          {/* Timing — always shown */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 3 }}>Start Time</label>
              <select value={form.start_time} onChange={e => set('start_time', e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12 }}>
                <option value=''>—</option>
                {TIME_OPTIONS.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 3 }}>End Time</label>
              <select value={form.end_time} onChange={e => set('end_time', e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12 }}>
                <option value=''>—</option>
                {TIME_OPTIONS.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div style={{
          padding: '12px 18px', borderTop: '1px solid #f1f5f9',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            {existing && (
              <button onClick={() => onDelete(existing.id)}
                style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                🗑 Remove
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose}
              style={{ padding: '7px 16px', borderRadius: 6, fontSize: 12, background: 'white', border: '1px solid #e2e8f0', cursor: 'pointer' }}>
              Cancel
            </button>
            <button onClick={() => onSave(form)}
              style={{ padding: '7px 18px', borderRadius: 6, fontSize: 12, fontWeight: 700, background: '#0176d3', color: 'white', border: 'none', cursor: 'pointer' }}>
              💾 Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Timetable Grid ───────────────────────────────────────────────────────────
function TimetableGrid({ timetable, subjects, teachers, onUpdate, schoolName = '' }) {
  const [periods,    setPeriods]    = useState([]);
  const [editCell,   setEditCell]   = useState(null); // {day, periodNo, existing}
  const [saving,     setSaving]     = useState(false);
  const [msg,        setMsg]        = useState('');

  const isPublished = timetable.status === 'PUBLISHED';

  const loadPeriods = useCallback(() => {
    api.get(`/principal/timetables/${timetable.id}/periods`)
      .then(r => setPeriods(r.data))
      .catch(() => {});
  }, [timetable.id]);

  useEffect(() => { loadPeriods(); }, [loadPeriods]);

  // Build lookup map: day+periodNo → period object
  const periodMap = {};
  periods.forEach(p => { periodMap[`${p.day}-${p.period_no}`] = p; });

  const openCell = (day, periodNo) => {
    if (isPublished) return;
    const existing = periodMap[`${day}-${periodNo}`] || null;
    setEditCell({ day, periodNo, existing });
  };

  const saveCell = async (form) => {
    setSaving(true);
    try {
      await api.post(`/principal/timetables/${timetable.id}/periods`, {
        ...form,
        day:       editCell.day,
        period_no: editCell.periodNo,
        subject_id:  form.subject_id  ? Number(form.subject_id)  : null,
        teacher_id:  form.teacher_id  ? Number(form.teacher_id)  : null,
      });
      setEditCell(null);
      loadPeriods();
      onUpdate?.();
      flash(setMsg, '✅ Saved!');
    } catch(err) {
      flash(setMsg, '❌ ' + (err.response?.data?.error || 'Error'));
    }
    setSaving(false);
  };

  const deleteCell = async (periodId) => {
    try {
      await api.delete(`/principal/timetables/periods/${periodId}`);
      setEditCell(null);
      loadPeriods();
      onUpdate?.();
      flash(setMsg, '✅ Period removed');
    } catch {
      flash(setMsg, '❌ Delete failed');
    }
  };

  const doPublish = async () => {
    if (!window.confirm('Publish this timetable? Students will see it.')) return;
    try {
      await api.post(`/principal/timetables/${timetable.id}/publish`);
      flash(setMsg, '✅ Timetable published!');
      onUpdate?.();
    } catch(err) {
      flash(setMsg, '❌ ' + (err.response?.data?.error || 'Error'));
    }
  };

  const doUnpublish = async () => {
    if (!window.confirm('Unpublish timetable?')) return;
    try {
      await api.post(`/principal/timetables/${timetable.id}/unpublish`);
      flash(setMsg, '✅ Unpublished');
      onUpdate?.();
    } catch(err) {
      flash(setMsg, '❌ ' + (err.response?.data?.error || 'Error'));
    }
  };

  const doDelete = async () => {
    if (!window.confirm('Delete this timetable permanently?')) return;
    try {
      await api.delete(`/principal/timetables/${timetable.id}`);
      onUpdate?.('deleted');
    } catch(err) {
      flash(setMsg, '❌ ' + (err.response?.data?.error || 'Error'));
    }
  };

  return (
    <div>
      {/* Timetable header bar */}
      {/* ── Timetable Header Bar ── */}
      <div style={{
        background: 'linear-gradient(135deg, #f8faff 0%, #f1f5ff 100%)',
        border: '1.5px solid #e0e9ff',
        borderRadius: 12,
        padding: '14px 18px',
        marginBottom: 16,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
        boxShadow: '0 2px 8px rgba(1,118,211,0.06)',
      }}>
        {/* Left — info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {/* Status badge */}
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            background: isPublished ? '#ecfdf5' : '#fffbeb',
            color: isPublished ? '#059669' : '#d97706',
            border: '1.5px solid ' + (isPublished ? '#a7f3d0' : '#fde68a'),
            borderRadius: 20, padding: '4px 12px',
            fontSize: 11, fontWeight: 800, letterSpacing: 0.3,
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%',
              background: isPublished ? '#10b981' : '#f59e0b',
              display: 'inline-block',
            }} />
            {isPublished ? 'PUBLISHED' : 'DRAFT'}
          </span>

          {/* Title + meta */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
              {timetable.class_name || 'Timetable'} — {timetable.title}
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1, display: 'flex', gap: 8 }}>
              <span>📅 Session: {timetable.session}</span>
              <span>·</span>
              <span>📌 {periods.length} periods filled</span>
            </div>
          </div>
        </div>

        {/* Right — action buttons */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>

          {/* Download PDF — always */}
          <button
            onClick={function() {
              downloadTimetablePDF({
                timetable: timetable,
                periods: periods,
                subjects: subjects,
                teachers: teachers,
                className: timetable.class_name || 'Class',
                schoolName: schoolName,
              });
            }}
            title="Download PDF"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              background: 'white', color: '#0176d3',
              border: '1.5px solid #bae6fd', cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              transition: 'all 0.15s',
            }}
            onMouseEnter={function(e) { e.currentTarget.style.background = '#e8f4fd'; }}
            onMouseLeave={function(e) { e.currentTarget.style.background = 'white'; }}
          >
            📄 <span>Download PDF</span>
          </button>

          {/* Divider */}
          <div style={{ width: 1, height: 28, background: '#e2e8f0' }} />

          {/* DRAFT state buttons */}
          {!isPublished && (
            <>
              {/* Save Changes (visual — grid auto-saves per cell) */}
              <button
                onClick={function() { onUpdate && onUpdate(); }}
                title="Changes auto-saved. Click to refresh."
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                  background: 'white', color: '#475569',
                  border: '1.5px solid #e2e8f0', cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={function(e) { e.currentTarget.style.background = '#f8fafc'; }}
                onMouseLeave={function(e) { e.currentTarget.style.background = 'white'; }}
              >
                🔄 <span>Refresh</span>
              </button>

              {/* Publish */}
              <button
                onClick={doPublish}
                title="Publish timetable — students will see it"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                  background: 'linear-gradient(135deg, #059669, #10b981)',
                  color: 'white', border: 'none', cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(16,185,129,0.35)',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={function(e) { e.currentTarget.style.opacity = '0.9'; }}
                onMouseLeave={function(e) { e.currentTarget.style.opacity = '1'; }}
              >
                📢 <span>Publish</span>
              </button>

              {/* Delete */}
              <button
                onClick={doDelete}
                title="Delete this timetable permanently"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                  background: '#fff5f5', color: '#ef4444',
                  border: '1.5px solid #fecaca', cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={function(e) { e.currentTarget.style.background = '#fee2e2'; }}
                onMouseLeave={function(e) { e.currentTarget.style.background = '#fff5f5'; }}
              >
                🗑 <span>Delete</span>
              </button>
            </>
          )}

          {/* PUBLISHED state buttons */}
          {isPublished && (
            <>
              {/* Unpublish → Edit mode mein le jaata hai */}
              <button
                onClick={doUnpublish}
                title="Unpublish to edit timetable"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                  background: '#fffbeb', color: '#d97706',
                  border: '1.5px solid #fde68a', cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={function(e) { e.currentTarget.style.background = '#fef3c7'; }}
                onMouseLeave={function(e) { e.currentTarget.style.background = '#fffbeb'; }}
              >
                ✏️ <span>Edit (Unpublish)</span>
              </button>

              {/* Re-publish — visible after unpublish+edit workflow hint */}
              <button
                onClick={doPublish}
                title="Re-publish updated timetable"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                  background: 'linear-gradient(135deg, #0176d3, #0ea5e9)',
                  color: 'white', border: 'none', cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(1,118,211,0.3)',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={function(e) { e.currentTarget.style.opacity = '0.9'; }}
                onMouseLeave={function(e) { e.currentTarget.style.opacity = '1'; }}
              >
                📢 <span>Re-publish</span>
              </button>

              {/* Delete — published pe bhi allow karo */}
              <button
                onClick={doDelete}
                title="Delete this timetable"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                  background: '#fff5f5', color: '#ef4444',
                  border: '1.5px solid #fecaca', cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={function(e) { e.currentTarget.style.background = '#fee2e2'; }}
                onMouseLeave={function(e) { e.currentTarget.style.background = '#fff5f5'; }}
              >
                🗑 <span>Delete</span>
              </button>
            </>
          )}
        </div>
      </div>

      {msg && (
        <div style={{
          padding: '8px 12px', borderRadius: 6, marginBottom: 10, fontSize: 12,
          background: msg.startsWith('✅') ? '#ecfdf5' : '#fef2f2',
          color: msg.startsWith('✅') ? '#10b981' : '#ef4444',
          border: `1px solid ${msg.startsWith('✅') ? '#a7f3d0' : '#fecaca'}`,
        }}>{msg}</div>
      )}

      {/* Grid */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 4 }}>
          <thead>
            <tr>
              <th style={{
                width: 70, padding: '8px 6px', fontSize: 11, fontWeight: 700,
                color: '#94a3b8', textAlign: 'center', background: '#f8fafc',
                borderRadius: 6,
              }}>Period</th>
              {DAYS.map(day => (
                <th key={day} style={{
                  padding: '8px 6px', fontSize: 11, fontWeight: 700,
                  color: '#475569', textAlign: 'center',
                  background: '#f1f5f9', borderRadius: 6, minWidth: 110,
                }}>
                  <div>{DAY_LABELS[day]}</div>
                  <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 600 }}>{day}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERIODS.map(pNo => (
              <tr key={pNo}>
                <td style={{
                  textAlign: 'center', fontSize: 11, fontWeight: 700,
                  color: '#0176d3', background: '#eff6ff', borderRadius: 6,
                  padding: '4px 6px',
                }}>
                  P{pNo}
                </td>
                {DAYS.map(day => (
                  <td key={day} style={{ padding: 2, verticalAlign: 'top' }}>
                    <PeriodCell
                      period={periodMap[`${day}-${pNo}`] || null}
                      subjects={subjects}
                      teachers={teachers}
                      isPublished={isPublished}
                      onClick={() => openCell(day, pNo)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      {subjects.length > 0 && (
        <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {subjects.slice(0, 10).map((s, i) => (
            <span key={s.id} style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              background: `${SUBJECT_COLORS[i % SUBJECT_COLORS.length]}15`,
              border: `1px solid ${SUBJECT_COLORS[i % SUBJECT_COLORS.length]}44`,
              borderRadius: 20, padding: '3px 10px',
              fontSize: 11, fontWeight: 600,
              color: SUBJECT_COLORS[i % SUBJECT_COLORS.length],
            }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: SUBJECT_COLORS[i % SUBJECT_COLORS.length], display: 'inline-block' }} />
              {s.name}
            </span>
          ))}
        </div>
      )}

      {/* Edit modal */}
      {editCell && (
        <PeriodModal
          day={editCell.day}
          periodNo={editCell.periodNo}
          existing={editCell.existing}
          subjects={subjects}
          teachers={teachers}
          onSave={saveCell}
          onDelete={deleteCell}
          onClose={() => setEditCell(null)}
        />
      )}
    </div>
  );
}

// ─── Teacher View (teacher-wise timetable) ────────────────────────────────────
function TeacherView({ teachers, classes }) {
  const [selTeacher, setSelTeacher] = useState('');
  const [grid,       setGrid]       = useState({});

  useEffect(() => {
    if (!selTeacher) { setGrid({}); return; }
    // Fetch all published timetables, filter by teacher
    api.get('/principal/timetables').then(async r => {
      const published = r.data.filter(t => t.status === 'PUBLISHED');
      const allPeriods = [];
      for (const tt of published) {
        const pr = await api.get(`/principal/timetables/${tt.id}/periods`);
        pr.data.forEach(p => {
          if (String(p.teacher_id) === String(selTeacher)) {
            const cls = classes.find(c => c.id === tt.class_id);
            allPeriods.push({ ...p, class_name: cls ? `${cls.name} ${cls.section}` : '' });
          }
        });
      }
      // Build day → periods map
      const g = {};
      allPeriods.forEach(p => {
        if (!g[p.day]) g[p.day] = {};
        g[p.day][p.period_no] = p;
      });
      setGrid(g);
    }).catch(() => {});
  }, [selTeacher, classes]);

  const teacher = teachers.find(t => String(t.id) === String(selTeacher));

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>Select Teacher</label>
        <select value={selTeacher} onChange={e => setSelTeacher(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 7, border: '1.5px solid #e2e8f0', fontSize: 13, width: 280 }}>
          <option value=''>— Select Teacher —</option>
          {teachers.map(t => <option key={t.id} value={t.id}>{t.name} ({t.designation || 'Teacher'})</option>)}
        </select>
      </div>

      {selTeacher && teacher && (
        <div>
          <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
            {teacher.photo_url
              ? <img src={teacher.photo_url} alt={teacher.name} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
              : <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#f3f0ff', color: '#5867e8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 15 }}>
                  {teacher.name?.charAt(0)}
                </div>
            }
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{teacher.name}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>{teacher.designation}</div>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 4 }}>
              <thead>
                <tr>
                  <th style={{ width: 70, padding: '8px 6px', fontSize: 11, fontWeight: 700, color: '#94a3b8', textAlign: 'center', background: '#f8fafc', borderRadius: 6 }}>Period</th>
                  {DAYS.map(day => (
                    <th key={day} style={{ padding: '8px 6px', fontSize: 11, fontWeight: 700, color: '#475569', textAlign: 'center', background: '#f1f5f9', borderRadius: 6, minWidth: 110 }}>
                      {DAY_LABELS[day]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERIODS.map(pNo => (
                  <tr key={pNo}>
                    <td style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#0176d3', background: '#eff6ff', borderRadius: 6, padding: '4px 6px' }}>P{pNo}</td>
                    {DAYS.map(day => {
                      const p = grid[day]?.[pNo];
                      return (
                        <td key={day} style={{ padding: 2 }}>
                          {p ? (
                            <div style={{
                              minHeight: 60, borderRadius: 6, padding: '6px 8px',
                              background: '#eff6ff', border: '1.5px solid #bfdbfe',
                            }}>
                              <div style={{ fontWeight: 700, fontSize: 11, color: '#0176d3' }}>{p.subject_name}</div>
                              <div style={{ fontSize: 10, color: '#64748b' }}>{p.class_name}</div>
                              {p.start_time && <div style={{ fontSize: 9, color: '#94a3b8' }}>{p.start_time}–{p.end_time}</div>}
                            </div>
                          ) : (
                            <div style={{ minHeight: 60, borderRadius: 6, background: '#f8fafc', border: '1px solid #f1f5f9' }} />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selTeacher && Object.keys(grid).length === 0 && (
        <div style={{ textAlign: 'center', padding: 32, color: '#94a3b8', fontSize: 13 }}>
          No published timetable entries found for this teacher.
        </div>
      )}
    </div>
  );
}

// ─── Create Timetable Modal ───────────────────────────────────────────────────
function CreateTimetableModal({ classes, onClose, onCreated }) {
  const [form, setForm] = useState({ class_id: '', session: '2025-26', title: 'Weekly Timetable' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    if (!form.class_id) { setErr('Class select karo'); return; }
    setSaving(true); setErr('');
    try {
      const res = await api.post('/principal/timetables', {
        ...form,
        class_id: Number(form.class_id),
      });
      onCreated(res.data);
      onClose();
    } catch(ex) {
      setErr(ex.response?.data?.error || 'Error');
    }
    setSaving(false);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'white', borderRadius: 10, width: 420, maxWidth: '95vw', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#0f172a' }}>📅 Create Timetable</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#94a3b8' }}>✕</button>
        </div>
        <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Class *</label>
            <select value={form.class_id} onChange={e => setForm(f => ({...f, class_id: e.target.value}))}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 7, border: '1.5px solid #e2e8f0', fontSize: 13 }}>
              <option value=''>— Select Class —</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Session</label>
            <select value={form.session} onChange={e => setForm(f => ({...f, session: e.target.value}))}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 7, border: '1.5px solid #e2e8f0', fontSize: 13 }}>
              {SESSIONS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Title</label>
            <input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 7, border: '1.5px solid #e2e8f0', fontSize: 13, boxSizing: 'border-box' }} />
          </div>
          {err && <div style={{ padding: '8px 10px', background: '#fef2f2', color: '#ef4444', borderRadius: 6, fontSize: 12 }}>{err}</div>}
        </div>
        <div style={{ padding: '12px 18px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose}
            style={{ padding: '8px 16px', borderRadius: 7, fontSize: 12, background: 'white', border: '1px solid #e2e8f0', cursor: 'pointer' }}>Cancel</button>
          <button onClick={submit} disabled={saving}
            style={{ padding: '8px 18px', borderRadius: 7, fontSize: 12, fontWeight: 700, background: '#0176d3', color: 'white', border: 'none', cursor: 'pointer' }}>
            {saving ? 'Creating…' : '+ Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main TimetablePage ───────────────────────────────────────────────────────
export default function TimetablePage() {
  const { user } = useAuth();
  const [timetables,  setTimetables]  = useState([]);
  const [classes,     setClasses]     = useState([]);
  const [teachers,    setTeachers]    = useState([]);
  const [subjects,    setSubjects]    = useState({});   // classId → subjects[]
  const [selClass,    setSelClass]    = useState('');
  const [selTT,       setSelTT]       = useState(null); // active timetable object
  const [view,        setView]        = useState('class'); // class | teacher
  const [showCreate,  setShowCreate]  = useState(false);
  const [msg,         setMsg]         = useState('');
  const [loading,     setLoading]     = useState(true);

  const loadBase = useCallback(async () => {
    try {
      const [tc, tr] = await Promise.all([
        api.get('/principal/classes'),
        api.get('/principal/teachers'),
      ]);
      setClasses(tc.data);
      setTeachers(tr.data);
    } catch {}
  }, []);

  const loadTimetables = useCallback(async (classId) => {
    setLoading(true);
    try {
      const url = classId ? `/principal/timetables?class_id=${classId}` : '/principal/timetables';
      const r = await api.get(url);
      setTimetables(r.data);
      // auto-select first
      if (r.data.length > 0 && !selTT) setSelTT(r.data[0]);
    } catch {}
    setLoading(false);
  }, [selTT]);

  const loadSubjects = useCallback(async (classId) => {
    if (!classId || subjects[classId]) return;
    try {
      const r = await api.get(`/principal/classes/${classId}/subjects`);
      setSubjects(prev => ({...prev, [classId]: r.data}));
    } catch {}
  }, [subjects]);

  useEffect(() => { loadBase(); }, [loadBase]);
  useEffect(() => { loadTimetables(selClass); }, [selClass]);
  useEffect(() => {
    if (selTT?.class_id) loadSubjects(selTT.class_id);
  }, [selTT]);

  const handleClassChange = (classId) => {
    setSelClass(classId);
    setSelTT(null);
  };

  const handleUpdate = (action) => {
    if (action === 'deleted') {
      setSelTT(null);
      loadTimetables(selClass);
    } else {
      // re-fetch timetables and update selTT
      const url = selClass ? `/principal/timetables?class_id=${selClass}` : '/principal/timetables';
      api.get(url).then(r => {
        setTimetables(r.data);
        if (selTT) {
          const updated = r.data.find(t => t.id === selTT.id);
          if (updated) setSelTT(updated);
        }
      }).catch(() => {});
    }
  };

  const classesWithTT = [...new Set(timetables.map(t => t.class_id))];

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar title="Timetable Management" />
        <div className="page-body">

          {/* Page header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0f172a' }}>Timetable Management</h2>
              <p style={{ margin: '3px 0 0', fontSize: 13, color: '#64748b' }}>
                Create weekly class timetables — publish to make visible for students and teachers
              </p>
            </div>
            <button onClick={() => setShowCreate(true)}
              style={{
                padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                background: '#0176d3', color: 'white', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 7,
                boxShadow: '0 2px 8px rgba(1,118,211,0.3)',
              }}>
              + Create Timetable
            </button>
          </div>

          {msg && (
            <div style={{
              padding: '10px 16px', borderRadius: 7, marginBottom: 14, fontSize: 13,
              background: msg.startsWith('✅') ? '#ecfdf5' : '#fef2f2',
              color: msg.startsWith('✅') ? '#10b981' : '#ef4444',
              border: `1px solid ${msg.startsWith('✅') ? '#a7f3d0' : '#fecaca'}`,
            }}>{msg}</div>
          )}

          {/* View tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', marginBottom: 20 }}>
            {[
              { key: 'class',   label: '🏫 Class-wise' },
              { key: 'teacher', label: '👤 Teacher-wise' },
            ].map(t => (
              <button key={t.key} onClick={() => setView(t.key)}
                style={{
                  padding: '9px 18px', background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: 700,
                  color: view === t.key ? '#0176d3' : '#64748b',
                  borderBottom: view === t.key ? '2px solid #0176d3' : '2px solid transparent',
                  marginBottom: -1,
                }}>{t.label}</button>
            ))}
          </div>

          {/* ── Class View ── */}
          {view === 'class' && (
            <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 16, alignItems: 'start' }}>

              {/* Left sidebar — class + timetable list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* Class filter */}
                <div style={{ background: 'white', borderRadius: 8, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                  <div style={{ padding: '10px 12px', background: '#f8fafc', fontSize: 11, fontWeight: 700, color: '#475569', borderBottom: '1px solid #e2e8f0' }}>
                    CLASSES
                  </div>
                  <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                    <button onClick={() => handleClassChange('')}
                      style={{
                        width: '100%', padding: '9px 12px', background: !selClass ? '#eff6ff' : 'white',
                        border: 'none', borderBottom: '1px solid #f1f5f9', cursor: 'pointer',
                        textAlign: 'left', fontSize: 12, fontWeight: !selClass ? 700 : 500,
                        color: !selClass ? '#0176d3' : '#475569',
                      }}>All Classes</button>
                    {classes.map(c => (
                      <button key={c.id} onClick={() => handleClassChange(String(c.id))}
                        style={{
                          width: '100%', padding: '9px 12px',
                          background: selClass === String(c.id) ? '#eff6ff' : 'white',
                          border: 'none', borderBottom: '1px solid #f1f5f9', cursor: 'pointer',
                          textAlign: 'left', fontSize: 12,
                          fontWeight: selClass === String(c.id) ? 700 : 500,
                          color: selClass === String(c.id) ? '#0176d3' : '#475569',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        }}>
                        <span>{c.name} {c.section}</span>
                        {classesWithTT.includes(c.id) && (
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Timetable list for selected class */}
                {timetables.length > 0 && (
                  <div style={{ background: 'white', borderRadius: 8, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                    <div style={{ padding: '10px 12px', background: '#f8fafc', fontSize: 11, fontWeight: 700, color: '#475569', borderBottom: '1px solid #e2e8f0' }}>
                      TIMETABLES
                    </div>
                    {timetables.map(tt => (
                      <button key={tt.id} onClick={() => setSelTT(tt)}
                        style={{
                          width: '100%', padding: '10px 12px',
                          background: selTT?.id === tt.id ? '#eff6ff' : 'white',
                          border: 'none', borderBottom: '1px solid #f1f5f9', cursor: 'pointer',
                          textAlign: 'left',
                        }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: selTT?.id === tt.id ? '#0176d3' : '#0f172a' }}>
                          {tt.class_name}
                        </div>
                        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{
                            background: tt.status === 'PUBLISHED' ? '#ecfdf5' : '#fffbeb',
                            color: tt.status === 'PUBLISHED' ? '#10b981' : '#f59e0b',
                            borderRadius: 10, padding: '1px 6px', fontSize: 9, fontWeight: 700,
                          }}>{tt.status}</span>
                          <span>{tt.session}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Right — timetable grid */}
              <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e2e8f0', padding: '16px 18px', minHeight: 400 }}>
                {loading ? (
                  <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Loading…</div>
                ) : !selTT ? (
                  <div style={{ textAlign: 'center', padding: '48px 20px', color: '#94a3b8' }}>
                    <div style={{ fontSize: 36, marginBottom: 10 }}>📅</div>
                    <div style={{ fontWeight: 700, color: '#475569', marginBottom: 6 }}>No timetable selected</div>
                    <div style={{ fontSize: 13, marginBottom: 16 }}>
                      {timetables.length === 0
                        ? 'Create a timetable to get started.'
                        : 'Select a timetable from the left panel.'}
                    </div>
                    <button onClick={() => setShowCreate(true)}
                      style={{ padding: '8px 18px', borderRadius: 7, background: '#0176d3', color: 'white', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
                      + Create Timetable
                    </button>
                  </div>
                ) : (
                  <TimetableGrid
                    timetable={selTT}
                    subjects={subjects[selTT.class_id] || []}
                    teachers={teachers}
                    onUpdate={handleUpdate}
                    schoolName={user?.school_name || ''}
                  />
                )}
              </div>
            </div>
          )}

          {/* ── Teacher View ── */}
          {view === 'teacher' && (
            <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e2e8f0', padding: '16px 18px' }}>
              <TeacherView teachers={teachers} classes={classes} />
            </div>
          )}

        </div>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <CreateTimetableModal
          classes={classes}
          onClose={() => setShowCreate(false)}
          onCreated={(tt) => {
            flash(setMsg, '✅ Timetable created!');
            loadTimetables(selClass);
            setSelTT(tt);
          }}
        />
      )}
    </div>
  );
}
