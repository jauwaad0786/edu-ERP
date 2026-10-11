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

  // Fee Heads for Concession / Maafi
  const [feeHeads, setFeeHeads] = useState([]);

  // Payment Allocation State
  const [paymentMode, setPaymentMode] = useState('UPI');
  const [transactionRef, setTransactionRef] = useState('');
  const [remarks, setRemarks] = useState('');
  const [selectedItems, setSelectedItems] = useState({}); // { itemId: { ... } }
  const [collecting, setCollecting] = useState(false);

  // Multi-Month Package State (1, 3, 6, 12 Months & Custom)
  const [collectionTab, setCollectionTab] = useState('MULTI_MONTH'); // 'MULTI_MONTH' | 'ITEMIZED'
  const [scheduleData, setScheduleData] = useState(null);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [selectedMonths, setSelectedMonths] = useState([]);
  const [activePreset, setActivePreset] = useState('1_month');
  const [multiMonthPayingAmount, setMultiMonthPayingAmount] = useState(0);
  const [generatingDemandNotice, setGeneratingDemandNotice] = useState(false);

  // Instant Concession / Maafi Form State
  const [concHeadId, setConcHeadId] = useState('');
  const [concType, setConcType] = useState('WAIVER');
  const [concDiscountType, setConcDiscountType] = useState('FIXED');
  const [concDiscountValue, setConcDiscountValue] = useState('');
  const [concReason, setConcReason] = useState('');
  const [applyingConc, setApplyingConc] = useState(false);

  // Receipt Modal State
  const [receiptModal, setReceiptModal] = useState(null);

  // 1. Fetch Classes & Fee Heads on mount
  useEffect(() => {
    api.get('/principal/classes')
      .then((res) => setClasses(res.data || []))
      .catch(() => {});
    api.get('/fees-finance/heads')
      .then((res) => setFeeHeads(res.data || []))
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

  // Helper to sync multi-month presets from schedule
  const initSchedulePresets = (sched) => {
    if (!sched?.presets) return;
    const p1 = sched.presets['1_month'];
    if (p1 && p1.months?.length > 0) {
      setSelectedMonths(p1.months);
      setActivePreset('1_month');
      setMultiMonthPayingAmount(p1.amount_payable);
    } else {
      const unpaid = (sched.months || []).filter((m) => m.balance > 0);
      if (unpaid.length > 0) {
        setSelectedMonths([unpaid[0].month_code]);
        setActivePreset('custom');
        setMultiMonthPayingAmount(unpaid[0].balance);
      } else {
        setSelectedMonths([]);
        setActivePreset('custom');
        setMultiMonthPayingAmount(0);
      }
    }
  };

  // 3. Load Student Ledger and Multi-Month Schedule when selected or via URL param
  const loadStudentLedger = async (studentId) => {
    try {
      setLoadingLedger(true);
      setLoadingSchedule(true);
      const [ledgerRes, schedRes] = await Promise.allSettled([
        api.get(`/fees-finance/students/${studentId}/ledger`),
        api.get(`/fees-finance/students/${studentId}/multi-month-schedule`),
      ]);

      if (ledgerRes.status === 'fulfilled') {
        const res = ledgerRes.value;
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

          const prevDuesAmount = (b.previous_dues || 0);
          if (prevDuesAmount > 0) {
            const itemsPaid = (b.items || []).reduce((acc, it) => acc + (it.paid_amount || 0), 0);
            const totalPaidOnBill = (b.amount_paid || 0);
            const prevDuesPaid = Math.max(0, totalPaidOnBill - itemsPaid);
            const prevDuesBal = Math.max(0, prevDuesAmount - prevDuesPaid);
            if (prevDuesBal > 0) {
              initialSelection[`prev_dues_${b.id}`] = {
                bill_id: b.id,
                bill_no: b.bill_no,
                bill_period: b.bill_period_label || b.bill_month,
                bill_item_id: null,
                fee_head_id: null,
                fee_head_name: 'Previous Dues / Opening Balance',
                department: 'ACCOUNTS',
                amount: prevDuesBal,
                max: prevDuesBal,
                selected: true,
              };
            }
          }
        });
        setSelectedItems(initialSelection);
      }

      if (schedRes.status === 'fulfilled') {
        const sdata = schedRes.value.data;
        setScheduleData(sdata);
        initSchedulePresets(sdata);
      }
    } catch (err) {
      toast.error('Failed to load student ledger or fee schedule');
    } finally {
      setLoadingLedger(false);
      setLoadingSchedule(false);
    }
  };

  useEffect(() => {
    const studentIdParam = searchParams.get('student_id');
    if (studentIdParam) {
      loadStudentLedger(studentIdParam);
    }
  }, [searchParams]);

  // Preset Selection Handler
  const applyPreset = (presetKey) => {
    if (!scheduleData?.presets?.[presetKey]) return;
    const p = scheduleData.presets[presetKey];
    setActivePreset(presetKey);
    setSelectedMonths(p.months || []);
    setMultiMonthPayingAmount(p.amount_payable || 0);
  };

  // Toggle single month in custom mode
  const toggleMonth = (monthCode) => {
    setActivePreset('custom');
    let updated;
    if (selectedMonths.includes(monthCode)) {
      updated = selectedMonths.filter((m) => m !== monthCode);
    } else {
      updated = [...selectedMonths, monthCode];
    }
    setSelectedMonths(updated);

    // Calculate total payable for updated months from schedule
    if (scheduleData?.months) {
      const selObjs = scheduleData.months.filter((m) => updated.includes(m.month_code));
      const payable = selObjs.reduce((sum, m) => sum + (m.balance || 0), 0);
      setMultiMonthPayingAmount(payable);
    }
  };

  // Calculated figures for currently selected months
  const selectedMonthsDetails = useMemo(() => {
    if (!scheduleData?.months) return [];
    return scheduleData.months.filter((m) => selectedMonths.includes(m.month_code));
  }, [scheduleData, selectedMonths]);

  const multiMonthBase = selectedMonthsDetails.reduce((sum, m) => sum + (m.original_amount || 0), 0);
  const multiMonthDisc = selectedMonthsDetails.reduce((sum, m) => sum + (m.discount_amount || 0), 0);
  const multiMonthFine = selectedMonthsDetails.reduce((sum, m) => sum + (m.fine_amount || 0), 0);
  const multiMonthPayable = selectedMonthsDetails.reduce((sum, m) => sum + (m.balance || 0), 0);

  // Submit Multi-Month Payment
  const handleCollectMultiMonthPayment = async (e) => {
    e.preventDefault();
    if (!selectedStudent) {
      toast.error('Please select a student first');
      return;
    }
    if (selectedMonths.length === 0) {
      toast.error('Please select at least one month to pay');
      return;
    }
    const payAmt = parseFloat(multiMonthPayingAmount);
    if (!payAmt || payAmt <= 0) {
      toast.error('Payment amount must be greater than ₹0');
      return;
    }

    try {
      setCollecting(true);
      const idempotencyKey = `mm_pay_${selectedStudent.id}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const payload = {
        months: selectedMonths,
        amount_paid: payAmt,
        payment_mode: paymentMode,
        transaction_ref: transactionRef.trim(),
        remarks: remarks.trim() || `Multi-month fee payment for ${selectedMonths.join(', ')}`,
        session: ledgerData?.session || scheduleData?.session || '2026-27',
        idempotency_key: idempotencyKey,
      };

      const res = await api.post(`/fees-finance/students/${selectedStudent.id}/pay-multi-month`, payload);
      toast.success(res.data?.message || `Payment Collected! Receipt No: ${res.data.receipt_no}`);
      setReceiptModal(res.data);
      loadStudentLedger(selectedStudent.id);
      fetchStudents();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Multi-month payment collection failed');
    } finally {
      setCollecting(false);
    }
  };

  // Generate Demand Bill / Payment Request Notice (Without payment)
  const handleGenerateDemandNotice = async () => {
    if (!selectedStudent) {
      toast.error('Please select a student first');
      return;
    }
    if (selectedMonths.length === 0) {
      toast.error('Please select at least one month for the demand bill');
      return;
    }

    try {
      setGeneratingDemandNotice(true);
      const payload = {
        months: selectedMonths,
        due_date: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
        session: ledgerData?.session || scheduleData?.session || '2026-27',
      };

      const res = await api.post(`/fees-finance/students/${selectedStudent.id}/generate-demand-notice`, payload);
      toast.success(res.data?.message || `Demand Bill / Payment Notice generated for ${selectedMonths.length} month(s)!`);
      loadStudentLedger(selectedStudent.id);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to generate demand notice');
    } finally {
      setGeneratingDemandNotice(false);
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
        amount: totalToPay,
        amount_paid: totalToPay,
        total_amount: totalToPay,
        payment_mode: paymentMode,
        transaction_ref: transactionRef,
        allocations: allocations,
        department: (function() {
          const depts = new Set(Object.values(selectedItems).filter(it => it.selected && it.amount > 0).map(it => it.department || 'ACCOUNTS'));
          return depts.size === 1 ? Array.from(depts)[0] : 'ACCOUNTS';
        })(),
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

  // Instant Scholarship / Fee Waiver (Maafi)
  const handleApplyConcession = async (e) => {
    e.preventDefault();
    if (!selectedStudent) {
      toast.error('Please select a student first');
      return;
    }
    if (!concDiscountValue || parseFloat(concDiscountValue) <= 0) {
      toast.error('Enter a valid discount / waiver amount');
      return;
    }
    if (!concReason.trim()) {
      toast.error('Please enter a reason or approval note');
      return;
    }

    try {
      setApplyingConc(true);
      const payload = {
        student_id: selectedStudent.id,
        fee_head_id: concHeadId ? parseInt(concHeadId) : null,
        concession_type: concType,
        discount_type: concDiscountType,
        discount_value: parseFloat(concDiscountValue),
        reason: concReason.trim(),
        session: '2026-27',
      };

      await api.post('/fees-finance/concessions', payload);
      toast.success('Scholarship / Fee Waiver (Maafi) applied successfully!');
      setConcDiscountValue('');
      setConcReason('');
      loadStudentLedger(selectedStudent.id);
      fetchStudents();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to apply concession');
    } finally {
      setApplyingConc(false);
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
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  loadStudentLedger(s.id);
                                }}
                              >
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
            <>
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

                {/* Right Column: Multi-Month Package & Itemized Dues Tabs */}
                <div className="card">
                  {/* Mode Selector Tabs */}
                  <div style={{ display: 'flex', borderBottom: '1px solid var(--neutral-2)', background: '#f8fafc', padding: '8px 12px', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setCollectionTab('MULTI_MONTH')}
                      className={`btn btn-sm ${collectionTab === 'MULTI_MONTH' ? 'btn-primary' : 'btn-neutral'}`}
                      style={{ fontWeight: 700 }}
                    >
                      <i className="ti ti-calendar-event"></i> Multi-Month Package (1, 3, 6, 12 Months)
                    </button>
                    <button
                      type="button"
                      onClick={() => setCollectionTab('ITEMIZED')}
                      className={`btn btn-sm ${collectionTab === 'ITEMIZED' ? 'btn-primary' : 'btn-neutral'}`}
                      style={{ fontWeight: 700 }}
                    >
                      <i className="ti ti-list-check"></i> Itemized Dues POS ({Object.keys(selectedItems).length})
                    </button>
                  </div>

                  {collectionTab === 'MULTI_MONTH' ? (
                    /* TAB 1: MULTI-MONTH PAYMENT WORKFLOW */
                    <form onSubmit={handleCollectMultiMonthPayment}>
                      <div className="card-header" style={{ padding: '12px 16px', borderBottom: '1px solid var(--neutral-2)' }}>
                        <div>
                          <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, margin: 0 }}>
                            Multi-Month Package Payment
                          </h3>
                          <p className="text-xs text-muted" style={{ margin: 0 }}>
                            Pay 1 month, quarterly (3 mo), half-yearly (6 mo), or annual (12 mo) in a single consolidated transaction.
                          </p>
                        </div>
                        <span className="badge badge-success">Idempotent & Reconciled</span>
                      </div>

                      <div className="card-body" style={{ padding: 16 }}>
                        {/* Period Preset Options */}
                        <div style={{ marginBottom: 14 }}>
                          <label className="form-label" style={{ marginBottom: 6, fontWeight: 700 }}>
                            Select Payment Period:
                          </label>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {[
                              { key: '1_month', label: '1 Month', icon: 'ti-calendar' },
                              { key: '3_months', label: '3 Months (Quarterly)', icon: 'ti-calendar-plus' },
                              { key: '6_months', label: '6 Months (Half-Yearly)', icon: 'ti-calendar-stats' },
                              { key: '12_months', label: '1 Year (Annual)', icon: 'ti-calendar-star' },
                              { key: 'custom', label: 'Custom Months', icon: 'ti-adjustments' },
                            ].map((preset) => {
                              const isPresetActive = activePreset === preset.key;
                              const pData = scheduleData?.presets?.[preset.key];
                              const isDisabled = preset.key !== 'custom' && (!pData || !pData.is_available);
                              return (
                                <button
                                  key={preset.key}
                                  type="button"
                                  disabled={isDisabled}
                                  onClick={() => {
                                    if (preset.key === 'custom') {
                                      setActivePreset('custom');
                                    } else {
                                      applyPreset(preset.key);
                                    }
                                  }}
                                  className={`btn btn-sm ${isPresetActive ? 'btn-primary' : 'btn-neutral'}`}
                                  style={{
                                    fontWeight: 700,
                                    borderColor: isPresetActive ? 'var(--blue-60)' : 'var(--neutral-3)',
                                    opacity: isDisabled ? 0.4 : 1,
                                  }}
                                >
                                  <i className={`ti ${preset.icon}`}></i> {preset.label}
                                  {pData && pData.amount_payable > 0 && (
                                    <span style={{ marginLeft: 4, opacity: 0.85, fontSize: 11 }}>
                                      ({fmt(pData.amount_payable)})
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Schedule Months Matrix */}
                        {loadingSchedule ? (
                          <div className="empty-state" style={{ padding: '20px 0' }}>
                            <div className="spinner" style={{ width: 20, height: 20 }}></div>
                            <p className="text-xs text-muted mt-2">Loading academic session schedule...</p>
                          </div>
                        ) : !scheduleData?.months || scheduleData.months.length === 0 ? (
                          <div className="alert alert-info" style={{ fontSize: 12 }}>
                            No fee schedule found for this student. Configure class fee structures first.
                          </div>
                        ) : (
                          <div className="table-container mb-4" style={{ maxHeight: 280, overflowY: 'auto', border: '1px solid var(--neutral-2)' }}>
                            <table className="table">
                              <thead>
                                <tr>
                                  <th style={{ width: 36 }}></th>
                                  <th>Month</th>
                                  <th style={{ textAlign: 'right' }}>Base Charges</th>
                                  <th style={{ textAlign: 'right' }}>Waiver/Maafi</th>
                                  <th style={{ textAlign: 'right' }}>Late Fine</th>
                                  <th style={{ textAlign: 'right' }}>Balance Due</th>
                                  <th style={{ textAlign: 'center', width: 110 }}>Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {scheduleData.months.map((m) => {
                                  const isSelected = selectedMonths.includes(m.month_code);
                                  const isPaid = m.is_paid || m.balance <= 0;
                                  return (
                                    <tr
                                      key={m.month_code}
                                      onClick={() => !isPaid && toggleMonth(m.month_code)}
                                      style={{
                                        cursor: isPaid ? 'default' : 'pointer',
                                        background: isSelected ? '#eff6ff' : isPaid ? '#f8fafc' : 'transparent',
                                        opacity: isPaid ? 0.7 : 1,
                                      }}
                                    >
                                      <td>
                                        <input
                                          type="checkbox"
                                          disabled={isPaid}
                                          checked={isSelected}
                                          onChange={() => toggleMonth(m.month_code)}
                                          style={{ cursor: isPaid ? 'default' : 'pointer' }}
                                        />
                                      </td>
                                      <td style={{ fontWeight: 700 }}>
                                        {m.month_label}
                                        {m.bill_no && (
                                          <span className="text-xs text-muted" style={{ display: 'block', fontWeight: 400 }}>
                                            Bill: {m.bill_no}
                                          </span>
                                        )}
                                      </td>
                                      <td style={{ textAlign: 'right' }}>{fmt(m.original_amount)}</td>
                                      <td style={{ textAlign: 'right', color: m.discount_amount > 0 ? '#16a34a' : 'inherit' }}>
                                        {m.discount_amount > 0 ? `-${fmt(m.discount_amount)}` : '—'}
                                      </td>
                                      <td style={{ textAlign: 'right', color: m.fine_amount > 0 ? '#dc2626' : 'inherit' }}>
                                        {m.fine_amount > 0 ? `+${fmt(m.fine_amount)}` : '—'}
                                      </td>
                                      <td style={{ textAlign: 'right', fontWeight: 800, color: m.balance > 0 ? '#dd7a01' : '#2e844a' }}>
                                        {fmt(m.balance)}
                                      </td>
                                      <td style={{ textAlign: 'center' }}>
                                        {isPaid ? (
                                          <span className="badge badge-success" style={{ fontSize: 10 }}>PAID</span>
                                        ) : m.is_partial ? (
                                          <span className="badge badge-warning" style={{ fontSize: 10 }}>PARTIAL</span>
                                        ) : m.status === 'OVERDUE' ? (
                                          <span className="badge badge-error" style={{ fontSize: 10 }}>OVERDUE</span>
                                        ) : (
                                          <span className="badge badge-neutral" style={{ fontSize: 10 }}>UPCOMING</span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {/* Calculation Summary Box */}
                        <div style={{ background: '#f8fafc', border: '1px solid var(--neutral-2)', borderRadius: 8, padding: 12, marginBottom: 14 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--neutral-7)' }}>
                              SELECTED MONTHS ({selectedMonths.length}):
                            </span>
                            <span style={{ fontSize: 12, fontWeight: 600 }}>
                              {selectedMonthsDetails.map((m) => m.month_label).join(', ') || 'None selected'}
                            </span>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, textAlign: 'center', background: '#ffffff', padding: 8, borderRadius: 6, border: '1px solid var(--neutral-2)' }}>
                            <div>
                              <div style={{ fontSize: 11, color: 'var(--neutral-5)' }}>Base Fee</div>
                              <div style={{ fontWeight: 700 }}>{fmt(multiMonthBase)}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: 11, color: '#16a34a' }}>Discounts/Maafi</div>
                              <div style={{ fontWeight: 700, color: '#16a34a' }}>-{fmt(multiMonthDisc)}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: 11, color: '#dc2626' }}>Late Fines</div>
                              <div style={{ fontWeight: 700, color: '#dc2626' }}>+{fmt(multiMonthFine)}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: 11, color: 'var(--blue-60)', fontWeight: 700 }}>Total Payable</div>
                              <div style={{ fontWeight: 800, color: 'var(--blue-60)' }}>{fmt(multiMonthPayable)}</div>
                            </div>
                          </div>
                        </div>

                        {/* Payment Details Form */}
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
                            <label className="form-label">Transaction Ref / UTR</label>
                            <input
                              type="text"
                              value={transactionRef}
                              onChange={(e) => setTransactionRef(e.target.value)}
                              placeholder="e.g. UPI-9988776655"
                              className="form-input"
                            />
                          </div>

                          <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">Amount to Collect (₹)</label>
                            <input
                              type="number"
                              min="1"
                              step="any"
                              value={multiMonthPayingAmount}
                              onChange={(e) => setMultiMonthPayingAmount(e.target.value)}
                              className="form-input"
                              style={{ fontWeight: 800, color: '#2e844a' }}
                            />
                          </div>
                        </div>

                        {/* Dual Action Bar: Collect Payment vs Demand Bill Notice */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#eaf5ea', border: '1px solid #a9d6b3', borderRadius: 8, padding: '12px 16px', flexWrap: 'wrap', gap: 10 }}>
                          <div>
                            <span className="text-xs font-semibold" style={{ color: '#2e844a' }}>PAYABLE TOTAL:</span>
                            <div style={{ fontSize: '1.375rem', fontWeight: 800, color: '#2e844a' }}>
                              {fmt(multiMonthPayingAmount || multiMonthPayable)}
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: 8 }}>
                            <button
                              type="button"
                              disabled={generatingDemandNotice || selectedMonths.length === 0}
                              onClick={handleGenerateDemandNotice}
                              className="btn btn-neutral"
                              style={{ height: 42, padding: '0 16px', fontWeight: 700 }}
                              title="Generate an official Demand Bill / Payment Request without recording a payment"
                            >
                              <i className="ti ti-file-invoice"></i>
                              {generatingDemandNotice ? 'Generating...' : 'Issue Demand Bill'}
                            </button>

                            <button
                              type="submit"
                              disabled={collecting || selectedMonths.length === 0 || !multiMonthPayingAmount || parseFloat(multiMonthPayingAmount) <= 0}
                              className="btn btn-primary"
                              style={{ height: 42, padding: '0 24px', fontSize: '0.875rem', fontWeight: 700 }}
                            >
                              <i className="ti ti-check"></i>
                              {collecting ? 'Processing Payment...' : 'Collect & Issue Receipt'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </form>
                  ) : (
                    /* TAB 2: ITEMIZED DUES SELECTION WORKFLOW */
                    <form onSubmit={handleCollectPayment}>
                      <div className="card-header" style={{ padding: '12px 16px', borderBottom: '1px solid var(--neutral-2)' }}>
                        <div>
                          <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, margin: 0 }}>Itemized Dues & Service Selection</h3>
                          <p className="text-xs text-muted" style={{ margin: 0 }}>
                            Select specific fee heads to pay (Tuition, Transport, Library, etc.).
                          </p>
                        </div>
                        <span className="badge badge-info">{Object.keys(selectedItems).length} Payable Items</span>
                      </div>

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
                  )}
                </div>
              </div>

              {/* SECTION 3: INSTANT CONCESSION / SCHOLARSHIP / MAAFI FOR THIS STUDENT */}
              <div className="card mb-6" style={{ borderLeft: '4px solid #0176d3' }}>
                <div className="card-header">
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>
                      <i className="ti ti-percentage" style={{ marginRight: 6, color: '#0176d3' }}></i>
                      Apply Scholarship / Fee Waiver (Maafi) for this Student
                    </h3>
                    <p className="text-xs text-muted" style={{ margin: 0 }}>
                      Grant instant fee reduction, merit scholarship, sibling discount, or fee waiver (maafi) for {selectedStudent?.name}.
                    </p>
                  </div>
                  <span className="badge badge-info">Instant Discount / Maafi</span>
                </div>

                <form onSubmit={handleApplyConcession}>
                  <div className="card-body" style={{ padding: 16 }}>
                    <div className="grid-4 mb-3">
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Applicable Fee Head</label>
                        <select
                          value={concHeadId}
                          onChange={(e) => setConcHeadId(e.target.value)}
                          className="form-select"
                        >
                          <option value="">All Fees (Entire Bill)</option>
                          {feeHeads.map((h) => (
                            <option key={h.id} value={h.id}>
                              {h.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Type / Category</label>
                        <select
                          value={concType}
                          onChange={(e) => setConcType(e.target.value)}
                          className="form-select"
                          style={{ fontWeight: 700 }}
                        >
                          <option value="WAIVER">Fee Waiver / Maafi</option>
                          <option value="SCHOLARSHIP">Merit Scholarship</option>
                          <option value="SIBLING">Sibling Discount</option>
                          <option value="STAFF_CHILD">Staff Child Concession</option>
                          <option value="PRINCIPAL_SPECIAL">Principal Special Maafi</option>
                        </select>
                      </div>

                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Discount Mode</label>
                        <select
                          value={concDiscountType}
                          onChange={(e) => setConcDiscountType(e.target.value)}
                          className="form-select"
                        >
                          <option value="FIXED">Fixed Amount (₹)</option>
                          <option value="PERCENTAGE">Percentage (%)</option>
                        </select>
                      </div>

                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">
                          Discount / Maafi Value ({concDiscountType === 'PERCENTAGE' ? '%' : '₹'})
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={concDiscountValue}
                          onChange={(e) => setConcDiscountValue(e.target.value)}
                          placeholder={concDiscountType === 'PERCENTAGE' ? 'e.g. 20%' : 'e.g. 500'}
                          required
                          className="form-input"
                          style={{ fontWeight: 700 }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                      <div className="form-group" style={{ flex: 1, margin: 0 }}>
                        <label className="form-label">Reason / Approval Note (Maafi Reason)</label>
                        <input
                          type="text"
                          value={concReason}
                          onChange={(e) => setConcReason(e.target.value)}
                          placeholder="e.g. Principal approved ₹500 maafi on tuition fees for this term"
                          required
                          className="form-input"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={applyingConc}
                        className="btn btn-primary"
                        style={{ height: 38, background: '#0176d3', borderColor: '#0176d3', padding: '0 20px' }}
                      >
                        <i className="ti ti-check"></i>
                        {applyingConc ? 'Applying...' : 'Apply Maafi / Concession'}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </>
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
                      {fmt(receiptModal.total_paid || receiptModal.payment?.total_paid)}
                    </div>
                    <div className="text-xs text-muted mt-1">
                      Student: <strong>{selectedStudent?.name}</strong> ({selectedStudent?.admission_no})
                    </div>
                    {(receiptModal.months_covered || receiptModal.payment?.months_covered) && (
                      <div style={{ marginTop: 8 }}>
                        <span className="badge badge-info" style={{ fontSize: 11 }}>
                          Months Covered: {(receiptModal.months_covered || receiptModal.payment?.months_covered).join(', ')}
                        </span>
                      </div>
                    )}
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
                        {(receiptModal.allocations || receiptModal.payment?.allocations)?.map((alc, idx) => (
                          <tr key={idx}>
                            <td style={{ fontWeight: 600 }}>{alc.fee_head_name || 'General Fee'}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: '#2e844a' }}>
                              {fmt(alc.allocated_amount || alc.amount)}
                            </td>
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
                    onClick={() => downloadReceiptPDF(receiptModal.payment_id || receiptModal.payment?.id, receiptModal.receipt_no)}
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
