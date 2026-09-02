import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function FinanceReportsPage() {
  const [session, setSession] = useState('2026-27');
  const [reportType, setReportType] = useState('DAILY'); // DAILY | SERVICE | MONTHLY
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    fetchReports();
  }, [session]);

  const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

  const exportCSV = () => {
    if (!data) return;
    let csv = '';
    if (reportType === 'MONTHLY') {
      csv = 'Month,Total Billed,Total Collected,Outstanding,Expenses,Net Surplus\n';
      data.monthly_summary?.forEach((m) => {
        csv += `"${m.month_label}",${m.billed},${m.collected},${m.outstanding},${m.expenses},${m.net_surplus}\n`;
      });
    } else if (reportType === 'SERVICE') {
      csv = 'Service Name,Department,Billed,Collected,Outstanding\n';
      data.service_wise?.forEach((s) => {
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
    toast.success('CSV Exported!');
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar title="Finance & Collection Reports" />
        <div className="page-body">

          {/* Page Header */}
          <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span className="badge badge-info">Financial Statements</span>
                <span className="text-xs text-muted">Daily, Service & Monthly Audits</span>
              </div>
              <h2 className="page-title">Finance & Collection Reports</h2>
              <p className="page-subtitle">
                Generate daily cashier reconciliation, department revenue distributions, and executive P&L statements.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={exportCSV} className="btn btn-neutral">
                <i className="ti ti-file-spreadsheet" style={{ color: '#2e844a' }}></i>
                Export CSV
              </button>
              <button onClick={() => window.print()} className="btn btn-neutral">
                <i className="ti ti-printer"></i>
                Print Statement
              </button>
            </div>
          </div>

          {/* Report Type Selectors */}
          <div className="card mb-6" style={{ padding: '8px 16px', background: '#fafaf9' }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[
                { id: 'DAILY', label: 'Daily Collection & Reconciliation', icon: 'ti-credit-card' },
                { id: 'SERVICE', label: 'Service / Department Revenue', icon: 'ti-layers-intersect' },
                { id: 'MONTHLY', label: 'Month-Wise Financial Performance', icon: 'ti-calendar' },
              ].map((tab) => {
                const active = reportType === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setReportType(tab.id)}
                    className={`btn ${active ? 'btn-primary' : 'btn-neutral'} btn-sm`}
                    style={{ borderRadius: 20 }}
                  >
                    <i className={`ti ${tab.icon}`}></i>
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Report Display Area */}
          <div className="card">
            {reportType === 'DAILY' && (
              <>
                <div className="card-header">
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Today's Counter Collection Breakdown</h3>
                    <p className="text-xs text-muted" style={{ margin: 0 }}>Date: {data?.today_collection?.date}</p>
                  </div>
                  <span className="badge badge-success" style={{ fontSize: 13 }}>
                    Total: {fmt(data?.today_collection?.total_amount)}
                  </span>
                </div>
                <div className="card-body" style={{ padding: 16 }}>
                  <div className="grid-2">
                    <div>
                      <div className="stat-label mb-2">Payment Mode Breakdown</div>
                      <div className="table-container">
                        <table className="table">
                          <thead>
                            <tr>
                              <th>Mode</th>
                              <th style={{ textAlign: 'right' }}>Collected Amount</th>
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

                    <div>
                      <div className="stat-label mb-2">Cashier Collection Summary</div>
                      <div className="table-container">
                        <table className="table">
                          <thead>
                            <tr>
                              <th>Cashier</th>
                              <th style={{ textAlign: 'right' }}>Amount</th>
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
              </>
            )}

            {reportType === 'SERVICE' && (
              <>
                <div className="card-header">
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Service & Department Revenue Breakdown</h3>
                    <p className="text-xs text-muted" style={{ margin: 0 }}>Session: {session}</p>
                  </div>
                </div>
                <div className="table-container" style={{ border: 'none' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Service Name</th>
                        <th>Department</th>
                        <th style={{ textAlign: 'right' }}>Total Billed</th>
                        <th style={{ textAlign: 'right' }}>Collected</th>
                        <th style={{ textAlign: 'right' }}>Outstanding</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data?.service_wise?.map((s, i) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 700 }}>{s.name}</td>
                          <td>
                            <span className="badge badge-neutral" style={{ fontSize: 10 }}>{s.department}</span>
                          </td>
                          <td style={{ textAlign: 'right' }}>{fmt(s.billed)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: '#2e844a' }}>{fmt(s.collected)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: '#dd7a01' }}>{fmt(s.outstanding)}</td>
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
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Monthly Income, Expenses & Net Surplus ({session})</h3>
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
                      {data?.monthly_summary?.map((m, i) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 700 }}>{m.month_label}</td>
                          <td style={{ textAlign: 'right' }}>{fmt(m.billed)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: '#2e844a' }}>{fmt(m.collected)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600, color: m.outstanding > 0 ? '#dd7a01' : 'inherit' }}>{fmt(m.outstanding)}</td>
                          <td style={{ textAlign: 'right', color: '#ba0517' }}>{fmt(m.expenses)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 800, color: m.net_surplus >= 0 ? '#2e844a' : '#ba0517' }}>
                            {fmt(m.net_surplus)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
