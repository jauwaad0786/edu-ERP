import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function FinanceReportsPage() {
  const [session, setSession] = useState('2026-27');
  const [reportType, setReportType] = useState('DAILY'); // DAILY | SERVICE | MONTHLY | PNL
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // PnL Specific state
  const [accountingPolicy, setAccountingPolicy] = useState('CASH'); // CASH | ACCRUAL
  const [pnlData, setPnlData] = useState(null);
  const [pnlLoading, setPnlLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchReports = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/fees-finance/dashboard?session=${session}`);
      setData(res.data);
    } catch (err) {
      toast.error('Failed to load finance reports');
    } finally {
      setLoading(false);
    }
  };

  const fetchPnL = async () => {
    try {
      setPnlLoading(true);
      let q = `?session=${session}&accounting_policy=${accountingPolicy}`;
      if (dateFrom) q += `&date_from=${dateFrom}`;
      if (dateTo) q += `&date_to=${dateTo}`;
      const res = await api.get(`/finance/reports/profit-loss${q}`);
      setPnlData(res.data);
    } catch (err) {
      toast.error('Failed to load P&L statement');
    } finally {
      setPnlLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [session]);

  useEffect(() => {
    if (reportType === 'PNL') {
      fetchPnL();
    }
  }, [reportType, session, accountingPolicy, dateFrom, dateTo]);

  const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

  const exportCSV = () => {
    if (reportType === 'PNL') {
      if (!pnlData) return;
      let csv = `"${pnlData.statement_title} - Session ${session}"\n`;
      csv += `"Category","Amount (INR)","Percentage"\n\n`;
      csv += `"OPERATING REVENUE / INCOME"\n`;
      (pnlData.income?.by_category || []).forEach((c) => {
        csv += `"${c.category}",${c.amount},${c.percentage}%\n`;
      });
      csv += `"Total Income",${pnlData.income?.total_income},100%\n\n`;
      csv += `"OPERATING EXPENSES"\n`;
      (pnlData.expenses?.by_category || []).forEach((c) => {
        csv += `"${c.category}",${c.amount},${c.percentage}%\n`;
      });
      csv += `"Total Expenses",${pnlData.expenses?.total_expenses},100%\n\n`;
      csv += `"NET OPERATING RESULT",${pnlData.net_operating_surplus}\n`;
      csv += `"Cash Flow Position: Opening Balance",${pnlData.cash_flow?.opening_balance}\n`;
      csv += `"Cash Flow Position: Closing Balance",${pnlData.cash_flow?.closing_balance}\n`;

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', `Profit_and_Loss_${accountingPolicy}_${session}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('P&L Statement Exported successfully!');
      return;
    }

    if (!data) return;
    let csv = '';
    if (reportType === 'MONTHLY') {
      csv = 'Month,Total Billed,Total Collected,Outstanding,Expenses,Net Surplus\n';
      (data.monthly_summary || []).forEach((m) => {
        csv += `"${m.month_label}",${m.billed},${m.collected},${m.outstanding},${m.expenses},${m.net_surplus}\n`;
      });
    } else if (reportType === 'SERVICE') {
      csv = 'Service Name,Department,Billed,Collected,Outstanding\n';
      (data.service_wise || []).forEach((s) => {
        csv += `"${s.name}","${s.department}",${s.billed},${s.collected},${s.outstanding}\n`;
      });
    } else {
      csv = 'Payment Mode,Amount Collected\n';
      Object.entries(data.today_collection?.by_mode || {}).forEach(([m, amt]) => {
        csv += `"${m}",${amt}\n`;
      });
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `Finance_Report_${reportType}_${session}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    toast.success('CSV Exported successfully!');
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar title="Finance & Collection Reports" />
        <div className="page-body">

          {/* Salesforce Blue Hero Banner */}
          <div style={{
            background: 'linear-gradient(135deg, #0176d3 0%, #032d60 100%)',
            borderRadius: 14, padding: '22px 26px', color: '#fff', marginBottom: 20,
            boxShadow: '0 4px 20px rgba(1, 118, 211, 0.25)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ background: 'rgba(255,255,255,0.2)', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 800 }}>
                  FINANCIAL STATEMENTS
                </span>
                <span style={{ fontSize: 12, opacity: 0.9 }}>Daily, Service &amp; Monthly Audits &bull; Automated Reconciliation</span>
              </div>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Finance &amp; Collection Reports</h1>
              <p style={{ margin: '4px 0 0', fontSize: 13, opacity: 0.9, maxWidth: 680 }}>
                Generate daily cashier reconciliation, department revenue distributions, and executive P&amp;L audit statements.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.15)', padding: '6px 12px', borderRadius: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700 }}>Session:</span>
                <select
                  value={session}
                  onChange={(e) => setSession(e.target.value)}
                  style={{
                    background: '#fff', color: '#032d60', border: 'none', borderRadius: 6,
                    padding: '4px 8px', fontSize: 12, fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  <option value="2026-27">2026-27</option>
                  <option value="2025-26">2025-26</option>
                  <option value="2024-25">2024-25</option>
                </select>
              </div>

              <button
                onClick={exportCSV}
                style={{
                  background: '#fff', color: '#0176d3', border: 'none', borderRadius: 10,
                  padding: '10px 18px', fontSize: 13, fontWeight: 800, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
                }}
              >
                <i className="ti ti-file-spreadsheet" style={{ color: '#059669', fontSize: 16 }} />
                Export CSV
              </button>

              <button
                onClick={() => window.print()}
                style={{
                  background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)',
                  borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6
                }}
              >
                <i className="ti ti-printer" />
                Print Statement
              </button>
            </div>
          </div>

          {/* Quick Snapshot KPIs */}
          {data && (
            <div className="grid-4 mb-6" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
              <div className="stat-card" style={{ borderLeft: '4px solid #0176d3', padding: 14 }}>
                <div className="stat-label">Total Invoiced</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#0176d3' }}>{fmt(data.total_billed)}</div>
              </div>
              <div className="stat-card" style={{ borderLeft: '4px solid #059669', padding: 14 }}>
                <div className="stat-label">Total Realized</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#059669' }}>{fmt(data.total_collected)}</div>
              </div>
              <div className="stat-card" style={{ borderLeft: '4px solid #d97706', padding: 14 }}>
                <div className="stat-label">Active Outstanding</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#d97706' }}>{fmt(data.outstanding)}</div>
              </div>
              <div className="stat-card" style={{ borderLeft: `4px solid ${(data.net_surplus ?? 0) >= 0 ? '#0176d3' : '#dc2626'}`, padding: 14 }}>
                <div className="stat-label">Net Operating Surplus</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: (data.net_surplus ?? 0) >= 0 ? '#0176d3' : '#dc2626' }}>
                  {fmt(data.net_surplus)}
                </div>
              </div>
            </div>
          )}

          {/* Report Type Selectors */}
          <div className="card mb-6" style={{ padding: '10px 16px' }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[
                { id: 'DAILY', label: 'Daily Collection & Reconciliation', icon: 'ti-credit-card' },
                { id: 'SERVICE', label: 'Service / Department Revenue', icon: 'ti-layers-intersect' },
                { id: 'MONTHLY', label: 'Month-Wise Financial Performance', icon: 'ti-calendar' },
                { id: 'PNL', label: 'Profit & Loss / Operating Statement', icon: 'ti-scale' },
              ].map((tab) => {
                const active = reportType === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setReportType(tab.id)}
                    className={`btn ${active ? 'btn-primary' : 'btn-neutral'} btn-sm`}
                    style={{
                      borderRadius: 20,
                      background: active ? '#0176d3' : undefined,
                      borderColor: active ? '#0176d3' : undefined,
                      color: active ? '#fff' : undefined,
                      fontWeight: active ? 800 : 600,
                      padding: '6px 14px'
                    }}
                  >
                    <i className={`ti ${tab.icon}`}></i>
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Loading or Report Display Area */}
          {loading ? (
            <div className="card" style={{ padding: 48, textAlign: 'center' }}>
              <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto' }}></div>
              <p className="mt-4 text-muted" style={{ fontWeight: 600 }}>Loading verified financial statements...</p>
            </div>
          ) : !data ? (
            <div className="card" style={{ padding: 48, textAlign: 'center' }}>
              <i className="ti ti-alert-triangle" style={{ fontSize: 36, color: '#d97706' }}></i>
              <h4 style={{ marginTop: 12 }}>Unable to Load Reports</h4>
              <p className="text-muted">Could not retrieve financial data for session {session}.</p>
              <button onClick={fetchReports} className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>
                <i className="ti ti-refresh"></i> Retry
              </button>
            </div>
          ) : (
            <div className="card">
              {reportType === 'DAILY' && (
                <>
                  <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Today's Counter Collection Breakdown</h3>
                      <p className="text-xs text-muted" style={{ margin: 0 }}>Date: {data.today_collection?.date || 'Today'}</p>
                    </div>
                    <span className="badge badge-success" style={{ fontSize: 13, background: '#eaf5ea', color: '#059669', border: '1px solid #bbf7d0' }}>
                      Total Realized: {fmt(data.today_collection?.total_amount)}
                    </span>
                  </div>
                  <div className="card-body" style={{ padding: 16 }}>
                    <div className="grid-2">
                      <div>
                        <div className="stat-label mb-2" style={{ fontWeight: 700, color: 'var(--neutral-8)' }}>Payment Mode Breakdown</div>
                        <div className="table-container">
                          <table className="table">
                            <thead>
                              <tr>
                                <th>Mode</th>
                                <th style={{ textAlign: 'right' }}>Collected Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              {Object.entries(data.today_collection?.by_mode || {}).map(([mode, amt]) => (
                                <tr key={mode}>
                                  <td style={{ fontWeight: 600 }}>{mode}</td>
                                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#059669' }}>{fmt(amt)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div>
                        <div className="stat-label mb-2" style={{ fontWeight: 700, color: 'var(--neutral-8)' }}>Cashier Collection Summary</div>
                        <div className="table-container">
                          <table className="table">
                            <thead>
                              <tr>
                                <th>Cashier</th>
                                <th style={{ textAlign: 'right' }}>Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(data.today_collection?.by_collector || []).length === 0 ? (
                                <tr>
                                  <td colSpan={2} style={{ textAlign: 'center', color: 'var(--neutral-5)' }}>No counter collections recorded today</td>
                                </tr>
                              ) : (
                                data.today_collection?.by_collector?.map((c, i) => (
                                  <tr key={i}>
                                    <td style={{ fontWeight: 600 }}>{c.collector}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#059669' }}>{fmt(c.amount)}</td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {reportType === 'SERVICE' && (
                <>
                  <div className="card-header">
                    <div>
                      <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Service &amp; Department Revenue Breakdown</h3>
                      <p className="text-xs text-muted" style={{ margin: 0 }}>Academic Session: {session}</p>
                    </div>
                  </div>
                  <div className="table-container" style={{ border: 'none' }}>
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Service Name</th>
                          <th>Department</th>
                          <th style={{ textAlign: 'right' }}>Total Invoiced</th>
                          <th style={{ textAlign: 'right' }}>Collected</th>
                          <th style={{ textAlign: 'right' }}>Outstanding</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(data.service_wise || []).map((s, i) => (
                          <tr key={i}>
                            <td style={{ fontWeight: 700 }}>{s.name}</td>
                            <td>
                              <span className="badge badge-neutral" style={{ fontSize: 10 }}>{s.department}</span>
                            </td>
                            <td style={{ textAlign: 'right' }}>{fmt(s.billed)}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: '#059669' }}>{fmt(s.collected)}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: s.outstanding > 0 ? '#d97706' : '#0176d3' }}>{fmt(s.outstanding)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {reportType === 'MONTHLY' && (
                <>
                  <div className="card-header">
                    <div>
                      <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Monthly Income, Expenses &amp; Net Surplus ({session})</h3>
                      <p className="text-xs text-muted" style={{ margin: 0 }}>April {session.split('-')[0]} to March {parseInt(session.split('-')[0]) + 1}</p>
                    </div>
                  </div>
                  <div className="table-container" style={{ border: 'none' }}>
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Calendar Month</th>
                          <th style={{ textAlign: 'right' }}>Total Invoiced</th>
                          <th style={{ textAlign: 'right' }}>Collected</th>
                          <th style={{ textAlign: 'right' }}>Outstanding</th>
                          <th style={{ textAlign: 'right' }}>Expenses</th>
                          <th style={{ textAlign: 'right' }}>Net Surplus</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(data.monthly_summary || []).map((m, i) => (
                          <tr key={i}>
                            <td style={{ fontWeight: 700 }}>{m.month_label}</td>
                            <td style={{ textAlign: 'right' }}>{fmt(m.billed)}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: '#059669' }}>{fmt(m.collected)}</td>
                            <td style={{ textAlign: 'right', fontWeight: 600, color: m.outstanding > 0 ? '#d97706' : 'inherit' }}>{fmt(m.outstanding)}</td>
                            <td style={{ textAlign: 'right', color: '#dc2626' }}>{fmt(m.expenses)}</td>
                            <td style={{ textAlign: 'right', fontWeight: 800, color: m.net_surplus >= 0 ? '#0176d3' : '#dc2626' }}>
                              {fmt(m.net_surplus)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {reportType === 'PNL' && (
                <>
                  <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0 }}>
                          {pnlData?.statement_title || 'Operating Income & Expense Statement'}
                        </h3>
                        <span className="badge" style={{
                          background: accountingPolicy === 'CASH' ? '#ecfdf5' : '#eff6ff',
                          color: accountingPolicy === 'CASH' ? '#059669' : '#1d4ed8',
                          border: `1px solid ${accountingPolicy === 'CASH' ? '#a7f3d0' : '#bfdbfe'}`,
                          fontWeight: 700
                        }}>
                          {accountingPolicy === 'CASH' ? 'Cash Basis (Receipts Realized)' : 'Accrual Basis (Invoiced Demands)'}
                        </span>
                      </div>
                      <p className="text-xs text-muted" style={{ margin: '2px 0 0' }}>
                        Session: {session} &bull; Generated for Executive Review (Zero silent cash conflation)
                      </p>
                    </div>

                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', background: '#f3f4f6', padding: 3, borderRadius: 8 }}>
                        <button
                          onClick={() => setAccountingPolicy('CASH')}
                          className={`btn btn-xs ${accountingPolicy === 'CASH' ? 'btn-primary' : 'btn-neutral'}`}
                          style={{ borderRadius: 6, fontWeight: 700 }}
                        >
                          Cash Basis
                        </button>
                        <button
                          onClick={() => setAccountingPolicy('ACCRUAL')}
                          className={`btn btn-xs ${accountingPolicy === 'ACCRUAL' ? 'btn-primary' : 'btn-neutral'}`}
                          style={{ borderRadius: 6, fontWeight: 700 }}
                        >
                          Accrual Basis
                        </button>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <input
                          type="date"
                          value={dateFrom}
                          onChange={(e) => setDateFrom(e.target.value)}
                          className="input input-xs"
                          style={{ width: 120 }}
                        />
                        <span className="text-muted text-xs">to</span>
                        <input
                          type="date"
                          value={dateTo}
                          onChange={(e) => setDateTo(e.target.value)}
                          className="input input-xs"
                          style={{ width: 120 }}
                        />
                        {(dateFrom || dateTo) && (
                          <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="btn btn-neutral btn-xs">
                            Clear
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {pnlLoading ? (
                    <div style={{ padding: 48, textAlign: 'center' }}>
                      <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto' }}></div>
                      <p className="mt-4 text-muted">Calculating Operating Profit &amp; Loss...</p>
                    </div>
                  ) : !pnlData ? (
                    <div style={{ padding: 48, textAlign: 'center' }}>
                      <p className="text-muted">Unable to calculate P&amp;L statement.</p>
                      <button onClick={fetchPnL} className="btn btn-primary btn-sm mt-2">Retry</button>
                    </div>
                  ) : (
                    <div className="card-body" style={{ padding: 20 }}>
                      {/* PnL Snapshot Cards */}
                      <div className="grid-3 mb-6" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                        <div className="stat-card" style={{ borderLeft: '4px solid #059669', padding: 14, background: '#f8fafc' }}>
                          <div className="stat-label">Total Operating Revenue</div>
                          <div style={{ fontSize: 22, fontWeight: 800, color: '#059669' }}>
                            {fmt(pnlData.income?.total_income)}
                          </div>
                          <div className="text-xs text-muted mt-1">
                            {accountingPolicy === 'CASH' ? 'Actual fee receipts collected' : 'Total demand bills invoiced'}
                          </div>
                        </div>

                        <div className="stat-card" style={{ borderLeft: '4px solid #dc2626', padding: 14, background: '#f8fafc' }}>
                          <div className="stat-label">Total Operating Expenses</div>
                          <div style={{ fontSize: 22, fontWeight: 800, color: '#dc2626' }}>
                            {fmt(pnlData.expenses?.total_expenses)}
                          </div>
                          <div className="text-xs text-muted mt-1">
                            {pnlData.expenses?.unpaid_liabilities > 0
                              ? `Includes ${fmt(pnlData.expenses.unpaid_liabilities)} unpaid liabilities`
                              : 'Actual expenses paid'}
                          </div>
                        </div>

                        <div className="stat-card" style={{
                          borderLeft: `4px solid ${pnlData.is_surplus ? '#0176d3' : '#e11d48'}`,
                          padding: 14,
                          background: pnlData.is_surplus ? '#f0f9ff' : '#fff1f2'
                        }}>
                          <div className="stat-label">Net Operating {pnlData.is_surplus ? 'Surplus' : 'Deficit'}</div>
                          <div style={{ fontSize: 22, fontWeight: 800, color: pnlData.is_surplus ? '#0176d3' : '#e11d48' }}>
                            {fmt(pnlData.net_operating_surplus)}
                          </div>
                          <div className="text-xs text-muted mt-1">
                            Operating Margin: {pnlData.income?.total_income > 0
                              ? `${Math.round((pnlData.net_operating_surplus / pnlData.income.total_income) * 100)}%`
                              : '0%'}
                          </div>
                        </div>
                      </div>

                      {/* Revenue & Expense Side-by-Side Tables */}
                      <div className="grid-2 mb-6" style={{ gap: 20 }}>
                        {/* Revenue Breakdown */}
                        <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 16 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#059669' }}>
                              <i className="ti ti-arrow-down-left" /> Revenue / Income Breakdown
                            </h4>
                            <span style={{ fontWeight: 800, color: '#059669' }}>{fmt(pnlData.income?.total_income)}</span>
                          </div>
                          <div className="table-container">
                            <table className="table">
                              <thead>
                                <tr>
                                  <th>Income Stream</th>
                                  <th style={{ textAlign: 'right' }}>Amount</th>
                                  <th style={{ textAlign: 'right' }}>Share</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(pnlData.income?.by_category || []).length === 0 ? (
                                  <tr><td colSpan={3} className="text-center text-muted">No income recognized in period</td></tr>
                                ) : (
                                  pnlData.income?.by_category?.map((c, i) => (
                                    <tr key={i}>
                                      <td style={{ fontWeight: 600 }}>{c.category}</td>
                                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#059669' }}>{fmt(c.amount)}</td>
                                      <td style={{ textAlign: 'right', fontSize: 12, color: '#6b7280' }}>{c.percentage}%</td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Expense Breakdown */}
                        <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 16 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#dc2626' }}>
                              <i className="ti ti-arrow-up-right" /> Operational Expense Breakdown
                            </h4>
                            <span style={{ fontWeight: 800, color: '#dc2626' }}>{fmt(pnlData.expenses?.total_expenses)}</span>
                          </div>
                          <div className="table-container">
                            <table className="table">
                              <thead>
                                <tr>
                                  <th>Expense Category</th>
                                  <th style={{ textAlign: 'right' }}>Amount</th>
                                  <th style={{ textAlign: 'right' }}>Share</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(pnlData.expenses?.by_category || []).length === 0 ? (
                                  <tr><td colSpan={3} className="text-center text-muted">No expenses recorded in period</td></tr>
                                ) : (
                                  pnlData.expenses?.by_category?.map((c, i) => (
                                    <tr key={i}>
                                      <td style={{ fontWeight: 600 }}>{c.category}</td>
                                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>{fmt(c.amount)}</td>
                                      <td style={{ textAlign: 'right', fontSize: 12, color: '#6b7280' }}>{c.percentage}%</td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>

                      {/* Cash Flow Position Section */}
                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16, marginBottom: 20 }}>
                        <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 800, color: '#1e293b' }}>
                          <i className="ti ti-building-bank" /> Bank &amp; Cash Flow Summary (Estimated)
                        </h4>
                        <div className="grid-4" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                          <div>
                            <div className="text-xs text-muted">Opening Cash &amp; Bank</div>
                            <div style={{ fontSize: 16, fontWeight: 700 }}>{fmt(pnlData.cash_flow?.opening_balance)}</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted">+ Total Cash Receipts</div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: '#059669' }}>+{fmt(pnlData.cash_flow?.total_receipts)}</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted">- Total Cash Paid Out</div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: '#dc2626' }}>-{fmt(pnlData.cash_flow?.total_disbursements)}</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted">= Closing Available Funds</div>
                            <div style={{ fontSize: 18, fontWeight: 800, color: '#0284c7' }}>{fmt(pnlData.cash_flow?.closing_balance)}</div>
                          </div>
                        </div>
                      </div>

                      {/* Policy & Auditing Disclosure */}
                      <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: 8, padding: 12, fontSize: 12, color: '#92400e' }}>
                        <i className="ti ti-info-circle" style={{ marginRight: 4 }} />
                        <strong>Accounting Disclosure:</strong> Demand bills represent invoiced receivables, not cash in hand. Operating surplus is computed based on your selected policy ({accountingPolicy}). Inter-account transfers and loan proceeds are excluded from operating income.
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
