import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function ReconciliationPage() {
  const [session, setSession] = useState('2026-27');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [summary, setSummary] = useState(null);
  const [batches, setBatches] = useState([]);
  const [selectedBatchId, setSelectedBatchId] = useState(null);
  const [batchDetail, setBatchDetail] = useState(null);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('MATCHES'); // 'MATCHES' | 'ERP_UNMATCHED' | 'BATCHES'
  const [erpUnmatched, setErpUnmatched] = useState([]);
  const [erpLoading, setErpLoading] = useState(false);

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadBankName, setUploadBankName] = useState('Primary Bank Account (HDFC/SBI)');
  const [uploadSource, setUploadSource] = useState('BANK_STATEMENT');
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Resolution modal state
  const [resolvingTxn, setResolvingTxn] = useState(null);
  const [resolveAction, setResolveAction] = useState('CONFIRM_MATCH');
  const [resolveNotes, setResolveNotes] = useState('');
  const [feeAdjAmount, setFeeAdjAmount] = useState(0);
  const [savingResolution, setSavingResolution] = useState(false);

  const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

  const fetchSummaryAndBatches = async () => {
    try {
      setLoading(true);
      let query = `?session=${session}`;
      if (dateFrom) query += `&date_from=${dateFrom}`;
      if (dateTo) query += `&date_to=${dateTo}`;

      const [sumRes, batchRes] = await Promise.all([
        api.get(`/finance/reconciliation/summary${query}`),
        api.get('/finance/reconciliation/batches')
      ]);

      setSummary(sumRes.data);
      setBatches(batchRes.data || []);

      if (batchRes.data?.length > 0 && !selectedBatchId) {
        setSelectedBatchId(batchRes.data[0].id);
      }
    } catch (err) {
      toast.error('Failed to load reconciliation records');
    } finally {
      setLoading(false);
    }
  };

  const fetchBatchTransactions = async (batchId, status) => {
    if (!batchId) return;
    try {
      const q = status && status !== 'ALL' ? `?match_status=${status}` : '';
      const res = await api.get(`/finance/reconciliation/batches/${batchId}/transactions${q}`);
      setBatchDetail(res.data);
    } catch (err) {
      toast.error('Failed to load batch transactions');
    }
  };

  const fetchErpUnmatched = async () => {
    try {
      setErpLoading(true);
      let q = '';
      if (dateFrom) q += `?date_from=${dateFrom}`;
      if (dateTo) q += `${q ? '&' : '?'}date_to=${dateTo}`;
      const res = await api.get(`/finance/reconciliation/erp-unmatched${q}`);
      setErpUnmatched(res.data || []);
    } catch (err) {
      toast.error('Failed to load unmatched ERP payments');
    } finally {
      setErpLoading(false);
    }
  };

  useEffect(() => {
    fetchSummaryAndBatches();
  }, [session, dateFrom, dateTo]);

  useEffect(() => {
    if (selectedBatchId) {
      fetchBatchTransactions(selectedBatchId, statusFilter);
    }
  }, [selectedBatchId, statusFilter]);

  useEffect(() => {
    if (activeTab === 'ERP_UNMATCHED') {
      fetchErpUnmatched();
    }
  }, [activeTab]);

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      toast.error('Please choose a bank statement CSV or Excel file');
      return;
    }

    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('bank_name', uploadBankName);
    formData.append('statement_source', uploadSource);

    try {
      setUploading(true);
      const res = await api.post('/finance/reconciliation/batches', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success(res.data.message || 'Statement uploaded and matched!');
      setShowUploadModal(false);
      setUploadFile(null);
      if (res.data.batch?.id) {
        setSelectedBatchId(res.data.batch.id);
      }
      fetchSummaryAndBatches();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to process statement file');
    } finally {
      setUploading(false);
    }
  };

  const openResolveModal = (txn) => {
    setResolvingTxn(txn);
    setResolveNotes('');
    if (txn.match_status === 'AMOUNT_MISMATCH') {
      setResolveAction('RESOLVE_FEE');
      const diff = Math.abs(Number(txn.bank_amount || 0) - Number(txn.erp_amount || 0));
      setFeeAdjAmount(diff);
      setResolveNotes(`Reconciled gateway / settlement fee difference of ₹${diff}`);
    } else if (txn.match_status === 'POSSIBLE_MATCH') {
      setResolveAction('CONFIRM_MATCH');
      setFeeAdjAmount(0);
      setResolveNotes('Confirmed manual match by school accountant');
    } else {
      setResolveAction('CONFIRM_MATCH');
      setFeeAdjAmount(0);
    }
  };

  const submitResolution = async () => {
    if (!resolvingTxn) return;
    try {
      setSavingResolution(true);
      await api.post(`/finance/reconciliation/transactions/${resolvingTxn.id}/resolve`, {
        action: resolveAction,
        notes: resolveNotes,
        fee_adjustment_amount: feeAdjAmount
      });
      toast.success('Discrepancy resolved without modifying student fee ledger!');
      setResolvingTxn(null);
      fetchSummaryAndBatches();
      if (selectedBatchId) fetchBatchTransactions(selectedBatchId, statusFilter);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to resolve transaction');
    } finally {
      setSavingResolution(false);
    }
  };

  const getStatusBadge = (st) => {
    switch (st) {
      case 'MATCHED':
        return <span className="badge badge-success" style={{ background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0' }}>✓ Matched</span>;
      case 'POSSIBLE_MATCH':
        return <span className="badge badge-info" style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' }}>ℹ Possible Match</span>;
      case 'AMOUNT_MISMATCH':
        return <span className="badge badge-warning" style={{ background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a' }}>⚠ Amount Mismatch</span>;
      case 'MISSING_IN_ERP':
        return <span className="badge badge-purple" style={{ background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe' }}>? Missing in ERP</span>;
      case 'DUPLICATE':
        return <span className="badge badge-danger" style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>✕ Duplicate Bank Entry</span>;
      default:
        return <span className="badge badge-neutral">{st}</span>;
    }
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar title="Bank & Gateway Reconciliation" />
        <div className="page-body">

          {/* Hero Banner */}
          <div style={{
            background: 'linear-gradient(135deg, #0f766e 0%, #115e59 100%)',
            borderRadius: 14, padding: '22px 26px', color: '#fff', marginBottom: 20,
            boxShadow: '0 4px 20px rgba(15, 118, 110, 0.25)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ background: 'rgba(255,255,255,0.2)', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 800 }}>
                  BANK &amp; PAYMENT GATEWAY AUDIT
                </span>
                <span style={{ fontSize: 12, opacity: 0.9 }}>Cashbook &bull; Bank Credits &bull; UPI &bull; Razorpay / Gateway</span>
              </div>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Payment &amp; Bank Reconciliation</h1>
              <p style={{ margin: '4px 0 0', fontSize: 13, opacity: 0.9, maxWidth: 680 }}>
                Verify that every rupee collected in student receipts actually landed in your school's bank account. Detect gateway commissions, timing delays, and missing deposits without modifying student balances.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => setShowUploadModal(true)}
                style={{
                  background: '#fff', color: '#0f766e', border: 'none', borderRadius: 10,
                  padding: '10px 18px', fontSize: 13, fontWeight: 800, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
                }}
              >
                <i className="ti ti-upload" style={{ fontSize: 16 }} />
                Upload Statement
              </button>

              <button
                onClick={fetchSummaryAndBatches}
                style={{
                  background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)',
                  borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6
                }}
              >
                <i className="ti ti-refresh" />
                Refresh
              </button>
            </div>
          </div>

          {/* Quick Filters */}
          <div className="card mb-6" style={{ padding: '14px 20px' }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#4b5563' }}>Session:</span>
                <select
                  value={session}
                  onChange={(e) => setSession(e.target.value)}
                  className="input input-sm"
                  style={{ width: 110, fontWeight: 600 }}
                >
                  <option value="2026-27">2026-27</option>
                  <option value="2025-26">2025-26</option>
                  <option value="2024-25">2024-25</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#4b5563' }}>Date Range:</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="input input-sm"
                  style={{ width: 140 }}
                />
                <span style={{ color: '#9ca3af' }}>to</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="input input-sm"
                  style={{ width: 140 }}
                />
              </div>

              {(dateFrom || dateTo) && (
                <button
                  onClick={() => { setDateFrom(''); setDateTo(''); }}
                  className="btn btn-neutral btn-sm"
                >
                  Clear Dates
                </button>
              )}

              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setActiveTab('MATCHES')}
                  className={`btn btn-sm ${activeTab === 'MATCHES' ? 'btn-primary' : 'btn-neutral'}`}
                  style={{ borderRadius: 20 }}
                >
                  <i className="ti ti-arrows-diff" /> Bank Transactions
                </button>
                <button
                  onClick={() => setActiveTab('ERP_UNMATCHED')}
                  className={`btn btn-sm ${activeTab === 'ERP_UNMATCHED' ? 'btn-primary' : 'btn-neutral'}`}
                  style={{ borderRadius: 20 }}
                >
                  <i className="ti ti-clock-pause" /> Pending In-Transit Deposits ({summary?.unmatched_erp_count ?? 0})
                </button>
                <button
                  onClick={() => setActiveTab('BATCHES')}
                  className={`btn btn-sm ${activeTab === 'BATCHES' ? 'btn-primary' : 'btn-neutral'}`}
                  style={{ borderRadius: 20 }}
                >
                  <i className="ti ti-history" /> Uploaded Batches ({batches.length})
                </button>
              </div>
            </div>
          </div>

          {/* 4 Core Executive Reconciliation KPI Cards */}
          <div className="grid-4 mb-6" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
            <div className="stat-card" style={{ borderLeft: '4px solid #059669', padding: 14 }}>
              <div className="stat-label">ERP Fee Collections</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#059669' }}>
                {fmt(summary?.erp_collections_total)}
              </div>
              <div className="text-xs text-muted mt-1">Receipts recorded in school cashbook</div>
            </div>

            <div className="stat-card" style={{ borderLeft: '4px solid #0284c7', padding: 14 }}>
              <div className="stat-label">Verified Bank Credits</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#0284c7' }}>
                {fmt(summary?.bank_credits_total)}
              </div>
              <div className="text-xs text-muted mt-1">Actual deposits in bank statement</div>
            </div>

            <div className="stat-card" style={{ borderLeft: `4px solid ${Math.abs(summary?.discrepancy || 0) < 1 ? '#059669' : '#d97706'}`, padding: 14 }}>
              <div className="stat-label">Reconciliation Discrepancy</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: Math.abs(summary?.discrepancy || 0) < 1 ? '#059669' : '#d97706' }}>
                {fmt(summary?.discrepancy)}
              </div>
              <div className="text-xs text-muted mt-1">
                {Math.abs(summary?.discrepancy || 0) < 1 ? 'Balanced (Zero difference)' : 'Timing difference or gateway fees'}
              </div>
            </div>

            <div className="stat-card" style={{ borderLeft: '4px solid #7c3aed', padding: 14 }}>
              <div className="stat-label">Matched Entries</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#7c3aed' }}>
                {summary?.matched_count || 0} / {(summary?.matched_count || 0) + (summary?.pending_count || 0)}
              </div>
              <div className="text-xs text-muted mt-1">
                {summary?.pending_count ? `${summary.pending_count} entries need review` : 'All imported entries reconciled'}
              </div>
            </div>
          </div>

          {/* MAIN TAB 1: BANK TRANSACTIONS & MATCHING */}
          {activeTab === 'MATCHES' && (
            <div className="card">
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Statement Matching Table</h3>
                  {batches.length > 0 && (
                    <select
                      value={selectedBatchId || ''}
                      onChange={(e) => setSelectedBatchId(Number(e.target.value))}
                      className="input input-sm"
                      style={{ fontWeight: 600, minWidth: 220 }}
                    >
                      {batches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.bank_name} &bull; {b.statement_date || b.created_at?.split('T')[0]} ({b.matched_count}/{b.total_records} matched)
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {[
                    { id: 'ALL', label: 'All' },
                    { id: 'MATCHED', label: 'Matched' },
                    { id: 'POSSIBLE_MATCH', label: 'Possible Match' },
                    { id: 'AMOUNT_MISMATCH', label: 'Amount Mismatch' },
                    { id: 'MISSING_IN_ERP', label: 'Missing in ERP' },
                    { id: 'DUPLICATE', label: 'Duplicates' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setStatusFilter(f.id)}
                      className={`btn btn-xs ${statusFilter === f.id ? 'btn-primary' : 'btn-neutral'}`}
                      style={{ borderRadius: 16 }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="card-body" style={{ padding: 0 }}>
                {loading ? (
                  <div style={{ padding: 48, textAlign: 'center' }}>
                    <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto' }}></div>
                    <p className="mt-4 text-muted">Auditing bank statement entries...</p>
                  </div>
                ) : !batchDetail || !batchDetail.transactions?.length ? (
                  <div style={{ padding: 48, textAlign: 'center' }}>
                    <i className="ti ti-file-search" style={{ fontSize: 36, color: '#9ca3af' }}></i>
                    <h4 style={{ marginTop: 12, color: '#4b5563' }}>No Statement Entries Found</h4>
                    <p className="text-muted" style={{ maxWidth: 450, margin: '6px auto' }}>
                      {batches.length === 0
                        ? 'Upload a bank statement CSV/Excel to compare credits with ERP payments.'
                        : 'No transactions found matching the active status filter.'}
                    </p>
                    {batches.length === 0 && (
                      <button onClick={() => setShowUploadModal(true)} className="btn btn-primary btn-sm mt-3">
                        <i className="ti ti-upload" /> Upload Statement Now
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="table-container">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Bank Narration / Reference</th>
                          <th style={{ textAlign: 'right' }}>Bank Credit</th>
                          <th style={{ textAlign: 'right' }}>ERP Amount</th>
                          <th>Matched Receipt / Student</th>
                          <th>Status</th>
                          <th>Discrepancy / Explanation</th>
                          <th style={{ textAlign: 'center' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {batchDetail.transactions.map((tx) => (
                          <tr key={tx.id}>
                            <td style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{tx.txn_date}</td>
                            <td style={{ maxWidth: 260 }}>
                              <div style={{ fontWeight: 600, fontSize: 13 }}>{tx.description}</div>
                              {tx.reference_no && (
                                <div className="text-xs text-muted">Ref: {tx.reference_no}</div>
                              )}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: '#0284c7' }}>
                              {fmt(tx.bank_amount)}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: tx.erp_amount ? '#059669' : '#9ca3af' }}>
                              {tx.erp_amount ? fmt(tx.erp_amount) : '—'}
                            </td>
                            <td>
                              {tx.matched_receipt_no ? (
                                <div>
                                  <span style={{ fontWeight: 700, color: '#0f766e' }}>{tx.matched_receipt_no}</span>
                                  {tx.matched_student_name && (
                                    <div className="text-xs text-muted">{tx.matched_student_name}</div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted">—</span>
                              )}
                            </td>
                            <td>{getStatusBadge(tx.match_status)}</td>
                            <td style={{ fontSize: 12, maxWidth: 240, color: '#4b5563' }}>
                              {tx.explanation || (tx.match_status === 'MATCHED' ? 'Exact amount & reference verified' : 'Needs verification')}
                              {tx.settled_gateway_fee > 0 && (
                                <div style={{ color: '#d97706', fontWeight: 700, marginTop: 2 }}>
                                  Resolved fee: {fmt(tx.settled_gateway_fee)}
                                </div>
                              )}
                            </td>
                            <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                              {tx.match_status === 'MATCHED' ? (
                                <span className="text-xs text-muted" style={{ fontWeight: 600 }}>✓ Verified</span>
                              ) : (
                                <button
                                  onClick={() => openResolveModal(tx)}
                                  className="btn btn-neutral btn-xs"
                                  style={{ fontWeight: 700, borderRadius: 14 }}
                                >
                                  Resolve
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* MAIN TAB 2: UNMATCHED ERP RECEIPTS (IN-TRANSIT DEPOSITS) */}
          {activeTab === 'ERP_UNMATCHED' && (
            <div className="card">
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Pending In-Transit Deposits (ERP Receipts Missing in Bank)</h3>
                  <p className="text-xs text-muted" style={{ margin: 0 }}>
                    These receipts were recorded at the counter or online but have not yet been matched to a bank statement credit.
                  </p>
                </div>
                <button onClick={fetchErpUnmatched} className="btn btn-neutral btn-xs">
                  <i className="ti ti-refresh" /> Refresh
                </button>
              </div>

              <div className="card-body" style={{ padding: 0 }}>
                {erpLoading ? (
                  <div style={{ padding: 48, textAlign: 'center' }}>
                    <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto' }}></div>
                    <p className="mt-4 text-muted">Scanning uncredited receipts...</p>
                  </div>
                ) : erpUnmatched.length === 0 ? (
                  <div style={{ padding: 48, textAlign: 'center' }}>
                    <i className="ti ti-circle-check" style={{ fontSize: 36, color: '#059669' }}></i>
                    <h4 style={{ marginTop: 12 }}>All ERP Collections Verified</h4>
                    <p className="text-muted">Every recorded fee payment has a matching credit in the bank statement.</p>
                  </div>
                ) : (
                  <div className="table-container">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Payment Date</th>
                          <th>Receipt No</th>
                          <th>Student</th>
                          <th>Class</th>
                          <th>Payment Mode</th>
                          <th>Reference / UTR</th>
                          <th style={{ textAlign: 'right' }}>Amount</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {erpUnmatched.map((p) => (
                          <tr key={p.id}>
                            <td style={{ fontWeight: 600 }}>{p.payment_date}</td>
                            <td style={{ fontWeight: 700, color: '#0f766e' }}>{p.receipt_no}</td>
                            <td style={{ fontWeight: 600 }}>{p.student_name}</td>
                            <td>{p.class_name || '—'}</td>
                            <td><span className="badge badge-neutral">{p.payment_mode}</span></td>
                            <td style={{ fontSize: 12, color: '#4b5563' }}>{p.reference_no || '—'}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: '#059669' }}>
                              {fmt(p.amount)}
                            </td>
                            <td>
                              <span className="badge badge-warning" style={{ background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a' }}>
                                Awaiting Bank Credit
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* MAIN TAB 3: BATCHES AUDIT HISTORY */}
          {activeTab === 'BATCHES' && (
            <div className="card">
              <div className="card-header">
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Imported Statement Batches</h3>
              </div>
              <div className="card-body" style={{ padding: 0 }}>
                {batches.length === 0 ? (
                  <div style={{ padding: 48, textAlign: 'center' }}>
                    <p className="text-muted">No statement batches imported yet.</p>
                  </div>
                ) : (
                  <div className="table-container">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Batch ID</th>
                          <th>Bank Name</th>
                          <th>Filename</th>
                          <th>Upload Date</th>
                          <th>Date Range</th>
                          <th>Total Entries</th>
                          <th>Matched Entries</th>
                          <th>Pending</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {batches.map((b) => (
                          <tr key={b.id}>
                            <td style={{ fontWeight: 700 }}>#{b.id}</td>
                            <td style={{ fontWeight: 600 }}>{b.bank_name}</td>
                            <td style={{ fontSize: 12, color: '#4b5563' }}>{b.original_filename}</td>
                            <td>{b.created_at?.split('T')[0]}</td>
                            <td>{b.start_date || '—'} to {b.end_date || '—'}</td>
                            <td style={{ fontWeight: 700 }}>{b.total_records}</td>
                            <td style={{ color: '#059669', fontWeight: 700 }}>{b.matched_count}</td>
                            <td style={{ color: b.pending_count ? '#d97706' : '#059669', fontWeight: 700 }}>{b.pending_count}</td>
                            <td>
                              <button
                                onClick={() => {
                                  setSelectedBatchId(b.id);
                                  setActiveTab('MATCHES');
                                }}
                                className="btn btn-neutral btn-xs"
                              >
                                View Entries
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* UPLOAD MODAL */}
      {showUploadModal && (
        <div className="modal-backdrop" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="modal-content" style={{
            background: '#fff', borderRadius: 14, width: '100%', maxWidth: 520, padding: 24, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Upload Bank / Gateway Statement</h3>
              <button onClick={() => setShowUploadModal(false)} className="btn btn-neutral btn-xs">✕</button>
            </div>

            <form onSubmit={handleUploadSubmit}>
              <div className="mb-4">
                <label className="label" style={{ fontWeight: 700, fontSize: 13 }}>Bank Account / Payment Source</label>
                <select
                  value={uploadBankName}
                  onChange={(e) => setUploadBankName(e.target.value)}
                  className="input"
                  style={{ width: '100%' }}
                >
                  <option value="Primary Bank Account (HDFC/SBI)">Primary Bank Account (HDFC / SBI)</option>
                  <option value="Operational Current Account">Operational Current Account</option>
                  <option value="Razorpay Payment Gateway">Razorpay Payment Gateway Settlement</option>
                  <option value="PayTM / PhonePe UPI Collection">PayTM / PhonePe UPI Merchant Account</option>
                  <option value="Cash Counter / Cashbook">Cash Counter / Vault Account</option>
                </select>
              </div>

              <div className="mb-4">
                <label className="label" style={{ fontWeight: 700, fontSize: 13 }}>Statement Type</label>
                <select
                  value={uploadSource}
                  onChange={(e) => setUploadSource(e.target.value)}
                  className="input"
                  style={{ width: '100%' }}
                >
                  <option value="BANK_STATEMENT">Bank Statement (CSV / Excel)</option>
                  <option value="GATEWAY_SETTLEMENT">Payment Gateway Settlement Export</option>
                  <option value="UPI_EXPORT">UPI Merchant Daily Settlement</option>
                </select>
              </div>

              <div className="mb-4">
                <label className="label" style={{ fontWeight: 700, fontSize: 13 }}>Statement File (.csv, .xlsx, .xls)</label>
                <input
                  type="file"
                  accept=".csv, .xlsx, .xls"
                  onChange={(e) => setUploadFile(e.target.files[0])}
                  className="input"
                  style={{ width: '100%' }}
                  required
                />
                <p className="text-xs text-muted mt-1">
                  Supports standard headers: Date, Narration/Description, Credit/Deposit, Reference/UTR.
                </p>
              </div>

              <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 12, color: '#475569' }}>
                <i className="ti ti-shield-check" style={{ color: '#059669', marginRight: 4 }} />
                <strong>Idempotent &amp; Safe:</strong> Transactions are matched by reference and amount. Student balances will never be silently altered.
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" onClick={() => setShowUploadModal(false)} className="btn btn-neutral">
                  Cancel
                </button>
                <button type="submit" disabled={uploading} className="btn btn-primary">
                  {uploading ? 'Processing & Matching...' : 'Upload & Reconcile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESOLUTION MODAL */}
      {resolvingTxn && (
        <div className="modal-backdrop" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="modal-content" style={{
            background: '#fff', borderRadius: 14, width: '100%', maxWidth: 540, padding: 24, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Resolve Entry Discrepancy</h3>
              <button onClick={() => setResolvingTxn(null)} className="btn btn-neutral btn-xs">✕</button>
            </div>

            <div style={{ background: '#f8fafc', padding: 14, borderRadius: 10, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{resolvingTxn.description}</div>
              <div style={{ display: 'flex', gap: 20, marginTop: 8, fontSize: 13 }}>
                <div>Bank Credit: <strong style={{ color: '#0284c7' }}>{fmt(resolvingTxn.bank_amount)}</strong></div>
                <div>ERP Amount: <strong style={{ color: '#059669' }}>{fmt(resolvingTxn.erp_amount)}</strong></div>
                <div>Diff: <strong style={{ color: '#d97706' }}>{fmt(Math.abs((resolvingTxn.bank_amount || 0) - (resolvingTxn.erp_amount || 0)))}</strong></div>
              </div>
            </div>

            <div className="mb-4">
              <label className="label" style={{ fontWeight: 700, fontSize: 13 }}>Resolution Action</label>
              <select
                value={resolveAction}
                onChange={(e) => setResolveAction(e.target.value)}
                className="input"
                style={{ width: '100%' }}
              >
                <option value="CONFIRM_MATCH">Confirm Manual Match (Exact Match)</option>
                <option value="RESOLVE_FEE">Settle Difference as Payment Gateway / Bank Fee</option>
                <option value="MARK_NON_OPERATING">Mark as Non-Operating Transfer (Loan / Account Transfer)</option>
                <option value="IGNORE">Ignore / Mark Resolved with Audit Note</option>
              </select>
            </div>

            {resolveAction === 'RESOLVE_FEE' && (
              <div className="mb-4">
                <label className="label" style={{ fontWeight: 700, fontSize: 13 }}>Gateway Fee / Deduction Amount (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={feeAdjAmount}
                  onChange={(e) => setFeeAdjAmount(Number(e.target.value))}
                  className="input"
                  style={{ width: '100%' }}
                />
                <p className="text-xs text-muted mt-1">
                  Recorded as Bank Charges operating expense. Student ledger balance remains untouched.
                </p>
              </div>
            )}

            <div className="mb-4">
              <label className="label" style={{ fontWeight: 700, fontSize: 13 }}>Auditor / Accountant Notes</label>
              <textarea
                value={resolveNotes}
                onChange={(e) => setResolveNotes(e.target.value)}
                rows={3}
                className="input"
                style={{ width: '100%', resize: 'vertical' }}
                placeholder="Explain the reason for manual approval or difference..."
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" onClick={() => setResolvingTxn(null)} className="btn btn-neutral">
                Cancel
              </button>
              <button
                type="button"
                onClick={submitResolution}
                disabled={savingResolution}
                className="btn btn-primary"
              >
                {savingResolution ? 'Saving...' : 'Confirm Resolution'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
