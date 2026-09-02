import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function StudentFinancialLedgerPage() {
  const { studentId } = useParams();
  const navigate = useNavigate();

  const [ledger, setLedger] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('bills'); // bills | receipts | movements | concessions

  const fetchLedger = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/fees-finance/students/${studentId}/ledger?session=2026-27`);
      setLedger(res.data);
    } catch (err) {
      toast.error('Failed to load student financial ledger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (studentId) {
      fetchLedger();
    }
  }, [studentId]);

  const downloadBillPDF = async (billId, billNo) => {
    try {
      const res = await api.get(`/fees-finance/bills/${billId}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `Demand_Bill_${billNo}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success('Fee Bill PDF downloaded');
    } catch (e) {
      toast.error('Download failed');
    }
  };

  const downloadReceiptPDF = async (paymentId, receiptNo) => {
    try {
      const res = await api.get(`/fees-finance/payments/${paymentId}/receipt-pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `Official_Receipt_${receiptNo}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success('Official Receipt PDF downloaded');
    } catch (e) {
      toast.error('Download failed');
    }
  };

  const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar title="Student Financial Ledger" />
        <div className="page-body">

          {/* Page Header */}
          <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span className="badge badge-info">360° Account Statement</span>
                <span className="text-xs text-muted">Single Source of Truth</span>
              </div>
              <h2 className="page-title">
                {ledger?.student?.name ? `${ledger.student.name} — Financial Ledger` : 'Student Financial Ledger'}
              </h2>
              <p className="page-subtitle">
                Complete debit/credit statement across Tuition, Transport, Hostel, and Library.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => navigate(`/finance/payments/collect?student_id=${studentId}`)}
                className="btn btn-primary"
              >
                <i className="ti ti-credit-card"></i>
                Collect Payment
              </button>
              <button onClick={() => navigate('/finance/bills')} className="btn btn-neutral">
                Back to Bills
              </button>
            </div>
          </div>

          {loading ? (
            <div className="empty-state">
              <div className="spinner" style={{ width: 32, height: 32 }}></div>
              <p className="mt-4">Loading student financial ledger...</p>
            </div>
          ) : !ledger ? (
            <div className="empty-state">
              <i className="ti ti-alert-circle" style={{ fontSize: 36, color: 'var(--error)' }}></i>
              <h4 style={{ marginTop: 12 }}>Ledger Not Found</h4>
              <p className="text-xs text-muted">Unable to retrieve student financial account details.</p>
            </div>
          ) : (
            <>
              {/* Profile & Summary Top Cards */}
              <div className="grid-4 mb-6">
                <div className="stat-card" style={{ borderLeft: '4px solid #0176d3' }}>
                  <div className="stat-label">Student Details</div>
                  <div style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--neutral-9)' }}>
                    {ledger.student.name}
                  </div>
                  <div className="stat-sub">
                    {ledger.student.admission_no} • {ledger.student.class_name}
                  </div>
                </div>

                <div className="stat-card" style={{ borderLeft: '4px solid #0176d3' }}>
                  <div className="stat-label">Total Billed (Invoiced)</div>
                  <div className="stat-value" style={{ fontSize: '1.5rem', color: '#0176d3' }}>
                    {fmt(ledger.total_billed)}
                  </div>
                  <div className="stat-sub">{ledger.bills?.length || 0} demand bills issued</div>
                </div>

                <div className="stat-card" style={{ borderLeft: '4px solid #2e844a' }}>
                  <div className="stat-label">Total Amount Paid</div>
                  <div className="stat-value" style={{ fontSize: '1.5rem', color: '#2e844a' }}>
                    {fmt(ledger.total_paid)}
                  </div>
                  <div className="stat-sub">{ledger.payments?.length || 0} payment receipts</div>
                </div>

                <div className="stat-card" style={{ borderLeft: `4px solid ${ledger.outstanding > 0 ? '#dd7a01' : '#2e844a'}` }}>
                  <div className="stat-label">Outstanding Balance Due</div>
                  <div className="stat-value" style={{ fontSize: '1.5rem', color: ledger.outstanding > 0 ? '#dd7a01' : '#2e844a' }}>
                    {fmt(ledger.outstanding)}
                  </div>
                  <div className="stat-sub">
                    {ledger.advance_balance > 0 ? `Advance Credit: ${fmt(ledger.advance_balance)}` : 'Current Pending Arrears'}
                  </div>
                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="card mb-6">
                <div className="card-header" style={{ padding: '8px 16px', background: '#fafaf9' }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[
                      { id: 'bills', label: 'Demand Bills', icon: 'ti-file-invoice', count: ledger.bills?.length || 0 },
                      { id: 'receipts', label: 'Payment Receipts', icon: 'ti-receipt', count: ledger.payments?.length || 0 },
                      { id: 'movements', label: 'Ledger Audit Trail', icon: 'ti-list-check', count: ledger.ledger_movements?.length || 0 },
                      { id: 'concessions', label: 'Concessions & Scholarships', icon: 'ti-percentage', count: ledger.concessions?.length || 0 },
                    ].map((tab) => {
                      const active = activeTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id)}
                          className={`btn ${active ? 'btn-primary' : 'btn-neutral'} btn-sm`}
                          style={{ borderRadius: 20 }}
                        >
                          <i className={`ti ${tab.icon}`}></i>
                          {tab.label} ({tab.count})
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Tab 1: Demand Bills */}
                {activeTab === 'bills' && (
                  <div className="table-container" style={{ border: 'none' }}>
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Bill No</th>
                          <th>Period</th>
                          <th>Issue Date</th>
                          <th>Due Date</th>
                          <th style={{ textAlign: 'right' }}>Total Payable</th>
                          <th style={{ textAlign: 'right' }}>Paid</th>
                          <th style={{ textAlign: 'right' }}>Balance Due</th>
                          <th>Status</th>
                          <th style={{ textAlign: 'center' }}>PDF</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ledger.bills?.map((b) => (
                          <tr key={b.id}>
                            <td style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--blue-60)' }}>{b.bill_no}</td>
                            <td style={{ fontWeight: 600 }}>{b.bill_period_label}</td>
                            <td>{b.issue_date}</td>
                            <td style={{ color: b.balance_due > 0 ? '#ba0517' : 'inherit', fontWeight: 500 }}>{b.due_date}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(b.total_payable)}</td>
                            <td style={{ textAlign: 'right', fontWeight: 600, color: '#2e844a' }}>{fmt(b.amount_paid)}</td>
                            <td style={{ textAlign: 'right', fontWeight: 800, color: b.balance_due > 0 ? '#dd7a01' : '#2e844a' }}>
                              {fmt(b.balance_due)}
                            </td>
                            <td>
                              <span className={`badge ${b.status === 'PAID' ? 'badge-success' : b.status === 'PARTIALLY_PAID' ? 'badge-warning' : 'badge-info'}`}>
                                {b.status}
                              </span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button
                                onClick={() => downloadBillPDF(b.id, b.bill_no)}
                                className="btn btn-neutral btn-sm"
                              >
                                <i className="ti ti-download"></i> PDF
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Tab 2: Payment Receipts */}
                {activeTab === 'receipts' && (
                  <div className="table-container" style={{ border: 'none' }}>
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Receipt No</th>
                          <th>Payment Date</th>
                          <th>Mode & Ref</th>
                          <th style={{ textAlign: 'right' }}>Total Paid</th>
                          <th>Allocations</th>
                          <th>Status</th>
                          <th style={{ textAlign: 'center' }}>PDF</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ledger.payments?.map((p) => (
                          <tr key={p.id}>
                            <td style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--blue-60)' }}>{p.receipt_no}</td>
                            <td style={{ fontWeight: 500 }}>{p.payment_date}</td>
                            <td>
                              <span className="badge badge-neutral" style={{ fontSize: 10 }}>{p.payment_mode}</span>
                              {p.transaction_ref && <span className="text-xs text-muted" style={{ marginLeft: 6 }}>{p.transaction_ref}</span>}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 800, color: p.status === 'VALID' ? '#2e844a' : 'var(--neutral-6)' }}>
                              {fmt(p.total_paid)}
                            </td>
                            <td style={{ fontSize: 12 }}>
                              {p.allocations?.map((a) => `${a.fee_head_name}: ₹${a.amount}`).join(', ')}
                            </td>
                            <td>
                              <span className={`badge ${p.status === 'VALID' ? 'badge-success' : 'badge-error'}`}>
                                {p.status}
                              </span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button
                                onClick={() => downloadReceiptPDF(p.id, p.receipt_no)}
                                className="btn btn-neutral btn-sm"
                              >
                                <i className="ti ti-download"></i> PDF
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Tab 3: Chronological Ledger Movements */}
                {activeTab === 'movements' && (
                  <div className="table-container" style={{ border: 'none' }}>
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Entry Type</th>
                          <th>Service / Fee Head</th>
                          <th>Description</th>
                          <th style={{ textAlign: 'right' }}>Debit (+)</th>
                          <th style={{ textAlign: 'right' }}>Credit (-)</th>
                          <th style={{ textAlign: 'right' }}>Running Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ledger.ledger_movements?.map((m) => (
                          <tr key={m.id}>
                            <td style={{ fontSize: 12, fontWeight: 500 }}>{m.date?.slice(0, 16)}</td>
                            <td>
                              <span className={`badge ${m.entry_type === 'FEE_PAYMENT' ? 'badge-success' : m.entry_type === 'CONCESSION' ? 'badge-info' : 'badge-warning'}`}>
                                {m.entry_type}
                              </span>
                            </td>
                            <td style={{ fontWeight: 600 }}>{m.fee_head_name}</td>
                            <td style={{ fontSize: 12, color: 'var(--neutral-6)' }}>{m.description}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: m.debit_amount > 0 ? '#ba0517' : 'var(--neutral-4)' }}>
                              {m.debit_amount > 0 ? fmt(m.debit_amount) : '-'}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: m.credit_amount > 0 ? '#2e844a' : 'var(--neutral-4)' }}>
                              {m.credit_amount > 0 ? fmt(m.credit_amount) : '-'}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 800 }}>
                              {fmt(m.running_balance)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Tab 4: Concessions */}
                {activeTab === 'concessions' && (
                  <div className="card-body" style={{ padding: 20 }}>
                    {ledger.concessions?.length === 0 ? (
                      <div className="empty-state" style={{ padding: '20px 0' }}>
                        <p className="text-xs text-muted">No active concessions or scholarships assigned to this student.</p>
                      </div>
                    ) : (
                      <div className="grid-2">
                        {ledger.concessions?.map((c) => (
                          <div key={c.id} style={{ background: '#fafaf9', border: '1px solid var(--neutral-2)', borderRadius: 8, padding: 14 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                              <span style={{ fontWeight: 700, fontSize: 13 }}>{c.fee_head_name}</span>
                              <span className="badge badge-success">
                                {c.discount_type === 'PERCENTAGE' ? `${c.discount_value}% OFF` : `₹${c.discount_value} OFF`}
                              </span>
                            </div>
                            <div className="text-xs text-muted" style={{ marginBottom: 4 }}>
                              Type: <strong>{c.concession_type}</strong>
                            </div>
                            <div className="text-xs text-muted" style={{ fontStyle: 'italic' }}>
                              "{c.reason}"
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
