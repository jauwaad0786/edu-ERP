import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function ReceiptsPage() {
  const navigate = useNavigate();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modeFilter, setModeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Cancel Modal
  const [cancelModal, setCancelModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  // View Breakdown Modal
  const [viewPayment, setViewPayment] = useState(null);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const res = await api.get('/fees-finance/payments?session=2026-27');
      setPayments(res.data || []);
    } catch (err) {
      toast.error('Failed to load receipts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const handleCancelReceipt = async (e) => {
    e.preventDefault();
    if (!cancelReason.trim()) {
      toast.error('Please provide a reason for cancellation');
      return;
    }

    try {
      setCancelling(true);
      await api.post(`/fees-finance/payments/${selectedPayment.id}/cancel`, {
        cancel_reason: cancelReason.trim(),
      });
      toast.success('Receipt cancelled and student ledger reversed');
      setCancelModal(false);
      setSelectedPayment(null);
      setCancelReason('');
      fetchPayments();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Cancellation failed');
    } finally {
      setCancelling(false);
    }
  };

  const downloadReceiptPDF = async (paymentId, receiptNo) => {
    try {
      const res = await api.get(`/fees-finance/payments/${paymentId}/receipt-pdf`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `Official_Receipt_${receiptNo}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success('Official Receipt PDF downloaded');
    } catch (err) {
      toast.error('Failed to download receipt PDF');
    }
  };

  const filteredPayments = payments.filter((p) => {
    const matchesSearch =
      !search ||
      p.receipt_no?.toLowerCase().includes(search.toLowerCase()) ||
      p.student_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.admission_no?.toLowerCase().includes(search.toLowerCase()) ||
      p.transaction_ref?.toLowerCase().includes(search.toLowerCase());

    const matchesMode = !modeFilter || p.payment_mode === modeFilter;
    const matchesStatus = !statusFilter || p.status === statusFilter;

    return matchesSearch && matchesMode && matchesStatus;
  });

  const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar title="Official Receipts & Payment History" />
        <div className="page-body">

          {/* Page Header */}
          <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span className="badge badge-success">Audit Records</span>
                <span className="text-xs text-muted">Official Payment Receipts</span>
              </div>
              <h2 className="page-title">Receipts & Payment History</h2>
              <p className="page-subtitle">
                Official payment vouchers, service credit allocations, and authorized cancellation workflows.
              </p>
            </div>

            <button
              onClick={() => navigate('/finance/payments/collect')}
              className="btn btn-primary"
            >
              <i className="ti ti-plus"></i>
              Collect New Payment
            </button>
          </div>

          {/* Filter Bar */}
          <div className="card mb-6" style={{ padding: 14 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ flex: 1, minWidth: 240 }}>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by receipt no (REC-...), student name, or transaction ref..."
                  className="form-input"
                  style={{ width: '100%', height: 36 }}
                />
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <select
                  value={modeFilter}
                  onChange={(e) => setModeFilter(e.target.value)}
                  className="form-select"
                  style={{ height: 36, width: 140 }}
                >
                  <option value="">All Modes</option>
                  <option value="UPI">UPI</option>
                  <option value="CASH">CASH</option>
                  <option value="CARD">CARD</option>
                  <option value="BANK_TRANSFER">BANK TRANSFER</option>
                  <option value="CHEQUE">CHEQUE</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="form-select"
                  style={{ height: 36, width: 130 }}
                >
                  <option value="">All Statuses</option>
                  <option value="VALID">VALID</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>

                <button
                  onClick={fetchPayments}
                  className="btn btn-neutral"
                  style={{ height: 36, padding: '0 12px' }}
                  title="Refresh"
                >
                  <i className="ti ti-refresh"></i>
                </button>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="card">
            <div className="card-header">
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Official Fee Payment Receipts</h3>
                <p className="text-xs text-muted" style={{ margin: 0 }}>Showing {filteredPayments.length} receipts</p>
              </div>
            </div>

            {loading ? (
              <div className="empty-state">
                <div className="spinner" style={{ width: 28, height: 28 }}></div>
                <p className="mt-4">Loading receipts history...</p>
              </div>
            ) : filteredPayments.length === 0 ? (
              <div className="empty-state">
                <i className="ti ti-receipt" style={{ fontSize: 36, color: 'var(--neutral-4)' }}></i>
                <h4 style={{ marginTop: 12 }}>No Receipts Found</h4>
                <p className="text-xs text-muted">No payments match the selected search criteria.</p>
              </div>
            ) : (
              <div className="table-container" style={{ border: 'none' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Receipt No</th>
                      <th>Student & Admission</th>
                      <th>Payment Date</th>
                      <th>Mode & Reference</th>
                      <th style={{ textAlign: 'right' }}>Total Paid</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPayments.map((p) => (
                      <tr key={p.id}>
                        <td style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--blue-60)' }}>
                          {p.receipt_no}
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--neutral-9)' }}>{p.student_name}</div>
                          <div className="text-xs text-muted">{p.admission_no} • {p.class_name}</div>
                        </td>
                        <td style={{ fontWeight: 500 }}>{p.payment_date}</td>
                        <td>
                          <span className="badge badge-neutral" style={{ fontSize: 10, fontWeight: 700 }}>
                            {p.payment_mode}
                          </span>
                          {p.transaction_ref && (
                            <div className="text-xs text-muted" style={{ fontFamily: 'monospace' }}>
                              {p.transaction_ref}
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 800, color: p.status === 'VALID' ? '#2e844a' : 'var(--neutral-6)' }}>
                          {fmt(p.total_paid)}
                        </td>
                        <td>
                          {p.status === 'VALID' ? (
                            <span className="badge badge-success">VALID</span>
                          ) : (
                            <span className="badge badge-error">CANCELLED</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                            <button
                              onClick={() => downloadReceiptPDF(p.id, p.receipt_no)}
                              className="btn btn-neutral btn-sm"
                              title="Download Receipt PDF"
                            >
                              <i className="ti ti-download"></i> PDF
                            </button>
                            <button
                              onClick={() => setViewPayment(p)}
                              className="btn btn-neutral btn-sm"
                              title="View Breakdown"
                            >
                              <i className="ti ti-eye"></i> View
                            </button>
                            {p.status === 'VALID' && (
                              <button
                                onClick={() => {
                                  setSelectedPayment(p);
                                  setCancelModal(true);
                                }}
                                className="btn btn-destructive btn-sm"
                                title="Cancel Receipt"
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* View Breakdown Modal */}
          {viewPayment && (
            <div className="modal-backdrop">
              <div className="modal">
                <div className="modal-header">
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0 }}>
                    Receipt Details — {viewPayment.receipt_no}
                  </h3>
                  <button onClick={() => setViewPayment(null)} className="modal-close">✕</button>
                </div>
                <div className="modal-body">
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: 13 }}>
                    <span className="text-muted">Student:</span>
                    <span style={{ fontWeight: 700 }}>{viewPayment.student_name} ({viewPayment.admission_no})</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: 13 }}>
                    <span className="text-muted">Payment Date:</span>
                    <span style={{ fontWeight: 600 }}>{viewPayment.payment_date}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, fontSize: 13 }}>
                    <span className="text-muted">Total Amount Paid:</span>
                    <span style={{ fontWeight: 800, color: '#2e844a', fontSize: '1.125rem' }}>
                      {fmt(viewPayment.total_paid)}
                    </span>
                  </div>

                  <div className="table-container mb-4">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Service / Fee Head</th>
                          <th style={{ textAlign: 'right' }}>Credited Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {viewPayment.allocations?.map((alc, idx) => (
                          <tr key={idx}>
                            <td style={{ fontWeight: 600 }}>{alc.fee_head_name}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: '#2e844a' }}>{fmt(alc.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {viewPayment.cancel_reason && (
                    <div className="alert alert-error" style={{ fontSize: 12 }}>
                      <strong>Cancelled:</strong> {viewPayment.cancel_reason}
                    </div>
                  )}
                </div>
                <div className="modal-footer">
                  <button onClick={() => setViewPayment(null)} className="btn btn-neutral">Close</button>
                  <button
                    onClick={() => downloadReceiptPDF(viewPayment.id, viewPayment.receipt_no)}
                    className="btn btn-primary"
                  >
                    <i className="ti ti-download"></i> Download PDF
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Cancel Receipt Modal */}
          {cancelModal && (
            <div className="modal-backdrop">
              <div className="modal">
                <div className="modal-header">
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0, color: '#ba0517' }}>
                    Cancel Fee Receipt
                  </h3>
                  <button onClick={() => setCancelModal(false)} className="modal-close">✕</button>
                </div>
                <form onSubmit={handleCancelReceipt}>
                  <div className="modal-body">
                    <div className="alert alert-warning" style={{ fontSize: 12, marginBottom: 16 }}>
                      Cancelling receipt <strong>{selectedPayment?.receipt_no}</strong> will reverse all credited amounts and restore pending balances in the student's central financial ledger.
                    </div>

                    <div className="form-group">
                      <label className="form-label">Reason for Cancellation</label>
                      <textarea
                        rows={3}
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        placeholder="e.g. Wrong amount entered by cashier, cheque bounced, or parent requested reversal..."
                        required
                        className="form-textarea"
                      />
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button
                      type="button"
                      onClick={() => setCancelModal(false)}
                      className="btn btn-neutral"
                    >
                      Keep Receipt
                    </button>
                    <button
                      type="submit"
                      disabled={cancelling}
                      className="btn btn-destructive"
                    >
                      {cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
