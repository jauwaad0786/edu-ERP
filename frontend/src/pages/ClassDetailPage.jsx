import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Navbar  from '../components/Navbar';
import api     from '../api/axios';
import toast   from 'react-hot-toast';

export default function ClassDetailPage() {
  const { id }       = useParams();
  const navigate     = useNavigate();
  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [subjFilter, setSubjFilter] = useState('all');
  const [teachers,   setTeachers]   = useState([]);
  const [assigning,  setAssigning]  = useState(false);
  const [selTeacher, setSelTeacher] = useState('');

  // Add subject modal state
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [subForm, setSubForm] = useState({ name: '', code: '', teacher_id: '', max_marks: 100, pass_marks: 33 });
  const [subSaving, setSubSaving] = useState(false);

  const loadData = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get(`/principal/classes/${id}/detail`),
      api.get('/principal/teachers'),
    ]).then(([d, t]) => {
      setData(d.data);
      setTeachers(Array.isArray(t.data) ? t.data : []);
      setSelTeacher(d.data?.class_teacher?.teacher_id || '');
    }).catch((err) => {
      console.error(err);
      toast.error('Failed to load class details');
    }).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const assignTeacher = async () => {
    if (!selTeacher) return;
    setAssigning(true);
    try {
      await api.post(`/principal/classes/${id}/assign-teacher`, { teacher_id: selTeacher });
      toast.success('✅ Class teacher assigned successfully!');
      loadData();
    } catch {
      toast.error('Teacher assign nahi hua, dobara try karo');
    }
    setAssigning(false);
  };

  const handleAddSubject = async (e) => {
    e.preventDefault();
    if (!subForm.name.trim()) {
      toast.error('Subject name is required');
      return;
    }
    setSubSaving(true);
    try {
      await api.post('/principal/subjects', {
        name: subForm.name.trim(),
        code: subForm.code ? subForm.code.trim().toUpperCase() : '',
        class_id: Number(id),
        teacher_id: subForm.teacher_id ? Number(subForm.teacher_id) : null,
        max_marks: Number(subForm.max_marks) || 100,
        pass_marks: Number(subForm.pass_marks) || 33,
      });
      toast.success(`✅ Subject '${subForm.name}' added to this class!`);
      setShowAddSubject(false);
      setSubForm({ name: '', code: '', teacher_id: '', max_marks: 100, pass_marks: 33 });
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Subject add nahi hua');
    }
    setSubSaving(false);
  };

  const handleDeleteSubject = async (subjId, subjName) => {
    if (!window.confirm(`Delete subject '${subjName}' from this class?`)) return;
    try {
      await api.delete(`/principal/subjects/${subjId}`);
      toast.success(`Subject '${subjName}' deleted`);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Delete failed');
    }
  };

  const fmt  = n => Number(n || 0).toLocaleString('en-IN');
  const fmtK = n => {
    n = Number(n || 0);
    if (n >= 100000) return `₹${(n/100000).toFixed(1)}L`;
    if (n >= 1000)   return `₹${(n/1000).toFixed(0)}K`;
    return `₹${n}`;
  };

  if (loading) return (
    <div className="app-shell"><Sidebar />
      <div className="main-content"><Navbar title="Class Detail" />
        <div className="page-body" style={{ display:'flex', alignItems:'center', justifyContent:'center', height:300 }}>
          <span style={{ color:'var(--neutral-5)', fontSize:14 }}>⏳ Loading class details...</span>
        </div>
      </div>
    </div>
  );

  if (!data) return (
    <div className="app-shell"><Sidebar />
      <div className="main-content"><Navbar title="Class Detail" />
        <div className="page-body"><div className="empty-state"><p>Class nahi mili.</p></div></div>
      </div>
    </div>
  );

  const { fees, marks, attendance_today, class_teacher, subjects = [] } = data;
  const examTypes = ['all', ...(marks?.exam_types || [])];
  const subjectToppers = marks?.subject_toppers || {};

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar title={`Class Details — ${data.class_name} (${data.section})`} />
        <div className="page-body">

          {/* ── Header ── */}
          <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:22 }}>
            <button onClick={() => navigate('/classes')} style={{
              background:'white', border:'1px solid #cbd5e1',
              borderRadius:8, padding:'6px 14px', cursor:'pointer',
              fontSize:13, color:'#334155', fontWeight:600,
            }}>← Back to Classes</button>
            <div style={{
              width:52, height:52, borderRadius:14,
              background:'var(--blue-10)', color:'var(--blue-80)',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:24, flexShrink:0,
            }}>🏛</div>
            <div style={{ flex:1 }}>
              <h2 style={{ margin:0, fontSize:22, fontWeight:800, color:'#0f172a' }}>
                {data.class_name} — Section {data.section}
              </h2>
              <div style={{ fontSize:12, color:'#64748b', marginTop:2, display:'flex', gap:10 }}>
                <span>Session: <strong>{data.session || '2024-25'}</strong></span>
                <span>·</span>
                <span><strong>{data.total_students}</strong> Students</span>
                <span>·</span>
                <span><strong>{subjects.length}</strong> Subjects Configured</span>
              </div>
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button
                className="btn btn-neutral btn-sm"
                onClick={() => navigate(`/timetable?class_id=${id}`)}>
                📅 View Timetable
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => navigate(`/students?class_id=${id}`)}>
                👥 View All Students
              </button>
            </div>
          </div>

          {/* ── Top Stats Row ── */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:14, marginBottom:22 }}>
            {[
              { icon:'👨‍🎓', label:'Total Students', value: data.total_students, color:'#0176d3', bg:'#eff6ff' },
              { icon:'📚', label:'Class Subjects', value: subjects.length, color:'#7c3aed', bg:'#f5f3ff' },
              { icon:'✅', label:'Present Today',  value: attendance_today?.present ?? 0, color:'#16a34a', bg:'#f0fdf4' },
              { icon:'📊', label:'Avg Marks',
                value: marks?.avg_percentage ? `${marks.avg_percentage}%` : '—',
                color:'#d97706', bg:'#fffbeb' },
            ].map(s => (
              <div key={s.label} style={{
                background:s.bg, borderRadius:12, padding:'16px 20px',
                border:`1px solid ${s.color}22`,
              }}>
                <div style={{ fontSize:22 }}>{s.icon}</div>
                <div style={{ fontSize:11, color:'#64748b', marginTop:6 }}>{s.label}</div>
                <div style={{ fontSize:24, fontWeight:800, color:s.color, marginTop:2 }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* ── Main Grid ── */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 340px', gap:20, alignItems:'start' }}>

            {/* LEFT COLUMN */}
            <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

              {/* ══ CLASS SUBJECTS CARD ══ */}
              <div className="card" style={{ margin:0, borderRadius:12, boxShadow:'0 1px 4px rgba(0,0,0,0.05)' }}>
                <div className="card-header" style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:'#f8fafc', padding:'14px 20px' }}>
                  <div>
                    <h4 style={{ margin:0, fontSize:15, fontWeight:800, color:'#0f172a' }}>
                      📚 Subjects Assigned to {data.class_name} ({data.section})
                    </h4>
                    <span style={{ fontSize:11, color:'#64748b' }}>
                      {subjects.length} active subject(s) configured for this section
                    </span>
                  </div>
                  <div style={{ display:'flex', gap:8 }}>
                    <button
                      className="btn btn-neutral btn-sm"
                      onClick={() => navigate('/subjects')}
                      style={{ fontSize:11, padding:'5px 10px' }}
                    >
                      All Subjects →
                    </button>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => setShowAddSubject(true)}
                      style={{ fontSize:11, fontWeight:700, padding:'5px 12px' }}
                    >
                      + Add Subject
                    </button>
                  </div>
                </div>

                <div className="card-body" style={{ padding:0 }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                    <thead>
                      <tr style={{ background:'#f1f5f9', borderBottom:'1px solid #e2e8f0' }}>
                        <th style={{ padding:'10px 16px', textAlign:'left', fontWeight:700, color:'#475569' }}>Subject</th>
                        <th style={{ padding:'10px 14px', textAlign:'left', fontWeight:700, color:'#475569' }}>Code</th>
                        <th style={{ padding:'10px 14px', textAlign:'left', fontWeight:700, color:'#475569' }}>Assigned Teacher</th>
                        <th style={{ padding:'10px 14px', textAlign:'center', fontWeight:700, color:'#475569' }}>Max / Pass</th>
                        <th style={{ padding:'10px 14px', textAlign:'center', fontWeight:700, color:'#475569' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subjects.length === 0 && (
                        <tr>
                          <td colSpan={5} style={{ textAlign:'center', padding:'36px 20px', color:'#94a3b8' }}>
                            <div style={{ fontSize:32, marginBottom:6 }}>📘</div>
                            <div style={{ fontWeight:700, color:'#475569' }}>No subjects added to this class yet</div>
                            <div style={{ fontSize:12, color:'#94a3b8', margin:'6px 0 12px' }}>
                              Add subjects so they appear in exams, timetable, and report cards.
                            </div>
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => setShowAddSubject(true)}
                            >
                              + Add First Subject
                            </button>
                          </td>
                        </tr>
                      )}

                      {subjects.map((s, idx) => (
                        <tr key={s.id || idx} style={{ borderBottom:'1px solid #f1f5f9', background: idx % 2 === 1 ? '#fafbfd' : 'white' }}>
                          <td style={{ padding:'11px 16px', fontWeight:700, color:'#0f172a' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                              <span style={{ fontSize:15 }}>📘</span>
                              <span>{s.name}</span>
                            </div>
                          </td>
                          <td style={{ padding:'11px 14px' }}>
                            {s.code ? (
                              <span style={{ background:'#f1f5f9', color:'#475569', padding:'2px 6px', borderRadius:4, fontSize:11, fontWeight:700 }}>
                                {s.code}
                              </span>
                            ) : (
                              <span style={{ color:'#cbd5e1' }}>—</span>
                            )}
                          </td>
                          <td style={{ padding:'11px 14px' }}>
                            {s.teacher_name ? (
                              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                                <span>👨‍🏫</span>
                                <span style={{ fontWeight:600, color:'#1e293b', fontSize:12 }}>{s.teacher_name}</span>
                              </div>
                            ) : (
                              <span style={{ color:'#d97706', fontSize:11, fontWeight:600, background:'#fffbeb', padding:'2px 6px', borderRadius:4 }}>
                                ⚠️ No Teacher
                              </span>
                            )}
                          </td>
                          <td style={{ padding:'11px 14px', textAlign:'center' }}>
                            <span style={{ fontSize:12, fontWeight:700, color:'#0176d3' }}>{s.max_marks || 100}</span>
                            <span style={{ color:'#94a3b8', margin:'0 3px' }}>/</span>
                            <span style={{ fontSize:11, color:'#64748b' }}>{s.pass_marks || 33}</span>
                          </td>
                          <td style={{ padding:'11px 14px', textAlign:'center' }}>
                            <button
                              type="button"
                              title="Delete Subject"
                              onClick={() => handleDeleteSubject(s.id, s.name)}
                              style={{
                                background:'none', border:'none', color:'#ef4444',
                                cursor:'pointer', fontSize:14, padding:'4px 6px', borderRadius:4,
                              }}
                              onMouseEnter={e => e.currentTarget.style.background = '#fee2e2'}
                              onMouseLeave={e => e.currentTarget.style.background = 'none'}
                            >
                              🗑
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Fee Bar Chart */}
              <div className="card" style={{ margin:0, borderRadius:12 }}>
                <div className="card-header" style={{ background:'#f8fafc', padding:'14px 20px' }}>
                  <h4 style={{ margin:0, fontSize:15, fontWeight:800 }}>💰 Fee Overview</h4>
                </div>
                <div style={{ padding:'16px 20px' }}>
                  {[
                    { label:'Total Students', value: data.total_students,    max: data.total_students, color:'#0176d3', bg:'#eff6ff' },
                    { label:'Fees Paid',       value: fees?.paid_count    ?? 0, max: data.total_students, color:'#16a34a', bg:'#f0fdf4' },
                    { label:'Fees Pending',    value: fees?.pending_count ?? 0, max: data.total_students, color:'#dc2626', bg:'#fef2f2' },
                  ].map(b => (
                    <div key={b.label} style={{ marginBottom:14 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4, fontSize:13 }}>
                        <span style={{ fontWeight:600, color:'var(--neutral-7)' }}>{b.label}</span>
                        <span style={{ fontWeight:800, color:b.color }}>{b.value}</span>
                      </div>
                      <div style={{ height:10, background:'#f1f5f9', borderRadius:99 }}>
                        <div style={{
                          width: b.max > 0 ? `${Math.round(b.value/b.max*100)}%` : '0%',
                          height:'100%', borderRadius:99, background:b.color,
                          transition:'width 0.5s',
                        }}></div>
                      </div>
                    </div>
                  ))}

                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginTop:16 }}>
                    {[
                      { label:'Total Due',   value: fmtK(fees?.total_due),  color:'#0176d3' },
                      { label:'Collected',   value: fmtK(fees?.total_paid), color:'#16a34a' },
                      { label:'Pending Amt', value: fmtK(fees?.pending),    color:'#dc2626' },
                    ].map(f => (
                      <div key={f.label} style={{ background:'#f8fafc', borderRadius:8, padding:'10px 12px', textAlign:'center' }}>
                        <div style={{ fontSize:14, fontWeight:800, color:f.color }}>{f.value}</div>
                        <div style={{ fontSize:10, color:'#94a3b8', marginTop:2 }}>{f.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Topper + Subject toppers */}
              <div className="card" style={{ margin:0, borderRadius:12 }}>
                <div className="card-header" style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:'#f8fafc', padding:'14px 20px' }}>
                  <h4 style={{ margin:0, fontSize:15, fontWeight:800 }}>🏆 Academic Performance & Toppers</h4>
                  <select
                    className="form-select"
                    style={{ width:160, fontSize:12 }}
                    value={subjFilter}
                    onChange={e => setSubjFilter(e.target.value)}>
                    {examTypes.map(et => (
                      <option key={et} value={et}>{et === 'all' ? 'All Exams' : et}</option>
                    ))}
                  </select>
                </div>

                {/* Overall topper */}
                {marks?.topper ? (
                  <div style={{
                    margin:'12px 20px', padding:'14px 16px',
                    background:'linear-gradient(135deg, #fefce8, #fef9c3)',
                    border:'1px solid #fde047', borderRadius:12,
                    display:'flex', alignItems:'center', gap:12,
                  }}>
                    <div style={{ fontSize:32 }}>🥇</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:800, fontSize:15, color:'#713f12' }}>
                        {marks.topper.name}
                      </div>
                      <div style={{ fontSize:12, color:'#92400e', marginTop:2 }}>
                        Roll: {marks.topper.roll_number || '—'} &nbsp;·&nbsp;
                        {marks.topper.obtained}/{marks.topper.max} marks
                      </div>
                    </div>
                    <div style={{
                      background:'#eab308', color:'#fff',
                      padding:'6px 14px', borderRadius:20, fontSize:14, fontWeight:800,
                    }}>{marks.topper.percentage}%</div>
                    <button
                      onClick={() => navigate(`/students/${marks.topper.student_id}`)}
                      style={{
                        background:'#0176d3', color:'#fff', border:'none',
                        borderRadius:8, padding:'6px 12px', fontSize:11,
                        fontWeight:700, cursor:'pointer',
                      }}>View Profile</button>
                  </div>
                ) : (
                  <div style={{ padding:'20px', textAlign:'center', color:'var(--neutral-4)', fontSize:13 }}>
                    Koi exam marks data nahi abhi
                  </div>
                )}
              </div>

            </div>

            {/* RIGHT SIDEBAR */}
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

              {/* Class Teacher Card */}
              <div className="card" style={{ margin:0, borderRadius:12 }}>
                <div className="card-header" style={{ background:'#f8fafc', padding:'14px 18px' }}>
                  <h4 style={{ margin:0, fontSize:14, fontWeight:800 }}>👩‍🏫 Assigned Class Teacher</h4>
                </div>

                {class_teacher ? (
                  <div style={{ padding:'16px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
                      <div style={{
                        width:44, height:44, borderRadius:'50%',
                        background:'#f3f0ff', color:'#5867e8',
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:18, fontWeight:800, flexShrink:0,
                      }}>{class_teacher.name?.charAt(0).toUpperCase()}</div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:700, fontSize:14, color:'#0f172a' }}>{class_teacher.name}</div>
                        <div style={{ fontSize:12, color:'#64748b' }}>
                          {class_teacher.designation || 'Class Teacher'}
                        </div>
                      </div>
                    </div>
                    {[
                      ['🪪 Emp ID',    class_teacher.employee_id || '—'],
                      ['🏢 Dept',      class_teacher.department  || '—'],
                      ['📧 Email',     class_teacher.email       || '—'],
                    ].map(([label, value]) => (
                      <div key={label} style={{
                        display:'flex', justifyContent:'space-between',
                        padding:'6px 0', borderBottom:'1px solid #f1f5f9',
                        fontSize:12,
                      }}>
                        <span style={{ color:'#64748b' }}>{label}</span>
                        <span style={{ fontWeight:600, color:'#1e293b' }}>{value}</span>
                      </div>
                    ))}
                    <button
                      onClick={() => navigate(`/teachers/${class_teacher.teacher_id}`)}
                      style={{
                        width:'100%', marginTop:12, padding:'7px',
                        background:'#eff6ff', color:'#0176d3',
                        border:'none', borderRadius:6, cursor:'pointer',
                        fontSize:12, fontWeight:700,
                      }}>👤 View Teacher Profile</button>
                  </div>
                ) : (
                  <div style={{ padding:'16px', textAlign:'center', color:'#94a3b8', fontSize:13 }}>
                    ⚠️ No Class Teacher Assigned
                  </div>
                )}

                {/* Assign teacher dropdown */}
                <div style={{ padding:'12px 16px 16px', borderTop:'1px solid #f1f5f9', background:'#fafafa' }}>
                  <div style={{ fontSize:11, color:'#64748b', fontWeight:700, marginBottom:6 }}>
                    CHANGE CLASS TEACHER
                  </div>
                  <select
                    className="form-select"
                    style={{ fontSize:12, marginBottom:8, width:'100%' }}
                    value={selTeacher}
                    onChange={e => setSelTeacher(e.target.value)}>
                    <option value="">Select teacher...</option>
                    {teachers.map(t => (
                      <option key={t.id} value={t.id}>{t.name} {t.department ? `(${t.department})` : ''}</option>
                    ))}
                  </select>
                  <button
                    onClick={assignTeacher}
                    disabled={assigning || !selTeacher}
                    style={{
                      width:'100%', padding:'7px',
                      background: assigning ? '#94a3b8' : '#0176d3',
                      color:'#fff', border:'none', borderRadius:6,
                      cursor: assigning ? 'default' : 'pointer',
                      fontSize:12, fontWeight:700,
                    }}>
                    {assigning ? 'Saving...' : '💾 Save Class Teacher'}
                  </button>
                </div>
              </div>

              {/* Today's Attendance Mini */}
              <div className="card" style={{ margin:0, borderRadius:12 }}>
                <div className="card-header" style={{ background:'#f8fafc', padding:'14px 18px' }}>
                  <h4 style={{ margin:0, fontSize:14, fontWeight:800 }}>📅 Attendance Today</h4>
                </div>
                <div style={{ padding:'14px 16px' }}>
                  {[
                    { label:'Present',    value: attendance_today?.present    ?? 0, color:'#16a34a', bg:'#f0fdf4' },
                    { label:'Absent',     value: attendance_today?.absent     ?? 0, color:'#dc2626', bg:'#fef2f2' },
                    { label:'Not Marked', value: attendance_today?.not_marked ?? 0, color:'#d97706', bg:'#fffbeb' },
                  ].map(p => (
                    <div key={p.label} style={{
                      display:'flex', justifyContent:'space-between', alignItems:'center',
                      padding:'8px 10px', borderRadius:8, background:p.bg,
                      marginBottom:8,
                    }}>
                      <span style={{ fontSize:12, color:p.color, fontWeight:700 }}>{p.label}</span>
                      <span style={{ fontSize:16, fontWeight:800, color:p.color }}>{p.value}</span>
                    </div>
                  ))}
                  <button
                    onClick={() => navigate(`/attendance?class_id=${id}`)}
                    style={{
                      width:'100%', marginTop:4, padding:'7px',
                      background:'#f1f5f9', color:'#0176d3',
                      border:'none', borderRadius:6, cursor:'pointer',
                      fontSize:12, fontWeight:700,
                    }}>📋 Mark Attendance</button>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* Add Subject Modal */}
      {showAddSubject && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowAddSubject(false)}>
          <div className="modal" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h3>➕ Add Subject to {data.class_name} ({data.section})</h3>
              <button className="modal-close" onClick={() => setShowAddSubject(false)}>✕</button>
            </div>
            <form onSubmit={handleAddSubject}>
              <div className="modal-body" style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize:12, fontWeight:700 }}>Subject Name *</label>
                  <input
                    className="form-input"
                    required
                    placeholder="e.g. Mathematics, Science, Hindi"
                    value={subForm.name}
                    onChange={e => setSubForm(f => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize:12, fontWeight:700 }}>Subject Code</label>
                  <input
                    className="form-input"
                    placeholder="e.g. MTH101"
                    value={subForm.code}
                    onChange={e => setSubForm(f => ({ ...f, code: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize:12, fontWeight:700 }}>Assign Subject Teacher</label>
                  <select
                    className="form-select"
                    value={subForm.teacher_id}
                    onChange={e => setSubForm(f => ({ ...f, teacher_id: e.target.value }))}
                  >
                    <option value="">-- Select Teacher (Optional) --</option>
                    {teachers.map(t => (
                      <option key={t.id} value={t.id}>{t.name} {t.department ? `(${t.department})` : ''}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize:12, fontWeight:700 }}>Max Marks</label>
                    <input
                      type="number"
                      className="form-input"
                      value={subForm.max_marks}
                      onChange={e => setSubForm(f => ({ ...f, max_marks: Number(e.target.value) }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize:12, fontWeight:700 }}>Pass Marks</label>
                    <input
                      type="number"
                      className="form-input"
                      value={subForm.pass_marks}
                      onChange={e => setSubForm(f => ({ ...f, pass_marks: Number(e.target.value) }))}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-neutral" onClick={() => setShowAddSubject(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={subSaving}>
                  {subSaving ? 'Saving...' : '+ Add Subject'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
