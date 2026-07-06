// NEW FILE — src/pages/hostel/HostelFeeStructures.jsx
import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api     from '../../api/axios';
import toast   from 'react-hot-toast';

const SHARING_TYPES = ['SINGLE', 'DOUBLE', 'TRIPLE', 'FOUR_SHARING', 'SIX_SHARING', 'CUSTOM'];

const EMPTY_FORM = {
  hostel_id: '', building_id: '', floor_id: '', is_ac: false, sharing_type: 'DOUBLE',
  monthly_fee: '', quarterly_fee: '', yearly_fee: '', security_deposit: '',
  electricity_charges: '', laundry_charges: '', mess_charges: '',
  maintenance_charges: '', late_fine: '', discount: '',
};

export default function HostelFeeStructures() {
  const [darkMode, setDarkMode] = useState(localStorage.getItem('ederp_theme') === 'dark');

  const [hostels, setHostels]   = useState([]);
  const [hostelFilter, setHostelFilter] = useState('');
  const [structures, setStructures] = useState([]);
  const [loading, setLoading]   = useState(true);

  const [buildings, setBuildings] = useState([]);
  const [floors, setFloors]       = useState([]);

  const [showModal, setShowModal] = useState(false);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [saving, setSaving]       = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    api.get('/hostel/hostels').then(r => {
      setHostels(r.data || []);
      if (r.data?.length) setHostelFilter(String(r.data[0].id));
    }).catch(() => toast.error('Hostels load nahi hue'));
  }, []);

  const loadStructures = useCallback(() => {
    setLoading(true);
    const params = hostelFilter ? `?hostel_id=${hostelFilter}` : '';
    api.get('/hostel/fee-structures' + params)
      .then(r => setStructures(r.data || []))
      .catch(() => toast.error('Fee structures load nahi hui'))
      .finally(() => setLoading(false));
  }, [hostelFilter]);

  useEffect(() => { if (hostelFilter) loadStructures(); }, [hostelFilter, loadStructures]);

  function openCreate() {
    setForm({ ...EMPTY_FORM, hostel_id: hostelFilter });
    setEditingId(null);
    setBuildings([]); setFloors([]);
    setShowModal(true);
    if (hostelFilter) {
      api.get(`/hostel/hostels/${hostelFilter}/buildings`).then(r => setBuildings(r.data || []));
    }
  }

  function openEdit(fs) {
    setForm({
      hostel_id: fs.hostel_id, building_id: fs.building_id || '', floor_id: fs.floor_id || '',
      is_ac: fs.is_ac, sharing_type: fs.sharing_type,
      monthly_fee: fs.monthly_fee, quarterly_fee: fs.quarterly_fee,
      yearly_fee: fs.yearly_fee, security_deposit: fs.security_deposit,
      electricity_charges: fs.electricity_charges, laundry_charges: fs.laundry_charges,
      mess_charges: fs.mess_charges, maintenance_charges: fs.maintenance_charges,
      late_fine: fs.late_fine, discount: fs.discount,
    });
    setEditingId(fs.id);
    setShowModal(true);
  }

  function handleBuildingChange(bid) {
    setForm(f => ({ ...f, building_id: bid, floor_id: '' }));
    setFloors([]);
    if (bid) api.get(`/hostel/buildings/${bid}/floors`).then(r => setFloors(r.data || []));
  }

  async function handleSave() {
    if (!form.hostel_id || !form.sharing_type || !form.monthly_fee) {
      toast.error('Hostel, sharing type aur monthly fee zaroori hai');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await api.patch(`/hostel/fee-structures/${editingId}`, form);
        toast.success('Fee structure updated');
      } else {
        await api.post('/hostel/fee-structures', form);
        toast.success('Fee structure created');
      }
      setShowModal(false);
      loadStructures();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save nahi ho paya');
    }
    setSaving(false);
  }

  async function handleDelete(id) {
    if (!window.confirm('Ye fee structure delete karni hai?')) return;
    try {
      await api.delete(`/hostel/fee-structures/${id}`);
      toast.success('Deleted');
      loadStructures();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Delete fail hua');
    }
  }

  async function handleGenerateMonthly() {
    if (!window.confirm('Sab active students ke liye is mahine ki hostel fee generate karni hai?')) return;
    setGenerating(true);
    try {
      const { data } = await api.post('/hostel/fees/generate-monthly', {});
      toast.success(`${data.created} records generate hue (${data.skipped} already the, ${data.no_structure} structure missing)`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Generate fail hua');
    }
    setGenerating(false);
  }

  const cardStyle = {
    background: darkMode ? '#1e293b' : '#fff',
    border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
    borderRadius: 12, padding: 16,
  };
  const inputStyle = {
    width: '100%', padding: '9px 12px', fontSize: 13,
    border: '1px solid #e2e8f0', borderRadius: 8, outline: 'none', boxSizing: 'border-box', marginBottom: 10,
  };
  const labelStyle = { fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4, display: 'block' };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: darkMode ? '#0f172a' : '#f8fafc' }}>
      <Sidebar darkMode={darkMode} />
      <div style={{ marginLeft: 232, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Navbar title="Hostel Fee Structures" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />

        <div style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
            <select
              value={hostelFilter}
              onChange={e => setHostelFilter(e.target.value)}
              style={{
                padding: '9px 14px', fontSize: 13, fontWeight: 600, borderRadius: 8,
                border: '1px solid #e2e8f0', minWidth: 220,
                background: darkMode ? '#1e293b' : '#fff', color: darkMode ? '#f1f5f9' : '#0f172a',
              }}
            >
              {hostels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={handleGenerateMonthly} disabled={generating} style={{
                background: darkMode ? '#1e293b' : '#fff', color: '#4f46e5',
                border: '1px solid #4f46e5', borderRadius: 8,
                padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>
                {generating ? 'Generating...' : '⚡ Generate This Month\'s Fees'}
              </button>
              <button onClick={openCreate} style={{
                background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8,
                padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>
                + Fee Structure
              </button>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>Loading...</div>
          ) : structures.length === 0 ? (
            <div style={{ ...cardStyle, textAlign: 'center', padding: 50, color: '#94a3b8' }}>
              Is hostel ke liye koi fee structure nahi bani abhi
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
              {structures.map(fs => (
                <div key={fs.id} style={cardStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: darkMode ? '#f1f5f9' : '#0f172a' }}>
                        {fs.sharing_type.replace('_', ' ')} · {fs.is_ac ? 'AC' : 'Non-AC'}
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                        {fs.building_name} {fs.floor_id ? `/ ${fs.floor_name}` : ''}
                      </div>
                    </div>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                      background: fs.status === 'ACTIVE' ? '#f0fdf4' : '#fef2f2',
                      color: fs.status === 'ACTIVE' ? '#16a34a' : '#dc2626',
                    }}>{fs.status}</span>
                  </div>

                  <div style={{ fontSize: 22, fontWeight: 800, color: '#4f46e5', marginBottom: 4 }}>
                    ₹{fs.total_monthly.toLocaleString('en-IN')}<span style={{ fontSize: 12, fontWeight: 500, color: '#94a3b8' }}>/month</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 12 }}>
                    Base ₹{fs.monthly_fee} + Mess ₹{fs.mess_charges} + Electricity ₹{fs.electricity_charges}
                    {fs.discount > 0 && ` − Discount ₹${fs.discount}`}
                  </div>

                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => openEdit(fs)} style={{
                      flex: 1, background: '#f1f5f9', color: '#334155', border: 'none',
                      borderRadius: 6, padding: '6px 0', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    }}>Edit</button>
                    <button onClick={() => handleDelete(fs.id)} style={{
                      flex: 1, background: '#fef2f2', color: '#dc2626', border: 'none',
                      borderRadius: 6, padding: '6px 0', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    }}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Create/Edit Modal ── */}
      {showModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h3>{editingId ? 'Edit Fee Structure' : 'New Fee Structure'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              {!editingId && (
                <>
                  <label style={labelStyle}>Building (optional — blank = applies to whole hostel)</label>
                  <select style={inputStyle} value={form.building_id} onChange={e => handleBuildingChange(e.target.value)}>
                    <option value="">All Buildings</option>
                    {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>

                  <label style={labelStyle}>Floor (optional)</label>
                  <select style={inputStyle} value={form.floor_id} disabled={!form.building_id}
                    onChange={e => setForm({ ...form, floor_id: e.target.value })}>
                    <option value="">All Floors</option>
                    {floors.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={labelStyle}>Room Type</label>
                  <select style={inputStyle} value={form.is_ac ? 'AC' : 'NON_AC'}
                    onChange={e => setForm({ ...form, is_ac: e.target.value === 'AC' })} disabled={!!editingId}>
                    <option value="NON_AC">Non-AC</option>
                    <option value="AC">AC</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Sharing Type</label>
                  <select style={inputStyle} value={form.sharing_type} disabled={!!editingId}
                    onChange={e => setForm({ ...form, sharing_type: e.target.value })}>
                    {SHARING_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={labelStyle}>Monthly Fee *</label>
                  <input type="number" style={inputStyle} value={form.monthly_fee}
                    onChange={e => setForm({ ...form, monthly_fee: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>Security Deposit</label>
                  <input type="number" style={inputStyle} value={form.security_deposit}
                    onChange={e => setForm({ ...form, security_deposit: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>Mess Charges</label>
                  <input type="number" style={inputStyle} value={form.mess_charges}
                    onChange={e => setForm({ ...form, mess_charges: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>Electricity Charges</label>
                  <input type="number" style={inputStyle} value={form.electricity_charges}
                    onChange={e => setForm({ ...form, electricity_charges: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>Laundry Charges</label>
                  <input type="number" style={inputStyle} value={form.laundry_charges}
                    onChange={e => setForm({ ...form, laundry_charges: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>Maintenance Charges</label>
                  <input type="number" style={inputStyle} value={form.maintenance_charges}
                    onChange={e => setForm({ ...form, maintenance_charges: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>Late Fine</label>
                  <input type="number" style={inputStyle} value={form.late_fine}
                    onChange={e => setForm({ ...form, late_fine: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>Discount</label>
                  <input type="number" style={inputStyle} value={form.discount}
                    onChange={e => setForm({ ...form, discount: e.target.value })} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-neutral" onClick={() => setShowModal(false)}>Cancel</button>
              <button onClick={handleSave} disabled={saving} style={{
                background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 6,
                padding: '8px 20px', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
              }}>
                {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
