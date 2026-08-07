import React, { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api     from '../../api/axios';
import toast   from 'react-hot-toast';

export default function RouteBuilder() {
  const [darkMode, setDarkMode] = useState(localStorage.getItem('ederp_theme') === 'dark');

  const [routes, setRoutes] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [allStops, setAllStops] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedRouteId, setSelectedRouteId] = useState(null); // null = new route
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [stops, setStops] = useState([]); // [{stop_id, stop_name, estimated_time}]
  const [addStopId, setAddStopId] = useState('');
  const [saving, setSaving] = useState(false);

  const dragIndex = useRef(null);

  const loadRoutes = useCallback(() => {
    setLoading(true);
    api.get('/transport/routes?include_stops=true')
      .then(r => setRoutes(r.data.data || []))
      .catch(() => toast.error('Routes load nahi hue'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadRoutes(); }, [loadRoutes]);

  useEffect(() => {
    api.get('/transport/vehicles?per_page=200').then(r => setVehicles(r.data.data || [])).catch(() => {});
    api.get('/transport/stops').then(r => setAllStops(r.data.data || [])).catch(() => {});
  }, []);

  function selectRoute(route) {
    setSelectedRouteId(route.id);
    setName(route.name);
    setCode(route.code || '');
    setVehicleId(route.vehicle_id || '');
    setStops((route.stops || []).map(s => ({
      stop_id: s.stop_id, stop_name: s.stop_name, estimated_time: s.estimated_time || '',
    })));
  }

  function newRoute() {
    setSelectedRouteId(null);
    setName('');
    setCode('');
    setVehicleId('');
    setStops([]);
  }

  function addStop() {
    if (!addStopId) return;
    const stop = allStops.find(s => String(s.id) === String(addStopId));
    if (!stop) return;
    if (stops.some(s => s.stop_id === stop.id)) {
      toast.error('Ye stop already route me hai');
      return;
    }
    setStops(s => [...s, { stop_id: stop.id, stop_name: stop.name, estimated_time: '' }]);
    setAddStopId('');
  }

  function removeStop(idx) {
    setStops(s => s.filter((_, i) => i !== idx));
  }

  function updateEta(idx, value) {
    setStops(s => s.map((st, i) => i === idx ? { ...st, estimated_time: value } : st));
  }

  function handleDragStart(idx) {
    dragIndex.current = idx;
  }

  function handleDragOver(e, idx) {
    e.preventDefault();
    if (dragIndex.current === null || dragIndex.current === idx) return;
    setStops(s => {
      const updated = [...s];
      const [moved] = updated.splice(dragIndex.current, 1);
      updated.splice(idx, 0, moved);
      dragIndex.current = idx;
      return updated;
    });
  }

  function handleDragEnd() {
    dragIndex.current = null;
  }

  async function handleSave() {
    if (!name.trim()) { toast.error('Route name required hai'); return; }
    if (stops.length === 0) { toast.error('Kam se kam ek stop add karo'); return; }

    setSaving(true);
    const stopsPayload = stops.map(s => ({ stop_id: s.stop_id, estimated_time: s.estimated_time }));

    try {
      if (selectedRouteId) {
        await api.put(`/transport/routes/${selectedRouteId}`, {
          name, code, vehicle_id: vehicleId || null,
        });
        await api.put(`/transport/routes/${selectedRouteId}/stops`, { stops: stopsPayload });
        toast.success('Route updated');
      } else {
        const r = await api.post('/transport/routes', {
          name, code, vehicle_id: vehicleId || null, stops: stopsPayload,
        });
        toast.success('Route created');
        setSelectedRouteId(r.data.data.id);
      }
      loadRoutes();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save nahi hua');
    }
    setSaving(false);
  }

  async function handleDeleteRoute(route) {
    if (!window.confirm(`"${route.name}" route delete karni hai?`)) return;
    try {
      await api.delete(`/transport/routes/${route.id}`);
      toast.success('Route deleted');
      if (selectedRouteId === route.id) newRoute();
      loadRoutes();
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
        <Navbar title="Route Builder" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />

        <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16 }}>
          {/* ── Route list ── */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h4 style={{ margin: 0, fontSize: 14, color: darkMode ? '#f1f5f9' : '#0f172a' }}>Routes</h4>
              <button onClick={newRoute} style={{
                background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 6,
                padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
              }}>+ New</button>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: 20, color: '#94a3b8', fontSize: 13 }}>Loading...</div>
            ) : routes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 20, color: '#94a3b8', fontSize: 13 }}>Koi route nahi hai</div>
            ) : routes.map(r => (
              <div key={r.id} onClick={() => selectRoute(r)} style={{
                padding: '10px 12px', borderRadius: 8, marginBottom: 6, cursor: 'pointer',
                background: selectedRouteId === r.id ? (darkMode ? '#334155' : '#eef2ff') : 'transparent',
                border: `1px solid ${selectedRouteId === r.id ? '#4f46e5' : 'transparent'}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: darkMode ? '#f1f5f9' : '#0f172a' }}>{r.name}</span>
                  <button onClick={e => { e.stopPropagation(); handleDeleteRoute(r); }} style={{
                    background: 'none', border: 'none', color: '#dc2626', fontSize: 12, cursor: 'pointer',
                  }}>✕</button>
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                  {r.vehicle_number || 'No vehicle'} · {r.students_count} students · {(r.stops || []).length} stops
                </div>
              </div>
            ))}
          </div>

          {/* ── Builder panel ── */}
          <div style={cardStyle}>
            <h4 style={{ margin: '0 0 14px', fontSize: 14, color: darkMode ? '#f1f5f9' : '#0f172a' }}>
              {selectedRouteId ? 'Edit Route' : 'New Route'}
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Route Name *</label>
                <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Code</label>
                <input style={inputStyle} value={code} onChange={e => setCode(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Vehicle</label>
                <select style={inputStyle} value={vehicleId} onChange={e => setVehicleId(e.target.value)}>
                  <option value="">-- None --</option>
                  {vehicles.map(v => <option key={v.id} value={v.id}>{v.vehicle_number}</option>)}
                </select>
              </div>
            </div>

            {/* Add stop */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              <select style={{ ...inputStyle, flex: 1 }} value={addStopId} onChange={e => setAddStopId(e.target.value)}>
                <option value="">-- Select stop to add --</option>
                {allStops.filter(s => !stops.some(st => st.stop_id === s.id)).map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <button onClick={addStop} style={{
                background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8,
                padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
              }}>+ Add Stop</button>
            </div>

            {/* Drag-drop stop sequence */}
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              padding: '16px 0', marginBottom: 20,
            }}>
              <RouteNode label="🏫 School" darkMode={darkMode} />
              <Connector darkMode={darkMode} />

              {stops.length === 0 ? (
                <div style={{ fontSize: 12, color: '#94a3b8', padding: '12px 0' }}>Koi stop add nahi hua abhi</div>
              ) : stops.map((s, idx) => (
                <React.Fragment key={s.stop_id}>
                  <div
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={e => handleDragOver(e, idx)}
                    onDragEnd={handleDragEnd}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, width: '100%', maxWidth: 460,
                      background: darkMode ? '#0f172a' : '#f8fafc',
                      border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
                      borderRadius: 8, padding: '8px 12px', cursor: 'grab',
                    }}
                  >
                    <span style={{ color: '#94a3b8', fontSize: 14 }}>⠿</span>
                    <span style={{
                      width: 22, height: 22, borderRadius: '50%', background: '#4f46e5', color: '#fff',
                      fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>{idx + 1}</span>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: darkMode ? '#f1f5f9' : '#0f172a' }}>
                      {s.stop_name}
                    </span>
                    <input
                      placeholder="e.g. 07:45 AM"
                      value={s.estimated_time}
                      onChange={e => updateEta(idx, e.target.value)}
                      style={{ width: 110, padding: '5px 8px', fontSize: 11, border: '1px solid #e2e8f0', borderRadius: 6 }}
                    />
                    <button onClick={() => removeStop(idx)} style={{
                      background: 'none', border: 'none', color: '#dc2626', fontSize: 13, cursor: 'pointer',
                    }}>✕</button>
                  </div>
                  <Connector darkMode={darkMode} />
                </React.Fragment>
              ))}

              <RouteNode label="🏫 School" darkMode={darkMode} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={handleSave} disabled={saving} style={{
                background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8,
                padding: '10px 24px', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.7 : 1,
              }}>{saving ? 'Saving...' : selectedRouteId ? 'Update Route' : 'Create Route'}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RouteNode({ label, darkMode }) {
  return (
    <div style={{
      padding: '8px 20px', borderRadius: 20, fontSize: 12, fontWeight: 700,
      background: darkMode ? '#334155' : '#eef2ff', color: darkMode ? '#f1f5f9' : '#4f46e5',
    }}>{label}</div>
  );
}

function Connector({ darkMode }) {
  return <div style={{ width: 2, height: 18, background: darkMode ? '#334155' : '#e2e8f0' }} />;
}
