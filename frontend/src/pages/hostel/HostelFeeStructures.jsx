// NEW FILE — src/pages/hostel/HostelFeeStructures.jsx
import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api     from '../../api/axios';
import toast   from 'react-hot-toast';

const SHARING_TYPES = ['SINGLE', 'DOUBLE', 'TRIPLE', 'FOUR_SHARING', 'SIX_SHARING', 'CUSTOM'];

const EMPTY_FORM = {
  hostel_id: '', building_id: '', floor_id: '', is_ac: false, sharing_type: 'DOUBLE',
  monthly_fee: '', quarterly_fee: '', yearly_fee: '', security_deposit: '',
  electricity_charges: '', laundry_charges: '', mess_charges: '',
  maintenance_charges: '', late_fine: '', discount: '',
};

export default function HostelFeeStructures() {
  const [darkMode, setDarkMode] = useState(localStorage.getItem('ederp_theme') === 'dark');

  const [hostels, setHostels]   = useState([]);
  const [hostelFilter, setHostelFilter] = useState('');
  const [structures, setStructures] = useState([]);
  const [loading, setLoading]   = useState(true);

  // NEW — tab + student fee list
  const [activeTab, setActiveTab] = useState('structures'); // 'structures' | 'students'
  const [students, setStudents]   = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentSearch, setStudentSearch]     = useState('');

  // NEW — Collect Fee modal
  // NEW — Collect Fee modal
  const [collectModal, setCollectModal] = useState(null); // { fee_record_id, student_name, pending }
  const [collectAmount, setCollectAmount] = useState('');
  const [collectMode, setCollectMode]     = useState('CASH');
  const [collecting, setCollecting]       = useState(false);

  // NEW — Fine (single ya bulk — selectedStudentIds ke through kisi ek ya sab students pe ek saath)
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [fineModal, setFineModal]     = useState(null); // { mode: 'single'|'bulk', students: [...] }
  const [fineReason, setFineReason]   = useState('RULE_VIOLATION');
  const [fineDescription, setFineDescription] = useState('');
  const [fineAmount, setFineAmount]   = useState('');
  const [raisingFine, setRaisingFine] = useState(false);

  const FINE_REASONS = [
    ['FURNITURE_DAMAGE', 'Furniture Damage'],
    ['PROPERTY_LOSS',    'Property Loss'],
    ['ROOM_DAMAGE',      'Room Damage'],
    ['RULE_VIOLATION',   'Rule Violation'],
    ['OTHER',            'Other'],
  ];

  const [buildings, setBuildings] = useState([]);
  const [floors, setFloors]       = useState([]);

  const [showModal, setShowModal] = useState(false);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [saving, setSaving]       = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    api.get('/hostel/hostels').then(r => {
      setHostels(r.data || []);
      if (r.data?.length) setHostelFilter(String(r.data[0].id));
    }).catch(() => toast.error('Hostels load nahi hue'));
  }, []);

  const loadStructures = useCallback(() => {
    setLoading(true);
    const params = hostelFilter ? `?hostel_id=${hostelFilter}` : '';
    api.get('/hostel/fee-structures' + params)
      .then(r => setStructures(r.data || []))
      .catch(() => toast.error('Fee structures load nahi hui'))
      .finally(() => setLoading(false));
  }, [hostelFilter]);

  useEffect(() => { if (hostelFilter) loadStructures(); }, [hostelFilter, loadStructures]);
  const loadStudents = useCallback(() => {
    setStudentsLoading(true);
    const params = studentSearch ? `?search=${encodeURIComponent(studentSearch)}` : '';
    api.get('/hostel/admissions' + params)
      .then(r => setStudents(r.data || []))
      .catch(() => toast.error('Student list load nahi hui'))
      .finally(() => setStudentsLoading(false));
  }, [studentSearch]);

  useEffect(() => {
    if (activeTab === 'students') loadStudents();
  }, [activeTab, loadStudents]);

  function openCollect(s) {
    if (!s.fee_record_id) {
      toast.error('Is student ki abhi tak koi fee record generate nahi hui');
      return;
    }
    setCollectModal(s);
    setCollectAmount('');
    setCollectMode('CASH');
  }

  async function handleCollect() {
    const amt = parseFloat(collectAmount);
    if (!amt || amt <= 0) {
      toast.error('Sahi amount daalo');
      return;
    }
    setCollecting(true);
    try {
      await api.post('/hostel/fees/collect', {
        record_id: collectModal.fee_record_id,
        amount_paid: amt,
        payment_mode: collectMode,
      });
      toast.success('Fee collect ho gayi');
      setCollectModal(null);
      loadStudents();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Collect fail hua');
    }
    setCollecting(false);
  }
  // NEW — checkbox toggle
  function toggleStudentSelect(allocationId) {
    setSelectedStudentIds(prev =>
      prev.includes(allocationId) ? prev.filter(id => id !== allocationId) : [...prev, allocationId]
    );
  }

  function toggleSelectAll() {
    if (selectedStudentIds.length === students.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(students.map(s => s.allocation_id));
    }
  }

  // NEW — ek single student pe fine (row button se)
  function openFineSingle(s) {
    setFineModal({ mode: 'single', students: [s] });
    setFineReason('RULE_VIOLATION');
    setFineDescription('');
    setFineAmount('');
  }

  // NEW — selected students pe bulk fine (toolbar button se)
  function openFineBulk() {
    if (selectedStudentIds.length === 0) {
      toast.error('Pehle kam se kam ek student select karo');
      return;
    }
    const selected = students.filter(s => selectedStudentIds.includes(s.allocation_id));
    setFineModal({ mode: 'bulk', students: selected });
    setFineReason('RULE_VIOLATION');
    setFineDescription('');
    setFineAmount('');
  }

  async function handleRaiseFine() {
    const amt = parseFloat(fineAmount);
    if (!amt || amt <= 0) {
      toast.error('Sahi amount daalo');
      return;
    }
    setRaisingFine(true);
    try {
      // Har selected student ke liye alag-alag fine record banta hai (same amount, same reason)
      await Promise.all(fineModal.students.map(s =>
        api.post('/hostel/fines', {
          student_id: s.student_id,
          reason: fineReason,
          description: fineDescription,
          amount: amt,
        })
      ));
      toast.success(
        fineModal.students.length > 1
          ? `${fineModal.students.length} students pe fine lag gayi`
          : 'Fine lag gayi'
      );
      setFineModal(null);
      setSelectedStudentIds([]);
      loadStudents();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Fine raise fail hua');
    }
    setRaisingFine(false);
  }

  function openCreate() {
    setForm({ ...EMPTY_FORM, hostel_id: hostelFilter });
    setEditingId(null);
    setBuildings([]); setFloors([]);
    setShowModal(true);
    if (hostelFilter) {
      api.get(`/hostel/hostels/${hostelFilter}/buildings`).then(r => setBuildings(r.data || []));
    }
  }

  function openEdit(fs) {
    setForm({
      hostel_id: fs.hostel_id, building_id: fs.building_id || '', floor_id: fs.floor_id || '',
      is_ac: fs.is_ac, sharing_type: fs.sharing_type,
      monthly_fee: fs.monthly_fee, quarterly_fee: fs.quarterly_fee,
      yearly_fee: fs.yearly_fee, security_deposit: fs.security_deposit,
      electricity_charges: fs.electricity_charges, laundry_charges: fs.laundry_charges,
      mess_charges: fs.mess_charges, maintenance_charges: fs.maintenance_charges,
      late_fine: fs.late_fine, discount: fs.discount,
    });
    setEditingId(fs.id);
    setShowModal(true);
  }

  function handleBuildingChange(bid) {
    setForm(f => ({ ...f, building_id: bid, floor_id: '' }));
    setFloors([]);
    if (bid) api.get(`/hostel/buildings/${bid}/floors`).then(r => setFloors(r.data || []));
  }

  async function handleSave() {
    if (!form.hostel_id || !form.sharing_type || !form.monthly_fee) {
      toast.error('Hostel, sharing type aur monthly fee zaroori hai');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await api.patch(`/hostel/fee-structures/${editingId}`, form);
        toast.success('Fee structure updated');
      } else {
        await api.post('/hostel/fee-structures', form);
        toast.success('Fee structure created');
      }
      setShowModal(false);
      loadStructures();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save nahi ho paya');
    }
    setSaving(false);
  }

  async function handleDelete(id) {
    if (!window.confirm('Ye fee structure delete karni hai?')) return;
    try {
      await api.delete(`/hostel/fee-structures/${id}`);
      toast.success('Deleted');
      loadStructures();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Delete fail hua');
    }
  }

  async function handleGenerateMonthly() {
    if (!window.confirm('Sab active students ke liye is mahine ki hostel fee generate karni hai?')) return;
    setGenerating(true);
    try {
      const { data } = await api.post('/hostel/fees/generate-monthly', {});
      toast.success(`${data.created} records generate hue (${data.skipped} already the, ${data.no_structure} structure missing)`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Generate fail hua');
    }
    setGenerating(false);
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

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: darkMode ? '#0f172a' : '#f8fafc' }}>
      <Sidebar darkMode={darkMode} />
      <div style={{ marginLeft: 232, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Navbar title="Hostel Fee Structures" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />

        <div style={{ padding: 24 }}>

          {/* NEW — Tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 18, borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}` }}>
            {[['structures', '💰 Fee Structures'], ['students', '👥 Student Fees']].map(([key, label]) => (
              <button key={key} onClick={() => setActiveTab(key)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '10px 18px', fontSize: 13, fontWeight: 600,
                color: activeTab === key ? '#4f46e5' : '#94a3b8',
                borderBottom: activeTab === key ? '2px solid #4f46e5' : '2px solid transparent',
                marginBottom: -1,
              }}>{label}</button>
            ))}
          </div>

          <div style={{ display: activeTab === 'structures' ? 'flex' : 'none', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
            <select
              value={hostelFilter}
              onChange={e => setHostelFilter(e.target.value)}
              style={{
                padding: '9px 14px', fontSize: 13, fontWeight: 600, borderRadius: 8,
                border: '1px solid #e2e8f0', minWidth: 220,
                background: darkMode ? '#1e293b' : '#fff', color: darkMode ? '#f1f5f9' : '#0f172a',
              }}
            >
              {hostels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={handleGenerateMonthly} disabled={generating} style={{
                background: darkMode ? '#1e293b' : '#fff', color: '#4f46e5',
                border: '1px solid #4f46e5', borderRadius: 8,
                padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>
                {generating ? 'Generating...' : '⚡ Generate This Month\'s Fees'}
              </button>
              <button onClick={openCreate} style={{
                background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8,
                padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>
                + Fee Structure
              </button>
            </div>
          </div>

          {activeTab === 'structures' && (loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>Loading...</div>
          ) : structures.length === 0 ? (
            <div style={{ ...cardStyle, textAlign: 'center', padding: 50, color: '#94a3b8' }}>
              Is hostel ke liye koi fee structure nahi bani abhi
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
              {structures.map(fs => (
                <div key={fs.id} style={cardStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: darkMode ? '#f1f5f9' : '#0f172a' }}>
                        {fs.sharing_type.replace('_', ' ')} · {fs.is_ac ? 'AC' : 'Non-AC'}
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                        {fs.building_name} {fs.floor_id ? `/ ${fs.floor_name}` : ''}
                      </div>
                    </div>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                      background: fs.status === 'ACTIVE' ? '#f0fdf4' : '#fef2f2',
                      color: fs.status === 'ACTIVE' ? '#16a34a' : '#dc2626',
                    }}>{fs.status}</span>
                  </div>

                  <div style={{ fontSize: 22, fontWeight: 800, color: '#4f46e5', marginBottom: 4 }}>
                    ₹{fs.total_monthly.toLocaleString('en-IN')}<span style={{ fontSize: 12, fontWeight: 500, color: '#94a3b8' }}>/month</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 12 }}>
                    Base ₹{fs.monthly_fee} + Mess ₹{fs.mess_charges} + Electricity ₹{fs.electricity_charges}
                    {fs.discount > 0 && ` − Discount ₹${fs.discount}`}
                  </div>

                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => openEdit(fs)} style={{
                      flex: 1, background: '#f1f5f9', color: '#334155', border: 'none',
                      borderRadius: 6, padding: '6px 0', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    }}>Edit</button>
                    <button onClick={() => handleDelete(fs.id)} style={{
                      flex: 1, background: '#fef2f2', color: '#dc2626', border: 'none',
                      borderRadius: 6, padding: '6px 0', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    }}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          ))}

          {/* NEW — Student Fees tab */}
          {activeTab === 'students' && (
            <>
              <div style={{ marginBottom: 14, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <input
                  placeholder="Search by name / admission no..."
                  value={studentSearch}
                  onChange={e => setStudentSearch(e.target.value)}
                  style={{
                    padding: '9px 14px', fontSize: 13, borderRadius: 8, width: 280,
                    border: '1px solid #e2e8f0', background: darkMode ? '#1e293b' : '#fff',
                    color: darkMode ? '#f1f5f9' : '#0f172a',
                  }}
                />
                {/* NEW — bulk fine button, sirf tab dikhta hai jab koi student selected ho */}
                {selectedStudentIds.length > 0 && (
                  <button onClick={openFineBulk} style={{
                    background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8,
                    padding: '9px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  }}>
                    ⚠ Raise Fine — {selectedStudentIds.length} Selected
                  </button>
                )}
              </div>

              {studentsLoading ? (
                <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>Loading...</div>
              ) : students.length === 0 ? (
                <div style={{ ...cardStyle, textAlign: 'center', padding: 50, color: '#94a3b8' }}>
                  Koi student hostel mein allocated nahi hai
                </div>
              ) : (
                <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: darkMode ? '#0f172a' : '#f8fafc', textAlign: 'left' }}>
                        <th style={{ padding: '10px 14px', width: 30 }}>
                          <input type="checkbox"
                            checked={students.length > 0 && selectedStudentIds.length === students.length}
                            onChange={toggleSelectAll} />
                        </th>
                        {['Student', 'Class', 'Building / Room', 'Due', 'Paid', 'Status', ''].map(h => (
                          <th key={h} style={{ padding: '10px 14px', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {students.map(s => (
                        <tr key={s.allocation_id} style={{ borderTop: `1px solid ${darkMode ? '#334155' : '#f1f5f9'}` }}>
                          <td style={{ padding: '10px 14px' }}>
                            <input type="checkbox"
                              checked={selectedStudentIds.includes(s.allocation_id)}
                              onChange={() => toggleStudentSelect(s.allocation_id)} />
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ fontWeight: 600, color: darkMode ? '#f1f5f9' : '#0f172a' }}>{s.student_name}</div>
                            <div style={{ fontSize: 11, color: '#94a3b8' }}>{s.admission_no}</div>
                          </td>
                          <td style={{ padding: '10px 14px', color: '#64748b' }}>{s.class_name}</td>
                          <td style={{ padding: '10px 14px', color: '#64748b' }}>
                            {s.building_name} · {s.room_number}{s.bed_number ? `-${s.bed_number}` : ''}
                          </td>
                          <td style={{ padding: '10px 14px' }}>₹{s.total_due?.toLocaleString('en-IN')}</td>
                          <td style={{ padding: '10px 14px' }}>₹{s.total_paid?.toLocaleString('en-IN')}</td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{
                              fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20,
                              background: s.fee_status === 'PAID' ? '#f0fdf4' : s.fee_status === 'PARTIAL' ? '#fffbeb' : '#fef2f2',
                              color:      s.fee_status === 'PAID' ? '#16a34a' : s.fee_status === 'PARTIAL' ? '#d97706' : '#dc2626',
                            }}>{s.fee_status}</span>
                          </td>
                          <td style={{ padding: '10px 14px', display: 'flex', gap: 6 }}>
                            {s.pending > 0 && (
                              <button onClick={() => openCollect(s)} style={{
                                background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 6,
                                padding: '6px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                              }}>Collect Fee</button>
                            )}
                            {/* NEW — sirf isi ek student pe fine */}
                            <button onClick={() => openFineSingle(s)} style={{
                              background: '#fef2f2', color: '#dc2626', border: 'none', borderRadius: 6,
                              padding: '6px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                            }}>⚠ Fine</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Create/Edit Modal ── */}
      {showModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h3>{editingId ? 'Edit Fee Structure' : 'New Fee Structure'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              {!editingId && (
                <>
                  <label style={labelStyle}>Building (optional — blank = applies to whole hostel)</label>
                  <select style={inputStyle} value={form.building_id} onChange={e => handleBuildingChange(e.target.value)}>
                    <option value="">All Buildings</option>
                    {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>

                  <label style={labelStyle}>Floor (optional)</label>
                  <select style={inputStyle} value={form.floor_id} disabled={!form.building_id}
                    onChange={e => setForm({ ...form, floor_id: e.target.value })}>
                    <option value="">All Floors</option>
                    {floors.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={labelStyle}>Room Type</label>
                  <select style={inputStyle} value={form.is_ac ? 'AC' : 'NON_AC'}
                    onChange={e => setForm({ ...form, is_ac: e.target.value === 'AC' })} disabled={!!editingId}>
                    <option value="NON_AC">Non-AC</option>
                    <option value="AC">AC</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Sharing Type</label>
                  <select style={inputStyle} value={form.sharing_type} disabled={!!editingId}
                    onChange={e => setForm({ ...form, sharing_type: e.target.value })}>
                    {SHARING_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={labelStyle}>Monthly Fee *</label>
                  <input type="number" style={inputStyle} value={form.monthly_fee}
                    onChange={e => setForm({ ...form, monthly_fee: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>Security Deposit</label>
                  <input type="number" style={inputStyle} value={form.security_deposit}
                    onChange={e => setForm({ ...form, security_deposit: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>Mess Charges</label>
                  <input type="number" style={inputStyle} value={form.mess_charges}
                    onChange={e => setForm({ ...form, mess_charges: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>Electricity Charges</label>
                  <input type="number" style={inputStyle} value={form.electricity_charges}
                    onChange={e => setForm({ ...form, electricity_charges: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>Laundry Charges</label>
                  <input type="number" style={inputStyle} value={form.laundry_charges}
                    onChange={e => setForm({ ...form, laundry_charges: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>Maintenance Charges</label>
                  <input type="number" style={inputStyle} value={form.maintenance_charges}
                    onChange={e => setForm({ ...form, maintenance_charges: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>Late Fine</label>
                  <input type="number" style={inputStyle} value={form.late_fine}
                    onChange={e => setForm({ ...form, late_fine: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>Discount</label>
                  <input type="number" style={inputStyle} value={form.discount}
                    onChange={e => setForm({ ...form, discount: e.target.value })} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-neutral" onClick={() => setShowModal(false)}>Cancel</button>
              <button onClick={handleSave} disabled={saving} style={{
                background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 6,
                padding: '8px 20px', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
              }}>
                {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NEW — Collect Fee Modal */}
      {collectModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setCollectModal(null)}>
          <div className="modal" style={{ maxWidth: 380 }}>
            <div className="modal-header">
              <h3>Collect Fee — {collectModal.student_name}</h3>
              <button className="modal-close" onClick={() => setCollectModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
                Pending: <strong>₹{collectModal.pending?.toLocaleString('en-IN')}</strong>
              </p>
              <label style={labelStyle}>Amount</label>
              <input type="number" style={inputStyle} value={collectAmount}
                onChange={e => setCollectAmount(e.target.value)} placeholder="Amount" />
              <label style={labelStyle}>Payment Mode</label>
              <select style={inputStyle} value={collectMode} onChange={e => setCollectMode(e.target.value)}>
                <option value="CASH">Cash</option>
                <option value="UPI">UPI</option>
                <option value="ONLINE">Online</option>
                <option value="CHEQUE">Cheque</option>
              </select>
            </div>
            <div className="modal-footer">
              <button className="btn btn-neutral" onClick={() => setCollectModal(null)}>Cancel</button>
              <button onClick={handleCollect} disabled={collecting} style={{
                background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 6,
                padding: '8px 20px', fontSize: 13, fontWeight: 700, cursor: collecting ? 'not-allowed' : 'pointer',
              }}>
                {collecting ? 'Collecting...' : 'Collect'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NEW — Raise Fine Modal (single ya bulk dono ke liye same modal) */}
      {fineModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setFineModal(null)}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h3>
                {fineModal.mode === 'bulk'
                  ? `Raise Fine — ${fineModal.students.length} Students`
                  : `Raise Fine — ${fineModal.students[0].student_name}`}
              </h3>
              <button className="modal-close" onClick={() => setFineModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              {fineModal.mode === 'bulk' && (
                <div style={{
                  background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8,
                  padding: '8px 12px', fontSize: 11.5, color: '#92400e', marginBottom: 12,
                }}>
                  Ye fine <strong>in sab {fineModal.students.length} students</strong> pe alag-alag (same amount) lagegi:
                  <div style={{ marginTop: 4, color: '#64748b' }}>
                    {fineModal.students.map(s => s.student_name).join(', ')}
                  </div>
                </div>
              )}

              <label style={labelStyle}>Reason</label>
              <select style={inputStyle} value={fineReason} onChange={e => setFineReason(e.target.value)}>
                {FINE_REASONS.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
              </select>

              <label style={labelStyle}>Description (optional)</label>
              <input style={inputStyle} value={fineDescription}
                onChange={e => setFineDescription(e.target.value)}
                placeholder="e.g. Chair broken in Room 102" />

              <label style={labelStyle}>Amount (per student)</label>
              <input type="number" style={inputStyle} value={fineAmount}
                onChange={e => setFineAmount(e.target.value)} placeholder="Amount" />
            </div>
            <div className="modal-footer">
              <button className="btn btn-neutral" onClick={() => setFineModal(null)}>Cancel</button>
              <button onClick={handleRaiseFine} disabled={raisingFine} style={{
                background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6,
                padding: '8px 20px', fontSize: 13, fontWeight: 700, cursor: raisingFine ? 'not-allowed' : 'pointer',
              }}>
                {raisingFine ? 'Raising...' : 'Raise Fine'}
              </button>
            </div>
          </div>
        </div>
      
      
      )}
    </div>
  );
}
