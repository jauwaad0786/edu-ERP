import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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

const getCurrentMonth = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

const formatMonthName = (ym) => {
  if (!ym) return '';
  try {
    const [y, m] = ym.split('-');
    const d = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
    return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  } catch (e) {
    return ym;
  }
};

const getAdjacentMonth = (ym, delta) => {
  if (!ym) return getCurrentMonth();
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  const nextY = d.getFullYear();
  const nextM = String(d.getMonth() + 1).padStart(2, '0');
  return `${nextY}-${nextM}`;
};

export default function HostelFeeStructures() {
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('ederp_theme') === 'dark');

  const [hostels, setHostels]           = useState([]);
  const [hostelFilter, setHostelFilter] = useState('');
  const [structures, setStructures]     = useState([]);
  const [loading, setLoading]           = useState(true);

  // Active Billing Month Selector (Replaces confusing "This Month")
  const [billingMonth, setBillingMonth] = useState(getCurrentMonth());
  const [generating, setGenerating]     = useState(false);

  // Tabs
  const [activeTab, setActiveTab] = useState('structures'); // 'structures' | 'residents'
  const [students, setStudents]   = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentSearch, setStudentSearch]     = useState('');

  // Collect Fee modal
  const [collectModal, setCollectModal]   = useState(null);
  const [collectAmount, setCollectAmount] = useState('');
  const [collectMode, setCollectMode]     = useState('CASH');
  const [collecting, setCollecting]       = useState(false);

  // Fine modal
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [fineModal, setFineModal]         = useState(null);
  const [fineReason, setFineReason]       = useState('RULE_VIOLATION');
  const [fineDescription, setFineDescription] = useState('');
  const [fineAmount, setFineAmount]       = useState('');
  const [raisingFine, setRaisingFine]     = useState(false);

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

  useEffect(() => {
    localStorage.setItem('ederp_theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    api.get('/hostel/hostels').then(r => {
      setHostels(r.data || []);
      if (r.data?.length) setHostelFilter(String(r.data[0].id));
    }).catch(() => toast.error('Failed to load hostels list'));
  }, []);

  const loadStructures = useCallback(() => {
    setLoading(true);
    const params = hostelFilter ? `?hostel_id=${hostelFilter}` : '';
    api.get('/hostel/fee-structures' + params)
      .then(r => setStructures(r.data || []))
      .catch(() => toast.error('Failed to load hostel fee structures'))
      .finally(() => setLoading(false));
  }, [hostelFilter]);

  useEffect(() => { 
    if (hostelFilter) loadStructures(); 
  }, [hostelFilter, loadStructures]);

  const loadStudents = useCallback(() => {
    setStudentsLoading(true);
    const params = studentSearch ? `?search=${encodeURIComponent(studentSearch)}` : '';
    api.get('/hostel/admissions' + params)
      .then(r => setStudents(r.data || []))
      .catch(() => toast.error('Failed to load resident students'))
      .finally(() => setStudentsLoading(false));
  }, [studentSearch]);

  useEffect(() => {
    if (activeTab === 'residents') loadStudents();
  }, [activeTab, loadStudents]);

  function openCollect(s) {
    if (!s.fee_record_id) {
      toast.error('No fee record generated for this student yet. Generate bills first.');
      return;
    }
    setCollectModal(s);
    setCollectAmount(s.pending || '');
    setCollectMode('CASH');
  }

  async function handleCollect() {
    if (!collectAmount || parseFloat(collectAmount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    setCollecting(true);
    try {
      await api.post('/hostel/fees/collect', {
        record_id: collectModal.fee_record_id,
        amount_paid: parseFloat(collectAmount),
        payment_mode: collectMode,
      });
      toast.success('Payment recorded & synced to Central Finance Ledger');
      setCollectModal(null);
      loadStudents();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Payment collection failed');
    }
    setCollecting(false);
  }

  function toggleSelectAll() {
    if (selectedStudentIds.length === students.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(students.map(s => s.allocation_id));
    }
  }

  function toggleStudentSelect(id) {
    setSelectedStudentIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  function openFineBulk() {
    const selected = students.filter(s => selectedStudentIds.includes(s.allocation_id));
    if (!selected.length) return;
    setFineModal({ mode: 'bulk', students: selected });
    setFineReason('RULE_VIOLATION');
    setFineDescription('');
    setFineAmount('');
  }

  async function handleRaiseFine() {
    if (!fineAmount || parseFloat(fineAmount) <= 0) {
      toast.error('Please enter a valid fine amount');
      return;
    }
    setRaisingFine(true);
    try {
      const studentIds = fineModal.students.map(s => s.student_id);
      await api.post('/hostel/fines', {
        student_ids: studentIds,
        reason: fineReason,
        description: fineDescription,
        amount: parseFloat(fineAmount),
      });
      toast.success(`Fine applied to ${studentIds.length} student(s) & posted to Central Finance`);
      setFineModal(null);
      setSelectedStudentIds([]);
      loadStudents();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to raise fine');
    }
    setRaisingFine(false);
  }

  function openCreate() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, hostel_id: hostelFilter || (hostels[0]?.id ? String(hostels[0].id) : '') });
    setBuildings([]);
    setFloors([]);
    if (hostelFilter) {
      api.get(`/hostel/hostels/${hostelFilter}/buildings`).then(r => setBuildings(r.data || []));
    }
    setShowModal(true);
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
    if (fs.hostel_id) {
      api.get(`/hostel/hostels/${fs.hostel_id}/buildings`).then(r => setBuildings(r.data || []));
    }
    if (fs.building_id) {
      api.get(`/hostel/buildings/${fs.building_id}/floors`).then(r => setFloors(r.data || []));
    }
    setShowModal(true);
  }

  function handleBuildingChange(bid) {
    setForm(f => ({ ...f, building_id: bid, floor_id: '' }));
    setFloors([]);
    if (bid) api.get(`/hostel/buildings/${bid}/floors`).then(r => setFloors(r.data || []));
  }

  async function handleSave() {
    if (!form.hostel_id || !form.sharing_type || !form.monthly_fee) {
      toast.error('Hostel, Sharing Type, and Monthly Fee are required');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await api.patch(`/hostel/fee-structures/${editingId}`, form);
        toast.success('Fee structure updated successfully');
      } else {
        await api.post('/hostel/fee-structures', form);
        toast.success('Fee structure created & registered with Central Finance');
      }
      setShowModal(false);
      loadStructures();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save fee structure');
    }
    setSaving(false);
  }

  async function handleDelete(id) {
    if (!window.confirm('Are you sure you want to delete or deactivate this rate card?')) return;
    try {
      await api.delete(`/hostel/fee-structures/${id}`);
      toast.success('Fee structure removed');
      loadStructures();
    } catch (err) {
      const data = err.response?.data;
      if (data?.can_archive) {
        if (window.confirm(`${data.error}\n\nWould you like to ARCHIVE this structure instead to protect past financial audits?`)) {
          await api.patch(`/hostel/fee-structures/${id}`, { status: 'ARCHIVED' });
          toast.success('Fee structure archived successfully');
          loadStructures();
        }
      } else {
        toast.error(data?.error || 'Failed to delete');
      }
    }
  }

  // Monthly Bill Generation with explicit month parameter (Replaced "This Month")
  async function handleGenerateMonthly() {
    const formatted = formatMonthName(billingMonth);
    if (!window.confirm(`Generate monthly hostel fee billing demand for all active residents for ${formatted}?\n\nBills will automatically sync with Central Finance and debit the Student Financial Ledger.`)) {
      return;
    }
    setGenerating(true);
    try {
      const { data } = await api.post('/hostel/fees/generate-monthly', { month: billingMonth });
      toast.success(`Success for ${formatted}: ${data.created} bills generated, ${data.skipped} already existing.`);
      loadStructures();
      if (activeTab === 'residents') loadStudents();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to generate monthly fees');
    }
    setGenerating(false);
  }

  // Calculate live preview total in create/edit modal
  const modalMonthlyTotal = (
    (parseFloat(form.monthly_fee) || 0) +
    (parseFloat(form.mess_charges) || 0) +
    (parseFloat(form.electricity_charges) || 0) +
    (parseFloat(form.laundry_charges) || 0) +
    (parseFloat(form.maintenance_charges) || 0) -
    (parseFloat(form.discount) || 0)
  );

  const cardStyle = {
    background: darkMode ? '#1e293b' : '#ffffff',
    border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
    borderRadius: 14,
    padding: 18,
    boxShadow: darkMode ? '0 4px 16px rgba(0,0,0,0.25)' : '0 2px 10px rgba(15,23,42,0.03)'
  };

  const inputStyle = {
    width: '100%', padding: '9px 12px', fontSize: 13,
    border: `1px solid ${darkMode ? '#475569' : '#cbd5e1'}`, borderRadius: 8, outline: 'none', boxSizing: 'border-box',
    background: darkMode ? '#0f172a' : '#ffffff', color: darkMode ? '#f1f5f9' : '#0f172a',
    marginBottom: 10,
  };

  const labelStyle = { fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 4, display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: darkMode ? '#0f172a' : '#f8fafc' }}>
      <Sidebar darkMode={darkMode} />
      <div style={{ marginLeft: 232, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Navbar title="Hostel Fees &amp; Rate Cards" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />

        <div style={{ padding: '24px 28px' }}>

          {/* ══ Top Ecosystem Navigation Breadcrumb ══ */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: darkMode ? '#1e293b' : '#ffffff',
            border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
            borderRadius: '12px', padding: '10px 18px', marginBottom: '20px', flexWrap: 'wrap', gap: '10px'
          }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => setActiveTab('structures')}
                style={{
                  background: activeTab === 'structures' ? '#4f46e5' : 'transparent',
                  color: activeTab === 'structures' ? '#ffffff' : (darkMode ? '#94a3b8' : '#475569'),
                  border: 'none', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                <i className="ti ti-layout-grid" /> 1. Rate Cards (Fee Structures)
              </button>
              <button
                onClick={() => navigate('/hostel/fees')}
                style={{
                  background: 'transparent',
                  color: darkMode ? '#94a3b8' : '#475569',
                  border: 'none', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                <i className="ti ti-cash" /> 2. Monthly Billing &amp; Collections
              </button>
              <button
                onClick={() => navigate('/hostel/fines')}
                style={{
                  background: 'transparent',
                  color: darkMode ? '#94a3b8' : '#475569',
                  border: 'none', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                <i className="ti ti-gavel" /> 3. Hostel Fines &amp; Penalties
              </button>
            </div>

            <button
              onClick={() => navigate('/finance/fees-management')}
              style={{
                background: darkMode ? '#0f172a' : '#f1f5f9',
                color: '#4f46e5',
                border: '1px solid #4f46e5',
                borderRadius: '8px', padding: '8px 14px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px'
              }}
            >
              <i className="ti ti-building-bank" /> Central Fees Management ↗
            </button>
          </div>

          {/* ══ Central Finance Sync Hero Banner ══ */}
          <div style={{
            position: 'relative', overflow: 'hidden',
            borderRadius: '16px', padding: '20px 24px', marginBottom: '22px',
            background: darkMode
              ? 'linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)'
              : 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
            color: '#ffffff',
            boxShadow: '0 8px 24px -4px rgba(79, 70, 229, 0.3)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                  <span style={{
                    padding: '3px 10px', borderRadius: '20px',
                    background: 'rgba(16, 185, 129, 0.25)', border: '1px solid #10b981',
                    fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#a7f3d0'
                  }}>
                    🟢 Central Finance Live Sync
                  </span>
                  <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.85)' }}>
                    Fee Head: <strong>HOSTEL</strong>
                  </span>
                </div>
                <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: '#ffffff' }}>
                  Hostel Rate Cards &amp; Pricing Rules
                </h1>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'rgba(255,255,255,0.85)', maxWidth: '650px' }}>
                  Define monthly room rate cards by sharing and AC tier. When bills are generated, charges instantly register into Central Fees Management and debit the Student Financial Ledger.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={openCreate}
                  style={{
                    background: '#ffffff', color: '#4f46e5', border: 'none', borderRadius: '10px',
                    padding: '10px 18px', fontSize: '13px', fontWeight: 800, cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', gap: '6px'
                  }}
                >
                  <i className="ti ti-plus" /> + New Rate Card
                </button>
              </div>
            </div>
          </div>

          {/* ══ Dedicated Billing Demand Command Bar (REPLACED CONFUSING "THIS MONTH") ══ */}
          <div style={{
            background: darkMode ? '#111827' : '#ffffff',
            border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : '#cbd5e1'}`,
            borderRadius: '16px', padding: '16px 20px', marginBottom: '22px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px',
            boxShadow: darkMode ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 16px rgba(15,23,42,0.03)'
          }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Monthly Billing Generation Engine
              </div>
              <div style={{ fontSize: '14px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a', marginTop: '2px' }}>
                Active Demand Month: <span style={{ color: '#4f46e5' }}>{formatMonthName(billingMonth)}</span>
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                Generates canonical fee bills for every admitted student based on their allocated room rate card.
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              {/* Stepper controls */}
              <div style={{
                display: 'flex', alignItems: 'center', background: darkMode ? '#1e293b' : '#f1f5f9',
                border: `1px solid ${darkMode ? '#334155' : '#cbd5e1'}`, borderRadius: '8px', padding: '4px'
              }}>
                <button
                  type="button"
                  title="Previous Month"
                  onClick={() => setBillingMonth(prev => getAdjacentMonth(prev, -1))}
                  style={{
                    background: 'none', border: 'none', color: darkMode ? '#f1f5f9' : '#0f172a',
                    padding: '6px 10px', cursor: 'pointer', fontWeight: 800
                  }}
                >
                  ◀
                </button>
                <input
                  type="month"
                  value={billingMonth}
                  onChange={e => setBillingMonth(e.target.value)}
                  style={{
                    background: 'transparent', border: 'none', outline: 'none',
                    fontWeight: 700, fontSize: '13px', color: darkMode ? '#f1f5f9' : '#0f172a',
                    padding: '4px 6px', cursor: 'pointer'
                  }}
                />
                <button
                  type="button"
                  title="Next Month"
                  onClick={() => setBillingMonth(prev => getAdjacentMonth(prev, 1))}
                  style={{
                    background: 'none', border: 'none', color: darkMode ? '#f1f5f9' : '#0f172a',
                    padding: '6px 10px', cursor: 'pointer', fontWeight: 800
                  }}
                >
                  ▶
                </button>
              </div>

              <button
                onClick={handleGenerateMonthly}
                disabled={generating}
                style={{
                  background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
                  color: '#ffffff', border: 'none', borderRadius: '8px',
                  padding: '10px 20px', fontSize: '13px', fontWeight: 800, cursor: generating ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: '8px',
                  boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)'
                }}
              >
                {generating ? (
                  <>⏳ Generating {formatMonthName(billingMonth)}...</>
                ) : (
                  <>⚡ Generate {formatMonthName(billingMonth)} Bills</>
                )}
              </button>
            </div>
          </div>

          {/* ══ Filter Bar & Sub-Tabs ══ */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>FILTER HOSTEL:</span>
              <select
                value={hostelFilter}
                onChange={e => setHostelFilter(e.target.value)}
                style={{
                  padding: '9px 14px', fontSize: 13, fontWeight: 600, borderRadius: 8,
                  border: `1px solid ${darkMode ? '#334155' : '#cbd5e1'}`, minWidth: 240,
                  background: darkMode ? '#1e293b' : '#fff', color: darkMode ? '#f1f5f9' : '#0f172a',
                }}
              >
                {hostels.map(h => <option key={h.id} value={h.id}>{h.name} ({h.gender || h.hostel_type})</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setActiveTab('structures')}
                style={{
                  background: activeTab === 'structures' ? (darkMode ? '#334155' : '#e2e8f0') : 'transparent',
                  color: darkMode ? '#f1f5f9' : '#0f172a',
                  border: `1px solid ${darkMode ? '#334155' : '#cbd5e1'}`,
                  borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer'
                }}
              >
                Rate Cards ({structures.length})
              </button>
              <button
                onClick={() => setActiveTab('residents')}
                style={{
                  background: activeTab === 'residents' ? (darkMode ? '#334155' : '#e2e8f0') : 'transparent',
                  color: darkMode ? '#f1f5f9' : '#0f172a',
                  border: `1px solid ${darkMode ? '#334155' : '#cbd5e1'}`,
                  borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer'
                }}
              >
                Allocated Residents
              </button>
            </div>
          </div>

          {/* ══ Tab 1: Rate Cards Grid ══ */}
          {activeTab === 'structures' && (
            loading ? (
              <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>Loading Hostel Rate Cards...</div>
            ) : structures.length === 0 ? (
              <div style={{ ...cardStyle, textAlign: 'center', padding: 60, color: '#94a3b8' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: darkMode ? '#ffffff' : '#0f172a' }}>No Rate Cards Configured</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>Click "+ New Rate Card" above to set room prices for this hostel.</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: 16 }}>
                {structures.map(fs => (
                  <div key={fs.id} style={cardStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <span style={{
                            fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 6,
                            background: '#4f46e515', color: '#4f46e5'
                          }}>
                            {fs.sharing_type?.replace('_', ' ')}
                          </span>
                          <span style={{
                            fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 6,
                            background: fs.is_ac ? '#06b6d415' : '#64748b15',
                            color: fs.is_ac ? '#0891b2' : '#64748b'
                          }}>
                            {fs.is_ac ? '❄️ AC' : '🌿 Non-AC'}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 6, fontWeight: 600 }}>
                          🏢 {fs.building_name || 'All Buildings'} {fs.floor_id ? `· ${fs.floor_name}` : ''}
                        </div>
                      </div>

                      <span style={{
                        fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 20,
                        background: fs.status === 'ACTIVE' ? '#f0fdf4' : '#fef2f2',
                        color: fs.status === 'ACTIVE' ? '#16a34a' : '#dc2626',
                        border: `1px solid ${fs.status === 'ACTIVE' ? '#bbf7d0' : '#fecaca'}`
                      }}>
                        {fs.status}
                      </span>
                    </div>

                    <div style={{
                      background: darkMode ? '#0f172a' : '#f8fafc',
                      borderRadius: 10, padding: '12px 14px', marginBottom: 14,
                      border: `1px solid ${darkMode ? '#334155' : '#f1f5f9'}`
                    }}>
                      <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>TOTAL MONTHLY FEE</div>
                      <div style={{ fontSize: 24, fontWeight: 900, color: '#4f46e5', marginTop: 2 }}>
                        ₹{fs.total_monthly?.toLocaleString('en-IN')}
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', marginLeft: 4 }}>/ month</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#16a34a', marginTop: 4, fontWeight: 600 }}>
                        ✓ Central Head: <strong>HOSTEL</strong>
                      </div>
                    </div>

                    {/* Breakdown Chips */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: darkMode ? '#334155' : '#f1f5f9', color: '#64748b' }}>
                        Rent: ₹{fs.monthly_fee}
                      </span>
                      {fs.mess_charges > 0 && (
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: darkMode ? '#334155' : '#f1f5f9', color: '#64748b' }}>
                          Mess: ₹{fs.mess_charges}
                        </span>
                      )}
                      {fs.electricity_charges > 0 && (
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: darkMode ? '#334155' : '#f1f5f9', color: '#64748b' }}>
                          Power: ₹{fs.electricity_charges}
                        </span>
                      )}
                      {fs.laundry_charges > 0 && (
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: darkMode ? '#334155' : '#f1f5f9', color: '#64748b' }}>
                          Laundry: ₹{fs.laundry_charges}
                        </span>
                      )}
                      {fs.maintenance_charges > 0 && (
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: darkMode ? '#334155' : '#f1f5f9', color: '#64748b' }}>
                          Maint: ₹{fs.maintenance_charges}
                        </span>
                      )}
                      {fs.security_deposit > 0 && (
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: '#fffbeb', color: '#b45309' }}>
                          Deposit: ₹{fs.security_deposit}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => openEdit(fs)}
                        style={{
                          flex: 1, background: darkMode ? '#334155' : '#f1f5f9',
                          color: darkMode ? '#f1f5f9' : '#334155', border: 'none',
                          borderRadius: 8, padding: '8px 0', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        }}
                      >
                        Edit Rate
                      </button>
                      <button
                        onClick={() => handleDelete(fs.id)}
                        style={{
                          flex: 1, background: '#fef2f2', color: '#dc2626', border: '1px solid #fee2e2',
                          borderRadius: 8, padding: '8px 0', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        }}
                      >
                        Delete / Archive
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {/* ══ Tab 2: Resident Students Overview ══ */}
          {activeTab === 'residents' && (
            <>
              <div style={{ marginBottom: 14, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <input
                  placeholder="Search resident student or admission no..."
                  value={studentSearch}
                  onChange={e => setStudentSearch(e.target.value)}
                  style={{
                    padding: '9px 14px', fontSize: 13, borderRadius: 8, width: 300,
                    border: `1px solid ${darkMode ? '#334155' : '#cbd5e1'}`, background: darkMode ? '#1e293b' : '#fff',
                    color: darkMode ? '#f1f5f9' : '#0f172a',
                  }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  {selectedStudentIds.length > 0 && (
                    <button onClick={openFineBulk} style={{
                      background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8,
                      padding: '9px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    }}>
                      ⚠ Raise Fine — {selectedStudentIds.length} Selected
                    </button>
                  )}
                  <button
                    onClick={() => navigate('/hostel/fees')}
                    style={{
                      background: '#4f46e5', color: '#ffffff', border: 'none', borderRadius: 8,
                      padding: '9px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer'
                    }}
                  >
                    Open Full Billing Ledger ↗
                  </button>
                </div>
              </div>

              {studentsLoading ? (
                <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>Loading Residents...</div>
              ) : students.length === 0 ? (
                <div style={{ ...cardStyle, textAlign: 'center', padding: 50, color: '#94a3b8' }}>
                  No resident students allocated to this hostel.
                </div>
              ) : (
                <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: darkMode ? '#0f172a' : '#f8fafc', textAlign: 'left' }}>
                        <th style={{ padding: '12px 14px', width: 30 }}>
                          <input
                            type="checkbox"
                            checked={students.length > 0 && selectedStudentIds.length === students.length}
                            onChange={toggleSelectAll}
                          />
                        </th>
                        {['Student', 'Class', 'Room / Bed', 'Total Due', 'Paid', 'Status', 'Actions'].map(h => (
                          <th key={h} style={{ padding: '12px 14px', fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {students.map(s => (
                        <tr key={s.allocation_id} style={{ borderTop: `1px solid ${darkMode ? '#334155' : '#f1f5f9'}` }}>
                          <td style={{ padding: '12px 14px' }}>
                            <input
                              type="checkbox"
                              checked={selectedStudentIds.includes(s.allocation_id)}
                              onChange={() => toggleStudentSelect(s.allocation_id)}
                            />
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ fontWeight: 700, color: darkMode ? '#f1f5f9' : '#0f172a' }}>{s.student_name}</div>
                            <div style={{ fontSize: 11, color: '#94a3b8' }}>Adm: {s.admission_no}</div>
                          </td>
                          <td style={{ padding: '12px 14px', color: '#64748b' }}>{s.class_name}</td>
                          <td style={{ padding: '12px 14px', color: '#64748b' }}>
                            {s.building_name} · Room {s.room_number}{s.bed_number ? ` (Bed ${s.bed_number})` : ''}
                          </td>
                          <td style={{ padding: '12px 14px', fontWeight: 700 }}>₹{s.total_due?.toLocaleString('en-IN') || 0}</td>
                          <td style={{ padding: '12px 14px', color: '#16a34a', fontWeight: 600 }}>₹{s.total_paid?.toLocaleString('en-IN') || 0}</td>
                          <td style={{ padding: '12px 14px' }}>
                            <span style={{
                              fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 20,
                              background: s.fee_status === 'PAID' ? '#f0fdf4' : s.fee_status === 'PARTIAL' ? '#fffbeb' : '#fef2f2',
                              color:      s.fee_status === 'PAID' ? '#16a34a' : s.fee_status === 'PARTIAL' ? '#d97706' : '#dc2626',
                            }}>
                              {s.fee_status || 'PENDING'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px', display: 'flex', gap: 6 }}>
                            {s.pending > 0 && (
                              <button
                                onClick={() => openCollect(s)}
                                style={{
                                  background: '#4f46e5', color: '#fff', border: 'none',
                                  borderRadius: 6, padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                                }}
                              >
                                Collect Fee
                              </button>
                            )}
                            <button
                              onClick={() => navigate(`/finance/ledger?student_id=${s.student_id}`)}
                              style={{
                                background: darkMode ? '#334155' : '#f1f5f9', color: darkMode ? '#cbd5e1' : '#475569',
                                border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                              }}
                            >
                              Ledger ↗
                            </button>
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

      {/* ══ Create / Edit Rate Card Modal ══ */}
      {showModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 540, background: darkMode ? '#1e293b' : '#fff' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: darkMode ? '#f1f5f9' : '#0f172a' }}>
                {editingId ? 'Edit Rate Card' : 'Create Hostel Rate Card'}
              </h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>

            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              <div style={{
                background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8,
                padding: '10px 14px', fontSize: 12, color: '#1e40af', marginBottom: 14
              }}>
                ℹ️ Rate cards define automatic monthly dues for room allocations and sync directly to Central Finance under Fee Head <strong>HOSTEL</strong>.
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Hostel *</label>
                  <select
                    style={inputStyle}
                    value={form.hostel_id}
                    disabled={!!editingId}
                    onChange={e => {
                      const hid = e.target.value;
                      setForm({ ...form, hostel_id: hid, building_id: '', floor_id: '' });
                      setBuildings([]);
                      setFloors([]);
                      if (hid) api.get(`/hostel/hostels/${hid}/buildings`).then(r => setBuildings(r.data || []));
                    }}
                  >
                    <option value="">Select Hostel</option>
                    {hostels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Building (Optional)</label>
                  <select
                    style={inputStyle}
                    value={form.building_id}
                    disabled={!!editingId}
                    onChange={e => handleBuildingChange(e.target.value)}
                  >
                    <option value="">All Buildings</option>
                    {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Floor (Optional)</label>
                  <select
                    style={inputStyle}
                    value={form.floor_id}
                    disabled={!!editingId}
                    onChange={e => setForm({ ...form, floor_id: e.target.value })}
                  >
                    <option value="">All Floors</option>
                    {floors.map(fl => <option key={fl.id} value={fl.id}>{fl.name || `Floor ${fl.floor_number}`}</option>)}
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Room AC Tier</label>
                  <select
                    style={inputStyle}
                    value={form.is_ac ? 'AC' : 'NON_AC'}
                    onChange={e => setForm({ ...form, is_ac: e.target.value === 'AC' })}
                    disabled={!!editingId}
                  >
                    <option value="NON_AC">🌿 Non-AC Room</option>
                    <option value="AC">❄️ AC Room</option>
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Sharing Type *</label>
                  <select
                    style={inputStyle}
                    value={form.sharing_type}
                    disabled={!!editingId}
                    onChange={e => setForm({ ...form, sharing_type: e.target.value })}
                  >
                    {SHARING_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Monthly Base Rent (₹) *</label>
                  <input
                    type="number"
                    style={inputStyle}
                    placeholder="e.g. 5000"
                    value={form.monthly_fee}
                    onChange={e => setForm({ ...form, monthly_fee: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ fontSize: 12, fontWeight: 800, color: '#64748b', margin: '14px 0 8px', textTransform: 'uppercase' }}>
                Additional Fee Components (Optional)
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={labelStyle}>Mess / Meal Charges (₹)</label>
                  <input
                    type="number"
                    style={inputStyle}
                    placeholder="0"
                    value={form.mess_charges}
                    onChange={e => setForm({ ...form, mess_charges: e.target.value })}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Electricity Charges (₹)</label>
                  <input
                    type="number"
                    style={inputStyle}
                    placeholder="0"
                    value={form.electricity_charges}
                    onChange={e => setForm({ ...form, electricity_charges: e.target.value })}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Laundry Charges (₹)</label>
                  <input
                    type="number"
                    style={inputStyle}
                    placeholder="0"
                    value={form.laundry_charges}
                    onChange={e => setForm({ ...form, laundry_charges: e.target.value })}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Maintenance Charges (₹)</label>
                  <input
                    type="number"
                    style={inputStyle}
                    placeholder="0"
                    value={form.maintenance_charges}
                    onChange={e => setForm({ ...form, maintenance_charges: e.target.value })}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Security Deposit (₹)</label>
                  <input
                    type="number"
                    style={inputStyle}
                    placeholder="0"
                    value={form.security_deposit}
                    onChange={e => setForm({ ...form, security_deposit: e.target.value })}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Monthly Concession / Discount (₹)</label>
                  <input
                    type="number"
                    style={inputStyle}
                    placeholder="0"
                    value={form.discount}
                    onChange={e => setForm({ ...form, discount: e.target.value })}
                  />
                </div>
              </div>

              {/* Dynamic Live Calculated Total */}
              <div style={{
                background: darkMode ? '#0f172a' : '#f1f5f9',
                border: `1px solid ${darkMode ? '#334155' : '#cbd5e1'}`,
                borderRadius: 10, padding: '12px 16px', marginTop: 12,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total Monthly Demand Rate:</div>
                  <div style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>Will post to Central Finance under HOSTEL</div>
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#4f46e5' }}>
                  ₹{modalMonthlyTotal.toLocaleString('en-IN')}<span style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8' }}>/mo</span>
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ borderTop: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, padding: '14px 20px' }}>
              <button className="btn btn-neutral" onClick={() => setShowModal(false)}>Cancel</button>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8,
                  padding: '9px 24px', fontSize: 13, fontWeight: 800, cursor: saving ? 'not-allowed' : 'pointer',
                }}
              >
                {saving ? 'Saving...' : editingId ? 'Update Rate Card' : 'Save & Sync Rate Card'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Collect Fee Modal ══ */}
      {collectModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setCollectModal(null)}>
          <div className="modal" style={{ maxWidth: 420, background: darkMode ? '#1e293b' : '#fff' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: darkMode ? '#f1f5f9' : '#0f172a' }}>
                Collect Hostel Fee
              </h3>
              <button className="modal-close" onClick={() => setCollectModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{
                background: darkMode ? '#0f172a' : '#f8fafc',
                border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
                borderRadius: 10, padding: '12px 14px', marginBottom: 14
              }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a' }}>
                  {collectModal.student_name}
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                  Admission No: <strong>{collectModal.admission_no}</strong> · Outstanding: <strong style={{ color: '#dc2626' }}>₹{collectModal.pending?.toLocaleString('en-IN')}</strong>
                </div>
              </div>

              <div style={{
                background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8,
                padding: '8px 12px', fontSize: 11.5, color: '#166534', marginBottom: 14
              }}>
                ✓ This collection will automatically issue an official receipt <strong>REC-YYYY-XXXXXX</strong> and update Central Finance in real-time.
              </div>

              <label style={labelStyle}>Payment Amount (₹) *</label>
              <input
                type="number"
                style={inputStyle}
                value={collectAmount}
                onChange={e => setCollectAmount(e.target.value)}
                placeholder="Enter amount"
              />

              <label style={labelStyle}>Payment Mode</label>
              <select style={inputStyle} value={collectMode} onChange={e => setCollectMode(e.target.value)}>
                <option value="CASH">Cash</option>
                <option value="UPI">UPI</option>
                <option value="BANK_TRANSFER">Bank Transfer / NEFT</option>
                <option value="CHEQUE">Cheque</option>
              </select>
            </div>
            <div className="modal-footer" style={{ borderTop: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, padding: '14px 20px' }}>
              <button className="btn btn-neutral" onClick={() => setCollectModal(null)}>Cancel</button>
              <button
                onClick={handleCollect}
                disabled={collecting}
                style={{
                  background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8,
                  padding: '9px 24px', fontSize: 13, fontWeight: 800, cursor: collecting ? 'not-allowed' : 'pointer',
                }}
              >
                {collecting ? 'Processing...' : 'Confirm & Issue Receipt'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Raise Fine Modal ══ */}
      {fineModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setFineModal(null)}>
          <div className="modal" style={{ maxWidth: 420, background: darkMode ? '#1e293b' : '#fff' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: darkMode ? '#f1f5f9' : '#0f172a' }}>
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
                  This penalty will be billed to each of the <strong>{fineModal.students.length} selected students</strong>:
                  <div style={{ marginTop: 4, color: '#64748b' }}>
                    {fineModal.students.map(s => s.student_name).join(', ')}
                  </div>
                </div>
              )}

              <label style={labelStyle}>Reason *</label>
              <select style={inputStyle} value={fineReason} onChange={e => setFineReason(e.target.value)}>
                {FINE_REASONS.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
              </select>

              <label style={labelStyle}>Description (Optional)</label>
              <input
                style={inputStyle}
                value={fineDescription}
                onChange={e => setFineDescription(e.target.value)}
                placeholder="e.g. Room damage or noise violation"
              />

              <label style={labelStyle}>Fine Amount (₹) *</label>
              <input
                type="number"
                style={inputStyle}
                value={fineAmount}
                onChange={e => setFineAmount(e.target.value)}
                placeholder="e.g. 200"
              />
            </div>
            <div className="modal-footer" style={{ borderTop: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, padding: '14px 20px' }}>
              <button className="btn btn-neutral" onClick={() => setFineModal(null)}>Cancel</button>
              <button
                onClick={handleRaiseFine}
                disabled={raisingFine}
                style={{
                  background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8,
                  padding: '9px 24px', fontSize: 13, fontWeight: 800, cursor: raisingFine ? 'not-allowed' : 'pointer',
                }}
              >
                {raisingFine ? 'Posting...' : 'Post Fine to Central Ledger'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
