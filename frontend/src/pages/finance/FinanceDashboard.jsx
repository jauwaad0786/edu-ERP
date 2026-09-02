import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function FinanceDashboard() {
  const navigate = useNavigate();
  const [session, setSession] = useState('2026-27');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/fees-finance/dashboard?session=${session}`);
      setData(res.data);
    } catch (err) {
      toast.error('Failed to load finance metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [session]);

  const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

  const maxMonthValue = Math.max(
    ...(data?.monthly_summary?.map((m) => Math.max(m.billed, m.collected, m.expenses)) || [10000]),
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
                <span className="badge badge-info">Financial Year {session}</span>
                <span className="text-xs text-muted">Central Ledger System</span>
              </div>
              <h2 className="page-title">Finance Executive Dashboard</h2>
              <p className="page-subtitle">
                Unified financial ledger, class-wise fee collections, cash flow graphs, and net surplus tracking.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="text-xs font-semibold text-muted">Session:</span>
                <select
                  value={session}
                  onChange={(e) => setSession(e.target.value)}
                  className="form-select"
                  style={{ width: 130, height: 34, fontSize: 13, fontWeight: 700 }}
                >
                  <option value="2026-27">2026-27</option>
                  <option value="2025-26">2025-26</option>
                  <option value="2024-25">2024-25</option>
                </select>
              </div>

              <button
                onClick={() => navigate('/finance/payments/collect')}
                className="btn btn-primary"
              >
                <i className="ti ti-credit-card"></i>
                Collect Payment
              </button>

              <button
                onClick={() => navigate('/finance/bills')}
                className="btn btn-neutral"
              >
                <i className="ti ti-file-invoice"></i>
                Fee Bills
              </button>
            </div>
          </div>

          {loading ? (
            <div className="empty-state">
              <div className="spinner" style={{ width: 32, height: 32 }}></div>
              <p className="mt-4">Loading financial command center...</p>
            </div>
          ) : (
            <>
              {/* 5 Top KPI Cards */}
              <div className="grid-4 mb-6" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
                {/* Total Invoiced */}
                <div className="stat-card" style={{ borderLeft: '4px solid #0176d3' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div className="stat-label" style={{ margin: 0 }}>Total Invoiced</div>
                    <div className="stat-icon" style={{ background: '#e8f4fd', color: '#0176d3', margin: 0, width: 32, height: 32 }}>
                      <i className="ti ti-file-invoice" style={{ fontSize: 16 }}></i>
                    </div>
                  </div>
                  <div className="stat-value" style={{ fontSize: '1.5rem', color: '#0176d3' }}>
                    {fmt(data?.total_billed)}
                  </div>
                  <div className="stat-sub">{data?.bills_count || 0} student bills issued</div>
                </div>

                {/* Total Collected */}
                <div className="stat-card" style={{ borderLeft: '4px solid #2e844a' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div className="stat-label" style={{ margin: 0 }}>Total Collected</div>
                    <div className="stat-icon" style={{ background: '#eaf5ea', color: '#2e844a', margin: 0, width: 32, height: 32 }}>
                      <i className="ti ti-arrow-down-right" style={{ fontSize: 16 }}></i>
                    </div>
                  </div>
                  <div className="stat-value" style={{ fontSize: '1.5rem', color: '#2e844a' }}>
                    {fmt(data?.total_collected)}
                  </div>
                  <div className="stat-sub">{data?.payments_count || 0} receipts generated</div>
                </div>

                {/* Outstanding Dues */}
                <div className="stat-card" style={{ borderLeft: '4px solid #dd7a01' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div className="stat-label" style={{ margin: 0 }}>Outstanding Dues</div>
                    <div className="stat-icon" style={{ background: '#fef5e4', color: '#dd7a01', margin: 0, width: 32, height: 32 }}>
                      <i className="ti ti-alert-circle" style={{ fontSize: 16 }}></i>
                    </div>
                  </div>
                  <div className="stat-value" style={{ fontSize: '1.5rem', color: '#dd7a01' }}>
                    {fmt(data?.outstanding)}
                  </div>
                  <div className="stat-sub">{data?.pending_bills_count || 0} unpaid balances</div>
                </div>

                {/* School Expenses */}
                <div className="stat-card" style={{ borderLeft: '4px solid #ba0517' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div className="stat-label" style={{ margin: 0 }}>Total Expenses</div>
                    <div className="stat-icon" style={{ background: '#fef1ee', color: '#ba0517', margin: 0, width: 32, height: 32 }}>
                      <i className="ti ti-arrow-up-right" style={{ fontSize: 16 }}></i>
                    </div>
                  </div>
                  <div className="stat-value" style={{ fontSize: '1.5rem', color: '#ba0517' }}>
                    {fmt(data?.total_expenses)}
                  </div>
                  <div className="stat-sub">Salaries & operational bills</div>
                </div>

                {/* Net Surplus */}
                <div className="stat-card" style={{ borderLeft: `4px solid ${(data?.net_surplus ?? 0) >= 0 ? '#1b4d3e' : '#ba0517'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div className="stat-label" style={{ margin: 0 }}>Net Surplus</div>
                    <div className="stat-icon" style={{ background: (data?.net_surplus ?? 0) >= 0 ? '#eaf5ea' : '#fef1ee', color: (data?.net_surplus ?? 0) >= 0 ? '#2e844a' : '#ba0517', margin: 0, width: 32, height: 32 }}>
                      <i className="ti ti-currency-rupee" style={{ fontSize: 16 }}></i>
                    </div>
                  </div>
                  <div className="stat-value" style={{ fontSize: '1.5rem', color: (data?.net_surplus ?? 0) >= 0 ? '#1b4d3e' : '#ba0517' }}>
                    {fmt(data?.net_surplus)}
                  </div>
                  <div className="stat-sub">Revenue minus expenses</div>
                </div>
              </div>

              {/* Visual Graph: Monthly Income vs Expenses Chart */}
              <div className="card mb-6">
                <div className="card-header">
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Cash Flow Trend & Monthly Comparison</h3>
                    <p className="text-xs text-muted" style={{ margin: 0 }}>
                      Comparison of Invoiced Fees, Realized Cash Collections, and Operational Expenses.
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 10, height: 10, background: '#2e844a', borderRadius: 2 }}></span>
                      Collected
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 10, height: 10, background: '#0176d3', borderRadius: 2 }}></span>
                      Invoiced
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 10, height: 10, background: '#ba0517', borderRadius: 2 }}></span>
                      Expenses
                    </span>
                  </div>
                </div>

                <div className="card-body" style={{ padding: '20px 24px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: 160, gap: 12, borderBottom: '1px solid var(--neutral-2)', paddingBottom: 8 }}>
                    {data?.monthly_summary?.map((m, idx) => {
                      const collHeight = maxMonthValue > 0 ? Math.max((m.collected / maxMonthValue) * 140, 4) : 4;
                      const billedHeight = maxMonthValue > 0 ? Math.max((m.billed / maxMonthValue) * 140, 4) : 4;
                      const expHeight = maxMonthValue > 0 ? Math.max((m.expenses / maxMonthValue) * 140, 4) : 4;
                      return (
                        <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, width: '100%', justifyContent: 'center' }}>
                            {/* Invoiced Bar */}
                            <div
                              title={`Invoiced: ${fmt(m.billed)}`}
                              style={{ width: 8, height: `${billedHeight}px`, background: '#0176d3', borderRadius: '3px 3px 0 0', opacity: 0.7 }}
                            ></div>
                            {/* Collected Bar */}
                            <div
                              title={`Collected: ${fmt(m.collected)}`}
                              style={{ width: 10, height: `${collHeight}px`, background: '#2e844a', borderRadius: '3px 3px 0 0' }}
                            ></div>
                            {/* Expense Bar */}
                            <div
                              title={`Expense: ${fmt(m.expenses)}`}
                              style={{ width: 8, height: `${expHeight}px`, background: '#ba0517', borderRadius: '3px 3px 0 0', opacity: 0.8 }}
                            ></div>
                          </div>
                          <div style={{ fontSize: 10, fontWeight: 700, marginTop: 8, color: 'var(--neutral-6)' }}>
                            {m.month_label.slice(0, 3)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Class-wise Collection & Defaulter Summary Table */}
              <div className="card mb-6">
                <div className="card-header">
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Class-Wise Fee Collection & Dues Status</h3>
                    <p className="text-xs text-muted" style={{ margin: 0 }}>
                      Class-wise breakdown of student count, total fees invoiced, fees paid, and pending balance.
                    </p>
                  </div>
                  <span className="badge badge-info">{data?.class_wise?.length || 0} Classes</span>
                </div>

                <div className="table-container" style={{ border: 'none' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Class & Section</th>
                        <th>Students</th>
                        <th style={{ textAlign: 'right' }}>Total Invoiced</th>
                        <th style={{ textAlign: 'right' }}>Total Paid</th>
                        <th style={{ textAlign: 'right' }}>Pending Dues</th>
                        <th>Collection Rate</th>
                        <th style={{ textAlign: 'center' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data?.class_wise?.map((c) => (
                        <tr key={c.class_id}>
                          <td style={{ fontWeight: 700, color: 'var(--neutral-9)' }}>{c.class_name}</td>
                          <td>{c.students_count} students</td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(c.billed)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: '#2e844a' }}>{fmt(c.collected)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 800, color: c.outstanding > 0 ? '#dd7a01' : '#2e844a' }}>
                            {fmt(c.outstanding)}
                          </td>
                          <td style={{ minWidth: 140 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div className="progress-bar" style={{ flex: 1, height: 6 }}>
                                <div
                                  className="progress-fill success"
                                  style={{ width: `${Math.min(c.collection_pct, 100)}%` }}
                                ></div>
                              </div>
                              <span style={{ fontSize: 11, fontWeight: 700, width: 36, textAlign: 'right' }}>
                                {c.collection_pct}%
                              </span>
                            </div>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              onClick={() => navigate(`/finance/payments/collect?class_id=${c.class_id}`)}
                              className="btn btn-neutral btn-sm"
                            >
                              Collect Fees
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Service & Department Distribution Cards */}
              <div className="card mb-6">
                <div className="card-header">
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Service & Department Revenue Breakdown</h3>
                    <p className="text-xs text-muted" style={{ margin: 0 }}>
                      Automatic multi-department credit distribution across Accounts, Transport, Hostel, and Library.
                    </p>
                  </div>
                  <span className="badge badge-neutral">{data?.service_wise?.length || 0} Active Services</span>
                </div>
                <div className="card-body" style={{ padding: 16 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
                    {data?.service_wise?.map((svc, idx) => {
                      const pct = svc.billed > 0 ? Math.round((svc.collected / svc.billed) * 100) : 0;
                      return (
                        <div key={idx} style={{ background: '#fafaf9', border: '1px solid var(--neutral-2)', borderRadius: 8, padding: 14 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--neutral-9)' }}>{svc.name}</div>
                              <span className="badge badge-info" style={{ fontSize: 10, padding: '1px 6px' }}>{svc.department}</span>
                            </div>
                            <span className="badge badge-success" style={{ fontSize: 11 }}>{pct}%</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                            <span className="text-muted">Collected:</span>
                            <span style={{ fontWeight: 700, color: '#2e844a' }}>{fmt(svc.collected)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 8 }}>
                            <span className="text-muted">Outstanding:</span>
                            <span style={{ fontWeight: 700, color: '#dd7a01' }}>{fmt(svc.outstanding)}</span>
                          </div>
                          <div className="progress-bar" style={{ height: 4 }}>
                            <div className="progress-fill success" style={{ width: `${Math.min(pct, 100)}%` }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Month-by-Month Financial Progression */}
              <div className="card mb-6">
                <div className="card-header">
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Month-By-Month Financial Progression</h3>
                    <p className="text-xs text-muted" style={{ margin: 0 }}>
                      Session {session} monthly billing, cash collection, expenditures, and net surplus.
                    </p>
                  </div>
                  <span className="badge badge-info">April to March</span>
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
                      {data?.monthly_summary?.map((m, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: 700 }}>{m.month_label}</td>
                          <td style={{ textAlign: 'right' }}>{fmt(m.billed)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: '#2e844a' }}>{fmt(m.collected)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600, color: m.outstanding > 0 ? '#dd7a01' : 'var(--neutral-6)' }}>
                            {fmt(m.outstanding)}
                          </td>
                          <td style={{ textAlign: 'right', color: '#ba0517' }}>{fmt(m.expenses)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 800, color: m.net_surplus >= 0 ? '#2e844a' : '#ba0517' }}>
                            {fmt(m.net_surplus)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Today's Counter Collection Reconciliation */}
              <div className="card">
                <div className="card-header">
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Today's Counter Collection & Reconciliation</h3>
                    <p className="text-xs text-muted" style={{ margin: 0 }}>
                      Date: {data?.today_collection?.date} • End of day cashier reconciliation.
                    </p>
                  </div>
                  <span className="badge badge-success" style={{ fontSize: 12 }}>
                    Total: {fmt(data?.today_collection?.total_amount)}
                  </span>
                </div>
                <div className="card-body" style={{ padding: 16 }}>
                  <div className="grid-2">
                    {/* By Payment Mode */}
                    <div>
                      <div className="stat-label">Payment Mode Breakdown</div>
                      <div className="table-container" style={{ marginTop: 8 }}>
                        <table>
                          <thead>
                            <tr>
                              <th>Mode</th>
                              <th style={{ textAlign: 'right' }}>Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(data?.today_collection?.by_mode || {}).map(([mode, amt]) => (
                              <tr key={mode}>
                                <td style={{ fontWeight: 600 }}>{mode}</td>
                                <td style={{ textAlign: 'right', fontWeight: 700, color: '#2e844a' }}>{fmt(amt)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* By Collector / Cashier */}
                    <div>
                      <div className="stat-label">Cashier Collection Summary</div>
                      <div className="table-container" style={{ marginTop: 8 }}>
                        <table>
                          <thead>
                            <tr>
                              <th>Cashier / Collector</th>
                              <th style={{ textAlign: 'right' }}>Collected Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data?.today_collection?.by_collector?.map((c, i) => (
                              <tr key={i}>
                                <td style={{ fontWeight: 600 }}>{c.collector}</td>
                                <td style={{ textAlign: 'right', fontWeight: 700, color: '#2e844a' }}>{fmt(c.amount)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
