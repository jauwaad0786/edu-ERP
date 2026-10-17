import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { resolveTenantPath } from '../../utils/routeBuilder';

export default function CautionMoneyPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [deposits, setDeposits] = useState([]);
  const [summary, setSummary] = useState({
    total_held_escrow: 0,
    total_collected: 0,
    total_offset: 0,
    total_refunded: 0,
    deposits_count: 0,
    held_count: 0
  });
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Collect Modal
  const [collectModal, setCollectModal] = useState(false);
  const [collecting, setCollecting] = useState(false);
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [studentSearchResults, setStudentSearchResults] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [collectForm, setCollectForm] = useState({
    deposit_amount: '',
    deposit_date: new Date().toISOString().split('T')[0],
    payment_mode: 'BANK_TRANSFER',
    transaction_ref: '',
    notes: 'Admission Security Deposit (Refundable at Graduation Clearance)'
  });

  // Clearance Wizard Modal
  const [clearanceModal, setClearanceModal] = useState(false);
  const [clearingStudentId, setClearingStudentId] = useState(null);
  const [clearanceLoading, setClearanceLoading] = useState(false);
  const [clearancePreview, setClearancePreview] = useState(null);
  const [settling, setSettling] = useState(false);
  const [settlementForm, setSettlementForm] = useState({
    payment_mode: 'BANK_TRANSFER',
    refund_ref_no: '',
    notes: 'Graduation clearance completed. Escrow offset applied to outstanding arrears and net balance refunded.'
  });
  const [settlementSuccessResult, setSettlementSuccessResult] = useState(null);

  // Receipt Modal
  const [receiptModal, setReceiptModal] = useState(false);
  const [activeReceipt, setActiveReceipt] = useState(null);

  const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

  // Fetch deposits & metrics
  const fetchDeposits = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page,
        per_page: perPage,
        status: statusFilter
      });
      if (search.trim()) params.append('search', search.trim());

      const res = await api.get(`/fees-finance/caution-money?${params.toString()}`);
      if (res.data?.success) {
        setDeposits(res.data.deposits || []);
        setSummary(res.data.summary || {
          total_held_escrow: 0,
          total_collected: 0,
          total_offset: 0,
          total_refunded: 0,
          deposits_count: 0,
          held_count: 0
        });
        setTotalPages(res.data.pages || 1);
      }
    } catch (err) {
      toast.error('Failed to load caution money deposits');
    } finally {
      setLoading(false);
    }
  }, [page, perPage, statusFilter, search]);

  useEffect(() => {
    fetchDeposits();
  }, [fetchDeposits]);

  // Search Students
  const handleSearchStudents = async (query) => {
    setStudentSearchQuery(query);
    if (!query || query.trim().length < 2) {
      setStudentSearchResults([]);
      return;
    }
    try {
      const res = await api.get(`/fees-finance/students/search?search=${encodeURIComponent(query.trim())}&only_pending=false`);
      setStudentSearchResults(res.data?.students || res.data || []);
    } catch (e) {
      setStudentSearchResults([]);
    }
  };

  // Open Collect Modal
  const openCollectModal = () => {
    setSelectedStudent(null);
    setStudentSearchQuery('');
    setStudentSearchResults([]);
    setCollectForm({
      deposit_amount: '',
      deposit_date: new Date().toISOString().split('T')[0],
      payment_mode: 'BANK_TRANSFER',
      transaction_ref: '',
      notes: 'Admission Security Deposit (Refundable at Graduation Clearance)'
    });
    setCollectModal(true);
  };

  // Submit Collect Deposit
  const handleCollectSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStudent) {
      toast.error('Please select a student');
      return;
    }
    const amt = parseFloat(collectForm.deposit_amount);
    if (!amt || amt <= 0) {
      toast.error('Please enter a valid deposit amount');
      return;
    }

    try {
      setCollecting(true);
      const payload = {
        student_id: selectedStudent.id,
        deposit_amount: amt,
        deposit_date: collectForm.deposit_date,
        payment_mode: collectForm.payment_mode,
        transaction_ref: collectForm.transaction_ref,
        notes: collectForm.notes
      };

      const res = await api.post('/fees-finance/caution-money/collect', payload);
      if (res.data?.success) {
        toast.success(res.data.message || 'Caution deposit collected successfully');
        setCollectModal(false);
        fetchDeposits();
        if (res.data.deposit) {
          setActiveReceipt(res.data.deposit);
          setReceiptModal(true);
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to collect caution deposit');
    } finally {
      setCollecting(false);
    }
  };

  // Open Clearance Wizard
  const openClearanceWizard = async (studentId) => {
    setClearingStudentId(studentId);
    setClearanceModal(true);
    setClearanceLoading(true);
    setClearancePreview(null);
    setSettlementSuccessResult(null);
    setSettlementForm({
      payment_mode: 'BANK_TRANSFER',
      refund_ref_no: '',
      notes: 'Graduation clearance completed. Escrow offset applied to outstanding arrears and net balance refunded.'
    });

    try {
      const res = await api.get(`/fees-finance/caution-money/students/${studentId}/clearance-preview`);
      if (res.data?.success) {
        setClearancePreview(res.data);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to calculate clearance preview');
      setClearanceModal(false);
    } finally {
      setClearanceLoading(false);
    }
  };

  // Execute Settlement
  const handleExecuteSettlement = async (e) => {
    e.preventDefault();
    if (!clearingStudentId || !clearancePreview) return;

    if (!window.confirm(`Are you sure you want to execute clearance settlement for ${clearancePreview.student?.name}? This will offset ₹${clearancePreview.offset_from_caution.toLocaleString()} of unpaid bills and disburse ₹${clearancePreview.net_refund_payable.toLocaleString()} net refund.`)) {
      return;
    }

    try {
      setSettling(true);
      const payload = {
        payment_mode: settlementForm.payment_mode,
        refund_ref_no: settlementForm.refund_ref_no,
        notes: settlementForm.notes
      };

      const res = await api.post(`/fees-finance/caution-money/students/${clearingStudentId}/settle`, payload);
      if (res.data?.success) {
        toast.success('Clearance settlement executed successfully!');
        setSettlementSuccessResult(res.data);
        fetchDeposits();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to execute clearance settlement');
    } finally {
      setSettling(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'HELD':
        return <span className="badge" style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', fontWeight: 700 }}>HELD IN ESCROW</span>;
      case 'PARTIALLY_SETTLED':
        return <span className="badge" style={{ background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a', fontWeight: 700 }}>PARTIALLY SETTLED</span>;
      case 'FULLY_SETTLED':
        return <span className="badge" style={{ background: '#e0e7ff', color: '#3730a3', border: '1px solid #c7d2fe', fontWeight: 700 }}>CLEARED & SETTLED</span>;
      case 'REFUNDED':
        return <span className="badge" style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', fontWeight: 700 }}>REFUNDED</span>;
      default:
        return <span className="badge">{status}</span>;
    }
  };

  return (
    <div className="d-flex">
      <Sidebar />
      <div className="main-content flex-grow-1" style={{ minHeight: '100vh', background: '#f8fafc' }}>
        <Navbar />

        <div className="container-fluid p-4" style={{ maxWidth: 1400 }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#64748b', marginBottom: 4 }}>
                <span onClick={() => navigate(resolveTenantPath(user, '/finance/dashboard'))} style={{ cursor: 'pointer', color: '#0B3B7B', fontWeight: 600 }}>
                  Finance & Fees
                </span>
                <i className="ti ti-chevron-right" style={{ fontSize: 11 }} />
                <span>Caution Money Escrow</span>
              </div>
              <h2 style={{ fontSize: 24, fontWeight: 800, color: '#0B3B7B', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                <i className="ti ti-shield-dollar" style={{ color: '#059669' }} />
                Caution Money Escrow Liability Subledger
              </h2>
              <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 13.5 }}>
                Section 21 Balance Sheet Extension: Refundable security deposits tracked in separate escrow liability. Offsets unpaid Tuition, Hostel, and Transport dues upon graduation clearance.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={openCollectModal}
                className="btn btn-primary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 18px',
                  fontWeight: 700,
                  fontSize: 13,
                  background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                  border: 'none'
                }}
              >
                <i className="ti ti-shield-plus" style={{ fontSize: 16 }} />
                Collect Caution Deposit
              </button>
            </div>
          </div>

          {/* KPI Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 16, marginBottom: 20 }}>
            <div className="card" style={{ padding: '16px 20px', borderRadius: 12, border: '1px solid #e2e8f0', background: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Total Escrow Held
                </span>
                <span style={{ background: '#ecfdf5', color: '#059669', padding: '6px 10px', borderRadius: 8 }}>
                  <i className="ti ti-lock" style={{ fontSize: 18 }} />
                </span>
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: '#047857', marginTop: 8 }}>
                {fmt(summary.total_held_escrow)}
              </div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                Balance Sheet Liability ({summary.held_count} active students)
              </div>
            </div>

            <div className="card" style={{ padding: '16px 20px', borderRadius: 12, border: '1px solid #e2e8f0', background: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Total Collected
                </span>
                <span style={{ background: '#eff6ff', color: '#2563eb', padding: '6px 10px', borderRadius: 8 }}>
                  <i className="ti ti-cash" style={{ fontSize: 18 }} />
                </span>
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: '#0B3B7B', marginTop: 8 }}>
                {fmt(summary.total_collected)}
              </div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                {summary.deposits_count} lifetime security deposits
              </div>
            </div>

            <div className="card" style={{ padding: '16px 20px', borderRadius: 12, border: '1px solid #e2e8f0', background: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Arrears Offset at Clearance
                </span>
                <span style={{ background: '#fffbeb', color: '#d97706', padding: '6px 10px', borderRadius: 8 }}>
                  <i className="ti ti-arrows-right-left" style={{ fontSize: 18 }} />
                </span>
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: '#b45309', marginTop: 8 }}>
                {fmt(summary.total_offset)}
              </div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                Recovered against unpaid bills
              </div>
            </div>

            <div className="card" style={{ padding: '16px 20px', borderRadius: 12, border: '1px solid #e2e8f0', background: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Net Refund Disbursed
                </span>
                <span style={{ background: '#f3e8ff', color: '#9333ea', padding: '6px 10px', borderRadius: 8 }}>
                  <i className="ti ti-receipt-refund" style={{ fontSize: 18 }} />
                </span>
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: '#6b21a8', marginTop: 8 }}>
                {fmt(summary.total_refunded)}
              </div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                Booked as caution refund expense
              </div>
            </div>
          </div>

          {/* Filter Bar & Tabs */}
          <div className="card mb-4" style={{ padding: '14px 18px', borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
              {/* Status Filter Tabs */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {[
                  { id: 'ALL', label: 'All Deposits' },
                  { id: 'HELD', label: 'Held in Escrow' },
                  { id: 'PARTIALLY_SETTLED', label: 'Partially Settled' },
                  { id: 'FULLY_SETTLED', label: 'Cleared & Settled' },
                  { id: 'REFUNDED', label: 'Refunded' }
                ].map(tab => {
                  const active = statusFilter === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setStatusFilter(tab.id);
                        setPage(1);
                      }}
                      className={`btn btn-sm ${active ? 'btn-primary' : 'btn-neutral'}`}
                      style={{
                        borderRadius: 8,
                        fontWeight: active ? 700 : 600,
                        fontSize: 12.5,
                        background: active ? '#0B3B7B' : '#fff'
                      }}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Search Box */}
              <div style={{ display: 'flex', gap: 10, flex: 1, minWidth: 260, maxWidth: 420 }}>
                <div style={{ position: 'relative', width: '100%' }}>
                  <i className="ti ti-search" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Search by student, admission no, receipt..."
                    className="form-control"
                    style={{ paddingLeft: 36, borderRadius: 8, height: 38, fontSize: 13 }}
                  />
                </div>
                <button
                  onClick={() => {
                    setSearch('');
                    setPage(1);
                    fetchDeposits();
                  }}
                  className="btn btn-neutral btn-sm"
                  title="Refresh"
                >
                  <i className="ti ti-refresh" />
                </button>
              </div>
            </div>
          </div>

          {/* Deposits Table */}
          <div className="card" style={{ borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <div className="table-responsive">
              <table className="table" style={{ margin: 0, verticalAlign: 'middle' }}>
                <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <tr>
                    <th style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', padding: '14px 18px' }}>Deposit Receipt</th>
                    <th style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', padding: '14px 18px' }}>Student Info</th>
                    <th style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', padding: '14px 18px', textAlign: 'right' }}>Original Deposit</th>
                    <th style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', padding: '14px 18px', textAlign: 'right' }}>Held in Escrow</th>
                    <th style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', padding: '14px 18px', textAlign: 'right' }}>Offset / Refund</th>
                    <th style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', padding: '14px 18px' }}>Status</th>
                    <th style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', padding: '14px 18px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                        <i className="ti ti-loader ti-spin" style={{ fontSize: 24, display: 'block', marginBottom: 8 }} />
                        Loading caution money escrow records...
                      </td>
                    </tr>
                  ) : deposits.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '50px 20px', color: '#64748b' }}>
                        <div style={{ maxWidth: 400, margin: '0 auto' }}>
                          <i className="ti ti-shield-dollar" style={{ fontSize: 44, color: '#cbd5e1', display: 'block', marginBottom: 12 }} />
                          <h4 style={{ fontSize: 16, fontWeight: 700, color: '#334155' }}>No Caution Money Deposits Found</h4>
                          <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                            {search || statusFilter !== 'ALL' ? 'No deposits match your filter criteria.' : 'Collect caution money security deposits from students during admission to initialize escrow tracking.'}
                          </p>
                          <button onClick={openCollectModal} className="btn btn-primary btn-sm" style={{ marginTop: 14, fontWeight: 700 }}>
                            <i className="ti ti-plus" style={{ marginRight: 6 }} /> Collect Caution Deposit
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    deposits.map((dep) => (
                      <tr key={dep.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '16px 18px' }}>
                          <div style={{ fontWeight: 800, color: '#0B3B7B', fontSize: 13.5 }}>
                            {dep.receipt_no}
                          </div>
                          <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>
                            {dep.deposit_date} • {dep.payment_mode}
                          </div>
                          {dep.transaction_ref && (
                            <div style={{ fontSize: 11, color: '#94a3b8' }}>
                              Ref: {dep.transaction_ref}
                            </div>
                          )}
                        </td>

                        <td style={{ padding: '16px 18px' }}>
                          <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 14 }}>
                            {dep.student_name}
                          </div>
                          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                            Adm: <strong>{dep.student_admission_no}</strong> • {dep.class_name || 'Class'}{dep.section_name ? `-${dep.section_name}` : ''}
                          </div>
                        </td>

                        <td style={{ padding: '16px 18px', textAlign: 'right' }}>
                          <span style={{ fontWeight: 700, color: '#334155', fontSize: 14 }}>
                            {fmt(dep.deposit_amount)}
                          </span>
                        </td>

                        <td style={{ padding: '16px 18px', textAlign: 'right' }}>
                          <span
                            style={{
                              fontWeight: 800,
                              color: dep.held_balance > 0 ? '#047857' : '#94a3b8',
                              fontSize: 14.5,
                              background: dep.held_balance > 0 ? '#ecfdf5' : '#f8fafc',
                              padding: '4px 10px',
                              borderRadius: 8,
                              border: `1px solid ${dep.held_balance > 0 ? '#a7f3d0' : '#e2e8f0'}`
                            }}
                          >
                            {fmt(dep.held_balance)}
                          </span>
                        </td>

                        <td style={{ padding: '16px 18px', textAlign: 'right' }}>
                          <div style={{ fontSize: 12, color: '#475569' }}>
                            <div>Offset: <strong style={{ color: '#b45309' }}>{fmt(dep.offset_amount)}</strong></div>
                            <div>Refund: <strong style={{ color: '#6b21a8' }}>{fmt(dep.refunded_amount)}</strong></div>
                          </div>
                        </td>

                        <td style={{ padding: '16px 18px' }}>
                          {getStatusBadge(dep.status)}
                          {dep.settlement_date && (
                            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                              Cleared: {dep.settlement_date}
                            </div>
                          )}
                        </td>

                        <td style={{ padding: '16px 18px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: 6 }}>
                            {/* Graduation Clearance Button for Held deposits */}
                            {dep.held_balance > 0 && (
                              <button
                                onClick={() => openClearanceWizard(dep.student_id)}
                                className="btn btn-sm"
                                title="Run Graduation Clearance & Offset Debts"
                                style={{
                                  background: '#047857',
                                  color: '#fff',
                                  fontWeight: 700,
                                  fontSize: 11.5,
                                  padding: '5px 12px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  borderRadius: 8
                                }}
                              >
                                <i className="ti ti-checklist" /> Clearance & Offset
                              </button>
                            )}

                            <button
                              onClick={() => navigate(resolveTenantPath(user, `/finance/students/${dep.student_id}/ledger`))}
                              className="btn btn-neutral btn-sm"
                              title="View Student Ledger"
                              style={{ padding: '5px 10px', fontSize: 12 }}
                            >
                              <i className="ti ti-file-analytics" />
                            </button>

                            <button
                              onClick={() => {
                                setActiveReceipt(dep);
                                setReceiptModal(true);
                              }}
                              className="btn btn-neutral btn-sm"
                              title="View Receipt"
                              style={{ padding: '5px 10px', fontSize: 12 }}
                            >
                              <i className="ti ti-printer" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 13, color: '#64748b' }}>
                  Showing page <strong>{page}</strong> of <strong>{totalPages}</strong>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage(p => p - 1)}
                    className="btn btn-neutral btn-sm"
                  >
                    Previous
                  </button>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => p + 1)}
                    className="btn btn-neutral btn-sm"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── MODAL 1: COLLECT CAUTION DEPOSIT ─────────────────────────────────── */}
      {collectModal && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', zIndex: 1050, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="card" style={{ width: '100%', maxWidth: 580, maxHeight: '90vh', overflowY: 'auto', borderRadius: 14 }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#047857', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <i className="ti ti-shield-plus" />
                  Collect Caution Money Security Deposit
                </h4>
                <p style={{ margin: '4px 0 0', fontSize: 12.5, color: '#64748b' }}>
                  Recorded as an Escrow Liability subledger entry on the balance sheet.
                </p>
              </div>
              <button onClick={() => setCollectModal(false)} className="btn btn-neutral btn-sm" style={{ border: 'none' }}>
                <i className="ti ti-x" style={{ fontSize: 18 }} />
              </button>
            </div>

            <form onSubmit={handleCollectSubmit} style={{ padding: 22 }}>
              {/* Student Search */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12.5, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 6 }}>
                  Select Enrolled Student <span style={{ color: '#ef4444' }}>*</span>
                </label>

                {selectedStudent ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 8 }}>
                    <div>
                      <div style={{ fontWeight: 800, color: '#065f46', fontSize: 14 }}>
                        {selectedStudent.full_name || selectedStudent.name}
                      </div>
                      <div style={{ fontSize: 12, color: '#047857', marginTop: 2 }}>
                        Admission No: <strong>{selectedStudent.admission_no}</strong> • Class: {selectedStudent.class_name || 'Class'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedStudent(null)}
                      className="btn btn-neutral btn-sm"
                      style={{ fontSize: 11, fontWeight: 600 }}
                    >
                      Change Student
                    </button>
                  </div>
                ) : (
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      value={studentSearchQuery}
                      onChange={(e) => handleSearchStudents(e.target.value)}
                      placeholder="Type student name or admission number..."
                      className="form-control"
                      style={{ borderRadius: 8 }}
                    />
                    {studentSearchResults.length > 0 && (
                      <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8, marginTop: 4, background: '#fff', position: 'absolute', width: '100%', zIndex: 10 }}>
                        {studentSearchResults.map(st => (
                          <div
                            key={st.id}
                            onClick={() => {
                              setSelectedStudent(st);
                              setStudentSearchResults([]);
                            }}
                            style={{ padding: '8px 12px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', fontSize: 12.5 }}
                          >
                            <strong>{st.name || st.full_name}</strong> • Adm: {st.admission_no} • {st.class_name || 'Class'}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Deposit Details */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, marginBottom: 16 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                    Deposit Amount (₹) <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="0.01"
                    value={collectForm.deposit_amount}
                    onChange={(e) => setCollectForm({ ...collectForm, deposit_amount: e.target.value })}
                    placeholder="e.g. 5000"
                    className="form-control"
                    style={{ borderRadius: 8, fontWeight: 700 }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                    Deposit Date
                  </label>
                  <input
                    type="date"
                    required
                    value={collectForm.deposit_date}
                    onChange={(e) => setCollectForm({ ...collectForm, deposit_date: e.target.value })}
                    className="form-control"
                    style={{ borderRadius: 8 }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                    Payment Mode
                  </label>
                  <select
                    value={collectForm.payment_mode}
                    onChange={(e) => setCollectForm({ ...collectForm, payment_mode: e.target.value })}
                    className="form-select"
                    style={{ borderRadius: 8 }}
                  >
                    <option value="BANK_TRANSFER">Bank Transfer (NEFT / RTGS / IMPS)</option>
                    <option value="CASH">Cash Counter</option>
                    <option value="CHEQUE">Cheque / Demand Draft</option>
                    <option value="UPI">UPI / QR Code</option>
                    <option value="CARD">Debit / Credit Card</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                    Txn Ref / Cheque No
                  </label>
                  <input
                    type="text"
                    value={collectForm.transaction_ref}
                    onChange={(e) => setCollectForm({ ...collectForm, transaction_ref: e.target.value })}
                    placeholder="e.g. UTR / CHQ-102938"
                    className="form-control"
                    style={{ borderRadius: 8 }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                  Ledger Notes & Remarks
                </label>
                <textarea
                  rows={2}
                  value={collectForm.notes}
                  onChange={(e) => setCollectForm({ ...collectForm, notes: e.target.value })}
                  className="form-control"
                  style={{ borderRadius: 8, fontSize: 13 }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                <button
                  type="button"
                  onClick={() => setCollectModal(false)}
                  className="btn btn-neutral"
                  style={{ fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={collecting}
                  className="btn btn-primary"
                  style={{ fontWeight: 700, background: '#047857', border: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  {collecting ? <i className="ti ti-loader ti-spin" /> : <i className="ti ti-check" />}
                  Collect & Book Escrow
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: GRADUATION CLEARANCE & ARREARS OFFSET WIZARD ──────────── */}
      {clearanceModal && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', zIndex: 1050, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="card" style={{ width: '100%', maxWidth: 760, maxHeight: '92vh', overflowY: 'auto', borderRadius: 14 }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0B3B7B', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <i className="ti ti-checklist" style={{ color: '#047857' }} />
                  Graduation Clearance & Escrow Offset Audit
                </h4>
                <p style={{ margin: '4px 0 0', fontSize: 12.5, color: '#64748b' }}>
                  Audits student's held caution escrow balance against unpaid Tuition, Transport, Hostel, and Library bills.
                </p>
              </div>
              <button onClick={() => setClearanceModal(false)} className="btn btn-neutral btn-sm" style={{ border: 'none' }}>
                <i className="ti ti-x" style={{ fontSize: 18 }} />
              </button>
            </div>

            <div style={{ padding: 22 }}>
              {clearanceLoading ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                  <i className="ti ti-loader ti-spin" style={{ fontSize: 28, display: 'block', marginBottom: 10, color: '#2563eb' }} />
                  Auditing subledgers, outstanding fee bills, and escrow liability...
                </div>
              ) : settlementSuccessResult ? (
                /* Success Result View */
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#ecfdf5', color: '#047857', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 32 }}>
                    <i className="ti ti-check" />
                  </div>
                  <h3 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a' }}>
                    Graduation Clearance Successfully Settled!
                  </h3>
                  <p style={{ color: '#64748b', fontSize: 14, maxWidth: 500, margin: '8px auto 20px' }}>
                    {settlementSuccessResult.message}
                  </p>

                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 18, maxWidth: 520, margin: '0 auto 24px', textAlign: 'left' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                      <span style={{ color: '#64748b' }}>Original Held Caution Money:</span>
                      <strong>{fmt(settlementSuccessResult.summary?.original_caution_held)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                      <span style={{ color: '#b45309', fontWeight: 600 }}>Dues Cleared via Offset:</span>
                      <strong style={{ color: '#b45309' }}>- {fmt(settlementSuccessResult.summary?.offset_applied)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 15 }}>
                      <span style={{ color: '#047857', fontWeight: 700 }}>Net Refund Disbursed to Student:</span>
                      <strong style={{ color: '#047857', fontSize: 16 }}>{fmt(settlementSuccessResult.summary?.net_refund_disbursed)}</strong>
                    </div>
                    {settlementSuccessResult.summary?.remaining_unpaid_dues > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid #fee2e2' }}>
                        <span style={{ color: '#ef4444', fontWeight: 600 }}>Shortfall Remaining Due from Student:</span>
                        <strong style={{ color: '#ef4444' }}>{fmt(settlementSuccessResult.summary?.remaining_unpaid_dues)}</strong>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
                    <button
                      onClick={() => {
                        setClearanceModal(false);
                        navigate(resolveTenantPath(user, `/finance/students/${clearingStudentId}/ledger`));
                      }}
                      className="btn btn-neutral"
                      style={{ fontWeight: 600 }}
                    >
                      <i className="ti ti-file-analytics" style={{ marginRight: 6 }} /> View Updated Student Ledger
                    </button>
                    <button
                      onClick={() => setClearanceModal(false)}
                      className="btn btn-primary"
                      style={{ fontWeight: 700 }}
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : clearancePreview ? (
                <div>
                  {/* Student Summary Card */}
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, marginBottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 15 }}>
                        {clearancePreview.student?.name}
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                        Admission No: <strong>{clearancePreview.student?.admission_no}</strong> • Class: {clearancePreview.student?.class_name || 'Class'}{clearancePreview.student?.section_name ? `-${clearancePreview.student?.section_name}` : ''}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Held Caution Deposit</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: '#047857' }}>
                        {fmt(clearancePreview.total_caution_held)}
                      </div>
                    </div>
                  </div>

                  {/* Arrears Audit Breakdown */}
                  <div style={{ marginBottom: 18 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                      <span>Outstanding Unpaid Bills Across All Departments</span>
                      <span style={{ color: clearancePreview.total_unpaid_dues > 0 ? '#d97706' : '#047857', fontWeight: 800 }}>
                        Total Arrears: {fmt(clearancePreview.total_unpaid_dues)}
                      </span>
                    </div>

                    {(!clearancePreview.unpaid_bills || clearancePreview.unpaid_bills.length === 0) ? (
                      <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 8, padding: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <i className="ti ti-circle-check" style={{ fontSize: 24, color: '#047857' }} />
                        <div>
                          <div style={{ fontWeight: 700, color: '#065f46', fontSize: 13.5 }}>No Unpaid Arrears Found!</div>
                          <div style={{ fontSize: 12, color: '#047857' }}>Student has zero outstanding dues across Tuition, Transport, Hostel, and Library. Full escrow balance will be refunded.</div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, maxHeight: 160, overflowY: 'auto' }}>
                        <table className="table" style={{ margin: 0, fontSize: 12 }}>
                          <thead style={{ background: '#f8fafc' }}>
                            <tr>
                              <th style={{ padding: '8px 12px' }}>Bill No</th>
                              <th style={{ padding: '8px 12px' }}>Month</th>
                              <th style={{ padding: '8px 12px' }}>Service Heads</th>
                              <th style={{ padding: '8px 12px', textAlign: 'right' }}>Bill Total</th>
                              <th style={{ padding: '8px 12px', textAlign: 'right' }}>Balance Due</th>
                            </tr>
                          </thead>
                          <tbody>
                            {clearancePreview.unpaid_bills.map((b) => (
                              <tr key={b.bill_id}>
                                <td style={{ padding: '8px 12px', fontWeight: 700, color: '#0B3B7B' }}>{b.bill_no}</td>
                                <td style={{ padding: '8px 12px' }}>{b.month}</td>
                                <td style={{ padding: '8px 12px', color: '#64748b' }}>{b.services || 'ACADEMIC'}</td>
                                <td style={{ padding: '8px 12px', textAlign: 'right' }}>{fmt(b.total_amount)}</td>
                                <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: '#ef4444' }}>{fmt(b.balance_due)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Financial Settlement Equation Box */}
                  <div style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', border: '1px solid #cbd5e1', borderRadius: 12, padding: 16, marginBottom: 20 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>
                      Financial Settlement Equation
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, textAlign: 'center' }}>
                      <div style={{ background: '#fff', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Held Caution Money</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#047857', marginTop: 4 }}>
                          + {fmt(clearancePreview.total_caution_held)}
                        </div>
                      </div>

                      <div style={{ background: '#fff', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Arrears to Offset</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#b45309', marginTop: 4 }}>
                          - {fmt(clearancePreview.offset_from_caution)}
                        </div>
                      </div>

                      <div style={{ background: clearancePreview.net_refund_payable > 0 ? '#ecfdf5' : (clearancePreview.shortfall_due > 0 ? '#fef2f2' : '#fff'), padding: 12, borderRadius: 8, border: `1px solid ${clearancePreview.net_refund_payable > 0 ? '#a7f3d0' : (clearancePreview.shortfall_due > 0 ? '#fecaca' : '#e2e8f0')}` }}>
                        <div style={{ fontSize: 11, color: clearancePreview.net_refund_payable > 0 ? '#047857' : (clearancePreview.shortfall_due > 0 ? '#dc2626' : '#64748b'), fontWeight: 700 }}>
                          {clearancePreview.net_refund_payable > 0 ? 'Net Refund Payable' : (clearancePreview.shortfall_due > 0 ? 'Remaining Shortfall' : 'Balanced')}
                        </div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: clearancePreview.net_refund_payable > 0 ? '#047857' : (clearancePreview.shortfall_due > 0 ? '#dc2626' : '#1e293b'), marginTop: 4 }}>
                          = {fmt(clearancePreview.net_refund_payable > 0 ? clearancePreview.net_refund_payable : clearancePreview.shortfall_due)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Settlement Execution Form */}
                  <form onSubmit={handleExecuteSettlement}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, marginBottom: 14 }}>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                          Net Refund Disbursement Mode
                        </label>
                        <select
                          value={settlementForm.payment_mode}
                          onChange={(e) => setSettlementForm({ ...settlementForm, payment_mode: e.target.value })}
                          className="form-select"
                          style={{ borderRadius: 8 }}
                        >
                          <option value="BANK_TRANSFER">Bank Transfer (NEFT / RTGS / IMPS)</option>
                          <option value="CHEQUE">Cheque / Demand Draft</option>
                          <option value="CASH">Cash Voucher</option>
                          <option value="UPI">UPI / Digital Payout</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                          Refund Txn / Cheque Ref No
                        </label>
                        <input
                          type="text"
                          value={settlementForm.refund_ref_no}
                          onChange={(e) => setSettlementForm({ ...settlementForm, refund_ref_no: e.target.value })}
                          placeholder="e.g. UTR-998877 / CHQ-1029"
                          className="form-control"
                          style={{ borderRadius: 8 }}
                        />
                      </div>
                    </div>

                    <div style={{ marginBottom: 18 }}>
                      <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                        Clearance Verification & Audit Notes
                      </label>
                      <textarea
                        rows={2}
                        value={settlementForm.notes}
                        onChange={(e) => setSettlementForm({ ...settlementForm, notes: e.target.value })}
                        className="form-control"
                        style={{ borderRadius: 8, fontSize: 12.5 }}
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                      <button
                        type="button"
                        onClick={() => setClearanceModal(false)}
                        className="btn btn-neutral"
                        style={{ fontWeight: 600 }}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={settling}
                        className="btn btn-primary"
                        style={{
                          fontWeight: 700,
                          background: '#047857',
                          border: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6
                        }}
                      >
                        {settling ? <i className="ti ti-loader ti-spin" /> : <i className="ti ti-check" />}
                        Confirm Clearance & Offset Arrears
                      </button>
                    </div>
                  </form>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 3: VIEW & PRINT CAUTION MONEY RECEIPT ─────────────────────── */}
      {receiptModal && activeReceipt && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', zIndex: 1060, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="card" style={{ width: '100%', maxWidth: 520, borderRadius: 14 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
              <h5 style={{ margin: 0, fontWeight: 800, color: '#0B3B7B', display: 'flex', alignItems: 'center', gap: 6 }}>
                <i className="ti ti-receipt" />
                Caution Money Escrow Deposit Receipt
              </h5>
              <button onClick={() => setReceiptModal(false)} className="btn btn-neutral btn-sm" style={{ border: 'none' }}>
                <i className="ti ti-x" />
              </button>
            </div>

            <div style={{ padding: 24 }} id="caution-receipt-print">
              <div style={{ border: '2px solid #0B3B7B', borderRadius: 12, padding: 20 }}>
                <div style={{ textAlign: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: 14, marginBottom: 14 }}>
                  <h4 style={{ margin: 0, fontWeight: 800, color: '#0B3B7B' }}>REFUNDABLE SECURITY DEPOSIT</h4>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Balance Sheet Escrow Liability Subledger</div>
                  <div style={{ display: 'inline-block', background: '#eff6ff', color: '#2563eb', padding: '3px 10px', borderRadius: 6, fontWeight: 800, fontSize: 13, marginTop: 8 }}>
                    {activeReceipt.receipt_no}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Deposit Date:</span>
                    <strong>{activeReceipt.deposit_date}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Student Name:</span>
                    <strong>{activeReceipt.student_name}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Admission Number:</span>
                    <strong>{activeReceipt.student_admission_no}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Class & Section:</span>
                    <strong>{activeReceipt.class_name || 'Class'}{activeReceipt.section_name ? `-${activeReceipt.section_name}` : ''}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Payment Mode:</span>
                    <strong>{activeReceipt.payment_mode}</strong>
                  </div>
                  {activeReceipt.transaction_ref && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Txn / Cheque Ref:</span>
                      <strong>{activeReceipt.transaction_ref}</strong>
                    </div>
                  )}

                  <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: 10, marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Security Deposit Amount:</span>
                    <span style={{ fontSize: 20, fontWeight: 800, color: '#047857' }}>
                      {fmt(activeReceipt.deposit_amount)}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ecfdf5', padding: '6px 10px', borderRadius: 6, marginTop: 4 }}>
                    <span style={{ fontSize: 12, color: '#047857', fontWeight: 600 }}>Held in Escrow:</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: '#047857' }}>
                      {fmt(activeReceipt.held_balance)}
                    </span>
                  </div>
                </div>

                <div style={{ marginTop: 20, paddingTop: 12, borderTop: '1px solid #e2e8f0', fontSize: 11, color: '#94a3b8', textAlign: 'center' }}>
                  This deposit is held in escrow and is refundable upon graduation clearance after offsetting any outstanding dues.
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="btn btn-neutral btn-sm"
                  style={{ fontWeight: 600 }}
                >
                  <i className="ti ti-printer" style={{ marginRight: 6 }} /> Print Receipt
                </button>
                <button
                  type="button"
                  onClick={() => setReceiptModal(false)}
                  className="btn btn-primary btn-sm"
                  style={{ fontWeight: 600 }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
