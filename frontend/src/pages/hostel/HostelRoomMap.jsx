import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api     from '../../api/axios';
import toast   from 'react-hot-toast';

export default function HostelRoomMap() {
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(localStorage.getItem('ederp_theme') === 'dark');

  const [hostels, setHostels]         = useState([]);
  const [selectedHostel, setSelectedHostel] = useState(null);
  const [mapData, setMapData]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [expandedBuildings, setExpandedBuildings] = useState({});
  const [expandedFloors, setExpandedFloors] = useState({});

  const [selectedBed, setSelectedBed] = useState(null); // for detail popup

  useEffect(() => {
    api.get('/hostel/hostels')
      .then(r => {
        setHostels(r.data || []);
        if (r.data?.length) setSelectedHostel(r.data[0].id);
      })
      .catch(() => toast.error('Hostels load nahi ho paye'));
  }, []);

  const loadMap = useCallback(() => {
    if (!selectedHostel) return;
    setLoading(true);
    api.get(`/hostel/hostels/${selectedHostel}/room-map`)
      .then(r => {
        setMapData(r.data || []);
        // auto-expand first building/floor
        if (r.data?.length) {
          setExpandedBuildings({ [r.data[0].id]: true });
          if (r.data[0].floors?.length) {
            setExpandedFloors({ [r.data[0].floors[0].id]: true });
          }
        }
      })
      .catch(() => toast.error('Room map load nahi hua'))
      .finally(() => setLoading(false));
  }, [selectedHostel]);

  useEffect(() => { loadMap(); }, [loadMap]);

  const STATUS_COLORS = {
    VACANT:      { bg: '#f0fdf4', border: '#16a34a', text: '#16a34a', dot: '#22c55e' },
    OCCUPIED:    { bg: '#fef2f2', border: '#dc2626', text: '#dc2626', dot: '#ef4444' },
    RESERVED:    { bg: '#fefce8', border: '#d97706', text: '#d97706', dot: '#eab308' },
    MAINTENANCE: { bg: '#f1f5f9', border: '#64748b', text: '#64748b', dot: '#94a3b8' },
    BLOCKED:     { bg: '#f1f5f9', border: '#334155', text: '#334155', dot: '#475569' },
  };

  const cardStyle = {
    background: darkMode ? '#1e293b' : '#fff',
    border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
    borderRadius: 12, padding: 16,
  };

  function toggleBuilding(id) {
    setExpandedBuildings(prev => ({ ...prev, [id]: !prev[id] }));
  }
  function toggleFloor(id) {
    setExpandedFloors(prev => ({ ...prev, [id]: !prev[id] }));
  }

  // Flat counts for legend
  const legendCounts = { VACANT: 0, OCCUPIED: 0, RESERVED: 0, MAINTENANCE: 0, BLOCKED: 0 };
  mapData.forEach(b => b.floors.forEach(f => f.rooms.forEach(r => r.beds.forEach(bed => {
    legendCounts[bed.status] = (legendCounts[bed.status] || 0) + 1;
  }))));

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: darkMode ? '#0f172a' : '#f8fafc' }}>
      <Sidebar darkMode={darkMode} />
      <div style={{ marginLeft: 232, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Navbar title="Hostel Room Map" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />

        <div style={{ padding: 24 }}>
          {/* Hostel selector + legend */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
            <select
              value={selectedHostel || ''}
              onChange={e => setSelectedHostel(Number(e.target.value))}
              style={{
                padding: '9px 14px', fontSize: 13, fontWeight: 600, borderRadius: 8,
                border: '1px solid #e2e8f0', minWidth: 220,
                background: darkMode ? '#1e293b' : '#fff', color: darkMode ? '#f1f5f9' : '#0f172a',
              }}
            >
              {hostels.map(h => (
                <option key={h.id} value={h.id}>{h.name} ({h.occupied_beds}/{h.total_beds})</option>
              ))}
            </select>

            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              {Object.entries(STATUS_COLORS).map(([status, c]) => (
                <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: c.dot, display: 'inline-block' }} />
                  <span style={{ color: darkMode ? '#94a3b8' : '#64748b' }}>
                    {status.charAt(0) + status.slice(1).toLowerCase()} ({legendCounts[status] || 0})
                  </span>
                </div>
              ))}
            </div>

            <button onClick={() => navigate('/hostel/admission')} style={{
              background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8,
              padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>
              + New Admission
            </button>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>Loading room map...</div>
          ) : mapData.length === 0 ? (
            <div style={{ ...cardStyle, textAlign: 'center', padding: 60, color: '#94a3b8' }}>
              Is hostel mein koi building/room nahi bani abhi
            </div>
          ) : (
            mapData.map(building => (
              <div key={building.id} style={{ ...cardStyle, marginBottom: 14 }}>
                {/* Building header */}
                <div
                  onClick={() => toggleBuilding(building.id)}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    cursor: 'pointer', paddingBottom: expandedBuildings[building.id] ? 12 : 0,
                    borderBottom: expandedBuildings[building.id] ? `1px solid ${darkMode ? '#334155' : '#f1f5f9'}` : 'none',
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: darkMode ? '#f1f5f9' : '#0f172a' }}>
                    🏢 {building.name}
                  </h3>
                  <span style={{ fontSize: 16, color: '#94a3b8' }}>
                    {expandedBuildings[building.id] ? '▾' : '▸'}
                  </span>
                </div>

                {expandedBuildings[building.id] && building.floors.map(floor => (
                  <div key={floor.id} style={{ marginTop: 12, marginLeft: 8 }}>
                    <div
                      onClick={() => toggleFloor(floor.id)}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        cursor: 'pointer', padding: '6px 10px', borderRadius: 6,
                        background: darkMode ? '#273349' : '#f8fafc',
                      }}
                    >
                      <span style={{ fontSize: 13, fontWeight: 600, color: darkMode ? '#cbd5e1' : '#475569' }}>
                        📐 {floor.name} <span style={{ color: '#94a3b8', fontWeight: 400 }}>({floor.rooms.length} rooms)</span>
                      </span>
                      <span style={{ fontSize: 13, color: '#94a3b8' }}>
                        {expandedFloors[floor.id] ? '▾' : '▸'}
                      </span>
                    </div>

                    {expandedFloors[floor.id] && (
                      <div style={{
                        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                        gap: 12, marginTop: 12, paddingLeft: 8,
                      }}>
                        {floor.rooms.map(room => (
                          <div key={room.id} style={{
                            border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
                            borderRadius: 10, padding: 10,
                            background: darkMode ? '#0f172a' : '#fafbfc',
                          }}>
                            <div style={{
                              fontSize: 12, fontWeight: 700, marginBottom: 8,
                              color: darkMode ? '#e2e8f0' : '#1e293b',
                              display: 'flex', justifyContent: 'space-between',
                            }}>
                              <span>Room {room.room_number}</span>
                              <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500 }}>{room.room_type}</span>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                              {room.beds.map(bed => {
                                const c = STATUS_COLORS[bed.status] || STATUS_COLORS.VACANT;
                                return (
                                  <div
                                    key={bed.id}
                                    onClick={() => setSelectedBed({ ...bed, room_number: room.room_number, floor_name: floor.name, building_name: building.name })}
                                    title={bed.student_name || bed.status}
                                    style={{
                                      width: 38, height: 38, borderRadius: 8,
                                      background: c.bg, border: `1.5px solid ${c.border}`,
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      fontSize: 12, fontWeight: 700, color: c.text,
                                      cursor: 'pointer', transition: 'transform 0.1s',
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
                                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                                  >
                                    {bed.bed_number}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Bed detail popup */}
      {selectedBed && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setSelectedBed(null)}>
          <div className="modal" style={{ maxWidth: 380 }}>
            <div className="modal-header">
              <h3>Bed {selectedBed.bed_number} — Room {selectedBed.room_number}</h3>
              <button className="modal-close" onClick={() => setSelectedBed(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 10 }}>
                {selectedBed.building_name} → {selectedBed.floor_name}
              </div>
              <div style={{
                display: 'inline-block', fontSize: 12, fontWeight: 700, padding: '4px 12px',
                borderRadius: 20,
                background: STATUS_COLORS[selectedBed.status]?.bg,
                color: STATUS_COLORS[selectedBed.status]?.text,
                marginBottom: 12,
              }}>
                {selectedBed.status}
              </div>
              {selectedBed.student_name ? (
                <div style={{ fontSize: 14, fontWeight: 600 }}>
                  👤 {selectedBed.student_name}
                </div>
              ) : (
                <div style={{ fontSize: 13, color: '#94a3b8' }}>Koi student allocated nahi hai</div>
              )}
              {selectedBed.status === 'VACANT' && (
                <button
                  onClick={() => { setSelectedBed(null); navigate('/hostel/admission', { state: { preselectBedId: selectedBed.id } }); }}
                  style={{
                    marginTop: 14, width: '100%', background: '#4f46e5', color: '#fff',
                    border: 'none', borderRadius: 8, padding: '9px 0', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  Allocate This Bed
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
