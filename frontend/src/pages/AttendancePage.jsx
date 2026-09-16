import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Navbar  from '../components/Navbar';
import api     from '../api/axios';
import toast   from 'react-hot-toast';

const fmt = n => Number(n ?? 0).toLocaleString('en-IN');

function StatCard({ icon, label, value, color, bg }) {
  return (
    <div className="stat-card">
      <div className="stat-icon" style={{ background: bg }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
      </div>
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ color }}>{value ?? '—'}</div>
    </div>
  );
}

export default function AttendancePage() {
  const navigate = useNavigate();
  const [summary,     setSummary]     = useState(null);
  const [classes,     setClasses]     = useState([]);
  const [selClass,    setSelClass]    = useState(null);   // clicked class
  const [tab,         setTab]         = useState('overview'); // overview | mark
  const [loading,     setLoading]     = useState(false);
  const [msg,         setMsg]         = useState({ text: '', type: '' });

  /* filters */
  const today = new Date().toISOString().split('T')[0];
  const [selDate,  setSelDate]  = useState(today);
  const [selMonth, setSelMonth] = useState(today.slice(0, 7)); // YYYY-MM

  /* mark attendance state */
  const [markClass,   setMarkClass]   = useState('');
  const [markDate,    setMarkDate]    = useState(today);
  const [markStudents,setMarkStudents]= useState([]);
  const [saving,      setSaving]      = useState(false);

  /* ── load overview ── */
  const loadOverview = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get(`/principal/attendance/summary?date=${selDate}`),
      api.get(`/principal/attendance/class-summary?date=${selDate}`),
    ])
      .then(([s, c]) => {
        setSummary(s.data);
        setClasses(c.data || []);
        setSelClass(null);
      })
      .catch(() => flash('❌ Data load error', 'error'))
      .finally(() => setLoading(false));
  }, [selDate]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  /* ── load students for mark tab ── */
  async function loadMarkStudents(class_id) {
  if (!class_id) { setMarkStudents([]); return; }
  try {
    const res = await api.get(`/principal/students?class_id=${class_id}&per_page=100`);
    // backend paginated object return karta hai { data: [...], total: X }
    const raw = res.data;
    const list = Array.isArray(raw) ? raw
               : Array.isArray(raw?.data) ? raw.data
               : [];
    setMarkStudents(list.map(function(s) {
      return Object.assign({}, s, { status: 'PRESENT' });
    }));
  } catch {
    flash('❌ Students load nahi hue', 'error');
  }
}

  function flash(text, type = 'success') {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: '', type: '' }), 3500);
  }

  /* ── toggle student status ── */
  function toggleStatus(student_id, status) {
    setMarkStudents(prev =>
      prev.map(s => s.id === student_id ? { ...s, status } : s)
    );
  }

  /* ── mark all ── */
  function markAll(status) {
    setMarkStudents(prev => prev.map(s => ({ ...s, status })));
  }

  /* ── submit attendance ── */
  async function submitAttendance() {
    if (!markClass) { flash('❌ Class select karo', 'error'); return; }
    if (!markStudents.length) { flash('❌ Koi student nahi', 'error'); return; }
    setSaving(true);
    try {
      await api.post('/principal/attendance/mark', {
        class_id: markClass,
        date:     markDate,
        records:  markStudents.map(s => ({
          student_id: s.id,
          status:     s.status,
        })),
      });
      toast.success(`${markStudents.length} students ki attendance save ho gayi`);
      flash(`✅ ${markStudents.length} students ki attendance save ho gayi`);
      loadOverview();
    } catch {
      flash('❌ Attendance save nahi hui', 'error');
    }
    setSaving(false);
  }

  /* ── helpers ── */
  const presentPct = summary
    ? Math.round((summary.present / (summary.total_students || 1)) * 100)
    : 0;

  const TABS = [
    { key: 'overview', label: '📊 Overview' },
    { key: 'mark',     label: '✏️ Mark Attendance' },
  ];

  /* ════════════════════════════════════════════════════════════════════════ */
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar title="Attendance" />
        <div className="page-body">

          {/* page header */}
          <div className="page-header" style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <h2 className="page-title">Attendance Dashboard</h2>
              <p className="page-subtitle">School-wide aur class-wise attendance track karo</p>
            </div>
          </div>

          {/* alert */}
          {msg.text && (
            <div style={{
              padding: '10px 16px', borderRadius: 8, marginBottom: 16, fontSize: 13,
              background: msg.type === 'error' ? '#fef1ee' : '#eaf5ea',
              color:      msg.type === 'error' ? '#ba0517' : '#2e844a',
              border: `1px solid ${msg.type === 'error' ? '#f9c9c0' : '#a3d9a5'}`,
            }}>{msg.text}</div>
          )}

          {/* ── Tabs ── */}
          <div style={{
            display: 'flex', borderBottom: '2px solid var(--neutral-2)',
            marginBottom: 24, gap: 0,
          }}>
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '10px 20px', fontSize: 13, fontWeight: 600,
                color:       tab === t.key ? 'var(--blue-60)' : 'var(--neutral-6)',
                borderBottom: tab === t.key
                  ? '2px solid var(--blue-60)' : '2px solid transparent',
                marginBottom: -2, transition: 'color 0.15s',
              }}>{t.label}</button>
            ))}
          </div>

          {/* ══════════════ TAB: OVERVIEW ══════════════ */}
          {tab === 'overview' && (
            <>
              {/* date filter */}
              <div className="card mb-6" style={{ padding: '14px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>📅 Date:</span>
                  <input
                    type="date"
                    className="form-input"
                    style={{ width: 180 }}
                    value={selDate}
                    onChange={e => setSelDate(e.target.value)}
                  />
                  <button
                    className="btn btn-neutral btn-sm"
                    onClick={() => setSelDate(today)}>
                    Today
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={loadOverview}>
                    🔄 Refresh
                  </button>
                </div>
              </div>

              {/* summary cards */}
              <div className="grid-4 mb-6">
                <StatCard icon="🎒" label="Total Students"
                  value={summary?.total_students ?? '—'}
                  color="#0176d3" bg="#e8f4fd" />
                <StatCard icon="✅" label="Present"
                  value={summary?.present ?? '—'}
                  color="#2e844a" bg="#eaf5ea" />
                <StatCard icon="❌" label="Absent"
                  value={summary?.absent ?? '—'}
                  color="#ba0517" bg="#fef1ee" />
                <StatCard icon="🕐" label="Late"
                  value={summary?.late ?? '—'}
                  color="#dd7a01" bg="#fef5e4" />
              </div>

              {/* overall progress bar */}
              {summary && (
                <div className="card mb-6">
                  <div className="card-body" style={{ padding: '16px 20px' }}>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between',
                      alignItems: 'center', marginBottom: 10,
                    }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>
                        Overall Attendance — {selDate}
                      </span>
                      <div style={{ display: 'flex', gap: 20, fontSize: 13 }}>
                        <span>Present: <strong style={{ color: '#2e844a' }}>{summary.present}</strong></span>
                        <span>Absent: <strong style={{ color: '#ba0517' }}>{summary.absent}</strong></span>
                        <span>Not Marked: <strong style={{ color: '#dd7a01' }}>{summary.not_marked}</strong></span>
                        <strong style={{
                          fontSize: 16,
                          color: presentPct >= 75 ? '#2e844a' : '#ba0517',
                        }}>{presentPct}%</strong>
                      </div>
                    </div>
                    <div style={{ height: 12, background: '#f1f1f1', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{
                        width: `${presentPct}%`, height: '100%', borderRadius: 99,
                        background: presentPct >= 75 ? '#2e844a'
                          : presentPct >= 50 ? '#dd7a01' : '#ba0517',
                        transition: 'width 0.6s ease',
                      }} />
                    </div>
                  </div>
                </div>
              )}

              {/* class-wise table */}
              <div className="card">
                <div className="card-header" style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <h4>📚 Class-wise Attendance</h4>
                  <span className="badge badge-info">{classes.length} Classes</span>
                </div>
                <div className="table-container">
                  {loading ? (
                    <div style={{ padding: 40, textAlign: 'center', color: 'var(--neutral-5)' }}>
                      Loading...
                    </div>
                  ) : (
                    <table>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Class</th>
                          <th>Total</th>
                          <th>Present</th>
                          <th>Absent</th>
                          <th>Late</th>
                          <th>Not Marked</th>
                          <th>Attendance %</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {classes.map((c, i) => (
                          <React.Fragment key={c.class_id}>
                            <tr style={{
                              background: selClass?.class_id === c.class_id
                                ? '#f0f7ff' : 'transparent',
                            }}>
                              <td style={{ color: 'var(--neutral-5)', fontSize: 12 }}>{i + 1}</td>
                              <td>
                                <div style={{ fontWeight: 600, fontSize: 13 }}>{c.class_name}</div>
                                <div style={{ fontSize: 11, color: 'var(--neutral-5)' }}>
                                  Section {c.section}
                                </div>
                              </td>
                              <td>
                                <span style={{
                                  background: 'var(--blue-10)', color: 'var(--blue-80)',
                                  padding: '3px 10px', borderRadius: 100,
                                  fontSize: 12, fontWeight: 700,
                                }}>{c.total}</span>
                              </td>
                              <td style={{ color: '#2e844a', fontWeight: 700 }}>{c.present}</td>
                              <td style={{ color: '#ba0517', fontWeight: 700 }}>{c.absent}</td>
                              <td style={{ color: '#dd7a01', fontWeight: 700 }}>{c.late}</td>
                              <td style={{ color: 'var(--neutral-5)' }}>{c.not_marked}</td>
                              <td style={{ minWidth: 140 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <div style={{
                                    flex: 1, height: 8,
                                    background: '#f1f1f1', borderRadius: 99,
                                  }}>
                                    <div style={{
                                      width: `${c.present_pct}%`, height: '100%',
                                      borderRadius: 99,
                                      background: c.present_pct >= 75 ? '#2e844a'
                                        : c.present_pct >= 50 ? '#dd7a01' : '#ba0517',
                                      transition: 'width 0.4s',
                                    }} />
                                  </div>
                                  <span style={{
                                    fontSize: 11, fontWeight: 700, minWidth: 32,
                                    color: c.present_pct >= 75 ? '#2e844a'
                                      : c.present_pct >= 50 ? '#dd7a01' : '#ba0517',
                                  }}>{c.present_pct}%</span>
                                </div>
                              </td>
                              <td>
                                <button
                                  onClick={() =>
                                    setSelClass(
                                      selClass?.class_id === c.class_id ? null : c
                                    )
                                  }
                                  style={{
                                    background: selClass?.class_id === c.class_id
                                      ? '#0176d3' : '#e8f4fd',
                                    color: selClass?.class_id === c.class_id
                                      ? '#fff' : '#0176d3',
                                    border: 'none', borderRadius: 4,
                                    padding: '4px 12px', fontSize: 11,
                                    fontWeight: 700, cursor: 'pointer',
                                  }}>
                                  {selClass?.class_id === c.class_id ? '▲ Hide' : '▼ Details'}
                                </button>
                              </td>
                            </tr>

                            {/* ── student detail rows ── */}
                            {selClass?.class_id === c.class_id && (
                              <tr>
                                <td colSpan={9} style={{ padding: 0, background: '#f8faff' }}>
                                  <div style={{ padding: '16px 24px' }}>
                                    <div style={{
                                      fontSize: 12, fontWeight: 700,
                                      color: 'var(--neutral-6)', marginBottom: 10,
                                    }}>
                                      👥 {c.class_name} — Section {c.section} — Student Detail
                                    </div>
                                    <div style={{
                                      display: 'grid',
                                      gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                                      gap: 8,
                                    }}>
                                      {c.students.map(s => (
                                        <div key={s.student_id} style={{
                                          display: 'flex', alignItems: 'center',
                                          gap: 10, padding: '8px 12px',
                                          background: '#fff', borderRadius: 8,
                                          border: '1px solid #e2e8f0',
                                        }}>
                                          <div style={{
                                            width: 32, height: 32, borderRadius: '50%',
                                            display: 'flex', alignItems: 'center',
                                            justifyContent: 'center', fontWeight: 700,
                                            fontSize: 13, flexShrink: 0,
                                            background:
                                              s.status === 'PRESENT'    ? '#eaf5ea' :
                                              s.status === 'ABSENT'     ? '#fef1ee' :
                                              s.status === 'LATE'       ? '#fef5e4' : '#f1f1f1',
                                            color:
                                              s.status === 'PRESENT'    ? '#2e844a' :
                                              s.status === 'ABSENT'     ? '#ba0517' :
                                              s.status === 'LATE'       ? '#dd7a01' : '#999',
                                          }}>
                                            {s.status === 'PRESENT'    ? '✅' :
                                             s.status === 'ABSENT'     ? '❌' :
                                             s.status === 'LATE'       ? '🕐' : '—'}
                                          </div>
                                          <div style={{ flex: 1, overflow: 'hidden' }}>
                                            <div
                                              style={{
                                                fontSize: 12, fontWeight: 700,
                                                overflow: 'hidden', textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                color: '#0176d3', cursor: 'pointer'
                                              }}
                                              onClick={() => navigate(`/students/${s.student_id}`)}
                                              title="Click to view student profile"
                                            >
                                              {s.student_name}
                                            </div>
                                            <div style={{ fontSize: 10, color: 'var(--neutral-5)' }}>
                                              Roll: {s.roll_number || '—'}
                                            </div>
                                          </div>
                                          <span style={{
                                            fontSize: 10, fontWeight: 700, padding: '2px 6px',
                                            borderRadius: 4,
                                            background:
                                              s.status === 'PRESENT'    ? '#eaf5ea' :
                                              s.status === 'ABSENT'     ? '#fef1ee' :
                                              s.status === 'LATE'       ? '#fef5e4' : '#f1f1f1',
                                            color:
                                              s.status === 'PRESENT'    ? '#2e844a' :
                                              s.status === 'ABSENT'     ? '#ba0517' :
                                              s.status === 'LATE'       ? '#dd7a01' : '#999',
                                          }}>{s.status}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))}
                        {!classes.length && !loading && (
                          <tr>
                            <td colSpan={9}>
                              <div className="empty-state">
                                <div className="empty-state-icon">📋</div>
                                <p>Aaj ki attendance mark nahi hui</p>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </>
          )}

          {/* ══════════════ TAB: MARK ATTENDANCE ══════════════ */}
          {tab === 'mark' && (
            <div className="card">
              <div className="card-header">
                <h4>✏️ Attendance Mark Karo</h4>
              </div>
              <div className="card-body" style={{ padding: '20px 24px' }}>

                {/* class + date select */}
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
                  <div className="form-group" style={{ flex: 1, minWidth: 200 }}>
                    <label className="form-label">Class Select Karo *</label>
                    <select
                      className="form-select"
                      value={markClass}
                      onChange={e => {
                        setMarkClass(e.target.value);
                        loadMarkStudents(e.target.value);
                      }}>
                      <option value="">— Class Choose Karo —</option>
                      {classes.map(c => (
                        <option key={c.class_id} value={c.class_id}>
                          {c.class_name} — Section {c.section}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ flex: 1, minWidth: 200 }}>
                    <label className="form-label">Date *</label>
                    <input
                      type="date"
                      className="form-input"
                      value={markDate}
                      onChange={e => setMarkDate(e.target.value)}
                    />
                  </div>
                </div>

                {/* bulk mark buttons */}
                {markStudents.length > 0 && (
                  <>
                    <div style={{
                      display: 'flex', gap: 8, marginBottom: 16,
                      alignItems: 'center', flexWrap: 'wrap',
                    }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--neutral-6)' }}>
                        Sab ko mark karo:
                      </span>
                      {['PRESENT', 'ABSENT', 'LATE'].map(s => (
                        <button key={s}
                          onClick={() => markAll(s)}
                          style={{
                            padding: '6px 14px', borderRadius: 6, border: 'none',
                            cursor: 'pointer', fontSize: 12, fontWeight: 700,
                            background:
                              s === 'PRESENT' ? '#eaf5ea' :
                              s === 'ABSENT'  ? '#fef1ee' : '#fef5e4',
                            color:
                              s === 'PRESENT' ? '#2e844a' :
                              s === 'ABSENT'  ? '#ba0517' : '#dd7a01',
                          }}>
                          {s === 'PRESENT' ? '✅' : s === 'ABSENT' ? '❌' : '🕐'} All {s}
                        </button>
                      ))}
                      <span style={{
                        marginLeft: 'auto', fontSize: 12, color: 'var(--neutral-5)',
                      }}>
                        {markStudents.filter(s => s.status === 'PRESENT').length} Present /&nbsp;
                        {markStudents.filter(s => s.status === 'ABSENT').length} Absent /&nbsp;
                        {markStudents.filter(s => s.status === 'LATE').length} Late
                      </span>
                    </div>

                    {/* student list */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                      gap: 10, marginBottom: 24,
                    }}>
                      {markStudents.map(s => (
                        <div key={s.id} style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '10px 14px', borderRadius: 10,
                          border: `2px solid ${
                            s.status === 'PRESENT' ? '#a3d9a5' :
                            s.status === 'ABSENT'  ? '#f9c9c0' : '#fde8b0'
                          }`,
                          background:
                            s.status === 'PRESENT' ? '#f0fff4' :
                            s.status === 'ABSENT'  ? '#fff5f5' : '#fffbeb',
                          transition: 'all 0.15s',
                        }}>
                          {/* avatar */}
                          <div style={{
                            width: 36, height: 36, borderRadius: '50%',
                            background: 'var(--blue-10)', color: 'var(--blue-80)',
                            display: 'flex', alignItems: 'center',
                            justifyContent: 'center', fontWeight: 700,
                            fontSize: 13, flexShrink: 0,
                          }}>
                            {(s.name || s.student_name || '?').charAt(0).toUpperCase()}
                          </div>

                          {/* info */}
                          <div style={{ flex: 1 }}>
                            <div
                              style={{ fontSize: 13, fontWeight: 700, color: '#0176d3', cursor: 'pointer' }}
                              onClick={() => navigate(`/students/${s.id || s.student_id}`)}
                              title="Click to view student profile"
                            >
                              {s.name || s.student_name || 'Student'}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--neutral-5)' }}>
                              Roll: {s.roll_number || '—'}
                            </div>
                          </div>

                          {/* status buttons */}
                          <div style={{ display: 'flex', gap: 4 }}>
                            {[
                              { val: 'PRESENT', icon: '✅', color: '#2e844a', bg: '#eaf5ea' },
                              { val: 'ABSENT',  icon: '❌', color: '#ba0517', bg: '#fef1ee' },
                              { val: 'LATE',    icon: '🕐', color: '#dd7a01', bg: '#fef5e4' },
                            ].map(opt => (
                              <button key={opt.val}
                                onClick={() => toggleStatus(s.id, opt.val)}
                                title={opt.val}
                                style={{
                                  width: 30, height: 30, borderRadius: 6,
                                  border: `2px solid ${s.status === opt.val ? opt.color : '#e2e8f0'}`,
                                  background: s.status === opt.val ? opt.bg : '#fff',
                                  cursor: 'pointer', fontSize: 14,
                                  display: 'flex', alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'all 0.1s',
                                }}>
                                {opt.icon}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* submit */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        className="btn btn-primary"
                        onClick={submitAttendance}
                        disabled={saving}>
                        {saving ? 'Saving...' : `✅ Save Attendance (${markStudents.length} students)`}
                      </button>
                    </div>
                  </>
                )}

                {/* empty state */}
                {!markStudents.length && markClass && (
                  <div className="empty-state">
                    <div className="empty-state-icon">🎒</div>
                    <p>Is class mein koi student nahi hai</p>
                  </div>
                )}
                {!markClass && (
                  <div className="empty-state">
                    <div className="empty-state-icon">📋</div>
                    <p>Pehle upar se class select karo</p>
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
