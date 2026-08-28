import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api from '../../api/axios';
import PremiumUpgradeCard from '../../components/communication/PremiumUpgradeCard';

const PRIORITY_OPTIONS = [
  { value: 'LOW', label: '⚪ Low Priority' },
  { value: 'MEDIUM', label: '🟡 Medium Priority' },
  { value: 'HIGH', label: '🟠 High Priority' },
  { value: 'CRITICAL', label: '🔴 Critical Issue' },
];

const CATEGORY_OPTIONS = [
  { value: 'GENERAL', label: 'General Inquiry' },
  { value: 'ERP_BUG', label: 'ERP System Bug' },
  { value: 'FEE', label: 'Fee & Payment Related' },
  { value: 'ACADEMIC', label: 'Academics & Exams' },
  { value: 'TEACHER', label: 'Staff & Teacher Management' },
  { value: 'STUDENT', label: 'Student / Admissions' },
  { value: 'TECHNICAL', label: 'Technical / Hardware / Network' },
  { value: 'FEATURE_REQUEST', label: 'New Feature Suggestion' },
  { value: 'COMPLAINT', label: 'Complaint / Escalation' },
];

export default function NewTicket() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const prefill   = location.state?.prefill || {};

  const [darkMode] = useState(() => localStorage.getItem('ederp_theme') === 'dark');

  const [form, setForm] = useState({
    subject:      prefill.subject      || '',
    description:  prefill.description  || '',
    category:     prefill.category     || 'GENERAL',
    priority:     prefill.priority     || 'MEDIUM',
    product_type: 'EduERP',
    module_name:  prefill.module_name  || '',
    send_to:      'ERP_SUPPORT',
  });
  const [file,       setFile]       = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState(null);
  const [limitHit,   setLimitHit]   = useState(null);

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.subject.trim()) {
      setError('Please provide a subject for the ticket');
      return;
    }
    setSubmitting(true);
    setError(null);
    setLimitHit(null);
    try {
      const { data } = await api.post('/support/tickets', form);
      if (file && data.id) {
        const fd = new FormData();
        fd.append('file', file);
        await api.post(`/support/tickets/${data.id}/attachment`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }).catch(() => {});
      }
      navigate(`/support/tickets/${data.id}`);
    } catch (err) {
      if (err.response?.status === 429 && err.response?.data?.upgrade_cta) {
        setLimitHit(err.response.data.message);
      } else {
        setError(err.response?.data?.error || 'Failed to create support ticket. Please try again.');
      }
    }
    setSubmitting(false);
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
        <Navbar title="New Support Ticket" darkMode={darkMode} onToggleDark={() => {}} />
        <div className="page-body">

          <div className="page-header" style={{ marginBottom: 20 }}>
            <button onClick={() => navigate('/support/tickets')} style={{
              background: 'none', border: 'none', cursor: 'pointer', fontSize: 12,
              color: textSec, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <i className="ti ti-arrow-left" style={{ fontSize: 13 }} aria-hidden="true" /> Back to Support Inbox
            </button>
            <h2 className="page-title">Create Support Ticket</h2>
            <p className="page-subtitle">Submit a bug report, system request, or technical inquiry directly to the ERP support team.</p>
          </div>

          {limitHit && (
            <div style={{ marginBottom: 20, maxWidth: 720 }}>
              <PremiumUpgradeCard darkMode={darkMode} variant="banner" reason={limitHit} />
            </div>
          )}

          <div className="card" style={{ maxWidth: 720, ...cardBg }}>
            <form onSubmit={submit} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>

              {error && (
                <div style={{
                  padding: '10px 14px', borderRadius: 8, fontSize: 12.5,
                  background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626',
                }}>
                  <i className="ti ti-alert-circle" style={{ marginRight: 6 }} />{error}
                </div>
              )}

              <div>
                <label style={labelStyle}>Subject / Issue Title *</label>
                <input
                  style={inputStyle}
                  value={form.subject}
                  onChange={e => set('subject', e.target.value)}
                  placeholder="e.g. Fee receipt PDF printing issue in Finance module"
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={labelStyle}>Category</label>
                  <select className="form-select" style={inputStyle} value={form.category} onChange={e => set('category', e.target.value)}>
                    {CATEGORY_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Priority Level</label>
                  <select className="form-select" style={inputStyle} value={form.priority} onChange={e => set('priority', e.target.value)}>
                    {PRIORITY_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={labelStyle}>Module Name (Optional)</label>
                  <input
                    style={inputStyle}
                    value={form.module_name}
                    onChange={e => set('module_name', e.target.value)}
                    placeholder="e.g. Fees, Attendance, Timetable"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Send To</label>
                  <select className="form-select" style={inputStyle} value={form.send_to} onChange={e => set('send_to', e.target.value)}>
                    <option value="ERP_SUPPORT">ERP Technical Support</option>
                    <option value="DEVELOPER">Core Engineering Team</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={labelStyle}>Detailed Description</label>
                <textarea
                  style={{ ...inputStyle, minHeight: 110, fontFamily: 'inherit', resize: 'vertical' }}
                  value={form.description}
                  onChange={e => set('description', e.target.value)}
                  placeholder="Explain the steps to reproduce the issue, expected outcome, and actual result..."
                />
              </div>

              <div>
                <label style={labelStyle}>Attach Screenshot / File (Optional)</label>
                <div style={{
                  padding: '12px 16px', border: `1px dashed ${border}`, borderRadius: 8,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: darkMode ? '#0f172a' : '#f8fafc'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: textSec }}>
                    <i className="ti ti-file-upload" style={{ fontSize: 18, color: '#4f46e5' }} />
                    <span>{file ? file.name : 'Upload PDF, PNG, JPG, or DOC file (Max 15MB)'}</span>
                  </div>
                  <label className="btn btn-neutral btn-sm" style={{ cursor: 'pointer', margin: 0 }}>
                    Browse
                    <input type="file" hidden onChange={e => setFile(e.target.files?.[0] || null)} />
                  </label>
                </div>
                {file && (
                  <button type="button" onClick={() => setFile(null)} style={{ marginTop: 6, background: 'none', border: 'none', color: '#dc2626', fontSize: 11.5, cursor: 'pointer' }}>
                    Remove attachment
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
                <button type="button" className="btn btn-neutral" onClick={() => navigate('/support/tickets')}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Submitting Ticket...' : 'Submit Support Ticket'}
                </button>
              </div>

            </form>
          </div>

        </div>
      </div>

      <style>{`
        .theme-dark { background: #0b1220; }
        .theme-dark .main-content { background: #0b1220; }
        .theme-dark .card { background: #141b2d !important; border-color: #1e293b !important; }
        .theme-dark .page-title { color: #f1f5f9 !important; }
        .theme-dark .page-subtitle { color: #94a3b8 !important; }
      `}</style>
    </div>
  );
}
