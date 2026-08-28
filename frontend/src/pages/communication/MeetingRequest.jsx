import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { MeetingStatusBadge } from '../../components/communication/StatusBadge';

const MODE_LABEL = {
  GOOGLE_MEET: 'Google Meet',
  ZOOM:        'Zoom Video Call',
  PHONE:       'Phone Consultation',
  REMOTE:      'Remote Desktop Support',
  ONSITE:      'On-site Campus Visit',
};

export default function MeetingRequest() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user }  = useAuth();
  const [darkMode] = useState(() => localStorage.getItem('ederp_theme') === 'dark');
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const [meetings, setMeetings] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(location.pathname.endsWith('/new') || location.search.includes('new=true'));
  const [actionId, setActionId] = useState(null);

  const [form, setForm] = useState({
    topic: '',
    description: '',
    meeting_date: '',
    meeting_time: '',
    priority: 'MEDIUM',
    preferred_mode: 'GOOGLE_MEET',
  });

  const fetchMeetings = useCallback(() => {
    setLoading(true);
    api.get('/support/meetings', { params: { per_page: 50 } })
      .then(r => setMeetings(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchMeetings(); }, [fetchMeetings]);

  const submitMeeting = async (e) => {
    e.preventDefault();
    if (!form.topic.trim() || !form.meeting_date || !form.meeting_time) {
      alert('Please fill out topic, meeting date, and time.');
      return;
    }
    try {
      await api.post('/support/meetings', form);
      setShowForm(false);
      setForm({ topic: '', description: '', meeting_date: '', meeting_time: '', priority: 'MEDIUM', preferred_mode: 'GOOGLE_MEET' });
      fetchMeetings();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to submit meeting request');
    }
  };

  const doAction = async (id, action, payload = {}) => {
    setActionId(id);
    try {
      await api.post(`/support/meetings/${id}/${action}`, payload);
      fetchMeetings();
    } catch (err) {
      alert(err.response?.data?.error || 'Action failed');
    }
    setActionId(null);
  };

  const cardBg = { background: darkMode ? '#141b2d' : '#ffffff', borderColor: darkMode ? '#1e293b' : '#e2e8f0' };
  const border = darkMode ? '#1e293b' : '#e2e8f0';
  const textPri = darkMode ? '#f1f5f9' : '#0f172a';
  const textSec = darkMode ? '#94a3b8' : '#64748b';

  const inputStyle = {
    width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13,
    border: `1px solid ${border}`, background: darkMode ? '#0f172a' : '#fff',
    color: textPri,
  };
  const labelStyle = { fontSize: 12, fontWeight: 700, color: darkMode ? '#cbd5e1' : '#334155', marginBottom: 6, display: 'block' };

  return (
    <div className={`app-shell${darkMode ? ' theme-dark' : ''}`}>
      <Sidebar darkMode={darkMode} />
      <div className="main-content">
        <Navbar title="Support Meetings" darkMode={darkMode} onToggleDark={() => {}} />
        <div className="page-body">

          <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
              <h2 className="page-title">{isSuperAdmin ? 'Support Meeting Requests' : 'Support Meetings'}</h2>
              <p className="page-subtitle">Schedule video consultations and remote technical support sessions</p>
            </div>
            {!isSuperAdmin && (
              <button className="btn btn-primary btn-sm" onClick={() => setShowForm(s => !s)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <i className="ti ti-calendar-plus" style={{ fontSize: 14 }} aria-hidden="true" /> {showForm ? 'Cancel' : 'Book Support Meeting'}
              </button>
            )}
          </div>

          {showForm && !isSuperAdmin && (
            <div className="card" style={{ marginBottom: 24, maxWidth: 640, ...cardBg }}>
              <div className="card-header" style={{ padding: '14px 18px', borderBottom: `1px solid ${border}` }}>
                <h4 style={{ margin: 0, fontSize: 14, color: textPri }}>Request a Support Session</h4>
              </div>
              <form onSubmit={submitMeeting} style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={labelStyle}>Meeting Topic / Agenda *</label>
                  <input style={inputStyle} value={form.topic} onChange={e => setForm(f => ({ ...f, topic: e.target.value }))}
                    placeholder="e.g. Fee collection module walkthrough or biometric setup" />
                </div>
                <div>
                  <label style={labelStyle}>Description / Specific Issues</label>
                  <textarea style={{ ...inputStyle, minHeight: 75, fontFamily: 'inherit', resize: 'vertical' }}
                    value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Details about what you would like to discuss or troubleshoot..." />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label style={labelStyle}>Preferred Date *</label>
                    <input type="date" style={inputStyle} value={form.meeting_date}
                      onChange={e => setForm(f => ({ ...f, meeting_date: e.target.value }))} min={new Date().toISOString().slice(0, 10)} />
                  </div>
                  <div>
                    <label style={labelStyle}>Preferred Time *</label>
                    <input type="text" style={inputStyle} placeholder="e.g. 11:30 AM" value={form.meeting_time}
                      onChange={e => setForm(f => ({ ...f, meeting_time: e.target.value }))} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label style={labelStyle}>Priority</label>
                    <select className="form-select" style={inputStyle} value={form.priority}
                      onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="CRITICAL">Critical</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Preferred Mode</label>
                    <select className="form-select" style={inputStyle} value={form.preferred_mode}
                      onChange={e => setForm(f => ({ ...f, preferred_mode: e.target.value }))}>
                      {Object.entries(MODE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                    </select>
                  </div>
                </div>
                <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>Submit Meeting Request</button>
              </form>
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 13 }}>Loading meetings...</div>
          ) : meetings.length === 0 ? (
            <div className="card" style={{ ...cardBg, padding: 40, textAlign: 'center' }}>
              <i className="ti ti-calendar-off" style={{ fontSize: 36, color: darkMode ? '#475569' : '#cbd5e1', display: 'block', marginBottom: 12 }} aria-hidden="true" />
              <div style={{ fontSize: 14, fontWeight: 600, color: textPri, marginBottom: 4 }}>No meetings scheduled</div>
              <div style={{ fontSize: 12.5, color: textSec }}>Book a meeting with the support engineering team whenever you need live assistance.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {meetings.map(m => (
                <div key={m.id} className="card" style={{ ...cardBg, padding: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: textPri }}>{m.topic}</div>
                      <div style={{ fontSize: 12, color: textSec, marginTop: 3 }}>
                        {isSuperAdmin && m.school_name ? `${m.school_name} · ` : ''}{m.requester_name} ({m.requester_role})
                      </div>
                    </div>
                    <MeetingStatusBadge status={m.status} />
                  </div>

                  <div style={{ display: 'flex', gap: 18, fontSize: 12.5, color: darkMode ? '#cbd5e1' : '#475569', flexWrap: 'wrap', marginBottom: m.description ? 10 : 0 }}>
                    <span><i className="ti ti-calendar" style={{ fontSize: 13, marginRight: 4 }} aria-hidden="true" />{m.meeting_date} at {m.meeting_time}</span>
                    <span><i className="ti ti-video" style={{ fontSize: 13, marginRight: 4 }} aria-hidden="true" />{MODE_LABEL[m.preferred_mode] || m.preferred_mode}</span>
                    {m.reschedule_date && <span style={{ color: '#2563eb', fontWeight: 600 }}><i className="ti ti-clock-edit" style={{ fontSize: 13, marginRight: 4 }} aria-hidden="true" />Rescheduled Date: {m.reschedule_date} {m.reschedule_time}</span>}
                  </div>

                  {m.description && <p style={{ fontSize: 13, color: textSec, marginBottom: 10, lineHeight: 1.5 }}>{m.description}</p>}

                  {m.meeting_link && (
                    <div style={{ marginBottom: 10 }}>
                      <a href={m.meeting_link} target="_blank" rel="noreferrer" style={{
                        fontSize: 12.5, color: '#4f46e5', display: 'inline-flex', alignItems: 'center', gap: 6,
                        fontWeight: 600, textDecoration: 'none', background: darkMode ? '#1e293b' : '#ede9fe',
                        padding: '4px 10px', borderRadius: 6
                      }}>
                        <i className="ti ti-link" style={{ fontSize: 14 }} aria-hidden="true" /> Join Video Meeting
                      </a>
                    </div>
                  )}

                  {m.response_note && (
                    <div style={{ fontSize: 12, color: textSec, fontStyle: 'italic', marginBottom: 10, padding: '6px 10px', borderRadius: 6, background: darkMode ? '#0f172a' : '#f8fafc', border: `1px solid ${border}` }}>
                      <strong>Support Note:</strong> {m.response_note}
                    </div>
                  )}

                  {/* Super Admin Actions */}
                  {isSuperAdmin && m.status === 'PENDING' && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <button disabled={actionId === m.id} className="btn btn-primary btn-sm" onClick={() => {
                        const link = window.prompt('Meeting URL (Google Meet / Zoom):', '');
                        doAction(m.id, 'accept', { meeting_link: link || '' });
                      }}>Accept & Schedule</button>
                      <button disabled={actionId === m.id} className="btn btn-neutral btn-sm" onClick={() => {
                        const d = window.prompt('New proposed date (YYYY-MM-DD):'); if (!d) return;
                        const t = window.prompt('New proposed time (e.g. 11:30 AM):'); if (!t) return;
                        doAction(m.id, 'reschedule', { reschedule_date: d, reschedule_time: t });
                      }}>Propose Reschedule</button>
                      <button disabled={actionId === m.id} className="btn btn-neutral btn-sm" style={{ color: '#dc2626' }} onClick={() => {
                        const reason = window.prompt('Reason for rejection:');
                        doAction(m.id, 'reject', { response_note: reason || '' });
                      }}>Reject</button>
                    </div>
                  )}
                  {isSuperAdmin && ['ACCEPTED', 'RESCHEDULED'].includes(m.status) && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <button disabled={actionId === m.id} className="btn btn-primary btn-sm" onClick={() => {
                        const summary = window.prompt('Meeting summary / resolution notes:');
                        doAction(m.id, 'complete', { response_note: summary || '' });
                      }}>Mark as Completed</button>
                    </div>
                  )}
                  {!isSuperAdmin && m.status === 'PENDING' && (
                    <button disabled={actionId === m.id} className="btn btn-neutral btn-sm" style={{ marginTop: 8, color: '#dc2626' }} onClick={() => {
                      if (window.confirm('Cancel this meeting request?')) doAction(m.id, 'cancel');
                    }}>Cancel Request</button>
                  )}
                </div>
              ))}
            </div>
          )}

        </div>
      </div>

      <style>{`
        .theme-dark { background: #0b1220; }
        .theme-dark .main-content { background: #0b1220; }
        .theme-dark .card { background: #141b2d !important; border-color: #1e293b !important; }
        .theme-dark .page-title { color: #f1f5f9 !important; }
        .theme-dark .page-subtitle { color: #94a3b8 !important; }
        .theme-dark .btn-neutral { background: #1e293b !important; color: #cbd5e1 !important; border-color: #334155 !important; }
      `}</style>
    </div>
  );
}
