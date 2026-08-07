import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api     from '../../api/axios';
import toast   from 'react-hot-toast';

const EMPTY_FORM = { name: '', latitude: '', longitude: '', radius: '200', description: '' };

export default function Stops() {
  const [darkMode, setDarkMode] = useState(localStorage.getItem('ederp_theme') === 'dark');

  const [stops, setStops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    api.get('/transport/stops?' + params.toString())
      .then(r => setStops(r.data.data || []))
      .catch(() => toast.error('Stops load nahi hue'))
      .finally(() => setLoading(false));
  }, [search]);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(s) {
    setEditingId(s.id);
    setForm({
      name: s.name || '', latitude: s.latitude ?? '', longitude: s.longitude ?? '',
      radius: s.radius ?? '200', description: s.description || '',
    });
    setShowForm(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Stop name required hai'); return; }

    setSaving(true);
    const payload = {
      name: form.name,
      latitude: form.latitude !== '' ? Number(form.latitude) : null,
      longitude: form.longitude !== '' ? Number(form.longitude) : null,
      radius: form.radius !== '' ? Number(form.radius) : 200,
      description: form.description,
    };
    try {
      if (editingId) {
        await api.put(`/transport/stops/${editingId}`, payload);
        toast.success('Stop updated');
      } else {
        await api.post('/transport/stops', payload);
        toast.success('Stop added');
      }
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save nahi hua');
    }
    setSaving(false);
  }

  async function handleDelete(s) {
    if (!window.confirm(`"${s.name}" stop delete karni hai?`)) return;
    try {
      await api.delete(`/transport/stops/${s.id}`);
      toast.success('Stop deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete nahi hua');
    }
  }

  const cardStyle = {
    background: darkMode ? '#1e293b' : '#fff',
    border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
    borderRadius: 12, padding: 18,
  };
  const inputStyle = {
    width: '100%', padding: '9px 12px', fontSize: 13,
    border: '1px solid #e2e8f0', borderRadius: 8, outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: darkMode ? '#0f172a' : '#f8fafc' }}>
      <Sidebar darkMode={darkMode} />
      <div style={{ marginLeft: 232, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Navbar title="Stops" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />

        <div style={{ padding: 24 }}>
          {/* Toolbar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search stop name..." style={{ ...inputStyle, width: 260 }} />
            <button onClick={openAdd} style={{
              background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8,
              padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>
              + Add Stop
            </button>
          </div>

          {/* Grid of stop cards */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Loading...</div>
          ) : stops.length === 0 ? (
            <div style={{ ...cardStyle, textAlign: 'center', padding: 40, color: '#94a3b8' }}>Koi stop nahi mila</div>
          ) : (
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14,
            }}>
              {stops.map(s => (
                <div key={s.id} style={cardStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: darkMode ? '#f1f5f9' : '#0f172a' }}>{s.name}</div>
                      {s.description && (
                        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{s.description}</div>
                      )}
                    </div>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                      background: '#eef2ff', color: '#4f46e5',
                    }}>{s.students_count} students</span>
                  </div>

                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 10 }}>
                    {s.latitude && s.longitude ? (
                      <>📍 {s.latitude.toFixed(4)}, {s.longitude.toFixed(4)}</>
                    ) : (
                      <>📍 Coordinates not set</>
                    )}
                    {' · '}Radius: {s.radius}m
                  </div>

                  <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                    <button onClick={() => openEdit(s)} style={{
                      flex: 1, background: '#eef2ff', color: '#4f46e5', border: 'none', borderRadius: 6,
                      padding: '6px 0', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    }}>Edit</button>
                    <button onClick={() => handleDelete(s)} style={{
                      flex: 1, background: '#fef2f2', color: '#dc2626', border: 'none', borderRadius: 6,
                      padding: '6px 0', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    }}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Add/Edit Modal ── */}
      {showForm && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3>{editingId ? 'Edit Stop' : 'Add Stop'}</h3>
              <button className="modal-close" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <form onSubmit={handleSave} className="modal-body">
              <div>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Stop Name *</label>
                <input className="form-input" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Latitude</label>
                  <input type="number" step="any" className="form-input" value={form.latitude}
                    onChange={e => setForm(f => ({ ...f, latitude: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Longitude</label>
                  <input type="number" step="any" className="form-input" value={form.longitude}
                    onChange={e => setForm(f => ({ ...f, longitude: e.target.value }))} />
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Radius (meters)</label>
                <input type="number" min="20" className="form-input" value={form.radius}
                  onChange={e => setForm(f => ({ ...f, radius: e.target.value }))} />
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                  Geofence radius — driver ki gaadi is dayre me aane pe "arrived" mana jayega
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Description</label>
                <textarea className="form-input" rows={2} value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                <button type="button" onClick={() => setShowForm(false)} style={{
                  background: '#f1f5f9', color: '#334155', border: 'none', borderRadius: 8,
                  padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}>Cancel</button>
                <button type="submit" disabled={saving} style={{
                  background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8,
                  padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.7 : 1,
                }}>{saving ? 'Saving...' : editingId ? 'Update' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
