import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Navbar  from '../components/Navbar';
import api     from '../api/axios';
import toast   from 'react-hot-toast';

const STATUS_COLOR = {
  PRESENT:    { bg: '#dcfce7', color: '#16a34a', label: 'P' },
  ABSENT:     { bg: '#fee2e2', color: '#dc2626', label: 'A' },
  LATE:       { bg: '#fef3c7', color: '#d97706', label: 'L' },
  NOT_MARKED: { bg: '#f1f5f9', color: '#94a3b8', label: '—' },
};
function MarksTab({ studentId, exams }) {
  const [marksList, setMarksList] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [selExam, setSelExam]     = useState('');

  useEffect(() => {
    setLoading(true);
    api.get(`/principal/students/${studentId}/profile`)
      .then(r => {
        const raw = r.data?.exams || [];
        setMarksList(raw);
        if (raw.length) setSelExam(raw[0].exam_type);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [studentId]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--neutral-5)' }}>⏳ Loading marks...</div>;

  if (!marksList.length) return (
    <div className="card" style={{ margin: 0 }}>
      <div className="empty-state" style={{ padding: 48 }}>
        <div className="empty-state-icon">📝</div>
        <p>Koi marks record nahi mila</p>
      </div>
    </div>
  );

  const exam = marksList.find(e => e.exam_type === selExam) || marksList[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Exam selector */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {marksList.map(e => (
          <button key={e.exam_type} onClick={() => setSelExam(e.exam_type)}
            style={{
              padding: '7px 16px', borderRadius: 20, fontSize: 12, fontWeight: 700,
              border: '2px solid', cursor: 'pointer',
              borderColor: selExam === e.exam_type ? '#0176d3' : '#e2e8f0',
              background:  selExam === e.exam_type ? '#0176d3' : '#fff',
              color:       selExam === e.exam_type ? '#fff' : '#64748b',
            }}>
            {e.exam_type}
          </button>
        ))}
      </div>

      {exam && (
        <div className="card" style={{ margin: 0 }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4>📝 {exam.exam_type}</h4>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: 'var(--neutral-6)' }}>
                Total: <strong>{exam.total_obtained}/{exam.total_max}</strong>
              </span>
              <span style={{
                padding: '4px 14px', borderRadius: 20, fontSize: 12, fontWeight: 800,
                background: exam.avg_pct >= 60 ? '#dcfce7' : exam.avg_pct >= 33 ? '#fef3c7' : '#fee2e2',
                color:      exam.avg_pct >= 60 ? '#16a34a' : exam.avg_pct >= 33 ? '#d97706' : '#dc2626',
              }}>{exam.avg_pct}% avg</span>
              <span style={{
                padding: '4px 14px', borderRadius: 20, fontSize: 12, fontWeight: 800,
                background: exam.avg_pct >= 33 ? '#dcfce7' : '#fee2e2',
                color:      exam.avg_pct >= 33 ? '#16a34a' : '#dc2626',
              }}>{exam.avg_pct >= 33 ? 'PASS ✅' : 'FAIL ❌'}</span>
            </div>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr><th>Subject</th><th>Marks</th><th>Max</th><th>%</th><th>Grade</th><th>Status</th></tr>
              </thead>
              <tbody>
                {(exam.subjects || []).map((s, j) => (
                  <tr key={j}>
                    <td style={{ fontWeight: 600 }}>{s.subject}</td>
                    <td style={{ fontWeight: 700, color: s.percentage >= 33 ? '#16a34a' : '#dc2626' }}>
                      {s.marks_obtained}
                    </td>
                    <td style={{ color: 'var(--neutral-6)' }}>{s.max_marks}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 60, height: 6, background: '#f1f5f9', borderRadius: 99 }}>
                          <div style={{
                            width: `${Math.min(s.percentage, 100)}%`, height: '100%', borderRadius: 99,
                            background: s.percentage >= 60 ? '#16a34a' : s.percentage >= 33 ? '#d97706' : '#dc2626',
                          }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700 }}>{s.percentage}%</span>
                      </div>
                    </td>
                    <td><span className={`badge ${s.percentage>=60?'badge-success':s.percentage>=33?'badge-warning':'badge-error'}`}>{s.grade || '—'}</span></td>
                    <td>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                        background: s.percentage >= 33 ? '#dcfce7' : '#fee2e2',
                        color:      s.percentage >= 33 ? '#16a34a' : '#dc2626',
                      }}>{s.percentage >= 33 ? 'Pass' : 'Fail'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function HostelTab({ studentId }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(`/hostel/students/${studentId}/hostel-status`)
      .then(r => setStatus(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [studentId]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--neutral-5)' }}>⏳ Loading...</div>;

  const current = status?.current;

  if (!current) return (
    <div className="card" style={{ margin: 0 }}>
      <div className="empty-state" style={{ padding: 48 }}>
        <div className="empty-state-icon">🏨</div>
        <p>Ye student kisi hostel mein allocated nahi hai</p>
      </div>
    </div>
  );

  return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="card" style={{ margin: 0 }}>
          <div className="card-header"><h4>🏨 Current Hostel Allocation</h4></div>
          <div className="card-body">
            {[
              ['Hostel',         current.hostel_name || '—'],
              ['Building',       current.building_name || '—'],
              ['Floor',          current.floor_name || '—'],
              ['Room Number',    current.room_number || '—'],
              ['Bed',            current.bed_number ? `Bed-${current.bed_number}` : '—'],
              ['Room Type',      current.is_ac ? 'AC' : 'Non-AC'],
              ['Sharing Type',   current.room_type || '—'],
              ['Admission Date', current.admission_date || '—'],
              ['Hostel Fee',     current.fee_amount_due ? `₹${current.fee_amount_due} (${current.fee_status || 'PENDING'})` : 'Not generated yet'],
            ].map(([label, value]) => (
            <div key={label} style={{
              display: 'flex', justifyContent: 'space-between',
              padding: '8px 0', borderBottom: '1px solid var(--neutral-1)', fontSize: 13,
            }}>
              <span style={{ color: 'var(--neutral-6)' }}>{label}</span>
              <span style={{ fontWeight: 600 }}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {status.history?.length > 1 && (
        <div className="card" style={{ margin: 0 }}>
          <div className="card-header"><h4>📜 Allocation History</h4></div>
          <div className="table-container">
            <table>
              <thead>
                <tr><th>From</th><th>To</th><th>Status</th></tr>
              </thead>
              <tbody>
                {status.history.map(h => (
                  <tr key={h.id}>
                    <td style={{ fontSize: 12 }}>{h.admission_date || '—'}</td>
                    <td style={{ fontSize: 12 }}>{h.vacate_date || 'Active'}</td>
                    <td>
                      <span className={`badge ${h.status === 'ACTIVE' ? 'badge-success' : 'badge-info'}`}>
                        {h.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function TransportTab({ studentId }) {
  const [transportInfo, setTransportInfo] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      api.get(`/transport/students/browse?search=${studentId}&per_page=1`),
      api.get(`/transport/gps/parent/child/${studentId}/history`)
    ]).then(([stRes, histRes]) => {
      if (stRes.status === 'fulfilled' && stRes.value?.data?.data?.length > 0) {
        setTransportInfo(stRes.value.data.data[0]);
      }
      if (histRes.status === 'fulfilled') {
        setHistory(histRes.value?.data?.data?.events || []);
      }
    }).finally(() => setLoading(false));
  }, [studentId]);

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--neutral-5)' }}>⏳ Loading transport details...</div>;
  }

  if (!transportInfo) {
    return (
      <div className="card" style={{ margin: 0 }}>
        <div className="empty-state" style={{ padding: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🚌</div>
          <h4 style={{ margin: 0, color: 'var(--neutral-8)' }}>Not Enrolled in School Transport</h4>
          <p style={{ color: 'var(--neutral-5)', marginTop: 4 }}>This student does not have an active bus or vehicle route assignment.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Route & Vehicle Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <div className="card" style={{ margin: 0, borderLeft: '4px solid #4f46e5' }}>
          <div style={{ fontSize: 11, color: 'var(--neutral-5)', fontWeight: 600 }}>ASSIGNED VEHICLE</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#4f46e5', marginTop: 4 }}>
            🚌 {transportInfo.vehicle_number || 'Bus'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--neutral-6)', marginTop: 2 }}>{transportInfo.route_name || 'Assigned Route'}</div>
        </div>

        <div className="card" style={{ margin: 0, borderLeft: '4px solid #059669' }}>
          <div style={{ fontSize: 11, color: 'var(--neutral-5)', fontWeight: 600 }}>DRIVER DETAILS</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#059669', marginTop: 4 }}>
            👨‍✈️ {transportInfo.driver_name || 'Assigned Driver'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--neutral-6)', marginTop: 2 }}>
            {transportInfo.driver_phone ? `📞 ${transportInfo.driver_phone}` : 'Contact via Transport Desk'}
          </div>
        </div>

        <div className="card" style={{ margin: 0, borderLeft: '4px solid #d97706' }}>
          <div style={{ fontSize: 11, color: 'var(--neutral-5)', fontWeight: 600 }}>PICKUP & DROP STOPS</div>
          <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4, color: 'var(--neutral-8)' }}>
            🟢 Pickup: {transportInfo.pickup_stop_name || 'Default Route Stop'}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2, color: 'var(--neutral-8)' }}>
            🔴 Drop: {transportInfo.drop_stop_name || 'Default Route Stop'}
          </div>
        </div>
      </div>

      {/* Live Status & History Table */}
      <div className="card" style={{ margin: 0 }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4>📍 Recent Transport Activity & Trip Events</h4>
          <a
            href="/transport/parent"
            style={{
              background: '#eef2ff', color: '#4f46e5', padding: '6px 12px', borderRadius: 8,
              fontSize: 12, fontWeight: 700, textDecoration: 'none'
            }}
          >
            Live Bus Tracker →
          </a>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Event Type</th>
                <th>Stop / Location</th>
                <th>Vehicle & Driver</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: 24, color: 'var(--neutral-4)' }}>
                    No trip events recorded recently.
                  </td>
                </tr>
              ) : (
                history.map(ev => (
                  <tr key={ev.id}>
                    <td>
                      <span style={{
                        padding: '3px 8px', borderRadius: 12, fontSize: 11, fontWeight: 800,
                        background: ev.event_type === 'PICKED_UP' ? '#dcfce7' : ev.event_type === 'DROPPED_OFF' ? '#e0e7ff' : '#fee2e2',
                        color: ev.event_type === 'PICKED_UP' ? '#15803d' : ev.event_type === 'DROPPED_OFF' ? '#4338ca' : '#b91c1c',
                      }}>
                        {ev.event_type === 'PICKED_UP' ? '🟢 Picked Up' : ev.event_type === 'DROPPED_OFF' ? '🏁 Dropped Off' : '❌ Absent'}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{ev.stop_name || 'En Route'}</td>
                    <td style={{ color: 'var(--neutral-6)' }}>
                      {ev.vehicle_number ? `Bus: ${ev.vehicle_number}` : ''} {ev.driver_name ? `(${ev.driver_name})` : ''}
                    </td>
                    <td style={{ color: 'var(--neutral-6)', fontSize: 12 }}>
                      {ev.recorded_at ? new Date(ev.recorded_at).toLocaleString('en-IN') : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function StudentProfile() {
  const { id }     = useParams();
  const navigate   = useNavigate();
  const [data,     setData]     = useState(null);
  const [tab,      setTab]      = useState('overview');
  const [loading,  setLoading]  = useState(true);
  const [dlLoading,setDlLoading]= useState(false);

  const [examMarks, setExamMarks] = useState([]);

  // ── Documents tab state ──
  const [docsData, setDocsData]       = useState(null);
  const [docsLoading, setDocsLoading] = useState(false);
  const [showIssueModal, setShowIssueModal]   = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [docForm, setDocForm] = useState({ doc_type: '', custom_label: '', file: null });
  const [docSaving, setDocSaving] = useState(false);
  const [deleteDocTarget, setDeleteDocTarget] = useState(null); // { kind: 'issued'|'student', id }

  // ── Exam Cards (Admit / Result) ──
  const [publishedExams, setPublishedExams] = useState([]);
  const [examPickerType, setExamPickerType] = useState(null); // 'admit' | 'result'
  const [pickedExamId, setPickedExamId]     = useState('');

  useEffect(() => {
    api.get('/principal/exams?status=PUBLISHED')
      .then(r => setPublishedExams(r.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    api.get(`/principal/students/${id}/profile`)
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const loadDocuments = () => {
    setDocsLoading(true);
    api.get(`/principal/students/${id}/documents`)
      .then(r => setDocsData(r.data))
      .catch(() => toast.error('Documents load nahi hue'))
      .finally(() => setDocsLoading(false));
  };

  useEffect(() => {
    if (tab === 'documents' && !docsData) loadDocuments();
  }, [tab]);

  function openDocModal(kind) {
    setDocForm({ doc_type: '', custom_label: '', file: null });
    if (kind === 'issue') setShowIssueModal(true);
    else setShowUploadModal(true);
  }

  async function submitDocUpload(kind) {
    if (!docForm.doc_type) { toast.error('Document type select karo'); return; }
    if (docForm.doc_type === 'OTHER' && !docForm.custom_label.trim()) {
      toast.error('Document ka naam likho'); return;
    }
    if (!docForm.file) { toast.error('File select karo'); return; }

    setDocSaving(true);
    const fd = new FormData();
    fd.append('doc_type', docForm.doc_type);
    fd.append('custom_label', docForm.custom_label);
    fd.append('file', docForm.file);

    const url = kind === 'issue'
      ? `/principal/students/${id}/documents/issued`
      : `/principal/students/${id}/documents/student`;

    try {
      await api.post(url, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Document upload ho gaya');
      setShowIssueModal(false);
      setShowUploadModal(false);
      loadDocuments();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Upload nahi hua');
    }
    setDocSaving(false);
  }

  async function confirmDeleteDoc() {
    if (!deleteDocTarget) return;
    try {
      const url = deleteDocTarget.kind === 'issued'
        ? `/principal/documents/issued/${deleteDocTarget.id}`
        : `/principal/documents/student/${deleteDocTarget.id}`;
      await api.delete(url);
      toast.success('Document deleted');
      setDeleteDocTarget(null);
      loadDocuments();
    } catch {
      toast.error('Delete nahi hua');
    }
  }

  // Fixed downloadCard — type can be 'admission', 'admit', or 'result'
  const downloadCard = async (type, examId) => {
    setDlLoading(type);
    try {
      let url;
      if (type === 'admission') {
        url = `/principal/admission-card/${id}`;
      } else if (type === 'admit') {
        url = `/principal/admit-card/${id}/${examId}`;
      } else if (type === 'result') {
        url = `/principal/result-card/${id}/${examId}`;
      }
      const res = await api.get(url, { responseType: 'blob' });
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      link.download = `${type}_card_${data?.info?.name}.pdf`;
      link.click();
      toast.success('PDF download ho raha hai!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'PDF generate nahi hua');
    }
    setDlLoading(false);
  };

  const openExamPicker = (type) => {
    setPickedExamId('');
    setExamPickerType(type);
  };

  const confirmExamPicker = () => {
    if (!pickedExamId) { toast.error('Pehle exam select karo'); return; }
    downloadCard(examPickerType, pickedExamId);
    setExamPickerType(null);
  };

  const fmt  = n => Number(n || 0).toLocaleString('en-IN');
  const fmtK = n => {
    n = Number(n || 0);
    if (n >= 100000) return `₹${(n/100000).toFixed(1)}L`;
    if (n >= 1000)   return `₹${(n/1000).toFixed(0)}K`;
    return `₹${n}`;
  };

  const TABS = [
    { key: 'overview',    label: '📊 Overview'    },
    { key: 'attendance',  label: '📅 Attendance'  },
    { key: 'fees',        label: '💰 Fees'        },
    { key: 'marks',       label: '📝 Marks'       },
    { key: 'transport',   label: '🚌 Transport'   },
    { key: 'documents',   label: '🎓 Documents'   },
  ];

  if (loading) return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar title="Student Profile" />
        <div className="page-body" style={{ display:'flex', alignItems:'center', justifyContent:'center', height:300 }}>
          <span style={{ color:'var(--neutral-5)', fontSize:14 }}>⏳ Loading profile...</span>
        </div>
      </div>
    </div>
  );

  if (!data) return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar title="Student Profile" />
        <div className="page-body">
          <div className="empty-state"><p>Student nahi mila.</p></div>
        </div>
      </div>
    </div>
  );

  const { info, attendance, fees, exams } = data;
  const att = attendance || {};
  const feeData = fees || {};

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar title="Student Profile" />
        <div className="page-body">

          {/* ── Header ── */}
          <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:24 }}>
            <button
              onClick={() => navigate(-1)}
              style={{
                background:'none', border:'1px solid var(--neutral-3)',
                borderRadius:8, padding:'6px 14px', cursor:'pointer',
                fontSize:13, color:'var(--neutral-7)', fontWeight:600,
              }}>← Back</button>
            <div style={{ width:52, height:52, borderRadius:'50%', flexShrink:0, overflow:'hidden' }}>
              {info.photo_url
                ? <img src={info.photo_url} alt={info.name}
                    style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                : <div style={{
                    width:52, height:52, borderRadius:'50%',
                    background:'var(--blue-10)', color:'var(--blue-80)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:22, fontWeight:800,
                  }}>{info.name?.charAt(0).toUpperCase()}</div>
              }
            </div>
            <div style={{ flex:1 }}>
              <h2 style={{ margin:0, fontSize:20, fontWeight:800, color:'var(--neutral-9)' }}>
                {info.name}
              </h2>
              <div style={{ fontSize:12, color:'var(--neutral-5)', marginTop:2 }}>
                {info.class_name} &nbsp;·&nbsp; Roll: {info.roll_number || '—'} &nbsp;·&nbsp; Adm: {info.admission_no || '—'}
              </div>
            </div>
            {/* Quick status pills */}
            <div style={{ display:'flex', gap:10 }}>
              <div style={{
                background: (feeData.month_status === 'PAID' || feeData.month_status === 'NO_RECORD') ? '#dcfce7' : '#fee2e2',
                color:      (feeData.month_status === 'PAID' || feeData.month_status === 'NO_RECORD') ? '#16a34a' : '#dc2626',
                padding:'6px 14px', borderRadius:20, fontSize:12, fontWeight:700,
              }}>
                💰 {feeData.month_status === 'PAID' ? 'Fees Paid' : feeData.month_status === 'NO_RECORD' ? 'No Dues' : 'Fees Pending'}
              </div>
              <div style={{
                background: att.percentage >= 75 ? '#dcfce7' : '#fee2e2',
                color:      att.percentage >= 75 ? '#16a34a' : '#dc2626',
                padding:'6px 14px', borderRadius:20, fontSize:12, fontWeight:700,
              }}>
                📅 {att.percentage || 0}% Attendance
              </div>
            </div>
          </div>

          {/* ── Tabs ── */}
          <div style={{ display:'flex', borderBottom:'2px solid var(--neutral-2)', marginBottom:20 }}>
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                background:'none', border:'none', cursor:'pointer',
                padding:'10px 18px', fontSize:13, fontWeight:600,
                color: tab===t.key ? 'var(--blue-60)' : 'var(--neutral-6)',
                borderBottom: tab===t.key ? '2px solid var(--blue-60)' : '2px solid transparent',
                marginBottom:-2, transition:'color 0.15s',
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
                    ['Full Name',     info.name],
                    ['Roll Number',   info.roll_number  || '—'],
                    ['Admission No',  info.admission_no || '—'],
                    ['Class',         info.class_name   || '—'],
                    ['Gender',        info.gender       || '—'],
                    ['Date of Birth', info.dob          || '—'],
                    ['Session',       info.session      || '—'],
                    ['Address',       info.address      || '—'],
                    ['Father Name',   info.father_name  || '—'],
                    ['Mother Name',   info.mother_name  || '—'],
                  ].map(([label, value]) => (
                    <div key={label} style={{
                      display:'flex', justifyContent:'space-between',
                      padding:'8px 0', borderBottom:'1px solid var(--neutral-1)',
                      fontSize:13,
                    }}>
                      <span style={{ color:'var(--neutral-6)', minWidth:120 }}>{label}</span>
                      <span style={{ fontWeight:600, color:'var(--neutral-9)', textAlign:'right' }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Parent + Quick Stats */}
              <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                <div className="card" style={{ margin:0 }}>
                  <div className="card-header"><h4>👨‍👩‍👦 Parent / Guardian</h4></div>
                  <div className="card-body">
                    {[
                      ['Name',  info.parent_name  || '—'],
                      ['Phone', info.parent_phone || '—'],
                      ['Email', info.parent_email || '—'],
                    ].map(([label, value]) => (
                      <div key={label} style={{
                        display:'flex', justifyContent:'space-between',
                        padding:'8px 0', borderBottom:'1px solid var(--neutral-1)', fontSize:13,
                      }}>
                        <span style={{ color:'var(--neutral-6)' }}>{label}</span>
                        <span style={{ fontWeight:600 }}>{value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quick stats */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  {[
                    { icon:'📅', label:'Attendance', value:`${att.percentage||0}%`,
                      sub:`${att.present||0} present / ${att.absent||0} absent`,
                      color: att.percentage>=75 ? '#16a34a' : '#dc2626' },
                    { icon:'💰', label:'Fees This Month', value: feeData.month_status || 'N/A',
                      sub:`Paid: ₹${fmt(feeData.month_paid)} / Due: ₹${fmt(feeData.month_due)}`,
                      color: (feeData.month_status==='PAID' || feeData.month_status==='NO_RECORD') ? '#16a34a' : '#dc2626' },
                    { icon:'💸', label:'Total Paid', value: `₹${fmt(feeData.total_paid)}`,
                      sub:`Pending: ₹${fmt(feeData.pending)}`, color:'#0176d3' },
                    { icon:'📝', label:'Exams',
                      value: `${exams?.length || 0} exams`,
                      sub: exams?.length ? `Avg: ${Math.round(exams.reduce((a,e)=>a+e.avg_pct,0)/exams.length)}%` : 'No data',
                      color:'#5867e8' },
                  ].map(s => (
                    <div key={s.label} style={{
                      background:'#fff', borderRadius:10,
                      padding:'14px 16px', border:'1px solid var(--neutral-2)',
                    }}>
                      <div style={{ fontSize:18 }}>{s.icon}</div>
                      <div style={{ fontSize:11, color:'var(--neutral-5)', marginTop:6 }}>{s.label}</div>
                      <div style={{ fontSize:16, fontWeight:800, color:s.color, marginTop:2 }}>{s.value}</div>
                      <div style={{ fontSize:11, color:'var(--neutral-5)', marginTop:2 }}>{s.sub}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ══ ATTENDANCE ══ */}
          {tab === 'attendance' && (
            <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

              {/* Summary pills */}
              <div style={{ display:'flex', gap:14, flexWrap:'wrap' }}>
                {[
                  { label:'Total Days',  value: att.total_marked || 0, bg:'#f1f5f9', color:'#0f172a' },
                  { label:'Present',     value: att.present  || 0, bg:'#dcfce7', color:'#16a34a' },
                  { label:'Absent',      value: att.absent   || 0, bg:'#fee2e2', color:'#dc2626' },
                  { label:'Late',        value: att.late     || 0, bg:'#fef3c7', color:'#d97706' },
                  { label:'Attendance %',value:`${att.percentage||0}%`,
                    bg: att.percentage>=75 ? '#dcfce7' : '#fee2e2',
                    color: att.percentage>=75 ? '#16a34a' : '#dc2626' },
                ].map(p => (
                  <div key={p.label} style={{
                    background:p.bg, borderRadius:12, padding:'12px 20px', textAlign:'center', minWidth:90,
                  }}>
                    <div style={{ fontSize:22, fontWeight:800, color:p.color }}>{p.value}</div>
                    <div style={{ fontSize:11, color:'#64748b', marginTop:2 }}>{p.label}</div>
                  </div>
                ))}
              </div>

              {/* Last 30 days calendar */}
              <div className="card" style={{ margin:0 }}>
                <div className="card-header"><h4>📅 Last 30 Days</h4></div>
                <div style={{ padding:'16px 20px', display:'flex', flexWrap:'wrap', gap:6 }}>
                  {(att.calendar_30 || []).map((d, i) => {
                    const s = STATUS_COLOR[d.status] || STATUS_COLOR.NOT_MARKED;
                    return (
                      <div key={i} title={`${d.date} — ${d.status}`} style={{
                        width:38, height:44, borderRadius:8,
                        background:s.bg, color:s.color,
                        display:'flex', flexDirection:'column',
                        alignItems:'center', justifyContent:'center',
                        fontSize:10, fontWeight:700, cursor:'default',
                        border:`1px solid ${s.color}22`,
                      }}>
                        <span style={{ fontSize:9, color:'#94a3b8' }}>{d.day}</span>
                        <span style={{ fontSize:13 }}>{s.label}</span>
                        <span style={{ fontSize:9, color:'#94a3b8' }}>
                          {d.date.slice(8)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Monthly breakdown */}
              <div className="card" style={{ margin:0 }}>
                <div className="card-header"><h4>📊 Month-wise Summary</h4></div>
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Month</th><th>Present</th><th>Absent</th>
                        <th>Late</th><th>Total</th><th>%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(att.monthly || []).length === 0 ? (
                        <tr><td colSpan={6} style={{ textAlign:'center', padding:24, color:'var(--neutral-4)' }}>
                          Koi attendance record nahi
                        </td></tr>
                      ) : (att.monthly || []).map((m, i) => {
                        const pct = m.total > 0 ? Math.round(m.present/m.total*100) : 0;
                        return (
                          <tr key={i}>
                            <td style={{ fontWeight:600 }}>{m.month}</td>
                            <td><span style={{ background:'#dcfce7', color:'#16a34a', padding:'2px 10px', borderRadius:20, fontSize:12, fontWeight:700 }}>{m.present}</span></td>
                            <td><span style={{ background:'#fee2e2', color:'#dc2626', padding:'2px 10px', borderRadius:20, fontSize:12, fontWeight:700 }}>{m.absent}</span></td>
                            <td><span style={{ background:'#fef3c7', color:'#d97706', padding:'2px 10px', borderRadius:20, fontSize:12, fontWeight:700 }}>{m.late}</span></td>
                            <td style={{ fontWeight:600 }}>{m.total}</td>
                            <td>
                              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                <div style={{ width:60, height:6, background:'#f1f5f9', borderRadius:99 }}>
                                  <div style={{ width:`${pct}%`, height:'100%', borderRadius:99, background: pct>=75?'#16a34a':pct>=50?'#d97706':'#dc2626' }} />
                                </div>
                                <span style={{ fontSize:12, fontWeight:700, color: pct>=75?'#16a34a':'#dc2626' }}>{pct}%</span>
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

          {/* ══ FEES ══ */}
          {tab === 'fees' && (
            <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

              {/* Summary */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14 }}>
                {[
                  { label:'Total Due',    value:`₹${fmt(feeData.total_due)}`,  color:'#0176d3', bg:'#eff6ff' },
                  { label:'Total Paid',   value:`₹${fmt(feeData.total_paid)}`, color:'#16a34a', bg:'#f0fdf4' },
                  { label:'Pending',      value:`₹${fmt(feeData.pending)}`,    color:'#dc2626', bg:'#fef2f2' },
                  { label:`${feeData.this_month}`, value: feeData.month_status || '—',
                    color: (feeData.month_status==='PAID' || feeData.month_status==='NO_RECORD')?'#16a34a':'#dc2626',
                    bg:    (feeData.month_status==='PAID' || feeData.month_status==='NO_RECORD')?'#f0fdf4':'#fef2f2' },
                ].map(s => (
                  <div key={s.label} style={{
                    background:s.bg, borderRadius:12, padding:'16px', textAlign:'center',
                    border:`1px solid ${s.color}22`,
                  }}>
                    <div style={{ fontSize:20, fontWeight:800, color:s.color }}>{s.value}</div>
                    <div style={{ fontSize:11, color:'#64748b', marginTop:4 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Fee records table */}
              <div className="card" style={{ margin:0 }}>
                <div className="card-header"><h4>💳 Payment History</h4></div>
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Month</th><th>Type</th><th>Due</th>
                        <th>Paid</th><th>Mode</th><th>Date</th>
                        <th>Receipt</th><th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(feeData.records || []).length === 0 ? (
                        <tr><td colSpan={8} style={{ textAlign:'center', padding:24, color:'var(--neutral-4)' }}>
                          Koi fee record nahi
                        </td></tr>
                      ) : (feeData.records || []).map((r, i) => (
                        <tr key={i}>
                          <td style={{ fontWeight:600, fontSize:13 }}>{r.month || '—'}</td>
                          <td><span className="badge badge-info">{r.fee_type || '—'}</span></td>
                          <td style={{ fontWeight:600 }}>₹{fmt(r.amount_due)}</td>
                          <td style={{ fontWeight:600, color:'#16a34a' }}>₹{fmt(r.amount_paid)}</td>
                          <td style={{ fontSize:12, color:'var(--neutral-6)' }}>{r.payment_mode || '—'}</td>
                          <td style={{ fontSize:12, color:'var(--neutral-6)' }}>{r.paid_date || '—'}</td>
                          <td style={{ fontSize:11, fontFamily:'monospace', color:'var(--neutral-6)' }}>{r.receipt_no || '—'}</td>
                          <td>
                            <span style={{
                              padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700,
                              background: r.status==='PAID'?'#dcfce7':r.status==='PARTIAL'?'#fef3c7':'#fee2e2',
                              color:      r.status==='PAID'?'#16a34a':r.status==='PARTIAL'?'#d97706':'#dc2626',
                            }}>{r.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ══ MARKS ══ */}
          {/* ══ MARKS ══ */}
          {tab === 'marks' && (
            <MarksTab studentId={id} exams={exams} />
          )}

          {tab === 'hostel' && (
            <HostelTab studentId={id} />
          )}

         

          {/* ══ DOCUMENTS ══ */}
          {/* ══ DOCUMENTS ══ */}
          {tab === 'documents' && (
            <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

              {/* PDF Cards — Admission + Admit + Result */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(230px,1fr))', gap:16 }}>

                {/* Admission Card */}
                <div className="card" style={{ margin:0, padding:24, textAlign:'center' }}>
                  <div style={{ fontSize:38, marginBottom:10 }}>🎓</div>
                  <div style={{ fontWeight:700, fontSize:14, marginBottom:4 }}>Admission Card</div>
                  <div style={{ fontSize:11, color:'var(--neutral-5)', marginBottom:14 }}>Official admission registration card</div>
                  <button className="btn btn-primary btn-sm" disabled={dlLoading === 'admission'}
                    onClick={() => downloadCard('admission')} style={{ width:'100%' }}>
                    {dlLoading === 'admission' ? '⏳ Generating...' : '⬇️ Download PDF'}
                  </button>
                </div>

                {/* Admit Card */}
                <div className="card" style={{ margin:0, padding:24, textAlign:'center' }}>
                  <div style={{ fontSize:38, marginBottom:10 }}>🎟️</div>
                  <div style={{ fontWeight:700, fontSize:14, marginBottom:4 }}>Admit Card</div>
                  <div style={{ fontSize:11, color:'var(--neutral-5)', marginBottom:14 }}>Exam ka admit card (subject-wise timetable)</div>
                  <button className="btn btn-primary btn-sm" disabled={dlLoading === 'admit'}
                    onClick={() => openExamPicker('admit')} style={{ width:'100%' }}>
                    {dlLoading === 'admit' ? '⏳ Generating...' : '⬇️ Download PDF'}
                  </button>
                </div>

                {/* Result Card */}
                <div className="card" style={{ margin:0, padding:24, textAlign:'center' }}>
                  <div style={{ fontSize:38, marginBottom:10 }}>📊</div>
                  <div style={{ fontWeight:700, fontSize:14, marginBottom:4 }}>Result Card</div>
                  <div style={{ fontSize:11, color:'var(--neutral-5)', marginBottom:14 }}>Exam ka progress report / marksheet</div>
                  <button className="btn btn-primary btn-sm" disabled={dlLoading === 'result'}
                    onClick={() => openExamPicker('result')} style={{ width:'100%' }}>
                    {dlLoading === 'result' ? '⏳ Generating...' : '⬇️ Download PDF'}
                  </button>
                </div>
              </div>

              {docsLoading && (
                <div style={{ padding:30, textAlign:'center', color:'var(--neutral-5)' }}>⏳ Loading documents...</div>
              )}

              {!docsLoading && docsData && (
                <>
                  {/* ── School Issued Documents ── */}
                  <div className="card" style={{ margin:0 }}>
                    <div className="card-header" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <h4>🏫 School Issued Documents</h4>
                      <button className="btn btn-primary btn-sm" onClick={() => openDocModal('issue')}>
                        + Issue Document
                      </button>
                    </div>
                    <div className="table-container">
                      <table>
                        <thead>
                          <tr><th>Document</th><th>File</th><th>Issued Date</th><th>Actions</th></tr>
                        </thead>
                        <tbody>
                          {(docsData.issued_documents || []).length === 0 ? (
                            <tr><td colSpan={4} style={{ textAlign:'center', padding:24, color:'var(--neutral-4)' }}>
                              Koi document issue nahi hua abhi tak
                            </td></tr>
                          ) : docsData.issued_documents.map(d => (
                            <tr key={d.id}>
                              <td style={{ fontWeight:600 }}>{d.label}</td>
                              <td style={{ fontSize:12, color:'var(--neutral-6)' }}>{d.file_name || '—'}</td>
                              <td style={{ fontSize:12, color:'var(--neutral-6)' }}>
                                {d.issued_at ? new Date(d.issued_at).toLocaleDateString('en-IN') : '—'}
                              </td>
                              <td>
                                <div style={{ display:'flex', gap:6 }}>
                                  <a href={d.file_url} target="_blank" rel="noreferrer"
                                    style={{ background:'#e8f4fd', color:'#0176d3', border:'none', borderRadius:4, padding:'4px 10px', fontSize:11, fontWeight:700, textDecoration:'none' }}>
                                    👁️ View
                                  </a>
                                  <button
                                    onClick={() => setDeleteDocTarget({ kind:'issued', id:d.id })}
                                    style={{ background:'#fef2f2', color:'#dc2626', border:'none', borderRadius:4, padding:'4px 10px', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                                    🗑️
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* ── Student's Own Documents ── */}
                  <div className="card" style={{ margin:0 }}>
                    <div className="card-header" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <h4>📁 Student Documents</h4>
                      <button className="btn btn-primary btn-sm" onClick={() => openDocModal('upload')}>
                        + Upload Document
                      </button>
                    </div>
                    <div className="table-container">
                      <table>
                        <thead>
                          <tr><th>Document</th><th>File</th><th>Uploaded Date</th><th>Actions</th></tr>
                        </thead>
                        <tbody>
                          {(docsData.student_documents || []).length === 0 ? (
                            <tr><td colSpan={4} style={{ textAlign:'center', padding:24, color:'var(--neutral-4)' }}>
                              Koi document upload nahi hua abhi tak
                            </td></tr>
                          ) : docsData.student_documents.map(d => (
                            <tr key={d.id}>
                              <td style={{ fontWeight:600 }}>{d.label}</td>
                              <td style={{ fontSize:12, color:'var(--neutral-6)' }}>{d.file_name || '—'}</td>
                              <td style={{ fontSize:12, color:'var(--neutral-6)' }}>
                                {d.uploaded_at ? new Date(d.uploaded_at).toLocaleDateString('en-IN') : '—'}
                              </td>
                              <td>
                                <div style={{ display:'flex', gap:6 }}>
                                  <a href={d.file_url} target="_blank" rel="noreferrer"
                                    style={{ background:'#e8f4fd', color:'#0176d3', border:'none', borderRadius:4, padding:'4px 10px', fontSize:11, fontWeight:700, textDecoration:'none' }}>
                                    👁️ View
                                  </a>
                                  <button
                                    onClick={() => setDeleteDocTarget({ kind:'student', id:d.id })}
                                    style={{ background:'#fef2f2', color:'#dc2626', border:'none', borderRadius:4, padding:'4px 10px', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                                    🗑️
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ══ TRANSPORT ══ */}
          {tab === 'transport' && (
            <TransportTab studentId={id} />
          )}

        </div>
      </div>

      {/* ── Issue Document Modal (School → Student) ── */}
      {showIssueModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && !docSaving && setShowIssueModal(false)}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h3>🏫 Issue Document</h3>
              <button className="modal-close" disabled={docSaving} onClick={() => setShowIssueModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Document Type *</label>
                <select className="form-select" value={docForm.doc_type}
                  onChange={e => setDocForm(f => ({ ...f, doc_type: e.target.value }))}>
                  <option value="">Select type...</option>
                  {(docsData?.issued_doc_types || ['BONAFIDE','TC','CHARACTER_CERTIFICATE','FEE_RECEIPT','OTHER']).map(t => (
                    <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              {docForm.doc_type === 'OTHER' && (
                <div className="form-group">
                  <label className="form-label">Document Name *</label>
                  <input className="form-input" placeholder="e.g. Sports Certificate"
                    value={docForm.custom_label}
                    onChange={e => setDocForm(f => ({ ...f, custom_label: e.target.value }))} />
                </div>
              )}
              <div className="form-group">
                <label className="form-label">File *</label>
                <input type="file" className="form-input"
                  onChange={e => setDocForm(f => ({ ...f, file: e.target.files[0] }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-neutral" disabled={docSaving} onClick={() => setShowIssueModal(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={docSaving} onClick={() => submitDocUpload('issue')}>
                {docSaving ? 'Uploading...' : '✅ Issue Document'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Upload Student Document Modal ── */}
      {showUploadModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && !docSaving && setShowUploadModal(false)}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h3>📁 Upload Document</h3>
              <button className="modal-close" disabled={docSaving} onClick={() => setShowUploadModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Document Type *</label>
                <select className="form-select" value={docForm.doc_type}
                  onChange={e => setDocForm(f => ({ ...f, doc_type: e.target.value }))}>
                  <option value="">Select type...</option>
                  {(docsData?.student_doc_types || ['AADHAR','RATION_CARD','BIRTH_CERTIFICATE','CASTE_CERTIFICATE','OTHER']).map(t => (
                    <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              {docForm.doc_type === 'OTHER' && (
                <div className="form-group">
                  <label className="form-label">Document Name *</label>
                  <input className="form-input" placeholder="e.g. Migration Certificate"
                    value={docForm.custom_label}
                    onChange={e => setDocForm(f => ({ ...f, custom_label: e.target.value }))} />
                </div>
              )}
              <div className="form-group">
                <label className="form-label">File *</label>
                <input type="file" className="form-input"
                  onChange={e => setDocForm(f => ({ ...f, file: e.target.files[0] }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-neutral" disabled={docSaving} onClick={() => setShowUploadModal(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={docSaving} onClick={() => submitDocUpload('upload')}>
                {docSaving ? 'Uploading...' : '✅ Upload'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Document Confirmation ── */}
      {deleteDocTarget && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setDeleteDocTarget(null)}>
          <div className="modal" style={{ maxWidth: 380 }}>
            <div className="modal-header">
              <h3>🗑️ Delete Document</h3>
              <button className="modal-close" onClick={() => setDeleteDocTarget(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, padding:'12px 16px', fontSize:13, color:'#991b1b' }}>
                ⚠️ Ye document permanently delete ho jayega. Confirm karo.
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-neutral" onClick={() => setDeleteDocTarget(null)}>Cancel</button>
              <button
                onClick={confirmDeleteDoc}
                style={{ background:'#dc2626', color:'#fff', border:'none', borderRadius:6, padding:'8px 18px', fontSize:13, fontWeight:700, cursor:'pointer' }}>
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Exam Picker Modal (Admit Card / Result Card) ── */}
      {examPickerType && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setExamPickerType(null)}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h3>{examPickerType === 'admit' ? '🎟️ Admit Card Download' : '📊 Result Card Download'}</h3>
              <button className="modal-close" onClick={() => setExamPickerType(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Exam Select Karo *</label>
                {publishedExams.length === 0 ? (
                  <div style={{ padding:'12px 16px', background:'#fffbeb', border:'1px solid #fcd34d', borderRadius:8, fontSize:13, color:'#92400e' }}>
                    ⚠️ Koi published exam nahi mila. Principal se exam publish karwao.
                  </div>
                ) : (
                  <select className="form-input" value={pickedExamId} onChange={e => setPickedExamId(e.target.value)}>
                    <option value="">-- Exam chunein --</option>
                    {publishedExams.map(ex => (
                      <option key={ex.id} value={ex.id}>{ex.exam_name} ({ex.session})</option>
                    ))}
                  </select>
                )}
              </div>
              {examPickerType === 'admit' && (
                <div style={{ fontSize:11, color:'var(--neutral-5)', marginTop:4 }}>
                  📌 Admit card mein subjects tabhi aayenge jab principal ne exam ka timetable add kiya ho.
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-neutral" onClick={() => setExamPickerType(null)}>Cancel</button>
              <button className="btn btn-primary" disabled={!pickedExamId || publishedExams.length === 0}
                onClick={confirmExamPicker}>⬇️ Download PDF</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
