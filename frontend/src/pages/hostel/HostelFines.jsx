import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api     from '../../api/axios';
import toast   from 'react-hot-toast';

export default function HostelFines() {
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('ederp_theme') === 'dark');
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
      setFines(res.data);
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
      setStudents(res.data);
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

  return (
    <div className={`app-shell${darkMode ? ' theme-dark' : ''}`}>
      <Sidebar darkMode={darkMode} />
      <div className="main-content">
        <Navbar title="Hostel Fines &amp; Penalties" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />

        <div className="page-body">
          {/* Header */}
          <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
            <div>
              <h2 className="fw-bold mb-1" style={{ color: darkMode ? '#f8fafc' : '#1e293b' }}>Hostel Fines &amp; Damage Ledger</h2>
              <p className="text-muted mb-0">Assess room damage, rule violation penalties, collect payments, and manage waivers.</p>
            </div>
            <button
              className="btn btn-danger d-flex align-items-center gap-2"
              onClick={() => {
                setSelectedStudent(null);
                setStudents([]);
                setStudentSearch('');
                setCreateModal(true);
              }}
              style={{ borderRadius: '10px', padding: '10px 18px', fontWeight: 600 }}
            >
              <i className="ti ti-plus fs-5"></i>
              Assess New Fine
            </button>
          </div>

          {/* Filter Bar */}
          <div className="card border-0 shadow-sm p-3 mb-4" style={{ borderRadius: '16px', background: darkMode ? '#1e293b' : '#ffffff' }}>
            <div className="d-flex gap-2 align-items-center">
              <span className="text-muted small fw-semibold me-2">STATUS FILTER:</span>
              {['ALL', 'OUTSTANDING', 'PARTIALLY_PAID', 'PAID', 'WAIVED'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`btn btn-sm px-3 fw-semibold ${statusFilter === st ? 'btn-primary' : 'btn-outline-secondary'}`}
                  style={{ borderRadius: '8px' }}
                >
                  {st.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Fines Table */}
          <div className="card border-0 shadow-sm" style={{ borderRadius: '16px', background: darkMode ? '#1e293b' : '#ffffff', overflow: 'hidden' }}>
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead style={{ background: darkMode ? '#0f172a' : '#f8fafc', color: darkMode ? '#cbd5e1' : '#64748b' }}>
                  <tr>
                    <th className="py-3 px-4">Resident</th>
                    <th className="py-3">Violation Reason</th>
                    <th className="py-3">Raised Date</th>
                    <th className="py-3 text-end">Amount</th>
                    <th className="py-3 text-end">Paid</th>
                    <th className="py-3 text-end">Waived</th>
                    <th className="py-3 text-end">Outstanding</th>
                    <th className="py-3 text-center">Status</th>
                    <th className="py-3 text-end px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="9" className="text-center py-5 text-muted">
                        <div className="spinner-border spinner-border-sm me-2 text-primary" role="status"></div>
                        Loading hostel fines...
                      </td>
                    </tr>
                  ) : fines.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="text-center py-5 text-muted">
                        <i className="ti ti-check-circle fs-1 d-block mb-2 text-success opacity-50"></i>
                        No fine records found.
                      </td>
                    </tr>
                  ) : (
                    fines.map((f) => (
                      <tr key={f.id}>
                        <td className="px-4">
                          <div className="fw-bold" style={{ color: darkMode ? '#f8fafc' : '#0f172a' }}>{f.student_name}</div>
                          <small className="text-muted">{f.hostel_name}</small>
                        </td>
                        <td>
                          <span className="badge bg-secondary-subtle text-secondary border px-2 py-1 mb-1 d-inline-block">
                            {f.reason.replace('_', ' ')}
                          </span>
                          <div className="small text-muted text-truncate" style={{ maxWidth: '220px' }}>{f.description || '—'}</div>
                        </td>
                        <td>{f.raised_date}</td>
                        <td className="text-end fw-semibold">₹{f.amount}</td>
                        <td className="text-end text-success fw-semibold">₹{f.amount_paid}</td>
                        <td className="text-end text-muted fw-semibold">₹{f.waived_amount}</td>
                        <td className="text-end fw-bold" style={{ color: f.outstanding_amount > 0 ? '#ef4444' : '#10b981' }}>
                          ₹{f.outstanding_amount}
                        </td>
                        <td className="text-center">
                          {f.status === 'PAID' ? (
                            <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1">PAID</span>
                          ) : f.status === 'WAIVED' ? (
                            <span className="badge bg-secondary-subtle text-secondary border px-2 py-1">WAIVED</span>
                          ) : f.status === 'PARTIALLY_PAID' ? (
                            <span className="badge bg-warning-subtle text-warning border border-warning-subtle px-2 py-1">PARTIAL</span>
                          ) : (
                            <span className="badge bg-danger-subtle text-danger border border-danger-subtle px-2 py-1">OUTSTANDING</span>
                          )}
                        </td>
                        <td className="text-end px-4">
                          {f.outstanding_amount > 0 ? (
                            <div className="d-flex gap-2 justify-content-end">
                              <button
                                className="btn btn-sm btn-success px-2 py-1 fw-semibold"
                                style={{ borderRadius: '6px' }}
                                onClick={() => openCollect(f)}
                              >
                                Pay
                              </button>
                              <button
                                className="btn btn-sm btn-outline-warning px-2 py-1 fw-semibold"
                                style={{ borderRadius: '6px' }}
                                onClick={() => openWaive(f)}
                              >
                                Waive
                              </button>
                            </div>
                          ) : (
                            <span className="text-muted small">Settled</span>
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
        <div className="modal show d-block" tabIndex="-1" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <form onSubmit={handleCreateFine} className="modal-content" style={{ borderRadius: '16px', background: darkMode ? '#1e293b' : '#ffffff', color: darkMode ? '#fff' : '#000' }}>
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold">Assess Hostel Fine / Penalty</h5>
                <button type="button" className="btn-close" onClick={() => setCreateModal(false)}></button>
              </div>
              <div className="modal-body py-3">
                {/* Search Student */}
                <div className="mb-3">
                  <label className="form-label fw-semibold">Select Resident</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Search resident by name or admission no..."
                    value={studentSearch}
                    onChange={(e) => searchStudents(e.target.value)}
                  />
                  {students.length > 0 && !selectedStudent && (
                    <div className="list-group mt-2 border" style={{ maxHeight: '150px', overflowY: 'auto' }}>
                      {students.map((st) => (
                        <button
                          key={st.student_id}
                          type="button"
                          className="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
                          onClick={() => {
                            setSelectedStudent(st);
                            setStudents([]);
                            setStudentSearch(st.student_name);
                          }}
                        >
                          <div>
                            <div className="fw-semibold">{st.student_name}</div>
                            <small className="text-muted">{st.admission_no} &bull; Room {st.room_number}</small>
                          </div>
                          <span className="badge bg-primary">Select</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {selectedStudent && (
                    <div className="alert alert-info py-2 px-3 mt-2 d-flex justify-content-between align-items-center mb-0">
                      <div>
                        <strong>{selectedStudent.student_name}</strong> ({selectedStudent.admission_no}) &bull; Room {selectedStudent.room_number}
                      </div>
                      <button type="button" className="btn btn-sm btn-link text-danger p-0" onClick={() => setSelectedStudent(null)}>Change</button>
                    </div>
                  )}
                </div>

                <div className="row g-2 mb-3">
                  <div className="col-md-6">
                    <label className="form-label fw-semibold">Violation Reason</label>
                    <select
                      className="form-select"
                      value={fineReason}
                      onChange={(e) => setFineReason(e.target.value)}
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
                  <div className="col-md-6">
                    <label className="form-label fw-semibold">Fine Amount (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control fw-bold"
                      placeholder="e.g. 500"
                      value={fineAmount}
                      onChange={(e) => setFineAmount(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold">Description / Remarks</label>
                  <textarea
                    rows="3"
                    className="form-control"
                    placeholder="Specific item damaged, date of occurrence, or warden notes..."
                    value={fineDesc}
                    onChange={(e) => setFineDesc(e.target.value)}
                  ></textarea>
                </div>
              </div>
              <div className="modal-footer border-0 pt-0">
                <button type="button" className="btn btn-light" onClick={() => setCreateModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-danger px-4 fw-semibold" disabled={creating}>
                  {creating ? 'Assessing...' : 'Confirm Assessment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Waive Modal */}
      {waiveModal && selectedFine && (
        <div className="modal show d-block" tabIndex="-1" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <form onSubmit={handleWaiveSubmit} className="modal-content" style={{ borderRadius: '16px', background: darkMode ? '#1e293b' : '#ffffff', color: darkMode ? '#fff' : '#000' }}>
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold">Waive Fine</h5>
                <button type="button" className="btn-close" onClick={() => setWaiveModal(false)}></button>
              </div>
              <div className="modal-body py-3">
                <p className="text-muted small">
                  Waiving a fine adjusts the outstanding obligation with an auditable justification record.
                </p>
                <div className="mb-3">
                  <label className="form-label fw-semibold">Waive Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    max={selectedFine.outstanding_amount}
                    className="form-control fw-bold"
                    value={waiveAmount}
                    onChange={(e) => setWaiveAmount(e.target.value)}
                    required
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-semibold">Waiver Justification Reason *</label>
                  <textarea
                    rows="3"
                    className="form-control"
                    placeholder="Approved by Principal / First warning / Repair cost adjusted..."
                    value={waiveReason}
                    onChange={(e) => setWaiveReason(e.target.value)}
                    required
                  ></textarea>
                </div>
              </div>
              <div className="modal-footer border-0 pt-0">
                <button type="button" className="btn btn-light" onClick={() => setWaiveModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-warning px-4 fw-semibold" disabled={waiving}>
                  {waiving ? 'Waiving...' : 'Confirm Waiver'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Collect Modal */}
      {collectModal && selectedFine && (
        <div className="modal show d-block" tabIndex="-1" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <form onSubmit={handleCollectSubmit} className="modal-content" style={{ borderRadius: '16px', background: darkMode ? '#1e293b' : '#ffffff', color: darkMode ? '#fff' : '#000' }}>
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold">Collect Fine Payment</h5>
                <button type="button" className="btn-close" onClick={() => setCollectModal(false)}></button>
              </div>
              <div className="modal-body py-3">
                <div className="p-3 mb-3 rounded-3" style={{ background: darkMode ? '#0f172a' : '#f1f5f9' }}>
                  <div className="fw-bold">{selectedFine.student_name}</div>
                  <div className="small text-muted">{selectedFine.reason.replace('_', ' ')} &bull; Total: ₹{selectedFine.amount}</div>
                  <div className="fw-bold text-danger mt-1">Outstanding: ₹{selectedFine.outstanding_amount}</div>
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold">Amount to Collect (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    max={selectedFine.outstanding_amount}
                    className="form-control fw-bold text-success"
                    value={collectAmount}
                    onChange={(e) => setCollectAmount(e.target.value)}
                    required
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold">Payment Mode</label>
                  <select
                    className="form-select"
                    value={collectMode}
                    onChange={(e) => setCollectMode(e.target.value)}
                  >
                    <option value="CASH">Cash</option>
                    <option value="UPI">UPI / Online</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                  </select>
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold">Remarks</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Optional remarks..."
                    value={collectRemarks}
                    onChange={(e) => setCollectRemarks(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer border-0 pt-0">
                <button type="button" className="btn btn-light" onClick={() => setCollectModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-success px-4 fw-semibold" disabled={collecting}>
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
