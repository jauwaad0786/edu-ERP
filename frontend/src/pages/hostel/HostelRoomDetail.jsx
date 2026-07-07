// NEW FILE — src/pages/hostel/HostelRoomDetail.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api     from '../../api/axios';
import toast   from 'react-hot-toast';

export default function HostelRoomDetail() {
  const { roomId } = useParams();
  const navigate   = useNavigate();
  const [darkMode, setDarkMode] = useState(localStorage.getItem('ederp_theme') === 'dark');
  const [room, setRoom]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(`/hostel/rooms/${roomId}/detail`)
      .then(r => setRoom(r.data))
      .catch(() => toast.error('Room detail load nahi hua'))
      .finally(() => setLoading(false));
  }, [roomId]);

  const BED_COLORS = {
    VACANT:      { bg: '#f0fdf4', border: '#bbf7d0', text: '#16a34a' },
    OCCUPIED:    { bg: '#fef2f2', border: '#fecaca', text: '#dc2626' },
    RESERVED:    { bg: '#fefce8', border: '#fef08a', text: '#ca8a04' },
    MAINTENANCE: { bg: '#f1f5f9', border: '#cbd5e1', text: '#64748b' },
  };

  const cardStyle = {
    background: darkMode ? '#1e293b' : '#fff',
    border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
    borderRadius: 12, padding: 20,
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: darkMode ? '#0f172a' : '#f8fafc' }}>
      <Sidebar darkMode={darkMode} />
      <div style={{ marginLeft: 232, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Navbar title="Room Detail" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />

        <div style={{ padding: 24, maxWidth: 800 }}>
          <button onClick={() => navigate(-1)} style={{
            background: 'none', border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
            borderRadius: 8, padding: '6px 14px', cursor: 'pointer',
            fontSize: 13, color: darkMode ? '#e2e8f0' : '#334155', fontWeight: 600, marginBottom: 16,
          }}>← Back</button>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>Loading...</div>
          ) : !room ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>Room nahi mila</div>
          ) : (
            <>
              {/* Header card */}
              <div style={{ ...cardStyle, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: darkMode ? '#f1f5f9' : '#0f172a' }}>
                      Room {room.room_number}
                    </h2>
                    <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>
                      {room.hostel_name} → {room.building_name} → {room.floor_name}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 20,
                      background: room.is_ac ? '#eef2ff' : '#f1f5f9',
                      color: room.is_ac ? '#4f46e5' : '#64748b',
                    }}>{room.is_ac ? '❄️ AC' : 'Non-AC'}</span>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 20,
                      background: '#f1f5f9', color: '#64748b',
                    }}>{room.room_type.replace('_', ' ')}</span>
                  </div>
                </div>

                {/* Capacity / Occupied / Available + progress bar */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginTop: 20 }}>
                  {[
                    { label: 'Capacity', value: room.capacity, color: '#4f46e5' },
                    { label: 'Occupied', value: room.occupied, color: '#dc2626' },
                    { label: 'Available', value: room.available, color: '#16a34a' },
                  ].map(s => (
                    <div key={s.label} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{s.value}</div>
                      <div style={{ fontSize: 12, color: '#94a3b8' }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 16 }}>
                  <div style={{ height: 10, borderRadius: 6, background: darkMode ? '#334155' : '#f1f5f9', overflow: 'hidden' }}>
                    <div style={{
                      width: `${room.capacity ? (room.occupied / room.capacity * 100) : 0}%`,
                      height: '100%', background: 'linear-gradient(90deg, #4f46e5, #7c3aed)',
                      borderRadius: 6, transition: 'width 0.3s',
                    }} />
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                    {room.capacity ? Math.round(room.occupied / room.capacity * 100) : 0}% occupied
                  </div>
                </div>
              </div>

              {/* Bed list */}
              <div style={cardStyle}>
                <h4 style={{ margin: '0 0 14px', fontSize: 14, color: darkMode ? '#f1f5f9' : '#0f172a' }}>All Beds</h4>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, textAlign: 'left' }}>
                      <th style={{ padding: '8px 6px', color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>BED</th>
                      <th style={{ padding: '8px 6px', color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>STUDENT</th>
                      <th style={{ padding: '8px 6px', color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {room.beds.map(bed => {
                      const c = BED_COLORS[bed.status] || BED_COLORS.MAINTENANCE;
                      return (
                        <tr key={bed.id} style={{ borderBottom: `1px solid ${darkMode ? '#334155' : '#f1f5f9'}` }}>
                          <td style={{ padding: '10px 6px', fontWeight: 700 }}>Bed-{bed.bed_number}</td>
                          <td style={{ padding: '10px 6px' }}>
                            {bed.student_name ? (
                              <span
                                onClick={() => navigate(`/students/${bed.student_id}`)}
                                style={{ color: '#4f46e5', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
                              >
                                {bed.student_name}
                              </span>
                            ) : (
                              <span style={{ color: '#94a3b8' }}>Vacant</span>
                            )}
                          </td>
                          <td style={{ padding: '10px 6px' }}>
                            <span style={{
                              fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                              background: c.bg, color: c.text, border: `1px solid ${c.border}`,
                            }}>{bed.status}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
