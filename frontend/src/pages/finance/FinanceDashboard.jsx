import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function FinanceDashboard() {
  const navigate = useNavigate();
  const [session, setSession] = useState('2026-27');
  const [month, setMonth] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [classId, setClassId] = useState('');
  const [paymentMode, setPaymentMode] = useState('');
  const [classes, setClasses] = useState([]);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch classes for filter dropdown
  useEffect(() => {
    api.get('/principal/classes')
      .then((r) => setClasses(r.data || []))
      .catch(() => {});
  }, []);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (session) params.append('session', session);
      if (month) params.append('month', month);
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
      if (classId) params.append('class_id', classId);
      if (paymentMode) params.append('payment_mode', paymentMode);

      const res = await api.get(`/fees-finance/dashboard?${params.toString()}`);
      setData(res.data);
    } catch (err) {
      toast.error('Failed to load finance metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [session, month, classId, paymentMode]);

  const handleApplyCustomDates = (e) => {
    e.preventDefault();
    fetchDashboard();
  };

  const handleResetFilters = () => {
    setMonth('');
    setDateFrom('');
    setDateTo('');
    setClassId('');
    setPaymentMode('');
  };

  const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

  const maxMonthValue = Math.max(
    ...(data?.monthly_summary?.map((m) => Math.max(m.billed || 0, m.collected || 0, m.expenses || 0)) || [10000]),
    1000
  );

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar title="Finance & Fees Command Center" />
        <div className="page-body">

          {/* Page Header */}
          <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span className="badge badge-info">Financial Session {session}</span>
                <span className="text-xs text-muted">Audited School Ledger System</span>
                {month && <span className="badge badge-neutral">Month: {month}</span>}
              </div>
              <h2 className="page-title">Executive Finance Dashboard</h2>
              <p className="page-subtitle">
                Clear financial clarity for Principal, School Owner, and Accountant. Demand billing, real collections, pending fees, and cash flow.
              </p>
            </div>

            {/* Quick Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <button
                onClick={() => navigate('/finance/payments/collect')}
                className="btn btn-primary"
                title="Record student fee payment"
              >
                <i className="ti ti-credit-card"></i>
                Collect Payment
              </button>

              <button
                onClick={() => navigate('/finance/bills')}
                className="btn btn-neutral"
                title="View & generate demand bills"
              >
                <i className="ti ti-file-invoice"></i>
                Demand Bills
              </button>

              <button
                onClick={() => navigate('/finance/reconciliation')}
                className="btn btn-neutral"
                style={{ background: '#e0e7ff', color: '#3730a3', borderColor: '#c7d2fe', fontWeight: 700 }}
                title="Reconcile bank statements & payments"
              >
                <i className="ti ti-building-bank"></i>
                Bank Reconciliation
              </button>

              <button
                onClick={() => navigate('/finance/reports')}
                className="btn btn-neutral"
                title="Income & Expense / P&L statement"
              >
                <i className="ti ti-report-analytics"></i>
                P&amp;L Reports
              </button>
            </div>
          </div>

          {/* Multi-Dimensional Filter Bar */}
          <div className="card mb-6" style={{ padding: '14px 18px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              {/* Session Filter */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label className="text-xs font-semibold text-muted">Academic Session</label>
                <select
                  value={session}
                  onChange={(e) => setSession(e.target.value)}
                  className="form-select"
                  style={{ width: 120, height: 34, fontSize: 13, fontWeight: 700 }}
                >
                  <option value="2026-27">2026-27</option>
                  <option value="2025-26">2025-26</option>
                  <option value="2024-25">2024-25</option>
                </select>
              </div>

              {/* Month Filter */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label className="text-xs font-semibold text-muted">Billing Month</label>
                <select
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="form-select"
                  style={{ width: 140, height: 34, fontSize: 13 }}
                >
                  <option value="">All Months</option>
                  <option value="2026-04">April 2026</option>
                  <option value="2026-05">May 2026</option>
                  <option value="2026-06">June 2026</option>
                  <option value="2026-07">July 2026</option>
                  <option value="2026-08">August 2026</option>
                  <option value="2026-09">September 2026</option>
                  <option value="2026-10">October 2026</option>
                  <option value="2026-11">November 2026</option>
                  <option value="2026-12">December 2026</option>
                  <option value="2027-01">January 2027</option>
                  <option value="2027-02">February 2027</option>
                  <option value="2027-03">March 2027</option>
                </select>
              </div>

              {/* Class Filter */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label className="text-xs font-semibold text-muted">Class</label>
                <select
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                  className="form-select"
                  style={{ width: 140, height: 34, fontSize: 13 }}
                >
                  <option value="">All Classes</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.section || ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Payment Method */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label className="text-xs font-semibold text-muted">Payment Method</label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  className="form-select"
                  style={{ width: 140, height: 34, fontSize: 13 }}
                >
                  <option value="">All Methods</option>
                  <option value="CASH">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="CARD">Debit/Credit Card</option>
                  <option value="ONLINE">Online Gateway</option>
                </select>
              </div>

              {/* Custom Date Range */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label className="text-xs font-semibold text-muted">From Date</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="form-control"
                  style={{ height: 34, width: 135, fontSize: 12 }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label className="text-xs font-semibold text-muted">To Date</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="form-control"
                  style={{ height: 34, width: 135, fontSize: 12 }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, marginTop: 18 }}>
                {(dateFrom || dateTo) && (
                  <button onClick={handleApplyCustomDates} className="btn btn-sm btn-primary" style={{ height: 34 }}>
                    Apply Dates
                  </button>
                )}
                {(month || classId || paymentMode || dateFrom || dateTo) && (
                  <button onClick={handleResetFilters} className="btn btn-sm btn-neutral" style={{ height: 34 }} title="Clear all filters">
                    <i className="ti ti-x"></i> Reset
                  </button>
                )}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="empty-state">
              <div className="spinner" style={{ width: 32, height: 32 }}></div>
              <p className="mt-4">Loading financial command center...</p>
            </div>
          ) : (
            <>
              {/* 6 Executive KPI Cards */}
              <div className="grid-3 mb-6" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>

                {/* Card A: Total Fees Billed (Billed) */}
                <div
                  className="stat-card"
                  style={{ borderLeft: '4px solid #0176d3', cursor: 'pointer', transition: 'transform 0.15s ease' }}
                  onClick={() => navigate('/finance/bills')}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div>
                      <div className="stat-label" style={{ margin: 0, fontWeight: 700 }}>Total Fees Billed</div>
                      <div className="text-xs text-muted">Demand bills issued</div>
                    </div>
                    <div className="stat-icon" style={{ background: '#e8f4fd', color: '#0176d3', margin: 0, width: 36, height: 36, borderRadius: 8 }}>
                      <i className="ti ti-file-invoice" style={{ fontSize: 18 }}></i>
                    </div>
                  </div>
                  <div className="stat-value" style={{ fontSize: '1.65rem', color: '#0176d3', fontWeight: 800 }}>
                    {fmt(data?.total_billed)}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                    <span className="stat-sub text-xs">Total demand from parents</span>
                    <span className="text-xs font-semibold" style={{ color: '#0176d3' }}>View Bills &rarr;</span>
                  </div>
                </div>

                {/* Card B: Total Fees Collected (Collected) */}
                <div
                  className="stat-card"
                  style={{ borderLeft: '4px solid #059669', cursor: 'pointer' }}
                  onClick={() => navigate('/finance/payment-logs')}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div>
                      <div className="stat-label" style={{ margin: 0, fontWeight: 700 }}>Total Fees Collected</div>
                      <div className="text-xs text-muted">Actual cash, bank &amp; UPI received</div>
                    </div>
                    <div className="stat-icon" style={{ background: '#ecfdf5', color: '#059669', margin: 0, width: 36, height: 36, borderRadius: 8 }}>
                      <i className="ti ti-arrow-down-right" style={{ fontSize: 18 }}></i>
                    </div>
                  </div>
                  <div className="stat-value" style={{ fontSize: '1.65rem', color: '#059669', fontWeight: 800 }}>
                    {fmt(data?.total_collected)}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                    <span className="badge badge-success" style={{ fontSize: 11 }}>
                      {data?.collection_percentage || 0}% Realized
                    </span>
                    <span className="text-xs font-semibold" style={{ color: '#059669' }}>View Receipts &rarr;</span>
                  </div>
                </div>

                {/* Card C: Fees Pending (Still to Collect) */}
                <div
                  className="stat-card"
                  style={{ borderLeft: '4px solid #d97706', cursor: 'pointer' }}
                  onClick={() => navigate('/finance/outstanding')}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div>
                      <div className="stat-label" style={{ margin: 0, fontWeight: 700 }}>Fees Pending (To Collect)</div>
                      <div className="text-xs text-muted">Outstanding balance against bills</div>
                    </div>
                    <div className="stat-icon" style={{ background: '#fffbeb', color: '#d97706', margin: 0, width: 36, height: 36, borderRadius: 8 }}>
                      <i className="ti ti-alert-circle" style={{ fontSize: 18 }}></i>
                    </div>
                  </div>
                  <div className="stat-value" style={{ fontSize: '1.65rem', color: '#d97706', fontWeight: 800 }}>
                    {fmt(data?.outstanding)}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, fontSize: 11 }}>
                    <span style={{ color: '#059669', fontWeight: 600 }}>Due Soon: {fmt(data?.not_yet_due)}</span>
                    <span style={{ color: '#dc2626', fontWeight: 700 }}>Overdue: {fmt(data?.overdue)}</span>
                  </div>
                </div>

                {/* Card D: Total Expenses */}
                <div
                  className="stat-card"
                  style={{ borderLeft: '4px solid #dc2626', cursor: 'pointer' }}
                  onClick={() => navigate('/finance/expenses')}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div>
                      <div className="stat-label" style={{ margin: 0, fontWeight: 700 }}>Total School Expenses</div>
                      <div className="text-xs text-muted">Salaries &amp; vendor bills</div>
                    </div>
                    <div className="stat-icon" style={{ background: '#fef2f2', color: '#dc2626', margin: 0, width: 36, height: 36, borderRadius: 8 }}>
                      <i className="ti ti-arrow-up-right" style={{ fontSize: 18 }}></i>
                    </div>
                  </div>
                  <div className="stat-value" style={{ fontSize: '1.65rem', color: '#dc2626', fontWeight: 800 }}>
                    {fmt(data?.total_expenses)}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, fontSize: 11 }}>
                    <span style={{ color: '#475569' }}>Paid: {fmt(data?.paid_expenses || data?.total_expenses)}</span>
                    <span style={{ color: '#b91c1c' }}>Unpaid Bills: {fmt(data?.unpaid_liabilities || 0)}</span>
                  </div>
                </div>

                {/* Card E: Bank / Cash Position */}
                <div
                  className="stat-card"
                  style={{ borderLeft: '4px solid #4f46e5', cursor: 'pointer' }}
                  onClick={() => navigate('/finance/reconciliation')}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div>
                      <div className="stat-label" style={{ margin: 0, fontWeight: 700 }}>Actual Cash Available</div>
                      <div className="text-xs text-muted">Net cash position (Inflows - Outflows)</div>
                    </div>
                    <div className="stat-icon" style={{ background: '#eef2ff', color: '#4f46e5', margin: 0, width: 36, height: 36, borderRadius: 8 }}>
                      <i className="ti ti-building-bank" style={{ fontSize: 18 }}></i>
                    </div>
                  </div>
                  <div className="stat-value" style={{ fontSize: '1.65rem', color: '#4f46e5', fontWeight: 800 }}>
                    {fmt(data?.cash_position !== undefined ? data?.cash_position : data?.net_surplus)}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, fontSize: 11 }}>
                    <span style={{ color: '#059669' }}>+ Inflows: {fmt(data?.cash_inflows || data?.total_collected)}</span>
                    <span style={{ color: '#dc2626' }}>- Outflows: {fmt(data?.cash_outflows || data?.total_expenses)}</span>
                  </div>
                </div>

                {/* Card F: Net Operating Result */}
                <div
                  className="stat-card"
                  style={{ borderLeft: `4px solid ${(data?.net_surplus ?? 0) >= 0 ? '#059669' : '#dc2626'}`, cursor: 'pointer' }}
                  onClick={() => navigate('/finance/reports')}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div>
                      <div className="stat-label" style={{ margin: 0, fontWeight: 700 }}>Net Operating Result</div>
                      <div className="text-xs text-muted">Management Operating Surplus/Deficit</div>
                    </div>
                    <div
                      className="stat-icon"
                      style={{
                        background: (data?.net_surplus ?? 0) >= 0 ? '#ecfdf5' : '#fef2f2',
                        color: (data?.net_surplus ?? 0) >= 0 ? '#059669' : '#dc2626',
                        margin: 0, width: 36, height: 36, borderRadius: 8
                      }}
                    >
                      <i className="ti ti-chart-line" style={{ fontSize: 18 }}></i>
                    </div>
                  </div>
                  <div
                    className="stat-value"
                    style={{
                      fontSize: '1.65rem',
                      fontWeight: 800,
                      color: (data?.net_surplus ?? 0) >= 0 ? '#059669' : '#dc2626'
                    }}
                  >
                    {fmt(data?.net_surplus)}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                    <span className={`badge ${ (data?.net_surplus ?? 0) >= 0 ? 'badge-success' : 'badge-danger' }`} style={{ fontSize: 11 }}>
                      {(data?.net_surplus ?? 0) >= 0 ? 'Operating Surplus' : 'Operating Deficit'}
                    </span>
                    <span className="text-xs font-semibold" style={{ color: '#0176d3' }}>P&amp;L Breakdown &rarr;</span>
                  </div>
                </div>

              </div>

              {/* Monthly Realization Trend & Collection Modes */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 20 }}>

                {/* Monthly Billed vs Collected Bar Chart */}
                <div className="card" style={{ padding: 18 }}>
                  <div className="card-header" style={{ padding: 0, marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Monthly Demand vs Realized Collections</h3>
                      <p className="text-xs text-muted" style={{ margin: '2px 0 0' }}>Billed Demand (Blue), Collected Cash (Green), Expenses (Red)</p>
                    </div>
                    <span className="badge badge-neutral">Session {session}</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {(data?.monthly_summary || []).slice(0, 12).map((m, idx) => {
                      const billedPct = Math.min(100, Math.round(((m.billed || 0) / maxMonthValue) * 100));
                      const collPct = Math.min(100, Math.round(((m.collected || 0) / maxMonthValue) * 100));
                      const expPct = Math.min(100, Math.round(((m.expenses || 0) / maxMonthValue) * 100));

                      return (
                        <div key={idx} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 140px', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>{m.month_label}</span>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            {/* Billed bar */}
                            <div style={{ height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{ width: `${billedPct}%`, height: '100%', background: '#0176d3', borderRadius: 3 }} title={`Billed: ${fmt(m.billed)}`}></div>
                            </div>
                            {/* Collected bar */}
                            <div style={{ height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{ width: `${collPct}%`, height: '100%', background: '#059669', borderRadius: 3 }} title={`Collected: ${fmt(m.collected)}`}></div>
                            </div>
                            {/* Expense bar */}
                            <div style={{ height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{ width: `${expPct}%`, height: '100%', background: '#dc2626', borderRadius: 3 }} title={`Expenses: ${fmt(m.expenses)}`}></div>
                            </div>
                          </div>

                          <div style={{ fontSize: 11, textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ color: '#0176d3', fontWeight: 600 }}>B: {fmt(m.billed)}</span>
                            <span style={{ color: '#059669', fontWeight: 700 }}>C: {fmt(m.collected)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ display: 'flex', gap: 16, marginTop: 14, paddingTop: 10, borderTop: '1px solid #f1f5f9', fontSize: 11 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 10, height: 10, background: '#0176d3', borderRadius: 2 }}></span> Demand Billed
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 10, height: 10, background: '#059669', borderRadius: 2 }}></span> Money Collected
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 10, height: 10, background: '#dc2626', borderRadius: 2 }}></span> Expenses Paid
                    </span>
                  </div>
                </div>

                {/* Collection Method Distribution */}
                <div className="card" style={{ padding: 18 }}>
                  <div className="card-header" style={{ padding: 0, marginBottom: 14 }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Collection Channels</h3>
                    <p className="text-xs text-muted" style={{ margin: '2px 0 0' }}>Distribution of money received</p>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {Object.entries(data?.collection_modes || data?.today_collection?.by_mode || {
                      CASH: 0, UPI: 0, BANK_TRANSFER: 0, CHEQUE: 0, CARD: 0, ONLINE: 0
                    }).map(([modeKey, val]) => {
                      const modeTotal = data?.total_collected || 1;
                      const pct = Math.round(((val || 0) / modeTotal) * 100);

                      const getModeIcon = (k) => {
                        if (k === 'CASH') return 'ti-cash';
                        if (k === 'UPI') return 'ti-qrcode';
                        if (k === 'BANK_TRANSFER') return 'ti-building-bank';
                        if (k === 'CHEQUE') return 'ti-file-invoice';
                        if (k === 'CARD') return 'ti-credit-card';
                        return 'ti-world';
                      };

                      return (
                        <div key={modeKey} style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#1e293b' }}>
                              <i className={`ti ${getModeIcon(modeKey)}`} style={{ color: '#0176d3' }}></i>
                              {modeKey.replace('_', ' ')}
                            </span>
                            <span style={{ fontSize: 13, fontWeight: 800, color: '#059669' }}>{fmt(val)}</span>
                          </div>
                          <div style={{ height: 5, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: '#059669', borderRadius: 3 }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => navigate('/finance/reconciliation')}
                    className="btn btn-neutral btn-sm w-full mt-4"
                    style={{ width: '100%', justifyContent: 'center', fontWeight: 700 }}
                  >
                    <i className="ti ti-building-bank"></i> Verify with Bank Statement &rarr;
                  </button>
                </div>

              </div>

              {/* Service Breakdown & Expense Categorization */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>

                {/* Service Breakdown */}
                <div className="card" style={{ padding: 18 }}>
                  <div className="card-header" style={{ padding: 0, marginBottom: 14 }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Fee Heads Realization</h3>
                    <p className="text-xs text-muted" style={{ margin: '2px 0 0' }}>Tuition, Transport, Hostel, Library &amp; Exam realizations</p>
                  </div>

                  <div className="table-responsive">
                    <table className="table" style={{ fontSize: 12 }}>
                      <thead>
                        <tr>
                          <th>Service Head</th>
                          <th style={{ textAlign: 'right' }}>Billed</th>
                          <th style={{ textAlign: 'right' }}>Collected</th>
                          <th style={{ textAlign: 'right' }}>Outstanding</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(data?.service_wise || []).map((s, idx) => (
                          <tr key={idx}>
                            <td style={{ fontWeight: 600 }}>{s.name}</td>
                            <td style={{ textAlign: 'right' }}>{fmt(s.billed)}</td>
                            <td style={{ textAlign: 'right', color: '#059669', fontWeight: 700 }}>{fmt(s.collected)}</td>
                            <td style={{ textAlign: 'right', color: (s.outstanding || 0) > 0 ? '#d97706' : '#64748b', fontWeight: 600 }}>
                              {fmt(s.outstanding)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Expense Categorization */}
                <div className="card" style={{ padding: 18 }}>
                  <div className="card-header" style={{ padding: 0, marginBottom: 14 }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Operating Expenses by Category</h3>
                    <p className="text-xs text-muted" style={{ margin: '2px 0 0' }}>Where school funds were spent during the period</p>
                  </div>

                  <div className="table-responsive">
                    <table className="table" style={{ fontSize: 12 }}>
                      <thead>
                        <tr>
                          <th>Category</th>
                          <th>Department</th>
                          <th style={{ textAlign: 'right' }}>Amount Paid</th>
                          <th style={{ textAlign: 'center' }}>Entries</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(data?.department_expenses || []).map((d, idx) => (
                          <tr key={idx}>
                            <td style={{ fontWeight: 600 }}>{d.label}</td>
                            <td><span className="badge badge-neutral" style={{ fontSize: 10 }}>{d.department}</span></td>
                            <td style={{ textAlign: 'right', color: '#dc2626', fontWeight: 700 }}>{fmt(d.amount)}</td>
                            <td style={{ textAlign: 'center', color: '#64748b' }}>{d.count || 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>

              {/* Class Realization Table */}
              <div className="card mb-6" style={{ padding: 18 }}>
                <div className="card-header" style={{ padding: 0, marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Class-wise Realization Matrix</h3>
                    <p className="text-xs text-muted" style={{ margin: '2px 0 0' }}>Student strength, billing, realization rate, and outstanding dues per class</p>
                  </div>
                  <button onClick={() => navigate('/finance/outstanding')} className="btn btn-sm btn-neutral">
                    View Detailed Dues &rarr;
                  </button>
                </div>

                <div className="table-responsive">
                  <table className="table" style={{ fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th>Class &amp; Section</th>
                        <th style={{ textAlign: 'center' }}>Students</th>
                        <th style={{ textAlign: 'right' }}>Total Demanded</th>
                        <th style={{ textAlign: 'right' }}>Total Collected</th>
                        <th style={{ textAlign: 'right' }}>Still to Collect</th>
                        <th style={{ textAlign: 'center', width: 140 }}>Recovery Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data?.class_wise || []).map((cls) => {
                        const recRate = cls.collection_pct || 0;
                        return (
                          <tr key={cls.class_id}>
                            <td style={{ fontWeight: 700 }}>{cls.class_name}</td>
                            <td style={{ textAlign: 'center' }}>{cls.students_count}</td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(cls.billed)}</td>
                            <td style={{ textAlign: 'right', color: '#059669', fontWeight: 700 }}>{fmt(cls.collected)}</td>
                            <td style={{ textAlign: 'right', color: (cls.outstanding || 0) > 0 ? '#d97706' : '#64748b', fontWeight: 600 }}>
                              {fmt(cls.outstanding)}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{ flex: 1, height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                                  <div style={{ width: `${Math.min(100, recRate)}%`, height: '100%', background: recRate >= 80 ? '#059669' : recRate >= 50 ? '#d97706' : '#dc2626' }}></div>
                                </div>
                                <span style={{ fontSize: 11, fontWeight: 700 }}>{recRate}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Today's Cashier Counter Collection & End of Day Reconciliation */}
              <div className="card" style={{ padding: 18, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Today's Counter Collection &amp; Cashier Reconciliation</h3>
                    <p className="text-xs text-muted" style={{ margin: '2px 0 0' }}>
                      Date: {data?.today_collection?.date} &bull; End of day cash drawer audit
                    </p>
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#059669' }}>
                    Today's Total: {fmt(data?.today_collection?.total_amount)}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                  {Object.entries(data?.today_collection?.by_mode || {}).map(([mode, amt]) => (
                    <div key={mode} style={{ background: '#fff', padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                      <div className="text-xs text-muted font-semibold">{mode}</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', marginTop: 2 }}>{fmt(amt)}</div>
                    </div>
                  ))}
                </div>
              </div>

            </>
          )}

        </div>
      </div>
    </div>
  );
}
