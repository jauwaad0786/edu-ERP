import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import OneP360BotDrawer from '../../AI/components/OneP360BotDrawer';


export default function TeacherDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const session = user?.school?.current_session || '2026-27';
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('ederp_theme') === 'dark');
  const [classes,       setClasses]       = useState([]);
  const [tab,           setTab]           = useState('schedule');
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

  // Live Today's Schedule & Diary State
  const [scheduleData, setScheduleData] = useState(null);
  const [loadingSchedule, setLoadingSchedule] = useState(false);

  // Syllabus Coverage State
  const [syllabusList, setSyllabusList] = useState([]);
  const [loadingSyllabus, setLoadingSyllabus] = useState(false);

  // Homework & Assignments State
  const [assignmentsList, setAssignmentsList] = useState([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);

  // Leaves & Quota State
  const [leavesData, setLeavesData] = useState(null);
  const [loadingLeaves, setLoadingLeaves] = useState(false);

  // Quick Diary Entry Modal State
  const [quickDiaryModal, setQuickDiaryModal] = useState({ open: false, period: null });
  const [modalChapters, setModalChapters] = useState([]);
  const [loadingModalChapters, setLoadingModalChapters] = useState(false);
  const [diaryForm, setDiaryForm] = useState({
    class_id: '',
    subject_id: '',
    period_no: 1,
    date: '',
    session: '2026-27',
    chapter_id: '',
    topic_id: '',
    subtopic_title: '',
    periods_spent: 1,
    topic_completion_status: 'COMPLETED',
    teaching_methodology: 'Interactive / Discussion',
    classwork_summary: '',
    has_homework: false,
    homework_title: '',
    homework_description: '',
    homework_due_date: ''
  });
  const [savingDiary, setSavingDiary] = useState(false);

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

  const loadSchedule = useCallback(() => {
    setLoadingSchedule(true);
    api.get(`/curriculum/teaching-diary/today?date=${selectedDate}&session=${session}`)
      .then(r => setScheduleData(r.data))
      .catch(() => setScheduleData(null))
      .finally(() => setLoadingSchedule(false));
  }, [selectedDate, session]);

  const loadSyllabus = useCallback(() => {
    setLoadingSyllabus(true);
    api.get(`/curriculum/analytics/summary?session=${session}`)
      .then(r => setSyllabusList(r.data?.subjects_breakdown || []))
      .catch(() => setSyllabusList([]))
      .finally(() => setLoadingSyllabus(false));
  }, [session]);

  const loadAssignments = useCallback(() => {
    setLoadingAssignments(true);
    api.get(`/academic/assignments?academic_year=${session}`)
      .then(r => setAssignmentsList(r.data?.assignments || []))
      .catch(() => setAssignmentsList([]))
      .finally(() => setLoadingAssignments(false));
  }, [session]);

  const loadLeaves = useCallback(() => {
    setLoadingLeaves(true);
    api.get('/hrms/my/leaves')
      .then(r => setLeavesData(r.data))
      .catch(() => setLeavesData(null))
      .finally(() => setLoadingLeaves(false));
  }, []);

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  useEffect(() => {
    loadSyllabus();
    loadAssignments();
    loadLeaves();
  }, [loadSyllabus, loadAssignments, loadLeaves]);

  const openQuickDiary = async (period) => {
    setQuickDiaryModal({ open: true, period });
    const existing = period.teaching_log;
    setDiaryForm({
      id: existing?.id || null,
      class_id: period.class_id,
      subject_id: period.subject_id,
      period_no: period.period_no,
      date: selectedDate,
      session: session,
      chapter_id: existing?.chapter_id || '',
      topic_id: existing?.topic_id || '',
      subtopic_title: existing?.subtopic_title || '',
      periods_spent: existing?.periods_spent || 1,
      topic_completion_status: existing?.topic_completion_status || 'COMPLETED',
      teaching_methodology: existing?.teaching_methodology || 'Interactive / Discussion',
      classwork_summary: existing?.classwork_summary || '',
      has_homework: Boolean(existing?.has_homework),
      homework_title: existing?.homework_title || '',
      homework_description: existing?.homework_description || '',
      homework_due_date: existing?.homework_due_date || ''
    });

    setLoadingModalChapters(true);
    try {
      const res = await api.get(`/curriculum?class_id=${period.class_id}&subject_id=${period.subject_id}&session=${session}`);
      const currs = Array.isArray(res.data) ? res.data : (res.data?.curriculums || []);
      if (currs.length > 0 && currs[0].chapters) {
        setModalChapters(currs[0].chapters);
      } else {
        setModalChapters([]);
      }
    } catch {
      setModalChapters([]);
    } finally {
      setLoadingModalChapters(false);
    }
  };

  const submitQuickDiary = async (e) => {
    e.preventDefault();
    if (!diaryForm.subtopic_title && !diaryForm.chapter_id) {
      toast.error('Please enter the topic title or chapter taught');
      return;
    }
    setSavingDiary(true);
    try {
      await api.post('/curriculum/teaching-diary/entry', diaryForm);
      toast.success(`Period ${diaryForm.period_no} teaching log recorded successfully! ✓`);
      setQuickDiaryModal({ open: false, period: null });
      loadSchedule();
      loadSyllabus();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save teaching diary entry');
    } finally {
      setSavingDiary(false);
    }
  };

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
    { key: 'schedule',   icon: 'ti-calendar-time',   label: "Today's Schedule & Diary", badge: scheduleData?.schedule?.length ? `${scheduleData.schedule.length}` : null },
    { key: 'attendance', icon: 'ti-clipboard-check', label: 'Mark Attendance'    },
    { key: 'syllabus',   icon: 'ti-chart-pie',       label: 'Syllabus Progress'  },
    { key: 'marks',      icon: 'ti-award',           label: 'Marks Entry'        },
    { key: 'homework',   icon: 'ti-clipboard-list',  label: 'Assignments & Homework', badge: assignmentsList?.length ? `${assignmentsList.length}` : null },
    { key: 'notes',      icon: 'ti-file-upload',     label: 'Upload Notes'       },
    { key: 'leaves',     icon: 'ti-calendar-off',    label: 'My Leaves & Quota'  },
    { key: 'my-att',     icon: 'ti-fingerprint',     label: 'My GPS Attendance'  },
    { key: 'holidays',   icon: 'ti-calendar',        label: 'Holidays'           },
  ];

  const avgSyllabusPct = syllabusList.length
    ? Math.round(syllabusList.reduce((acc, s) => acc + (s.coverage_pct || 0), 0) / syllabusList.length)
    : 0;
  const scheduledCount = scheduleData?.summary?.total_scheduled_periods || 0;
  const recordedCount = scheduleData?.summary?.recorded_periods || 0;
  const pendingDiaryCount = scheduleData?.summary?.pending_periods || 0;
  const substitutePeriods = (scheduleData?.schedule || []).filter(p => p.is_substituted);

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
                  Session {session}
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
                "Teaching is the art of assisting discovery." Delivering quality curriculum lessons, tracking syllabus coverage, and mentoring students daily.
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
                    📚 Assigned Teaching Periods Loaded
                  </span>
                )}
              </div>

              {/* Quick Actions */}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => setTab('schedule')}
                  style={{
                    background: tab === 'schedule' ? '#064e3b' : '#ffffff',
                    color: tab === 'schedule' ? '#ffffff' : '#064e3b',
                    border: 'none',
                    borderRadius: '12px', padding: '10px 18px', fontSize: '13px',
                    fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                    boxShadow: '0 6px 18px rgba(0,0,0,0.15)', transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
                >
                  <i className="ti ti-calendar-time" style={{ color: tab === 'schedule' ? '#34d399' : '#059669' }} /> Today's Schedule & Diary
                </button>
                <button
                  type="button"
                  onClick={() => setTab('attendance')}
                  style={{
                    background: tab === 'attendance' ? '#ffffff' : 'rgba(255,255,255,0.16)',
                    color: tab === 'attendance' ? '#064e3b' : '#ffffff',
                    border: '1.5px solid rgba(255,255,255,0.35)',
                    borderRadius: '12px', padding: '10px 18px', fontSize: '13px',
                    fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                    backdropFilter: 'blur(8px)', transition: 'all 0.2s'
                  }}
                >
                  <i className="ti ti-clipboard-check" /> Mark Attendance
                </button>
                <button
                  type="button"
                  onClick={() => setTab('syllabus')}
                  style={{
                    background: tab === 'syllabus' ? '#ffffff' : 'rgba(255,255,255,0.16)',
                    color: tab === 'syllabus' ? '#064e3b' : '#ffffff',
                    border: '1.5px solid rgba(255,255,255,0.35)',
                    borderRadius: '12px', padding: '10px 18px', fontSize: '13px',
                    fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                    backdropFilter: 'blur(8px)', transition: 'all 0.2s'
                  }}
                >
                  <i className="ti ti-chart-pie" /> Syllabus Progress
                </button>
                <button
                  type="button"
                  onClick={() => setTab('marks')}
                  style={{
                    background: tab === 'marks' ? '#ffffff' : 'rgba(255,255,255,0.16)',
                    color: tab === 'marks' ? '#064e3b' : '#ffffff',
                    border: '1.5px solid rgba(255,255,255,0.35)',
                    borderRadius: '12px', padding: '10px 18px', fontSize: '13px',
                    fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                    backdropFilter: 'blur(8px)', transition: 'all 0.2s'
                  }}
                >
                  <i className="ti ti-award" /> Enter Marks
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
                      You have temporary operational access for classes of absent teacher(s). All attendance, teaching logs, and marks entered are strictly attributed under your name.
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

          {/* ══ 2. BENTO STAT CARDS (EXPANDED TO 5 DOMAINS) ══ */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: '16px', marginBottom: '22px'
          }}>
            {/* Card 1: Today's Schedule */}
            <div
              onClick={() => setTab('schedule')}
              style={{
                background: darkMode ? '#111827' : '#ffffff',
                border: `1px solid ${tab === 'schedule' ? '#2563eb' : (darkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0')}`,
                borderRadius: '16px', padding: '18px 20px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
                cursor: 'pointer', transition: 'all 0.2s'
              }}
            >
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px' }}>
                <i className="ti ti-calendar-time" style={{ fontSize: '18px' }} />
              </div>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', letterSpacing: '0.04em' }}>
                TODAY'S SCHEDULE
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#2563eb', margin: '4px 0 2px' }}>
                {loadingSchedule ? '...' : `${scheduledCount} Periods`}
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                {substitutePeriods.length > 0 ? `⚡ ${substitutePeriods.length} Substitute Assignment` : 'Regular class periods'}
              </div>
              <div style={{ marginTop: '10px' }}>
                <span style={{
                  fontSize: '10.5px', fontWeight: 800, padding: '2px 8px', borderRadius: '6px',
                  background: substitutePeriods.length > 0 ? '#fffbeb' : '#eff6ff',
                  color: substitutePeriods.length > 0 ? '#d97706' : '#2563eb'
                }}>
                  {substitutePeriods.length > 0 ? '⚡ Substitute Active' : 'View Timetable'}
                </span>
              </div>
            </div>

            {/* Card 2: Teaching Diary */}
            <div
              onClick={() => setTab('schedule')}
              style={{
                background: darkMode ? '#111827' : '#ffffff',
                border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
                borderRadius: '16px', padding: '18px 20px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
                cursor: 'pointer'
              }}
            >
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px' }}>
                <i className="ti ti-notebook" style={{ fontSize: '18px' }} />
              </div>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', letterSpacing: '0.04em' }}>
                TEACHING DIARY
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#059669', margin: '4px 0 2px' }}>
                {loadingSchedule ? '...' : `${recordedCount} Logged`}
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                {pendingDiaryCount > 0 ? `${pendingDiaryCount} pending lesson updates` : 'All lessons recorded ✓'}
              </div>
              <div style={{ marginTop: '10px' }}>
                <span style={{
                  fontSize: '10.5px', fontWeight: 800, padding: '2px 8px', borderRadius: '6px',
                  background: pendingDiaryCount > 0 ? '#fef2f2' : '#ecfdf5',
                  color: pendingDiaryCount > 0 ? '#ef4444' : '#10b981'
                }}>
                  {pendingDiaryCount > 0 ? `⚠ ${pendingDiaryCount} Unlogged` : '✓ Diary Updated'}
                </span>
              </div>
            </div>

            {/* Card 3: Class Attendance */}
            <div
              onClick={() => setTab('attendance')}
              style={{
                background: darkMode ? '#111827' : '#ffffff',
                border: `1px solid ${tab === 'attendance' ? '#10b981' : (darkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0')}`,
                borderRadius: '16px', padding: '18px 20px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
                cursor: 'pointer'
              }}
            >
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#ecfdf5', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px' }}>
                <i className="ti ti-circle-check" style={{ fontSize: '18px' }} />
              </div>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', letterSpacing: '0.04em' }}>
                CLASS ATTENDANCE
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#10b981', margin: '4px 0 2px' }}>
                {alreadyMarked ? 'SAVED ✓' : 'PENDING'}
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                {alreadyMarked ? `Roll call recorded for ${selectedDate}` : `Roll call pending for ${selectedDate}`}
              </div>
              <div style={{ marginTop: '10px' }}>
                <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#10b981', background: '#ecfdf5', padding: '2px 8px', borderRadius: '6px' }}>
                  {presentCount}P · {absentCount}A · {lateCount}L
                </span>
              </div>
            </div>

            {/* Card 4: Syllabus Progress */}
            <div
              onClick={() => setTab('syllabus')}
              style={{
                background: darkMode ? '#111827' : '#ffffff',
                border: `1px solid ${tab === 'syllabus' ? '#8b5cf6' : (darkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0')}`,
                borderRadius: '16px', padding: '18px 20px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
                cursor: 'pointer'
              }}
            >
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#f3f0ff', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px' }}>
                <i className="ti ti-chart-pie" style={{ fontSize: '18px' }} />
              </div>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', letterSpacing: '0.04em' }}>
                SYLLABUS PROGRESS
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#8b5cf6', margin: '4px 0 2px' }}>
                {loadingSyllabus ? '...' : `${avgSyllabusPct}% Avg`}
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                Across {syllabusList.length} assigned subject curriculum(s)
              </div>
              <div style={{ marginTop: '10px' }}>
                <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#8b5cf6', background: '#f3f0ff', padding: '2px 8px', borderRadius: '6px' }}>
                  {syllabusList.filter(s => s.status === 'ON_TRACK').length} Subjects On Track
                </span>
              </div>
            </div>

            {/* Card 5: Faculty GPS Duty */}
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

          {/* ══ TAB: TODAY'S SCHEDULE & TEACHING DIARY ══ */}
          {tab === 'schedule' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Header Card */}
              <div className="card" style={{
                borderRadius: '16px',
                background: darkMode ? '#111827' : '#ffffff',
                border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
                padding: '20px 24px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <i className="ti ti-calendar-time" style={{ color: '#2563eb' }} />
                      Today's Live Teaching Schedule &amp; Diary
                    </h3>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
                      Track your timetable periods, log classroom lesson progress, homework assigned, and handle substitute duties.
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '12px', fontWeight: 800, padding: '6px 14px', borderRadius: '20px', background: '#eff6ff', color: '#2563eb' }}>
                      {scheduledCount} Periods Scheduled
                    </span>
                    <span style={{ fontSize: '12px', fontWeight: 800, padding: '6px 14px', borderRadius: '20px', background: '#ecfdf5', color: '#10b981' }}>
                      {recordedCount} Diary Recorded
                    </span>
                    {pendingDiaryCount > 0 && (
                      <span style={{ fontSize: '12px', fontWeight: 800, padding: '6px 14px', borderRadius: '20px', background: '#fffbeb', color: '#d97706' }}>
                        {pendingDiaryCount} Diary Pending
                      </span>
                    )}
                    {substitutePeriods.length > 0 && (
                      <span style={{ fontSize: '12px', fontWeight: 800, padding: '6px 14px', borderRadius: '20px', background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>
                        ⚡ {substitutePeriods.length} Substitute Assignment(s)
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={loadSchedule}
                      disabled={loadingSchedule}
                      className="btn btn-neutral btn-sm"
                      style={{ borderRadius: '8px', fontSize: '12px', fontWeight: 700 }}
                    >
                      <i className={`ti ti-refresh ${loadingSchedule ? 'ti-spin' : ''}`} /> Refresh
                    </button>
                  </div>
                </div>
              </div>

              {/* Schedule Periods Grid */}
              {loadingSchedule ? (
                <div style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8' }}>
                  <i className="ti ti-loader ti-spin" style={{ fontSize: '32px', display: 'block', marginBottom: '8px' }} />
                  <p style={{ fontWeight: 600 }}>Loading today's schedule...</p>
                </div>
              ) : (!scheduleData?.schedule || scheduleData.schedule.length === 0) ? (
                <div className="card" style={{
                  borderRadius: '16px', padding: '50px 20px', textAlign: 'center',
                  background: darkMode ? '#111827' : '#ffffff',
                  border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`
                }}>
                  <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: '#64748b', fontSize: '28px' }}>
                    <i className="ti ti-calendar-off" />
                  </div>
                  <h4 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a' }}>
                    No Timetable Periods Scheduled
                  </h4>
                  <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8', maxWidth: '420px', marginLeft: 'auto', marginRight: 'auto' }}>
                    No active class periods found for {selectedDate}. You can change the date above or verify published school timetables.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '18px' }}>
                  {scheduleData.schedule.map((item, idx) => {
                    const isRecorded = item.status === 'RECORDED';
                    const isCoveredAway = item.status === 'COVERED_BY_SUBSTITUTE';
                    const isSubstituteDuty = Boolean(item.is_substitute_duty);

                    return (
                      <div
                        key={idx}
                        className="card"
                        style={{
                          borderRadius: '16px',
                          background: darkMode ? '#111827' : '#ffffff',
                          border: isSubstituteDuty
                            ? '2px solid #f59e0b'
                            : isRecorded
                              ? `1px solid ${darkMode ? 'rgba(16,185,129,0.3)' : '#bbf7d0'}`
                              : `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
                          boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
                          display: 'flex',
                          flexDirection: 'column',
                          overflow: 'hidden'
                        }}
                      >
                        {/* Period Top Bar */}
                        <div style={{
                          padding: '14px 18px',
                          borderBottom: `1px solid ${darkMode ? '#1f2937' : '#f1f5f9'}`,
                          background: isSubstituteDuty
                            ? (darkMode ? 'rgba(245,158,11,0.1)' : '#fffbeb')
                            : (darkMode ? '#1e293b' : '#f8fafc'),
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{
                              fontWeight: 900,
                              fontSize: '12px',
                              padding: '3px 10px',
                              borderRadius: '8px',
                              background: '#2563eb',
                              color: '#ffffff'
                            }}>
                              Period #{item.period_no || (idx + 1)}
                            </span>
                            {item.start_time && (
                              <span style={{ fontSize: '12px', fontWeight: 700, color: darkMode ? '#cbd5e1' : '#475569' }}>
                                {item.start_time} - {item.end_time}
                              </span>
                            )}
                          </div>

                          <div>
                            {isCoveredAway ? (
                              <span style={{ fontSize: '11px', fontWeight: 800, padding: '3px 10px', borderRadius: '12px', background: '#fee2e2', color: '#dc2626' }}>
                                Substituted Away
                              </span>
                            ) : isRecorded ? (
                              <span style={{ fontSize: '11px', fontWeight: 800, padding: '3px 10px', borderRadius: '12px', background: '#ecfdf5', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <i className="ti ti-check" /> Logged
                              </span>
                            ) : (
                              <span style={{ fontSize: '11px', fontWeight: 800, padding: '3px 10px', borderRadius: '12px', background: '#fffbeb', color: '#d97706', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <i className="ti ti-alert-circle" /> Diary Pending
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Card Body */}
                        <div style={{ padding: '18px', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {/* Substitute Duty Alert if this is a cover period */}
                          {isSubstituteDuty && (
                            <div style={{
                              padding: '10px 14px',
                              borderRadius: '10px',
                              background: '#fef3c7',
                              border: '1px solid #fde68a',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px'
                            }}>
                              <i className="ti ti-bolt" style={{ color: '#d97706', fontSize: '18px', flexShrink: 0 }} />
                              <div style={{ fontSize: '12px', color: '#92400e', lineHeight: 1.3 }}>
                                <strong>SUBSTITUTE DUTY:</strong> Covering for <strong>{item.original_teacher_name || 'Absent Faculty'}</strong>
                                {item.substitute_reason ? ` (${item.substitute_reason})` : ''}
                              </div>
                            </div>
                          )}

                          {/* Covered Away Alert if regular teacher is relieved */}
                          {isCoveredAway && (
                            <div style={{
                              padding: '10px 14px',
                              borderRadius: '10px',
                              background: '#f1f5f9',
                              border: '1px solid #e2e8f0',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px'
                            }}>
                              <i className="ti ti-info-circle" style={{ color: '#64748b', fontSize: '18px', flexShrink: 0 }} />
                              <div style={{ fontSize: '12px', color: '#475569', lineHeight: 1.3 }}>
                                Covered today by <strong>{item.covered_by_substitute_name || 'Substitute Teacher'}</strong>
                              </div>
                            </div>
                          )}

                          {/* Class & Subject Details */}
                          <div>
                            <div style={{ fontSize: '16px', fontWeight: 900, color: darkMode ? '#ffffff' : '#0f172a' }}>
                              {item.subject_name || 'General Subject'}
                              {item.subject_code && (
                                <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', marginLeft: '6px' }}>
                                  ({item.subject_code})
                                </span>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '6px', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '12px', fontWeight: 700, color: '#2563eb', background: '#eff6ff', padding: '2px 8px', borderRadius: '6px' }}>
                                <i className="ti ti-school" style={{ marginRight: '4px' }} />
                                {item.class_name || 'Assigned Class'}
                              </span>
                              {item.room && (
                                <span style={{ fontSize: '12px', fontWeight: 600, color: darkMode ? '#94a3b8' : '#64748b' }}>
                                  <i className="ti ti-map-pin" style={{ marginRight: '4px' }} />
                                  Room {item.room}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Recorded Diary Details */}
                          {isRecorded && item.teaching_log && (
                            <div style={{
                              padding: '12px 14px',
                              borderRadius: '10px',
                              background: darkMode ? '#1e293b' : '#f0fdf4',
                              border: `1px solid ${darkMode ? '#334155' : '#dcfce7'}`,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px'
                            }}>
                              <div style={{ fontSize: '11px', fontWeight: 800, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                Delivered Lesson Record
                              </div>
                              <div style={{ fontSize: '13px', fontWeight: 700, color: darkMode ? '#ffffff' : '#0f172a' }}>
                                {item.teaching_log.subtopic_title || item.teaching_log.topic_title || 'Topic Logged'}
                              </div>
                              {item.teaching_log.classwork_summary && (
                                <div style={{ fontSize: '12px', color: darkMode ? '#94a3b8' : '#64748b', fontStyle: 'italic' }}>
                                  "{item.teaching_log.classwork_summary}"
                                </div>
                              )}
                              {item.teaching_log.has_homework && (
                                <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#7c3aed', display: 'flex', alignItems: 'center', gap: '5px', marginTop: '4px' }}>
                                  <i className="ti ti-notebook" />
                                  Homework: {item.teaching_log.homework_title || 'Assigned'}
                                  {item.teaching_log.homework_due_date ? ` (Due: ${item.teaching_log.homework_due_date})` : ''}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Action Buttons */}
                          <div style={{ marginTop: 'auto', paddingTop: '10px', display: 'flex', gap: '10px' }}>
                            {!isCoveredAway && (
                              <button
                                type="button"
                                onClick={() => openQuickDiary(item)}
                                className={`btn btn-sm ${isRecorded ? 'btn-neutral' : 'btn-primary'}`}
                                style={{
                                  flex: 1,
                                  borderRadius: '8px',
                                  fontSize: '12px',
                                  fontWeight: 800,
                                  background: isRecorded ? undefined : '#2563eb',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '6px'
                                }}
                              >
                                <i className={`ti ${isRecorded ? 'ti-edit' : 'ti-plus'}`} />
                                {isRecorded ? 'Edit Teaching Log' : 'Quick Log Diary'}
                              </button>
                            )}

                            {item.class_id && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedClass(String(item.class_id));
                                  setTab('attendance');
                                }}
                                className="btn btn-neutral btn-sm"
                                style={{ borderRadius: '8px', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}
                              >
                                <i className="ti ti-clipboard-check" /> Roll Call
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

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

          {/* ══ TAB: SYLLABUS PROGRESS TRACKER ══ */}
          {tab === 'syllabus' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Syllabus Header Card */}
              <div className="card" style={{
                borderRadius: '16px',
                background: darkMode ? '#111827' : '#ffffff',
                border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
                padding: '20px 24px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <i className="ti ti-chart-pie" style={{ color: '#8b5cf6' }} />
                      Syllabus Progress &amp; Curriculum Tracker
                    </h3>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
                      Academic Year {session} · Auto-synchronized with your daily teaching diary logs
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 800, padding: '6px 14px', borderRadius: '20px', background: '#f5f3ff', color: '#7c3aed' }}>
                      {syllabusList.length} Curriculums Tracked
                    </span>
                    <button
                      type="button"
                      onClick={loadSyllabus}
                      disabled={loadingSyllabus}
                      className="btn btn-neutral btn-sm"
                      style={{ borderRadius: '8px', fontSize: '12px', fontWeight: 700 }}
                    >
                      <i className={`ti ti-refresh ${loadingSyllabus ? 'ti-spin' : ''}`} /> Refresh
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('/curriculum/coverage')}
                      className="btn btn-primary btn-sm"
                      style={{ borderRadius: '8px', fontSize: '12px', fontWeight: 800, background: '#7c3aed' }}
                    >
                      Full Curriculum View →
                    </button>
                  </div>
                </div>
              </div>

              {/* Syllabus Breakdown Grid */}
              {loadingSyllabus ? (
                <div style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8' }}>
                  <i className="ti ti-loader ti-spin" style={{ fontSize: '32px', display: 'block', marginBottom: '8px' }} />
                  <p>Calculating curriculum pacing &amp; coverage metrics...</p>
                </div>
              ) : syllabusList.length === 0 ? (
                <div className="card" style={{
                  borderRadius: '16px', padding: '50px 20px', textAlign: 'center',
                  background: darkMode ? '#111827' : '#ffffff',
                  border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`
                }}>
                  <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: '#7c3aed', fontSize: '28px' }}>
                    <i className="ti ti-books" />
                  </div>
                  <h4 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a' }}>
                    No Curriculum Plans Registered
                  </h4>
                  <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>
                    No subject curriculum maps found for session {session}. Head to Curriculum Management to define chapters and periods.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px' }}>
                  {syllabusList.map((sub, i) => {
                    const coverage = Math.min(100, Math.round(sub.coverage_pct || 0));
                    const expected = Math.min(100, Math.round(sub.expected_pct || 0));
                    const isBehind = sub.status === 'BEHIND' || (sub.gap !== undefined && sub.gap < -5);
                    const isAhead = sub.status === 'AHEAD' || (sub.gap !== undefined && sub.gap > 5);

                    return (
                      <div
                        key={i}
                        className="card"
                        style={{
                          borderRadius: '16px',
                          background: darkMode ? '#111827' : '#ffffff',
                          border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
                          boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
                          padding: '20px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                          <div>
                            <span style={{ fontSize: '11px', fontWeight: 800, color: '#2563eb', background: '#eff6ff', padding: '3px 8px', borderRadius: '6px' }}>
                              {sub.class_name || 'Class'}
                            </span>
                            <h4 style={{ margin: '8px 0 2px', fontSize: '16px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a' }}>
                              {sub.subject_name || sub.subject}
                            </h4>
                            <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                              Target: {sub.total_periods || sub.estimated_periods || 0} periods planned
                            </div>
                          </div>

                          <div>
                            {isBehind ? (
                              <span style={{ fontSize: '11px', fontWeight: 800, padding: '4px 10px', borderRadius: '12px', background: '#fef2f2', color: '#dc2626' }}>
                                ⚠ Behind ({Math.abs(sub.gap || 0)}%)
                              </span>
                            ) : isAhead ? (
                              <span style={{ fontSize: '11px', fontWeight: 800, padding: '4px 10px', borderRadius: '12px', background: '#eff6ff', color: '#2563eb' }}>
                                ⚡ Ahead (+{sub.gap}%)
                              </span>
                            ) : (
                              <span style={{ fontSize: '11px', fontWeight: 800, padding: '4px 10px', borderRadius: '12px', background: '#ecfdf5', color: '#10b981' }}>
                                ✓ On Track
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Progress Bar Container */}
                        <div style={{ marginBottom: '16px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 700, marginBottom: '6px' }}>
                            <span style={{ color: darkMode ? '#cbd5e1' : '#475569' }}>Completion Progress</span>
                            <span style={{ color: isBehind ? '#dc2626' : '#10b981', fontWeight: 900 }}>{coverage}% Completed</span>
                          </div>
                          <div style={{ height: '8px', background: darkMode ? '#1e293b' : '#e2e8f0', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                            <div style={{
                              height: '100%',
                              width: `${coverage}%`,
                              background: isBehind
                                ? 'linear-gradient(90deg, #f59e0b, #ef4444)'
                                : 'linear-gradient(90deg, #10b981, #059669)',
                              borderRadius: '4px',
                              transition: 'width 0.5s ease'
                            }} />
                          </div>
                          {expected > 0 && (
                            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px', display: 'flex', justifyContent: 'space-between' }}>
                              <span>Pacing expectation: {expected}%</span>
                              <span>Gap: {sub.gap !== undefined ? `${sub.gap > 0 ? '+' : ''}${sub.gap}%` : '0%'}</span>
                            </div>
                          )}
                        </div>

                        {/* Stat Counters */}
                        <div style={{
                          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px',
                          background: darkMode ? '#1e293b' : '#f8fafc',
                          padding: '12px', borderRadius: '10px', border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`
                        }}>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Chapters</div>
                            <div style={{ fontSize: '15px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a', marginTop: '2px' }}>
                              {sub.completed_chapters || 0} / {sub.total_chapters || 0}
                            </div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Topics</div>
                            <div style={{ fontSize: '15px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a', marginTop: '2px' }}>
                              {sub.completed_topics || 0} / {sub.total_topics || 0}
                            </div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Periods</div>
                            <div style={{ fontSize: '15px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a', marginTop: '2px' }}>
                              {sub.actual_periods_spent || sub.periods_spent || 0}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
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
                  <button
                    type="button"
                    className="btn btn-neutral btn-sm"
                    style={{ borderRadius: '8px', fontSize: '12px', fontWeight: 800 }}
                    onClick={() => navigate('/mark-entry')}
                    title="Open official exam marks evaluation grid with moderation and report card publishing"
                  >
                    <i className="ti ti-chart-bar" /> Official Exam Evaluation →
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

          {/* ══ TAB: HOMEWORK & ASSIGNMENTS TRACKER ══ */}
          {tab === 'homework' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="card" style={{
                borderRadius: '16px',
                background: darkMode ? '#111827' : '#ffffff',
                border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
                padding: '20px 24px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <i className="ti ti-clipboard-list" style={{ color: '#059669' }} />
                      Class Assignments &amp; Homework Tasks
                    </h3>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
                      Review active coursework tasks, due dates, and student submission completion rates.
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', fontWeight: 800, padding: '6px 14px', borderRadius: '20px', background: '#ecfdf5', color: '#059669' }}>
                      {assignmentsList.length} Total Assignments
                    </span>
                    <button
                      type="button"
                      onClick={loadAssignments}
                      disabled={loadingAssignments}
                      className="btn btn-neutral btn-sm"
                      style={{ borderRadius: '8px', fontSize: '12px', fontWeight: 700 }}
                    >
                      <i className={`ti ti-refresh ${loadingAssignments ? 'ti-spin' : ''}`} /> Refresh
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('/assignments')}
                      className="btn btn-primary btn-sm"
                      style={{ borderRadius: '8px', fontSize: '12px', fontWeight: 800, background: '#059669' }}
                    >
                      + Create Assignment
                    </button>
                  </div>
                </div>
              </div>

              {loadingAssignments ? (
                <div style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8' }}>
                  <i className="ti ti-loader ti-spin" style={{ fontSize: '32px', display: 'block', marginBottom: '8px' }} />
                  <p>Loading assignments roster...</p>
                </div>
              ) : assignmentsList.length === 0 ? (
                <div className="card" style={{
                  borderRadius: '16px', padding: '50px 20px', textAlign: 'center',
                  background: darkMode ? '#111827' : '#ffffff',
                  border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`
                }}>
                  <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: '#059669', fontSize: '28px' }}>
                    <i className="ti ti-clipboard" />
                  </div>
                  <h4 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a' }}>
                    No Assignments Found
                  </h4>
                  <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>
                    You have not assigned any homework or coursework yet for session {session}.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px' }}>
                  {assignmentsList.map((a, i) => (
                    <div
                      key={a.id || i}
                      className="card"
                      style={{
                        borderRadius: '16px',
                        background: darkMode ? '#111827' : '#ffffff',
                        border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
                        boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
                        padding: '20px',
                        display: 'flex',
                        flexDirection: 'column'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span style={{ fontSize: '11px', fontWeight: 800, color: '#2563eb', background: '#eff6ff', padding: '2px 8px', borderRadius: '6px' }}>
                            {a.class_name || a.class?.name || 'Class'}
                          </span>
                          <span style={{ fontSize: '11px', fontWeight: 800, color: '#059669', background: '#ecfdf5', padding: '2px 8px', borderRadius: '6px' }}>
                            {a.subject_name || a.subject?.name || 'Subject'}
                          </span>
                        </div>
                        <span style={{
                          fontSize: '11px', fontWeight: 800, padding: '3px 8px', borderRadius: '8px',
                          background: darkMode ? '#1e293b' : '#f1f5f9', color: darkMode ? '#cbd5e1' : '#64748b'
                        }}>
                          Max Marks: {a.max_marks || 100}
                        </span>
                      </div>

                      <h4 style={{ margin: '4px 0 6px', fontSize: '16px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a' }}>
                        {a.title}
                      </h4>

                      {a.description && (
                        <p style={{ margin: '0 0 14px', fontSize: '13px', color: '#94a3b8', lineHeight: 1.4, flex: 1 }}>
                          {a.description.length > 120 ? `${a.description.substring(0, 120)}...` : a.description}
                        </p>
                      )}

                      <div style={{
                        marginTop: 'auto', paddingTop: '14px', borderTop: `1px solid ${darkMode ? '#1f2937' : '#f1f5f9'}`,
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#d97706', fontWeight: 700 }}>
                          <i className="ti ti-calendar-event" />
                          Due: {a.due_date ? new Date(a.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'No deadline'}
                        </div>
                        <span style={{ fontWeight: 800, color: '#2563eb', background: '#eff6ff', padding: '2px 8px', borderRadius: '6px' }}>
                          {a.submissions_count !== undefined ? `${a.submissions_count} Submissions` : 'Active'}
                        </span>
                      </div>
                    </div>
                  ))}
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

          {/* ══ TAB: FACULTY LEAVES & QUOTA ══ */}
          {tab === 'leaves' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="card" style={{
                borderRadius: '16px',
                background: darkMode ? '#111827' : '#ffffff',
                border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
                padding: '20px 24px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <i className="ti ti-calendar-off" style={{ color: '#ea580c' }} />
                      Faculty Leave Quotas &amp; HR Requests
                    </h3>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
                      Check your casual, medical, and earned leave balances and approval status of leave applications.
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={loadLeaves}
                      disabled={loadingLeaves}
                      className="btn btn-neutral btn-sm"
                      style={{ borderRadius: '8px', fontSize: '12px', fontWeight: 700 }}
                    >
                      <i className={`ti ti-refresh ${loadingLeaves ? 'ti-spin' : ''}`} /> Refresh
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('/my-hr')}
                      className="btn btn-primary btn-sm"
                      style={{ borderRadius: '8px', fontSize: '12px', fontWeight: 800, background: '#ea580c' }}
                    >
                      + Apply for Leave
                    </button>
                  </div>
                </div>
              </div>

              {loadingLeaves ? (
                <div style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8' }}>
                  <i className="ti ti-loader ti-spin" style={{ fontSize: '32px', display: 'block', marginBottom: '8px' }} />
                  <p>Loading your leave records...</p>
                </div>
              ) : (
                <>
                  {/* Leave Balances Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                    {(leavesData?.balances || [
                      { leave_type: 'Casual Leave (CL)', allocated: 12, used: 2, remaining: 10 },
                      { leave_type: 'Sick / Medical Leave (SL)', allocated: 10, used: 1, remaining: 9 },
                      { leave_type: 'Earned Leave (EL)', allocated: 15, used: 0, remaining: 15 },
                      { leave_type: 'Duty Leave (DL)', allocated: 5, used: 0, remaining: 5 },
                    ]).map((b, idx) => (
                      <div
                        key={idx}
                        className="card"
                        style={{
                          borderRadius: '16px',
                          background: darkMode ? '#111827' : '#ffffff',
                          border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
                          padding: '18px 20px',
                          boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
                        }}
                      >
                        <div style={{ fontSize: '12px', fontWeight: 800, color: '#94a3b8' }}>
                          {b.leave_type || b.type}
                        </div>
                        <div style={{ fontSize: '26px', fontWeight: 900, color: '#2563eb', margin: '6px 0 4px' }}>
                          {b.remaining !== undefined ? b.remaining : (b.balance || 0)} <span style={{ fontSize: '14px', fontWeight: 600, color: '#94a3b8' }}>Days Left</span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
                          <span>Allocated: {b.allocated || 0}</span>
                          <span>Used: {b.used || 0}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Leave Request History */}
                  <div className="card" style={{
                    borderRadius: '16px',
                    background: darkMode ? '#111827' : '#ffffff',
                    border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
                    overflow: 'hidden'
                  }}>
                    <div className="card-header" style={{ padding: '16px 20px', borderBottom: `1px solid ${darkMode ? '#1f2937' : '#f1f5f9'}` }}>
                      <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a' }}>
                        Recent Leave Applications
                      </h4>
                    </div>
                    {(!leavesData?.requests || leavesData.requests.length === 0) ? (
                      <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                        No recent leave requests filed
                      </div>
                    ) : (
                      <div className="table-container" style={{ border: 'none' }}>
                        <table>
                          <thead>
                            <tr>
                              <th>Type</th>
                              <th>Dates</th>
                              <th>Days</th>
                              <th>Reason</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {leavesData.requests.map((r, i) => (
                              <tr key={r.id || i}>
                                <td style={{ fontWeight: 700 }}>{r.leave_type}</td>
                                <td>{r.start_date} to {r.end_date}</td>
                                <td style={{ fontWeight: 800 }}>{r.days_count || 1}</td>
                                <td style={{ fontSize: '12px', color: '#64748b' }}>{r.reason}</td>
                                <td>
                                  <span className={`badge ${
                                    r.status === 'APPROVED' ? 'badge-success' :
                                    r.status === 'REJECTED' ? 'badge-error' : 'badge-warning'
                                  }`}>
                                    {r.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
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
      {/* ══ QUICK LOG TEACHING DIARY MODAL ══ */}
      {quickDiaryModal.open && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{
            background: darkMode ? '#111827' : '#ffffff',
            borderRadius: '20px',
            maxWidth: '620px', width: '100%',
            maxHeight: '90vh', overflowY: 'auto',
            border: `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`,
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)',
            padding: '24px 28px'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ background: '#2563eb', color: '#fff', fontSize: '11px', fontWeight: 900, padding: '2px 8px', borderRadius: '6px' }}>
                    Period #{diaryForm.period_no}
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: '#64748b' }}>
                    {quickDiaryModal.period?.class_name} · {quickDiaryModal.period?.subject_name}
                  </span>
                </div>
                <h3 style={{ margin: '6px 0 0', fontSize: '18px', fontWeight: 900, color: darkMode ? '#ffffff' : '#0f172a' }}>
                  Log Daily Teaching Record
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setQuickDiaryModal({ open: false, period: null })}
                style={{
                  background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer',
                  color: darkMode ? '#94a3b8' : '#64748b', padding: '4px'
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={submitQuickDiary}>
              {/* Chapter Select */}
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label" style={{ color: darkMode ? '#cbd5e1' : '#334155', fontWeight: 700, fontSize: '12.5px' }}>
                  Mapped Curriculum Chapter
                </label>
                {loadingModalChapters ? (
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>Loading chapters...</div>
                ) : (
                  <select
                    className="form-select"
                    style={{
                      width: '100%', borderRadius: '8px', fontSize: '13px',
                      background: darkMode ? '#0f172a' : '#ffffff',
                      borderColor: darkMode ? '#334155' : '#cbd5e1',
                      color: darkMode ? '#ffffff' : '#0f172a'
                    }}
                    value={diaryForm.chapter_id}
                    onChange={e => setDiaryForm(f => ({ ...f, chapter_id: e.target.value }))}
                  >
                    <option value="">-- General Lesson / Not Mapped to Chapter --</option>
                    {modalChapters.map(ch => (
                      <option key={ch.id} value={ch.id}>
                        Ch {ch.chapter_no}: {ch.title}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Topic Title */}
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label" style={{ color: darkMode ? '#cbd5e1' : '#334155', fontWeight: 700, fontSize: '12.5px' }}>
                  Topic / Subtopic Delivered *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Introduction to Quadratic Equations & Solving via Factorization"
                  value={diaryForm.subtopic_title}
                  onChange={e => setDiaryForm(f => ({ ...f, subtopic_title: e.target.value }))}
                  style={{
                    width: '100%', borderRadius: '8px', padding: '9px 12px', fontSize: '13px',
                    background: darkMode ? '#0f172a' : '#ffffff',
                    border: `1px solid ${darkMode ? '#334155' : '#cbd5e1'}`,
                    color: darkMode ? '#ffffff' : '#0f172a'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                {/* Teaching Methodology */}
                <div className="form-group">
                  <label className="form-label" style={{ color: darkMode ? '#cbd5e1' : '#334155', fontWeight: 700, fontSize: '12.5px' }}>
                    Methodology
                  </label>
                  <select
                    className="form-select"
                    style={{
                      width: '100%', borderRadius: '8px', fontSize: '13px',
                      background: darkMode ? '#0f172a' : '#ffffff',
                      borderColor: darkMode ? '#334155' : '#cbd5e1',
                      color: darkMode ? '#ffffff' : '#0f172a'
                    }}
                    value={diaryForm.teaching_methodology}
                    onChange={e => setDiaryForm(f => ({ ...f, teaching_methodology: e.target.value }))}
                  >
                    <option>Interactive / Discussion</option>
                    <option>Chalk &amp; Board / Lecture</option>
                    <option>Digital Smart Board / Video</option>
                    <option>Practical / Lab Session</option>
                    <option>Problem Solving &amp; Exercises</option>
                    <option>Revision &amp; Q&amp;A</option>
                  </select>
                </div>

                {/* Topic Status */}
                <div className="form-group">
                  <label className="form-label" style={{ color: darkMode ? '#cbd5e1' : '#334155', fontWeight: 700, fontSize: '12.5px' }}>
                    Topic Progress Status
                  </label>
                  <select
                    className="form-select"
                    style={{
                      width: '100%', borderRadius: '8px', fontSize: '13px',
                      background: darkMode ? '#0f172a' : '#ffffff',
                      borderColor: darkMode ? '#334155' : '#cbd5e1',
                      color: darkMode ? '#ffffff' : '#0f172a'
                    }}
                    value={diaryForm.topic_completion_status}
                    onChange={e => setDiaryForm(f => ({ ...f, topic_completion_status: e.target.value }))}
                  >
                    <option value="COMPLETED">Completed in this period</option>
                    <option value="IN_PROGRESS">In Progress (Partially taught)</option>
                    <option value="REVISION">Revision / Reinforcement</option>
                  </select>
                </div>
              </div>

              {/* Classwork Summary */}
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ color: darkMode ? '#cbd5e1' : '#334155', fontWeight: 700, fontSize: '12.5px' }}>
                  Classwork &amp; Key Takeaways Summary
                </label>
                <textarea
                  rows={2}
                  placeholder="Summary of classroom activities, questions discussed, or whiteboard notes..."
                  value={diaryForm.classwork_summary}
                  onChange={e => setDiaryForm(f => ({ ...f, classwork_summary: e.target.value }))}
                  style={{
                    width: '100%', borderRadius: '8px', padding: '9px 12px', fontSize: '13px',
                    background: darkMode ? '#0f172a' : '#ffffff',
                    border: `1px solid ${darkMode ? '#334155' : '#cbd5e1'}`,
                    color: darkMode ? '#ffffff' : '#0f172a'
                  }}
                />
              </div>

              {/* Homework Toggle & Section */}
              <div style={{
                borderRadius: '12px', padding: '14px 16px', marginBottom: '20px',
                background: darkMode ? '#1e293b' : '#f8fafc',
                border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`
              }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 800, fontSize: '13px', color: darkMode ? '#ffffff' : '#0f172a', margin: 0 }}>
                  <input
                    type="checkbox"
                    checked={diaryForm.has_homework}
                    onChange={e => setDiaryForm(f => ({ ...f, has_homework: e.target.checked }))}
                    style={{ width: '16px', height: '16px', accentColor: '#2563eb' }}
                  />
                  <span>Assign Homework for this period</span>
                </label>

                {diaryForm.has_homework && (
                  <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <input
                      type="text"
                      placeholder="Homework Title (e.g. NCERT Ex 4.2 Q1 to Q5)"
                      value={diaryForm.homework_title}
                      onChange={e => setDiaryForm(f => ({ ...f, homework_title: e.target.value }))}
                      style={{
                        width: '100%', borderRadius: '8px', padding: '8px 12px', fontSize: '12.5px',
                        background: darkMode ? '#0f172a' : '#ffffff',
                        border: `1px solid ${darkMode ? '#334155' : '#cbd5e1'}`,
                        color: darkMode ? '#ffffff' : '#0f172a'
                      }}
                    />
                    <textarea
                      rows={2}
                      placeholder="Homework instructions or submission guidelines..."
                      value={diaryForm.homework_description}
                      onChange={e => setDiaryForm(f => ({ ...f, homework_description: e.target.value }))}
                      style={{
                        width: '100%', borderRadius: '8px', padding: '8px 12px', fontSize: '12.5px',
                        background: darkMode ? '#0f172a' : '#ffffff',
                        border: `1px solid ${darkMode ? '#334155' : '#cbd5e1'}`,
                        color: darkMode ? '#ffffff' : '#0f172a'
                      }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: darkMode ? '#cbd5e1' : '#475569', margin: 0 }}>
                        Due Date:
                      </label>
                      <input
                        type="date"
                        value={diaryForm.homework_due_date}
                        onChange={e => setDiaryForm(f => ({ ...f, homework_due_date: e.target.value }))}
                        style={{
                          borderRadius: '8px', padding: '6px 10px', fontSize: '12px',
                          background: darkMode ? '#0f172a' : '#ffffff',
                          border: `1px solid ${darkMode ? '#334155' : '#cbd5e1'}`,
                          color: darkMode ? '#ffffff' : '#0f172a'
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Form Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setQuickDiaryModal({ open: false, period: null })}
                  className="btn btn-neutral"
                  style={{ borderRadius: '8px', fontSize: '13px', fontWeight: 700, padding: '9px 18px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingDiary}
                  className="btn btn-primary"
                  style={{
                    borderRadius: '8px', fontSize: '13px', fontWeight: 800, padding: '9px 22px',
                    background: '#2563eb', border: 'none', boxShadow: '0 4px 12px rgba(37,99,235,0.3)'
                  }}
                >
                  {savingDiary ? 'Recording Entry...' : 'Save Teaching Log ✓'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
