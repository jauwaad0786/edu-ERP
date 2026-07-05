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

  // ── Hierarchy picker ──
  const [hostels, setHostels]     = useState([]);
  const [hostelId, setHostelId]   = useState('');
  const [buildings, setBuildings] = useState([]);
  const [buildingId, setBuildingId] = useState('');
  const [floors, setFloors]       = useState([]);
  const [floorId, setFloorId]     = useState('');
  const [rooms, setRooms]         = useState([]);
  const [roomId, setRoomId]       = useState('');
  const [beds, setBeds]           = useState([]);
  const [bedId, setBedId]         = useState('');

  const [submitting, setSubmitting] = useState(false);

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

  // ── Hierarchy cascading loads ──
  useEffect(() => {
    setBuildingId(''); setBuildings([]); setFloors([]); setRooms([]); setBeds([]);
    if (!hostelId) return;
    api.get(`/hostel/hostels/${hostelId}/buildings`).then(r => setBuildings(r.data || []));
  }, [hostelId]);

  useEffect(() => {
    setFloorId(''); setFloors([]); setRooms([]); setBeds([]);
    if (!buildingId) return;
    api.get(`/hostel/buildings/${buildingId}/floors`).then(r => setFloors(r.data || []));
  }, [buildingId]);

  useEffect(() => {
    setRoomId(''); setRooms([]); setBeds([]);
    if (!floorId) return;
    api.get(`/hostel/floors/${floorId}/rooms`).then(r => setRooms(r.data || []));
  }, [floorId]);

  useEffect(() => {
    setBedId(''); setBeds([]);
    if (!roomId) return;
    api.get(`/hostel/rooms/${roomId}/beds`).then(r => setBeds((r.data || []).filter(b => b.status === 'VACANT')));
  }, [roomId]);

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
      setTab('EXISTING'); // switch view to show selected student + hierarchy picker
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
      navigate('/hostel/room-map');
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

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: darkMode ? '#0f172a' : '#f8fafc' }}>
      <Sidebar darkMode={darkMode} />
      <div style={{ marginLeft: 232, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Navbar title="Hostel Admission" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />

        <div style={{ padding: 24, maxWidth: 1000 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

            {/* ── LEFT: Student selection ── */}
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
                      <div style={{ maxHeight: 320, overflowY: 'auto' }}>
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

            {/* ── RIGHT: Hierarchy picker ── */}
            <div style={cardStyle}>
              <h4 style={{ margin: '0 0 14px', fontSize: 14, color: darkMode ? '#f1f5f9' : '#0f172a' }}>
                2. Assign Bed
              </h4>

              <label style={labelStyle}>Hostel</label>
              <select style={selectStyle} value={hostelId} onChange={e => setHostelId(e.target.value)}>
                <option value="">Select Hostel</option>
                {hostels.map(h => (
                  <option key={h.id} value={h.id}>{h.name} ({h.gender})</option>
                ))}
              </select>

              <label style={labelStyle}>Building</label>
              <select style={selectStyle} value={buildingId} onChange={e => setBuildingId(e.target.value)} disabled={!hostelId}>
                <option value="">Select Building</option>
                {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>

              <label style={labelStyle}>Floor</label>
              <select style={selectStyle} value={floorId} onChange={e => setFloorId(e.target.value)} disabled={!buildingId}>
                <option value="">Select Floor</option>
                {floors.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>

              <label style={labelStyle}>Room</label>
              <select style={selectStyle} value={roomId} onChange={e => setRoomId(e.target.value)} disabled={!floorId}>
                <option value="">Select Room</option>
                {rooms.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.room_number} ({r.room_type}) — {r.available_beds} vacant
                  </option>
                ))}
              </select>

              <label style={labelStyle}>Bed</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                {beds.length === 0 && roomId && (
                  <div style={{ fontSize: 12, color: '#dc2626' }}>Is room mein vacant bed nahi hai</div>
                )}
                {beds.map(b => (
                  <div key={b.id}
                    onClick={() => setBedId(b.id)}
                    style={{
                      width: 44, height: 44, borderRadius: 8, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 700,
                      background: bedId === b.id ? '#4f46e5' : (darkMode ? '#273349' : '#f0fdf4'),
                      color: bedId === b.id ? '#fff' : '#16a34a',
                      border: `2px solid ${bedId === b.id ? '#4f46e5' : '#bbf7d0'}`,
                    }}
                  >
                    {b.bed_number}
                  </div>
                ))}
              </div>

              <button
                onClick={handleAdmit}
                disabled={submitting || !selectedStudent || !bedId}
                style={{
                  width: '100%',
                  background: (!selectedStudent || !bedId) ? '#cbd5e1' : '#4f46e5',
                  color: '#fff', border: 'none', borderRadius: 8,
                  padding: '12px 0', fontSize: 14, fontWeight: 700,
                  cursor: (!selectedStudent || !bedId) ? 'not-allowed' : 'pointer',
                }}>
                {submitting ? 'Admitting...' : '✅ Confirm Admission'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
