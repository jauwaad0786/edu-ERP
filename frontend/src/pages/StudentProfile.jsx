import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Navbar  from '../components/Navbar';
import api     from '../api/axios';
import toast   from 'react-hot-toast';
import EntityAuditTimeline from '../components/audit/EntityAuditTimeline';
import { useAuth } from '../context/AuthContext';

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
        const hData = histRes.value?.data?.data;
        setHistory(Array.isArray(hData) ? hData : (hData?.events || hData?.history || []));
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

function AcademicHistoryTab({ studentId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    api.get(`/principal/students/${studentId}/history`)
      .then(r => setData(r.data))
      .catch(err => setError(err.response?.data?.error || 'Failed to load academic history'))
      .finally(() => setLoading(false));
  }, [studentId]);

  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: 'var(--neutral-5)' }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>⏳</div>
        <div>Loading lifetime academic dossier...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ margin: 0, padding: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>⚠️</div>
        <div style={{ color: '#dc2626', fontWeight: 600 }}>{error}</div>
      </div>
    );
  }

  const { permanent_profile, timeline, audit_trail, current_active_enrollment } = data || {};

  const STATUS_COLORS = {
    ACTIVE:    { bg: '#dcfce7', text: '#15803d', border: '#86efac' },
    PROMOTED:  { bg: '#e0e7ff', text: '#3730a3', border: '#a5b4fc' },
    RETAINED:  { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' },
    GRADUATED: { bg: '#f3e8ff', text: '#6b21a8', border: '#d8b4fe' },
    WITHDRAWN: { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' },
    LEFT:      { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* ── 1. Permanent Student Identity Dossier Card ── */}
      <div className="card" style={{ margin: 0, borderTop: '4px solid #0284c7', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontSize: 16 }}>
              <span>🪪</span> Permanent Student Master Profile
            </h4>
            <span style={{ fontSize: 12, color: 'var(--neutral-5)' }}>
              Master identity record created once upon initial admission. Preserved across all annual academic years.
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ padding: '4px 12px', borderRadius: 16, fontSize: 11, fontWeight: 700, background: '#e0f2fe', color: '#0369a1' }}>
              Adm No: {permanent_profile?.admission_no || '—'}
            </span>
            <span style={{ padding: '4px 12px', borderRadius: 16, fontSize: 11, fontWeight: 700, background: '#f0fdf4', color: '#166534' }}>
              Initial Adm Year: {permanent_profile?.original_admission_year || '—'}
            </span>
          </div>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            {[
              ['Full Legal Name', permanent_profile?.name],
              ['Date of Birth', permanent_profile?.dob],
              ['Gender', permanent_profile?.gender],
              ['Blood Group', permanent_profile?.blood_group || '—'],
              ['Admission Date', permanent_profile?.admission_date || '—'],
              ['Aadhaar / National ID', permanent_profile?.aadhar_no || '—'],
              ['Father Name', permanent_profile?.father_name || permanent_profile?.parent_name || '—'],
              ['Mother Name', permanent_profile?.mother_name || '—'],
              ['Parent Phone', permanent_profile?.parent_phone || '—'],
              ['Parent Email', permanent_profile?.parent_email || '—'],
              ['Category / Caste', permanent_profile?.category || 'General'],
              ['Nationality', permanent_profile?.nationality || 'Indian'],
              ['Permanent Address', permanent_profile?.address || '—'],
            ].map(([lbl, val]) => (
              <div key={lbl} style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 11, color: 'var(--neutral-5)', fontWeight: 600 }}>{lbl}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--neutral-8)', marginTop: 2 }}>{val || '—'}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 2. Lifetime Academic Progression Timeline ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h4 style={{ margin: 0, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>📈</span> Multi-Year Academic Progression Timeline
          </h4>
          <span style={{ fontSize: 12, color: 'var(--neutral-5)' }}>
            Showing {timeline?.length || 0} enrolled academic {timeline?.length === 1 ? 'session' : 'sessions'}
          </span>
        </div>

        {(!timeline || timeline.length === 0) ? (
          <div className="card" style={{ margin: 0, padding: 32, textAlign: 'center', color: 'var(--neutral-5)' }}>
            No enrollment records found for this student.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {timeline.map((en, idx) => {
              const stStyle = STATUS_COLORS[en.enrollment_status] || STATUS_COLORS.ACTIVE;
              const isCurrent = current_active_enrollment?.id === en.enrollment_id;

              return (
                <div key={en.enrollment_id || idx} className="card" style={{
                  margin: 0,
                  borderLeft: `5px solid ${stStyle.text}`,
                  borderRadius: 10,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                  position: 'relative'
                }}>
                  {/* Top Bar of Session Card */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, borderBottom: '1px solid #e2e8f0', paddingBottom: 12, marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{
                        background: '#1e293b', color: '#fff', padding: '4px 12px',
                        borderRadius: 6, fontSize: 13, fontWeight: 800, letterSpacing: 0.5
                      }}>
                        Session {en.session}
                      </span>
                      <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--neutral-9)' }}>
                        {en.class_display || en.class_name || 'Class'}
                      </span>
                      {en.roll_number && (
                        <span style={{ fontSize: 12, color: 'var(--neutral-6)', background: '#f1f5f9', padding: '3px 8px', borderRadius: 6, fontWeight: 600 }}>
                          Roll No: {en.roll_number}
                        </span>
                      )}
                      {en.house && (
                        <span style={{ fontSize: 12, color: '#0369a1', background: '#e0f2fe', padding: '3px 8px', borderRadius: 6, fontWeight: 600 }}>
                          🏠 {en.house}
                        </span>
                      )}
                      {en.stream && (
                        <span style={{ fontSize: 12, color: '#7c3aed', background: '#ede9fe', padding: '3px 8px', borderRadius: 6, fontWeight: 600 }}>
                          🧪 {en.stream}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {isCurrent && (
                        <span style={{ background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 800 }}>
                          ⭐ Current Active
                        </span>
                      )}
                      <span style={{
                        padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 800,
                        background: stStyle.bg, color: stStyle.text, border: `1px solid ${stStyle.border}`
                      }}>
                        {en.enrollment_status}
                      </span>
                      <span style={{ padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: '#f8fafc', color: 'var(--neutral-6)', border: '1px solid #e2e8f0' }}>
                        {en.enrollment_type}
                      </span>
                    </div>
                  </div>

                  {/* 4 Multi-Metric Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                    {/* Attendance */}
                    <div style={{ background: '#f8fafc', borderRadius: 8, padding: '12px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--neutral-5)', textTransform: 'uppercase' }}>📅 Attendance</div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                        <span style={{ fontSize: 20, fontWeight: 800, color: en.attendance_summary?.percentage >= 75 ? '#15803d' : '#b91c1c' }}>
                          {en.attendance_summary?.percentage ?? 0}%
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--neutral-5)' }}>
                          ({en.attendance_summary?.present_days ?? 0}/{en.attendance_summary?.total_days ?? 0} days)
                        </span>
                      </div>
                      <div style={{ height: 6, background: '#e2e8f0', borderRadius: 99, marginTop: 6, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          width: `${Math.min(en.attendance_summary?.percentage || 0, 100)}%`,
                          background: en.attendance_summary?.percentage >= 75 ? '#16a34a' : '#dc2626'
                        }} />
                      </div>
                    </div>

                    {/* RMS Academics */}
                    <div style={{ background: '#f8fafc', borderRadius: 8, padding: '12px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--neutral-5)', textTransform: 'uppercase' }}>📝 RMS Academics</div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                        <span style={{ fontSize: 20, fontWeight: 800, color: en.academic_summary?.avg_percentage >= 33 ? '#1e293b' : '#b91c1c' }}>
                          {en.academic_summary?.avg_percentage ? `${en.academic_summary.avg_percentage}%` : '—'}
                        </span>
                        {en.academic_summary?.total_obtained ? (
                          <span style={{ fontSize: 12, color: 'var(--neutral-5)' }}>
                            ({en.academic_summary.total_obtained}/{en.academic_summary.total_max})
                          </span>
                        ) : null}
                      </div>
                      <div style={{ marginTop: 4 }}>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                          background: en.academic_summary?.result_status === 'PASS' ? '#dcfce7' : en.academic_summary?.result_status === 'FAIL' ? '#fee2e2' : '#f1f5f9',
                          color: en.academic_summary?.result_status === 'PASS' ? '#15803d' : en.academic_summary?.result_status === 'FAIL' ? '#b91c1c' : '#64748b',
                        }}>
                          {en.academic_summary?.result_status || 'No Exam Record'}
                        </span>
                      </div>
                    </div>

                    {/* Fees Ledger */}
                    <div style={{ background: '#f8fafc', borderRadius: 8, padding: '12px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--neutral-5)', textTransform: 'uppercase' }}>💰 Fee Ledger</div>
                      <div style={{ marginTop: 4 }}>
                        {en.fee_summary?.pending_dues > 0 ? (
                          <div>
                            <span style={{ fontSize: 18, fontWeight: 800, color: '#dc2626' }}>
                              ₹{Number(en.fee_summary.pending_dues).toLocaleString('en-IN')}
                            </span>
                            <div style={{ fontSize: 11, color: '#dc2626', fontWeight: 600, marginTop: 2 }}>
                              Pending Dues (Paid: ₹{Number(en.fee_summary.total_paid || 0).toLocaleString('en-IN')})
                            </div>
                          </div>
                        ) : (
                          <div>
                            <span style={{ fontSize: 15, fontWeight: 800, color: '#15803d' }}>
                              ✅ All Fees Cleared
                            </span>
                            <div style={{ fontSize: 11, color: 'var(--neutral-5)', marginTop: 2 }}>
                              Total Paid: ₹{Number(en.fee_summary?.total_paid || 0).toLocaleString('en-IN')}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Transport */}
                    <div style={{ background: '#f8fafc', borderRadius: 8, padding: '12px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--neutral-5)', textTransform: 'uppercase' }}>🚌 Transport</div>
                      {en.transport_summary?.vehicle_number || en.transport_summary?.route_name ? (
                        <div style={{ marginTop: 4 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--neutral-8)' }}>
                            {en.transport_summary.vehicle_number ? `Bus: ${en.transport_summary.vehicle_number}` : en.transport_summary.route_name}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--neutral-5)', marginTop: 2 }}>
                            {en.transport_summary.stop_name ? `Stop: ${en.transport_summary.stop_name}` : en.transport_summary.route_name}
                          </div>
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, color: 'var(--neutral-4)', marginTop: 8 }}>
                          Self Commuter / Not Enrolled
                        </div>
                      )}
                    </div>
                  </div>

                  {en.remarks && (
                    <div style={{ marginTop: 12, fontSize: 12, color: 'var(--neutral-6)', fontStyle: 'italic', background: '#f1f5f9', padding: '6px 10px', borderRadius: 6 }}>
                      Note: {en.remarks}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 3. Lifecycle Audit Trail ── */}
      {audit_trail && audit_trail.length > 0 && (
        <div className="card" style={{ margin: 0 }}>
          <div className="card-header">
            <h4>📜 Administrative Lifecycle History & Logs</h4>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Remarks / Transition</th>
                  <th>Admin / Teacher</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {audit_trail.map(a => (
                  <tr key={a.id}>
                    <td>
                      <span style={{
                        padding: '3px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700,
                        background: '#e0f2fe', color: '#0369a1'
                      }}>
                        {a.action}
                      </span>
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--neutral-8)' }}>{a.remarks || '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--neutral-6)' }}>{a.actor || 'System'}</td>
                    <td style={{ fontSize: 12, color: 'var(--neutral-5)' }}>
                      {a.created_at ? new Date(a.created_at).toLocaleString('en-IN') : '—'}
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

function EditStudentModal({ studentId, initialData, onClose, onUpdated }) {
  const [classes, setClasses] = useState([]);
  const [activeSubTab, setActiveSubTab] = useState('academic');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: initialData?.name || '',
    email: initialData?.email || '',
    phone: initialData?.phone || '',
    roll_number: initialData?.roll_number || '',
    admission_no: initialData?.admission_no || '',
    class_id: initialData?.class_id || '',
    session: initialData?.session || '2026-27',
    admission_date: initialData?.admission_date || '',
    gender: initialData?.gender || 'Male',
    dob: initialData?.dob || '',
    blood_group: initialData?.blood_group || '',
    category: initialData?.category || 'General',
    nationality: initialData?.nationality || 'Indian',
    religion: initialData?.religion || '',
    aadhar_no: initialData?.aadhar_no || '',
    house: initialData?.house || '',
    stream: initialData?.stream || '',
    status: initialData?.status || 'ACTIVE',
    address: initialData?.address || '',
    father_name: initialData?.father_name || '',
    father_occupation: initialData?.father_occupation || '',
    mother_name: initialData?.mother_name || '',
    mother_occupation: initialData?.mother_occupation || '',
    parent_name: initialData?.parent_name || '',
    parent_phone: initialData?.parent_phone || '',
    parent_email: initialData?.parent_email || '',
    parent_aadhar_no: initialData?.parent_aadhar_no || '',
    guardian_name: initialData?.guardian_name || '',
    guardian_relation: initialData?.guardian_relation || '',
    guardian_phone: initialData?.guardian_phone || '',
    is_first_school: Boolean(initialData?.is_first_school),
    previous_school_name: initialData?.previous_school_name || '',
    previous_class: initialData?.previous_class || '',
    previous_tc_no: initialData?.previous_tc_no || '',
    previous_tc_date: initialData?.previous_tc_date || '',
    previous_reason: initialData?.previous_reason || '',
  });

  useEffect(() => {
    api.get('/principal/classes').then(r => setClasses(r.data || [])).catch(() => {});
  }, []);

  const handleChange = (field, val) => {
    setForm(prev => ({ ...prev, [field]: val }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Student name is required');
      return;
    }
    setSaving(true);
    try {
      await api.put(`/principal/students/${studentId}`, form);
      toast.success('Student profile updated successfully! 🎉');
      if (onUpdated) onUpdated();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update student profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      role="button"
      tabIndex={0}
      aria-label="Close modal"
      onClick={e => e.target === e.currentTarget && onClose()}
      onKeyDown={e => e.key === 'Escape' && onClose()}
      style={{ zIndex: 1100 }}
    >
      <div className="modal" style={{ maxWidth: 840, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header" style={{ borderBottom: '1px solid #e2e8f0', padding: '16px 24px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>✏️ Edit Student Profile (Admin Access)</h3>
            <p style={{ margin: '3px 0 0 0', fontSize: 12, color: '#64748b' }}>
              Modify academic, personal, parent, or previous school records.
            </p>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Subtabs Header */}
        <div style={{ display: 'flex', gap: 6, padding: '10px 24px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', overflowX: 'auto' }}>
          {[
            { id: 'academic', label: '🎓 Academic & Identity' },
            { id: 'personal', label: '👤 Personal & Address' },
            { id: 'parent',   label: '👨‍👩‍👧 Parents & Guardian' },
            { id: 'previous', label: '📜 Previous School / TC' },
          ].map(st => (
            <button
              key={st.id}
              type="button"
              onClick={() => setActiveSubTab(st.id)}
              style={{
                padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                border: activeSubTab === st.id ? '1px solid #0176d3' : '1px solid #cbd5e1',
                background: activeSubTab === st.id ? '#0176d3' : '#ffffff',
                color: activeSubTab === st.id ? '#ffffff' : '#475569',
                cursor: 'pointer', transition: 'all 0.15s'
              }}
            >
              {st.label}
            </button>
          ))}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
            {activeSubTab === 'academic' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input
                    className="form-input"
                    value={form.name}
                    onChange={e => handleChange('name', e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Class & Section</label>
                  <select
                    className="form-input"
                    value={form.class_id}
                    onChange={e => handleChange('class_id', e.target.value)}
                  >
                    <option value="">-- Select Class --</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.section ? `(${c.section})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Admission Number</label>
                  <input
                    className="form-input"
                    value={form.admission_no}
                    onChange={e => handleChange('admission_no', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Roll Number</label>
                  <input
                    className="form-input"
                    value={form.roll_number}
                    onChange={e => handleChange('roll_number', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Academic Session</label>
                  <input
                    className="form-input"
                    value={form.session}
                    onChange={e => handleChange('session', e.target.value)}
                    placeholder="2026-27"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Admission Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={form.admission_date}
                    onChange={e => handleChange('admission_date', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Student Status</label>
                  <select
                    className="form-input"
                    value={form.status}
                    onChange={e => handleChange('status', e.target.value)}
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="PROVISIONAL">PROVISIONAL</option>
                    <option value="PROMOTED">PROMOTED</option>
                    <option value="RETAINED">RETAINED</option>
                    <option value="GRADUATED">GRADUATED</option>
                    <option value="WITHDRAWN">WITHDRAWN</option>
                    <option value="LEFT">LEFT</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">House</label>
                  <input
                    className="form-input"
                    value={form.house}
                    onChange={e => handleChange('house', e.target.value)}
                    placeholder="e.g. Red, Blue, Tagore"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Stream (Senior Secondary)</label>
                  <input
                    className="form-input"
                    value={form.stream}
                    onChange={e => handleChange('stream', e.target.value)}
                    placeholder="Science / Commerce / Arts"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Login Email (Student)</label>
                  <input
                    type="email"
                    className="form-input"
                    value={form.email}
                    onChange={e => handleChange('email', e.target.value)}
                  />
                </div>
              </div>
            )}

            {activeSubTab === 'personal' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label">Date of Birth</label>
                  <input
                    type="date"
                    className="form-input"
                    value={form.dob}
                    onChange={e => handleChange('dob', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Gender</label>
                  <select
                    className="form-input"
                    value={form.gender}
                    onChange={e => handleChange('gender', e.target.value)}
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Blood Group</label>
                  <select
                    className="form-input"
                    value={form.blood_group}
                    onChange={e => handleChange('blood_group', e.target.value)}
                  >
                    <option value="">-- Select --</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select
                    className="form-input"
                    value={form.category}
                    onChange={e => handleChange('category', e.target.value)}
                  >
                    <option value="General">General</option>
                    <option value="OBC">OBC</option>
                    <option value="SC">SC</option>
                    <option value="ST">ST</option>
                    <option value="EWS">EWS</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Student Aadhar Card No</label>
                  <input
                    className="form-input"
                    value={form.aadhar_no}
                    onChange={e => handleChange('aadhar_no', e.target.value)}
                    placeholder="12-digit Aadhar"
                    maxLength={14}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Student Phone / Mobile</label>
                  <input
                    className="form-input"
                    value={form.phone}
                    onChange={e => handleChange('phone', e.target.value)}
                    placeholder="10-digit mobile"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Religion</label>
                  <input
                    className="form-input"
                    value={form.religion}
                    onChange={e => handleChange('religion', e.target.value)}
                    placeholder="Hindu, Muslim, Christian, Sikh, etc."
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Nationality</label>
                  <input
                    className="form-input"
                    value={form.nationality}
                    onChange={e => handleChange('nationality', e.target.value)}
                    placeholder="Indian"
                  />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Residential Address</label>
                  <textarea
                    rows={2}
                    className="form-input"
                    value={form.address}
                    onChange={e => handleChange('address', e.target.value)}
                    placeholder="Street, City, District, PIN Code"
                  />
                </div>
              </div>
            )}

            {activeSubTab === 'parent' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label">Father's Name</label>
                  <input
                    className="form-input"
                    value={form.father_name}
                    onChange={e => handleChange('father_name', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Father's Occupation</label>
                  <input
                    className="form-input"
                    value={form.father_occupation}
                    onChange={e => handleChange('father_occupation', e.target.value)}
                    placeholder="e.g. Business, Govt Service, Farmer"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Mother's Name</label>
                  <input
                    className="form-input"
                    value={form.mother_name}
                    onChange={e => handleChange('mother_name', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Mother's Occupation</label>
                  <input
                    className="form-input"
                    value={form.mother_occupation}
                    onChange={e => handleChange('mother_occupation', e.target.value)}
                    placeholder="e.g. Homemaker, Teacher, Doctor"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Primary Parent Contact Name</label>
                  <input
                    className="form-input"
                    value={form.parent_name}
                    onChange={e => handleChange('parent_name', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Parent Mobile / WhatsApp</label>
                  <input
                    className="form-input"
                    value={form.parent_phone}
                    onChange={e => handleChange('parent_phone', e.target.value)}
                    placeholder="10-digit mobile"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Parent Email Address</label>
                  <input
                    type="email"
                    className="form-input"
                    value={form.parent_email}
                    onChange={e => handleChange('parent_email', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Parent Aadhar Card No</label>
                  <input
                    className="form-input"
                    value={form.parent_aadhar_no}
                    onChange={e => handleChange('parent_aadhar_no', e.target.value)}
                    maxLength={14}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Guardian Name (Optional)</label>
                  <input
                    className="form-input"
                    value={form.guardian_name}
                    onChange={e => handleChange('guardian_name', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Guardian Relation</label>
                  <input
                    className="form-input"
                    value={form.guardian_relation}
                    onChange={e => handleChange('guardian_relation', e.target.value)}
                    placeholder="e.g. Uncle, Grandfather"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Guardian Phone</label>
                  <input
                    className="form-input"
                    value={form.guardian_phone}
                    onChange={e => handleChange('guardian_phone', e.target.value)}
                  />
                </div>
              </div>
            )}

            {activeSubTab === 'previous' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ padding: '12px 16px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontWeight: 700, fontSize: 13, color: '#1e293b' }}>
                    <input
                      type="checkbox"
                      checked={form.is_first_school}
                      onChange={e => handleChange('is_first_school', e.target.checked)}
                      style={{ width: 18, height: 18, accentColor: '#0176d3' }}
                    />
                    Is this the student's first school? (Pehla School / Nursery / LKG)
                  </label>
                </div>

                {!form.is_first_school && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                      <label className="form-label">Previous School Name</label>
                      <input
                        className="form-input"
                        value={form.previous_school_name}
                        onChange={e => handleChange('previous_school_name', e.target.value)}
                        placeholder="Name of previous school"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Previous Class Passed</label>
                      <input
                        className="form-input"
                        value={form.previous_class}
                        onChange={e => handleChange('previous_class', e.target.value)}
                        placeholder="e.g. Class 5"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Transfer Certificate (TC) Number</label>
                      <input
                        className="form-input"
                        value={form.previous_tc_no}
                        onChange={e => handleChange('previous_tc_no', e.target.value)}
                        placeholder="TC-12345"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">TC Date</label>
                      <input
                        type="date"
                        className="form-input"
                        value={form.previous_tc_date}
                        onChange={e => handleChange('previous_tc_date', e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Reason for Transfer</label>
                      <input
                        className="form-input"
                        value={form.previous_reason}
                        onChange={e => handleChange('previous_reason', e.target.value)}
                        placeholder="e.g. Father Transfer / Relocation"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="modal-footer" style={{ borderTop: '1px solid #e2e8f0', padding: '16px 24px', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" className="btn btn-neutral" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving Changes...' : '💾 Save Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function StudentProfile() {
  const { id }     = useParams();
  const navigate   = useNavigate();
  const [searchParams] = useSearchParams();
  const { user }   = useAuth();
  const [data,     setData]     = useState(null);
  const [tab,      setTab]      = useState(searchParams.get('tab') || 'overview');
  const [loading,  setLoading]  = useState(true);
  const [dlLoading,setDlLoading]= useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const isAdmin = ['PRINCIPAL', 'ADMIN', 'SUPER_ADMIN'].includes(user?.role);

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
    { key: 'history',     label: '📜 Academic History' },
    { key: 'attendance',  label: '📅 Attendance'  },
    { key: 'fees',        label: '💰 Fees'        },
    { key: 'marks',       label: '📝 Marks'       },
    { key: 'transport',   label: '🚌 Transport'   },
    { key: 'documents',   label: '🎓 Documents'   },
    { key: 'audit',       label: '🛡️ Audit Trail' },
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
          <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:20, flexWrap:'wrap' }}>
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
            <div style={{ flex:1, minWidth:220 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <h2 style={{ margin:0, fontSize:20, fontWeight:800, color:'var(--neutral-9)' }}>
                  {info.name}
                </h2>
                {isAdmin && (
                  <button
                    onClick={() => setShowEditModal(true)}
                    style={{
                      background:'#0176d3', color:'#fff', border:'none',
                      borderRadius:6, padding:'5px 12px', fontSize:12,
                      fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:4,
                      boxShadow:'0 1px 3px rgba(1,118,211,0.3)'
                    }}>
                    ✏️ Edit Profile
                  </button>
                )}
              </div>
              <div style={{ fontSize:12, color:'var(--neutral-5)', marginTop:2 }}>
                {info.class_name} &nbsp;·&nbsp; Roll: {info.roll_number || '—'} &nbsp;·&nbsp; Adm: {info.admission_no || '—'}
                {info.status && (
                  <span style={{
                    marginLeft: 8, padding: '2px 8px', borderRadius: 12, fontSize: 10, fontWeight: 700,
                    background: info.status === 'ACTIVE' ? '#dcfce7' : '#fef3c7',
                    color: info.status === 'ACTIVE' ? '#16a34a' : '#d97706'
                  }}>
                    {info.status}
                  </span>
                )}
              </div>
            </div>
            {/* Quick status pills */}
            <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
              <div style={{
                background: feeData.pending > 0 ? '#fee2e2' : (feeData.month_status === 'PAID' ? '#dcfce7' : '#f1f5f9'),
                color:      feeData.pending > 0 ? '#dc2626' : (feeData.month_status === 'PAID' ? '#16a34a' : '#64748b'),
                padding:'6px 14px', borderRadius:20, fontSize:12, fontWeight:700,
              }}>
                💰 {feeData.pending > 0 ? `Fees Pending: ₹${fmt(feeData.pending)}` : feeData.month_status === 'PAID' ? 'Fees Paid' : 'No Dues'}
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

          {/* ── Fee Dues & Legacy Migration Reconciliation Banner ── */}
          {(Number(feeData.pending || 0) > 0 || Number(feeData.migrated_dues || 0) > 0) && (
            <div style={{
              background: 'linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)',
              border: '1px solid #cbd5e1',
              borderLeft: '5px solid #0176d3',
              borderRadius: 8,
              padding: '12px 18px',
              marginBottom: 20,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  📊 Fee Reconciliation (Migrated vs Current Academic Records)
                </div>
                <div style={{ fontSize: 13, color: '#1e293b', marginTop: 4, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span>
                    Legacy Migrated Dues: <strong style={{ color: '#d97706' }}>₹{fmt(feeData.migrated_dues || 0)}</strong>
                  </span>
                  <span style={{ color: '#94a3b8' }}>+</span>
                  <span>
                    Current Academic Dues: <strong style={{ color: '#0176d3' }}>₹{fmt(feeData.current_dues || 0)}</strong>
                  </span>
                  <span style={{ color: '#94a3b8' }}>=</span>
                  <span>
                    Total Outstanding: <strong style={{ color: '#dc2626' }}>₹{fmt(feeData.pending || 0)}</strong>
                  </span>
                </div>
              </div>
              <button
                onClick={() => setTab('fees')}
                style={{
                  background: '#f1f5f9', color: '#0176d3', border: '1px solid #cbd5e1',
                  borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer'
                }}>
                View Detailed Fee Ledger →
              </button>
            </div>
          )}

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

          {/* ══ ACADEMIC HISTORY ══ */}
          {tab === 'history' && (
            <AcademicHistoryTab studentId={id} />
          )}

          {/* ══ OVERVIEW ══ */}
          {tab === 'overview' && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>

              {/* Personal Info */}
              <div className="card" style={{ margin:0 }}>
                <div className="card-header" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <h4>👤 Personal Details</h4>
                  {isAdmin && (
                    <button onClick={() => setShowEditModal(true)} style={{ background:'none', border:'none', color:'#0176d3', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                      Edit ✏️
                    </button>
                  )}
                </div>
                <div className="card-body">
                  {[
                    ['Full Name',     info.name],
                    ['Roll Number',   info.roll_number  || '—'],
                    ['Admission No',  info.admission_no || '—'],
                    ['Class',         info.class_name   || '—'],
                    ['Session',       info.session      || '—'],
                    ['Admission Date',info.admission_date || '—'],
                    ['Gender',        info.gender       || '—'],
                    ['Date of Birth', info.dob          || '—'],
                    ['Blood Group',   info.blood_group  || '—'],
                    ['Category',      info.category     || 'General'],
                    ['Aadhar No',     info.aadhar_no    || '—'],
                    ['Religion',      info.religion     || '—'],
                    ['Nationality',   info.nationality  || 'Indian'],
                    ['House',         info.house        || '—'],
                    ['Stream',        info.stream       || '—'],
                    ['Address',       info.address      || '—'],
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
                  <div className="card-header" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <h4>👨‍👩‍👦 Parent / Guardian</h4>
                    {isAdmin && (
                      <button onClick={() => setShowEditModal(true)} style={{ background:'none', border:'none', color:'#0176d3', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                        Edit ✏️
                      </button>
                    )}
                  </div>
                  <div className="card-body">
                    {[
                      ['Primary Contact', info.parent_name  || '—'],
                      ['Parent Phone',    info.parent_phone || '—'],
                      ['Parent Email',    info.parent_email || '—'],
                      ['Parent Aadhar',   info.parent_aadhar_no || '—'],
                      ['Father Name',     info.father_name  || '—'],
                      ['Father Occupation', info.father_occupation || '—'],
                      ['Mother Name',     info.mother_name  || '—'],
                      ['Mother Occupation', info.mother_occupation || '—'],
                      ['Guardian Name',   info.guardian_name || '—'],
                      ['Guardian Relation', info.guardian_relation || '—'],
                      ['Guardian Phone',  info.guardian_phone || '—'],
                    ].map(([label, value]) => (
                      <div key={label} style={{
                        display:'flex', justifyContent:'space-between',
                        padding:'8px 0', borderBottom:'1px solid var(--neutral-1)', fontSize:13,
                      }}>
                        <span style={{ color:'var(--neutral-6)' }}>{label}</span>
                        <span style={{ fontWeight:600, textAlign:'right' }}>{value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Previous Schooling / Transfer Certificate Details */}
                {(info.previous_school_name || info.previous_tc_no || info.is_first_school) && (
                  <div className="card" style={{ margin:0 }}>
                    <div className="card-header" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <h4>📜 Previous School & TC Records</h4>
                    </div>
                    <div className="card-body">
                      {info.is_first_school ? (
                        <div style={{ fontSize:13, color:'#16a34a', fontWeight:600 }}>
                          ✅ First School Admission (Pehla School / No Previous Records)
                        </div>
                      ) : (
                        [
                          ['Previous School', info.previous_school_name || '—'],
                          ['Previous Class',  info.previous_class || '—'],
                          ['TC Number',       info.previous_tc_no || '—'],
                          ['TC Date',         info.previous_tc_date || '—'],
                          ['Leaving Reason',  info.previous_reason || '—'],
                        ].map(([label, value]) => (
                          <div key={label} style={{
                            display:'flex', justifyContent:'space-between',
                            padding:'7px 0', borderBottom:'1px solid var(--neutral-1)', fontSize:13,
                          }}>
                            <span style={{ color:'var(--neutral-6)' }}>{label}</span>
                            <span style={{ fontWeight:600, textAlign:'right' }}>{value}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Quick stats */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  {[
                    { icon:'📅', label:'Attendance', value:`${att.percentage||0}%`,
                      sub:`${att.present||0} present / ${att.absent||0} absent`,
                      color: att.percentage>=75 ? '#16a34a' : '#dc2626' },
                    { icon:'💰', label:'Pending Dues', value: `₹${fmt(feeData.pending)}`,
                      sub: Number(feeData.migrated_dues || 0) > 0 ? `Migrated: ₹${fmt(feeData.migrated_dues)}` : 'All clear',
                      color: Number(feeData.pending) > 0 ? '#dc2626' : '#16a34a' },
                    { icon:'💸', label:'Total Paid', value: `₹${fmt(feeData.total_paid)}`,
                      sub:`Total Due: ₹${fmt(feeData.total_due)}`, color:'#0176d3' },
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

              {/* Fee Reconciliation Banner */}
              <div style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderLeft: '4px solid #0176d3',
                borderRadius: 10,
                padding: '16px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 16,
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
              }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    ⚖️ Fee Ledger Reconciliation
                  </div>
                  <div style={{ fontSize: 14, color: '#1e293b', marginTop: 4 }}>
                    Legacy Migrated Opening Dues: <strong style={{ color: '#d97706' }}>₹{fmt(feeData.migrated_dues || 0)}</strong>
                    <span style={{ margin: '0 8px', color: '#94a3b8' }}>+</span>
                    Current Academic Charges: <strong style={{ color: '#0176d3' }}>₹{fmt(feeData.current_dues || 0)}</strong>
                    <span style={{ margin: '0 8px', color: '#94a3b8' }}>=</span>
                    Total Outstanding: <strong style={{ color: '#dc2626' }}>₹{fmt(feeData.pending || 0)}</strong>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{
                    padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                    background: Number(feeData.migrated_dues || 0) > 0 ? '#fffbeb' : '#f1f5f9',
                    color: Number(feeData.migrated_dues || 0) > 0 ? '#b45309' : '#64748b',
                    border: '1px solid #fde68a'
                  }}>
                    📂 Migrated Dues: ₹{fmt(feeData.migrated_dues || 0)}
                  </span>
                  <span style={{
                    padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                    background: Number(feeData.current_dues || 0) > 0 ? '#eff6ff' : '#f1f5f9',
                    color: Number(feeData.current_dues || 0) > 0 ? '#1d4ed8' : '#64748b',
                    border: '1px solid #bfdbfe'
                  }}>
                    🏫 Academic Dues: ₹{fmt(feeData.current_dues || 0)}
                  </span>
                </div>
              </div>

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

          {/* ══ AUDIT TRAIL ══ */}
          {tab === 'audit' && (
            <EntityAuditTimeline entityType="student" entityId={id} />
          )}

        </div>
      </div>

      {/* ── Issue Document Modal (School → Student) ── */}
      {showIssueModal && (
        <div
          className="modal-backdrop"
          role="button"
          tabIndex={0}
          aria-label="Close modal"
          onClick={e => e.target === e.currentTarget && !docSaving && setShowIssueModal(false)}
          onKeyDown={e => e.key === 'Escape' && !docSaving && setShowIssueModal(false)}
        >
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
        <div
          className="modal-backdrop"
          role="button"
          tabIndex={0}
          aria-label="Close modal"
          onClick={e => e.target === e.currentTarget && !docSaving && setShowUploadModal(false)}
          onKeyDown={e => e.key === 'Escape' && !docSaving && setShowUploadModal(false)}
        >
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
        <div
          className="modal-backdrop"
          role="button"
          tabIndex={0}
          aria-label="Close modal"
          onClick={e => e.target === e.currentTarget && setDeleteDocTarget(null)}
          onKeyDown={e => e.key === 'Escape' && setDeleteDocTarget(null)}
        >
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
        <div
          className="modal-backdrop"
          role="button"
          tabIndex={0}
          aria-label="Close modal"
          onClick={e => e.target === e.currentTarget && setExamPickerType(null)}
          onKeyDown={e => e.key === 'Escape' && setExamPickerType(null)}
        >
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

      {/* ── Edit Student Modal (Admin / Principal) ── */}
      {showEditModal && (
        <EditStudentModal
          studentId={id}
          initialData={info}
          onClose={() => setShowEditModal(false)}
          onUpdated={() => {
            api.get(`/principal/students/${id}/profile`)
              .then(r => setData(r.data))
              .catch(() => {});
          }}
        />
      )}
    </div>
  );
}
