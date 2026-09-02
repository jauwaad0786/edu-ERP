import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function CollectPaymentPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Search & Filter State
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyPending, setOnlyPending] = useState(true);

  const [studentList, setStudentList] = useState([]);
  const [loadingList, setLoadingList] = useState(false);

  // Selected Student & Financial Data
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [ledgerData, setLedgerData] = useState(null);
  const [loadingLedger, setLoadingLedger] = useState(false);

  // Payment Allocation State
  const [paymentMode, setPaymentMode] = useState('UPI');
  const [transactionRef, setTransactionRef] = useState('');
  const [remarks, setRemarks] = useState('');
  const [selectedItems, setSelectedItems] = useState({}); // { itemId: { ... } }
  const [collecting, setCollecting] = useState(false);

  // Receipt Modal State
  const [receiptModal, setReceiptModal] = useState(null);

  // 1. Fetch Classes on mount
  useEffect(() => {
    api.get('/principal/classes')
      .then((res) => setClasses(res.data || []))
      .catch(() => {});
  }, []);

  // 2. Fetch Student List based on filter
  const fetchStudents = async () => {
    try {
      setLoadingList(true);
      const params = new URLSearchParams();
      if (selectedClass) params.append('class_id', selectedClass);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      params.append('only_pending', onlyPending ? 'true' : 'false');

      const res = await api.get(`/fees-finance/students/search?${params.toString()}`);
      setStudentList(res.data?.students || []);
    } catch (err) {
      toast.error('Failed to load students');
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchStudents();
    }, 250);
    return () => clearTimeout(timer);
  }, [selectedClass, searchQuery, onlyPending]);

  // 3. Load Student Ledger when selected or via URL param
  const loadStudentLedger = async (studentId) => {
    try {
      setLoadingLedger(true);
      const res = await api.get(`/fees-finance/students/${studentId}/ledger`);
      setLedgerData(res.data);
      setSelectedStudent(res.data.student || { id: studentId, name: res.data.student_name });

      // Populate bill items that have pending balance
      const initialSelection = {};
      const pendingBills = res.data.pending_bills || res.data.bills?.filter((b) => (b.balance_due || 0) > 0) || [];

      pendingBills.forEach((b) => {
        b.items?.forEach((it) => {
          const bal = (it.balance_amount !== undefined && it.balance_amount !== null) ? it.balance_amount : (it.net_amount || 0);
          if (bal > 0) {
            initialSelection[it.id] = {
              bill_id: b.id,
              bill_no: b.bill_no,
              bill_period: b.bill_period_label || b.bill_month,
              bill_item_id: it.id,
              fee_head_id: it.fee_head_id,
              fee_head_name: it.fee_head_name,
              department: it.department || 'ACCOUNTS',
              amount: bal,
              max: bal,
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

  useEffect(() => {
    const studentIdParam = searchParams.get('student_id');
    if (studentIdParam) {
      loadStudentLedger(studentIdParam);
    }
  }, [searchParams]);

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
      };

      const res = await api.post('/fees-finance/payments/collect', payload);
      toast.success(`Payment Collected! Receipt No: ${res.data.receipt_no}`);
      setReceiptModal(res.data);
      loadStudentLedger(selectedStudent.id);
      fetchStudents();
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
        <Navbar title="Collect Fee Payment (POS Counter)" />
        <div className="page-body">

          {/* Page Header */}
          <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span className="badge badge-success">Cashier Counter</span>
                <span className="text-xs text-muted">Direct Student Fee POS</span>
              </div>
              <h2 className="page-title">Collect Fee Payment</h2>
              <p className="page-subtitle">
                Search student by class, roll number, or phone — collect multi-department fees with instant PDF receipt.
              </p>
            </div>

            {selectedStudent && (
              <button
                onClick={() => {
                  setSelectedStudent(null);
                  setLedgerData(null);
                  setSelectedItems({});
                }}
                className="btn btn-neutral"
              >
                <i className="ti ti-user-search"></i> Switch Student
              </button>
            )}
          </div>

          {/* SECTION 1: STUDENT SEARCH & FILTER BAR */}
          <div className="card mb-6" style={{ padding: 14 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              {/* Class Filter */}
              <div style={{ minWidth: 160 }}>
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="form-select"
                  style={{ height: 38, fontWeight: 700 }}
                >
                  <option value="">All Classes</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.section || ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Search Query */}
              <div style={{ flex: 1, minWidth: 240, position: 'relative' }}>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search student name, roll no, admission no, father name, or mobile..."
                  className="form-input"
                  style={{ width: '100%', height: 38, paddingLeft: 12 }}
                />
              </div>

              {/* Only Pending Dues Filter */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={onlyPending}
                  onChange={(e) => setOnlyPending(e.target.checked)}
                  style={{ width: 16, height: 16 }}
                />
                <span>Only Pending Dues</span>
              </label>

              <button
                onClick={fetchStudents}
                className="btn btn-neutral"
                style={{ height: 38, padding: '0 12px' }}
                title="Refresh List"
              >
                <i className="ti ti-refresh"></i>
              </button>
            </div>

            {/* Quick Student Selection Grid/Table if no student is active or searching */}
            {!selectedStudent && (
              <div style={{ marginTop: 14 }}>
                {loadingList ? (
                  <div className="empty-state" style={{ padding: '24px 0' }}>
                    <div className="spinner" style={{ width: 24, height: 24 }}></div>
                    <p className="text-xs text-muted mt-2">Loading students...</p>
                  </div>
                ) : studentList.length === 0 ? (
                  <div className="empty-state" style={{ padding: '24px 0' }}>
                    <i className="ti ti-user-x" style={{ fontSize: 32, color: 'var(--neutral-4)' }}></i>
                    <h4 style={{ marginTop: 8 }}>No Students Found</h4>
                    <p className="text-xs text-muted">Try changing the class filter or unchecking 'Only Pending Dues'.</p>
                  </div>
                ) : (
                  <div className="table-container" style={{ maxHeight: 320, overflowY: 'auto' }}>
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Student Name</th>
                          <th>Class & Section</th>
                          <th>Roll No</th>
                          <th>Admission No</th>
                          <th>Father Name</th>
                          <th>Parent Mobile</th>
                          <th style={{ textAlign: 'right' }}>Pending Dues</th>
                          <th style={{ textAlign: 'center' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {studentList.map((s) => (
                          <tr
                            key={s.id}
                            onClick={() => loadStudentLedger(s.id)}
                            style={{ cursor: 'pointer' }}
                          >
                            <td style={{ fontWeight: 700, color: 'var(--neutral-9)' }}>{s.name}</td>
                            <td>
                              <span className="badge badge-info" style={{ fontSize: 11 }}>{s.class_name}</span>
                            </td>
                            <td style={{ fontWeight: 600 }}>{s.roll_no || '—'}</td>
                            <td style={{ fontFamily: 'monospace', color: 'var(--neutral-6)' }}>{s.admission_no}</td>
                            <td>{s.father_name || '—'}</td>
                            <td>{s.parent_phone || '—'}</td>
                            <td style={{ textAlign: 'right', fontWeight: 800, color: s.outstanding > 0 ? '#dd7a01' : '#2e844a' }}>
                              {fmt(s.outstanding)}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button className="btn btn-primary btn-sm">
                                Collect Fees
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SECTION 2: PAYMENT WORKSPACE (WHEN STUDENT IS SELECTED) */}
          {loadingLedger ? (
            <div className="empty-state">
              <div className="spinner" style={{ width: 32, height: 32 }}></div>
              <p className="mt-4">Loading student financial ledger & pending bills...</p>
            </div>
          ) : selectedStudent && ledgerData ? (
            <div className="grid-3 mb-6" style={{ gridTemplateColumns: '1fr 2fr' }}>
              {/* Left Column: Student Details Card */}
              <div className="card">
                <div className="card-header">
                  <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, margin: 0 }}>Selected Student</h3>
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
                      <h3 style={{ fontSize: '1.0625rem', fontWeight: 800, margin: 0 }}>{selectedStudent?.name}</h3>
                      <div className="text-xs text-muted" style={{ fontWeight: 600, marginTop: 2 }}>
                        Class: {selectedStudent?.class_name} • Roll No: {selectedStudent?.roll_no || '—'}
                      </div>
                      <div className="text-xs text-muted">
                        Adm No: <strong>{selectedStudent?.admission_no}</strong>
                      </div>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid var(--neutral-2)', paddingTop: 12, marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0' }}>
                      <span className="text-muted">Father Name:</span>
                      <span style={{ fontWeight: 700 }}>{selectedStudent?.father_name || '—'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0' }}>
                      <span className="text-muted">Parent Mobile:</span>
                      <span style={{ fontWeight: 700 }}>{selectedStudent?.parent_phone || '—'}</span>
                    </div>
                  </div>

                  {/* Outstanding Summary */}
                  <div className="stat-card mb-4" style={{ padding: 14, background: '#fef5e4', borderColor: '#fdd9a0' }}>
                    <div className="stat-label" style={{ color: '#dd7a01', margin: 0 }}>Total Pending Dues</div>
                    <div className="stat-value" style={{ fontSize: '1.75rem', color: '#dd7a01', marginTop: 4 }}>
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
                    <span style={{ fontWeight: 700, color: '#0176d3' }}>{fmt(ledgerData?.advance_credit || ledgerData?.advance_balance)}</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Itemized Dues & Payment Form */}
              <div className="card">
                <div className="card-header">
                  <div>
                    <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, margin: 0 }}>Itemized Dues & Service Selection</h3>
                    <p className="text-xs text-muted" style={{ margin: 0 }}>
                      Select specific fee heads to pay (Tuition, Transport, Library, etc.).
                    </p>
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
                              <th>Bill Period</th>
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
                                <td style={{ fontSize: 12, color: 'var(--neutral-6)' }}>{it.bill_period}</td>
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

                    {/* Payment Mode & Transaction Details */}
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
                        style={{ height: 42, padding: '0 24px', fontSize: '0.875rem' }}
                      >
                        <i className="ti ti-check"></i>
                        {collecting ? 'Processing Payment...' : 'Collect & Issue Receipt'}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          ) : null}

          {/* Success Official Receipt Modal (Direct PDF Download in Front of Cashier) */}
          {receiptModal && (
            <div className="modal-backdrop">
              <div className="modal">
                <div className="modal-header">
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0, color: '#2e844a' }}>
                    ✓ Payment Collected Successfully
                  </h3>
                  <button onClick={() => setReceiptModal(null)} className="modal-close">✕</button>
                </div>

                <div className="modal-body">
                  <div style={{ textAlign: 'center', padding: '10px 0 16px' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--neutral-6)' }}>
                      Official Receipt Number
                    </div>
                    <div style={{ fontSize: '1.625rem', fontWeight: 800, fontFamily: 'monospace', color: 'var(--blue-60)', margin: '4px 0' }}>
                      {receiptModal.receipt_no}
                    </div>
                    <div style={{ fontSize: '1.375rem', fontWeight: 800, color: '#2e844a' }}>
                      {fmt(receiptModal.total_paid)}
                    </div>
                    <div className="text-xs text-muted mt-1">
                      Student: <strong>{selectedStudent?.name}</strong> ({selectedStudent?.admission_no})
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

                  <div className="alert alert-success" style={{ fontSize: 12 }}>
                    Payment has been posted to Central Financial Ledger. All departments credited.
                  </div>
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
                    className="btn btn-primary btn-lg"
                    style={{ background: '#2e844a', borderColor: '#2e844a' }}
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
