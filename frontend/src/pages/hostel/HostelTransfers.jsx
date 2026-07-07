import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api     from '../../api/axios';
import toast   from 'react-hot-toast';

export default function HostelTransfers() {
  const [darkMode, setDarkMode] = useState(localStorage.getItem('ederp_theme') === 'dark');

  const [hostels, setHostels] = useState([]);
  const [hostelFilter, setHostelFilter] = useState('');
  const [search, setSearch]   = useState('');
  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(true);

  // ── Transfer modal state ──
  const [transferTarget, setTransferTarget] = useState(null); // allocation object
  const [transferType, setTransferType] = useState('BED');
  const [reason, setReason] = useState('');

  const [tHostelId, setTHostelId] = useState('');
  const [tBuildings, setTBuildings] = useState([]);
  const [tBuildingId, setTBuildingId] = useState('');
  const [tFloors, setTFloors] = useState([]);
  const [tFloorId, setTFloorId] = useState('');
  const [tRooms, setTRooms] = useState([]);
  const [tRoomId, setTRoomId] = useState('');
  const [tBeds, setTBeds] = useState([]);
  const [tBedId, setTBedId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // ── Vacate modal ──
  const [vacateTarget, setVacateTarget] = useState(null);
  const [vacateReason, setVacateReason] = useState('');

  const loadAllocations = useCallback(() => {
    setLoading(true);
    // We don't have a dedicated "list all active allocations" endpoint yet —
    // reuse search-eligible's inverse via room-map per hostel, OR simplest:
    // fetch from a lightweight endpoint. Using students search isn't ideal here,
    // so we hit a filtered list through hostel dashboards' hostel_breakdown +
    // per-hostel room-map to assemble active allocations client-side.
    const hostelIds = hostelFilter ? [hostelFilter] : hostels.map(h => h.id);
    if (hostelIds.length === 0) { setAllocations([]); setLoading(false); return; }

    Promise.all(hostelIds.map(id => api.get(`/hostel/hostels/${id}/room-map`).then(r => ({ hostelId: id, data: r.data }))))
      .then(results => {
        const rows = [];
        results.forEach(({ hostelId, data }) => {
          const hostel = hostels.find(h => h.id === Number(hostelId));
          data.forEach(building => {
            building.floors.forEach(floor => {
              floor.rooms.forEach(room => {
                room.beds.forEach(bed => {
                  if (bed.status === 'OCCUPIED' && bed.student_name) {
                    rows.push({
                      bed_id: bed.id,
                      student_id: bed.student_id,
                      allocation_id: bed.allocation_id,
                      student_name: bed.student_name,
                      hostel_name: hostel?.name || '',
                      building_name: building.name,
                      floor_name: floor.name,
                      room_number: room.room_number,
                      bed_number: bed.bed_number,
                    });
                  }
                });
              });
            });
          });
        });
        setAllocations(rows);
      })
      .catch(() => toast.error('Allocations load nahi hue'))
      .finally(() => setLoading(false));
  }, [hostelFilter, hostels]);

  useEffect(() => {
    api.get('/hostel/hostels').then(r => setHostels(r.data || [])).catch(() => {});
  }, []);

  useEffect(() => { if (hostels.length) loadAllocations(); }, [hostels, loadAllocations]);

  const filteredAllocations = allocations.filter(a =>
    !search || a.student_name.toLowerCase().includes(search.toLowerCase())
  );

  // ── Need allocation_id + student_id for transfer/vacate — fetch via bed's student profile ──
  // Since room-map doesn't expose allocation_id/student_id directly, we fetch full
  // detail on-demand when user clicks Transfer/Vacate.
  function openTransfer(row) {
    if (!row.allocation_id) {
      toast.error('Allocation ID nahi mila — page refresh karke dobara try karo');
      return;
    }
    setTransferTarget(row);
    setTHostelId(''); setTBuildingId(''); setTFloorId(''); setTRoomId(''); setTBedId('');
    setTransferType('BED');
    setReason('');
  }
  
  function openVacate(row) {
    setVacateTarget(row);
    setVacateReason('');
  }

  // Hierarchy cascades for transfer target bed
  useEffect(() => {
    setTBuildingId(''); setTBuildings([]); setTFloors([]); setTRooms([]); setTBeds([]);
    if (!tHostelId) return;
    api.get(`/hostel/hostels/${tHostelId}/buildings`).then(r => setTBuildings(r.data || []));
  }, [tHostelId]);

  useEffect(() => {
    setTFloorId(''); setTFloors([]); setTRooms([]); setTBeds([]);
    if (!tBuildingId) return;
    api.get(`/hostel/buildings/${tBuildingId}/floors`).then(r => setTFloors(r.data || []));
  }, [tBuildingId]);

  useEffect(() => {
    setTRoomId(''); setTRooms([]); setTBeds([]);
    if (!tFloorId) return;
    api.get(`/hostel/floors/${tFloorId}/rooms`).then(r => setTRooms(r.data || []));
  }, [tFloorId]);

  useEffect(() => {
    setTBedId(''); setTBeds([]);
    if (!tRoomId) return;
    api.get(`/hostel/rooms/${tRoomId}/beds`).then(r => setTBeds((r.data || []).filter(b => b.status === 'VACANT')));
  }, [tRoomId]);

  async function confirmTransfer() {
    if (!transferTarget?.allocation_id) {
      toast.error('Allocation ID missing — pehle student profile se transfer karo');
      return;
    }
    if (!tBedId) { toast.error('Naya bed select karo'); return; }
    setSubmitting(true);
    try {
      await api.post(`/hostel/admission/${transferTarget.allocation_id}/transfer`, {
        new_bed_id: tBedId, transfer_type: transferType, reason,
      });
      toast.success('Transfer successful');
      setTransferTarget(null);
      loadAllocations();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Transfer fail hua');
    }
    setSubmitting(false);
  }

  async function confirmVacate() {
    if (!vacateTarget?.allocation_id) {
      toast.error('Allocation ID missing');
      return;
    }
    try {
      await api.post(`/hostel/admission/${vacateTarget.allocation_id}/vacate`, { reason: vacateReason });
      toast.success('Bed vacated');
      setVacateTarget(null);
      loadAllocations();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Vacate fail hua');
    }
  }

  const cardStyle = {
    background: darkMode ? '#1e293b' : '#fff',
    border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
    borderRadius: 12, padding: 18,
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
        <Navbar title="Transfer / Vacate" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />

        <div style={{ padding: 24 }}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search student name..." style={{ ...inputStyle, width: 260, marginBottom: 0 }} />
            <select value={hostelFilter} onChange={e => setHostelFilter(e.target.value)}
              style={{ ...inputStyle, width: 200, marginBottom: 0 }}>
              <option value="">All Hostels</option>
              {hostels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          </div>

          <div style={cardStyle}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Loading...</div>
            ) : filteredAllocations.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Koi active allocation nahi mila</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, textAlign: 'left' }}>
                    <th style={{ padding: '8px 6px', color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>STUDENT</th>
                    <th style={{ padding: '8px 6px', color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>HOSTEL</th>
                    <th style={{ padding: '8px 6px', color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>LOCATION</th>
                    <th style={{ padding: '8px 6px', color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAllocations.map((a, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${darkMode ? '#334155' : '#f1f5f9'}` }}>
                      <td style={{ padding: '10px 6px', fontWeight: 600, color: darkMode ? '#f1f5f9' : '#0f172a' }}>
                        {a.student_name}
                      </td>
                      <td style={{ padding: '10px 6px', color: '#64748b' }}>{a.hostel_name}</td>
                      <td style={{ padding: '10px 6px', color: '#64748b' }}>
                        {a.building_name} / {a.floor_name} / Room {a.room_number} / Bed {a.bed_number}
                      </td>
                      <td style={{ padding: '10px 6px' }}>
                        <button onClick={() => openTransfer(a)} style={{
                          background: '#eef2ff', color: '#4f46e5', border: 'none', borderRadius: 6,
                          padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', marginRight: 6,
                        }}>Transfer</button>
                        <button onClick={() => openVacate(a)} style={{
                          background: '#fef2f2', color: '#dc2626', border: 'none', borderRadius: 6,
                          padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                        }}>Vacate</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* ── Transfer Modal ── */}
      {transferTarget && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setTransferTarget(null)}>
          <div className="modal" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h3>Transfer — {transferTarget.student_name}</h3>
              <button className="modal-close" onClick={() => setTransferTarget(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{
                background: darkMode ? '#273349' : '#f8fafc', borderRadius: 8, padding: 10, marginBottom: 14, fontSize: 12, color: '#64748b',
              }}>
                Current: {transferTarget.hostel_name} / {transferTarget.building_name} / {transferTarget.floor_name} / Room {transferTarget.room_number} / Bed {transferTarget.bed_number}
              </div>

              <label style={labelStyle}>Transfer Type</label>
              <select style={inputStyle} value={transferType} onChange={e => setTransferType(e.target.value)}>
                <option value="BED">Bed Transfer</option>
                <option value="ROOM">Room Transfer</option>
                <option value="FLOOR">Floor Transfer</option>
                <option value="BUILDING">Building Transfer</option>
                <option value="HOSTEL">Hostel Transfer</option>
              </select>

              <label style={labelStyle}>New Hostel</label>
              <select style={inputStyle} value={tHostelId} onChange={e => setTHostelId(e.target.value)}>
                <option value="">Select Hostel</option>
                {hostels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>

              <label style={labelStyle}>Building</label>
              <select style={inputStyle} value={tBuildingId} onChange={e => setTBuildingId(e.target.value)} disabled={!tHostelId}>
                <option value="">Select Building</option>
                {tBuildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>

              <label style={labelStyle}>Floor</label>
              <select style={inputStyle} value={tFloorId} onChange={e => setTFloorId(e.target.value)} disabled={!tBuildingId}>
                <option value="">Select Floor</option>
                {tFloors.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>

              <label style={labelStyle}>Room</label>
              <select style={inputStyle} value={tRoomId} onChange={e => setTRoomId(e.target.value)} disabled={!tFloorId}>
                <option value="">Select Room</option>
                {tRooms.map(r => <option key={r.id} value={r.id}>{r.room_number} ({r.available_beds} vacant)</option>)}
              </select>

              <label style={labelStyle}>Bed</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                {tBeds.map(b => (
                  <div key={b.id} onClick={() => setTBedId(b.id)} style={{
                    width: 40, height: 40, borderRadius: 8, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700,
                    background: tBedId === b.id ? '#4f46e5' : '#f0fdf4',
                    color: tBedId === b.id ? '#fff' : '#16a34a',
                    border: `2px solid ${tBedId === b.id ? '#4f46e5' : '#bbf7d0'}`,
                  }}>{b.bed_number}</div>
                ))}
              </div>

              <label style={labelStyle}>Reason</label>
              <input style={inputStyle} value={reason} onChange={e => setReason(e.target.value)} placeholder="Optional" />

              <button onClick={confirmTransfer} disabled={submitting || !tBedId} style={{
                width: '100%', background: (!tBedId) ? '#cbd5e1' : '#4f46e5', color: '#fff',
                border: 'none', borderRadius: 8, padding: '10px 0', fontSize: 13, fontWeight: 700,
                cursor: !tBedId ? 'not-allowed' : 'pointer',
              }}>
                {submitting ? 'Transferring...' : '✅ Confirm Transfer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Vacate Modal ── */}
      {vacateTarget && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setVacateTarget(null)}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h3>Vacate — {vacateTarget.student_name}</h3>
              <button className="modal-close" onClick={() => setVacateTarget(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 14 }}>
                {vacateTarget.hostel_name} / Room {vacateTarget.room_number} / Bed {vacateTarget.bed_number}
              </div>
              <label style={labelStyle}>Reason</label>
              <textarea style={{ ...inputStyle, minHeight: 70 }} value={vacateReason}
                onChange={e => setVacateReason(e.target.value)} placeholder="e.g. Course completed, left hostel..." />
              <button onClick={confirmVacate} style={{
                width: '100%', background: '#dc2626', color: '#fff', border: 'none',
                borderRadius: 8, padding: '10px 0', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}>Confirm Vacate</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
