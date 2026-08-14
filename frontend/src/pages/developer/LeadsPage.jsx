// frontend/src/pages/developer/LeadsPage.jsx
import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api from '../../api/axios';

const STATUS_COLORS = {
  NEW:       '#dc2626',
  CONTACTED: '#d97706',
  CLOSED:    '#16a34a',
};

export default function LeadsPage() {
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('ederp_theme') === 'dark');
  useEffect(() => { localStorage.setItem('ederp_theme', darkMode ? 'dark' : 'light'); }, [darkMode]);

  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('ALL');   // ALL | DEMO | CONTACT
  const [selected, setSelected] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchLeads();
  }, [typeFilter]);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const params = {};
      if (typeFilter !== 'ALL') params.lead_type = typeFilter;
      const res = await api.get('/developer/leads', { params });
      setLeads(res.data || []);
    } catch (err) {
      console.error('Failed to fetch leads:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id, status) => {
    setUpdating(true);
    try {
      await api.patch(`/developer/leads/${id}/status`, { status });
      fetchLeads();
      setShowModal(false);
    } catch (err) {
      alert('Status update fail ho gaya');
    } finally {
      setUpdating(false);
    }
  };

  const newCount = leads.filter(l => l.status === 'NEW').length;

  return (
    <div className={`app-shell${darkMode ? ' theme-dark' : ''}`}>
      <Sidebar darkMode={darkMode} />
      <div className="main-content">
        <Navbar title="Demo Requests & Messages" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />
        <div className="page-body">
          <div className="page-container">
            <div className="page-header">
              <div>
                <h2 className="page-title">Demo Requests & Messages</h2>
                <p className="page-subtitle">
                  OmniSphere 365 website se aaye leads — {newCount} naye
                </p>
              </div>
              <button className="btn btn-neutral btn-sm" onClick={fetchLeads}>
                <i className="ti ti-refresh" /> Refresh
              </button>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {['ALL', 'DEMO', 'CONTACT'].map(t => (
                <button
                  key={t}
                  className={`btn btn-sm ${typeFilter === t ? 'btn-primary' : 'btn-neutral'}`}
                  onClick={() => setTypeFilter(t)}
                >
                  {t === 'ALL' ? 'All' : t === 'DEMO' ? 'Demo Requests' : 'Contact Messages'}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="loading-spinner">Loading leads...</div>
            ) : leads.length === 0 ? (
              <div className="card" style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                Abhi tak koi demo request ya message nahi aaya.
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {leads.map(lead => (
                  <div
                    key={lead.id}
                    className="card"
                    style={{
                      padding: '14px 18px',
                      cursor: 'pointer',
                      background: darkMode ? '#141b2d' : undefined,
                    }}
                    onClick={() => { setSelected(lead); setShowModal(true); }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap', gap: 8 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>
                          {lead.name} {lead.company ? `· ${lead.company}` : ''}
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                          {lead.email} {lead.phone ? `· ${lead.phone}` : ''}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{
                          padding: '2px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700,
                          background: lead.lead_type === 'DEMO' ? '#2563eb20' : '#8b5cf620',
                          color: lead.lead_type === 'DEMO' ? '#2563eb' : '#8b5cf6',
                        }}>
                          {lead.lead_type === 'DEMO' ? 'DEMO REQUEST' : 'CONTACT MESSAGE'}
                        </span>
                        <span style={{
                          padding: '2px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700,
                          background: STATUS_COLORS[lead.status] + '20',
                          color: STATUS_COLORS[lead.status],
                        }}>
                          {lead.status}
                        </span>
                      </div>
                    </div>
                    {lead.message && (
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>
                        {lead.message.length > 140 ? lead.message.slice(0, 140) + '…' : lead.message}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 8 }}>
                      <i className="ti ti-clock" /> {new Date(lead.created_at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showModal && selected && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520, background: darkMode ? '#141b2d' : undefined }}>
            <div className="modal-header">
              <h3>{selected.lead_type === 'DEMO' ? 'Demo Request' : 'Contact Message'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <div className="modal-body" style={{ display: 'grid', gap: 10 }}>
              <div><strong>Name:</strong> {selected.name}</div>
              {selected.company && <div><strong>Company:</strong> {selected.company}</div>}
              <div><strong>Email:</strong> {selected.email}</div>
              {selected.phone && <div><strong>Phone:</strong> {selected.phone}</div>}
              {selected.city && <div><strong>City:</strong> {selected.city}</div>}
              {selected.service && <div><strong>Service:</strong> {selected.service}</div>}
              {selected.org_size && <div><strong>Size:</strong> {selected.org_size}</div>}
              {selected.message && (
                <div>
                  <strong>Message:</strong>
                  <div style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{selected.message}</div>
                </div>
              )}
              <div><strong>Received:</strong> {new Date(selected.created_at).toLocaleString()}</div>

              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                {['NEW', 'CONTACTED', 'CLOSED'].filter(s => s !== selected.status).map(s => (
                  <button
                    key={s}
                    className="btn btn-neutral btn-sm"
                    disabled={updating}
                    onClick={() => updateStatus(selected.id, s)}
                  >
                    Mark {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
