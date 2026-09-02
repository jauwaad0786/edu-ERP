import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function PaymentLogsPage() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [logType, setLogType] = useState('ALL'); // 'ALL', 'INCOME', 'SALARY', 'EXPENSE'
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedMode, setSelectedMode] = useState('');
  const [session, setSession] = useState('2026-27');
  const [selectedTxn, setSelectedTxn] = useState(null);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('session', session);
      params.append('type', logType);
      if (selectedDept) params.append('department', selectedDept);
      if (selectedMode) params.append('payment_mode', selectedMode);
      if (search) params.append('search', search);

      const res = await api.get(`/fees-finance/payments?${params.toString()}`);
      setPayments(res.data || []);
    } catch (err) {
      toast.error('Failed to load payment logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [session, logType, selectedDept, selectedMode]);

  const downloadReceiptPDF = async (paymentId, receiptNo) => {
    try {
      const res = await api.get(`/fees-finance/payments/${paymentId}/receipt-pdf`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `Receipt_${receiptNo}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success('Payment Receipt PDF downloaded');
    } catch (err) {
      toast.error('Failed to download receipt PDF');
    }
  };

  const fmt = (v) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(v || 0);

  const totalIn = payments
    .filter((p) => p.direction === 'IN' && p.status === 'VALID')
    .reduce((sum, p) => sum + (p.total_paid || p.amount_paid || 0), 0);

  const totalOut = payments
    .filter((p) => p.direction === 'OUT')
    .reduce((sum, p) => sum + (p.total_paid || p.amount_paid || 0), 0);

  const filtered = payments.filter((p) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      (p.receipt_no || '').toLowerCase().includes(s) ||
      (p.party_name || '').toLowerCase().includes(s) ||
      (p.student_name || '').toLowerCase().includes(s) ||
      (p.collector_name || '').toLowerCase().includes(s) ||
      (p.collected_by_name || '').toLowerCase().includes(s) ||
      (p.transaction_ref || '').toLowerCase().includes(s)
    );
  });

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar title="Financial Activity & Payment Logs" />
        <div className="page-body">

          {/* Top Header */}
          <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span className="badge badge-primary">Unified Financial Activity Stream</span>
                <span className="text-xs text-muted">Money In (Collections) & Money Out (Salaries/Expenses)</span>
              </div>
              <h2 className="page-title">Payment Logs & Cashier Audit Trail</h2>
              <p className="page-subtitle">
                Complete audit trail answering: Who paid? Whom? How much? Which service/department? When? Payment mode & reference.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <select
                value={session}
                onChange={(e) => setSession(e.target.value)}
                className="form-select"
                style={{ width: 130, fontWeight: 700 }}
              >
                <option value="2026-27">2026-27</option>
                <option value="2025-26">2025-26</option>
                <option value="2024-25">2024-25</option>
              </select>
              <button onClick={fetchPayments} className="btn btn-outline" title="Refresh">
                <i className="ti ti-refresh"></i> Refresh
              </button>
            </div>
          </div>

          {/* Summary KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
            <div className="stat-card" style={{ borderLeft: '4px solid #10b981' }}>
              <div className="stat-label">Total Money In (Collections)</div>
              <div className="stat-value" style={{ color: '#10b981' }}>+{fmt(totalIn)}</div>
              <div className="stat-subtext">Tuition, Hostel, Transport, Library Fines</div>
            </div>

            <div className="stat-card" style={{ borderLeft: '4px solid #ef4444' }}>
              <div className="stat-label">Total Money Out (Expenses & Salaries)</div>
              <div className="stat-value" style={{ color: '#ef4444' }}>-{fmt(totalOut)}</div>
              <div className="stat-subtext">Teacher/Staff Salaries, Utilities, Vendors</div>
            </div>

            <div className="stat-card" style={{ borderLeft: `4px solid ${totalIn - totalOut >= 0 ? '#3b82f6' : '#f59e0b'}` }}>
              <div className="stat-label">Net Financial Cash Flow</div>
              <div className="stat-value" style={{ color: totalIn - totalOut >= 0 ? '#3b82f6' : '#f59e0b' }}>
                {fmt(totalIn - totalOut)}
              </div>
              <div className="stat-subtext">Net Surplus across selected records</div>
            </div>

            <div className="stat-card" style={{ borderLeft: '4px solid #8b5cf6' }}>
              <div className="stat-label">Total Transactions Logged</div>
              <div className="stat-value">{filtered.length}</div>
              <div className="stat-subtext">Active audit trail records</div>
            </div>
          </div>

          {/* Main Card */}
          <div className="card">
            {/* Filter Tabs */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button
                  onClick={() => setLogType('ALL')}
                  className={`btn btn-sm ${logType === 'ALL' ? 'btn-primary' : 'btn-outline'}`}
                >
                  All Transactions ({payments.length})
                </button>
                <button
                  onClick={() => setLogType('INCOME')}
                  className={`btn btn-sm ${logType === 'INCOME' ? 'btn-primary' : 'btn-outline'}`}
                >
                  <span style={{ color: '#10b981', fontWeight: 800 }}>↓ Money In</span> (Collections)
                </button>
                <button
                  onClick={() => setLogType('SALARY')}
                  className={`btn btn-sm ${logType === 'SALARY' ? 'btn-primary' : 'btn-outline'}`}
                >
                  <span style={{ color: '#ef4444', fontWeight: 800 }}>↑ Salary Payments</span>
                </button>
                <button
                  onClick={() => setLogType('EXPENSE')}
                  className={`btn btn-sm ${logType === 'EXPENSE' ? 'btn-primary' : 'btn-outline'}`}
                >
                  <span style={{ color: '#f59e0b', fontWeight: 800 }}>↑ All Expenses</span>
                </button>
              </div>

              {/* Filters */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="Search receipt #, student, staff, reference..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="form-input"
                  style={{ width: 260 }}
                />

                <select
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  className="form-select"
                  style={{ width: 140 }}
                >
                  <option value="">All Services</option>
                  <option value="ACCOUNTS">Academic / Tuition</option>
                  <option value="HOSTEL">Hostel & Mess</option>
                  <option value="TRANSPORT">Transport</option>
                  <option value="LIBRARY">Library</option>
                </select>

                <select
                  value={selectedMode}
                  onChange={(e) => setSelectedMode(e.target.value)}
                  className="form-select"
                  style={{ width: 130 }}
                >
                  <option value="">All Modes</option>
                  <option value="CASH">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="CHEQUE">Cheque</option>
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="table-responsive">
              <table className="table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Voucher / Receipt #</th>
                    <th>Party / Beneficiary</th>
                    <th>Category / Service</th>
                    <th>Amount</th>
                    <th>Payment Mode</th>
                    <th>Cashier / Authorized By</th>
                    <th>Date & Time</th>
                    <th style={{ textAlign: 'right' }}>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: 32 }}>
                        <i className="ti ti-loader ti-spin" style={{ fontSize: 24, color: 'var(--primary)' }}></i>
                        <div style={{ marginTop: 8, color: 'var(--text-muted)' }}>Loading audit stream...</div>
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                        No transactions found for the selected criteria.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((p) => {
                      const isMoneyIn = p.direction === 'IN' || p.transaction_type === 'STUDENT_FEE';
                      const partyName = p.party_name || p.student_name || '—';
                      const cashierName = p.collector_name || p.collected_by_name || 'Accountant';
                      const cashierRole = p.collector_role || p.collected_by_role || 'Staff';

                      return (
                        <tr key={`${p.direction || 'IN'}-${p.id}`}>
                          <td>
                            <span
                              className="badge"
                              style={{
                                background: isMoneyIn ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                color: isMoneyIn ? '#10b981' : '#ef4444',
                                fontWeight: 800,
                                fontSize: 11,
                              }}
                            >
                              {isMoneyIn ? '↓ MONEY IN' : '↑ MONEY OUT'}
                            </span>
                          </td>
                          <td>
                            <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)' }}>
                              {p.receipt_no}
                            </span>
                            {p.transaction_ref && (
                              <div className="text-xs text-muted" style={{ fontFamily: 'monospace' }}>
                                Ref: {p.transaction_ref}
                              </div>
                            )}
                          </td>
                          <td>
                            <div style={{ fontWeight: 700 }}>{partyName}</div>
                            <div className="text-xs text-muted">{p.party_subtext || p.admission_no || p.party_type}</div>
                          </td>
                          <td>
                            <span className="badge badge-outline" style={{ textTransform: 'capitalize' }}>
                              {p.department || 'ACCOUNTS'}
                            </span>
                          </td>
                          <td>
                            <span
                              style={{
                                fontWeight: 800,
                                fontSize: 14,
                                color: isMoneyIn ? '#10b981' : '#ef4444',
                              }}
                            >
                              {isMoneyIn ? '+' : '-'}{fmt(p.total_paid || p.amount_paid)}
                            </span>
                          </td>
                          <td>
                            <span className="badge badge-neutral" style={{ fontSize: 11, fontWeight: 700 }}>
                              {p.payment_mode || 'CASH'}
                            </span>
                          </td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{cashierName}</div>
                            <div className="text-xs text-muted" style={{ textTransform: 'capitalize' }}>
                              {cashierRole?.toLowerCase() || 'Staff'}
                            </div>
                          </td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{p.payment_date}</div>
                            <div className="text-xs text-muted">
                              {p.created_at ? new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            </div>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: 6 }}>
                              <button
                                onClick={() => setSelectedTxn(p)}
                                className="btn btn-sm btn-outline"
                                title="View Complete Details"
                              >
                                <i className="ti ti-eye"></i>
                              </button>
                              {isMoneyIn && (
                                <button
                                  onClick={() => downloadReceiptPDF(p.id, p.receipt_no)}
                                  className="btn btn-sm btn-outline"
                                  title="Download Receipt PDF"
                                >
                                  <i className="ti ti-file-download"></i>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>

      {/* ══ TRANSACTION DETAIL MODAL ══ */}
      {selectedTxn && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="card" style={{ width: '100%', maxWidth: 520, padding: 24, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <span className="badge badge-primary">{selectedTxn.direction === 'IN' ? 'RECEIVABLE COLLECTION' : 'PAYABLE EXPENSE'}</span>
                <h3 style={{ margin: '4px 0 0', fontSize: 17, fontWeight: 800 }}>{selectedTxn.receipt_no}</h3>
              </div>
              <button onClick={() => setSelectedTxn(null)} className="btn btn-sm btn-outline">✕</button>
            </div>

            <div style={{ background: 'var(--surface-hover)', padding: 14, borderRadius: 10, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span className="text-xs text-muted">Beneficiary / Party:</span>
                <span style={{ fontWeight: 700 }}>{selectedTxn.party_name || selectedTxn.student_name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span className="text-xs text-muted">Department / Category:</span>
                <span style={{ fontWeight: 600 }}>{selectedTxn.department || selectedTxn.party_subtext}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span className="text-xs text-muted">Payment Mode:</span>
                <span className="badge badge-neutral">{selectedTxn.payment_mode}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span className="text-xs text-muted">Transaction / Reference #:</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{selectedTxn.transaction_ref || 'N/A'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span className="text-xs text-muted">Cashier / Processed By:</span>
                <span style={{ fontWeight: 600 }}>{selectedTxn.collector_name || selectedTxn.collected_by_name} ({selectedTxn.collector_role || 'Staff'})</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span className="text-xs text-muted">Payment Date:</span>
                <span style={{ fontWeight: 600 }}>{selectedTxn.payment_date}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border-color)' }}>
                <span className="text-sm font-semibold">Total Amount:</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: selectedTxn.direction === 'IN' ? '#10b981' : '#ef4444' }}>
                  {fmt(selectedTxn.total_paid || selectedTxn.amount_paid)}
                </span>
              </div>
            </div>

            {selectedTxn.remarks && (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                <b>Remarks:</b> {selectedTxn.remarks}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              {selectedTxn.direction === 'IN' && (
                <button
                  onClick={() => downloadReceiptPDF(selectedTxn.id, selectedTxn.receipt_no)}
                  className="btn btn-primary"
                >
                  <i className="ti ti-file-download"></i> Download PDF Receipt
                </button>
              )}
              <button onClick={() => setSelectedTxn(null)} className="btn btn-outline">Close</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
