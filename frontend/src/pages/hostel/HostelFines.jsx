import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api     from '../../api/axios';
import toast   from 'react-hot-toast';

export default function HostelFines() {
  const [darkMode, setDarkMode] = useState(localStorage.getItem('ederp_theme') === 'dark');
  const [loading, setLoading]   = useState(true);
  const [fines, setFines]       = useState([]);
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals
  const [createModal, setCreateModal] = useState(false);
  const [students, setStudents]       = useState([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [fineReason, setFineReason]   = useState('FURNITURE_DAMAGE');
  const [fineAmount, setFineAmount]   = useState('');
  const [fineDesc, setFineDesc]       = useState('');
  const [creating, setCreating]       = useState(false);

  const [waiveModal, setWaiveModal]   = useState(false);
  const [selectedFine, setSelectedFine] = useState(null);
  const [waiveAmount, setWaiveAmount] = useState('');
  const [waiveReason, setWaiveReason] = useState('');
  const [waiving, setWaiving]         = useState(false);

  const [collectModal, setCollectModal] = useState(false);
  const [collectAmount, setCollectAmount] = useState('');
  const [collectMode, setCollectMode]   = useState('CASH');
  const [collectRemarks, setCollectRemarks] = useState('');
  const [collecting, setCollecting]   = useState(false);

  const fetchFines = async () => {
    try {
      setLoading(true);
      const res = await api.get('/hostel/fines', { params: { status: statusFilter } });
      setFines(res.data || []);
    } catch (err) {
      toast.error('Failed to load hostel fine records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFines();
  }, [statusFilter]);

  const searchStudents = async (query) => {
    setStudentSearch(query);
    if (query.trim().length < 2) return;
    try {
      const res = await api.get('/hostel/admissions', { params: { search: query } });
      setStudents(res.data || []);
    } catch (err) {
      // ignore
    }
  };

  const handleCreateFine = async (e) => {
    e.preventDefault();
    if (!selectedStudent) {
      toast.error('Please select an active hostel resident');
      return;
    }
    if (!fineAmount || parseFloat(fineAmount) <= 0) {
      toast.error('Please enter a valid fine amount');
      return;
    }
    try {
      setCreating(true);
      await api.post('/hostel/fines', {
        student_id: selectedStudent.student_id,
        reason: fineReason,
        amount: parseFloat(fineAmount),
        description: fineDesc,
      });
      toast.success('Fine assessment recorded and linked to Fee Management');
      setCreateModal(false);
      setSelectedStudent(null);
      setFineAmount('');
      setFineDesc('');
      fetchFines();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to raise fine');
    } finally {
      setCreating(false);
    }
  };

  const openWaive = (fine) => {
    setSelectedFine(fine);
    setWaiveAmount(fine.outstanding_amount);
    setWaiveReason('');
    setWaiveModal(true);
  };

  const handleWaiveSubmit = async (e) => {
    e.preventDefault();
    if (!waiveReason.trim()) {
      toast.error('Waiver reason is required');
      return;
    }
    try {
      setWaiving(true);
      await api.post(`/hostel/fines/${selectedFine.id}/waive`, {
        waived_amount: parseFloat(waiveAmount),
        reason: waiveReason,
      });
      toast.success('Fine waived successfully');
      setWaiveModal(false);
      fetchFines();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Waiver failed');
    } finally {
      setWaiving(false);
    }
  };

  const openCollect = (fine) => {
    setSelectedFine(fine);
    setCollectAmount(fine.outstanding_amount);
    setCollectMode('CASH');
    setCollectRemarks('');
    setCollectModal(true);
  };

  const handleCollectSubmit = async (e) => {
    e.preventDefault();
    try {
      setCollecting(true);
      await api.post(`/hostel/fines/${selectedFine.id}/collect`, {
        amount: parseFloat(collectAmount),
        payment_mode: collectMode,
        remarks: collectRemarks,
      });
      toast.success('Fine payment recorded and synchronized!');
      setCollectModal(false);
      fetchFines();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Collection failed');
    } finally {
      setCollecting(false);
    }
  };

  const cardStyle = {
    background: darkMode ? '#1e293b' : '#fff',
    border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
    borderRadius: 12, padding: 20,
  };
  const inputStyle = {
    width: '100%', padding: '9px 12px', fontSize: 13,
    border: `1px solid ${darkMode ? '#334155' : '#cbd5e1'}`, borderRadius: 8, outline: 'none', boxSizing: 'border-box',
    background: darkMode ? '#0f172a' : '#ffffff', color: darkMode ? '#ffffff' : '#0f172a',
    marginBottom: 12,
  };
  const labelStyle = { fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4, display: 'block' };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: darkMode ? '#0f172a' : '#f8fafc' }}>
      <Sidebar darkMode={darkMode} />
      <div style={{ marginLeft: 232, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Navbar title="Hostel Fines &amp; Penalties" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />

        <div style={{ padding: '24px 28px' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: darkMode ? '#f8fafc' : '#0f172a' }}>
                Hostel Fines &amp; Damage Ledger
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
                Assess room property damages, curfew violations, record payments, and manage auditable waivers.
              </p>
            </div>
            <button
              onClick={() => {
                setSelectedStudent(null);
                setStudents([]);
                setStudentSearch('');
                setCreateModal(true);
              }}
              style={{
                background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8,
                padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
                boxShadow: '0 4px 12px rgba(220, 38, 38, 0.25)'
              }}
            >
              <i className="ti ti-plus" style={{ fontSize: 16 }}></i>
              Assess New Fine
            </button>
          </div>

          {/* Filter Bar */}
          <div style={{ ...cardStyle, padding: 14, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ ...labelStyle, marginBottom: 0, fontSize: 12, marginRight: 6 }}>STATUS:</span>
            {['ALL', 'OUTSTANDING', 'PARTIALLY_PAID', 'PAID', 'WAIVED'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                style={{
                  padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  border: statusFilter === st ? 'none' : `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
                  background: statusFilter === st ? '#4f46e5' : (darkMode ? '#1e293b' : '#fff'),
                  color: statusFilter === st ? '#fff' : (darkMode ? '#94a3b8' : '#64748b'),
                }}
              >
                {st.replace('_', ' ')}
              </button>
            ))}
          </div>

          {/* Fines Table Card */}
          <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: darkMode ? '#0f172a' : '#f8fafc', borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, textAlign: 'left' }}>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>RESIDENT</th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>VIOLATION REASON</th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>RAISED DATE</th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 600, fontSize: 11, textAlign: 'right' }}>AMOUNT (₹)</th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 600, fontSize: 11, textAlign: 'right' }}>PAID (₹)</th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 600, fontSize: 11, textAlign: 'right' }}>WAIVED (₹)</th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 600, fontSize: 11, textAlign: 'right' }}>OUTSTANDING</th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 600, fontSize: 11, textAlign: 'center' }}>STATUS</th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 600, fontSize: 11, textAlign: 'right' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="9" style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
                        Loading fines...
                      </td>
                    </tr>
                  ) : fines.length === 0 ? (
                    <tr>
                      <td colSpan="9" style={{ textAlign: 'center', padding: '50px 0', color: '#94a3b8' }}>
                        <i className="ti ti-check-circle" style={{ fontSize: 36, display: 'block', marginBottom: 8, color: '#16a34a', opacity: 0.6 }}></i>
                        No fine records found.
                      </td>
                    </tr>
                  ) : (
                    fines.map((f) => (
                      <tr key={f.id} style={{ borderBottom: `1px solid ${darkMode ? '#334155' : '#f1f5f9'}` }}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 700, color: darkMode ? '#f8fafc' : '#0f172a' }}>{f.student_name}</div>
                          <div style={{ fontSize: 11, color: '#94a3b8' }}>{f.hostel_name}</div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            background: darkMode ? '#334155' : '#f1f5f9', color: darkMode ? '#cbd5e1' : '#475569',
                            padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700
                          }}>
                            {f.reason.replace('_', ' ')}
                          </span>
                          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, maxWidth: 220 }} className="truncate">
                            {f.description || '—'}
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px', color: '#64748b', fontSize: 12 }}>{f.raised_date}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>₹{f.amount}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: '#16a34a' }}>₹{f.amount_paid}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: '#64748b' }}>₹{f.waived_amount}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: f.outstanding_amount > 0 ? '#dc2626' : '#16a34a' }}>
                          ₹{f.outstanding_amount}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <span style={{
                            background: f.status === 'PAID' ? '#f0fdf4' :
                                        f.status === 'WAIVED' ? '#eff6ff' :
                                        f.status === 'PARTIALLY_PAID' ? '#fefce8' : '#fef2f2',
                            color: f.status === 'PAID' ? '#16a34a' :
                                   f.status === 'WAIVED' ? '#2563eb' :
                                   f.status === 'PARTIALLY_PAID' ? '#ca8a04' : '#dc2626',
                            border: `1px solid ${
                              f.status === 'PAID' ? '#bbf7d0' :
                              f.status === 'WAIVED' ? '#bfdbfe' :
                              f.status === 'PARTIALLY_PAID' ? '#fef08a' : '#fecaca'
                            }`,
                            padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700
                          }}>
                            {f.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          {f.outstanding_amount > 0 ? (
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                              <button
                                onClick={() => openCollect(f)}
                                style={{
                                  background: '#16a34a', color: '#fff', border: 'none',
                                  padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer'
                                }}
                              >
                                Pay
                              </button>
                              <button
                                onClick={() => openWaive(f)}
                                style={{
                                  background: '#fefce8', color: '#ca8a04', border: '1px solid #fef08a',
                                  padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer'
                                }}
                              >
                                Waive
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>Settled</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Assess Fine Modal */}
      {createModal && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setCreateModal(false)}>
          <div className="modal" style={{ maxWidth: 500, background: darkMode ? '#1e293b' : '#ffffff', color: darkMode ? '#ffffff' : '#0f172a' }}>
            <div className="modal-header" style={{ borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}` }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Assess Hostel Fine / Penalty</h3>
              <button className="modal-close" onClick={() => setCreateModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateFine}>
              <div className="modal-body">
                {/* Search resident */}
                <div style={{ marginBottom: 12 }}>
                  <label style={labelStyle}>Resident *</label>
                  <input
                    type="text"
                    placeholder="Search resident by name or admission no..."
                    value={studentSearch}
                    onChange={(e) => searchStudents(e.target.value)}
                    style={inputStyle}
                  />
                  {students.length > 0 && !selectedStudent && (
                    <div style={{
                      maxHeight: 140, overflowY: 'auto', border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
                      borderRadius: 8, background: darkMode ? '#0f172a' : '#fff', marginTop: -6, marginBottom: 10
                    }}>
                      {students.map((st) => (
                        <div
                          key={st.student_id}
                          onClick={() => {
                            setSelectedStudent(st);
                            setStudents([]);
                            setStudentSearch(st.student_name);
                          }}
                          style={{
                            padding: '8px 12px', borderBottom: `1px solid ${darkMode ? '#1e293b' : '#f1f5f9'}`,
                            cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 12 }}>{st.student_name}</div>
                            <div style={{ fontSize: 11, color: '#94a3b8' }}>{st.admission_no} &bull; Room {st.room_number}</div>
                          </div>
                          <span style={{ fontSize: 11, color: '#4f46e5', fontWeight: 700 }}>Select</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {selectedStudent && (
                    <div style={{
                      background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8,
                      padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: -6, marginBottom: 10
                    }}>
                      <div style={{ fontSize: 12, color: '#1e40af' }}>
                        <strong>{selectedStudent.student_name}</strong> ({selectedStudent.admission_no}) &bull; Room {selectedStudent.room_number}
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedStudent(null)}
                        style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                      >
                        Change
                      </button>
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Violation Reason</label>
                    <select
                      value={fineReason}
                      onChange={(e) => setFineReason(e.target.value)}
                      style={inputStyle}
                    >
                      <option value="FURNITURE_DAMAGE">Furniture Damage</option>
                      <option value="PROPERTY_LOSS">Property Loss</option>
                      <option value="RULE_VIOLATION">Rule Violation</option>
                      <option value="ROOM_DAMAGE">Room Damage</option>
                      <option value="LATE_ENTRY">Late Entry</option>
                      <option value="CLEANLINESS">Cleanliness Issue</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Fine Amount (₹) *</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="e.g. 500"
                      value={fineAmount}
                      onChange={(e) => setFineAmount(e.target.value)}
                      style={{ ...inputStyle, fontWeight: 700 }}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Description / Assessment Remarks</label>
                  <textarea
                    rows="3"
                    placeholder="Specific item damaged, date of occurrence, or warden notes..."
                    value={fineDesc}
                    onChange={(e) => setFineDesc(e.target.value)}
                    style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
                  ></textarea>
                </div>
              </div>
              <div className="modal-footer" style={{ borderTop: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}` }}>
                <button type="button" className="btn btn-neutral" onClick={() => setCreateModal(false)}>Cancel</button>
                <button
                  type="submit"
                  disabled={creating}
                  style={{
                    background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6,
                    padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: creating ? 'not-allowed' : 'pointer',
                  }}
                >
                  {creating ? 'Assessing...' : 'Confirm Assessment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Waive Modal */}
      {waiveModal && selectedFine && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setWaiveModal(false)}>
          <div className="modal" style={{ maxWidth: 460, background: darkMode ? '#1e293b' : '#ffffff', color: darkMode ? '#ffffff' : '#0f172a' }}>
            <div className="modal-header" style={{ borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}` }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Waive Fine</h3>
              <button className="modal-close" onClick={() => setWaiveModal(false)}>✕</button>
            </div>
            <form onSubmit={handleWaiveSubmit}>
              <div className="modal-body">
                <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 12px' }}>
                  Waiving a fine adjusts the resident's balance with an auditable justification record.
                </p>

                <div>
                  <label style={labelStyle}>Waive Amount (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    max={selectedFine.outstanding_amount}
                    value={waiveAmount}
                    onChange={(e) => setWaiveAmount(e.target.value)}
                    style={{ ...inputStyle, fontWeight: 700, color: '#ca8a04' }}
                    required
                  />
                </div>

                <div>
                  <label style={labelStyle}>Waiver Justification Reason *</label>
                  <textarea
                    rows="3"
                    placeholder="Approved by Principal / First warning / Repair cost adjusted..."
                    value={waiveReason}
                    onChange={(e) => setWaiveReason(e.target.value)}
                    style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
                    required
                  ></textarea>
                </div>
              </div>
              <div className="modal-footer" style={{ borderTop: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}` }}>
                <button type="button" className="btn btn-neutral" onClick={() => setWaiveModal(false)}>Cancel</button>
                <button
                  type="submit"
                  disabled={waiving}
                  style={{
                    background: '#ca8a04', color: '#fff', border: 'none', borderRadius: 6,
                    padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: waiving ? 'not-allowed' : 'pointer',
                  }}
                >
                  {waiving ? 'Waiving...' : 'Confirm Waiver'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Collect Modal */}
      {collectModal && selectedFine && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setCollectModal(false)}>
          <div className="modal" style={{ maxWidth: 460, background: darkMode ? '#1e293b' : '#ffffff', color: darkMode ? '#ffffff' : '#0f172a' }}>
            <div className="modal-header" style={{ borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}` }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Collect Fine Payment</h3>
              <button className="modal-close" onClick={() => setCollectModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCollectSubmit}>
              <div className="modal-body">
                <div style={{
                  background: darkMode ? '#0f172a' : '#f8fafc', padding: 12, borderRadius: 8,
                  marginBottom: 14, border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`
                }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{selectedFine.student_name}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>
                    {selectedFine.reason.replace('_', ' ')} &bull; Total Fine: ₹{selectedFine.amount}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#dc2626', marginTop: 4 }}>
                    Outstanding: ₹{selectedFine.outstanding_amount}
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Amount to Collect (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    max={selectedFine.outstanding_amount}
                    value={collectAmount}
                    onChange={(e) => setCollectAmount(e.target.value)}
                    style={{ ...inputStyle, fontWeight: 700, fontSize: 15, color: '#16a34a' }}
                    required
                  />
                </div>

                <div>
                  <label style={labelStyle}>Payment Mode</label>
                  <select
                    value={collectMode}
                    onChange={(e) => setCollectMode(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="CASH">Cash</option>
                    <option value="UPI">UPI / Online</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Transaction Remarks</label>
                  <input
                    type="text"
                    placeholder="Optional remarks..."
                    value={collectRemarks}
                    onChange={(e) => setCollectRemarks(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>
              <div className="modal-footer" style={{ borderTop: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}` }}>
                <button type="button" className="btn btn-neutral" onClick={() => setCollectModal(false)}>Cancel</button>
                <button
                  type="submit"
                  disabled={collecting}
                  style={{
                    background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6,
                    padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: collecting ? 'not-allowed' : 'pointer',
                  }}
                >
                  {collecting ? 'Recording...' : `Collect ₹${collectAmount}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
