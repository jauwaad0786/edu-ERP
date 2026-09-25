import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Navbar  from '../components/Navbar';
import api     from '../api/axios';
import toast   from 'react-hot-toast';
import EntityAuditTimeline from '../components/audit/EntityAuditTimeline';

export default function TeacherProfile() {
  const { id }      = useParams();
  const navigate    = useNavigate();
  const [data,      setData]      = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [tab,       setTab]       = useState('overview');
  const [editSalary,setEditSalary]= useState(false);
  const [newSalary, setNewSalary] = useState('');
  const [saving,    setSaving]    = useState(false);

  const load = () => {
    setLoading(true);
    api.get(`/principal/teachers/${id}/profile`)
      .then(r => { setData(r.data); setNewSalary(r.data?.info?.salary || 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  const saveSalary = async () => {
    setSaving(true);
    try {
      await api.patch(`/principal/teachers/${id}/salary`, { salary: parseFloat(newSalary) });
      toast.success('Salary updated!');
      await load();
      setEditSalary(false);
    } catch {
      toast.error('Failed to update salary');
    }
    setSaving(false);
  };

  const fmt  = n => Number(n || 0).toLocaleString('en-IN');

  const TABS = (info) => [
    { key: 'overview',    label: '📊 Overview'    },
    { key: 'classes',     label: '🏛 Classes'     },
    { key: 'attendance',  label: '📅 Attendance'  },
    ...(info.salary !== null && info.salary !== undefined
      ? [{ key: 'salary', label: '💰 Salary' }]
      : []),
    { key: 'audit',       label: '🛡️ Audit Trail' },
  ];

  if (loading) return (
    <div className="app-shell"><Sidebar />
      <div className="main-content"><Navbar title="Teacher Profile" />
        <div className="page-body" style={{ display:'flex', alignItems:'center', justifyContent:'center', height:300 }}>
          <span style={{ color:'var(--neutral-5)' }}>⏳ Loading...</span>
        </div>
      </div>
    </div>
  );

  if (!data) return (
    <div className="app-shell"><Sidebar />
      <div className="main-content"><Navbar title="Teacher Profile" />
        <div className="page-body"><div className="empty-state"><p>Teacher not found.</p></div></div>
      </div>
    </div>
  );

  const { info, classes_taught, attendance, salary_history } = data;
  const canSeeSalary = info.salary !== null && info.salary !== undefined;

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar title="Teacher Profile" />
        <div className="page-body">

          {/* ── Header ── */}
          <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:24 }}>
            <button onClick={() => navigate(-1)} style={{
              background:'none', border:'1px solid var(--neutral-3)',
              borderRadius:8, padding:'6px 14px', cursor:'pointer',
              fontSize:13, color:'var(--neutral-7)', fontWeight:600,
            }}>← Back</button>
            <div style={{ position:'relative', width:56, height:56, flexShrink:0 }}>
              {info.photo_url
                ? <img src={info.photo_url} alt={info.name}
                    style={{ width:56, height:56, borderRadius:'50%', objectFit:'cover' }} />
                : <div style={{
                    width:56, height:56, borderRadius:'50%',
                    background:'#f3f0ff', color:'#5867e8',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:24, fontWeight:800,
                  }}>{info.name?.charAt(0).toUpperCase()}</div>
              }
              <label style={{
                position:'absolute', bottom:0, right:0,
                background:'#0176d3', borderRadius:'50%',
                width:18, height:18, display:'flex',
                alignItems:'center', justifyContent:'center',
                cursor:'pointer', fontSize:10,
              }} title="Photo upload/change">
                📷
                <input type="file" accept="image/*" style={{ display:'none' }}
                  onChange={async e => {
                    if (!e.target.files[0]) return;
                    const fd = new FormData();
                    fd.append('photo', e.target.files[0]);
                    try {
                      await api.post(`/principal/teachers/${id}/photo`, fd, {
                        headers: { 'Content-Type': 'multipart/form-data' }
                      });
                      toast.success('Photo uploaded successfully!');
                      load();
                    } catch {
                      toast.error('Failed to upload photo');
                    }
                  }} />
              </label>
            </div>
            <div style={{ flex:1 }}>
              <h2 style={{ margin:0, fontSize:20, fontWeight:800 }}>{info.name}</h2>
              <div style={{ fontSize:12, color:'var(--neutral-5)', marginTop:2 }}>
                {info.designation} &nbsp;·&nbsp; {info.department || 'N/A'} &nbsp;·&nbsp; Emp: {info.employee_id || '—'}
              </div>
            </div>
            {/* Salary pill */}
            {canSeeSalary && (
              <div style={{
                background:'#f0fdf4', border:'1px solid #bbf7d0',
                borderRadius:20, padding:'8px 20px', textAlign:'center',
              }}>
                <div style={{ fontSize:11, color:'#64748b' }}>Monthly Salary</div>
                <div style={{ fontSize:18, fontWeight:800, color:'#16a34a' }}>
                  ₹{fmt(info.salary)}
                </div>
              </div>
            )}
          </div>

          {/* ── Tabs ── */}
          <div style={{ display:'flex', borderBottom:'2px solid var(--neutral-2)', marginBottom:20 }}>
            {TABS(info).map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                background:'none', border:'none', cursor:'pointer',
                padding:'10px 18px', fontSize:13, fontWeight:600,
                color: tab===t.key ? '#5867e8' : 'var(--neutral-6)',
                borderBottom: tab===t.key ? '2px solid #5867e8' : '2px solid transparent',
                marginBottom:-2,
              }}>{t.label}</button>
            ))}
          </div>

          {/* ══ OVERVIEW ══ */}
          {tab === 'overview' && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>

              {/* Personal Info */}
              <div className="card" style={{ margin:0 }}>
                <div className="card-header"><h4>👤 Personal Details</h4></div>
                <div className="card-body">
                  {[
                    ['Full Name',      info.name],
                    ['Employee ID',    info.employee_id  || '—'],
                    ['Designation',    info.designation  || '—'],
                    ['Department',     info.department   || '—'],
                    ['Email',          info.email        || '—'],
                    ['Phone',          info.phone        || '—'],
                    ['Joining Date',   info.joining_date || '—'],
                    ['Qualification',  info.qualification|| '—'],
                  ].map(([label, value]) => (
                    <div key={label} style={{
                      display:'flex', justifyContent:'space-between',
                      padding:'8px 0', borderBottom:'1px solid var(--neutral-1)', fontSize:13,
                    }}>
                      <span style={{ color:'var(--neutral-6)', minWidth:130 }}>{label}</span>
                      <span style={{ fontWeight:600, color:'var(--neutral-9)', textAlign:'right' }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Stats */}
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  {[
                    { icon:'🏛', label:'Classes Assigned', value: classes_taught?.length || 0, color:'#0176d3', bg:'#eff6ff' },
                    { icon:'📚', label:'Subjects Teaching', value: info.subjects_count || 0,   color:'#5867e8', bg:'#f5f3ff' },
                    { icon:'📅', label:'Attendance %',
                      value: attendance?.percentage ? `${attendance.percentage}%` : '—',
                      color: (attendance?.percentage || 0) >= 75 ? '#16a34a' : '#dc2626',
                      bg:    (attendance?.percentage || 0) >= 75 ? '#f0fdf4' : '#fef2f2' },
                    ...(canSeeSalary
                      ? [{ icon:'💰', label:'Monthly Salary', value: `₹${fmt(info.salary)}`, color:'#16a34a', bg:'#f0fdf4' }]
                      : []),
                  ].map(s => (
                    <div key={s.label} style={{
                      background:s.bg, borderRadius:10, padding:'14px 16px',
                      border:`1px solid ${s.color}22`,
                    }}>
                      <div style={{ fontSize:20 }}>{s.icon}</div>
                      <div style={{ fontSize:11, color:'#64748b', marginTop:6 }}>{s.label}</div>
                      <div style={{ fontSize:18, fontWeight:800, color:s.color, marginTop:2 }}>{s.value}</div>
                    </div>
                  ))}
                </div>

                {/* Attendance summary mini */}
                <div className="card" style={{ margin:0 }}>
                  <div className="card-header"><h4 style={{ margin:0 }}>📅 Attendance Summary</h4></div>
                  <div style={{ padding:'12px 16px' }}>
                    {[
                      { label:'Present',   value: attendance?.present  || 0, color:'#16a34a', bg:'#f0fdf4' },
                      { label:'Absent',    value: attendance?.absent   || 0, color:'#dc2626', bg:'#fef2f2' },
                      { label:'Half Day',  value: attendance?.half_day || 0, color:'#d97706', bg:'#fffbeb' },
                      { label:'On Leave',  value: attendance?.on_leave || 0, color:'#7c3aed', bg:'#f5f3ff' },
                    ].map(p => (
                      <div key={p.label} style={{
                        display:'flex', justifyContent:'space-between',
                        alignItems:'center', padding:'7px 10px',
                        borderRadius:8, background:p.bg, marginBottom:6,
                      }}>
                        <span style={{ fontSize:13, fontWeight:600, color:p.color }}>{p.label}</span>
                        <span style={{ fontSize:16, fontWeight:800, color:p.color }}>{p.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══ CLASSES ══ */}
          {tab === 'classes' && (
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              {(!classes_taught || classes_taught.length === 0) ? (
                <div className="card" style={{ margin:0 }}>
                  <div className="empty-state" style={{ padding:48 }}>
                    <div className="empty-state-icon">🏛</div>
                    <p>No classes assigned</p>
                  </div>
                </div>
              ) : (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px,1fr))', gap:14 }}>
                  {classes_taught.map((c, i) => (
                    <div key={i} style={{
                      background:'#fff', borderRadius:12, padding:'18px',
                      border:'1px solid var(--neutral-2)', cursor:'pointer',
                    }} onClick={() => navigate(`/classes/${c.class_id}`)}>
                      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
                        <div style={{
                          width:40, height:40, borderRadius:10,
                          background:'var(--blue-10)', color:'var(--blue-80)',
                          display:'flex', alignItems:'center', justifyContent:'center',
                          fontSize:18,
                        }}>🏛</div>
                        <div>
                          <div style={{ fontWeight:700, fontSize:14 }}>{c.class_name} — {c.section}</div>
                          <div style={{ fontSize:11, color:'var(--neutral-5)' }}>{c.session}</div>
                        </div>
                      </div>
                      {[
                        ['Subject',   c.subject_name],
                        ['Students',  c.student_count],
                        ['Role',      c.is_class_teacher ? '⭐ Class Teacher' : 'Subject Teacher'],
                      ].map(([label, value]) => (
                        <div key={label} style={{
                          display:'flex', justifyContent:'space-between',
                          fontSize:12, padding:'5px 0',
                          borderBottom:'1px solid var(--neutral-1)',
                        }}>
                          <span style={{ color:'var(--neutral-5)' }}>{label}</span>
                          <span style={{ fontWeight:600 }}>{value}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ══ ATTENDANCE ══ */}
          {tab === 'attendance' && (
            <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
              <div style={{ display:'flex', gap:14, flexWrap:'wrap' }}>
                {[
                  { label:'Total Days',   value: attendance?.total_marked || 0, bg:'#f1f5f9', color:'#0f172a' },
                  { label:'Present',      value: attendance?.present      || 0, bg:'#dcfce7', color:'#16a34a' },
                  { label:'Absent',       value: attendance?.absent       || 0, bg:'#fee2e2', color:'#dc2626' },
                  { label:'Half Day',     value: attendance?.half_day     || 0, bg:'#fef3c7', color:'#d97706' },
                  { label:'On Leave',     value: attendance?.on_leave     || 0, bg:'#f5f3ff', color:'#7c3aed' },
                  { label:'Attendance %',
                    value:`${attendance?.percentage || 0}%`,
                    bg: (attendance?.percentage||0)>=75 ? '#dcfce7':'#fee2e2',
                    color:(attendance?.percentage||0)>=75 ? '#16a34a':'#dc2626' },
                ].map(p => (
                  <div key={p.label} style={{
                    background:p.bg, borderRadius:12,
                    padding:'12px 20px', textAlign:'center', minWidth:90,
                  }}>
                    <div style={{ fontSize:22, fontWeight:800, color:p.color }}>{p.value}</div>
                    <div style={{ fontSize:11, color:'#64748b', marginTop:2 }}>{p.label}</div>
                  </div>
                ))}
              </div>

              {/* Monthly breakdown */}
              <div className="card" style={{ margin:0 }}>
                <div className="card-header"><h4>📊 Month-wise Summary</h4></div>
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Month</th><th>Present</th><th>Absent</th>
                        <th>Half Day</th><th>On Leave</th><th>%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(attendance?.monthly || []).length === 0 ? (
                        <tr><td colSpan={6} style={{ textAlign:'center', padding:24, color:'var(--neutral-4)' }}>
                          No attendance records found
                        </td></tr>
                      ) : (attendance?.monthly || []).map((m, i) => {
                        const total = m.present + m.absent + m.half_day + m.on_leave;
                        const pct   = total > 0 ? Math.round(m.present / total * 100) : 0;
                        return (
                          <tr key={i}>
                            <td style={{ fontWeight:600 }}>{m.month}</td>
                            <td><span style={{ background:'#dcfce7', color:'#16a34a', padding:'2px 10px', borderRadius:20, fontSize:12, fontWeight:700 }}>{m.present}</span></td>
                            <td><span style={{ background:'#fee2e2', color:'#dc2626', padding:'2px 10px', borderRadius:20, fontSize:12, fontWeight:700 }}>{m.absent}</span></td>
                            <td><span style={{ background:'#fef3c7', color:'#d97706', padding:'2px 10px', borderRadius:20, fontSize:12, fontWeight:700 }}>{m.half_day}</span></td>
                            <td><span style={{ background:'#f5f3ff', color:'#7c3aed', padding:'2px 10px', borderRadius:20, fontSize:12, fontWeight:700 }}>{m.on_leave}</span></td>
                            <td>
                              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                <div style={{ width:60, height:6, background:'#f1f5f9', borderRadius:99 }}>
                                  <div style={{ width:`${pct}%`, height:'100%', borderRadius:99,
                                    background: pct>=75?'#16a34a':pct>=50?'#d97706':'#dc2626' }} />
                                </div>
                                <span style={{ fontSize:12, fontWeight:700 }}>{pct}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ══ SALARY ══ */}
          {tab === 'salary' && (
            <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

              {/* Current salary card */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                <div className="card" style={{ margin:0 }}>
                  <div className="card-header" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <h4 style={{ margin:0 }}>💰 Current Salary</h4>
                    <button
                      onClick={() => setEditSalary(!editSalary)}
                      style={{
                        background:'#eff6ff', color:'#0176d3', border:'none',
                        borderRadius:6, padding:'4px 12px', fontSize:11,
                        fontWeight:700, cursor:'pointer',
                      }}>✏️ Edit</button>
                  </div>
                  <div style={{ padding:'20px' }}>
                    {editSalary ? (
                      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                        <label style={{ fontSize:12, color:'var(--neutral-6)', fontWeight:600 }}>
                          New Monthly Salary (₹)
                        </label>
                        <input
                          type="number"
                          className="form-input"
                          value={newSalary}
                          onChange={e => setNewSalary(e.target.value)}
                          placeholder="e.g. 35000"
                        />
                        <div style={{ display:'flex', gap:8 }}>
                          <button
                            onClick={saveSalary}
                            disabled={saving}
                            style={{
                              flex:1, padding:'8px', background:'#16a34a',
                              color:'#fff', border:'none', borderRadius:8,
                              cursor:'pointer', fontSize:12, fontWeight:700,
                            }}>{saving ? 'Saving...' : '✅ Save'}</button>
                          <button
                            onClick={() => { setEditSalary(false); setNewSalary(info.salary); }}
                            style={{
                              flex:1, padding:'8px', background:'#f1f5f9',
                              color:'#64748b', border:'none', borderRadius:8,
                              cursor:'pointer', fontSize:12, fontWeight:700,
                            }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ textAlign:'center', padding:'10px 0' }}>
                        <div style={{ fontSize:36, fontWeight:800, color:'#16a34a' }}>
                          ₹{fmt(info.salary)}
                        </div>
                        <div style={{ fontSize:12, color:'var(--neutral-5)', marginTop:4 }}>per month</div>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  {[
                    { label:'Annual CTC',    value:`₹${fmt((info.salary||0)*12)}`, color:'#0176d3', bg:'#eff6ff' },
                    { label:'Designation',   value: info.designation || '—',       color:'#5867e8', bg:'#f5f3ff' },
                    { label:'Department',    value: info.department  || '—',       color:'#0f172a', bg:'#f8fafc' },
                    { label:'Joining Date',  value: info.joining_date|| '—',       color:'#0f172a', bg:'#f8fafc' },
                  ].map(s => (
                    <div key={s.label} style={{
                      background:s.bg, borderRadius:10, padding:'12px 16px',
                      display:'flex', justifyContent:'space-between', alignItems:'center',
                    }}>
                      <span style={{ fontSize:12, color:'var(--neutral-5)' }}>{s.label}</span>
                      <span style={{ fontSize:13, fontWeight:800, color:s.color }}>{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Salary history */}
              <div className="card" style={{ margin:0 }}>
                <div className="card-header"><h4>📋 Salary History</h4></div>
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Month</th><th>Amount</th><th>Status</th>
                        <th>Payment Date</th><th>Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(salary_history || []).length === 0 ? (
                        <tr><td colSpan={5} style={{ textAlign:'center', padding:24, color:'var(--neutral-4)' }}>
                          No salary records found — contact administration to add record
                        </td></tr>
                      ) : (salary_history || []).map((s, i) => (
                        <tr key={i}>
                          <td style={{ fontWeight:600 }}>{s.month}</td>
                          <td style={{ fontWeight:700, color:'#16a34a' }}>₹{fmt(s.amount)}</td>
                          <td>
                            <span style={{
                              padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700,
                              background: s.status==='PAID'?'#dcfce7':'#fee2e2',
                              color:      s.status==='PAID'?'#16a34a':'#dc2626',
                            }}>{s.status}</span>
                          </td>
                          <td style={{ fontSize:12, color:'var(--neutral-6)' }}>{s.payment_date || '—'}</td>
                          <td style={{ fontSize:12, color:'var(--neutral-6)' }}>{s.note || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── Audit Trail ── */}
          {tab === 'audit' && (
            <EntityAuditTimeline entityType="teacher" entityId={id} />
          )}

        </div>
      </div>
    </div>
  );
}
