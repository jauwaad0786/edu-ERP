import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer
} from 'recharts';

export default function StudentDashboard() {
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('ederp_theme') === 'dark');
  useEffect(() => { localStorage.setItem('ederp_theme', darkMode ? 'dark' : 'light'); }, [darkMode]);

  const [profile,      setProfile]      = useState(null);
  const [attendance,   setAttendance]   = useState(null);
  const [fees,         setFees]         = useState(null);
  const [marks,        setMarks]        = useState([]);
  const [tab,          setTab]          = useState('overview');
  const [exams,        setExams]        = useState([]);
  const [examModal,    setExamModal]    = useState(null);
  const [selectedExam, setSelectedExam] = useState('');
  const [holidays,     setHolidays]     = useState([]);
  const [notes,        setNotes]        = useState([]);
  const [libraryData,  setLibraryData]  = useState(null);
  const [downloading,  setDownloading]  = useState(false);

  useEffect(() => {
    api.get('/student/profile').then(r => setProfile(r.data)).catch(() => {});
    api.get('/student/attendance').then(r => setAttendance(r.data)).catch(() => {});
    api.get('/student/fees').then(r => setFees(r.data)).catch(() => {});
    api.get('/student/marks').then(r => setMarks(r.data)).catch(() => {});
    api.get('/principal/exams?status=PUBLISHED').then(r => setExams(r.data || [])).catch(() => {});
    api.get('/principal/holidays').then(r => setHolidays(r.data || [])).catch(() => {});
    api.get('/teacher/notes').then(r => setNotes(r.data || [])).catch(() => {});
    api.get('/student/library').then(r => setLibraryData(r.data)).catch(() => {});
  }, []);

  const fmt = n => n?.toLocaleString('en-IN') ?? '—';
  const today = new Date().toISOString().split('T')[0];

  const presentDays = attendance?.present || 28;
  const absentDays = attendance?.absent || 3;
  const lateDays = attendance?.late || 1;
  const totalDays = attendance?.total_days || (presentDays + absentDays + lateDays);
  const attendancePct = attendance?.percentage || (totalDays ? Math.round((presentDays / totalDays) * 100) : 92);

  const donutData = [
    { name: 'Present', value: Number(presentDays), color: '#10b981' },
    { name: 'Absent',  value: Number(absentDays),  color: '#ef4444' },
    { name: 'Late',    value: Number(lateDays),    color: '#f59e0b' },
  ];

  const TABS = [
    { key: 'overview',   icon: 'ti-smart-home',      label: 'Overview' },
    { key: 'attendance', icon: 'ti-clipboard-check', label: 'Attendance' },
    { key: 'marks',      icon: 'ti-award',           label: 'Report Card' },
    { key: 'fees',       icon: 'ti-receipt-2',       label: 'Fee Details' },
    { key: 'library',    icon: 'ti-books',           label: 'My Library' },
    { key: 'notes',      icon: 'ti-book-2',          label: 'Study Material' },
    { key: 'holidays',   icon: 'ti-calendar-event',  label: 'Holidays' },
  ];

  return (
    <div className={`app-shell${darkMode ? ' theme-dark' : ''}`}>
      <Sidebar darkMode={darkMode} />
      <div className="main-content">
        <Navbar title="Student Learning Hub" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />

        <div className="page-body" style={{ padding: '24px', background: darkMode ? '#0b0f19' : '#f8fafc' }}>

          {/* ══ 1. STUDENT STUDY HERO BANNER WITH LAMP & DESK ILLUSTRATION ══ */}
          <div style={{
            background: darkMode
              ? 'radial-gradient(circle at 85% 20%, rgba(99,102,241,0.3) 0%, transparent 60%), linear-gradient(135deg, #1e1b4b 0%, #312e81 45%, #0f172a 100%)'
              : 'radial-gradient(circle at 85% 20%, rgba(255,255,255,0.18) 0%, transparent 50%), linear-gradient(135deg, #312e81 0%, #4338ca 35%, #4f46e5 75%, #0284c7 100%)',
            borderRadius: '24px',
            border: darkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(255,255,255,0.25)',
            padding: '28px 34px',
            marginBottom: '24px',
            boxShadow: darkMode
              ? '0 12px 35px -5px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1)'
              : '0 15px 35px -5px rgba(79,70,229,0.35), inset 0 1px 0 rgba(255,255,255,0.3)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            position: 'relative',
            overflow: 'hidden',
            flexWrap: 'wrap',
            gap: '24px'
          }}>
            {/* Ambient Background Glows */}
            <div style={{
              position: 'absolute', top: '-50px', right: '280px', width: '220px', height: '220px',
              borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none', filter: 'blur(30px)'
            }} />
            <div style={{
              position: 'absolute', bottom: '-40px', left: '15%', width: '180px', height: '180px',
              borderRadius: '50%', background: 'rgba(129,140,248,0.2)', pointerEvents: 'none', filter: 'blur(40px)'
            }} />

            <div style={{ flex: 1, minWidth: '300px', zIndex: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                <span style={{
                  padding: '4px 12px', borderRadius: '20px',
                  background: 'rgba(255,255,255,0.2)',
                  color: '#ffffff', fontSize: '11.5px', fontWeight: 800,
                  letterSpacing: '0.05em', textTransform: 'uppercase',
                  backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.25)',
                  display: 'flex', alignItems: 'center', gap: '6px'
                }}>
                  <i className="ti ti-book" /> 📖 Learning Desk
                </span>
                <span style={{
                  padding: '4px 12px', borderRadius: '20px',
                  background: 'rgba(255,255,255,0.12)', color: '#e0e7ff',
                  fontSize: '11.5px', fontWeight: 700, backdropFilter: 'blur(6px)'
                }}>
                  {profile?.session || 'Session 2024–25'}
                </span>
              </div>

              <h1 style={{
                fontSize: '32px', fontWeight: 900, color: '#ffffff',
                margin: '0 0 8px', letterSpacing: '-0.02em',
                textShadow: '0 2px 10px rgba(0,0,0,0.2)'
              }}>
                Keep shining, {profile?.name || 'Student'}! 💡
              </h1>

              <p style={{
                fontSize: '14.5px', color: 'rgba(255,255,255,0.92)',
                margin: '0 0 16px', maxWidth: '540px', lineHeight: 1.5,
                fontWeight: 500
              }}>
                "Success is the sum of small efforts, repeated day in and day out." Track your attendance, exam schedules, and academic reports.
              </p>

              {/* Student Metadata Chips */}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
                <span style={{
                  fontSize: '12px', fontWeight: 700, padding: '5px 12px', borderRadius: '10px',
                  background: 'rgba(255,255,255,0.16)', color: '#ffffff',
                  backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.2)'
                }}>
                  🎟 Roll: <strong>{profile?.roll_number || '12'}</strong>
                </span>
                <span style={{
                  fontSize: '12px', fontWeight: 700, padding: '5px 12px', borderRadius: '10px',
                  background: 'rgba(255,255,255,0.16)', color: '#ffffff',
                  backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.2)'
                }}>
                  📋 Adm: <strong>{profile?.admission_no || profile?.admission_number || 'ADM-042'}</strong>
                </span>
                <span style={{
                  fontSize: '12px', fontWeight: 700, padding: '5px 12px', borderRadius: '10px',
                  background: 'rgba(255,255,255,0.16)', color: '#ffffff',
                  backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.2)'
                }}>
                  👨‍👩‍👦 Parent: <strong>{profile?.parent_name || profile?.father_name || 'Guardian'}</strong>
                </span>
              </div>

              {/* Quick Triggers */}
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  onClick={() => navigate('/admit-card')}
                  style={{
                    background: '#ffffff', color: '#3730a3', border: 'none',
                    borderRadius: '12px', padding: '11px 20px', fontSize: '13.5px',
                    fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                    boxShadow: '0 6px 18px rgba(0,0,0,0.15)', transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
                >
                  <i className="ti ti-ticket" style={{ color: '#4f46e5' }} /> Download Admit Card
                </button>
                <button
                  onClick={() => navigate('/result-card')}
                  style={{
                    background: 'rgba(255,255,255,0.16)',
                    color: '#ffffff',
                    border: '1.5px solid rgba(255,255,255,0.35)',
                    borderRadius: '12px', padding: '11px 20px', fontSize: '13.5px',
                    fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                    backdropFilter: 'blur(8px)', transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.28)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.16)'}
                >
                  <i className="ti ti-chart-bar" /> View Report Card
                </button>
              </div>
            </div>

            {/* Right Side: Framed 3D Student Studying with Lamp Art */}
            <div style={{
              width: '320px', height: '160px', borderRadius: '18px', overflow: 'hidden',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              background: 'rgba(255,255,255,0.12)',
              border: '1.5px solid rgba(255,255,255,0.25)',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
              padding: '6px',
              position: 'relative'
            }}>
              <img
                src="/assets/illustrations/student_hero.jpg"
                alt="Student studying with lamp"
                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '14px' }}
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
              <div style={{
                position: 'absolute', bottom: '12px', right: '14px',
                background: 'rgba(49,46,129,0.85)', color: '#ffffff',
                padding: '3px 8px', borderRadius: '6px', fontSize: '10.5px',
                fontWeight: 800, backdropFilter: 'blur(6px)', letterSpacing: '0.04em'
              }}>
                ⭐ STUDENT DESK
              </div>
            </div>
          </div>

          {/* ══ 2. 4 BENTO STAT CARDS ══ */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '16px', marginBottom: '22px'
          }}>
            {/* Card 1: Attendance */}
            <div style={{
              background: darkMode ? '#111827' : '#ffffff',
              border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
              borderRadius: '16px', padding: '18px 20px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
            }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#ecfdf5', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px' }}>
                <i className="ti ti-calendar-check" style={{ fontSize: '18px' }} />
              </div>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', letterSpacing: '0.04em' }}>
                ATTENDANCE RATE
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: attendancePct >= 75 ? '#10b981' : '#ef4444', margin: '4px 0 2px' }}>
                {attendancePct}%
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                {presentDays} of {totalDays} days attended
              </div>
              <div style={{ width: '100%', height: '6px', borderRadius: '3px', background: darkMode ? '#1e293b' : '#f1f5f9', marginTop: '10px', overflow: 'hidden' }}>
                <div style={{ width: `${attendancePct}%`, height: '100%', background: '#10b981', borderRadius: '3px' }} />
              </div>
            </div>

            {/* Card 2: Fees Paid */}
            <div style={{
              background: darkMode ? '#111827' : '#ffffff',
              border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
              borderRadius: '16px', padding: '18px 20px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
            }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px' }}>
                <i className="ti ti-currency-rupee" style={{ fontSize: '18px' }} />
              </div>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', letterSpacing: '0.04em' }}>
                FEES PAID
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#2563eb', margin: '4px 0 2px' }}>
                ₹{fmt(fees?.total_paid || 14500)}
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                Balance Due: <strong>₹{fmt(fees?.balance || 2000)}</strong>
              </div>
              <div style={{ marginTop: '10px' }}>
                <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#16a34a', background: '#f0fdf4', padding: '2px 8px', borderRadius: '6px' }}>
                  ✓ In Good Standing
                </span>
              </div>
            </div>

            {/* Card 3: Subjects */}
            <div style={{
              background: darkMode ? '#111827' : '#ffffff',
              border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
              borderRadius: '16px', padding: '18px 20px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
            }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#f3f0ff', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px' }}>
                <i className="ti ti-book" style={{ fontSize: '18px' }} />
              </div>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', letterSpacing: '0.04em' }}>
                ENROLLED SUBJECTS
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: darkMode ? '#ffffff' : '#0f172a', margin: '4px 0 2px' }}>
                {[...new Set(marks.map(m => m.subject_id))].length || 6}
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                Active curriculum courses
              </div>
              <div style={{ marginTop: '10px' }}>
                <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#8b5cf6', background: '#f3f0ff', padding: '2px 8px', borderRadius: '6px' }}>
                  6 Graded Exams
                </span>
              </div>
            </div>

            {/* Card 4: Study Notes */}
            <div style={{
              background: darkMode ? '#111827' : '#ffffff',
              border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
              borderRadius: '16px', padding: '18px 20px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
            }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#ecfeff', color: '#0891b2', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px' }}>
                <i className="ti ti-notes" style={{ fontSize: '18px' }} />
              </div>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', letterSpacing: '0.04em' }}>
                STUDY MATERIALS
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#0891b2', margin: '4px 0 2px' }}>
                {notes.length || 8}
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                PDFs &amp; Chapter notes uploaded
              </div>
              <div style={{ marginTop: '10px' }}>
                <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#0891b2', background: '#ecfeff', padding: '2px 8px', borderRadius: '6px' }}>
                  Ready to download
                </span>
              </div>
            </div>
          </div>

          {/* ══ 3. NAVIGATION TABS BAR ══ */}
          <div style={{
            display: 'flex', gap: '6px',
            borderBottom: `2px solid ${darkMode ? '#1f2937' : '#e2e8f0'}`,
            marginBottom: '20px', overflowX: 'auto'
          }}>
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '10px 18px', fontSize: '13px', fontWeight: 700,
                  color: tab === t.key ? '#2563eb' : (darkMode ? '#94a3b8' : '#64748b'),
                  borderBottom: tab === t.key ? '3px solid #2563eb' : '3px solid transparent',
                  marginBottom: '-2px', display: 'flex', alignItems: 'center', gap: '7px',
                  transition: 'all 0.15s ease', whiteSpace: 'nowrap'
                }}
              >
                <i className={`ti ${t.icon}`} style={{ fontSize: '16px' }} />
                {t.label}
              </button>
            ))}
          </div>

          {/* ══ TAB: OVERVIEW ══ */}
          {tab === 'overview' && (
            <>
              {/* Middle Grid: Performance & Attendance Donut */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '20px', marginBottom: '24px' }}>
                {/* Latest Scores */}
                <div style={{
                  background: darkMode ? '#111827' : '#ffffff',
                  border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
                  borderRadius: '18px', padding: '20px',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <i className="ti ti-award" style={{ color: '#2563eb' }} /> Subject Performance &amp; Grades
                    </h3>
                    <button onClick={() => setTab('marks')} style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                      Full Report →
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {(marks.length ? marks.slice(0, 5) : [
                      { subject_name: 'Mathematics', marks_obtained: 94, max_marks: 100, grade: 'A+' },
                      { subject_name: 'Physics', marks_obtained: 88, max_marks: 100, grade: 'A' },
                      { subject_name: 'Chemistry', marks_obtained: 85, max_marks: 100, grade: 'A' },
                      { subject_name: 'English Literature', marks_obtained: 90, max_marks: 100, grade: 'A+' },
                      { subject_name: 'Computer Science', marks_obtained: 98, max_marks: 100, grade: 'A+' },
                    ]).map((m, idx) => {
                      const pct = Math.round((m.marks_obtained / m.max_marks) * 100);
                      return (
                        <div key={idx} style={{
                          display: 'flex', alignItems: 'center', gap: '14px',
                          padding: '10px 14px', borderRadius: '12px',
                          background: darkMode ? '#1e293b' : '#f8fafc',
                          border: `1px solid ${darkMode ? '#334155' : '#f1f5f9'}`
                        }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '13px' }}>
                              <strong style={{ color: darkMode ? '#ffffff' : '#0f172a' }}>{m.subject_name}</strong>
                              <span style={{ color: '#94a3b8' }}>{m.marks_obtained} / {m.max_marks} ({pct}%)</span>
                            </div>
                            <div style={{ height: '6px', borderRadius: '3px', background: darkMode ? '#334155' : '#e2e8f0', overflow: 'hidden' }}>
                              <div style={{
                                width: `${pct}%`, height: '100%',
                                background: pct >= 90 ? '#10b981' : pct >= 75 ? '#3b82f6' : '#f59e0b',
                                borderRadius: '3px'
                              }} />
                            </div>
                          </div>
                          <span style={{
                            padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 900,
                            background: pct >= 80 ? '#ecfdf5' : '#eff6ff',
                            color: pct >= 80 ? '#10b981' : '#2563eb'
                          }}>
                            {m.grade}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Attendance Donut */}
                <div style={{
                  background: darkMode ? '#111827' : '#ffffff',
                  border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
                  borderRadius: '18px', padding: '20px',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
                  display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
                }}>
                  <div>
                    <h3 style={{ margin: '0 0 14px', fontSize: '16px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a' }}>
                      Attendance Journal
                    </h3>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ width: '120px', height: '120px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={donutData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={36} outerRadius={54}>
                              {donutData.map(entry => (
                                <Cell key={entry.name} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>

                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
                          <span style={{ color: darkMode ? '#cbd5e1' : '#475569', fontWeight: 600 }}>Present</span>
                          <strong style={{ marginLeft: 'auto', color: darkMode ? '#ffffff' : '#0f172a' }}>{presentDays} days</strong>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }} />
                          <span style={{ color: darkMode ? '#cbd5e1' : '#475569', fontWeight: 600 }}>Absent</span>
                          <strong style={{ marginLeft: 'auto', color: darkMode ? '#ffffff' : '#0f172a' }}>{absentDays} days</strong>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b' }} />
                          <span style={{ color: darkMode ? '#cbd5e1' : '#475569', fontWeight: 600 }}>Late</span>
                          <strong style={{ marginLeft: 'auto', color: darkMode ? '#ffffff' : '#0f172a' }}>{lateDays} days</strong>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{
                    marginTop: '16px', padding: '10px 14px', borderRadius: '10px',
                    background: darkMode ? '#1e293b' : '#ecfdf5',
                    color: '#10b981', fontSize: '12.5px', fontWeight: 700,
                    display: 'flex', alignItems: 'center', gap: '6px'
                  }}>
                    <i className="ti ti-circle-check" /> Awesome! You are above 75% attendance threshold.
                  </div>
                </div>
              </div>

              {/* Lower Row: Study Notes & Upcoming Holidays */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>
                {/* Notes Grid */}
                <div style={{
                  background: darkMode ? '#111827' : '#ffffff',
                  border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
                  borderRadius: '18px', padding: '20px',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <i className="ti ti-file-text" style={{ color: '#2563eb' }} /> Recent Study Material
                    </h4>
                    <button onClick={() => setTab('notes')} style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                      View All →
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {(notes.length ? notes.slice(0, 4) : [
                      { title: 'Chapter 4: Thermodynamics Notes', description: 'Complete formulas and solved numericals', uploaded_at: '2026-08-10' },
                      { title: 'Algebraic Polynomials Worksheet', description: 'Practice set for upcoming mid-term', uploaded_at: '2026-08-08' },
                      { title: 'Chemical Bonding Summary Sheet', description: 'Key concepts and Lewis structures', uploaded_at: '2026-08-05' },
                    ]).map((n, idx) => (
                      <div key={idx} style={{
                        display: 'flex', alignItems: 'center', gap: '12px',
                        padding: '10px 12px', borderRadius: '10px',
                        background: darkMode ? '#1e293b' : '#f8fafc',
                        border: `1px solid ${darkMode ? '#334155' : '#f1f5f9'}`
                      }}>
                        <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: '#fee2e2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>
                          <i className="ti ti-file-text" />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: darkMode ? '#ffffff' : '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {n.title}
                          </div>
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>{n.description}</div>
                        </div>
                        <button
                          onClick={() => setTab('notes')}
                          style={{
                            padding: '4px 10px', borderRadius: '6px', border: 'none',
                            background: '#2563eb', color: '#ffffff', fontSize: '11px', fontWeight: 700, cursor: 'pointer'
                          }}
                        >
                          Download
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Upcoming Holidays */}
                <div style={{
                  background: darkMode ? '#111827' : '#ffffff',
                  border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
                  borderRadius: '18px', padding: '20px',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <i className="ti ti-calendar-event" style={{ color: '#2563eb' }} /> Upcoming Holidays
                    </h4>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {(holidays.length ? holidays.slice(0, 4) : [
                      { title: 'Independence Day', date: '2026-08-15', holiday_type: 'National Holiday' },
                      { title: 'Raksha Bandhan', date: '2026-08-28', holiday_type: 'Festival' },
                      { title: "Teachers' Day", date: '2026-09-05', holiday_type: 'Special Event' },
                    ]).map((h, idx) => {
                      const d = new Date(h.date);
                      return (
                        <div key={idx} style={{
                          display: 'flex', alignItems: 'center', gap: '12px',
                          padding: '8px 0', borderBottom: `1px solid ${darkMode ? '#1f2937' : '#f1f5f9'}`
                        }}>
                          <div style={{
                            width: '38px', textAlign: 'center', borderRadius: '8px',
                            background: darkMode ? '#1e293b' : '#f1f5f9', padding: '4px 0'
                          }}>
                            <div style={{ fontSize: '9px', fontWeight: 800, color: '#3b82f6' }}>{d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}</div>
                            <div style={{ fontSize: '15px', fontWeight: 900, color: darkMode ? '#ffffff' : '#0f172a' }}>{d.getDate() || '15'}</div>
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: darkMode ? '#ffffff' : '#0f172a' }}>{h.title}</div>
                            <div style={{ fontSize: '11px', color: '#94a3b8' }}>{h.holiday_type}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ══ TAB: ATTENDANCE ══ */}
          {tab === 'attendance' && (
            <div className="card" style={{
              borderRadius: '16px',
              background: darkMode ? '#111827' : '#ffffff',
              border: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : '#e2e8f0'}`
            }}>
              <div className="card-header" style={{ padding: '16px 20px', borderBottom: `1px solid ${darkMode ? '#1f2937' : '#f1f5f9'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ margin: 0, fontSize: '15px', color: darkMode ? '#ffffff' : '#0f172a' }}>
                  Full Attendance Journal
                </h4>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <span className="badge badge-success">Present: {presentDays}</span>
                  <span className="badge badge-error">Absent: {absentDays}</span>
                  <span className="badge badge-info">{attendancePct}% Rate</span>
                </div>
              </div>
              <div className="table-container" style={{ border: 'none' }}>
                <table>
                  <thead><tr><th>#</th><th>Date</th><th>Status</th></tr></thead>
                  <tbody>
                    {(attendance?.records || []).map((r, i) => (
                      <tr key={r.id}>
                        <td style={{ color: '#94a3b8' }}>{i + 1}</td>
                        <td>{r.date}</td>
                        <td>
                          <span className={`badge ${
                            r.status === 'PRESENT' ? 'badge-success' :
                            r.status === 'LATE'    ? 'badge-warning' : 'badge-error'
                          }`}>{r.status}</span>
                        </td>
                      </tr>
                    ))}
                    {!attendance?.records?.length && (
                      <tr><td colSpan={3} style={{ textAlign: 'center', color: '#94a3b8', padding: '30px' }}>No attendance records yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ══ TAB: MARKS ══ */}
          {tab === 'marks' && (
            <div className="card" style={{
              borderRadius: '16px',
              background: darkMode ? '#111827' : '#ffffff',
              border: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : '#e2e8f0'}`
            }}>
              <div className="card-header" style={{ padding: '16px 20px', borderBottom: `1px solid ${darkMode ? '#1f2937' : '#f1f5f9'}` }}>
                <h4 style={{ margin: 0, fontSize: '15px', color: darkMode ? '#ffffff' : '#0f172a' }}>
                  Academic Performance &amp; Grades
                </h4>
              </div>
              <div className="table-container" style={{ border: 'none' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Subject</th><th>Exam Type</th><th>Marks Scored</th>
                      <th>Percentage</th><th>Grade</th><th>Outcome</th>
                    </tr>
                  </thead>
                  <tbody>
                    {marks.map(m => {
                      const pct = Math.round(m.marks_obtained / m.max_marks * 100);
                      return (
                        <tr key={m.id}>
                          <td style={{ fontWeight: 700 }}>{m.subject_name || `Subject ${m.subject_id}`}</td>
                          <td style={{ color: '#94a3b8' }}>{m.exam_type}</td>
                          <td style={{ fontWeight: 800 }}>{m.marks_obtained} / {m.max_marks}</td>
                          <td style={{ fontWeight: 700 }}>{pct}%</td>
                          <td><span className="badge badge-info">{m.grade}</span></td>
                          <td>
                            <span className={`badge ${pct >= 33 ? 'badge-success' : 'badge-error'}`}>
                              {pct >= 33 ? 'PASSED' : 'RETAKE'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {!marks.length && (
                      <tr><td colSpan={6} style={{ textAlign: 'center', color: '#94a3b8', padding: '30px' }}>No examination records found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ══ TAB: FEES ══ */}
          {tab === 'fees' && (
            <div className="card" style={{
              borderRadius: '16px',
              background: darkMode ? '#111827' : '#ffffff',
              border: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : '#e2e8f0'}`
            }}>
              <div className="card-header" style={{ padding: '16px 20px', borderBottom: `1px solid ${darkMode ? '#1f2937' : '#f1f5f9'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ margin: 0, fontSize: '15px', color: darkMode ? '#ffffff' : '#0f172a' }}>
                  Fee Ledger &amp; Invoices
                </h4>
                <div style={{ display: 'flex', gap: '14px', fontSize: '13px' }}>
                  <span style={{ fontWeight: 700, color: '#10b981' }}>Paid: ₹{fmt(fees?.total_paid)}</span>
                  <span style={{ fontWeight: 700, color: '#ef4444' }}>Due: ₹{fmt(fees?.balance)}</span>
                </div>
              </div>
              <div className="table-container" style={{ border: 'none' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Fee Category</th><th>Billing Month</th><th>Due Amount</th>
                      <th>Paid Amount</th><th>Payment Channel</th><th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(fees?.records || []).map(r => (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 700 }}>{r.fee_type}</td>
                        <td>{r.month}</td>
                        <td>₹{r.amount_due?.toLocaleString('en-IN')}</td>
                        <td style={{ color: '#10b981', fontWeight: 600 }}>₹{r.amount_paid?.toLocaleString('en-IN')}</td>
                        <td style={{ color: '#94a3b8' }}>{r.payment_mode || '—'}</td>
                        <td>
                          <span className={`badge ${
                            r.status === 'PAID'    ? 'badge-success' :
                            r.status === 'PARTIAL' ? 'badge-warning' : 'badge-error'
                          }`}>{r.status}</span>
                        </td>
                      </tr>
                    ))}
                    {!fees?.records?.length && (
                      <tr><td colSpan={6} style={{ textAlign: 'center', color: '#94a3b8', padding: '30px' }}>No fee transactions recorded</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ══ TAB: STUDY NOTES ══ */}
          {tab === 'notes' && (
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px'
            }}>
              {(notes.length ? notes : [
                { id: 1, title: 'Chapter 4: Thermodynamics Notes', description: 'Complete formulas and solved numericals', uploaded_at: '2026-08-10', file_name: 'notes.pdf' },
                { id: 2, title: 'Algebraic Polynomials Worksheet', description: 'Practice set for upcoming mid-term', uploaded_at: '2026-08-08', file_name: 'math.docx' },
                { id: 3, title: 'Chemical Bonding Summary Sheet', description: 'Key concepts and Lewis structures', uploaded_at: '2026-08-05', file_name: 'chem.pdf' },
                { id: 4, title: 'Computer Science Python Loops Guide', description: 'For loops, while loops, recursion with code samples', uploaded_at: '2026-08-02', file_name: 'python.pdf' },
              ]).map(n => (
                <div key={n.id} className="card" style={{
                  borderRadius: '16px',
                  background: darkMode ? '#111827' : '#ffffff',
                  border: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : '#e2e8f0'}`,
                  display: 'flex', flexDirection: 'column'
                }}>
                  <div className="card-body" style={{ padding: '18px', flex: 1 }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                      <div style={{
                        width: '42px', height: '42px', borderRadius: '10px',
                        background: 'rgba(239,68,68,0.1)', color: '#ef4444',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0
                      }}>
                        <i className="ti ti-file-text" />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: '14.5px', fontWeight: 700, color: darkMode ? '#ffffff' : '#0f172a',
                          marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                        }}>
                          {n.title}
                        </div>
                        {n.description && (
                          <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '6px', lineHeight: 1.4 }}>
                            {n.description}
                          </div>
                        )}
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          🕒 {new Date(n.uploaded_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{
                    padding: '10px 18px', borderTop: `1px solid ${darkMode ? '#1f2937' : '#f1f5f9'}`,
                    display: 'flex', gap: '8px', justifyContent: 'flex-end'
                  }}>
                    {n.file_url ? (
                      <a
                        href={n.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-primary btn-sm"
                        style={{ borderRadius: '8px', fontSize: '12px', fontWeight: 700, background: '#2563eb' }}
                      >
                        <i className="ti ti-download" /> Download
                      </a>
                    ) : (
                      <button
                        onClick={() => alert('Downloading file...')}
                        className="btn btn-primary btn-sm"
                        style={{ borderRadius: '8px', fontSize: '12px', fontWeight: 700, background: '#2563eb' }}
                      >
                        <i className="ti ti-download" /> Download
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ══ TAB: HOLIDAYS ══ */}
          {tab === 'holidays' && (
            <div className="card" style={{
              borderRadius: '16px', maxWidth: '700px',
              background: darkMode ? '#111827' : '#ffffff',
              border: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : '#e2e8f0'}`
            }}>
              <div className="card-header" style={{ padding: '16px 20px', borderBottom: `1px solid ${darkMode ? '#1f2937' : '#f1f5f9'}` }}>
                <h4 style={{ margin: 0, fontSize: '15px', color: darkMode ? '#ffffff' : '#0f172a' }}>
                  Institutional Holiday Calendar
                </h4>
              </div>
              <div>
                {(holidays.length ? holidays : [
                  { title: 'Independence Day', date: '2026-08-15', holiday_type: 'National Holiday' },
                  { title: 'Raksha Bandhan', date: '2026-08-28', holiday_type: 'Festival' },
                  { title: "Teachers' Day", date: '2026-09-05', holiday_type: 'Special Event' },
                ]).map((h, i) => {
                  const d = new Date(h.date);
                  const isToday = h.date === today;
                  return (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: '14px',
                      padding: '14px 20px', borderBottom: `1px solid ${darkMode ? '#1f2937' : '#f1f5f9'}`,
                      background: isToday ? (darkMode ? 'rgba(245,158,11,0.1)' : '#fffbeb') : 'transparent'
                    }}>
                      <div style={{
                        width: '42px', textAlign: 'center',
                        background: darkMode ? '#1e293b' : '#f1f5f9', borderRadius: '8px', padding: '4px 0'
                      }}>
                        <div style={{ fontSize: '9px', fontWeight: 800, color: '#3b82f6' }}>{d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}</div>
                        <div style={{ fontSize: '16px', fontWeight: 900, color: darkMode ? '#ffffff' : '#0f172a' }}>{d.getDate() || '15'}</div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '14px', color: darkMode ? '#ffffff' : '#0f172a' }}>
                          {h.title}
                        </div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{h.holiday_type}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ══ TAB: MY LIBRARY ══ */}
          {tab === 'library' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Library KPI Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                <div className="card" style={{
                  borderRadius: '16px', padding: '18px',
                  background: darkMode ? '#111827' : '#ffffff',
                  border: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : '#e2e8f0'}`,
                  display: 'flex', alignItems: 'center', gap: '14px'
                }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(99,102,241,0.12)', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>
                    <i className="ti ti-books" />
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>Active Loans</div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: darkMode ? '#fff' : '#0f172a' }}>
                      {libraryData?.active_loans?.length || 0}
                    </div>
                  </div>
                </div>

                <div className="card" style={{
                  borderRadius: '16px', padding: '18px',
                  background: darkMode ? '#111827' : '#ffffff',
                  border: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : '#e2e8f0'}`,
                  display: 'flex', alignItems: 'center', gap: '14px'
                }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(239,68,68,0.12)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>
                    <i className="ti ti-alert-triangle" />
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>Overdue Books</div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: (libraryData?.active_loans || []).filter(b => b.is_overdue).length > 0 ? '#ef4444' : '#10b981' }}>
                      {(libraryData?.active_loans || []).filter(b => b.is_overdue).length}
                    </div>
                  </div>
                </div>

                <div className="card" style={{
                  borderRadius: '16px', padding: '18px',
                  background: darkMode ? '#111827' : '#ffffff',
                  border: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : '#e2e8f0'}`,
                  display: 'flex', alignItems: 'center', gap: '14px'
                }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(245,158,11,0.12)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>
                    <i className="ti ti-cash" />
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>Outstanding Fines</div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: (libraryData?.member?.outstanding_fines || 0) > 0 ? '#ef4444' : '#10b981' }}>
                      ₹{libraryData?.member?.outstanding_fines || 0}
                    </div>
                  </div>
                </div>

                <div className="card" style={{
                  borderRadius: '16px', padding: '18px',
                  background: darkMode ? '#111827' : '#ffffff',
                  border: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : '#e2e8f0'}`,
                  display: 'flex', alignItems: 'center', gap: '14px'
                }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(16,185,129,0.12)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>
                    <i className="ti ti-receipt-refund" />
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>Library Card #</div>
                    <div style={{ fontSize: '15px', fontWeight: 800, color: darkMode ? '#fff' : '#0f172a' }}>
                      {libraryData?.member?.card_number || 'N/A'}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Active Loans Table ── */}
              <div className="card" style={{
                borderRadius: '16px',
                background: darkMode ? '#111827' : '#ffffff',
                border: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : '#e2e8f0'}`
              }}>
                <div className="card-header" style={{ padding: '16px 20px', borderBottom: `1px solid ${darkMode ? '#1f2937' : '#f1f5f9'}` }}>
                  <h4 style={{ margin: 0, fontSize: '15px', color: darkMode ? '#ffffff' : '#0f172a' }}>
                    📖 Currently Borrowed Books
                  </h4>
                </div>
                <div className="table-container" style={{ border: 'none' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Book Title</th><th>Author</th><th>Barcode</th>
                        <th>Issued Date</th><th>Due Date</th><th>Status / Fine</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(libraryData?.active_loans || []).map(b => (
                        <tr key={b.id}>
                          <td style={{ fontWeight: 700, color: darkMode ? '#fff' : '#0f172a' }}>{b.book_title}</td>
                          <td style={{ color: '#94a3b8' }}>{b.author || '—'}</td>
                          <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{b.barcode || '—'}</td>
                          <td>{b.issue_date}</td>
                          <td style={{ fontWeight: 600, color: b.is_overdue ? '#ef4444' : '#10b981' }}>{b.due_date}</td>
                          <td>
                            {b.is_overdue ? (
                              <span className="badge badge-error">
                                OVERDUE ({b.overdue_days}d) · Est. ₹{b.estimated_fine}
                              </span>
                            ) : (
                              <span className="badge badge-success">ON SCHEDULE</span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {!libraryData?.active_loans?.length && (
                        <tr><td colSpan={6} style={{ textAlign: 'center', color: '#94a3b8', padding: '30px' }}>No books currently borrowed</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ── Fines & Penalties Table ── */}
              <div className="card" style={{
                borderRadius: '16px',
                background: darkMode ? '#111827' : '#ffffff',
                border: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : '#e2e8f0'}`
              }}>
                <div className="card-header" style={{ padding: '16px 20px', borderBottom: `1px solid ${darkMode ? '#1f2937' : '#f1f5f9'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: 0, fontSize: '15px', color: darkMode ? '#ffffff' : '#0f172a' }}>
                    💰 Library Penalties &amp; Settlements
                  </h4>
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>Fines can be settled at Library Counter or Fee Management</span>
                </div>
                <div className="table-container" style={{ border: 'none' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Penalty Type</th><th>Book Title</th><th>Original Amount</th>
                        <th>Paid</th><th>Waived</th><th>Outstanding</th><th>Status</th><th>Receipt #</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(libraryData?.fines || []).map(f => (
                        <tr key={f.id}>
                          <td style={{ fontWeight: 700 }}>{f.reason}</td>
                          <td style={{ color: '#94a3b8' }}>{f.book_title || '—'}</td>
                          <td style={{ fontWeight: 700 }}>₹{f.amount}</td>
                          <td style={{ color: '#10b981', fontWeight: 600 }}>₹{f.amount_paid}</td>
                          <td style={{ color: '#8b5cf6', fontWeight: 600 }}>{f.waived_amount > 0 ? `₹${f.waived_amount}` : '—'}</td>
                          <td style={{ color: f.outstanding_amount > 0 ? '#ef4444' : '#10b981', fontWeight: 800 }}>₹{f.outstanding_amount}</td>
                          <td>
                            <span className={`badge ${
                              f.status === 'PAID' ? 'badge-success' :
                              f.status === 'WAIVED' ? 'badge-info' :
                              f.status === 'PARTIALLY_PAID' ? 'badge-warning' : 'badge-error'
                            }`}>
                              {f.status}
                            </span>
                          </td>
                          <td style={{ fontFamily: 'monospace', fontSize: '11px', color: '#64748b' }}>{f.receipt_no || '—'}</td>
                        </tr>
                      ))}
                      {!libraryData?.fines?.length && (
                        <tr><td colSpan={8} style={{ textAlign: 'center', color: '#94a3b8', padding: '30px' }}>No fines or penalties recorded</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ── Borrowing History & Reservations ── */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
                <div className="card" style={{
                  borderRadius: '16px',
                  background: darkMode ? '#111827' : '#ffffff',
                  border: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : '#e2e8f0'}`
                }}>
                  <div className="card-header" style={{ padding: '16px 20px', borderBottom: `1px solid ${darkMode ? '#1f2937' : '#f1f5f9'}` }}>
                    <h4 style={{ margin: 0, fontSize: '15px', color: darkMode ? '#ffffff' : '#0f172a' }}>
                      📜 Borrowing History
                    </h4>
                  </div>
                  <div className="table-container" style={{ border: 'none', maxHeight: '300px', overflowY: 'auto' }}>
                    <table>
                      <thead>
                        <tr><th>Book</th><th>Issue Date</th><th>Return Date</th><th>Status</th></tr>
                      </thead>
                      <tbody>
                        {(libraryData?.history || []).map(h => (
                          <tr key={h.id}>
                            <td style={{ fontWeight: 600 }}>{h.book_title}</td>
                            <td style={{ fontSize: '12px' }}>{h.issue_date}</td>
                            <td style={{ fontSize: '12px' }}>{h.return_date || '—'}</td>
                            <td><span className="badge badge-success">{h.status}</span></td>
                          </tr>
                        ))}
                        {!libraryData?.history?.length && (
                          <tr><td colSpan={4} style={{ textAlign: 'center', color: '#94a3b8', padding: '20px' }}>No return history yet</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="card" style={{
                  borderRadius: '16px',
                  background: darkMode ? '#111827' : '#ffffff',
                  border: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : '#e2e8f0'}`
                }}>
                  <div className="card-header" style={{ padding: '16px 20px', borderBottom: `1px solid ${darkMode ? '#1f2937' : '#f1f5f9'}` }}>
                    <h4 style={{ margin: 0, fontSize: '15px', color: darkMode ? '#ffffff' : '#0f172a' }}>
                      ⏳ Active Reservations
                    </h4>
                  </div>
                  <div className="table-container" style={{ border: 'none', maxHeight: '300px', overflowY: 'auto' }}>
                    <table>
                      <thead>
                        <tr><th>Book Title</th><th>Reserved Date</th><th>Queue Pos</th><th>Status</th></tr>
                      </thead>
                      <tbody>
                        {(libraryData?.reservations || []).map(r => (
                          <tr key={r.id}>
                            <td style={{ fontWeight: 600 }}>{r.book_title}</td>
                            <td style={{ fontSize: '12px' }}>{r.reserve_date}</td>
                            <td style={{ fontWeight: 700 }}>#{r.queue_position || 1}</td>
                            <td><span className="badge badge-warning">{r.status}</span></td>
                          </tr>
                        ))}
                        {!libraryData?.reservations?.length && (
                          <tr><td colSpan={4} style={{ textAlign: 'center', color: '#94a3b8', padding: '20px' }}>No active book reservations</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══ EXAM MODAL ══ */}
          {examModal && (
            <div
              style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999,
                backdropFilter: 'blur(6px)'
              }}
              onClick={e => e.target === e.currentTarget && setExamModal(null)}
            >
              <div style={{
                background: darkMode ? '#111827' : '#ffffff', borderRadius: '20px', padding: '28px',
                width: '100%', maxWidth: '420px',
                border: `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`,
                boxShadow: '0 20px 40px rgba(0,0,0,0.4)'
              }}>
                <h3 style={{ margin: '0 0 14px', fontSize: '18px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a' }}>
                  {examModal === 'admit' ? '🎟 Download Official Admit Card' : '📊 Download Official Result Card'}
                </h3>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: darkMode ? '#94a3b8' : '#64748b', display: 'block', marginBottom: '6px' }}>
                    Select Target Examination:
                  </label>
                  <select
                    style={{
                      width: '100%', padding: '10px 12px', borderRadius: '10px', fontSize: '13px',
                      background: darkMode ? '#0f172a' : '#ffffff',
                      borderColor: darkMode ? '#334155' : '#cbd5e1',
                      color: darkMode ? '#ffffff' : '#0f172a'
                    }}
                    value={selectedExam}
                    onChange={e => setSelectedExam(e.target.value)}
                  >
                    <option value="">-- Select Published Exam --</option>
                    {exams.map(ex => (
                      <option key={ex.id} value={ex.id}>{ex.exam_name}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
                  <button
                    onClick={() => setExamModal(null)}
                    style={{
                      padding: '10px 16px', borderRadius: '10px', border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
                      background: darkMode ? '#1e293b' : '#f8fafc',
                      color: darkMode ? '#ffffff' : '#334155', cursor: 'pointer', fontSize: '13px', fontWeight: 600
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    disabled={!selectedExam || downloading}
                    onClick={async () => {
                      if (!selectedExam || !profile) return;
                      setDownloading(true);
                      const tid = toast.loading('Generating official PDF...');
                      try {
                        const url = examModal === 'admit'
                          ? `/principal/admit-card/${profile.id}/${selectedExam}`
                          : `/principal/result-card/${profile.id}/${selectedExam}`;
                        const res = await api.get(url, { responseType: 'blob' });
                        const blob = new Blob([res.data], { type: 'application/pdf' });
                        const blobUrl = window.URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = blobUrl;
                        const exObj = exams.find(e => String(e.id) === String(selectedExam));
                        const exName = (exObj?.exam_name || 'Exam').replace(/\s+/g, '_');
                        const stdName = (profile?.name || 'Student').replace(/\s+/g, '_');
                        link.download = examModal === 'admit'
                          ? `AdmitCard_${stdName}_${exName}.pdf`
                          : `ResultCard_${stdName}_${exName}.pdf`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        window.URL.revokeObjectURL(blobUrl);
                        toast.success(examModal === 'admit' ? 'Admit Card downloaded!' : 'Result Card downloaded!', { id: tid });
                        setExamModal(null);
                      } catch (err) {
                        console.error('Failed to download exam PDF', err);
                        toast.error('Failed to generate PDF. Make sure marks/schedule are published.', { id: tid });
                      } finally {
                        setDownloading(false);
                      }
                    }}
                    style={{
                      padding: '10px 20px', borderRadius: '10px', border: 'none',
                      background: selectedExam && !downloading ? '#2563eb' : (darkMode ? '#334155' : '#94a3b8'),
                      color: '#ffffff', cursor: selectedExam && !downloading ? 'pointer' : 'default',
                      fontSize: '13px', fontWeight: 800
                    }}
                  >
                    {downloading ? '⏳ Generating...' : '📥 Download PDF'}
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
