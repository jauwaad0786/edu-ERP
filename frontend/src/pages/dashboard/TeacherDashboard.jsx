import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import OneP360BotDrawer from '../../AI/components/OneP360BotDrawer';


export default function TeacherDashboard() {
  const { user } = useAuth();
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('ederp_theme') === 'dark');
  const [classes,       setClasses]       = useState([]);
  const [tab,           setTab]           = useState('attendance');
  const [selectedClass, setSelectedClass] = useState('');
  const [students,      setStudents]      = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [attendance,    setAttendance]    = useState({});
  const [marksData,     setMarksData]     = useState([]);
  const [loadingMarks,  setLoadingMarks]  = useState(false);
  const [subjects,      setSubjects]      = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [examType,      setExamType]      = useState('Mid Term');
  const [saving,        setSaving]        = useState(false);
  const [alreadyMarked, setAlreadyMarked] = useState(false);
  const [holidays,      setHolidays]      = useState([]);

  // GPS-based Staff Attendance
  const [myStatus,       setMyStatus]       = useState(null);
  const [gpsLoading,     setGpsLoading]     = useState(true);
  const [checkingIn,     setCheckingIn]     = useState(false);
  const [checkingOut,    setCheckingOut]    = useState(false);
  const [showRegularize, setShowRegularize] = useState(false);
  const [regForm,        setRegForm]        = useState({ reason_type:'FORGOT_CHECKOUT', reason_text:'', requested_check_in:'', requested_check_out:'' });
  const [regSaving,      setRegSaving]      = useState(false);

  const today = new Date().toISOString().split('T')[0];
  const [selectedDate,  setSelectedDate]  = useState(today);
  const [assignments, setAssignments] = useState([]); // [{class_id, class_name, subject_id, subject_name}]
  const [activeDelegations, setActiveDelegations] = useState([]);

  useEffect(() => {
    localStorage.setItem('ederp_theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    api.get('/principal/teacher/my-assignments')
      .then(r => {
        const data = r.data || [];
        setAssignments(data);
        const uniqClasses = [];
        const seen = {};
        data.forEach(a => {
          if (!seen[a.class_id]) {
            seen[a.class_id] = true;
            uniqClasses.push({
              id: a.class_id,
              name: a.class_name,
              section: a.section || '',
              is_delegated: Boolean(a.is_delegated),
              delegated_from: a.delegated_from_teacher_name
            });
          }
        });
        setClasses(uniqClasses);
        if (uniqClasses.length) setSelectedClass(String(uniqClasses[0].id));
      })
      .catch(() => {});

    api.get('/teacher/delegations/active')
      .then(r => {
        setActiveDelegations(r.data?.active_delegations || []);
      })
      .catch(() => {});

    loadMyStatus();

    api.get('/principal/holidays?applies_to=TEACHER')
      .then(r => setHolidays(r.data || []))
      .catch(() => {});
  }, []);

  // 1. Fetch Students and Attendance whenever selectedClass or selectedDate changes
  useEffect(() => {
    if (!selectedClass) {
      setStudents([]);
      setAttendance({});
      return;
    }
    const firstAssign = assignments.find(a => String(a.class_id) === String(selectedClass));
    if (firstAssign && !selectedSubject) {
      setSelectedSubject(String(firstAssign.subject_id));
    }
    setLoadingStudents(true);
    setAlreadyMarked(false);

    api.get('/principal/students?class_id=' + selectedClass)
      .then(r => {
        const list = Array.isArray(r.data) ? r.data : (r.data.data || []);
        setStudents(list);
        const init = {};
        list.forEach(s => { init[String(s.id)] = 'PRESENT'; });

        api.get('/teacher/attendance/' + selectedClass + '?date=' + selectedDate)
          .then(att => {
            if (att.data && att.data.length > 0) {
              att.data.forEach(a => { init[String(a.student_id)] = a.status; });
              setAlreadyMarked(true);
            }
            setAttendance(init);
          })
          .catch(() => { setAttendance(init); });
      })
      .catch(() => {
        setStudents([]);
        setAttendance({});
      })
      .finally(() => setLoadingStudents(false));
  }, [selectedClass, selectedDate]);

  // 2. Fetch Existing Marks whenever selectedClass, selectedSubject, examType, or students change
  useEffect(() => {
    if (!selectedClass || students.length === 0) {
      setMarksData([]);
      return;
    }
    setLoadingMarks(true);
    api.get(`/teacher/marks/${selectedClass}?exam_type=${encodeURIComponent(examType)}`)
      .then(r => {
        const existingList = Array.isArray(r.data) ? r.data : [];
        const subjId = selectedSubject ? parseInt(selectedSubject) : null;
        const marksMap = {};

        existingList.forEach(item => {
          const stId = item.student?.id;
          if (stId && Array.isArray(item.marks)) {
            const matched = subjId
              ? item.marks.find(m => m.subject_id === subjId)
              : item.marks[0];
            if (matched) {
              marksMap[stId] = matched;
            }
          }
        });

        setMarksData(
          students.map(s => {
            const saved = marksMap[s.id];
            return {
              student_id:     s.id,
              name:           s.name,
              roll_number:    s.roll_number,
              marks_obtained: saved && saved.marks_obtained !== undefined && saved.marks_obtained !== null ? String(saved.marks_obtained) : '',
              max_marks:      saved?.max_marks || 100,
            };
          })
        );
      })
      .catch(() => {
        setMarksData(
          students.map(s => ({
            student_id:     s.id,
            name:           s.name,
            roll_number:    s.roll_number,
            marks_obtained: '',
            max_marks:      100,
          }))
        );
      })
      .finally(() => setLoadingMarks(false));
  }, [selectedClass, selectedSubject, examType, students]);

  function toggle(studentId, status) {
    setAttendance(prev => ({
      ...prev,
      [String(studentId)]: status,
    }));
  }

  async function saveAttendance() {
    if (saving || !selectedClass || !students.length) return;
    setSaving(true);
    try {
      const records = Object.entries(attendance).map(([id, st]) => ({
        student_id: parseInt(id),
        status: st
      }));
      await api.post('/teacher/attendance', {
        class_id: parseInt(selectedClass),
        date:     selectedDate,
        records:  records,
      });
      toast.success(`Attendance saved for ${records.length} students on ${selectedDate}! ✓`);
      setAlreadyMarked(true);
    } catch(e) {
      toast.error((e.response && e.response.data && e.response.data.error) || 'Error saving attendance');
    } finally {
      setSaving(false);
    }
  }

  async function saveMarks() {
    if (saving || !selectedClass || !students.length) return;
    setSaving(true);
    try {
      const entries = [];
      for (const m of marksData) {
        if (m.marks_obtained !== '') {
          const val = parseFloat(m.marks_obtained);
          if (isNaN(val) || val < 0) {
            toast.error(`Invalid marks entered for ${m.name}`);
            setSaving(false);
            return;
          }
          if (val > m.max_marks) {
            toast.error(`Marks for ${m.name} (${val}) cannot exceed Max Marks (${m.max_marks})`);
            setSaving(false);
            return;
          }
          entries.push({
            student_id:     m.student_id,
            subject_id:     selectedSubject ? parseInt(selectedSubject) : 1,
            marks_obtained: val,
            max_marks:      m.max_marks,
          });
        }
      }

      if (!entries.length) {
        toast.error('Please enter student marks first');
        setSaving(false);
        return;
      }
      const res = await api.post('/teacher/marks', { entries, exam_type: examType });
      toast.success(res.data?.message || `${entries.length} students ke marks saved! ✓`);
    } catch(e) {
      toast.error((e.response && e.response.data && e.response.data.error) || 'Error saving marks');
    } finally {
      setSaving(false);
    }
  }

  const presentCount = Object.values(attendance).filter(s => s === 'PRESENT').length;
  const absentCount  = Object.values(attendance).filter(s => s === 'ABSENT').length;
  const lateCount    = Object.values(attendance).filter(s => s === 'LATE').length;

  function getGpsLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('GPS geolocation is not supported in this browser'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        pos => resolve({
          latitude:  pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy:  pos.coords.accuracy,
        }),
        () => reject(new Error('Location permission denied or GPS is disabled')),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }

  function loadMyStatus() {
    setGpsLoading(true);
    api.get('/staff-attendance/my-status')
      .then(r => setMyStatus(r.data))
      .catch(() => {})
      .finally(() => setGpsLoading(false));
  }

  async function doCheckIn() {
    setCheckingIn(true);
    try {
      const loc = await getGpsLocation();
      const r = await api.post('/staff-attendance/check-in', {
        latitude:  loc.latitude,
        longitude: loc.longitude,
        accuracy:  loc.accuracy,
        device:    navigator.userAgent,
      });
      setMyStatus(r.data);
      toast.success('Check-in successful! 📍');
    } catch(e) {
      toast.error((e.response && e.response.data && e.response.data.error) || e.message || 'Check-in failed');
    }
    setCheckingIn(false);
  }

  async function doCheckOut() {
    setCheckingOut(true);
    try {
      const loc = await getGpsLocation();
      const r = await api.post('/staff-attendance/check-out', {
        latitude:  loc.latitude,
        longitude: loc.longitude,
      });
      setMyStatus(r.data);
      toast.success('Check-out successful! 📍');
    } catch(e) {
      toast.error((e.response && e.response.data && e.response.data.error) || e.message || 'Check-out failed');
    }
    setCheckingOut(false);
  }

  async function submitRegularization() {
    setRegSaving(true);
    try {
      const payload = {
        date: today,
        reason_type: regForm.reason_type,
        reason_text: regForm.reason_text,
      };
      if (regForm.requested_check_in)  payload.requested_check_in  = today + 'T' + regForm.requested_check_in + ':00';
      if (regForm.requested_check_out) payload.requested_check_out = today + 'T' + regForm.requested_check_out + ':00';
      await api.post('/staff-attendance/regularization', payload);
      toast.success('Regularization request submitted successfully');
      setShowRegularize(false);
      setRegForm({ reason_type:'FORGOT_CHECKOUT', reason_text:'', requested_check_in:'', requested_check_out:'' });
    } catch(e) {
      toast.error((e.response && e.response.data && e.response.data.error) || 'Request failed');
    }
    setRegSaving(false);
  }

  const TABS = [
    { key: 'attendance', icon: 'ti-clipboard-check', label: 'Mark Attendance'    },
    { key: 'marks',      icon: 'ti-award',           label: 'Marks Entry'        },
    { key: 'notes',      icon: 'ti-file-upload',     label: 'Upload Notes'       },
    { key: 'my-att',     icon: 'ti-fingerprint',     label: 'My GPS Attendance'  },
    { key: 'holidays',   icon: 'ti-calendar',        label: 'Holidays'           },
  ];

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'GOOD MORNING' : hour < 17 ? 'GOOD AFTERNOON' : 'GOOD EVENING';

  return (
    <div className={`app-shell${darkMode ? ' theme-dark' : ''}`}>
      <Sidebar darkMode={darkMode} />
      <div className="main-content">
        <Navbar title="Teacher Classroom Hub" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />

        <div className="page-body" style={{ padding: '24px', background: darkMode ? '#0b0f19' : '#f8fafc' }}>

          {/* ══ 1. TEACHER CLASSROOM HERO BANNER WITH TEACHING ILLUSTRATION ══ */}
          <div style={{
            background: darkMode
              ? 'radial-gradient(circle at 85% 20%, rgba(16,185,129,0.25) 0%, transparent 60%), linear-gradient(135deg, #04251e 0%, #064e3b 45%, #0f172a 100%)'
              : 'radial-gradient(circle at 85% 20%, rgba(255,255,255,0.18) 0%, transparent 50%), linear-gradient(135deg, #06382e 0%, #046a55 35%, #059669 75%, #10b981 100%)',
            borderRadius: '24px',
            border: darkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(255,255,255,0.25)',
            padding: '28px 34px',
            marginBottom: '24px',
            boxShadow: darkMode
              ? '0 12px 35px -5px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1)'
              : '0 15px 35px -5px rgba(5,150,105,0.35), inset 0 1px 0 rgba(255,255,255,0.3)',
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
              borderRadius: '50%', background: 'rgba(52,211,153,0.15)', pointerEvents: 'none', filter: 'blur(40px)'
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
                  <i className="ti ti-school" /> 👨‍🏫 Teacher Portal
                </span>
                <span style={{
                  padding: '4px 12px', borderRadius: '20px',
                  background: 'rgba(255,255,255,0.12)', color: '#d1fae5',
                  fontSize: '11.5px', fontWeight: 700, backdropFilter: 'blur(6px)'
                }}>
                  School Session 2024–25
                </span>
              </div>

              <h1 style={{
                fontSize: '32px', fontWeight: 900, color: '#ffffff',
                margin: '0 0 8px', letterSpacing: '-0.02em',
                textShadow: '0 2px 10px rgba(0,0,0,0.2)'
              }}>
                {greeting}, {user?.name || 'Teacher'} 👋
              </h1>

              <p style={{
                fontSize: '14.5px', color: 'rgba(255,255,255,0.92)',
                margin: '0 0 16px', maxWidth: '540px', lineHeight: 1.5,
                fontWeight: 500
              }}>
                "Teaching is the art of assisting discovery." Inspiring young students and managing class attendance and report card marks every day.
              </p>

              {/* Subject Assignment Chips */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
                {assignments.length > 0 ? assignments.slice(0, 3).map((a, i) => (
                  <span key={i} style={{
                    fontSize: '12px', fontWeight: 700, padding: '5px 12px', borderRadius: '10px',
                    background: 'rgba(255,255,255,0.16)', color: '#ffffff',
                    backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.2)'
                  }}>
                    📚 {a.class_name} • {a.subject_name}
                  </span>
                )) : (
                  <span style={{
                    fontSize: '12px', fontWeight: 700, padding: '5px 12px', borderRadius: '10px',
                    background: 'rgba(255,255,255,0.16)', color: '#ffffff',
                    backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.2)'
                  }}>
                    📚 Class 10-A • Mathematics & Science
                  </span>
                )}
              </div>

              {/* Quick Actions */}
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => setTab('attendance')}
                  style={{
                    background: '#ffffff', color: '#064e3b', border: 'none',
                    borderRadius: '12px', padding: '11px 20px', fontSize: '13.5px',
                    fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                    boxShadow: '0 6px 18px rgba(0,0,0,0.15)', transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
                >
                  <i className="ti ti-clipboard-check" style={{ color: '#059669' }} /> Mark Attendance
                </button>
                <button
                  type="button"
                  onClick={() => setTab('marks')}
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
                  <i className="ti ti-award" /> Enter Exam Marks
                </button>
              </div>
            </div>

            {/* Right Side: Framed 3D Teacher Teaching Illustration */}
            <div style={{
              width: '320px', maxWidth: '100%', height: '160px', borderRadius: '18px', overflow: 'hidden',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              background: 'rgba(255,255,255,0.12)',
              border: '1.5px solid rgba(255,255,255,0.25)',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
              padding: '6px',
              position: 'relative'
            }}>
              <img
                src="/assets/illustrations/teacher_hero.jpg"
                alt="Teacher teaching in classroom"
                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '14px' }}
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
              <div style={{
                position: 'absolute', bottom: '12px', right: '14px',
                background: 'rgba(6,78,59,0.85)', color: '#ffffff',
                padding: '3px 8px', borderRadius: '6px', fontSize: '10.5px',
                fontWeight: 800, backdropFilter: 'blur(6px)', letterSpacing: '0.04em'
              }}>
                🎓 CLASSROOM STUDIO
              </div>
            </div>
          </div>

          {/* ══ TEMPORARY DELEGATION ALERT BANNER (If Substitute Duties Active) ══ */}
          {activeDelegations.length > 0 && (
            <div style={{
              background: darkMode
                ? 'linear-gradient(135deg, rgba(30, 58, 138, 0.35) 0%, rgba(15, 23, 42, 0.8) 100%)'
                : 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
              border: `2px solid ${darkMode ? '#3b82f6' : '#93c5fd'}`,
              borderRadius: '20px', padding: '20px 24px', marginBottom: '22px',
              boxShadow: '0 4px 20px rgba(59, 130, 246, 0.15)',
              position: 'relative', overflow: 'hidden'
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                  <div style={{
                    width: '44px', height: '44px', borderRadius: '12px',
                    background: '#2563eb', color: '#ffffff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '22px', flexShrink: 0, boxShadow: '0 4px 10px rgba(37, 99, 235, 0.35)'
                  }}>
                    <i className="ti ti-switch-horizontal" />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                      <span style={{
                        background: '#2563eb', color: '#ffffff',
                        fontSize: '11px', fontWeight: 800, padding: '2px 8px', borderRadius: '6px',
                        letterSpacing: '0.04em', textTransform: 'uppercase'
                      }}>
                        ⚡ Temporary Access Active
                      </span>
                      <span style={{
                        fontSize: '12px', fontWeight: 700,
                        color: darkMode ? '#93c5fd' : '#1d4ed8'
                      }}>
                        Substitute Teacher Duties Assigned by Principal
                      </span>
                    </div>
                    <p style={{ margin: '0 0 10px 0', fontSize: '13.5px', color: darkMode ? '#e2e8f0' : '#1e293b', lineHeight: 1.5 }}>
                      You have temporary operational access for classes of absent teacher(s). All attendance and marks entered are strictly attributed under your name. Your regular teacher role remains unchanged.
                    </p>

                    {/* Delegation cards list */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {activeDelegations.map(del => (
                        <div
                          key={del.id}
                          style={{
                            background: darkMode ? 'rgba(15, 23, 42, 0.6)' : '#ffffff',
                            border: `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : '#cbd5e1'}`,
                            borderRadius: '12px', padding: '12px 16px',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px'
                          }}
                        >
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: darkMode ? '#ffffff' : '#0f172a' }}>
                              Covering for: <span style={{ color: '#2563eb' }}>{del.source_teacher?.name}</span> ({del.reason})
                            </div>
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                              {(del.scopes || []).map((sc, i) => (
                                <span
                                  key={i}
                                  style={{
                                    fontSize: '11.5px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px',
                                    background: darkMode ? 'rgba(59, 130, 246, 0.2)' : '#e0e7ff',
                                    color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.3)'
                                  }}
                                >
                                  📚 {sc.class_name} {sc.section || ''} ({sc.subject_name || 'All Subjects'})
                                </span>
                              ))}
                            </div>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '11px', color: darkMode ? '#94a3b8' : '#64748b' }}>
                              Temporary window expires:
                            </div>
                            <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#f59e0b' }}>
                              🕒 {new Date(del.expires_at).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══ 2. BENTO STAT CARDS ══ */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px', marginBottom: '22px'
          }}>
            {/* Card 1: Active Classes */}
            <div style={{
              background: darkMode ? '#111827' : '#ffffff',
              border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
              borderRadius: '16px', padding: '18px 20px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
            }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px' }}>
                <i className="ti ti-school" style={{ fontSize: '18px' }} />
              </div>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', letterSpacing: '0.04em' }}>
                ASSIGNED CLASSES
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#2563eb', margin: '4px 0 2px' }}>
                {classes.length || 0}
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                Active classroom periods
              </div>
              <div style={{ marginTop: '10px' }}>
                <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#2563eb', background: '#eff6ff', padding: '2px 8px', borderRadius: '6px' }}>
                  {classes.map(c => c.name).join(', ') || 'None assigned'}
                </span>
              </div>
            </div>

            {/* Card 2: Enrolled Students */}
            <div style={{
              background: darkMode ? '#111827' : '#ffffff',
              border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
              borderRadius: '16px', padding: '18px 20px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
            }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#f3f0ff', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px' }}>
                <i className="ti ti-users" style={{ fontSize: '18px' }} />
              </div>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', letterSpacing: '0.04em' }}>
                STUDENTS IN CLASS
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#8b5cf6', margin: '4px 0 2px' }}>
                {loadingStudents ? '...' : students.length}
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                In active selected section
              </div>
              <div style={{ marginTop: '10px' }}>
                <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#16a34a', background: '#ecfdf5', padding: '2px 8px', borderRadius: '6px' }}>
                  {presentCount} Present on {selectedDate}
                </span>
              </div>
            </div>

            {/* Card 3: Selected Date's Attendance Rate */}
            <div style={{
              background: darkMode ? '#111827' : '#ffffff',
              border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
              borderRadius: '16px', padding: '18px 20px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
            }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#ecfdf5', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px' }}>
                <i className="ti ti-circle-check" style={{ fontSize: '18px' }} />
              </div>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', letterSpacing: '0.04em' }}>
                ATTENDANCE STATUS
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#10b981', margin: '4px 0 2px' }}>
                {alreadyMarked ? 'SAVED ✓' : 'PENDING'}
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                {alreadyMarked ? `Recorded for ${selectedDate}` : `Roll call for ${selectedDate}`}
              </div>
              <div style={{ marginTop: '10px' }}>
                <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#10b981', background: '#ecfdf5', padding: '2px 8px', borderRadius: '6px' }}>
                  {presentCount}P · {absentCount}A · {lateCount}L
                </span>
              </div>
            </div>

            {/* Card 4: GPS Attendance Duty */}
            <div style={{
              background: darkMode ? '#111827' : '#ffffff',
              border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
              borderRadius: '16px', padding: '18px 20px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
            }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#fffbeb', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px' }}>
                <i className="ti ti-fingerprint" style={{ fontSize: '18px' }} />
              </div>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', letterSpacing: '0.04em' }}>
                FACULTY GPS DUTY
              </div>
              <div style={{ fontSize: '24px', fontWeight: 900, color: myStatus?.check_in_time ? '#10b981' : '#d97706', margin: '4px 0 2px' }}>
                {myStatus?.check_in_time ? 'PUNCHED IN' : 'NOT PUNCHED'}
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                {myStatus?.check_in_time ? `In at ${new Date(myStatus.check_in_time).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}` : 'Punch in on campus'}
              </div>
              <div style={{ marginTop: '10px' }}>
                {!myStatus?.check_in_time ? (
                  <button
                    type="button"
                    onClick={doCheckIn}
                    disabled={checkingIn}
                    style={{
                      background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '6px',
                      padding: '3px 10px', fontSize: '11px', fontWeight: 800, cursor: 'pointer'
                    }}
                  >
                    {checkingIn ? '...' : '📍 Punch GPS In'}
                  </button>
                ) : (
                  <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#10b981', background: '#ecfdf5', padding: '2px 8px', borderRadius: '6px' }}>
                    ✓ Recorded
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ══ 3. ACTIVE CLASS SWITCHER & DATE BAR ══ */}
          <div style={{
            background: darkMode ? '#111827' : '#ffffff',
            borderRadius: '16px', padding: '14px 20px',
            border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
            marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="ti ti-school" style={{ color: '#2563eb', fontSize: '18px' }} />
              <label style={{ fontSize: '13px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a', margin: 0 }}>
                Active Classroom:
              </label>
            </div>

            <select
              className="form-select"
              style={{
                width: '200px', fontSize: '13px', borderRadius: '8px', fontWeight: 700,
                background: darkMode ? '#1e293b' : '#ffffff',
                borderColor: darkMode ? '#334155' : '#cbd5e1',
                color: darkMode ? '#ffffff' : '#0f172a'
              }}
              value={selectedClass}
              onChange={e => setSelectedClass(e.target.value)}
            >
              {classes.map(c => (
                <option key={c.id} value={String(c.id)}>
                  {c.name} {c.section} {c.is_delegated ? `⚡ [Temporary: covering for ${c.delegated_from || 'absent teacher'}]` : ''}
                </option>
              ))}
            </select>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="ti ti-calendar" style={{ color: '#059669', fontSize: '18px' }} />
              <label style={{ fontSize: '13px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a', margin: 0 }}>
                Date:
              </label>
            </div>

            <input
              type="date"
              className="form-input"
              style={{
                width: '150px', fontSize: '13px', borderRadius: '8px', fontWeight: 700,
                background: darkMode ? '#1e293b' : '#ffffff',
                borderColor: darkMode ? '#334155' : '#cbd5e1',
                color: darkMode ? '#ffffff' : '#0f172a'
              }}
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
            />

            <span style={{
              fontSize: '12px', fontWeight: 700, padding: '4px 12px', borderRadius: '20px',
              background: students.length ? '#eff6ff' : '#fee2e2',
              color: students.length ? '#2563eb' : '#dc2626',
            }}>
              {loadingStudents ? 'Loading roster...' : `${students.length} Enrolled Students`}
            </span>
          </div>

          {/* ══ 4. NAVIGATION TABS BAR ══ */}
          <div style={{
            display: 'flex', gap: '6px',
            borderBottom: `2px solid ${darkMode ? '#1f2937' : '#e2e8f0'}`,
            marginBottom: '20px', overflowX: 'auto'
          }}>
            {TABS.map(t => (
              <button
                key={t.key}
                type="button"
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

          {/* ══ TAB: ATTENDANCE ══ */}
          {tab === 'attendance' && (
            <div className="card" style={{
              borderRadius: '16px',
              background: darkMode ? '#111827' : '#ffffff',
              border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
              boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
            }}>
              <div className="card-header" style={{
                padding: '16px 20px', borderBottom: `1px solid ${darkMode ? '#1f2937' : '#f1f5f9'}`,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px'
              }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a' }}>
                    Mark Student Attendance
                  </h4>
                  {alreadyMarked ? (
                    <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 700 }}>
                      ✓ Roll call for {selectedDate} already recorded in the system
                    </span>
                  ) : (
                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>
                      Roll call for {selectedDate} pending
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ background: '#ecfdf5', color: '#10b981', padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 800 }}>
                    {presentCount} Present
                  </span>
                  <span style={{ background: '#fef2f2', color: '#ef4444', padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 800 }}>
                    {absentCount} Absent
                  </span>
                  {lateCount > 0 && (
                    <span style={{ background: '#fffbeb', color: '#d97706', padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 800 }}>
                      {lateCount} Late
                    </span>
                  )}

                  <button
                    type="button"
                    className="btn btn-neutral btn-sm"
                    style={{ borderRadius: '8px', fontSize: '12px', fontWeight: 700 }}
                    onClick={() => {
                      const all = {};
                      students.forEach(s => { all[String(s.id)] = 'PRESENT'; });
                      setAttendance(all);
                      toast.success('Marked all students present');
                    }}
                  >
                    All Present
                  </button>

                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    style={{ borderRadius: '8px', fontSize: '12px', fontWeight: 800, background: '#2563eb' }}
                    onClick={saveAttendance}
                    disabled={saving || !students.length || loadingStudents}
                  >
                    {saving ? 'Saving...' : 'Save Attendance'}
                  </button>
                </div>
              </div>

              {loadingStudents ? (
                <div style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8' }}>
                  <i className="ti ti-loader ti-spin" style={{ fontSize: '32px', display: 'block', marginBottom: '8px' }} />
                  <p>Loading classroom roster &amp; attendance...</p>
                </div>
              ) : students.length === 0 ? (
                <div style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8' }}>
                  <i className="ti ti-users" style={{ fontSize: '36px', opacity: 0.5, display: 'block', marginBottom: '8px' }} />
                  <p>No students enrolled in this class</p>
                </div>
              ) : (
                <div className="table-container" style={{ border: 'none', overflowX: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: 44, textAlign: 'center' }}>#</th>
                        <th style={{ width: 100 }}>Roll No</th>
                        <th>Student Name</th>
                        <th style={{ width: 280 }}>Attendance Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((s, i) => {
                        const status = attendance[String(s.id)] || 'PRESENT';
                        return (
                          <tr key={s.id}>
                            <td style={{ textAlign: 'center', color: darkMode ? '#94a3b8' : '#64748b', fontSize: '12px' }}>{i + 1}</td>
                            <td><span className="badge badge-neutral">{s.roll_number || '-'}</span></td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{
                                  width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                                  background: status === 'PRESENT' ? '#ecfdf5' : status === 'ABSENT' ? '#fef2f2' : '#fffbeb',
                                  color: status === 'PRESENT' ? '#10b981' : status === 'ABSENT' ? '#ef4444' : '#d97706',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: '12px', fontWeight: 800,
                                }}>
                                  {s.name?.charAt(0).toUpperCase()}
                                </div>
                                <span style={{ fontWeight: 700, color: darkMode ? '#ffffff' : '#0f172a' }}>{s.name}</span>
                              </div>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <button
                                  type="button"
                                  onClick={() => toggle(s.id, 'PRESENT')}
                                  style={{
                                    width: '36px', height: '36px', borderRadius: '8px',
                                    border: status === 'PRESENT' ? '2px solid #10b981' : '1px solid rgba(16,185,129,0.2)',
                                    background: status === 'PRESENT' ? '#10b981' : '#ecfdf5',
                                    color: status === 'PRESENT' ? '#fff' : '#10b981',
                                    cursor: 'pointer', fontSize: '13px', fontWeight: 900,
                                  }}
                                >P</button>
                                <button
                                  type="button"
                                  onClick={() => toggle(s.id, 'ABSENT')}
                                  style={{
                                    width: '36px', height: '36px', borderRadius: '8px',
                                    border: status === 'ABSENT' ? '2px solid #ef4444' : '1px solid rgba(239,68,68,0.2)',
                                    background: status === 'ABSENT' ? '#ef4444' : '#fef2f2',
                                    color: status === 'ABSENT' ? '#fff' : '#ef4444',
                                    cursor: 'pointer', fontSize: '13px', fontWeight: 900,
                                  }}
                                >A</button>
                                <button
                                  type="button"
                                  onClick={() => toggle(s.id, 'LATE')}
                                  style={{
                                    width: '36px', height: '36px', borderRadius: '8px',
                                    border: status === 'LATE' ? '2px solid #f59e0b' : '1px solid rgba(245,158,11,0.2)',
                                    background: status === 'LATE' ? '#f59e0b' : '#fffbeb',
                                    color: status === 'LATE' ? '#fff' : '#f59e0b',
                                    cursor: 'pointer', fontSize: '13px', fontWeight: 900,
                                  }}
                                >L</button>
                                <span style={{
                                  fontSize: '11px', fontWeight: 800, padding: '3px 10px', borderRadius: '20px',
                                  background: status === 'PRESENT' ? '#ecfdf5' : status === 'ABSENT' ? '#fef2f2' : '#fffbeb',
                                  color: status === 'PRESENT' ? '#10b981' : status === 'ABSENT' ? '#ef4444' : '#d97706',
                                  minWidth: '65px', textAlign: 'center',
                                }}>
                                  {status}
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ══ TAB: MARKS ENTRY ══ */}
          {tab === 'marks' && (
            <div className="card" style={{
              borderRadius: '16px',
              background: darkMode ? '#111827' : '#ffffff',
              border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
              boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
            }}>
              <div className="card-header" style={{
                padding: '16px 20px', borderBottom: `1px solid ${darkMode ? '#1f2937' : '#f1f5f9'}`,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px'
              }}>
                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a' }}>
                  Assessment Marks Entry
                </h4>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  {assignments.filter(a => String(a.class_id) === String(selectedClass)).length > 0 && (
                    <select
                      className="form-select"
                      style={{
                        width: '160px', fontSize: '12px', borderRadius: '8px', fontWeight: 700,
                        background: darkMode ? '#1e293b' : '#ffffff',
                        borderColor: darkMode ? '#334155' : '#cbd5e1',
                        color: darkMode ? '#ffffff' : '#0f172a'
                      }}
                      value={selectedSubject}
                      onChange={e => setSelectedSubject(e.target.value)}
                    >
                      {assignments
                        .filter(a => String(a.class_id) === String(selectedClass))
                        .map(a => (
                          <option key={a.subject_id} value={String(a.subject_id)}>{a.subject_name}</option>
                        ))}
                    </select>
                  )}
                  <select
                    className="form-select"
                    style={{
                      width: '150px', fontSize: '12px', borderRadius: '8px', fontWeight: 700,
                      background: darkMode ? '#1e293b' : '#ffffff',
                      borderColor: darkMode ? '#334155' : '#cbd5e1',
                      color: darkMode ? '#ffffff' : '#0f172a'
                    }}
                    value={examType}
                    onChange={e => setExamType(e.target.value)}
                  >
                    <option>Unit Test 1</option>
                    <option>Mid Term</option>
                    <option>Unit Test 2</option>
                    <option>Final Exam</option>
                    <option>Pre-Board</option>
                  </select>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    style={{ borderRadius: '8px', fontSize: '12px', fontWeight: 800, background: '#2563eb' }}
                    onClick={saveMarks}
                    disabled={saving || !students.length || loadingMarks}
                  >
                    {saving ? 'Saving...' : 'Save Marks'}
                  </button>
                </div>
              </div>

              {loadingMarks ? (
                <div style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8' }}>
                  <i className="ti ti-loader ti-spin" style={{ fontSize: '32px', display: 'block', marginBottom: '8px' }} />
                  <p>Loading assessment marks roster...</p>
                </div>
              ) : students.length === 0 ? (
                <div style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8' }}>
                  <p>No students enrolled in this class</p>
                </div>
              ) : (
                <div className="table-container" style={{ border: 'none', overflowX: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: 90 }}>Roll No</th>
                        <th>Student Name</th>
                        <th style={{ width: 150 }}>Marks Obtained</th>
                        <th style={{ width: 110 }}>Max Marks</th>
                        <th style={{ width: 80, textAlign: 'center' }}>%</th>
                        <th style={{ width: 70, textAlign: 'center' }}>Grade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {marksData.map((m, i) => {
                        const raw = parseFloat(m.marks_obtained);
                        const pct = (!isNaN(raw) && m.max_marks > 0) ? (raw / m.max_marks) * 100 : null;
                        const grade = pct !== null
                          ? pct >= 90 ? 'A+' : pct >= 80 ? 'A' : pct >= 70 ? 'B+'
                            : pct >= 60 ? 'B' : pct >= 50 ? 'C' : pct >= 33 ? 'D' : 'F'
                          : '';
                        const gradeBadge = pct !== null
                          ? pct >= 60 ? 'badge-success' : pct >= 33 ? 'badge-warning' : 'badge-error'
                          : '';

                        return (
                          <tr key={m.student_id}>
                            <td><span className="badge badge-neutral">{m.roll_number || '-'}</span></td>
                            <td>
                              <div style={{ fontWeight: 700, color: darkMode ? '#ffffff' : '#0f172a' }}>{m.name}</div>
                            </td>
                            <td>
                              <input
                                className="form-input"
                                type="number"
                                min="0"
                                max={m.max_marks}
                                value={m.marks_obtained}
                                placeholder="0"
                                style={{
                                  width: '100px', textAlign: 'center', fontWeight: 800, fontSize: '15px', borderRadius: '8px',
                                  background: darkMode ? '#0f172a' : '#ffffff',
                                  borderColor: darkMode ? '#334155' : '#cbd5e1',
                                  color: darkMode ? '#ffffff' : '#0f172a'
                                }}
                                onChange={e => {
                                  const val = e.target.value;
                                  setMarksData(d => d.map((x, j) => j === i ? { ...x, marks_obtained: val } : x));
                                }}
                              />
                            </td>
                            <td>
                              <input
                                className="form-input"
                                type="number"
                                min="1"
                                value={m.max_marks}
                                style={{
                                  width: '70px', textAlign: 'center', borderRadius: '8px', fontWeight: 600,
                                  background: darkMode ? '#0f172a' : '#ffffff',
                                  borderColor: darkMode ? '#334155' : '#cbd5e1',
                                  color: darkMode ? '#ffffff' : '#0f172a'
                                }}
                                onChange={e => {
                                  const val = e.target.value;
                                  setMarksData(d => d.map((x, j) => j === i ? { ...x, max_marks: parseInt(val) || 100 } : x));
                                }}
                              />
                            </td>
                            <td style={{ textAlign: 'center', fontWeight: 800, color: pct === null ? '#94a3b8' : pct >= 33 ? '#10b981' : '#ef4444' }}>
                              {pct !== null ? `${pct.toFixed(1)}%` : '-'}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              {grade && <span className={'badge ' + gradeBadge}>{grade}</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ══ TAB: STUDY NOTES UPLOAD & LIBRARY ══ */}
          {tab === 'notes' && (
            <NotesUpload
              selectedClass={selectedClass}
              classes={classes}
              assignments={assignments}
              darkMode={darkMode}
            />
          )}

          {/* ══ TAB: MY GPS ATTENDANCE ══ */}
          {tab === 'my-att' && (
            <div style={{ maxWidth: '600px' }}>
              <div className="card" style={{
                borderRadius: '16px',
                background: darkMode ? '#111827' : '#ffffff',
                border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
                boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
              }}>
                <div className="card-header" style={{ padding: '16px 20px', borderBottom: `1px solid ${darkMode ? '#1f2937' : '#f1f5f9'}` }}>
                  <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a' }}>
                    My GPS Staff Attendance
                  </h4>
                </div>
                <div style={{ padding: '20px' }}>
                  {gpsLoading ? (
                    <div style={{ textAlign: 'center', color: '#94a3b8', padding: '30px 0' }}>Loading GPS Status...</div>
                  ) : (
                    <>
                      {myStatus && (
                        <div style={{
                          background: myStatus.approval_status === 'APPROVED' ? '#ecfdf5'
                            : myStatus.approval_status === 'REJECTED' ? '#fef2f2' : '#fffbeb',
                          borderRadius: '12px', padding: '14px 18px', marginBottom: '18px',
                          border: `1px solid ${myStatus.approval_status === 'APPROVED' ? '#bbf7d0' : '#fde68a'}`
                        }}>
                          <div style={{ fontWeight: 800, fontSize: '14px', color: myStatus.approval_status === 'APPROVED' ? '#10b981' : '#d97706' }}>
                            {myStatus.approval_status === 'APPROVED' ? '✓ Attendance Approved'
                              : myStatus.approval_status === 'REJECTED' ? '✗ Attendance Rejected'
                              : myStatus.approval_status === 'NOT_REQUIRED' ? '✓ Attendance Recorded'
                              : '⏳ Approval Pending'}
                          </div>
                          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                            Status: <strong>{myStatus.status}</strong>
                            {myStatus.gps_status ? ` · GPS: ${myStatus.gps_status.replace('_',' ')}` : ''}
                          </div>
                        </div>
                      )}

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '18px' }}>
                        <div style={{ background: darkMode ? '#1e293b' : '#f8fafc', borderRadius: '12px', padding: '12px 16px', border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}` }}>
                          <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Check In</div>
                          <div style={{ fontSize: '18px', fontWeight: 900, color: darkMode ? '#ffffff' : '#0f172a', marginTop: '4px' }}>
                            {myStatus && myStatus.check_in_time
                              ? new Date(myStatus.check_in_time).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })
                              : '—'}
                          </div>
                        </div>
                        <div style={{ background: darkMode ? '#1e293b' : '#f8fafc', borderRadius: '12px', padding: '12px 16px', border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}` }}>
                          <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Check Out</div>
                          <div style={{ fontSize: '18px', fontWeight: 900, color: darkMode ? '#ffffff' : '#0f172a', marginTop: '4px' }}>
                            {myStatus && myStatus.check_out_time
                              ? new Date(myStatus.check_out_time).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })
                              : '—'}
                          </div>
                        </div>
                      </div>

                      {!myStatus || !myStatus.check_in_time ? (
                        <button
                          type="button"
                          onClick={doCheckIn}
                          disabled={checkingIn}
                          style={{
                            width: '100%', padding: '14px', borderRadius: '10px', border: 'none',
                            background: '#10b981', color: '#fff', cursor: 'pointer',
                            fontSize: '15px', fontWeight: 800, boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)'
                          }}
                        >
                          {checkingIn ? 'Locating GPS...' : '📍 Punch GPS Check In'}
                        </button>
                      ) : !myStatus.check_out_time ? (
                        <button
                          type="button"
                          onClick={doCheckOut}
                          disabled={checkingOut}
                          style={{
                            width: '100%', padding: '14px', borderRadius: '10px', border: 'none',
                            background: '#ef4444', color: '#fff', cursor: 'pointer',
                            fontSize: '15px', fontWeight: 800, boxShadow: '0 4px 14px rgba(239, 68, 68, 0.3)'
                          }}
                        >
                          {checkingOut ? 'Locating GPS...' : '📍 Punch GPS Check Out'}
                        </button>
                      ) : (
                        <div style={{ textAlign: 'center', padding: '12px', borderRadius: '8px', background: '#ecfdf5', color: '#10b981', fontSize: '13px', fontWeight: 700 }}>
                          ✓ Today's duty hours recorded successfully
                        </div>
                      )}

                      {myStatus && (myStatus.status === 'MISSING_CHECKOUT' || myStatus.approval_status === 'REJECTED') && !showRegularize && (
                        <button
                          type="button"
                          onClick={() => setShowRegularize(true)}
                          style={{
                            width: '100%', padding: '10px', borderRadius: '8px', marginTop: '12px',
                            border: `1px solid ${darkMode ? '#334155' : '#cbd5e1'}`,
                            background: darkMode ? '#1e293b' : '#ffffff',
                            color: darkMode ? '#ffffff' : '#334155', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                          }}
                        >
                          Submit Regularization Request
                        </button>
                      )}

                      {showRegularize && (
                        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: `1px solid ${darkMode ? '#1f2937' : '#e2e8f0'}` }}>
                          <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '8px', color: darkMode ? '#ffffff' : '#0f172a' }}>
                            Regularization Request
                          </div>
                          <select
                            className="form-select"
                            style={{
                              marginBottom: '10px', width: '100%', borderRadius: '8px',
                              background: darkMode ? '#0f172a' : '#ffffff',
                              borderColor: darkMode ? '#334155' : '#cbd5e1',
                              color: darkMode ? '#ffffff' : '#0f172a'
                            }}
                            value={regForm.reason_type}
                            onChange={e => setRegForm(f => ({ ...f, reason_type: e.target.value }))}
                          >
                            <option value="FORGOT_CHECKOUT">Forgot Checkout</option>
                            <option value="LATE_CHECK_IN">Late Check In</option>
                            <option value="WRONG_ATTENDANCE">Wrong Attendance</option>
                            <option value="MEDICAL">Medical Reason</option>
                            <option value="NETWORK_ISSUE">Network Issue</option>
                            <option value="GPS_ISSUE">GPS Issue</option>
                            <option value="OTHER">Other</option>
                          </select>
                          <textarea
                            className="form-textarea"
                            rows={2}
                            placeholder="Reason for attendance regularization..."
                            style={{
                              width: '100%', marginBottom: '10px', borderRadius: '8px',
                              background: darkMode ? '#0f172a' : '#ffffff',
                              borderColor: darkMode ? '#334155' : '#cbd5e1',
                              color: darkMode ? '#ffffff' : '#0f172a'
                            }}
                            value={regForm.reason_text}
                            onChange={e => setRegForm(f => ({ ...f, reason_text: e.target.value }))}
                          />
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              type="button"
                              onClick={submitRegularization}
                              disabled={regSaving}
                              style={{
                                flex: 1, padding: '10px', borderRadius: '8px', border: 'none',
                                background: '#2563eb', color: '#fff', fontSize: '13px', fontWeight: 800, cursor: 'pointer'
                              }}
                            >
                              {regSaving ? 'Submitting...' : 'Submit Request'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowRegularize(false)}
                              style={{
                                padding: '10px 16px', borderRadius: '8px',
                                border: `1px solid ${darkMode ? '#334155' : '#cbd5e1'}`,
                                background: darkMode ? '#1e293b' : '#ffffff',
                                color: darkMode ? '#ffffff' : '#334155', cursor: 'pointer', fontSize: '13px', fontWeight: 600
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ══ TAB: HOLIDAYS ══ */}
          {tab === 'holidays' && (
            <div className="card" style={{
              borderRadius: '16px', maxWidth: '700px',
              background: darkMode ? '#111827' : '#ffffff',
              border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`
            }}>
              <div className="card-header" style={{ padding: '16px 20px', borderBottom: `1px solid ${darkMode ? '#1f2937' : '#f1f5f9'}` }}>
                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a' }}>
                  Institutional Holidays Calendar
                </h4>
              </div>
              {holidays.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                  No holidays scheduled at this time
                </div>
              ) : (
                <div>
                  {holidays.map((h, i) => {
                    const d = new Date(h.date);
                    const isToday = h.date === today;
                    return (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: '14px',
                        padding: '14px 20px', borderBottom: `1px solid ${darkMode ? '#1f2937' : '#f1f5f9'}`,
                        background: isToday ? '#fffbeb' : 'transparent',
                      }}>
                        <div style={{
                          width: '42px', textAlign: 'center',
                          background: darkMode ? '#1e293b' : '#f1f5f9', borderRadius: '8px', padding: '4px 0'
                        }}>
                          <div style={{ fontSize: '9px', fontWeight: 800, color: '#3b82f6' }}>{d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}</div>
                          <div style={{ fontSize: '16px', fontWeight: 900, color: darkMode ? '#ffffff' : '#0f172a' }}>{d.getDate()}</div>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 800, fontSize: '14px', color: darkMode ? '#ffffff' : '#0f172a' }}>
                            {h.title}
                            {isToday && (
                              <span style={{ marginLeft: '8px', fontSize: '10px', fontWeight: 800, background: '#f59e0b', color: '#ffffff', padding: '2px 8px', borderRadius: '12px' }}>
                                TODAY
                              </span>
                            )}
                          </div>
                          {h.description && (
                            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>{h.description}</div>
                          )}
                        </div>
                        <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', background: darkMode ? '#1e293b' : '#f1f5f9', color: darkMode ? '#cbd5e1' : '#64748b' }}>
                          {h.holiday_type?.replace('_', ' ')}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
      <OneP360BotDrawer />
    </div>
  );
}


function NotesUpload({ selectedClass, classes, assignments, darkMode }) {
  const [form, setForm] = useState({ title: '', description: '', subject_id: '' });
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [notes, setNotes] = useState([]);
  const [loadingNotes, setLoadingNotes] = useState(false);

  // Filter subjects for the selected class from assignments
  const classAssignments = (assignments || []).filter(a => String(a.class_id) === String(selectedClass));

  useEffect(() => {
    if (classAssignments.length > 0 && !form.subject_id) {
      setForm(f => ({ ...f, subject_id: String(classAssignments[0].subject_id) }));
    }
  }, [selectedClass, classAssignments]);

  const loadNotes = () => {
    if (!selectedClass) {
      setNotes([]);
      return;
    }
    setLoadingNotes(true);
    api.get('/teacher/notes?class_id=' + selectedClass)
      .then(r => setNotes(Array.isArray(r.data) ? r.data : []))
      .catch(() => setNotes([]))
      .finally(() => setLoadingNotes(false));
  };

  useEffect(() => {
    loadNotes();
  }, [selectedClass]);

  async function handleUpload(e) {
    e.preventDefault();
    if (!selectedClass) {
      toast.error('Please select an active classroom first');
      return;
    }
    if (!form.title.trim()) {
      toast.error('Please enter a note title');
      return;
    }
    if (!file) {
      toast.error('Please select a file to upload');
      return;
    }

    // Client-side file extension check
    const allowed = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'txt', 'png', 'jpg'];
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!allowed.includes(ext)) {
      toast.error(`Invalid file format .${ext}. Allowed: PDF, DOC, PPT, TXT, PNG, JPG`);
      return;
    }

    setUploading(true);
    const fd = new FormData();
    fd.append('title',       form.title.trim());
    fd.append('description', form.description.trim());
    fd.append('class_id',    selectedClass);
    if (form.subject_id) {
      fd.append('subject_id', form.subject_id);
    }
    fd.append('file', file);

    try {
      await api.post('/teacher/notes', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Study Note uploaded successfully! 📚');
      setForm(f => ({ ...f, title: '', description: '' }));
      setFile(null);
      const fileInput = document.getElementById('teacher-note-file-input');
      if (fileInput) fileInput.value = '';
      loadNotes();
    } catch(e) {
      toast.error((e.response && e.response.data && e.response.data.error) || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  const selectedClassName = (classes || []).find(c => String(c.id) === String(selectedClass))?.name || 'Class';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px', alignItems: 'start' }}>
      {/* Upload Card */}
      <div className="card" style={{
        borderRadius: '16px',
        background: darkMode ? '#111827' : '#ffffff',
        border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
        boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
      }}>
        <div className="card-header" style={{ padding: '16px 20px', borderBottom: `1px solid ${darkMode ? '#1f2937' : '#f1f5f9'}` }}>
          <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a' }}>
            Upload Course Material &amp; Notes
          </h4>
        </div>
        <div className="card-body" style={{ padding: '20px' }}>
          <form onSubmit={handleUpload}>
            {classAssignments.length > 0 && (
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label" style={{ color: darkMode ? '#cbd5e1' : '#334155', fontWeight: 700 }}>Subject *</label>
                <select
                  className="form-select"
                  value={form.subject_id}
                  onChange={e => setForm(f => ({ ...f, subject_id: e.target.value }))}
                  style={{
                    width: '100%', borderRadius: '8px',
                    background: darkMode ? '#0f172a' : '#ffffff',
                    borderColor: darkMode ? '#334155' : '#cbd5e1',
                    color: darkMode ? '#ffffff' : '#0f172a'
                  }}
                >
                  {classAssignments.map(a => (
                    <option key={a.subject_id} value={String(a.subject_id)}>
                      {a.subject_name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label className="form-label" style={{ color: darkMode ? '#cbd5e1' : '#334155', fontWeight: 700 }}>Note Title *</label>
              <input
                className="form-input"
                placeholder="e.g. Chapter 5 - Algebraic Expressions & Formulas"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                style={{
                  borderRadius: '8px', width: '100%',
                  background: darkMode ? '#0f172a' : '#ffffff',
                  borderColor: darkMode ? '#334155' : '#cbd5e1',
                  color: darkMode ? '#ffffff' : '#0f172a'
                }}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label className="form-label" style={{ color: darkMode ? '#cbd5e1' : '#334155', fontWeight: 700 }}>Description</label>
              <textarea
                className="form-textarea"
                rows={3}
                placeholder="Brief summary or instructions for students..."
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                style={{
                  borderRadius: '8px', width: '100%',
                  background: darkMode ? '#0f172a' : '#ffffff',
                  borderColor: darkMode ? '#334155' : '#cbd5e1',
                  color: darkMode ? '#ffffff' : '#0f172a'
                }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label className="form-label" style={{ color: darkMode ? '#cbd5e1' : '#334155', fontWeight: 700 }}>Upload Document (PDF, DOC, PPT, Image)</label>
              <input
                id="teacher-note-file-input"
                type="file"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.png,.jpg"
                onChange={e => setFile(e.target.files[0] || null)}
                style={{ display: 'block', fontSize: '13px', color: darkMode ? '#94a3b8' : '#475569', width: '100%' }}
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{
                borderRadius: '8px', padding: '10px 20px', fontSize: '13px', fontWeight: 800,
                background: '#2563eb', border: 'none', boxShadow: '0 4px 12px rgba(37,99,235,0.3)'
              }}
              disabled={uploading}
            >
              {uploading ? 'Uploading...' : 'Upload Note to Class'}
            </button>
          </form>
        </div>
      </div>

      {/* Uploaded Notes List Card */}
      <div className="card" style={{
        borderRadius: '16px',
        background: darkMode ? '#111827' : '#ffffff',
        border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
        boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
      }}>
        <div className="card-header" style={{
          padding: '16px 20px', borderBottom: `1px solid ${darkMode ? '#1f2937' : '#f1f5f9'}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div>
            <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a' }}>
              Notes for {selectedClassName}
            </h4>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>{notes.length} uploaded resources</span>
          </div>
          <button
            type="button"
            className="btn btn-neutral btn-sm"
            onClick={loadNotes}
            disabled={loadingNotes}
            style={{ borderRadius: '8px', fontSize: '12px' }}
          >
            <i className={`ti ti-refresh ${loadingNotes ? 'ti-spin' : ''}`} /> Refresh
          </button>
        </div>

        <div className="card-body" style={{ padding: '16px 20px' }}>
          {loadingNotes ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: '#94a3b8' }}>
              <i className="ti ti-loader ti-spin" style={{ fontSize: '28px', display: 'block', marginBottom: '8px' }} />
              Loading notes...
            </div>
          ) : notes.length === 0 ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: '#94a3b8' }}>
              <i className="ti ti-file-text" style={{ fontSize: '36px', opacity: 0.5, display: 'block', marginBottom: '8px' }} />
              <p>No study notes uploaded for this class yet</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {notes.map(n => {
                const ext = (n.file_name ? n.file_name.split('.').pop() : 'pdf').toLowerCase();
                const iconClass = ['pdf'].includes(ext) ? 'ti-file-type-pdf'
                  : ['doc', 'docx'].includes(ext) ? 'ti-file-type-doc'
                  : ['ppt', 'pptx'].includes(ext) ? 'ti-file-type-ppt'
                  : ['jpg', 'jpeg', 'png'].includes(ext) ? 'ti-photo'
                  : 'ti-file-text';
                const iconColor = ['pdf'].includes(ext) ? '#dc2626'
                  : ['doc', 'docx'].includes(ext) ? '#2563eb'
                  : ['ppt', 'pptx'].includes(ext) ? '#d97706'
                  : ['jpg', 'jpeg', 'png'].includes(ext) ? '#0891b2'
                  : '#475569';

                return (
                  <div
                    key={n.id}
                    style={{
                      border: `1px solid ${darkMode ? '#1f2937' : '#e2e8f0'}`,
                      borderRadius: '12px', padding: '14px',
                      background: darkMode ? '#0f172a' : '#f8fafc',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      gap: '12px', flexWrap: 'wrap'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '220px' }}>
                      <div style={{
                        width: '40px', height: '40px', borderRadius: '10px',
                        background: darkMode ? '#1e293b' : '#ffffff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: iconColor, fontSize: '20px', flexShrink: 0,
                        border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`
                      }}>
                        <i className={`ti ${iconClass}`} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '13.5px', color: darkMode ? '#ffffff' : '#0f172a' }}>
                          {n.title}
                        </div>
                        {n.description && (
                          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px', lineHeight: 1.3 }}>
                            {n.description}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px', flexWrap: 'wrap' }}>
                          {n.subject?.name && (
                            <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '1px 7px', borderRadius: '6px', background: '#eff6ff', color: '#2563eb' }}>
                              {n.subject.name}
                            </span>
                          )}
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                            {n.uploaded_at ? new Date(n.uploaded_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : ''}
                          </span>
                        </div>
                      </div>
                    </div>

                    {n.file_url && (
                      <a
                        href={n.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-neutral btn-sm"
                        style={{
                          borderRadius: '8px', fontSize: '12px', fontWeight: 700,
                          display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none'
                        }}
                      >
                        <i className="ti ti-external-link" /> View Note
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
