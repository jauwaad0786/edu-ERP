import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api     from '../../api/axios';
import toast   from 'react-hot-toast';

const EMPTY_FORM = {
  name: '', mobile_number: '', address: '', photo_url: '',
  experience_years: '', emergency_contact: '', remarks: '',
};

export default function Conductors() {
  const [darkMode, setDarkMode] = useState(localStorage.getItem('ederp_theme') === 'dark');

  const [conductors, setConductors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page });
    if (search) params.set('search', search);
    if (statusFilter) params.set('status', statusFilter);
    api.get('/transport/conductors?' + params.toString())
      .then(r => { setConductors(r.data.data || []); setPages(r.data.pages || 1); })
      .catch(() => toast.error('Conductors load nahi hue'))
      .finally(() => setLoading(false));
  }, [page, search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(c) {
    setEditingId(c.id);
    setForm({
      name: c.name || '', mobile_number: c.mobile_number || '', address: c.address || '',
      photo_url: c.photo_url || '', experience_years: c.experience_years || '',
      emergency_contact: c.emergency_contact || '', remarks: c.remarks || '',
    });
    setShowForm(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.mobile_number.trim()) {
      toast.error('Name aur mobile number required hain');
      return;
    }

    setSaving(true);
    const payload = { ...form, experience_years: form.experience_years ? Number(form.experience_years) : 0 };
    try {
      if (editingId) {
        await api.put(`/transport/conductors/${editingId}`, payload);
        toast.success('Conductor updated');
      } else {
        await api.post('/transport/conductors', payload);
        toast.success('Conductor added');
      }
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save nahi hua');
    }
    setSaving(false);
  }

  async function handleDelete(c) {
    if (!window.confirm(`${c.name} ko delete karna hai?`)) return;
    try {
      await api.delete(`/transport/conductors/${c.id}`);
      toast.success('Conductor deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete nahi hua');
    }
  }

  async function toggleStatus(c) {
    const newStatus = c.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await api.put(`/transport/conductors/${c.id}`, { status: newStatus });
      toast.success(`Conductor ${newStatus.toLowerCase()}`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update nahi hua');
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
        <Navbar title="Conductors" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />

        <div style={{ padding: 24 }}>
          {/* Toolbar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <input value={search} onChange={e => { setPage(1); setSearch(e.target.value); }}
                placeholder="Search name/mobile..." style={{ ...inputStyle, width: 240 }} />
              <select value={statusFilter} onChange={e => { setPage(1); setStatusFilter(e.target.value); }}
                style={{ padding: '9px 12px', fontSize: 13, border: '1px solid #e2e8f0', borderRadius: 8 }}>
                <option value="">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
            <button onClick={openAdd} style={{
              background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8,
              padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>
              + Add Conductor
            </button>
          </div>

          {/* Table */}
          <div style={cardStyle}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Loading...</div>
            ) : conductors.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
                Koi conductor nahi mila — ye role optional hai, sab vehicles pe conductor hona zaroori nahi
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, textAlign: 'left' }}>
                    <th style={{ padding: '8px 6px', color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>NAME</th>
                    <th style={{ padding: '8px 6px', color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>MOBILE</th>
                    <th style={{ padding: '8px 6px', color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>EXPERIENCE</th>
                    <th style={{ padding: '8px 6px', color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>VEHICLE</th>
                    <th style={{ padding: '8px 6px', color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>STATUS</th>
                    <th style={{ padding: '8px 6px', color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {conductors.map(c => (
                    <tr key={c.id} style={{ borderBottom: `1px solid ${darkMode ? '#334155' : '#f1f5f9'}` }}>
                      <td style={{ padding: '10px 6px', color: darkMode ? '#f1f5f9' : '#0f172a', fontWeight: 600 }}>{c.name}</td>
                      <td style={{ padding: '10px 6px', color: '#64748b' }}>{c.mobile_number}</td>
                      <td style={{ padding: '10px 6px', color: '#64748b' }}>{c.experience_years} yrs</td>
                      <td style={{ padding: '10px 6px', color: '#64748b' }}>{c.assigned_vehicle_number || '—'}</td>
                      <td style={{ padding: '10px 6px' }}>
                        <span onClick={() => toggleStatus(c)} style={{
                          fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, cursor: 'pointer',
                          background: c.status === 'ACTIVE' ? '#f0fdf4' : '#f1f5f9',
                          color: c.status === 'ACTIVE' ? '#16a34a' : '#64748b',
                        }}>{c.status}</span>
                      </td>
                      <td style={{ padding: '10px 6px' }}>
                        <button onClick={() => openEdit(c)} style={{
                          background: '#eef2ff', color: '#4f46e5', border: 'none', borderRadius: 6,
                          padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', marginRight: 6,
                        }}>Edit</button>
                        <button onClick={() => handleDelete(c)} style={{
                          background: '#fef2f2', color: '#dc2626', border: 'none', borderRadius: 6,
                          padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                        }}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {pages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{
                  padding: '6px 14px', fontSize: 12, borderRadius: 6, border: '1px solid #e2e8f0',
                  background: darkMode ? '#0f172a' : '#fff', color: darkMode ? '#e2e8f0' : '#334155',
                  cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.5 : 1,
                }}>Prev</button>
                <span style={{ fontSize: 12, color: '#94a3b8', alignSelf: 'center' }}>Page {page} of {pages}</span>
                <button disabled={page >= pages} onClick={() => setPage(p => p + 1)} style={{
                  padding: '6px 14px', fontSize: 12, borderRadius: 6, border: '1px solid #e2e8f0',
                  background: darkMode ? '#0f172a' : '#fff', color: darkMode ? '#e2e8f0' : '#334155',
                  cursor: page >= pages ? 'not-allowed' : 'pointer', opacity: page >= pages ? 0.5 : 1,
                }}>Next</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Add/Edit Modal ── */}
      {showForm && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h3>{editingId ? 'Edit Conductor' : 'Add Conductor'}</h3>
              <button className="modal-close" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <form onSubmit={handleSave} className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Name *</label>
                  <input className="form-input" value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Mobile Number *</label>
                  <input className="form-input" value={form.mobile_number}
                    onChange={e => setForm(f => ({ ...f, mobile_number: e.target.value }))} required />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Experience (years)</label>
                  <input type="number" min="0" className="form-input" value={form.experience_years}
                    onChange={e => setForm(f => ({ ...f, experience_years: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Photo URL</label>
                  <input className="form-input" value={form.photo_url}
                    onChange={e => setForm(f => ({ ...f, photo_url: e.target.value }))} />
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Address</label>
                <input className="form-input" value={form.address}
                  onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
              </div>

              <div style={{ marginTop: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Emergency Contact</label>
                <input className="form-input" value={form.emergency_contact}
                  onChange={e => setForm(f => ({ ...f, emergency_contact: e.target.value }))} />
              </div>

              <div style={{ marginTop: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Remarks</label>
                <textarea className="form-input" rows={2} value={form.remarks}
                  onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} />
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
