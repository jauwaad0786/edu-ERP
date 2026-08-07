import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api     from '../../api/axios';
import toast   from 'react-hot-toast';

const FEE_STATUS_COLORS = {
  PENDING: { bg: '#fef3c7', color: '#d97706' },
  PARTIAL: { bg: '#fef3c7', color: '#d97706' },
  PAID:    { bg: '#f0fdf4', color: '#16a34a' },
  OVERDUE: { bg: '#fef2f2', color: '#dc2626' },
  WAIVED:  { bg: '#f1f5f9', color: '#64748b' },
};

export default function StudentTransport() {
  const [darkMode, setDarkMode] = useState(localStorage.getItem('ederp_theme') === 'dark');

  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [stops, setStops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  // filters
  const [search, setSearch] = useState('');
  const [classId, setClassId] = useState('');
  const [transportStatus, setTransportStatus] = useState('ALL');
  const [vehicleFilter, setVehicleFilter] = useState('');
  const [routeFilter, setRouteFilter] = useState('');
  const [stopFilter, setStopFilter] = useState('');
  const [feeStatusFilter, setFeeStatusFilter] = useState('');

  // selection + bulk assign
  const [selected, setSelected] = useState(new Set());
  const [assignVehicle, setAssignVehicle] = useState('');
  const [assignRoute, setAssignRoute] = useState('');
  const [assignStop, setAssignStop] = useState('');
  const [assigning, setAssigning] = useState(false);

  // transfer modal
  const [transferStudent, setTransferStudent] = useState(null);
  const [transferForm, setTransferForm] = useState({ vehicle_id: '', route_id: '', stop_id: '', remarks: '' });
  const [transferring, setTransferring] = useState(false);

  // history drawer
  const [historyStudent, setHistoryStudent] = useState(null);
  const [historyRows, setHistoryRows] = useState([]);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page });
    if (search) params.set('search', search);
    if (classId) params.set('class_id', classId);
    if (transportStatus !== 'ALL') params.set('transport_status', transportStatus);
    if (vehicleFilter) params.set('vehicle_id', vehicleFilter);
    if (routeFilter) params.set('route_id', routeFilter);
    if (stopFilter) params.set('stop_id', stopFilter);
    if (feeStatusFilter) params.set('fee_status', feeStatusFilter);

    api.get('/transport/students?' + params.toString())
      .then(r => { setStudents(r.data.data || []); setTotal(r.data.total || 0); })
      .catch(() => toast.error('Students load nahi hue'))
      .finally(() => setLoading(false));
  }, [page, search, classId, transportStatus, vehicleFilter, routeFilter, stopFilter, feeStatusFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api.get('/principal/classes').then(r => setClasses(r.data || [])).catch(() => {});
    api.get('/transport/vehicles?per_page=200').then(r => setVehicles(r.data.data || [])).catch(() => {});
    api.get('/transport/routes?include_stops=false').then(r => setRoutes(r.data.data || [])).catch(() => {});
    api.get('/transport/stops').then(r => setStops(r.data.data || [])).catch(() => {});
  }, []);

  function toggleSelect(studentId) {
    setSelected(s => {
      const next = new Set(s);
      next.has(studentId) ? next.delete(studentId) : next.add(studentId);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === students.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(students.map(s => s.student_id)));
    }
  }

  async function handleBulkAssign() {
    if (selected.size === 0) { toast.error('Kam se kam ek student select karo'); return; }
    if (!assignVehicle && !assignRoute && !assignStop) {
      toast.error('Vehicle, route ya stop me se kam se kam ek select karo');
      return;
    }

    setAssigning(true);
    try {
      const r = await api.post('/transport/students/assign', {
        student_ids: Array.from(selected),
        vehicle_id: assignVehicle || null,
        route_id: assignRoute || null,
        stop_id: assignStop || null,
      });
      toast.success(r.data.message || 'Assigned successfully');
      setSelected(new Set());
      setAssignVehicle(''); setAssignRoute(''); setAssignStop('');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Assign nahi hua');
    }
    setAssigning(false);
  }

  function openTransfer(student) {
    setTransferStudent(student);
    setTransferForm({
      vehicle_id: student.vehicle_id || '', route_id: student.route_id || '',
      stop_id: student.stop_id || '', remarks: '',
    });
  }

  async function handleTransferSave(e) {
    e.preventDefault();
    setTransferring(true);
    try {
      await api.post(`/transport/students/${transferStudent.student_id}/transfer`, {
        vehicle_id: transferForm.vehicle_id || null,
        route_id: transferForm.route_id || null,
        stop_id: transferForm.stop_id || null,
        remarks: transferForm.remarks,
      });
      toast.success('Transport transferred');
      setTransferStudent(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Transfer nahi hua');
    }
    setTransferring(false);
  }

  async function handleRemove(student) {
    if (!window.confirm(`${student.name} ko transport se remove karna hai?`)) return;
    const remarks = window.prompt('Removal ka reason (optional):', '') || '';
    try {
      await api.post(`/transport/students/${student.student_id}/remove`, { remarks });
      toast.success('Removed from transport');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Remove nahi hua');
    }
  }

  async function openHistory(student) {
    setHistoryStudent(student);
    try {
      const r = await api.get(`/transport/students/${student.student_id}/history`);
      setHistoryRows(r.data.data || []);
    } catch {
      toast.error('History load nahi hui');
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

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: darkMode ? '#0f172a' : '#f8fafc' }}>
      <Sidebar darkMode={darkMode} />
      <div style={{ marginLeft: 232, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Navbar title="Student Transport" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />

        <div style={{ padding: 24 }}>
          {/* Filters */}
          <div style={{ ...cardStyle, marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <input value={search} onChange={e => { setPage(1); setSearch(e.target.value); }}
                placeholder="Search name/admission no..." style={{ ...inputStyle, width: 200 }} />
              <select value={classId} onChange={e => { setPage(1); setClassId(e.target.value); }} style={inputStyle}>
                <option value="">All Classes</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section || ''}</option>)}
              </select>
              <select value={transportStatus} onChange={e => { setPage(1); setTransportStatus(e.target.value); }} style={inputStyle}>
                <option value="ALL">All Students</option>
                <option value="WITH">With Transport</option>
                <option value="WITHOUT">Without Transport</option>
              </select>
              <select value={vehicleFilter} onChange={e => { setPage(1); setVehicleFilter(e.target.value); }} style={inputStyle}>
                <option value="">All Vehicles</option>
                {vehicles.map(v => <option key={v.id} value={v.id}>{v.vehicle_number}</option>)}
              </select>
              <select value={routeFilter} onChange={e => { setPage(1); setRouteFilter(e.target.value); }} style={inputStyle}>
                <option value="">All Routes</option>
                {routes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <select value={stopFilter} onChange={e => { setPage(1); setStopFilter(e.target.value); }} style={inputStyle}>
                <option value="">All Stops</option>
                {stops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <select value={feeStatusFilter} onChange={e => { setPage(1); setFeeStatusFilter(e.target.value); }} style={inputStyle}>
                <option value="">All Fee Status</option>
                {Object.keys(FEE_STATUS_COLORS).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Bulk assign bar — shown only when something selected */}
          {selected.size > 0 && (
            <div style={{
              ...cardStyle, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
              background: darkMode ? '#1e3a5f' : '#eef2ff', border: '1px solid #4f46e5',
            }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#4f46e5' }}>{selected.size} selected</span>
              <select value={assignVehicle} onChange={e => setAssignVehicle(e.target.value)} style={inputStyle}>
                <option value="">Vehicle...</option>
                {vehicles.map(v => <option key={v.id} value={v.id}>{v.vehicle_number}</option>)}
              </select>
              <select value={assignRoute} onChange={e => setAssignRoute(e.target.value)} style={inputStyle}>
                <option value="">Route...</option>
                {routes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <select value={assignStop} onChange={e => setAssignStop(e.target.value)} style={inputStyle}>
                <option value="">Stop...</option>
                {stops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <button onClick={handleBulkAssign} disabled={assigning} style={{
                background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8,
                padding: '8px 20px', fontSize: 12, fontWeight: 700, cursor: assigning ? 'not-allowed' : 'pointer',
              }}>{assigning ? 'Assigning...' : 'Assign'}</button>
              <button onClick={() => setSelected(new Set())} style={{
                background: 'none', border: 'none', color: '#64748b', fontSize: 12, cursor: 'pointer',
              }}>Clear selection</button>
            </div>
          )}

          {/* Table */}
          <div style={cardStyle}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Loading...</div>
            ) : students.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Koi student nahi mila</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, textAlign: 'left' }}>
                    <th style={{ padding: '8px 6px' }}>
                      <input type="checkbox" checked={selected.size === students.length && students.length > 0}
                        onChange={toggleSelectAll} />
                    </th>
                    <th style={{ padding: '8px 6px', color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>STUDENT</th>
                    <th style={{ padding: '8px 6px', color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>CLASS</th>
                    <th style={{ padding: '8px 6px', color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>FATHER</th>
                    <th style={{ padding: '8px 6px', color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>VEHICLE</th>
                    <th style={{ padding: '8px 6px', color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>STOP</th>
                    <th style={{ padding: '8px 6px', color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>FEE</th>
                    <th style={{ padding: '8px 6px', color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map(s => (
                    <tr key={s.student_id} style={{ borderBottom: `1px solid ${darkMode ? '#334155' : '#f1f5f9'}` }}>
                      <td style={{ padding: '10px 6px' }}>
                        <input type="checkbox" checked={selected.has(s.student_id)} onChange={() => toggleSelect(s.student_id)} />
                      </td>
                      <td style={{ padding: '10px 6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {s.photo_url ? (
                            <img src={s.photo_url} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{
                              width: 28, height: 28, borderRadius: '50%', background: '#eef2ff', color: '#4f46e5',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700,
                            }}>{s.name?.[0] || '?'}</div>
                          )}
                          <div>
                            <div style={{ fontWeight: 600, color: darkMode ? '#f1f5f9' : '#0f172a' }}>{s.name}</div>
                            <div style={{ fontSize: 11, color: '#94a3b8' }}>{s.admission_no}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '10px 6px', color: '#64748b' }}>{s.class_name}</td>
                      <td style={{ padding: '10px 6px', color: '#64748b' }}>
                        {s.father_name}
                        {s.father_mobile && <div style={{ fontSize: 11, color: '#94a3b8' }}>{s.father_mobile}</div>}
                      </td>
                      <td style={{ padding: '10px 6px', color: '#64748b' }}>{s.vehicle_number || '—'}</td>
                      <td style={{ padding: '10px 6px', color: '#64748b' }}>{s.stop_name || '—'}</td>
                      <td style={{ padding: '10px 6px' }}>
                        {s.fee_status ? (
                          <span style={{
                            fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                            background: FEE_STATUS_COLORS[s.fee_status]?.bg, color: FEE_STATUS_COLORS[s.fee_status]?.color,
                          }}>{s.fee_status}</span>
                        ) : <span style={{ fontSize: 11, color: '#94a3b8' }}>—</span>}
                      </td>
                      <td style={{ padding: '10px 6px', whiteSpace: 'nowrap' }}>
                        <button onClick={() => openTransfer(s)} style={{
                          background: '#eef2ff', color: '#4f46e5', border: 'none', borderRadius: 6,
                          padding: '5px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer', marginRight: 4,
                        }}>{s.has_transport ? 'Transfer' : 'Assign'}</button>
                        <button onClick={() => openHistory(s)} style={{
                          background: '#f1f5f9', color: '#334155', border: 'none', borderRadius: 6,
                          padding: '5px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer', marginRight: 4,
                        }}>History</button>
                        {s.has_transport && (
                          <button onClick={() => handleRemove(s)} style={{
                            background: '#fef2f2', color: '#dc2626', border: 'none', borderRadius: 6,
                            padding: '5px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                          }}>Remove</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>{total} students total</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{
                  padding: '6px 14px', fontSize: 12, borderRadius: 6, border: '1px solid #e2e8f0',
                  background: darkMode ? '#0f172a' : '#fff', color: darkMode ? '#e2e8f0' : '#334155',
                  cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.5 : 1,
                }}>Prev</button>
                <button disabled={students.length < 25} onClick={() => setPage(p => p + 1)} style={{
                  padding: '6px 14px', fontSize: 12, borderRadius: 6, border: '1px solid #e2e8f0',
                  background: darkMode ? '#0f172a' : '#fff', color: darkMode ? '#e2e8f0' : '#334155',
                  cursor: students.length < 25 ? 'not-allowed' : 'pointer', opacity: students.length < 25 ? 0.5 : 1,
                }}>Next</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Transfer/Assign modal ── */}
      {transferStudent && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setTransferStudent(null)}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3>{transferStudent.has_transport ? 'Transfer' : 'Assign'} — {transferStudent.name}</h3>
              <button className="modal-close" onClick={() => setTransferStudent(null)}>✕</button>
            </div>
            <form onSubmit={handleTransferSave} className="modal-body">
              <div>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Vehicle</label>
                <select className="form-input" value={transferForm.vehicle_id}
                  onChange={e => setTransferForm(f => ({ ...f, vehicle_id: e.target.value }))}>
                  <option value="">-- None --</option>
                  {vehicles.map(v => <option key={v.id} value={v.id}>{v.vehicle_number}</option>)}
                </select>
              </div>
              <div style={{ marginTop: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Route</label>
                <select className="form-input" value={transferForm.route_id}
                  onChange={e => setTransferForm(f => ({ ...f, route_id: e.target.value }))}>
                  <option value="">-- None --</option>
                  {routes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div style={{ marginTop: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Stop</label>
                <select className="form-input" value={transferForm.stop_id}
                  onChange={e => setTransferForm(f => ({ ...f, stop_id: e.target.value }))}>
                  <option value="">-- None --</option>
                  {stops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div style={{ marginTop: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Remarks / Reason</label>
                <textarea className="form-input" rows={2} value={transferForm.remarks}
                  onChange={e => setTransferForm(f => ({ ...f, remarks: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                <button type="button" onClick={() => setTransferStudent(null)} style={{
                  background: '#f1f5f9', color: '#334155', border: 'none', borderRadius: 8,
                  padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}>Cancel</button>
                <button type="submit" disabled={transferring} style={{
                  background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8,
                  padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: transferring ? 'not-allowed' : 'pointer',
                  opacity: transferring ? 0.7 : 1,
                }}>{transferring ? 'Saving...' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── History drawer ── */}
      {historyStudent && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setHistoryStudent(null)}>
          <div className="modal" style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <h3>{historyStudent.name} — Transfer History</h3>
              <button className="modal-close" onClick={() => setHistoryStudent(null)}>✕</button>
            </div>
            <div className="modal-body">
              {historyRows.length === 0 ? (
                <p style={{ fontSize: 12, color: '#94a3b8' }}>Koi history nahi hai</p>
              ) : historyRows.map(h => (
                <div key={h.id} style={{ fontSize: 12, padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 700 }}>
                      {h.transfer_type === 'ADDED' ? '➕ Added' :
                       h.transfer_type === 'REMOVED' ? '➖ Removed' :
                       h.transfer_type === 'VEHICLE_CHANGE' ? '🚌 Vehicle Changed' :
                       h.transfer_type === 'ROUTE_CHANGE' ? '🗺️ Route Changed' : '📍 Stop Changed'}
                    </span>
                    <span style={{ color: '#94a3b8' }}>{h.transfer_date?.slice(0, 10)}</span>
                  </div>
                  <div style={{ color: '#64748b', marginTop: 2 }}>
                    {h.from_vehicle_number && `${h.from_vehicle_number} → `}{h.to_vehicle_number}
                    {h.from_route_name && ` · ${h.from_route_name} → `}{h.to_route_name && !h.from_route_name && h.to_route_name}
                    {h.from_stop_name && ` · ${h.from_stop_name} → `}{h.to_stop_name && !h.from_stop_name && h.to_stop_name}
                  </div>
                  {h.remarks && <div style={{ color: '#94a3b8', fontStyle: 'italic', marginTop: 2 }}>{h.remarks}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
