import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import transportApi from '../../api/transportApi';
import toast   from 'react-hot-toast';

const STATUSES = ['REPORTED', 'IN_PROGRESS', 'COMPLETED'];

const STATUS_COLORS = {
  REPORTED:    { bg: '#fef2f2', color: '#dc2626' },
  IN_PROGRESS: { bg: '#fef3c7', color: '#d97706' },
  COMPLETED:   { bg: '#f0fdf4', color: '#16a34a' },
};

const EMPTY_FORM = {
  vehicle_id: '', problem: '', reported_date: new Date().toISOString().slice(0, 10),
  expected_completion: '', cost: '', remarks: '', photo_url: '',
};

export default function VehicleMaintenance() {
  const [darkMode, setDarkMode] = useState(localStorage.getItem('ederp_theme') === 'dark');

  const [records, setRecords] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [vehicleFilter, setVehicleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [editingRecord, setEditingRecord] = useState(null);
  const [editForm, setEditForm] = useState({ status: '', cost: '', expected_completion: '', remarks: '' });
  const [updating, setUpdating] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const params = { page };
    if (vehicleFilter) params.vehicle_id = vehicleFilter;
    if (statusFilter) params.status = statusFilter;
    transportApi.maintenance.list(params)
      .then(r => { setRecords(r.data.data || []); setTotal(r.data.total || 0); })
      .catch(() => toast.error('Maintenance records load nahi hue'))
      .finally(() => setLoading(false));
  }, [page, vehicleFilter, statusFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    transportApi.vehicles.list({ per_page: 200 }).then(r => setVehicles(r.data.data || [])).catch(() => {});
  }, []);

  function openAdd() {
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.vehicle_id) { toast.error('Vehicle select karo'); return; }
    if (!form.problem.trim()) { toast.error('Problem describe karo'); return; }

    setSaving(true);
    try {
      await transportApi.maintenance.create({
        vehicle_id: form.vehicle_id,
        problem: form.problem,
        reported_date: form.reported_date || null,
        expected_completion: form.expected_completion || null,
        cost: form.cost ? Number(form.cost) : 0,
        remarks: form.remarks,
        photo_url: form.photo_url,
      });
      toast.success('Maintenance reported — vehicle status Maintenance ho gaya');
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save nahi hua');
    }
    setSaving(false);
  }

  function openEdit(record) {
    setEditingRecord(record);
    setEditForm({
      status: record.status, cost: record.cost ?? '',
      expected_completion: record.expected_completion || '', remarks: record.remarks || '',
    });
  }

  async function handleUpdate(e) {
    e.preventDefault();
    setUpdating(true);
    try {
      await transportApi.maintenance.update(editingRecord.id, {
        status: editForm.status,
        cost: editForm.cost ? Number(editForm.cost) : 0,
        expected_completion: editForm.expected_completion || null,
        remarks: editForm.remarks,
      });
      toast.success(editForm.status === 'COMPLETED' ? 'Marked completed — vehicle wapas Active ho gaya (agar aur koi open issue nahi hai)' : 'Updated');
      setEditingRecord(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update nahi hua');
    }
    setUpdating(false);
  }

  async function handleDelete(record) {
    if (!window.confirm('Ye maintenance record delete karna hai?')) return;
    try {
      await transportApi.maintenance.remove(record.id);
      toast.success('Deleted');
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
    padding: '8px 10px', fontSize: 12,
    border: '1px solid #e2e8f0', borderRadius: 8, outline: 'none',
  };

  const openCount = records.filter(r => r.status !== 'COMPLETED').length;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: darkMode ? '#0f172a' : '#f8fafc' }}>
      <Sidebar darkMode={darkMode} />
      <div style={{ marginLeft: 232, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Navbar title="Vehicle Maintenance" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />

        <div style={{ padding: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 18 }}>
            <div style={{ ...cardStyle, borderLeft: '4px solid #dc2626' }}>
              <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>OPEN ISSUES (this page)</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#dc2626', marginTop: 4 }}>{openCount}</div>
            </div>
          </div>

          {/* Toolbar */}
          <div style={{ ...cardStyle, marginBottom: 16, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <select value={vehicleFilter} onChange={e => { setPage(1); setVehicleFilter(e.target.value); }} style={inputStyle}>
                <option value="">All Vehicles</option>
                {vehicles.map(v => <option key={v.id} value={v.id}>{v.vehicle_number}</option>)}
              </select>
              <select value={statusFilter} onChange={e => { setPage(1); setStatusFilter(e.target.value); }} style={inputStyle}>
                <option value="">All Status</option>
                {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
            </div>
            <button onClick={openAdd} style={{
              background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8,
              padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>+ Report Problem</button>
          </div>

          <div style={cardStyle}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Loading...</div>
            ) : records.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Koi maintenance record nahi mila</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, textAlign: 'left' }}>
                    <th style={{ padding: '8px 6px', color: '#94a3b8', fontSize: 11 }}>VEHICLE</th>
                    <th style={{ padding: '8px 6px', color: '#94a3b8', fontSize: 11 }}>PROBLEM</th>
                    <th style={{ padding: '8px 6px', color: '#94a3b8', fontSize: 11 }}>REPORTED</th>
                    <th style={{ padding: '8px 6px', color: '#94a3b8', fontSize: 11 }}>EXPECTED</th>
                    <th style={{ padding: '8px 6px', color: '#94a3b8', fontSize: 11 }}>COST</th>
                    <th style={{ padding: '8px 6px', color: '#94a3b8', fontSize: 11 }}>STATUS</th>
                    <th style={{ padding: '8px 6px', color: '#94a3b8', fontSize: 11 }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map(r => (
                    <tr key={r.id} style={{ borderBottom: `1px solid ${darkMode ? '#334155' : '#f1f5f9'}` }}>
                      <td style={{ padding: '10px 6px', fontWeight: 600, color: darkMode ? '#f1f5f9' : '#0f172a' }}>{r.vehicle_number}</td>
                      <td style={{ padding: '10px 6px', color: '#64748b', maxWidth: 240 }}>{r.problem}</td>
                      <td style={{ padding: '10px 6px', color: '#64748b' }}>{r.reported_date}</td>
                      <td style={{ padding: '10px 6px', color: '#64748b' }}>{r.expected_completion || '—'}</td>
                      <td style={{ padding: '10px 6px', color: '#64748b' }}>{r.cost ? `₹${r.cost.toLocaleString()}` : '—'}</td>
                      <td style={{ padding: '10px 6px' }}>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                          background: STATUS_COLORS[r.status]?.bg, color: STATUS_COLORS[r.status]?.color,
                        }}>{r.status.replace('_', ' ')}</span>
                      </td>
                      <td style={{ padding: '10px 6px', whiteSpace: 'nowrap' }}>
                        <button onClick={() => openEdit(r)} style={{
                          background: '#eef2ff', color: '#4f46e5', border: 'none', borderRadius: 6,
                          padding: '5px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer', marginRight: 4,
                        }}>Update</button>
                        <button onClick={() => handleDelete(r)} style={{
                          background: '#fef2f2', color: '#dc2626', border: 'none', borderRadius: 6,
                          padding: '5px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                        }}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>{total} records total</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{
                  padding: '6px 14px', fontSize: 12, borderRadius: 6, border: '1px solid #e2e8f0',
                  background: darkMode ? '#0f172a' : '#fff', color: darkMode ? '#e2e8f0' : '#334155',
                  cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.5 : 1,
                }}>Prev</button>
                <button disabled={records.length < 25} onClick={() => setPage(p => p + 1)} style={{
                  padding: '6px 14px', fontSize: 12, borderRadius: 6, border: '1px solid #e2e8f0',
                  background: darkMode ? '#0f172a' : '#fff', color: darkMode ? '#e2e8f0' : '#334155',
                  cursor: records.length < 25 ? 'not-allowed' : 'pointer', opacity: records.length < 25 ? 0.5 : 1,
                }}>Next</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Report problem modal ── */}
      {showForm && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3>Report Vehicle Problem</h3>
              <button className="modal-close" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <form onSubmit={handleSave} className="modal-body">
              <div>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Vehicle *</label>
                <select className="form-input" value={form.vehicle_id}
                  onChange={e => setForm(f => ({ ...f, vehicle_id: e.target.value }))} required>
                  <option value="">-- Select --</option>
                  {vehicles.map(v => <option key={v.id} value={v.id}>{v.vehicle_number} — {v.vehicle_name}</option>)}
                </select>
              </div>
              <div style={{ marginTop: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Problem *</label>
                <textarea className="form-input" rows={2} value={form.problem}
                  onChange={e => setForm(f => ({ ...f, problem: e.target.value }))} required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Reported Date</label>
                  <input type="date" className="form-input" value={form.reported_date}
                    onChange={e => setForm(f => ({ ...f, reported_date: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Expected Completion</label>
                  <input type="date" className="form-input" value={form.expected_completion}
                    onChange={e => setForm(f => ({ ...f, expected_completion: e.target.value }))} />
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Estimated Cost (₹)</label>
                <input type="number" min="0" className="form-input" value={form.cost}
                  onChange={e => setForm(f => ({ ...f, cost: e.target.value }))} />
              </div>
              <div style={{ marginTop: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Photo URL</label>
                <input className="form-input" placeholder="https://..." value={form.photo_url}
                  onChange={e => setForm(f => ({ ...f, photo_url: e.target.value }))} />
              </div>
              <div style={{ marginTop: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Remarks</label>
                <textarea className="form-input" rows={2} value={form.remarks}
                  onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} />
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 10 }}>
                Report karte hi vehicle status automatically "Maintenance" ho jayega.
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
                }}>{saving ? 'Saving...' : 'Report'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Update status modal ── */}
      {editingRecord && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setEditingRecord(null)}>
          <div className="modal" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h3>Update — {editingRecord.vehicle_number}</h3>
              <button className="modal-close" onClick={() => setEditingRecord(null)}>✕</button>
            </div>
            <form onSubmit={handleUpdate} className="modal-body">
              <div>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Status</label>
                <select className="form-input" value={editForm.status}
                  onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}>
                  {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Cost (₹)</label>
                  <input type="number" min="0" className="form-input" value={editForm.cost}
                    onChange={e => setEditForm(f => ({ ...f, cost: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Expected Completion</label>
                  <input type="date" className="form-input" value={editForm.expected_completion}
                    onChange={e => setEditForm(f => ({ ...f, expected_completion: e.target.value }))} />
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Remarks</label>
                <textarea className="form-input" rows={2} value={editForm.remarks}
                  onChange={e => setEditForm(f => ({ ...f, remarks: e.target.value }))} />
              </div>
              {editForm.status === 'COMPLETED' && (
                <div style={{ fontSize: 11, color: '#16a34a', marginTop: 10 }}>
                  Completed mark karne pe vehicle wapas "Active" ho jayega (agar isi vehicle ka koi aur open issue nahi hai).
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                <button type="button" onClick={() => setEditingRecord(null)} style={{
                  background: '#f1f5f9', color: '#334155', border: 'none', borderRadius: 8,
                  padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}>Cancel</button>
                <button type="submit" disabled={updating} style={{
                  background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8,
                  padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: updating ? 'not-allowed' : 'pointer',
                  opacity: updating ? 0.7 : 1,
                }}>{updating ? 'Updating...' : 'Update'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
