import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Navbar  from '../components/Navbar';
import api from '../api/axios';
import toast from 'react-hot-toast';

export default function ClassesPage() {
  const [classes,   setClasses]   = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form,   setForm]   = useState({ name: '', section: 'A', session: '2024-25' });
  const [saving, setSaving] = useState(false);
  const [msg,    setMsg]    = useState('');

  const navigate = useNavigate();
  const load = () => {
    api.get('/principal/classes')
      .then(r => setClasses(Array.isArray(r.data) ? r.data : []))
      .catch(() => {});
  };

  useEffect(() => { load(); }, []);

  const createClass = async e => {
    e.preventDefault(); setSaving(true); setMsg('');
    try {
      if (form.id) {
        await api.patch(`/principal/classes/${form.id}`, form);
        toast.success('Class updated!');
      } else {
        await api.post('/principal/classes', form);
        toast.success('Class created!');
      }
      setShowModal(false);
      setForm({ name: '', section: 'A', session: '2024-25' });
      load();
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Error';
      setMsg('❌ ' + errMsg);
      toast.error(errMsg);
    }
    setSaving(false);
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar title="Classes & Sections" />
        <div className="page-body">

          <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h2 className="page-title">🏛 Classes & Sections</h2>
              <p className="page-subtitle">{classes.length} classes configured with assigned subjects and teachers</p>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="btn btn-neutral btn-sm"
                onClick={() => navigate('/subjects')}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                📚 Subject Management →
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => { setForm({ name: '', section: 'A', session: '2024-25' }); setShowModal(true); }}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                + Add Class
              </button>
            </div>
          </div>

          {msg && <div className={`alert ${msg.startsWith('✅') ? 'alert-success' : 'alert-error'}`}>{msg}</div>}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 18 }}>
            {classes.map(c => (
              <div
                className="stat-card"
                key={c.id}
                style={{
                  cursor: 'pointer',
                  padding: '20px',
                  borderRadius: 12,
                  background: 'white',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.08)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.05)';
                }}
                onClick={() => navigate(`/classes/${c.id}`)}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 10, background: 'var(--blue-10)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 22, color: 'var(--blue-80)',
                    }}>🏛</div>
                    <span style={{
                      background: '#eff6ff', color: '#0176d3', fontWeight: 700,
                      fontSize: 12, padding: '3px 10px', borderRadius: 12, border: '1px solid #bfdbfe',
                    }}>
                      Section {c.section}
                    </span>
                  </div>

                  <div style={{ fontWeight: 800, fontSize: 18, color: '#0f172a', marginBottom: 6 }}>
                    {c.name}
                  </div>

                  <div style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <span>👥 {c.student_count ?? 0} Students</span>
                    <span>·</span>
                    <span>Session {c.session || '2024-25'}</span>
                  </div>

                  {/* Badges row: Subjects and Class Teacher */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      fontSize: 12, color: '#334155', background: '#f8fafc',
                      padding: '6px 10px', borderRadius: 6, border: '1px solid #f1f5f9',
                    }}>
                      <span style={{ fontSize: 14 }}>📚</span>
                      <span style={{ fontWeight: 600 }}>{c.subjects_count ?? 0} Subjects Configured</span>
                    </div>

                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      fontSize: 12, color: c.teacher_name ? '#166534' : '#92400e',
                      background: c.teacher_name ? '#f0fdf4' : '#fffbeb',
                      padding: '6px 10px', borderRadius: 6,
                      border: c.teacher_name ? '1px solid #dcfce7' : '1px solid #fef3c7',
                    }}>
                      <span style={{ fontSize: 14 }}>👨‍🏫</span>
                      <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.teacher_name ? `Teacher: ${c.teacher_name}` : 'No Class Teacher'}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #f1f5f9', display: 'flex', gap: 8 }}>
                  <button
                    className="btn btn-primary btn-sm"
                    style={{ flex: 1, fontSize: 12, fontWeight: 700, padding: '7px 10px' }}
                    onClick={e => {
                      e.stopPropagation();
                      navigate(`/classes/${c.id}`);
                    }}>
                    👁 View Details
                  </button>
                  <button
                    className="btn btn-neutral btn-sm"
                    style={{ fontSize: 12, padding: '7px 10px' }}
                    onClick={e => {
                      e.stopPropagation();
                      setForm({ name: c.name, section: c.section, session: c.session, id: c.id });
                      setShowModal(true);
                    }}>
                    ✏️ Edit
                  </button>
                </div>
              </div>
            ))}

            {!classes.length && (
              <div style={{ gridColumn: '1/-1' }}>
                <div className="card">
                  <div className="card-body">
                    <div className="empty-state">
                      <div className="empty-state-icon">🏛</div>
                      <p>No classes configured. Add your first class!</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      {showModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h3>{form.id ? '✏️ Edit Class' : '🏛 Add New Class'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={createClass}>
              <div className="modal-body">
                <div className="grid-2">
                  <div className="form-group" style={{ gridColumn: '1/-1' }}>
                    <label className="form-label">Class Name *</label>
                    <input
                      className="form-input"
                      required
                      placeholder="e.g. Class 10, Class 9, Nursery"
                      value={form.name}
                      onChange={e => setForm(f => ({...f, name: e.target.value}))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Section</label>
                    <select
                      className="form-select"
                      value={form.section}
                      onChange={e => setForm(f => ({...f, section: e.target.value}))}
                    >
                      {['A','B','C','D','E','F'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Session</label>
                    <input
                      className="form-input"
                      value={form.session}
                      onChange={e => setForm(f => ({...f, session: e.target.value}))}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-neutral" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : form.id ? '✅ Update Class' : '🏛 Create Class'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
