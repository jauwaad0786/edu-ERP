import React, { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api     from '../../api/axios';
import toast   from 'react-hot-toast';
import L       from 'leaflet';
import 'leaflet/dist/leaflet.css';

const EMPTY_FORM = { name: '', latitude: '', longitude: '', radius: '200', description: '' };

// India-wide default view (used when no coordinates are set yet)
const INDIA_CENTER = [22.9734, 78.6569];
const INDIA_ZOOM   = 5;

const markerIcon = L.icon({
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});

export default function Stops() {
  const [darkMode, setDarkMode] = useState(localStorage.getItem('ederp_theme') === 'dark');

  const [stops, setStops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // ── Location search (OpenStreetMap Nominatim — free, no API key) ──
  const [locSuggestions, setLocSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchingLoc, setSearchingLoc] = useState(false);
  const debounceRef = useRef(null);

  // ── Map (Leaflet) ──
  const mapDivRef      = useRef(null);   // the <div> the map mounts into
  const mapInstanceRef = useRef(null);   // Leaflet Map instance
  const markerRef      = useRef(null);   // Leaflet Marker instance

  function placeOrMoveMarker(lat, lon) {
    if (!mapInstanceRef.current) return;
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lon]);
    } else {
      markerRef.current = L.marker([lat, lon], { icon: markerIcon, draggable: true })
        .addTo(mapInstanceRef.current);
      markerRef.current.on('dragend', () => {
        const pos = markerRef.current.getLatLng();
        setForm(f => ({ ...f, latitude: pos.lat.toFixed(6), longitude: pos.lng.toFixed(6) }));
      });
    }
  }

  // Initialise the map once, when the Add/Edit modal opens
  useEffect(() => {
    if (!showForm || !mapDivRef.current) return;

    const hasCoords = form.latitude !== '' && form.longitude !== '';
    const startLat  = hasCoords ? Number(form.latitude)  : INDIA_CENTER[0];
    const startLon  = hasCoords ? Number(form.longitude) : INDIA_CENTER[1];
    const startZoom = hasCoords ? 16 : INDIA_ZOOM;

    const map = L.map(mapDivRef.current).setView([startLat, startLon], startZoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;

    if (hasCoords) placeOrMoveMarker(startLat, startLon);

    // Click anywhere on the map -> drop/move pin, fill lat/lng, try to name the stop
    map.on('click', (e) => {
      const { lat, lng } = e.latlng;
      placeOrMoveMarker(lat, lng);
      setForm(f => ({ ...f, latitude: lat.toFixed(6), longitude: lng.toFixed(6) }));

      fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16`)
        .then(r => r.json())
        .then(data => {
          if (data && data.display_name) {
            const shortName = data.display_name.split(',').slice(0, 2).join(',').trim();
            setForm(f => (f.name ? f : { ...f, name: shortName }));
          }
        })
        .catch(() => {});
    });

    // Fix Leaflet's map-in-a-modal sizing glitch (container has 0 size on first paint)
    setTimeout(() => map.invalidateSize(), 150);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    };
  }, [showForm]);   // eslint-disable-line react-hooks/exhaustive-deps

  function handleNameChange(value) {
    setForm(f => ({ ...f, name: value }));
    setShowSuggestions(true);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 3) { setLocSuggestions([]); return; }

    debounceRef.current = setTimeout(async () => {
      setSearchingLoc(true);
      try {
        // addressdetails + a generous limit surfaces villages/localities/wards
        // inside whatever town, pincode or district the user typed, not just
        // the top-level place — that's what makes small places findable.
        const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=8&countrycodes=in&q=${encodeURIComponent(value)}`;
        const res = await fetch(url);
        const data = await res.json();
        setLocSuggestions(data || []);
      } catch {
        setLocSuggestions([]);
      }
      setSearchingLoc(false);
    }, 500);
  }

  function pickSuggestion(place) {
    const lat = Number(place.lat), lon = Number(place.lon);
    setForm(f => ({
      ...f,
      name: place.display_name.split(',').slice(0, 2).join(',').trim(),
      latitude: lat.toFixed(6),
      longitude: lon.toFixed(6),
    }));
    setLocSuggestions([]);
    setShowSuggestions(false);

    if (mapInstanceRef.current) {
      // zoom in close enough that nearby villages/chowks become visible &
      // clickable on the map, matching a town/pincode-level search
      mapInstanceRef.current.setView([lat, lon], 15);
      placeOrMoveMarker(lat, lon);
    }
  }

  function updateLatLng(field, value) {
    setForm(f => {
      const next = { ...f, [field]: value };
      const lat = Number(next.latitude), lon = Number(next.longitude);
      if (next.latitude !== '' && next.longitude !== '' && !isNaN(lat) && !isNaN(lon) && mapInstanceRef.current) {
        placeOrMoveMarker(lat, lon);
        mapInstanceRef.current.setView([lat, lon], mapInstanceRef.current.getZoom());
      }
      return next;
    });
  }

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
    setLocSuggestions([]);
    setShowSuggestions(false);
    setShowForm(true);
  }

  function openEdit(s) {
    setEditingId(s.id);
    setForm({
      name: s.name || '', latitude: s.latitude ?? '', longitude: s.longitude ?? '',
      radius: s.radius ?? '200', description: s.description || '',
    });
    setLocSuggestions([]);
    setShowSuggestions(false);
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
          <div className="modal" style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <h3>{editingId ? 'Edit Stop' : 'Add Stop'}</h3>
              <button className="modal-close" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <form onSubmit={handleSave} className="modal-body">
              <div style={{ position: 'relative' }}>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Stop Name / Location *</label>
                <input className="form-input" value={form.name} autoComplete="off"
                  onChange={e => handleNameChange(e.target.value)}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  placeholder="Town, pincode ya village likho..." required
                  style={{ padding: '12px 14px', fontSize: 14, minHeight: 44 }} />
                {searchingLoc && (
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Searching...</div>
                )}
                {showSuggestions && locSuggestions.length > 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20,
                    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
                    marginTop: 4, maxHeight: 220, overflowY: 'auto',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  }}>
                    {locSuggestions.map((place, i) => (
                      <div key={i}
                        onMouseDown={() => pickSuggestion(place)}
                        style={{
                          padding: '8px 12px', fontSize: 12, cursor: 'pointer',
                          borderBottom: i < locSuggestions.length - 1 ? '1px solid #f1f5f9' : 'none',
                          color: '#334155',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                        onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                      >
                        📍 {place.display_name}
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                  Town/pincode/village likho aur list se pick karo, ya neeche map pe seedha click karo
                </div>
              </div>

              {/* ── Interactive map — click anywhere to drop the pin ── */}
              <div style={{ marginTop: 12 }}>
                <div ref={mapDivRef} style={{
                  width: '100%', height: 260, borderRadius: 8,
                  border: '1px solid #e2e8f0', overflow: 'hidden',
                }} />
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                  Map zoom/pan karke exact chowk/gali pe click karo — pin us jagah drag bhi ho sakta hai
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Latitude</label>
                  <input type="number" step="any" className="form-input" value={form.latitude}
                    onChange={e => updateLatLng('latitude', e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Longitude</label>
                  <input type="number" step="any" className="form-input" value={form.longitude}
                    onChange={e => updateLatLng('longitude', e.target.value)} />
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
