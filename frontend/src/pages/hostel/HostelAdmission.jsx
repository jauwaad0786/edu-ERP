// FULL FILE — src/pages/hostel/HostelAdmission.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api     from '../../api/axios';
import toast   from 'react-hot-toast';

export default function HostelAdmission() {
  const location = useLocation();
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(localStorage.getItem('ederp_theme') === 'dark');

  const [tab, setTab] = useState('EXISTING'); // EXISTING | NEW

  // ── Existing student search ──
  const [search, setSearch]     = useState('');
  const [results, setResults]   = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);

  // ── New student form ──
  const [newForm, setNewForm] = useState({
    name: '', email: '', phone: '', gender: '', dob: '',
    class_id: '', roll_number: '', admission_no: '',
    father_name: '', mother_name: '', parent_phone: '', parent_email: '', address: '',
  });
  const [classes, setClasses] = useState([]);
  const [creating, setCreating] = useState(false);

  // ── Visual hierarchy picker ──
  const [hostels, setHostels]         = useState([]);
  const [hostelId, setHostelId]       = useState('');
  const [roomMap, setRoomMap]         = useState([]);
  const [mapLoading, setMapLoading]   = useState(false);
  const [expandedBuilding, setExpandedBuilding] = useState(null);
  const [expandedFloor, setExpandedFloor]       = useState(null);
  const [bedId, setBedId]             = useState('');
  const [selectedBedInfo, setSelectedBedInfo] = useState(null);

  const [submitting, setSubmitting] = useState(false);

  // ── Admitted students table ──
  const [admissions, setAdmissions] = useState([]);
  const [admissionsLoading, setAdmissionsLoading] = useState(true);
  const [tableSearch, setTableSearch] = useState('');

  // ── Load hostels + classes on mount ──
  useEffect(() => {
    api.get('/hostel/hostels').then(r => setHostels(r.data || [])).catch(() => {});
    api.get('/principal/classes').then(r => setClasses(r.data || [])).catch(() => {});
  }, []);

  // ── Preselect bed if navigated from Room Map ──
  useEffect(() => {
    const preselect = location.state?.preselectBedId;
    if (preselect) setBedId(preselect);
  }, [location.state]);

  // ── Search existing students (debounced) ──
  useEffect(() => {
    if (tab !== 'EXISTING') return;
    const t = setTimeout(() => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      const hostel = hostels.find(h => h.id === Number(hostelId));
      if (hostel && hostel.gender !== 'CO_ED') params.set('gender', hostel.gender);
      api.get('/hostel/students/search-eligible?' + params.toString())
        .then(r => setResults(r.data || []))
        .catch(() => setResults([]));
    }, 300);
    return () => clearTimeout(t);
  }, [search, tab, hostelId, hostels]);

  // ── Load full visual room-map for selected hostel ──
  useEffect(() => {
    setRoomMap([]); setExpandedBuilding(null); setExpandedFloor(null);
    setBedId(''); setSelectedBedInfo(null);
    if (!hostelId) return;
    setMapLoading(true);
    api.get(`/hostel/hostels/${hostelId}/room-map`)
      .then(r => setRoomMap(r.data || []))
      .catch(() => toast.error('Room map load nahi hua'))
      .finally(() => setMapLoading(false));
  }, [hostelId]);

  // ── Load admitted students table (debounced search) ──
  const loadAdmissions = useCallback(() => {
    setAdmissionsLoading(true);
    const params = tableSearch ? `?search=${encodeURIComponent(tableSearch)}` : '';
    api.get('/hostel/admissions' + params)
      .then(r => setAdmissions(r.data || []))
      .catch(() => toast.error('Admission list load nahi hui'))
      .finally(() => setAdmissionsLoading(false));
  }, [tableSearch]);

  useEffect(() => {
    const t = setTimeout(() => loadAdmissions(), 300);
    return () => clearTimeout(t);
  }, [loadAdmissions]);

  function pickBed(building, floor, room, bed) {
    if (bed.status !== 'VACANT') return;
    setBedId(bed.id);
    setSelectedBedInfo({
      building: building.name, floor: floor.name,
      room: room.room_number, bed: bed.bed_number,
    });
  }

  async function handleCreateNewStudent() {
    if (!newForm.name.trim() || !newForm.email.trim()) {
      toast.error('Name aur Email zaroori hai');
      return;
    }
    setCreating(true);
    try {
      const { data } = await api.post('/hostel/students/quick-create', newForm);
      toast.success(`${data.name} enrolled — ab bed allocate karo`);
      setSelectedStudent({
        student_id: data.id, name: newForm.name,
        gender: newForm.gender, roll_number: newForm.roll_number,
      });
      setTab('EXISTING');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Student create nahi hua');
    }
    setCreating(false);
  }

  async function handleAdmit() {
    if (!selectedStudent) { toast.error('Pehle student select/create karo'); return; }
    if (!bedId) { toast.error('Bed select karo'); return; }
    setSubmitting(true);
    try {
      await api.post('/hostel/admission', {
        student_id: selectedStudent.student_id,
        bed_id: bedId,
      });
      toast.success(`${selectedStudent.name} hostel mein admit ho gaya`);
      loadAdmissions();
      setSelectedStudent(null);
      setBedId('');
      setSelectedBedInfo(null);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Admission fail hua');
    }
    setSubmitting(false);
  }

  const cardStyle = {
    background: darkMode ? '#1e293b' : '#fff',
    border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
    borderRadius: 12, padding: 20,
  };
  const inputStyle = {
    width: '100%', padding: '9px 12px', fontSize: 13,
    border: '1px solid #e2e8f0', borderRadius: 8, outline: 'none', boxSizing: 'border-box',
    marginBottom: 10,
  };
  const labelStyle = { fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4, display: 'block' };
  const selectStyle = { ...inputStyle };

  const BED_COLORS = {
    VACANT:      { bg: '#f0fdf4', border: '#bbf7d0', text: '#16a34a' },
    OCCUPIED:    { bg: '#fef2f2', border: '#fecaca', text: '#dc2626' },
    RESERVED:    { bg: '#fefce8', border: '#fef08a', text: '#ca8a04' },
    MAINTENANCE: { bg: '#f1f5f9', border: '#cbd5e1', text: '#64748b' },
    BLOCKED:     { bg: '#f1f5f9', border: '#cbd5e1', text: '#64748b' },
  };

  const FEE_BADGE = {
    PAID:          { bg: '#f0fdf4', color: '#16a34a', label: 'Paid' },
    PARTIAL:       { bg: '#fefce8', color: '#ca8a04', label: 'Partial' },
    PENDING:       { bg: '#fef2f2', color: '#dc2626', label: 'Pending' },
    NOT_GENERATED: { bg: '#f1f5f9', color: '#64748b', label: 'Not Generated' },
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: darkMode ? '#0f172a' : '#f8fafc' }}>
      <Sidebar darkMode={darkMode} />
      <div style={{ marginLeft: 232, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Navbar title="Hostel Admission" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />

        <div style={{ padding: 24 }}>
          {/* ── Admission Form ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 20, alignItems: 'start', maxWidth: 1100 }}>

            {/* LEFT: Student selection */}
            <div style={cardStyle}>
              <h4 style={{ margin: '0 0 14px', fontSize: 14, color: darkMode ? '#f1f5f9' : '#0f172a' }}>
                1. Student
              </h4>

              {selectedStudent ? (
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 12,
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#166534' }}>{selectedStudent.name}</div>
                    <div style={{ fontSize: 11, color: '#16a34a' }}>
                      {selectedStudent.roll_number || ''} {selectedStudent.class_name ? `· ${selectedStudent.class_name}` : ''}
                    </div>
                  </div>
                  <button onClick={() => setSelectedStudent(null)} style={{
                    background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                  }}>
                    Change
                  </button>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                    {['EXISTING', 'NEW'].map(t => (
                      <button key={t} onClick={() => setTab(t)} style={{
                        flex: 1, padding: '8px 0', fontSize: 12, fontWeight: 700, borderRadius: 8,
                        border: 'none', cursor: 'pointer',
                        background: tab === t ? '#4f46e5' : (darkMode ? '#273349' : '#f1f5f9'),
                        color: tab === t ? '#fff' : (darkMode ? '#94a3b8' : '#64748b'),
                      }}>
                        {t === 'EXISTING' ? 'Existing Student' : '+ Enroll New'}
                      </button>
                    ))}
                  </div>

                  {tab === 'EXISTING' ? (
                    <>
                      <input value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Search by name, roll no, admission no..." style={inputStyle} />
                      <div style={{ maxHeight: 420, overflowY: 'auto' }}>
                        {results.length === 0 ? (
                          <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: 20 }}>
                            {search ? 'Koi eligible student nahi mila' : 'Naam type karke search karo'}
                          </div>
                        ) : results.map(s => (
                          <div key={s.student_id}
                            onClick={() => setSelectedStudent(s)}
                            style={{
                              padding: '9px 10px', cursor: 'pointer', borderRadius: 6,
                              borderBottom: `1px solid ${darkMode ? '#334155' : '#f1f5f9'}`,
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = darkMode ? '#273349' : '#f8fafc'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            <div style={{ fontSize: 13, fontWeight: 600, color: darkMode ? '#f1f5f9' : '#0f172a' }}>{s.name}</div>
                            <div style={{ fontSize: 11, color: '#94a3b8' }}>
                              {s.roll_number} · {s.class_name} · {s.gender}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div>
                          <label style={labelStyle}>Full Name *</label>
                          <input style={inputStyle} value={newForm.name}
                            onChange={e => setNewForm({ ...newForm, name: e.target.value })} />
                        </div>
                        <div>
                          <label style={labelStyle}>Email *</label>
                          <input style={inputStyle} value={newForm.email}
                            onChange={e => setNewForm({ ...newForm, email: e.target.value })} />
                        </div>
                        <div>
                          <label style={labelStyle}>Gender</label>
                          <select style={selectStyle} value={newForm.gender}
                            onChange={e => setNewForm({ ...newForm, gender: e.target.value })}>
                            <option value="">Select</option>
                            <option value="MALE">Male</option>
                            <option value="FEMALE">Female</option>
                          </select>
                        </div>
                        <div>
                          <label style={labelStyle}>DOB</label>
                          <input type="date" style={inputStyle} value={newForm.dob}
                            onChange={e => setNewForm({ ...newForm, dob: e.target.value })} />
                        </div>
                        <div>
                          <label style={labelStyle}>Class</label>
                          <select style={selectStyle} value={newForm.class_id}
                            onChange={e => setNewForm({ ...newForm, class_id: e.target.value })}>
                            <option value="">Select</option>
                            {classes.map(c => (
                              <option key={c.id} value={c.id}>{c.name} - {c.section}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label style={labelStyle}>Roll Number</label>
                          <input style={inputStyle} value={newForm.roll_number}
                            onChange={e => setNewForm({ ...newForm, roll_number: e.target.value })} />
                        </div>
                        <div>
                          <label style={labelStyle}>Father's Name</label>
                          <input style={inputStyle} value={newForm.father_name}
                            onChange={e => setNewForm({ ...newForm, father_name: e.target.value })} />
                        </div>
                        <div>
                          <label style={labelStyle}>Parent Phone</label>
                          <input style={inputStyle} value={newForm.parent_phone}
                            onChange={e => setNewForm({ ...newForm, parent_phone: e.target.value })} />
                        </div>
                      </div>
                      <button
                        onClick={handleCreateNewStudent}
                        disabled={creating}
                        style={{
                          width: '100%', marginTop: 6, background: '#16a34a', color: '#fff',
                          border: 'none', borderRadius: 8, padding: '10px 0', fontSize: 13,
                          fontWeight: 700, cursor: 'pointer',
                        }}>
                        {creating ? 'Creating...' : '✅ Create Student & Continue'}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* RIGHT: Visual bed picker */}
            <div style={cardStyle}>
              <h4 style={{ margin: '0 0 14px', fontSize: 14, color: darkMode ? '#f1f5f9' : '#0f172a' }}>
                2. Assign Bed
              </h4>

              <label style={labelStyle}>Hostel</label>
              <select style={{ ...selectStyle, marginBottom: 16 }} value={hostelId} onChange={e => setHostelId(e.target.value)}>
                <option value="">Select Hostel</option>
                {hostels.map(h => (
                  <option key={h.id} value={h.id}>{h.name} ({h.gender})</option>
                ))}
              </select>

              {!hostelId && (
                <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: '40px 0' }}>
                  Pehle hostel select karo — building/floor/room niche dikhega
                </div>
              )}

              {mapLoading && (
                <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: '40px 0' }}>Loading...</div>
              )}

              {hostelId && !mapLoading && roomMap.length === 0 && (
                <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: '40px 0' }}>
                  Is hostel mein koi building/room nahi bani — pehle Hostel Setup se banao
                </div>
              )}

              {roomMap.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {roomMap.map(building => {
                    const totalBeds = building.floors.reduce((acc, f) =>
                      acc + f.rooms.reduce((a2, r) => a2 + r.beds.length, 0), 0);
                    const vacantBeds = building.floors.reduce((acc, f) =>
                      acc + f.rooms.reduce((a2, r) => a2 + r.beds.filter(b => b.status === 'VACANT').length, 0), 0);
                    const isExpanded = expandedBuilding === building.id;

                    return (
                      <div key={building.id} style={{
                        border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, borderRadius: 10,
                        overflow: 'hidden',
                      }}>
                        <div onClick={() => setExpandedBuilding(isExpanded ? null : building.id)}
                          style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '10px 14px', cursor: 'pointer',
                            background: isExpanded ? (darkMode ? '#273349' : '#eef2ff') : (darkMode ? '#0f172a' : '#fafbfc'),
                          }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 13, color: '#94a3b8' }}>{isExpanded ? '▾' : '▸'}</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: darkMode ? '#f1f5f9' : '#0f172a' }}>
                              🏢 {building.name}
                            </span>
                          </div>
                          <span style={{
                            fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20,
                            background: vacantBeds > 0 ? '#f0fdf4' : '#fef2f2',
                            color: vacantBeds > 0 ? '#16a34a' : '#dc2626',
                          }}>
                            {vacantBeds}/{totalBeds} vacant
                          </span>
                        </div>

                        {isExpanded && (
                          <div style={{ padding: '10px 14px', borderTop: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}` }}>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                              {building.floors.map(floor => {
                                const floorActive = expandedFloor === floor.id;
                                return (
                                  <button key={floor.id}
                                    onClick={() => setExpandedFloor(floorActive ? null : floor.id)}
                                    style={{
                                      padding: '5px 12px', fontSize: 11, fontWeight: 700, borderRadius: 20,
                                      border: 'none', cursor: 'pointer',
                                      background: floorActive ? '#4f46e5' : (darkMode ? '#273349' : '#f1f5f9'),
                                      color: floorActive ? '#fff' : (darkMode ? '#94a3b8' : '#64748b'),
                                    }}>
                                    {floor.name}
                                  </button>
                                );
                              })}
                            </div>

                            {building.floors.filter(f => f.id === expandedFloor).map(floor => (
                              <div key={floor.id} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {floor.rooms.length === 0 ? (
                                  <div style={{ fontSize: 12, color: '#94a3b8' }}>Is floor pe koi room nahi hai</div>
                                ) : floor.rooms.map(room => (
                                  <div key={room.id} style={{
                                    border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, borderRadius: 8, padding: 10,
                                    background: darkMode ? '#0f172a' : '#fff',
                                  }}>
                                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: darkMode ? '#e2e8f0' : '#1e293b' }}>
                                      Room {room.room_number} <span style={{ fontWeight: 400, color: '#94a3b8' }}>({room.room_type})</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                      {room.beds.map(bed => {
                                        const c = BED_COLORS[bed.status] || BED_COLORS.MAINTENANCE;
                                        const isSelected = bedId === bed.id;
                                        return (
                                          <div key={bed.id}
                                            onClick={() => pickBed(building, floor, room, bed)}
                                            title={bed.status === 'OCCUPIED' ? bed.student_name : bed.status}
                                            style={{
                                              width: 46, height: 46, borderRadius: 8,
                                              cursor: bed.status === 'VACANT' ? 'pointer' : 'not-allowed',
                                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                                              fontSize: 13, fontWeight: 700,
                                              background: isSelected ? '#4f46e5' : c.bg,
                                              color: isSelected ? '#fff' : c.text,
                                              border: `2px solid ${isSelected ? '#4f46e5' : c.border}`,
                                              opacity: bed.status === 'VACANT' || isSelected ? 1 : 0.7,
                                            }}>
                                            {bed.bed_number}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {roomMap.length > 0 && (
                <div style={{ display: 'flex', gap: 14, marginTop: 14, fontSize: 11, color: '#94a3b8', flexWrap: 'wrap' }}>
                  <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: '#bbf7d0', marginRight: 4 }} />Vacant</span>
                  <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: '#fecaca', marginRight: 4 }} />Occupied</span>
                  <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: '#fef08a', marginRight: 4 }} />Reserved</span>
                  <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: '#cbd5e1', marginRight: 4 }} />Maintenance</span>
                </div>
              )}

              {selectedBedInfo && (
                <div style={{
                  marginTop: 16, background: '#eef2ff', border: '1px solid #c7d2fe',
                  borderRadius: 8, padding: 12, fontSize: 12, color: '#4338ca',
                }}>
                  Selected: <strong>{selectedBedInfo.building} / {selectedBedInfo.floor} / Room {selectedBedInfo.room} / Bed {selectedBedInfo.bed}</strong>
                </div>
              )}

              <button
                onClick={handleAdmit}
                disabled={submitting || !selectedStudent || !bedId}
                style={{
                  width: '100%', marginTop: 16,
                  background: (!selectedStudent || !bedId) ? '#cbd5e1' : '#4f46e5',
                  color: '#fff', border: 'none', borderRadius: 8,
                  padding: '12px 0', fontSize: 14, fontWeight: 700,
                  cursor: (!selectedStudent || !bedId) ? 'not-allowed' : 'pointer',
                }}>
                {submitting ? 'Admitting...' : '✅ Confirm Admission'}
              </button>
            </div>
          </div>

          {/* ── Admitted Students Table ── */}
          <div style={{ ...cardStyle, marginTop: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
              <h4 style={{ margin: 0, fontSize: 15, color: darkMode ? '#f1f5f9' : '#0f172a' }}>
                🏨 Admitted Students <span style={{ color: '#94a3b8', fontWeight: 500 }}>({admissions.length})</span>
              </h4>
              <input
                value={tableSearch}
                onChange={e => setTableSearch(e.target.value)}
                placeholder="Search by name or admission no..."
                style={{ ...inputStyle, width: 260, marginBottom: 0 }}
              />
            </div>

            {admissionsLoading ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 13 }}>Loading...</div>
            ) : admissions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 13 }}>
                Koi admission nahi hui abhi
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${darkMode ? '#334155' : '#e2e8f0'}`, textAlign: 'left' }}>
                      {['Student Name', 'Class', 'Date of Joining', 'Room No.', 'Floor', 'Hostel Fee'].map(h => (
                        <th key={h} style={{
                          padding: '10px 12px', color: '#94a3b8', fontWeight: 700,
                          fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.03em', whiteSpace: 'nowrap',
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {admissions.map(a => {
                      const badge = FEE_BADGE[a.fee_status] || FEE_BADGE.PENDING;
                      return (
                        <tr
                          key={a.allocation_id}
                          onClick={() => navigate(`/students/${a.student_id}`)}
                          style={{
                            borderBottom: `1px solid ${darkMode ? '#334155' : '#f1f5f9'}`,
                            cursor: 'pointer', transition: 'background 0.1s',
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = darkMode ? '#273349' : '#f8fafc'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <td style={{ padding: '11px 12px', fontWeight: 700, color: '#4f46e5', whiteSpace: 'nowrap' }}>
                            {a.student_name}
                          </td>
                          <td style={{ padding: '11px 12px', color: darkMode ? '#cbd5e1' : '#334155', whiteSpace: 'nowrap' }}>
                            {a.class_name || '—'}
                          </td>
                          <td style={{ padding: '11px 12px', color: darkMode ? '#cbd5e1' : '#334155', whiteSpace: 'nowrap' }}>
                            {a.admission_date || '—'}
                          </td>
                          <td style={{ padding: '11px 12px', color: darkMode ? '#cbd5e1' : '#334155', whiteSpace: 'nowrap' }}>
                            {a.room_number || '—'}
                            {a.is_ac && <span title="AC Room" style={{ marginLeft: 6, color: '#4f46e5', fontWeight: 700 }}>❄️</span>}
                          </td>
                          <td style={{ padding: '11px 12px', color: darkMode ? '#cbd5e1' : '#334155', whiteSpace: 'nowrap' }}>
                            {a.floor_name || '—'}
                          </td>
                          <td style={{ padding: '11px 12px', whiteSpace: 'nowrap' }}>
                            <span style={{
                              fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 20,
                              background: badge.bg, color: badge.color,
                            }}>
                              {badge.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
