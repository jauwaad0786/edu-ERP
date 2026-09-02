import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function CollectPaymentPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [studentQuery, setStudentQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const [selectedStudent, setSelectedStudent] = useState(null);
  const [ledgerData, setLedgerData] = useState(null);
  const [loadingLedger, setLoadingLedger] = useState(false);

  // Payment Form
  const [paymentMode, setPaymentMode] = useState('UPI');
  const [transactionRef, setTransactionRef] = useState('');
  const [remarks, setRemarks] = useState('');
  const [selectedItems, setSelectedItems] = useState({}); // { bill_item_id: amountToPay }
  const [collecting, setCollecting] = useState(false);

  // Success Receipt Modal
  const [receiptModal, setReceiptModal] = useState(null);

  useEffect(() => {
    const studentIdParam = searchParams.get('student_id');
    if (studentIdParam) {
      loadStudentLedger(studentIdParam);
    }
  }, [searchParams]);

  const handleSearchStudent = async (e) => {
    e.preventDefault();
    if (!studentQuery.trim()) return;
    try {
      setSearching(true);
      const res = await api.get(`/principal/students?search=${encodeURIComponent(studentQuery.trim())}`);
      const students = res.data?.students || res.data || [];
      setSearchResults(students);
      if (students.length === 1) {
        loadStudentLedger(students[0].id);
      }
    } catch (err) {
      toast.error('Student search failed');
    } finally {
      setSearching(false);
    }
  };

  const loadStudentLedger = async (studentId) => {
    try {
      setLoadingLedger(true);
      const res = await api.get(`/fees-finance/students/${studentId}/ledger?session=2026-27`);
      setLedgerData(res.data);
      setSelectedStudent(res.data.student);
      setSearchResults([]);

      // Auto select all pending bill items
      const initialSelection = {};
      res.data.pending_bills?.forEach((b) => {
        b.items?.forEach((it) => {
          if (it.balance_amount > 0) {
            initialSelection[it.id] = {
              bill_id: b.id,
              bill_item_id: it.id,
              fee_head_id: it.fee_head_id,
              fee_head_name: it.fee_head_name,
              department: it.department,
              amount: it.balance_amount,
              max: it.balance_amount,
              selected: true,
            };
          }
        });
      });
      setSelectedItems(initialSelection);
    } catch (err) {
      toast.error('Failed to load student ledger');
    } finally {
      setLoadingLedger(false);
    }
  };

  const toggleItem = (itemId) => {
    setSelectedItems((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        selected: !prev[itemId].selected,
      },
    }));
  };

  const updateItemAmount = (itemId, val) => {
    const num = parseFloat(val) || 0;
    setSelectedItems((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        amount: Math.min(num, prev[itemId].max),
      },
    }));
  };

  const totalToPay = Object.values(selectedItems)
    .filter((it) => it.selected)
    .reduce((sum, it) => sum + (parseFloat(it.amount) || 0), 0);

  const handleCollectPayment = async (e) => {
    e.preventDefault();
    if (totalToPay <= 0) {
      toast.error('Select at least one charge item to pay');
      return;
    }

    try {
      setCollecting(true);
      const allocations = Object.values(selectedItems)
        .filter((it) => it.selected && it.amount > 0)
        .map((it) => ({
          bill_id: it.bill_id,
          bill_item_id: it.bill_item_id,
          fee_head_id: it.fee_head_id,
          amount: parseFloat(it.amount),
        }));

      const payload = {
        student_id: selectedStudent.id,
        amount_paid: totalToPay,
        payment_mode: paymentMode,
        transaction_ref: transactionRef,
        remarks: remarks,
        allocations: allocations,
        department: 'ACCOUNTS',
        session: '2026-27',
      };

      const res = await api.post('/fees-finance/payments/collect', payload);
      toast.success(`Payment Collected! Receipt No: ${res.data.receipt_no}`);
      setReceiptModal(res.data);
      loadStudentLedger(selectedStudent.id);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Payment collection failed');
    } finally {
      setCollecting(false);
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

  const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar title="Payment Counter (Fee POS)" />
        <div className="page-body">

          {/* Page Header */}
          <div className="page-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span className="badge badge-success">Cashier Counter</span>
              <span className="text-xs text-muted">Combined Multi-Department Fee Collection</span>
            </div>
            <h2 className="page-title">Collect Fee Payment</h2>
            <p className="page-subtitle">
              Single unified payment collection across Tuition, Transport, Hostel, and Library with instant official receipt.
            </p>
          </div>

          {/* Student Search Bar */}
          <div className="card mb-6" style={{ padding: 16 }}>
            <form onSubmit={handleSearchStudent} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <input
                  type="text"
                  value={studentQuery}
                  onChange={(e) => setStudentQuery(e.target.value)}
                  placeholder="Enter Student Name, Admission No, or Parent Phone No..."
                  className="form-input"
                  style={{ width: '100%', height: 38 }}
                />
              </div>
              <button
                type="submit"
                disabled={searching}
                className="btn btn-primary"
                style={{ height: 38 }}
              >
                <i className="ti ti-search"></i>
                {searching ? 'Searching...' : 'Find Student'}
              </button>
            </form>

            {/* Search Results Dropdown */}
            {searchResults.length > 0 && (
              <div style={{ marginTop: 12, border: '1px solid var(--neutral-2)', borderRadius: 8, overflow: 'hidden' }}>
                <table className="table">
                  <tbody>
                    {searchResults.map((s) => (
                      <tr key={s.id} onClick={() => loadStudentLedger(s.id)} style={{ cursor: 'pointer' }}>
                        <td style={{ fontWeight: 700 }}>{s.name}</td>
                        <td style={{ color: 'var(--neutral-6)' }}>Adm: {s.admission_no || s.id}</td>
                        <td>Class: {s.class_name || '-'}</td>
                        <td>Parent Phone: {s.parent_phone || '-'}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button className="btn btn-primary btn-sm">Select Student</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {loadingLedger ? (
            <div className="empty-state">
              <div className="spinner" style={{ width: 28, height: 28 }}></div>
              <p className="mt-4">Loading student financial profile...</p>
            </div>
          ) : ledgerData ? (
            <div className="grid-3 mb-6" style={{ gridTemplateColumns: '1fr 2fr' }}>
              {/* Left Column: Student Financial Profile */}
              <div className="card">
                <div className="card-header">
                  <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, margin: 0 }}>Student Profile</h3>
                  <button
                    onClick={() => navigate(`/finance/students/${selectedStudent.id}/ledger`)}
                    className="btn btn-neutral btn-sm"
                  >
                    View Ledger
                  </button>
                </div>
                <div className="card-body" style={{ padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <div className="avatar avatar-lg">
                      {selectedStudent?.name?.slice(0, 2)?.toUpperCase()}
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0 }}>{selectedStudent?.name}</h3>
                      <p className="text-xs text-muted" style={{ margin: 0 }}>
                        {selectedStudent?.admission_no} • {selectedStudent?.class_name}
                      </p>
                      <p className="text-xs text-muted" style={{ margin: 0 }}>
                        Parent: {selectedStudent?.father_name || 'Guardian'} ({selectedStudent?.parent_phone || '-'})
                      </p>
                    </div>
                  </div>

                  <div className="stat-card mb-4" style={{ padding: 12, background: '#fef5e4', borderColor: '#fdd9a0' }}>
                    <div className="stat-label" style={{ color: '#dd7a01', margin: 0 }}>Total Outstanding Dues</div>
                    <div className="stat-value" style={{ fontSize: '1.5rem', color: '#dd7a01' }}>
                      {fmt(ledgerData?.outstanding)}
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '6px 0', borderBottom: '1px solid var(--neutral-2)' }}>
                    <span className="text-muted">Total Invoiced:</span>
                    <span style={{ fontWeight: 700 }}>{fmt(ledgerData?.total_billed)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '6px 0', borderBottom: '1px solid var(--neutral-2)' }}>
                    <span className="text-muted">Total Paid So Far:</span>
                    <span style={{ fontWeight: 700, color: '#2e844a' }}>{fmt(ledgerData?.total_paid)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '6px 0' }}>
                    <span className="text-muted">Advance Credit:</span>
                    <span style={{ fontWeight: 700, color: '#0176d3' }}>{fmt(ledgerData?.advance_balance)}</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Multi-Service Itemized Payment Allocation Form */}
              <div className="card">
                <div className="card-header">
                  <div>
                    <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, margin: 0 }}>Itemized Dues & Service Selection</h3>
                    <p className="text-xs text-muted" style={{ margin: 0 }}>Select or adjust amounts for individual fee heads.</p>
                  </div>
                  <span className="badge badge-info">{Object.keys(selectedItems).length} Payable Items</span>
                </div>

                <form onSubmit={handleCollectPayment}>
                  <div className="card-body" style={{ padding: 16 }}>
                    {Object.keys(selectedItems).length === 0 ? (
                      <div className="empty-state" style={{ padding: '30px 20px' }}>
                        <i className="ti ti-check" style={{ fontSize: 32, color: '#2e844a' }}></i>
                        <h4 style={{ marginTop: 8 }}>All Dues are Cleared!</h4>
                        <p className="text-xs text-muted">This student has no pending fee bills or charges.</p>
                      </div>
                    ) : (
                      <div className="table-container mb-4" style={{ border: '1px solid var(--neutral-2)' }}>
                        <table className="table">
                          <thead>
                            <tr>
                              <th style={{ width: 40 }}></th>
                              <th>Service / Fee Head</th>
                              <th>Department</th>
                              <th style={{ textAlign: 'right' }}>Max Due</th>
                              <th style={{ textAlign: 'right', width: 140 }}>Paying (₹)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.values(selectedItems).map((it) => (
                              <tr key={it.bill_item_id} style={{ background: it.selected ? '#fafaf9' : 'transparent' }}>
                                <td>
                                  <input
                                    type="checkbox"
                                    checked={it.selected}
                                    onChange={() => toggleItem(it.bill_item_id)}
                                    style={{ width: 16, height: 16, cursor: 'pointer' }}
                                  />
                                </td>
                                <td>
                                  <div style={{ fontWeight: 700, color: 'var(--neutral-9)' }}>{it.fee_head_name}</div>
                                </td>
                                <td>
                                  <span className="badge badge-neutral" style={{ fontSize: 10 }}>{it.department}</span>
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(it.max)}</td>
                                <td style={{ textAlign: 'right' }}>
                                  <input
                                    type="number"
                                    min="0"
                                    max={it.max}
                                    step="any"
                                    disabled={!it.selected}
                                    value={it.amount}
                                    onChange={(e) => updateItemAmount(it.bill_item_id, e.target.value)}
                                    className="form-input"
                                    style={{ height: 32, width: 110, textAlign: 'right', fontWeight: 700, marginLeft: 'auto' }}
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Payment Mode & Details */}
                    <div className="grid-3 mb-4">
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Payment Mode</label>
                        <select
                          value={paymentMode}
                          onChange={(e) => setPaymentMode(e.target.value)}
                          className="form-select"
                          style={{ fontWeight: 700 }}
                        >
                          <option value="UPI">UPI / QR Code</option>
                          <option value="CASH">Cash Counter</option>
                          <option value="CARD">Debit / Credit Card</option>
                          <option value="BANK_TRANSFER">Bank Transfer / NEFT</option>
                          <option value="CHEQUE">Cheque / Demand Draft</option>
                        </select>
                      </div>

                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Transaction Ref / UTR No</label>
                        <input
                          type="text"
                          value={transactionRef}
                          onChange={(e) => setTransactionRef(e.target.value)}
                          placeholder="e.g. UPI-UTR-998877"
                          className="form-input"
                        />
                      </div>

                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Remarks / Notes</label>
                        <input
                          type="text"
                          value={remarks}
                          onChange={(e) => setRemarks(e.target.value)}
                          placeholder="e.g. Paid at accounts desk"
                          className="form-input"
                        />
                      </div>
                    </div>

                    {/* Total & Submit Button */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#eaf5ea', border: '1px solid #a9d6b3', borderRadius: 8, padding: '12px 16px' }}>
                      <div>
                        <span className="text-xs font-semibold" style={{ color: '#2e844a' }}>TOTAL PAYMENT AMOUNT:</span>
                        <div style={{ fontSize: '1.375rem', fontWeight: 800, color: '#2e844a' }}>
                          {fmt(totalToPay)}
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={collecting || totalToPay <= 0}
                        className="btn btn-primary"
                        style={{ height: 40, padding: '0 20px', fontSize: '0.875rem' }}
                      >
                        <i className="ti ti-check"></i>
                        {collecting ? 'Processing Payment...' : 'Collect & Issue Receipt'}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <i className="ti ti-user-search" style={{ fontSize: 42, color: 'var(--neutral-4)' }}></i>
              <h3 style={{ marginTop: 12 }}>Search a Student to Begin Payment</h3>
              <p className="text-xs text-muted">Enter student name or admission number in the box above.</p>
            </div>
          )}

          {/* Success Receipt Modal */}
          {receiptModal && (
            <div className="modal-backdrop">
              <div className="modal">
                <div className="modal-header">
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0, color: '#2e844a' }}>
                    ✓ Payment Successful
                  </h3>
                  <button onClick={() => setReceiptModal(null)} className="modal-close">✕</button>
                </div>

                <div className="modal-body">
                  <div style={{ textAlign: 'center', padding: '12px 0 20px' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--neutral-6)' }}>
                      Official Receipt Number
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, fontFamily: 'monospace', color: 'var(--blue-60)', margin: '4px 0' }}>
                      {receiptModal.receipt_no}
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#2e844a' }}>
                      {fmt(receiptModal.total_paid)}
                    </div>
                  </div>

                  <div className="table-container mb-4">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Service</th>
                          <th style={{ textAlign: 'right' }}>Credited Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {receiptModal.allocations?.map((alc, idx) => (
                          <tr key={idx}>
                            <td style={{ fontWeight: 600 }}>{alc.fee_head_name}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: '#2e844a' }}>{fmt(alc.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <p className="text-xs text-muted text-center">
                    Payment recorded in Central Financial Ledger. All departments credited.
                  </p>
                </div>

                <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
                  <button
                    type="button"
                    onClick={() => setReceiptModal(null)}
                    className="btn btn-neutral"
                  >
                    Close
                  </button>

                  <button
                    type="button"
                    onClick={() => downloadReceiptPDF(receiptModal.payment_id, receiptModal.receipt_no)}
                    className="btn btn-primary"
                  >
                    <i className="ti ti-download"></i>
                    Download Official Receipt PDF
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
