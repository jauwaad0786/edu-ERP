import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api     from '../../api/axios';
import toast   from 'react-hot-toast';

const ROOM_TYPES = ['SINGLE', 'DOUBLE', 'TRIPLE', 'FOUR_SHARING', 'SIX_SHARING', 'CUSTOM'];

export default function HostelSetup() {
  const [darkMode, setDarkMode] = useState(localStorage.getItem('ederp_theme') === 'dark');

  const [hostels, setHostels] = useState([]);
  const [wardens, setWardens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedHostel, setExpandedHostel] = useState(null);

  // Nested data cache: buildings[hostelId], floors[buildingId], wings[floorId], rooms[floorId]
  const [buildings, setBuildings] = useState({});
  const [floors, setFloors]       = useState({});
  const [wings, setWings]         = useState({});
  const [rooms, setRooms]         = useState({});
  const [expandedBuilding, setExpandedBuilding] = useState(null);
  const [expandedFloor, setExpandedFloor]       = useState(null);

  // Modals
  const [hostelModal, setHostelModal] = useState(null);   // null | {} (new) | {...hostel} (edit)
  const [buildingModal, setBuildingModal] = useState(null); // { hostelId, data }
  const [floorModal, setFloorModal] = useState(null);       // { buildingId, data }
  const [wingModal, setWingModal] = useState(null);         // { floorId, data }
  const [roomModal, setRoomModal] = useState(null);         // { floorId, data }

  const loadHostels = useCallback(() => {
    setLoading(true);
    api.get('/hostel/hostels').then(r => setHostels(r.data || []))
      .catch(() => toast.error('Hostels load nahi hue'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadHostels();
    api.get('/hostel/wardens').then(r => setWardens(r.data || [])).catch(() => {});
  }, [loadHostels]);

  function toggleHostel(id) {
    setExpandedHostel(prev => prev === id ? null : id);
    if (!buildings[id]) {
      api.get(`/hostel/hostels/${id}/buildings`).then(r => setBuildings(prev => ({ ...prev, [id]: r.data || [] })));
    }
  }

  function toggleBuilding(id) {
    setExpandedBuilding(prev => prev === id ? null : id);
    if (!floors[id]) {
      api.get(`/hostel/buildings/${id}/floors`).then(r => setFloors(prev => ({ ...prev, [id]: r.data || [] })));
    }
  }

  function toggleFloor(id) {
    setExpandedFloor(prev => prev === id ? null : id);
    if (!wings[id]) {
      api.get(`/hostel/floors/${id}/wings`).then(r => setWings(prev => ({ ...prev, [id]: r.data || [] })));
    }
    if (!rooms[id]) {
      api.get(`/hostel/floors/${id}/rooms`).then(r => setRooms(prev => ({ ...prev, [id]: r.data || [] })));
    }
  }

  // ── Hostel save ──
  async function saveHostel(form) {
    try {
      if (form.id) {
        await api.patch(`/hostel/hostels/${form.id}`, form);
        toast.success('Hostel updated');
      } else {
        await api.post('/hostel/hostels', form);
        toast.success('Hostel created');
      }
      setHostelModal(null);
      loadHostels();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save fail hua');
    }
  }

  async function deleteHostel(id) {
    if (!window.confirm('Ye hostel delete karna hai?')) return;
    try {
      await api.delete(`/hostel/hostels/${id}`);
      toast.success('Hostel deleted');
      loadHostels();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Delete fail hua');
    }
  }

  // ── Building save ──
  async function saveBuilding(hostelId, form) {
    try {
      await api.post(`/hostel/hostels/${hostelId}/buildings`, form);
      toast.success('Building created');
      setBuildingModal(null);
      api.get(`/hostel/hostels/${hostelId}/buildings`).then(r => setBuildings(prev => ({ ...prev, [hostelId]: r.data || [] })));
      loadHostels();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save fail hua');
    }
  }

  async function deleteBuilding(hostelId, id) {
    if (!window.confirm('Ye building delete karni hai?')) return;
    try {
      await api.delete(`/hostel/buildings/${id}`);
      toast.success('Building deleted');
      api.get(`/hostel/hostels/${hostelId}/buildings`).then(r => setBuildings(prev => ({ ...prev, [hostelId]: r.data || [] })));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Delete fail hua');
    }
  }

  // ── Floor save ──
  async function saveFloor(buildingId, form) {
    try {
      await api.post(`/hostel/buildings/${buildingId}/floors`, form);
      toast.success('Floor created');
      setFloorModal(null);
      api.get(`/hostel/buildings/${buildingId}/floors`).then(r => setFloors(prev => ({ ...prev, [buildingId]: r.data || [] })));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save fail hua');
    }
  }

  async function deleteFloor(buildingId, id) {
    if (!window.confirm('Ye floor delete karni hai?')) return;
    try {
      await api.delete(`/hostel/floors/${id}`);
      toast.success('Floor deleted');
      api.get(`/hostel/buildings/${buildingId}/floors`).then(r => setFloors(prev => ({ ...prev, [buildingId]: r.data || [] })));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Delete fail hua');
    }
  }

  // ── Wing save ──
  async function saveWing(floorId, form) {
    try {
      await api.post(`/hostel/floors/${floorId}/wings`, form);
      toast.success('Wing created');
      setWingModal(null);
      api.get(`/hostel/floors/${floorId}/wings`).then(r => setWings(prev => ({ ...prev, [floorId]: r.data || [] })));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save fail hua');
    }
  }

  async function deleteWing(floorId, id) {
    if (!window.confirm('Ye wing delete karni hai?')) return;
    try {
      await api.delete(`/hostel/wings/${id}`);
      toast.success('Wing deleted');
      api.get(`/hostel/floors/${floorId}/wings`).then(r => setWings(prev => ({ ...prev, [floorId]: r.data || [] })));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Delete fail hua');
    }
  }

  // ── Room save (auto-generates beds on backend) ──
  async function saveRoom(floorId, form) {
    try {
      await api.post(`/hostel/floors/${floorId}/rooms`, form);
      toast.success('Room + beds created');
      setRoomModal(null);
      api.get(`/hostel/floors/${floorId}/rooms`).then(r => setRooms(prev => ({ ...prev, [floorId]: r.data || [] })));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save fail hua');
    }
  }

  async function deleteRoom(floorId, id) {
    if (!window.confirm('Ye room delete karna hai? (Sabhi beds bhi delete ho jayengi)')) return;
    try {
      await api.delete(`/hostel/rooms/${id}`);
      toast.success('Room deleted');
      api.get(`/hostel/floors/${floorId}/rooms`).then(r => setRooms(prev => ({ ...prev, [floorId]: r.data || [] })));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Delete fail hua');
    }
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
  const rowBtn = {
    background: '#eef2ff', color: '#4f46e5', border: 'none', borderRadius: 6,
    padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', marginLeft: 6,
  };
  const delBtn = { ...rowBtn, background: '#fef2f2', color: '#dc2626' };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: darkMode ? '#0f172a' : '#f8fafc' }}>
      <Sidebar darkMode={darkMode} />
      <div style={{ marginLeft: 232, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Navbar title="Hostel Setup" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />

        <div style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button onClick={() => setHostelModal({})} style={{
              background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8,
              padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>+ New Hostel</button>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>Loading...</div>
          ) : hostels.length === 0 ? (
            <div style={{ ...cardStyle, textAlign: 'center', padding: 50, color: '#94a3b8' }}>
              Koi hostel nahi bana abhi — "+ New Hostel" se shuru karo
            </div>
          ) : hostels.map(h => (
            <div key={h.id} style={{ ...cardStyle, marginBottom: 12 }}>
              {/* Hostel row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div onClick={() => toggleHostel(h.id)} style={{ cursor: 'pointer', flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 16, color: '#94a3b8' }}>{expandedHostel === h.id ? '▾' : '▸'}</span>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: darkMode ? '#f1f5f9' : '#0f172a' }}>
                      🏨 {h.name} <span style={{ fontSize: 11, fontWeight: 500, color: '#94a3b8' }}>({h.hostel_type} · {h.gender})</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                      {h.building_count} buildings · {h.occupied_beds}/{h.total_beds} beds occupied
                      {h.warden_name ? ` · Warden: ${h.warden_name}` : ''}
                    </div>
                  </div>
                </div>
                <div>
                  <button onClick={() => setHostelModal(h)} style={rowBtn}>Edit</button>
                  <button onClick={() => deleteHostel(h.id)} style={delBtn}>Delete</button>
                </div>
              </div>

              {/* Buildings */}
              {expandedHostel === h.id && (
                <div style={{ marginTop: 14, paddingLeft: 20, borderLeft: `2px solid ${darkMode ? '#334155' : '#f1f5f9'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                    <button onClick={() => setBuildingModal({ hostelId: h.id, data: {} })} style={rowBtn}>+ Building</button>
                  </div>
                  {(buildings[h.id] || []).map(b => (
                    <div key={b.id} style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div onClick={() => toggleBuilding(b.id)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 13, color: '#94a3b8' }}>{expandedBuilding === b.id ? '▾' : '▸'}</span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: darkMode ? '#e2e8f0' : '#1e293b' }}>
                            🏢 {b.name} <span style={{ fontSize: 10, fontWeight: 400, color: '#94a3b8' }}>({b.floor_count} floors, {b.occupied_beds}/{b.total_beds} beds)</span>
                          </span>
                        </div>
                        <button onClick={() => deleteBuilding(h.id, b.id)} style={delBtn}>Delete</button>
                      </div>

                      {/* Floors */}
                      {expandedBuilding === b.id && (
                        <div style={{ marginTop: 8, paddingLeft: 20, borderLeft: `2px solid ${darkMode ? '#334155' : '#f1f5f9'}` }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                            <button onClick={() => setFloorModal({ buildingId: b.id, data: {} })} style={rowBtn}>+ Floor</button>
                          </div>
                          {(floors[b.id] || []).map(f => (
                            <div key={f.id} style={{ marginBottom: 10 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div onClick={() => toggleFloor(f.id)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span style={{ fontSize: 12, color: '#94a3b8' }}>{expandedFloor === f.id ? '▾' : '▸'}</span>
                                  <span style={{ fontSize: 12, fontWeight: 600, color: darkMode ? '#cbd5e1' : '#475569' }}>
                                    📐 {f.name} <span style={{ fontSize: 10, fontWeight: 400, color: '#94a3b8' }}>({f.wing_count} wings, {f.room_count} rooms)</span>
                                  </span>
                                </div>
                                <button onClick={() => deleteFloor(b.id, f.id)} style={delBtn}>Delete</button>
                              </div>

                              {/* Wings + Rooms */}
                              {expandedFloor === f.id && (
                                <div style={{ marginTop: 8, paddingLeft: 20 }}>
                                  <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                                    <button onClick={() => setWingModal({ floorId: f.id, data: {} })} style={rowBtn}>+ Wing</button>
                                    <button onClick={() => setRoomModal({ floorId: f.id, data: {} })} style={rowBtn}>+ Room</button>
                                  </div>

                                  {(wings[f.id] || []).length > 0 && (
                                    <div style={{ marginBottom: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                      {(wings[f.id] || []).map(w => (
                                        <span key={w.id} style={{
                                          fontSize: 11, padding: '4px 10px', borderRadius: 20,
                                          background: darkMode ? '#273349' : '#f1f5f9', color: darkMode ? '#cbd5e1' : '#475569',
                                          display: 'flex', alignItems: 'center', gap: 6,
                                        }}>
                                          {w.name} ({w.room_count})
                                          <span onClick={() => deleteWing(f.id, w.id)} style={{ cursor: 'pointer', color: '#dc2626', fontWeight: 700 }}>✕</span>
                                        </span>
                                      ))}
                                    </div>
                                  )}

                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                                    {(rooms[f.id] || []).map(r => (
                                      <div key={r.id} style={{
                                        border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, borderRadius: 8, padding: 10,
                                        background: darkMode ? '#0f172a' : '#fafbfc',
                                      }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                                          <div>
                                            <div style={{ fontSize: 12, fontWeight: 700, color: darkMode ? '#e2e8f0' : '#1e293b' }}>
                                              Room {r.room_number}
                                            </div>
                                            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
                                              {r.room_type} · {r.occupied}/{r.capacity} beds
                                            </div>
                                            <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                                              {r.is_ac && <Tag>AC</Tag>}
                                              {r.has_attached_bath && <Tag>Bath</Tag>}
                                              {r.has_wifi && <Tag>WiFi</Tag>}
                                            </div>
                                          </div>
                                          <span onClick={() => deleteRoom(f.id, r.id)} style={{ cursor: 'pointer', color: '#dc2626', fontSize: 12 }}>✕</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Hostel Modal ── */}
      {hostelModal && (
        <FormModal title={hostelModal.id ? 'Edit Hostel' : 'New Hostel'} onClose={() => setHostelModal(null)}>
          <HostelForm data={hostelModal} wardens={wardens} onSave={saveHostel} inputStyle={inputStyle} labelStyle={labelStyle} />
        </FormModal>
      )}

      {/* ── Building Modal ── */}
      {buildingModal && (
        <FormModal title="New Building" onClose={() => setBuildingModal(null)}>
          <SimpleForm
            fields={[{ key: 'name', label: 'Building Name *' }, { key: 'code', label: 'Code' }, { key: 'description', label: 'Description' }]}
            onSave={(form) => saveBuilding(buildingModal.hostelId, form)}
            inputStyle={inputStyle} labelStyle={labelStyle}
          />
        </FormModal>
      )}

      {/* ── Floor Modal ── */}
      {floorModal && (
        <FormModal title="New Floor" onClose={() => setFloorModal(null)}>
          <SimpleForm
            fields={[
              { key: 'name', label: 'Floor Name * (e.g. Ground Floor)' },
              { key: 'floor_number', label: 'Floor Number (for sorting)', type: 'number' },
            ]}
            onSave={(form) => saveFloor(floorModal.buildingId, form)}
            inputStyle={inputStyle} labelStyle={labelStyle}
          />
        </FormModal>
      )}

      {/* ── Wing Modal ── */}
      {wingModal && (
        <FormModal title="New Wing" onClose={() => setWingModal(null)}>
          <SimpleForm
            fields={[{ key: 'name', label: 'Wing Name * (e.g. East Wing)' }]}
            onSave={(form) => saveWing(wingModal.floorId, form)}
            inputStyle={inputStyle} labelStyle={labelStyle}
          />
        </FormModal>
      )}

      {/* ── Room Modal ── */}
      {roomModal && (
        <FormModal title="New Room" onClose={() => setRoomModal(null)}>
          <RoomForm onSave={(form) => saveRoom(roomModal.floorId, form)} inputStyle={inputStyle} labelStyle={labelStyle} />
        </FormModal>
      )}
    </div>
  );
}

// ── Small reusable components ──

function Tag({ children }) {
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
      background: '#eef2ff', color: '#4f46e5',
    }}>{children}</span>
  );
}

function FormModal({ title, onClose, children }) {
  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

function HostelForm({ data, wardens, onSave, inputStyle, labelStyle }) {
  const [form, setForm] = useState({
    id: data.id, name: data.name || '', code: data.code || '',
    hostel_type: data.hostel_type || 'BOYS', gender: data.gender || 'MALE',
    description: data.description || '', address: data.address || '',
    warden_id: data.warden_id || '', contact_number: data.contact_number || '',
    contact_email: data.contact_email || '',
  });
  return (
    <div>
      <label style={labelStyle}>Hostel Name *</label>
      <input style={inputStyle} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label style={labelStyle}>Type</label>
          <select style={inputStyle} value={form.hostel_type} onChange={e => setForm({ ...form, hostel_type: e.target.value })}>
            {['BOYS', 'GIRLS', 'JUNIOR', 'SENIOR', 'STAFF', 'INTERNATIONAL'].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Gender</label>
          <select style={inputStyle} value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="CO_ED">Co-Ed</option>
          </select>
        </div>
      </div>
      <label style={labelStyle}>Warden</label>
      <select style={inputStyle} value={form.warden_id} onChange={e => setForm({ ...form, warden_id: e.target.value })}>
        <option value="">-- None --</option>
        {wardens.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
      </select>
      <label style={labelStyle}>Contact Number</label>
      <input style={inputStyle} value={form.contact_number} onChange={e => setForm({ ...form, contact_number: e.target.value })} />
      <label style={labelStyle}>Address</label>
      <input style={inputStyle} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
      <button onClick={() => onSave(form)} style={{
        width: '100%', background: '#4f46e5', color: '#fff', border: 'none',
        borderRadius: 8, padding: '10px 0', fontSize: 13, fontWeight: 700, cursor: 'pointer',
      }}>Save</button>
    </div>
  );
}

function SimpleForm({ fields, onSave, inputStyle, labelStyle }) {
  const [form, setForm] = useState(Object.fromEntries(fields.map(f => [f.key, ''])));
  return (
    <div>
      {fields.map(f => (
        <div key={f.key}>
          <label style={labelStyle}>{f.label}</label>
          <input type={f.type || 'text'} style={inputStyle} value={form[f.key]}
            onChange={e => setForm({ ...form, [f.key]: e.target.value })} />
        </div>
      ))}
      <button onClick={() => onSave(form)} style={{
        width: '100%', background: '#4f46e5', color: '#fff', border: 'none',
        borderRadius: 8, padding: '10px 0', fontSize: 13, fontWeight: 700, cursor: 'pointer',
      }}>Save</button>
    </div>
  );
}

function RoomForm({ onSave, inputStyle, labelStyle }) {
  const [form, setForm] = useState({
    room_number: '', room_name: '', room_type: 'DOUBLE', bed_count: 2,
    is_ac: false, has_attached_bath: false, has_wifi: false,
  });
  return (
    <div>
      <label style={labelStyle}>Room Number *</label>
      <input style={inputStyle} value={form.room_number} onChange={e => setForm({ ...form, room_number: e.target.value })} />
      <label style={labelStyle}>Room Type</label>
      <select style={inputStyle} value={form.room_type} onChange={e => setForm({ ...form, room_type: e.target.value })}>
        {ROOM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
      </select>
      {form.room_type === 'CUSTOM' && (
        <>
          <label style={labelStyle}>Number of Beds</label>
          <input type="number" style={inputStyle} value={form.bed_count}
            onChange={e => setForm({ ...form, bed_count: e.target.value })} />
        </>
      )}
      <div style={{ display: 'flex', gap: 16, marginBottom: 14, fontSize: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={form.is_ac} onChange={e => setForm({ ...form, is_ac: e.target.checked })} /> AC
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={form.has_attached_bath} onChange={e => setForm({ ...form, has_attached_bath: e.target.checked })} /> Attached Bath
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={form.has_wifi} onChange={e => setForm({ ...form, has_wifi: e.target.checked })} /> WiFi
        </label>
      </div>
      <button onClick={() => onSave(form)} style={{
        width: '100%', background: '#16a34a', color: '#fff', border: 'none',
        borderRadius: 8, padding: '10px 0', fontSize: 13, fontWeight: 700, cursor: 'pointer',
      }}>Create Room + Beds</button>
    </div>
  );
}
