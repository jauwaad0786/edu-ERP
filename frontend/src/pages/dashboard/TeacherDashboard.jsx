import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

export default function TeacherDashboard() {
  const { user } = useAuth();
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('ederp_theme') === 'dark');
  const [classes,       setClasses]       = useState([]);
  const [tab,           setTab]           = useState('attendance');
  const [selectedClass, setSelectedClass] = useState('');
  const [students,      setStudents]      = useState([]);
  const [attendance,    setAttendance]    = useState({});
  const [marksData,     setMarksData]     = useState([]);
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
  const [assignments, setAssignments] = useState([]); // [{class_id, class_name, subject_id, subject_name}]

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
            uniqClasses.push({ id: a.class_id, name: a.class_name, section: '' });
          }
        });
        setClasses(uniqClasses);
        if (uniqClasses.length) setSelectedClass(String(uniqClasses[0].id));
      })
      .catch(() => {});

    loadMyStatus();

    api.get('/principal/holidays?applies_to=TEACHER')
      .then(r => setHolidays(r.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedClass) return;
    const firstAssign = assignments.find(a => String(a.class_id) === String(selectedClass));
    if (firstAssign) setSelectedSubject(String(firstAssign.subject_id));
    setStudents([]);
    setAttendance({});
    setAlreadyMarked(false);

    api.get('/principal/students?class_id=' + selectedClass)
      .then(r => {
        const list = Array.isArray(r.data) ? r.data : (r.data.data || []);
        setStudents(list);
        const init = {};
        list.forEach(s => { init[String(s.id)] = 'PRESENT'; });

        api.get('/teacher/attendance/' + selectedClass + '?date=' + today)
          .then(att => {
            if (att.data && att.data.length > 0) {
              att.data.forEach(a => { init[String(a.student_id)] = a.status; });
              setAlreadyMarked(true);
            }
            setAttendance(init);
          })
          .catch(() => { setAttendance(init); });

        setMarksData(
          list.map(s => ({
            student_id:     s.id,
            name:           s.name,
            roll_number:    s.roll_number,
            marks_obtained: '',
            max_marks:      100,
          }))
        );
      })
      .catch(() => {});
  }, [selectedClass]);

  function toggle(studentId, status) {
    setAttendance(prev => ({
      ...prev,
      [String(studentId)]: status,
    }));
  }

  async function saveAttendance() {
    setSaving(true);
    try {
      const records = Object.entries(attendance).map(([id, st]) => ({
        student_id: parseInt(id),
        status: st
      }));
      await api.post('/teacher/attendance', {
        class_id: selectedClass,
        date:     today,
        records:  records,
      });
      toast.success('Attendance saved successfully! ✓');
      setAlreadyMarked(true);
    } catch(e) {
      toast.error('Error saving attendance');
    }
    setSaving(false);
  }

  async function saveMarks() {
    setSaving(true);
    try {
      const entries = marksData
        .filter(m => m.marks_obtained !== '')
        .map(m => ({
          student_id:     m.student_id,
          subject_id:     selectedSubject ? parseInt(selectedSubject) : 1,
          marks_obtained: parseFloat(m.marks_obtained),
          max_marks:      m.max_marks,
        }));

      if (!entries.length) {
        toast.error('Marks enter nahi kiye gaye');
        setSaving(false);
        return;
      }
      await api.post('/teacher/marks', { entries, exam_type: examType });
      toast.success(`${entries.length} students ke marks saved! ✓`);
    } catch(e) {
      toast.error('Error saving marks');
    }
    setSaving(false);
  }

  const presentCount = Object.values(attendance).filter(s => s === 'PRESENT').length;
  const absentCount  = Object.values(attendance).filter(s => s === 'ABSENT').length;
  const lateCount    = Object.values(attendance).filter(s => s === 'LATE').length;

  function getGpsLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Is browser me GPS support nahi hai'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        pos => resolve({
          latitude:  pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy:  pos.coords.accuracy,
        }),
        () => reject(new Error('Location permission denied ya GPS off hai')),
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
      toast.error((e.response && e.response.data && e.response.data.error) || e.message || 'Check-in fail ho gaya');
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
      toast.error((e.response && e.response.data && e.response.data.error) || e.message || 'Check-out fail ho gaya');
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
      toast.success('Regularization request bhej di gayi');
      setShowRegularize(false);
      setRegForm({ reason_type:'FORGOT_CHECKOUT', reason_text:'', requested_check_in:'', requested_check_out:'' });
    } catch(e) {
      toast.error((e.response && e.response.data && e.response.data.error) || 'Request fail ho gaya');
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

          {/* ══ 2. BENTO STAT CARDS ══ */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
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
                {classes.length || 4}
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                Active classroom periods
              </div>
              <div style={{ marginTop: '10px' }}>
                <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#2563eb', background: '#eff6ff', padding: '2px 8px', borderRadius: '6px' }}>
                  {classes.map(c => c.name).join(', ') || 'Class 9, 10'}
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
                {students.length || 38}
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                In active selected section
              </div>
              <div style={{ marginTop: '10px' }}>
                <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#16a34a', background: '#ecfdf5', padding: '2px 8px', borderRadius: '6px' }}>
                  {presentCount || students.length} Present Today
                </span>
              </div>
            </div>

            {/* Card 3: Today's Attendance Rate */}
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
                {alreadyMarked ? 'Synchronized with office' : 'Mark today’s roll call'}
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

          {/* ══ 3. ACTIVE CLASS SWITCHER BAR ══ */}
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
                width: '180px', fontSize: '13px', borderRadius: '8px', fontWeight: 700,
                background: darkMode ? '#1e293b' : '#ffffff',
                borderColor: darkMode ? '#334155' : '#cbd5e1',
                color: darkMode ? '#ffffff' : '#0f172a'
              }}
              value={selectedClass}
              onChange={e => setSelectedClass(e.target.value)}
            >
              {classes.map(c => (
                <option key={c.id} value={String(c.id)}>
                  {c.name} {c.section}
                </option>
              ))}
            </select>

            <span style={{
              fontSize: '12px', fontWeight: 700, padding: '4px 12px', borderRadius: '20px',
              background: students.length ? '#eff6ff' : '#fee2e2',
              color: students.length ? '#2563eb' : '#dc2626',
            }}>
              {students.length} Enrolled Students
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
                  {alreadyMarked && (
                    <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 700 }}>
                      ✓ Today's roll call already recorded in the system
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
                    className="btn btn-primary btn-sm"
                    style={{ borderRadius: '8px', fontSize: '12px', fontWeight: 800, background: '#2563eb' }}
                    onClick={saveAttendance}
                    disabled={saving || !students.length}
                  >
                    {saving ? 'Saving...' : 'Save Attendance'}
                  </button>
                </div>
              </div>

              {students.length === 0 ? (
                <div style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8' }}>
                  <i className="ti ti-users" style={{ fontSize: '36px', opacity: 0.5, display: 'block', marginBottom: '8px' }} />
                  <p>Is class mein koi student enrolled nahi hai</p>
                </div>
              ) : (
                <div className="table-container" style={{ border: 'none' }}>
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
                    className="btn btn-primary btn-sm"
                    style={{ borderRadius: '8px', fontSize: '12px', fontWeight: 800, background: '#2563eb' }}
                    onClick={saveMarks}
                    disabled={saving || !students.length}
                  >
                    {saving ? 'Saving...' : 'Save Marks'}
                  </button>
                </div>
              </div>

              {students.length === 0 ? (
                <div style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8' }}>
                  <p>Is class mein koi student enrolled nahi hai</p>
                </div>
              ) : (
                <div className="table-container" style={{ border: 'none' }}>
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

          {/* ══ TAB: STUDY NOTES UPLOAD ══ */}
          {tab === 'notes' && <NotesUpload selectedClass={selectedClass} darkMode={darkMode} />}

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
                  Koi holiday scheduled nahi hai abhi
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
    </div>
  );
}

function NotesUpload({ selectedClass, darkMode }) {
  const [form, setForm] = useState({ title: '', description: '' });
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) { toast.error('Please select a file to upload'); return; }
    setUploading(true);
    const fd = new FormData();
    fd.append('title',       form.title);
    fd.append('description', form.description);
    fd.append('class_id',    selectedClass);
    fd.append('file',        file);
    try {
      await api.post('/teacher/notes', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Study Note uploaded successfully! 📚');
      setForm({ title: '', description: '' });
      setFile(null);
    } catch(e) {
      toast.error('Upload failed. Please try again.');
    }
    setUploading(false);
  }

  return (
    <div className="card" style={{
      borderRadius: '16px', maxWidth: '640px',
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
          <div className="form-group" style={{ marginBottom: '14px' }}>
            <label className="form-label" style={{ color: darkMode ? '#cbd5e1' : '#334155', fontWeight: 700 }}>Note Title *</label>
            <input
              className="form-input"
              placeholder="e.g. Chapter 5 - Algebraic Expressions & Formulas"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              style={{
                borderRadius: '8px',
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
                borderRadius: '8px',
                background: darkMode ? '#0f172a' : '#ffffff',
                borderColor: darkMode ? '#334155' : '#cbd5e1',
                color: darkMode ? '#ffffff' : '#0f172a'
              }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label className="form-label" style={{ color: darkMode ? '#cbd5e1' : '#334155', fontWeight: 700 }}>Upload Document (PDF, DOC, PPT, Image)</label>
            <input
              type="file"
              accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.png,.jpg"
              onChange={e => setFile(e.target.files[0])}
              style={{ display: 'block', fontSize: '13px', color: darkMode ? '#94a3b8' : '#475569' }}
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
  );
}
