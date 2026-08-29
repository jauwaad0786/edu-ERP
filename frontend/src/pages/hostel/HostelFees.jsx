import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api     from '../../api/axios';
import toast   from 'react-hot-toast';

export default function HostelFees() {
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('ederp_theme') === 'dark');
  const [loading, setLoading]   = useState(true);
  const [dues, setDues]         = useState([]);
  const [search, setSearch]     = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [monthFilter, setMonthFilter]   = useState(new Date().toISOString().slice(0, 7));

  // Modals
  const [genModal, setGenModal]       = useState(false);
  const [genMonth, setGenMonth]       = useState(new Date().toISOString().slice(0, 7));
  const [generating, setGenerating]   = useState(false);

  const [collectModal, setCollectModal] = useState(false);
  const [selectedDue, setSelectedDue]   = useState(null);
  const [payAmount, setPayAmount]       = useState('');
  const [payMode, setPayMode]           = useState('CASH');
  const [payRemarks, setPayRemarks]     = useState('');
  const [submitting, setSubmitting]     = useState(false);

  const fetchDues = async () => {
    try {
      setLoading(true);
      const res = await api.get('/hostel/fees/dues', {
        params: { month: monthFilter, status: statusFilter, search }
      });
      setDues(res.data);
    } catch (err) {
      toast.error('Failed to load hostel fee records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDues();
  }, [monthFilter, statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchDues();
  };

  const handleGenerateMonthly = async () => {
    try {
      setGenerating(true);
      const res = await api.post('/hostel/fees/generate-monthly', { month: genMonth });
      toast.success(res.data.message || 'Hostel fees generated successfully');
      setGenModal(false);
      fetchDues();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to generate monthly fees');
    } finally {
      setGenerating(false);
    }
  };

  const openCollect = (due) => {
    setSelectedDue(due);
    setPayAmount(due.outstanding);
    setPayMode('CASH');
    setPayRemarks('');
    setCollectModal(true);
  };

  const handleCollectSubmit = async (e) => {
    e.preventDefault();
    if (!payAmount || parseFloat(payAmount) <= 0) {
      toast.error('Please enter a valid payment amount');
      return;
    }
    try {
      setSubmitting(true);
      await api.post('/hostel/fees/collect', {
        record_id: selectedDue.record_id,
        amount_paid: parseFloat(payAmount),
        payment_mode: payMode,
        remarks: payRemarks,
      });
      toast.success('Payment recorded successfully!');
      setCollectModal(false);
      fetchDues();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Payment failed');
    } finally {
      setSubmitting(false);
    }
  };

  const totalDueAmount = dues.reduce((acc, d) => acc + (d.amount_due || 0), 0);
  const totalPaidAmount = dues.reduce((acc, d) => acc + (d.amount_paid || 0), 0);
  const totalOutstanding = dues.reduce((acc, d) => acc + (d.outstanding || 0), 0);

  return (
    <div className={`app-shell${darkMode ? ' theme-dark' : ''}`}>
      <Sidebar darkMode={darkMode} />
      <div className="main-content">
        <Navbar title="Hostel Fees &amp; Billing Ledger" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />

        <div className="page-body">
          {/* Header Actions */}
          <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
            <div>
              <h2 className="fw-bold mb-1" style={{ color: darkMode ? '#f8fafc' : '#1e293b' }}>Hostel Fees &amp; Monthly Billing</h2>
              <p className="text-muted mb-0">Manage monthly room rentals, track dues, and record counter collections.</p>
            </div>
            <button
              className="btn btn-primary d-flex align-items-center gap-2"
              onClick={() => setGenModal(true)}
              style={{ borderRadius: '10px', padding: '10px 18px', fontWeight: 600 }}
            >
              <i className="ti ti-calendar-plus fs-5"></i>
              Generate Monthly Fees
            </button>
          </div>

          {/* Stats Overview */}
          <div className="row g-3 mb-4">
            <div className="col-md-4">
              <div className="card border-0 shadow-sm p-3" style={{ borderRadius: '16px', background: darkMode ? '#1e293b' : '#ffffff' }}>
                <div className="d-flex align-items-center justify-content-between">
                  <div>
                    <span className="text-muted small fw-semibold">TOTAL BILLED</span>
                    <h3 className="fw-bold mb-0 mt-1" style={{ color: '#6366f1' }}>₹{totalDueAmount.toLocaleString()}</h3>
                  </div>
                  <div className="p-3 rounded-circle" style={{ background: 'rgba(99, 102, 241, 0.12)', color: '#6366f1' }}>
                    <i className="ti ti-file-invoice fs-4"></i>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card border-0 shadow-sm p-3" style={{ borderRadius: '16px', background: darkMode ? '#1e293b' : '#ffffff' }}>
                <div className="d-flex align-items-center justify-content-between">
                  <div>
                    <span className="text-muted small fw-semibold">COLLECTED AMOUNT</span>
                    <h3 className="fw-bold mb-0 mt-1" style={{ color: '#10b981' }}>₹{totalPaidAmount.toLocaleString()}</h3>
                  </div>
                  <div className="p-3 rounded-circle" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}>
                    <i className="ti ti-circle-check fs-4"></i>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card border-0 shadow-sm p-3" style={{ borderRadius: '16px', background: darkMode ? '#1e293b' : '#ffffff' }}>
                <div className="d-flex align-items-center justify-content-between">
                  <div>
                    <span className="text-muted small fw-semibold">OUTSTANDING DUES</span>
                    <h3 className="fw-bold mb-0 mt-1" style={{ color: '#ef4444' }}>₹{totalOutstanding.toLocaleString()}</h3>
                  </div>
                  <div className="p-3 rounded-circle" style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444' }}>
                    <i className="ti ti-alert-circle fs-4"></i>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="card border-0 shadow-sm p-3 mb-4" style={{ borderRadius: '16px', background: darkMode ? '#1e293b' : '#ffffff' }}>
            <form onSubmit={handleSearchSubmit} className="row g-2 align-items-center">
              <div className="col-md-4">
                <div className="input-group">
                  <span className="input-group-text bg-transparent border-end-0">
                    <i className="ti ti-search text-muted"></i>
                  </span>
                  <input
                    type="text"
                    className="form-control border-start-0 ps-0"
                    placeholder="Search student or admission no..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="col-md-3">
                <input
                  type="month"
                  className="form-control"
                  value={monthFilter}
                  onChange={(e) => setMonthFilter(e.target.value)}
                />
              </div>
              <div className="col-md-3">
                <select
                  className="form-select"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PENDING">Pending / Partial</option>
                  <option value="PAID">Fully Paid</option>
                </select>
              </div>
              <div className="col-md-2 d-flex gap-2">
                <button type="submit" className="btn btn-secondary w-100" style={{ borderRadius: '8px' }}>
                  Filter
                </button>
              </div>
            </form>
          </div>

          {/* Dues Table */}
          <div className="card border-0 shadow-sm" style={{ borderRadius: '16px', background: darkMode ? '#1e293b' : '#ffffff', overflow: 'hidden' }}>
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead style={{ background: darkMode ? '#0f172a' : '#f8fafc', color: darkMode ? '#cbd5e1' : '#64748b' }}>
                  <tr>
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3">Hostel &amp; Room</th>
                    <th className="py-3">Billing Month</th>
                    <th className="py-3 text-end">Due</th>
                    <th className="py-3 text-end">Paid</th>
                    <th className="py-3 text-end">Outstanding</th>
                    <th className="py-3 text-center">Status</th>
                    <th className="py-3 text-center">Receipt</th>
                    <th className="py-3 text-end px-4">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="9" className="text-center py-5 text-muted">
                        <div className="spinner-border spinner-border-sm me-2 text-primary" role="status"></div>
                        Loading hostel fee records...
                      </td>
                    </tr>
                  ) : dues.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="text-center py-5 text-muted">
                        <i className="ti ti-inbox fs-1 d-block mb-2 text-muted opacity-50"></i>
                        No hostel fee records found for this period.
                      </td>
                    </tr>
                  ) : (
                    dues.map((d) => (
                      <tr key={d.record_id}>
                        <td className="px-4">
                          <div className="fw-bold" style={{ color: darkMode ? '#f8fafc' : '#0f172a' }}>{d.student_name}</div>
                          <small className="text-muted">{d.admission_no} &bull; {d.class_name}</small>
                        </td>
                        <td>
                          <div className="fw-semibold">{d.hostel_name || 'Hostel'}</div>
                          <small className="text-muted">Room {d.room_number} &bull; Bed {d.bed_number}</small>
                        </td>
                        <td>
                          <span className="badge bg-light text-dark px-2 py-1 border">{d.month}</span>
                        </td>
                        <td className="text-end fw-semibold">₹{d.amount_due}</td>
                        <td className="text-end text-success fw-semibold">₹{d.amount_paid}</td>
                        <td className="text-end fw-bold" style={{ color: d.outstanding > 0 ? '#ef4444' : '#10b981' }}>
                          ₹{d.outstanding}
                        </td>
                        <td className="text-center">
                          {d.status === 'PAID' ? (
                            <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1">PAID</span>
                          ) : d.status === 'PARTIAL' ? (
                            <span className="badge bg-warning-subtle text-warning border border-warning-subtle px-2 py-1">PARTIAL</span>
                          ) : (
                            <span className="badge bg-danger-subtle text-danger border border-danger-subtle px-2 py-1">PENDING</span>
                          )}
                        </td>
                        <td className="text-center">
                          {d.receipt_no ? (
                            <span className="badge bg-secondary-subtle text-secondary font-monospace">{d.receipt_no}</span>
                          ) : (
                            <span className="text-muted small">—</span>
                          )}
                        </td>
                        <td className="text-end px-4">
                          {d.outstanding > 0 ? (
                            <button
                              className="btn btn-sm btn-primary px-3 fw-semibold"
                              style={{ borderRadius: '8px' }}
                              onClick={() => openCollect(d)}
                            >
                              Collect
                            </button>
                          ) : (
                            <button className="btn btn-sm btn-outline-secondary px-3" disabled style={{ borderRadius: '8px' }}>
                              Settled
                            </button>
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

      {/* Generate Monthly Dues Modal */}
      {genModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content" style={{ borderRadius: '16px', background: darkMode ? '#1e293b' : '#ffffff', color: darkMode ? '#fff' : '#000' }}>
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold">Generate Monthly Hostel Fees</h5>
                <button type="button" className="btn-close" onClick={() => setGenModal(false)}></button>
              </div>
              <div className="modal-body py-4">
                <p className="text-muted small">
                  This will resolve each active student's room fee structure (AC/Non-AC &amp; sharing type) and generate an idempotent monthly charge. Existing charges will be safely skipped.
                </p>
                <div className="mb-3">
                  <label className="form-label fw-semibold">Billing Month</label>
                  <input
                    type="month"
                    className="form-control"
                    value={genMonth}
                    onChange={(e) => setGenMonth(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer border-0 pt-0">
                <button type="button" className="btn btn-light" onClick={() => setGenModal(false)}>Cancel</button>
                <button
                  type="button"
                  className="btn btn-primary px-4 fw-semibold"
                  onClick={handleGenerateMonthly}
                  disabled={generating}
                >
                  {generating ? 'Generating...' : 'Confirm & Generate'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Collect Payment Modal */}
      {collectModal && selectedDue && (
        <div className="modal show d-block" tabIndex="-1" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <form onSubmit={handleCollectSubmit} className="modal-content" style={{ borderRadius: '16px', background: darkMode ? '#1e293b' : '#ffffff', color: darkMode ? '#fff' : '#000' }}>
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold">Collect Hostel Fee</h5>
                <button type="button" className="btn-close" onClick={() => setCollectModal(false)}></button>
              </div>
              <div className="modal-body py-3">
                <div className="p-3 mb-3 rounded-3" style={{ background: darkMode ? '#0f172a' : '#f1f5f9' }}>
                  <div className="fw-bold">{selectedDue.student_name}</div>
                  <div className="small text-muted">{selectedDue.hostel_name} &bull; Room {selectedDue.room_number} &bull; Month: {selectedDue.month}</div>
                  <div className="d-flex justify-content-between mt-2 pt-2 border-top">
                    <span className="small">Total Due: ₹{selectedDue.amount_due}</span>
                    <span className="small fw-bold text-danger">Outstanding: ₹{selectedDue.outstanding}</span>
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold">Amount to Collect (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    max={selectedDue.outstanding}
                    className="form-control fw-bold fs-5 text-success"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    required
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold">Payment Mode</label>
                  <select
                    className="form-select"
                    value={payMode}
                    onChange={(e) => setPayMode(e.target.value)}
                  >
                    <option value="CASH">Cash</option>
                    <option value="UPI">UPI / Online</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="CHEQUE">Cheque / DD</option>
                  </select>
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold">Remarks / Note</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Optional transaction remarks..."
                    value={payRemarks}
                    onChange={(e) => setPayRemarks(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer border-0 pt-0">
                <button type="button" className="btn btn-light" onClick={() => setCollectModal(false)}>Cancel</button>
                <button
                  type="submit"
                  className="btn btn-success px-4 fw-semibold"
                  disabled={submitting}
                >
                  {submitting ? 'Recording...' : `Collect ₹${payAmount}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
