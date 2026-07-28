import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function TeacherDashboard() {
  var [classes,       setClasses]       = useState([]);
  var [tab,           setTab]           = useState('attendance');
  var [selectedClass, setSelectedClass] = useState('');
  var [students,      setStudents]      = useState([]);
  var [attendance,    setAttendance]    = useState({});
  var [marksData,     setMarksData]     = useState([]);
  var [subjects,      setSubjects]      = useState([]);
  var [selectedSubject, setSelectedSubject] = useState('');
  var [examType,      setExamType]      = useState('Mid Term');
  var [saving,        setSaving]        = useState(false);
  var [msg,           setMsg]           = useState('');
  var [alreadyMarked, setAlreadyMarked] = useState(false);
  var [holidays,      setHolidays]      = useState([]);

  // GPS-based Staff Attendance (replaces old manual time-entry self-attendance)
  var [myStatus,       setMyStatus]       = useState(null);   // today's StaffAttendance record, ya null
  var [gpsLoading,     setGpsLoading]     = useState(true);
  var [checkingIn,     setCheckingIn]     = useState(false);
  var [checkingOut,    setCheckingOut]    = useState(false);
  var [showRegularize, setShowRegularize] = useState(false);
  var [regForm,        setRegForm]        = useState({ reason_type:'FORGOT_CHECKOUT', reason_text:'', requested_check_in:'', requested_check_out:'' });
  var [regSaving,      setRegSaving]      = useState(false);

  var today = new Date().toISOString().split('T')[0];

  var [assignments, setAssignments] = useState([]); // [{class_id, class_name, subject_id, subject_name}]

  useEffect(function() {
    api.get('/principal/teacher/my-assignments')
      .then(function(r) {
        var data = r.data || [];
        setAssignments(data);
        var uniqClasses = [];
        var seen = {};
        data.forEach(function(a) {
          if (!seen[a.class_id]) { seen[a.class_id] = true; uniqClasses.push({ id: a.class_id, name: a.class_name, section: '' }); }
        });
        setClasses(uniqClasses);
        if (uniqClasses.length) setSelectedClass(String(uniqClasses[0].id));
      })
      .catch(function() {});

    loadMyStatus();

    api.get('/principal/holidays?applies_to=TEACHER')
      .then(function(r) { setHolidays(r.data || []); })
      .catch(function() {});
  }, []);

  useEffect(function() {
    if (!selectedClass) return;
    var firstAssign = assignments.find(function(a) { return String(a.class_id) === String(selectedClass); });
    if (firstAssign) setSelectedSubject(String(firstAssign.subject_id));
    setStudents([]);
    setAttendance({});
    setAlreadyMarked(false);

    api.get('/principal/students?class_id=' + selectedClass)
      .then(function(r) {
        var list = Array.isArray(r.data) ? r.data : (r.data.data || []);
        setStudents(list);
        var init = {};
        r.data.forEach(function(s) { init[String(s.id)] = 'PRESENT'; });

        api.get('/teacher/attendance/' + selectedClass + '?date=' + today)
          .then(function(att) {
            if (att.data.length > 0) {
              att.data.forEach(function(a) { init[String(a.student_id)] = a.status; });
              setAlreadyMarked(true);
            }
            setAttendance(init);
          })
          .catch(function() { setAttendance(init); });

        setMarksData(
          r.data.map(function(s) {
            return {
              student_id:     s.id,
              name:           s.name,
              roll_number:    s.roll_number,
              marks_obtained: '',
              max_marks:      100,
            };
          })
        );
      })
      .catch(function() {});
  }, [selectedClass]);

  function toggle(studentId, status) {
    setAttendance(function(prev) {
      var next = Object.assign({}, prev);
      next[String(studentId)] = status;
      return next;
    });
  }

  async function saveAttendance() {
    setSaving(true); setMsg('');
    try {
      var records = Object.entries(attendance).map(function(entry) {
        return { student_id: parseInt(entry[0]), status: entry[1] };
      });
      await api.post('/teacher/attendance', {
        class_id: selectedClass,
        date:     today,
        records:  records,
      });
      toast.success('Attendance saved!');
      setMsg('Attendance saved!');
      setAlreadyMarked(true);
    } catch(e) {
      toast.error('Error saving attendance');
      setMsg('Error saving attendance');
    }
    setSaving(false);
    setTimeout(function() { setMsg(''); }, 3500);
  }

  async function saveMarks() {
    setSaving(true); setMsg('');
    try {
      var entries = marksData
        .filter(function(m) { return m.marks_obtained !== ''; })
        .map(function(m) {
          return {
            student_id:     m.student_id,
            subject_id:     selectedSubject ? parseInt(selectedSubject) : 1,
            marks_obtained: parseFloat(m.marks_obtained),
            max_marks:      m.max_marks,
          };
        });
      if (!entries.length) {
        setMsg('Kisi ka marks enter nahi kiya');
        setSaving(false);
        return;
      }
      await api.post('/teacher/marks', { entries: entries, exam_type: examType });
      toast.success(entries.length + ' students ke marks saved!');
      setMsg(entries.length + ' students ke marks saved!');
    } catch(e) {
      toast.error('Error saving marks');
      setMsg('Error saving marks');
    }
    setSaving(false);
    setTimeout(function() { setMsg(''); }, 3500);
  }

  var presentCount = Object.values(attendance).filter(function(s) { return s === 'PRESENT'; }).length;
  var absentCount  = Object.values(attendance).filter(function(s) { return s === 'ABSENT'; }).length;
  var lateCount    = Object.values(attendance).filter(function(s) { return s === 'LATE'; }).length;

  function getGpsLocation() {
    return new Promise(function(resolve, reject) {
      if (!navigator.geolocation) {
        reject(new Error('Is browser me GPS support nahi hai'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        function(pos) {
          resolve({
            latitude:  pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy:  pos.coords.accuracy,
          });
        },
        function() { reject(new Error('Location permission denied ya GPS off hai')); },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }

  function loadMyStatus() {
    setGpsLoading(true);
    api.get('/staff-attendance/my-status')
      .then(function(r) { setMyStatus(r.data); })
      .catch(function() {})
      .finally(function() { setGpsLoading(false); });
  }

  async function doCheckIn() {
    setCheckingIn(true);
    try {
      var loc = await getGpsLocation();
      var r = await api.post('/staff-attendance/check-in', {
        latitude:  loc.latitude,
        longitude: loc.longitude,
        accuracy:  loc.accuracy,
        device:    navigator.userAgent,
      });
      setMyStatus(r.data);
      toast.success('Check-in ho gaya!');
    } catch(e) {
      toast.error((e.response && e.response.data && e.response.data.error) || e.message || 'Check-in fail ho gaya');
    }
    setCheckingIn(false);
  }

  async function doCheckOut() {
    setCheckingOut(true);
    try {
      var loc = await getGpsLocation();
      var r = await api.post('/staff-attendance/check-out', {
        latitude:  loc.latitude,
        longitude: loc.longitude,
      });
      setMyStatus(r.data);
      toast.success('Check-out ho gaya!');
    } catch(e) {
      toast.error((e.response && e.response.data && e.response.data.error) || e.message || 'Check-out fail ho gaya');
    }
    setCheckingOut(false);
  }

  async function submitRegularization() {
    setRegSaving(true);
    try {
      var payload = {
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

  var TABS = [
    { key: 'attendance',  icon: 'P', label: 'Attendance'    },
    { key: 'marks',       icon: 'M', label: 'Marks Entry'   },
    { key: 'notes',       icon: 'N', label: 'Upload Notes'  },
    { key: 'my-att',      icon: 'A', label: 'My Attendance' },
    { key: 'holidays',    icon: 'H', label: 'Holidays'      },
  ];

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar title="Teacher Dashboard" />
        <div className="page-body">

          <div className="page-header">
            <h2 className="page-title">My Classroom</h2>
            <p className="page-subtitle">Manage attendance, marks and notes</p>
          </div>

          <div className="card mb-6">
            <div className="card-body" style={{ display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
              <label className="form-label" style={{ marginBottom:0, whiteSpace:'nowrap' }}>
                Select Class:
              </label>
              <select
                className="form-select"
                style={{ maxWidth:200 }}
                value={selectedClass}
                onChange={function(e) { setSelectedClass(e.target.value); }}
              >
                {classes.map(function(c) {
                  return (
                    <option key={c.id} value={String(c.id)}>
                      {c.name} {c.section}
                    </option>
                  );
                })}
              </select>

              <span style={{
                fontSize:12, fontWeight:600, padding:'4px 12px', borderRadius:20,
                background: students.length ? '#dbeafe' : '#fee2e2',
                color:      students.length ? '#1d4ed8' : '#dc2626',
              }}>
                {students.length === 0 ? '0 students enrolled' : students.length + ' students enrolled'}
              </span>
            </div>
          </div>

          <div style={{ display:'flex', borderBottom:'2px solid var(--neutral-2)', marginBottom:20 }}>
            {TABS.map(function(t) {
              return (
                <button
                  key={t.key}
                  onClick={function() { setTab(t.key); setMsg(''); }}
                  style={{
                    background:'none', border:'none', cursor:'pointer',
                    padding:'10px 22px', fontSize:13, fontWeight:600,
                    color: tab === t.key ? 'var(--blue-60)' : 'var(--neutral-6)',
                    borderBottom: tab === t.key ? '2px solid var(--blue-60)' : '2px solid transparent',
                    marginBottom: -2, transition:'color 0.15s',
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          {msg && (
            <div className="alert alert-success" style={{ marginBottom:16 }}>
              {msg}
            </div>
          )}

          {tab === 'attendance' && (
            <div className="card">
              <div className="card-header" style={{
                display:'flex', justifyContent:'space-between',
                alignItems:'center', flexWrap:'wrap', gap:12,
              }}>
                <div>
                  <h4 style={{ margin:0 }}>Mark Attendance</h4>
                  {alreadyMarked && (
                    <span style={{ fontSize:11, color:'#059669', fontWeight:600 }}>
                      Aaj ki attendance already saved hai
                    </span>
                  )}
                </div>
                <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                  <span style={{ background:'#dbeafe', color:'#1d4ed8', padding:'4px 12px', borderRadius:20, fontSize:11, fontWeight:700 }}>
                    {presentCount} Present
                  </span>
                  <span style={{ background:'#fee2e2', color:'#dc2626', padding:'4px 12px', borderRadius:20, fontSize:11, fontWeight:700 }}>
                    {absentCount} Absent
                  </span>
                  {lateCount > 0 && (
                    <span style={{ background:'#fef3c7', color:'#d97706', padding:'4px 12px', borderRadius:20, fontSize:11, fontWeight:700 }}>
                      {lateCount} Late
                    </span>
                  )}
                  <button
                    className="btn btn-neutral btn-sm"
                    onClick={function() {
                      var all = {};
                      students.forEach(function(s) { all[String(s.id)] = 'PRESENT'; });
                      setAttendance(all);
                    }}
                  >
                    All Present
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={saveAttendance}
                    disabled={saving || !students.length}
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>

              {students.length === 0 ? (
                <div className="empty-state" style={{ padding:48 }}>
                  <div className="empty-state-icon">A</div>
                  <p>Is class mein koi student enrolled nahi hai</p>
                </div>
              ) : (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width:44, textAlign:'center' }}>#</th>
                        <th style={{ width:90 }}>Roll No</th>
                        <th>Student Name</th>
                        <th style={{ width:260 }}>Mark Attendance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map(function(s, i) {
                        var status = attendance[String(s.id)] || 'PRESENT';
                        var rowBg = status === 'PRESENT' ? '#f0fdf4' : status === 'ABSENT' ? '#fff5f5' : '#fffbeb';
                        return (
                          <tr key={s.id} style={{ background: rowBg }}>
                            <td style={{ textAlign:'center', color:'var(--neutral-5)', fontSize:12 }}>{i + 1}</td>
                            <td><span className="badge badge-neutral">{s.roll_number || '-'}</span></td>
                            <td>
                              <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                                <div style={{
                                  width:34, height:34, borderRadius:'50%', flexShrink:0,
                                  background: status === 'PRESENT' ? '#bbf7d0' : status === 'ABSENT' ? '#fecaca' : '#fde68a',
                                  color: status === 'PRESENT' ? '#166534' : status === 'ABSENT' ? '#991b1b' : '#92400e',
                                  display:'flex', alignItems:'center', justifyContent:'center',
                                  fontSize:13, fontWeight:700,
                                }}>
                                  {s.name && s.name.charAt(0).toUpperCase()}
                                </div>
                                <span style={{ fontWeight:500 }}>{s.name}</span>
                              </div>
                            </td>
                            <td>
                              <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                                <button
                                  onClick={function() { toggle(s.id, 'PRESENT'); }}
                                  style={{
                                    width:42, height:42, borderRadius:'50%',
                                    border: status === 'PRESENT' ? '3px solid #1d4ed8' : '2px solid #bfdbfe',
                                    background: status === 'PRESENT' ? '#2563eb' : '#eff6ff',
                                    color: status === 'PRESENT' ? '#fff' : '#93c5fd',
                                    cursor:'pointer', fontSize:15, fontWeight:900,
                                  }}
                                >P</button>
                                <button
                                  onClick={function() { toggle(s.id, 'ABSENT'); }}
                                  style={{
                                    width:42, height:42, borderRadius:'50%',
                                    border: status === 'ABSENT' ? '3px solid #b91c1c' : '2px solid #fecaca',
                                    background: status === 'ABSENT' ? '#dc2626' : '#fff5f5',
                                    color: status === 'ABSENT' ? '#fff' : '#fca5a5',
                                    cursor:'pointer', fontSize:15, fontWeight:900,
                                  }}
                                >A</button>
                                <button
                                  onClick={function() { toggle(s.id, 'LATE'); }}
                                  style={{
                                    width:42, height:42, borderRadius:'50%',
                                    border: status === 'LATE' ? '3px solid #b45309' : '2px solid #fde68a',
                                    background: status === 'LATE' ? '#d97706' : '#fffbeb',
                                    color: status === 'LATE' ? '#fff' : '#fcd34d',
                                    cursor:'pointer', fontSize:15, fontWeight:900,
                                  }}
                                >L</button>
                                <span style={{
                                  fontSize:11, fontWeight:700, padding:'4px 10px', borderRadius:20,
                                  background: status === 'PRESENT' ? '#dbeafe' : status === 'ABSENT' ? '#fee2e2' : '#fef3c7',
                                  color: status === 'PRESENT' ? '#1d4ed8' : status === 'ABSENT' ? '#dc2626' : '#d97706',
                                  minWidth:68, textAlign:'center',
                                }}>
                                  {status === 'PRESENT' ? 'Present' : status === 'ABSENT' ? 'Absent' : 'Late'}
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

          {tab === 'marks' && (
            <div className="card">
              <div className="card-header" style={{
                display:'flex', justifyContent:'space-between',
                alignItems:'center', flexWrap:'wrap', gap:12,
              }}>
                <h4 style={{ margin:0 }}>Enter Marks</h4>
                <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
                  {assignments.filter(function(a) { return String(a.class_id) === String(selectedClass); }).length > 0 && (
                    <select
                      className="form-select"
                      style={{ width:160 }}
                      value={selectedSubject}
                      onChange={function(e) { setSelectedSubject(e.target.value); }}
                    >
                      {assignments
                        .filter(function(a) { return String(a.class_id) === String(selectedClass); })
                        .map(function(a) {
                          return <option key={a.subject_id} value={String(a.subject_id)}>{a.subject_name}</option>;
                        })}
                    </select>
                  )}
                  <select
                    className="form-select"
                    style={{ width:150 }}
                    value={examType}
                    onChange={function(e) { setExamType(e.target.value); }}
                  >
                    <option>Unit Test 1</option>
                    <option>Mid Term</option>
                    <option>Unit Test 2</option>
                    <option>Final Exam</option>
                    <option>Pre-Board</option>
                  </select>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={saveMarks}
                    disabled={saving || !students.length}
                  >
                    {saving ? 'Saving...' : 'Save Marks'}
                  </button>
                </div>
              </div>

              {students.length === 0 ? (
                <div className="empty-state" style={{ padding:48 }}>
                  <p>Is class mein koi student enrolled nahi hai</p>
                </div>
              ) : (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width:90 }}>Roll No</th>
                        <th>Student Name</th>
                        <th style={{ width:150 }}>Marks Obtained</th>
                        <th style={{ width:110 }}>Max Marks</th>
                        <th style={{ width:80, textAlign:'center' }}>%</th>
                        <th style={{ width:70, textAlign:'center' }}>Grade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {marksData.map(function(m, i) {
                        var raw = parseFloat(m.marks_obtained);
                        var pct = (!isNaN(raw) && m.max_marks > 0) ? (raw / m.max_marks) * 100 : null;
                        var grade = pct !== null
                          ? pct >= 90 ? 'A+' : pct >= 80 ? 'A' : pct >= 70 ? 'B+'
                            : pct >= 60 ? 'B' : pct >= 50 ? 'C' : pct >= 33 ? 'D' : 'F'
                          : '';
                        var gradeBadge = pct !== null
                          ? pct >= 60 ? 'badge-success' : pct >= 33 ? 'badge-warning' : 'badge-error'
                          : '';
                        return (
                          <tr key={m.student_id}>
                            <td><span className="badge badge-neutral">{m.roll_number || '-'}</span></td>
                            <td>
                              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                <div style={{
                                  width:30, height:30, borderRadius:'50%',
                                  background:'#f3f0ff', color:'#5867e8',
                                  display:'flex', alignItems:'center', justifyContent:'center',
                                  fontSize:12, fontWeight:700,
                                }}>
                                  {m.name && m.name.charAt(0).toUpperCase()}
                                </div>
                                <span style={{ fontWeight:500 }}>{m.name}</span>
                              </div>
                            </td>
                            <td>
                              <input
                                className="form-input"
                                type="number"
                                min="0"
                                max={m.max_marks}
                                value={m.marks_obtained}
                                placeholder="0"
                                style={{ width:110, textAlign:'center', fontWeight:700, fontSize:15 }}
                                onChange={function(e) {
                                  var val = e.target.value;
                                  setMarksData(function(d) {
                                    return d.map(function(x, j) {
                                      return j === i ? Object.assign({}, x, { marks_obtained: val }) : x;
                                    });
                                  });
                                }}
                              />
                            </td>
                            <td>
                              <input
                                className="form-input"
                                type="number"
                                min="1"
                                value={m.max_marks}
                                style={{ width:70, textAlign:'center' }}
                                onChange={function(e) {
                                  var val = e.target.value;
                                  setMarksData(function(d) {
                                    return d.map(function(x, j) {
                                      return j === i ? Object.assign({}, x, { max_marks: parseInt(val) || 100 }) : x;
                                    });
                                  });
                                }}
                              />
                            </td>
                            <td style={{ textAlign:'center', fontWeight:700,
                              color: pct === null ? 'var(--neutral-4)' : pct >= 33 ? '#059669' : '#dc2626' }}>
                              {pct !== null ? (pct.toFixed(1) + '%') : '-'}
                            </td>
                            <td style={{ textAlign:'center' }}>
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

          {tab === 'notes' && <NotesUpload selectedClass={selectedClass} />}

          {tab === 'my-att' && (
            <div style={{ maxWidth: 520 }}>
              <div className="card">
                <div className="card-header">
                  <h4 style={{ margin:0 }}>My Attendance</h4>
                </div>
                <div style={{ padding:'20px' }}>
                  {gpsLoading ? (
                    <div style={{ textAlign:'center', color:'#94a3b8', padding:'20px 0' }}>Loading...</div>
                  ) : (
                    <>
                      {myStatus && (
                        <div style={{
                          background: myStatus.approval_status === 'APPROVED' ? '#f0fdf4'
                            : myStatus.approval_status === 'REJECTED' ? '#fef2f2' : '#fffbeb',
                          borderRadius:10, padding:'12px 16px', marginBottom:16,
                        }}>
                          <div style={{ fontWeight:700, fontSize:13 }}>
                            {myStatus.approval_status === 'APPROVED' ? 'Attendance Approved'
                              : myStatus.approval_status === 'REJECTED' ? 'Attendance Rejected'
                              : myStatus.approval_status === 'NOT_REQUIRED' ? 'Attendance Marked'
                              : 'Approval Pending'}
                          </div>
                          <div style={{ fontSize:11, color:'#64748b', marginTop:2 }}>
                            Status: {myStatus.status}
                            {myStatus.gps_status ? ' · ' + myStatus.gps_status.replace('_',' ') : ''}
                          </div>
                          {myStatus.approval_status === 'REJECTED' && myStatus.rejection_reason && (
                            <div style={{ fontSize:11, color:'#dc2626', marginTop:4 }}>
                              Reason: {myStatus.rejection_reason}
                            </div>
                          )}
                        </div>
                      )}

                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
                        <div style={{ background:'#f8fafc', borderRadius:8, padding:'10px 12px' }}>
                          <div style={{ fontSize:11, color:'#94a3b8', marginBottom:4 }}>Check In</div>
                          <div style={{ fontSize:14, fontWeight:700 }}>
                            {myStatus && myStatus.check_in_time
                              ? new Date(myStatus.check_in_time).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })
                              : '—'}
                          </div>
                        </div>
                        <div style={{ background:'#f8fafc', borderRadius:8, padding:'10px 12px' }}>
                          <div style={{ fontSize:11, color:'#94a3b8', marginBottom:4 }}>Check Out</div>
                          <div style={{ fontSize:14, fontWeight:700 }}>
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
                            width:'100%', padding:'12px', borderRadius:8, border:'none',
                            background: checkingIn ? '#94a3b8' : '#16a34a',
                            color:'#fff', cursor: checkingIn ? 'default' : 'pointer',
                            fontSize:14, fontWeight:700,
                          }}>
                          {checkingIn ? 'GPS le rahe hain...' : '📍 Check In'}
                        </button>
                      ) : !myStatus.check_out_time ? (
                        <button
                          onClick={doCheckOut}
                          disabled={checkingOut}
                          style={{
                            width:'100%', padding:'12px', borderRadius:8, border:'none',
                            background: checkingOut ? '#94a3b8' : '#dc2626',
                            color:'#fff', cursor: checkingOut ? 'default' : 'pointer',
                            fontSize:14, fontWeight:700,
                          }}>
                          {checkingOut ? 'GPS le rahe hain...' : '📍 Check Out'}
                        </button>
                      ) : (
                        <div style={{ textAlign:'center', fontSize:12, color:'#16a34a', fontWeight:700 }}>
                          ✅ Aaj ki attendance complete ho chuki hai
                        </div>
                      )}

                      {myStatus && (myStatus.status === 'MISSING_CHECKOUT' || myStatus.approval_status === 'REJECTED') && !showRegularize && (
                        <button
                          onClick={function() { setShowRegularize(true); }}
                          style={{
                            width:'100%', padding:'10px', borderRadius:8, marginTop:12,
                            border:'1px solid #cbd5e1', background:'#fff',
                            color:'#334155', cursor:'pointer', fontSize:13, fontWeight:600,
                          }}>
                          Regularize This
                        </button>
                      )}

                      {showRegularize && (
                        <div style={{ marginTop:16, paddingTop:16, borderTop:'1px solid #e2e8f0' }}>
                          <div style={{ fontSize:12, fontWeight:700, marginBottom:8 }}>Regularization Request</div>
                          <select
                            className="form-select"
                            style={{ marginBottom:10, width:'100%' }}
                            value={regForm.reason_type}
                            onChange={function(e) { setRegForm(function(f) { return Object.assign({}, f, { reason_type: e.target.value }); }); }}>
                            <option value="FORGOT_CHECKOUT">Forgot Checkout</option>
                            <option value="LATE_CHECK_IN">Late Check In</option>
                            <option value="WRONG_ATTENDANCE">Wrong Attendance</option>
                            <option value="MEDICAL">Medical Reason</option>
                            <option value="NETWORK_ISSUE">Network Issue</option>
                            <option value="GPS_ISSUE">GPS Issue</option>
                            <option value="OTHER">Other</option>
                          </select>
                          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
                            <div>
                              <label style={{ fontSize:11, color:'#94a3b8', display:'block', marginBottom:4 }}>Requested Check In</label>
                              <input type="time" className="form-input" value={regForm.requested_check_in}
                                onChange={function(e) { setRegForm(function(f) { return Object.assign({}, f, { requested_check_in: e.target.value }); }); }} />
                            </div>
                            <div>
                              <label style={{ fontSize:11, color:'#94a3b8', display:'block', marginBottom:4 }}>Requested Check Out</label>
                              <input type="time" className="form-input" value={regForm.requested_check_out}
                                onChange={function(e) { setRegForm(function(f) { return Object.assign({}, f, { requested_check_out: e.target.value }); }); }} />
                            </div>
                          </div>
                          <textarea className="form-textarea" rows={2}
                            placeholder="Reason likhein..."
                            style={{ width:'100%', marginBottom:10 }}
                            value={regForm.reason_text}
                            onChange={function(e) { setRegForm(function(f) { return Object.assign({}, f, { reason_text: e.target.value }); }); }} />
                          <div style={{ display:'flex', gap:8 }}>
                            <button
                              onClick={submitRegularization}
                              disabled={regSaving}
                              style={{
                                flex:1, padding:'9px', borderRadius:8, border:'none',
                                background: regSaving ? '#94a3b8' : '#0176d3',
                                color:'#fff', cursor: regSaving ? 'default' : 'pointer', fontSize:13, fontWeight:700,
                              }}>
                              {regSaving ? 'Submitting...' : 'Submit Request'}
                            </button>
                            <button
                              onClick={function() { setShowRegularize(false); }}
                              style={{
                                padding:'9px 16px', borderRadius:8, border:'1px solid #cbd5e1',
                                background:'#fff', color:'#334155', cursor:'pointer', fontSize:13, fontWeight:600,
                              }}>
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

          {tab === 'holidays' && (
            <div style={{ maxWidth: 640 }}>
              <div className="card">
                <div className="card-header">
                  <h4 style={{ margin:0 }}>Upcoming Holidays</h4>
                </div>
                {holidays.length === 0 ? (
                  <div className="empty-state" style={{ padding:40 }}>
                    <p>Koi holiday scheduled nahi hai abhi</p>
                  </div>
                ) : (
                  <div>
                    {holidays.map(function(h, i) {
                      var d = new Date(h.date);
                      var isToday = h.date === today;
                      return (
                        <div key={i} style={{
                          display:'flex', alignItems:'center', gap:14,
                          padding:'14px 20px', borderBottom:'1px solid var(--neutral-1)',
                          background: isToday ? '#fffbeb' : 'transparent',
                        }}>
                          <div style={{ flex:1 }}>
                            <div style={{ fontWeight:700, fontSize:14 }}>
                              {h.title}
                              {isToday && (
                                <span style={{ marginLeft:8, fontSize:10, fontWeight:700,
                                  background:'#fde68a', color:'#92400e', padding:'2px 8px', borderRadius:20 }}>
                                  TODAY
                                </span>
                              )}
                            </div>
                            {h.description && (
                              <div style={{ fontSize:12, color:'var(--neutral-5)', marginTop:2 }}>{h.description}</div>
                            )}
                          </div>
                          <div style={{ textAlign:'right', flexShrink:0 }}>
                            <span style={{ fontSize:10, fontWeight:700, padding:'3px 10px',
                              borderRadius:20, background:'#f1f5f9', color:'#64748b' }}>
                              {h.holiday_type}
                            </span>
                            <div style={{ fontSize:10, color:'#94a3b8', marginTop:4 }}>
                              {d.toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'short' })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
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

function NotesUpload(props) {
  var selectedClass = props.selectedClass;
  var [form,      setForm]      = useState({ title:'', description:'' });
  var [file,      setFile]      = useState(null);
  var [uploading, setUploading] = useState(false);
  var [msg,       setMsg]       = useState('');

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) { setMsg('Please select a file'); return; }
    setUploading(true); setMsg('');
    var fd = new FormData();
    fd.append('title',       form.title);
    fd.append('description', form.description);
    fd.append('class_id',    selectedClass);
    fd.append('file',        file);
    try {
      await api.post('/teacher/notes', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Note uploaded successfully!');
      setMsg('Note uploaded successfully!');
      setForm({ title:'', description:'' });
      setFile(null);
    } catch(e) {
      toast.error('Upload failed');
      setMsg('Upload failed');
    }
    setUploading(false);
  }

  return (
    <div className="card">
      <div className="card-header"><h4>Upload Study Notes</h4></div>
      <div className="card-body" style={{ maxWidth:560 }}>
        {msg && <div className="alert alert-success">{msg}</div>}
        <form onSubmit={handleUpload}>
          <div className="form-group">
            <label className="form-label">Note Title *</label>
            <input className="form-input"
              placeholder="e.g. Chapter 5 - Algebraic Expressions"
              value={form.title}
              onChange={function(e) { setForm(function(f) { return Object.assign({}, f, { title: e.target.value }); }); }}
              required />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-textarea" rows={3}
              placeholder="Brief description..."
              value={form.description}
              onChange={function(e) { setForm(function(f) { return Object.assign({}, f, { description: e.target.value }); }); }} />
          </div>
          <div className="form-group">
            <label className="form-label">Upload File (PDF, DOC, PPT, Image)</label>
            <input type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.png,.jpg"
              onChange={function(e) { setFile(e.target.files[0]); }}
              style={{ display:'block', fontSize:13, color:'var(--neutral-9)' }} />
          </div>
          <button type="submit" className="btn btn-primary" disabled={uploading}>
            {uploading ? 'Uploading...' : 'Upload Note'}
          </button>
        </form>
      </div>
    </div>
  );
}
