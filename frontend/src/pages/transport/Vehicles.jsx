import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api     from '../../api/axios';
import toast   from 'react-hot-toast';

const VEHICLE_TYPES = ['BUS', 'VAN', 'CAR'];
const STATUS_COLORS = {
  ACTIVE:      { bg: '#f0fdf4', color: '#16a34a' },
  INACTIVE:    { bg: '#f1f5f9', color: '#64748b' },
  MAINTENANCE: { bg: '#fef3c7', color: '#d97706' },
};

const EMPTY_FORM = {
  vehicle_number: '', vehicle_name: '', vehicle_type: 'BUS', capacity: '',
  driver_id: '', conductor_id: '', purchase_date: '', insurance_expiry: '',
  photo_url: '', notes: '',
};

export default function Vehicles() {
  const [darkMode, setDarkMode] = useState(localStorage.getItem('ederp_theme') === 'dark');

  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers]   = useState([]);
  const [conductors, setConductors] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Student Roster Modal
  const [showStudentsModal, setShowStudentsModal] = useState(false);
  const [selectedVehicleData, setSelectedVehicleData] = useState(null);
  const [loadingStudents, setLoadingStudents] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page });
    if (search) params.set('search', search);
    if (typeFilter) params.set('vehicle_type', typeFilter);
    if (statusFilter) params.set('status', statusFilter);
    api.get('/transport/vehicles?' + params.toString())
      .then(r => { setVehicles(r.data.data || []); setPages(r.data.pages || 1); })
      .catch(() => toast.error('Vehicles load nahi hue'))
      .finally(() => setLoading(false));
  }, [page, search, typeFilter, statusFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api.get('/transport/drivers?per_page=200').then(r => setDrivers(r.data.data || [])).catch(() => {});
    api.get('/transport/conductors?per_page=200').then(r => setConductors(r.data.data || [])).catch(() => {});
  }, []);

  const openStudentsRoster = async (v) => {
    setSelectedVehicleData({ vehicle: v, students: [], capacity: v.capacity || 0, assigned_count: 0 });
    setShowStudentsModal(true);
    setLoadingStudents(true);
    try {
      const res = await api.get(`/transport/vehicles/${v.id}/students`);
      setSelectedVehicleData(res.data.data);
    } catch (err) {
      toast.error('Could not load student roster');
    } finally {
      setLoadingStudents(false);
    }
  };

  function openAdd() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(v) {
    setEditingId(v.id);
    setForm({
      vehicle_number: v.vehicle_number || '', vehicle_name: v.vehicle_name || '',
      vehicle_type: v.vehicle_type || 'BUS', capacity: v.capacity || '',
      driver_id: v.driver_id || '', conductor_id: v.conductor_id || '',
      purchase_date: v.purchase_date || '', insurance_expiry: v.insurance_expiry || '',
      photo_url: v.photo_url || '', notes: v.notes || '',
    });
    setShowForm(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.vehicle_number.trim()) { toast.error('Vehicle number required hai'); return; }

    setSaving(true);
    const payload = {
      ...form,
      capacity: form.capacity ? Number(form.capacity) : 0,
      driver_id: form.driver_id || null,
      conductor_id: form.conductor_id || null,
      purchase_date: form.purchase_date || null,
      insurance_expiry: form.insurance_expiry || null,
    };
    try {
      if (editingId) {
        await api.put(`/transport/vehicles/${editingId}`, payload);
        toast.success('Vehicle updated');
      } else {
        await api.post('/transport/vehicles', payload);
        toast.success('Vehicle added');
      }
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save nahi hua');
    }
    setSaving(false);
  }

  async function handleDelete(v) {
    if (!window.confirm(`${v.vehicle_number} delete karni hai?`)) return;
    try {
      await api.delete(`/transport/vehicles/${v.id}`);
      toast.success('Vehicle deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete nahi hua');
    }
  }

  async function quickStatus(v, status) {
    try {
      await api.put(`/transport/vehicles/${v.id}`, { status });
      toast.success(`Status set to ${status}`);
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
        <Navbar title="Vehicles" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />

        <div style={{ padding: 24 }}>
          {/* Toolbar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <input value={search} onChange={e => { setPage(1); setSearch(e.target.value); }}
                placeholder="Search vehicle number/name..." style={{ ...inputStyle, width: 240 }} />
              <select value={typeFilter} onChange={e => { setPage(1); setTypeFilter(e.target.value); }}
                style={{ padding: '9px 12px', fontSize: 13, border: '1px solid #e2e8f0', borderRadius: 8 }}>
                <option value="">All Types</option>
                {VEHICLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <select value={statusFilter} onChange={e => { setPage(1); setStatusFilter(e.target.value); }}
                style={{ padding: '9px 12px', fontSize: 13, border: '1px solid #e2e8f0', borderRadius: 8 }}>
                <option value="">All Status</option>
                {Object.keys(STATUS_COLORS).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <button onClick={openAdd} style={{
              background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8,
              padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>
              + Add Vehicle
            </button>
          </div>

          {/* Table */}
          <div style={cardStyle}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Loading...</div>
            ) : vehicles.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Koi vehicle nahi mila</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, textAlign: 'left' }}>
                    <th style={{ padding: '8px 6px', color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>VEHICLE #</th>
                    <th style={{ padding: '8px 6px', color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>TYPE</th>
                    <th style={{ padding: '8px 6px', color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>CAPACITY</th>
                    <th style={{ padding: '8px 6px', color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>DRIVER</th>
                    <th style={{ padding: '8px 6px', color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>ROUTE</th>
                    <th style={{ padding: '8px 6px', color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>STUDENTS</th>
                    <th style={{ padding: '8px 6px', color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>STATUS</th>
                    <th style={{ padding: '8px 6px', color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {vehicles.map(v => (
                    <tr key={v.id} style={{ borderBottom: `1px solid ${darkMode ? '#334155' : '#f1f5f9'}` }}>
                      <td style={{ padding: '10px 6px', color: darkMode ? '#f1f5f9' : '#0f172a', fontWeight: 600 }}>
                        {v.vehicle_number}
                        {v.vehicle_name && <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400 }}>{v.vehicle_name}</div>}
                      </td>
                      <td style={{ padding: '10px 6px', color: '#64748b' }}>{v.vehicle_type}</td>
                      <td style={{ padding: '10px 6px', color: '#64748b' }}>
                        {v.students_assigned}/{v.capacity || '—'}
                      </td>
                      <td style={{ padding: '10px 6px', color: '#64748b' }}>{v.driver_name || '—'}</td>
                      <td style={{ padding: '10px 6px', color: '#64748b' }}>{v.route_name || '—'}</td>
                      <td style={{ padding: '10px 6px', color: '#64748b' }}>{v.students_assigned}</td>
                      <td style={{ padding: '10px 6px' }}>
                        <select value={v.status} onChange={e => quickStatus(v, e.target.value)} style={{
                          fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20, border: 'none',
                          background: STATUS_COLORS[v.status]?.bg, color: STATUS_COLORS[v.status]?.color, cursor: 'pointer',
                        }}>
                          {Object.keys(STATUS_COLORS).map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '10px 6px' }}>
                        <button onClick={() => openStudentsRoster(v)} style={{
                          background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', borderRadius: 6,
                          padding: '5px 9px', fontSize: 11, fontWeight: 800, cursor: 'pointer', marginRight: 6,
                        }}>👥 Roster</button>
                        <button onClick={() => openEdit(v)} style={{
                          background: '#eef2ff', color: '#4f46e5', border: 'none', borderRadius: 6,
                          padding: '5px 9px', fontSize: 11, fontWeight: 700, cursor: 'pointer', marginRight: 6,
                        }}>Edit</button>
                        <button onClick={() => handleDelete(v)} style={{
                          background: '#fef2f2', color: '#dc2626', border: 'none', borderRadius: 6,
                          padding: '5px 9px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
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

      {/* ── Bus Student Roster Modal ── */}
      {showStudentsModal && selectedVehicleData && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowStudentsModal(false)}>
          <div className="modal" style={{ maxWidth: 800 }}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0 }}>
                  🚌 Passenger Roster — {selectedVehicleData.vehicle?.vehicle_number}
                </h3>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                  {selectedVehicleData.vehicle?.vehicle_name || 'Bus Fleet'} • Driver: {selectedVehicleData.vehicle?.driver_name || 'Not assigned'}
                </div>
              </div>
              <button className="modal-close" onClick={() => setShowStudentsModal(false)}>✕</button>
            </div>

            <div className="modal-body">
              {/* Capacity & Occupancy Bar */}
              <div style={{
                background: darkMode ? '#1e293b' : '#f8fafc',
                padding: '12px 16px', borderRadius: 12, marginBottom: 16,
                border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>CAPACITY OCCUPANCY</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#6366f1' }}>
                    {selectedVehicleData.assigned_count} / {selectedVehicleData.capacity} Seats Filled
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>AVAILABLE SEATS</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: (selectedVehicleData.available_capacity || 0) > 0 ? '#10b981' : '#ef4444' }}>
                    {selectedVehicleData.available_capacity || 0} Seats Free
                  </div>
                </div>
              </div>

              {loadingStudents ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>Loading student roster...</div>
              ) : (selectedVehicleData.students || []).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                  No students are currently assigned to this vehicle.
                </div>
              ) : (
                <div style={{ overflowX: 'auto', maxHeight: '380px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: `2px solid ${darkMode ? '#334155' : '#e2e8f0'}`, textAlign: 'left' }}>
                        <th style={{ padding: '8px 6px', color: '#94a3b8' }}>STUDENT</th>
                        <th style={{ padding: '8px 6px', color: '#94a3b8' }}>CLASS</th>
                        <th style={{ padding: '8px 6px', color: '#94a3b8' }}>PICKUP STOP</th>
                        <th style={{ padding: '8px 6px', color: '#94a3b8' }}>DROP STOP</th>
                        <th style={{ padding: '8px 6px', color: '#94a3b8' }}>GUARDIAN CONTACT</th>
                        <th style={{ padding: '8px 6px', color: '#94a3b8' }}>FEE STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedVehicleData.students.map(st => (
                        <tr key={st.student_id} style={{ borderBottom: `1px solid ${darkMode ? '#334155' : '#f1f5f9'}` }}>
                          <td style={{ padding: '8px 6px', fontWeight: 700, color: darkMode ? '#f1f5f9' : '#0f172a' }}>
                            {st.student_name}
                            <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500 }}>Adm: {st.admission_no}</div>
                          </td>
                          <td style={{ padding: '8px 6px', color: '#64748b' }}>{st.class_name || '—'}</td>
                          <td style={{ padding: '8px 6px', color: '#64748b' }}>{st.pickup_stop_name || '—'}</td>
                          <td style={{ padding: '8px 6px', color: '#64748b' }}>{st.drop_stop_name || '—'}</td>
                          <td style={{ padding: '8px 6px', color: '#64748b' }}>
                            {st.father_mobile ? `📞 ${st.father_mobile}` : '—'}
                          </td>
                          <td style={{ padding: '8px 6px' }}>
                            <span style={{
                              padding: '2px 8px', borderRadius: 12, fontSize: 10.5, fontWeight: 800,
                              background: st.fee_status === 'PAID' ? '#dcfce7' : st.fee_status === 'PARTIAL' ? '#fef3c7' : st.fee_status === 'PENDING' ? '#fee2e2' : '#f1f5f9',
                              color: st.fee_status === 'PAID' ? '#15803d' : st.fee_status === 'PARTIAL' ? '#b45309' : st.fee_status === 'PENDING' ? '#b91c1c' : '#64748b',
                            }}>
                              {st.fee_status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowStudentsModal(false)} style={{
                background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8,
                padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer'
              }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add/Edit Modal ── */}
      {showForm && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal" style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <h3>{editingId ? 'Edit Vehicle' : 'Add Vehicle'}</h3>
              <button className="modal-close" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <form onSubmit={handleSave} className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Vehicle Number *</label>
                  <input className="form-input" value={form.vehicle_number}
                    onChange={e => setForm(f => ({ ...f, vehicle_number: e.target.value }))} required />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Vehicle Name</label>
                  <input className="form-input" value={form.vehicle_name}
                    onChange={e => setForm(f => ({ ...f, vehicle_name: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Type</label>
                  <select className="form-input" value={form.vehicle_type}
                    onChange={e => setForm(f => ({ ...f, vehicle_type: e.target.value }))}>
                    {VEHICLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Capacity</label>
                  <input type="number" min="0" className="form-input" value={form.capacity}
                    onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Assign Driver</label>
                  <select className="form-input" value={form.driver_id}
                    onChange={e => setForm(f => ({ ...f, driver_id: e.target.value }))}>
                    <option value="">-- None --</option>
                    {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Assign Conductor</label>
                  <select className="form-input" value={form.conductor_id}
                    onChange={e => setForm(f => ({ ...f, conductor_id: e.target.value }))}>
                    <option value="">-- None --</option>
                    {conductors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Purchase Date</label>
                  <input type="date" className="form-input" value={form.purchase_date}
                    onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Insurance Expiry</label>
                  <input type="date" className="form-input" value={form.insurance_expiry}
                    onChange={e => setForm(f => ({ ...f, insurance_expiry: e.target.value }))} />
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Notes</label>
                <textarea className="form-input" rows={2} value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
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
