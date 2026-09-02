import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function PayrollManagerPage() {
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('ederp_theme') === 'dark');
  useEffect(() => { localStorage.setItem('ederp_theme', darkMode ? 'dark' : 'light'); }, [darkMode]);

  const [loading, setLoading] = useState(true);
  const [runs, setRuns] = useState([]);
  const [activeRun, setActiveRun] = useState(null);
  const [slips, setSlips] = useState([]);

  // Calculation parameters
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [policy, setPolicy] = useState('PAYABLE_DAYS');
  const [calculating, setCalculating] = useState(false);

  // Single Pay Modal State
  const [payingSlip, setPayingSlip] = useState(null);
  const [paymentMode, setPaymentMode] = useState('BANK_TRANSFER');
  const [transactionRef, setTransactionRef] = useState('');
  const [remarks, setRemarks] = useState('');
  const [submittingPay, setSubmittingPay] = useState(false);

  const loadPayrollHistory = () => {
    setLoading(true);
    api.get('/hrms/payroll/runs')
      .then(res => {
        setRuns(res.data || []);
        if (res.data && res.data.length > 0 && !activeRun) {
          loadRunDetail(res.data[0].id);
        }
      })
      .catch(err => toast.error(err.response?.data?.error || 'Failed to load payroll history'))
      .finally(() => setLoading(false));
  };

  const loadRunDetail = (runId) => {
    setLoading(true);
    api.get(`/hrms/payroll/runs/${runId}`)
      .then(res => {
        setActiveRun(res.data.run);
        setSlips(res.data.slips || []);
      })
      .catch(err => toast.error('Failed to load payroll details'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadPayrollHistory();
  }, []);

  const handleCalculate = async () => {
    setCalculating(true);
    try {
      const res = await api.post('/hrms/payroll/calculate', {
        month: parseInt(selectedMonth),
        year: parseInt(selectedYear),
        calculation_policy: policy,
      });
      toast.success(res.data.message || 'Payroll calculated successfully');
      loadPayrollHistory();
      if (res.data.run) {
        loadRunDetail(res.data.run.id);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to calculate payroll');
    } finally {
      setCalculating(false);
    }
  };

  const handleApprove = async () => {
    if (!activeRun) return;
    try {
      const res = await api.post(`/hrms/payroll/runs/${activeRun.id}/approve`);
      toast.success('Payroll batch approved!');
      loadRunDetail(activeRun.id);
      loadPayrollHistory();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to approve');
    }
  };

  const handleLock = async () => {
    if (!activeRun) return;
    if (!window.confirm('Locking this payroll will freeze all figures and post net salary to school expenses. Proceed?')) {
      return;
    }
    try {
      const res = await api.post(`/hrms/payroll/runs/${activeRun.id}/lock`);
      toast.success('Payroll locked and linked to school finance expenses!');
      loadRunDetail(activeRun.id);
      loadPayrollHistory();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to lock');
    }
  };

  const handleDownloadSlipPDF = (slipId) => {
    window.open(`${api.defaults.baseURL}/hrms/payroll/slips/${slipId}/pdf`, '_blank');
  };

  const handlePaySingleSlip = async (e) => {
    e.preventDefault();
    if (!payingSlip) return;

    setSubmittingPay(true);
    try {
      const res = await api.post(`/hrms/payroll/slips/${payingSlip.id}/pay`, {
        payment_mode: paymentMode,
        transaction_ref: transactionRef,
        remarks: remarks,
      });
      toast.success(res.data?.message || 'Salary disbursed and registered in School Finance!');
      setPayingSlip(null);
      setTransactionRef('');
      setRemarks('');
      if (activeRun) loadRunDetail(activeRun.id);
      loadPayrollHistory();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to disburse salary');
    } finally {
      setSubmittingPay(false);
    }
  };

  const cardBg = {
    background: darkMode ? '#141b2d' : '#ffffff',
    borderColor: darkMode ? '#1e293b' : '#e2e8f0',
    color: darkMode ? '#f8fafc' : '#0f172a'
  };

  return (
    <div className={`app-shell${darkMode ? ' theme-dark' : ''}`}>
      <Sidebar darkMode={darkMode} />
      <div className="main-content">
        <Navbar title="Monthly Payroll Engine &amp; Payslips" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />

        <div className="page-body">
          {/* ══ Payroll Run Generator Header ══ */}
          <div style={{ ...cardBg, borderRadius: '18px', border: '1px solid', padding: '24px', marginBottom: '22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '18px' }}>
              <div>
                <h2 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: 800 }}>Deterministic Monthly Payroll Engine</h2>
                <span style={{ fontSize: '13px', color: '#64748b' }}>
                  Auto-calculates payable days, excludes Sundays/holidays/paid leaves, and deducts unexcused absence LOP
                </span>
              </div>

              {activeRun && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  {activeRun.status === 'DRAFT' && (
                    <button
                      onClick={handleApprove}
                      style={{ background: '#10b981', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      <i className="ti ti-check" /> Approve Batch
                    </button>
                  )}
                  {activeRun.status === 'APPROVED' && (
                    <button
                      onClick={handleLock}
                      style={{ background: '#8b5cf6', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      <i className="ti ti-lock" /> Lock Payroll &amp; Post Expenses
                    </button>
                  )}
                  {activeRun.status === 'LOCKED' && (
                    <span style={{ background: '#8b5cf618', color: '#8b5cf6', padding: '6px 14px', borderRadius: '8px', fontWeight: 800, fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <i className="ti ti-lock" /> LOCKED &amp; POSTED
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Run Controls */}
            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'flex-end', background: darkMode ? '#0f172a' : '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Select Month</label>
                <select
                  value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
                  style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', background: darkMode ? '#1e293b' : '#fff', color: darkMode ? '#fff' : '#000' }}
                >
                  {[
                    { m: 1, n: 'January' }, { m: 2, n: 'February' }, { m: 3, n: 'March' }, { m: 4, n: 'April' },
                    { m: 5, n: 'May' }, { m: 6, n: 'June' }, { m: 7, n: 'July' }, { m: 8, n: 'August' },
                    { m: 9, n: 'September' }, { m: 10, n: 'October' }, { m: 11, n: 'November' }, { m: 12, n: 'December' }
                  ].map(x => <option key={x.m} value={x.m}>{x.n}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Year</label>
                <select
                  value={selectedYear} onChange={e => setSelectedYear(e.target.value)}
                  style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', background: darkMode ? '#1e293b' : '#fff', color: darkMode ? '#fff' : '#000' }}
                >
                  {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Calculation Policy</label>
                <select
                  value={policy} onChange={e => setPolicy(e.target.value)}
                  style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', background: darkMode ? '#1e293b' : '#fff', color: darkMode ? '#fff' : '#000' }}
                >
                  <option value="PAYABLE_DAYS">Payable Days Basis (Standard 30-Day Pro-Rata)</option>
                  <option value="WORKING_DAYS">Working Days Basis (Expected Working Days)</option>
                  <option value="CALENDAR_DAYS">Exact Calendar Days Basis</option>
                </select>
              </div>

              <button
                onClick={handleCalculate} disabled={calculating}
                style={{
                  background: '#2563eb', color: '#fff', border: 'none', padding: '9px 20px',
                  borderRadius: '8px', fontWeight: 700, fontSize: '13px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                <i className={`ti ${calculating ? 'ti-loader-2 ti-spin' : 'ti-calculator'}`} />
                {calculating ? 'Calculating...' : 'Calculate Monthly Payroll'}
              </button>
            </div>
          </div>

          {/* ══ Current Payroll Batch Summary Cards ══ */}
          {activeRun && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '22px' }}>
              <div className="stat-card" style={cardBg}>
                <div className="stat-label">Pay Period</div>
                <div className="stat-value" style={{ color: '#3b82f6', fontSize: '20px' }}>{activeRun.month_name}</div>
                <div className="stat-sub">Policy: <b>{activeRun.calculation_policy}</b></div>
              </div>
              <div className="stat-card" style={cardBg}>
                <div className="stat-label">Total Employees</div>
                <div className="stat-value" style={{ color: '#3b82f6' }}>{activeRun.total_employees}</div>
                <div className="stat-sub">Teachers &amp; Staff</div>
              </div>
              <div className="stat-card" style={cardBg}>
                <div className="stat-label">Total Gross Earnings</div>
                <div className="stat-value" style={{ color: '#10b981', fontSize: '20px' }}>₹{activeRun.total_gross?.toLocaleString('en-IN')}</div>
                <div className="stat-sub">Before deductions</div>
              </div>
              <div className="stat-card" style={cardBg}>
                <div className="stat-label">Total Deductions (LOP/PF/TDS)</div>
                <div className="stat-value" style={{ color: '#ef4444', fontSize: '20px' }}>₹{activeRun.total_deductions?.toLocaleString('en-IN')}</div>
                <div className="stat-sub">Loss of Pay + Taxes</div>
              </div>
              <div className="stat-card" style={cardBg}>
                <div className="stat-label">Total Net Salary Payable</div>
                <div className="stat-value" style={{ color: '#8b5cf6', fontSize: '20px' }}>₹{activeRun.total_net?.toLocaleString('en-IN')}</div>
                <div className="stat-sub">Status: <b>{activeRun.status}</b></div>
              </div>
            </div>
          )}

          {/* ══ Payslips Table ══ */}
          <div style={{ ...cardBg, borderRadius: '16px', border: '1px solid', overflow: 'hidden', marginBottom: '24px' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                Generated Payslips for {activeRun?.month_name || 'Selected Month'} ({slips.length} Employees)
              </h3>
            </div>

            {slips.length === 0 ? (
              <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
                <i className="ti ti-file-invoice" style={{ fontSize: '36px', marginBottom: '8px' }} />
                <p>No payroll generated for this period yet. Click "Calculate Monthly Payroll" above.</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: darkMode ? '#0f172a' : '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
                      <th style={{ padding: '12px 16px' }}>Employee</th>
                      <th style={{ padding: '12px 16px' }}>Payable / Total Days</th>
                      <th style={{ padding: '12px 16px' }}>Attendance Metrics</th>
                      <th style={{ padding: '12px 16px' }}>Gross Pay</th>
                      <th style={{ padding: '12px 16px' }}>LOP Deduction</th>
                      <th style={{ padding: '12px 16px' }}>Net Pay</th>
                      <th style={{ padding: '12px 16px' }}>Status</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>PDF Payslip</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slips.map((slip) => (
                      <tr key={slip.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 16px' }}>
                          <b>{slip.employee_name}</b>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>
                            ID: {slip.employee_id || '—'} • {slip.role}
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <b>{slip.payable_days}</b> / {slip.calendar_days} Days
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '11.5px', color: '#64748b' }}>
                          <span style={{ color: '#10b981', fontWeight: 600 }}>{slip.present_days} Pres.</span> • 
                          <span style={{ color: '#ef4444', fontWeight: 600 }}> {slip.absent_days} Abs.</span> • 
                          <span>{slip.paid_leave_days} Leave</span>
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                          ₹{slip.gross_salary?.toLocaleString('en-IN')}
                        </td>
                        <td style={{ padding: '12px 16px', color: slip.lop_deduction > 0 ? '#ef4444' : '#64748b', fontWeight: slip.lop_deduction > 0 ? 700 : 400 }}>
                          ₹{slip.lop_deduction?.toLocaleString('en-IN')}
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 800, color: '#10b981', fontSize: '14px' }}>
                          ₹{slip.net_salary?.toLocaleString('en-IN')}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            background: slip.payment_status === 'PAID' ? '#10b98118' : '#f59e0b18',
                            color: slip.payment_status === 'PAID' ? '#10b981' : '#f59e0b',
                            padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 800
                          }}>
                            {slip.payment_status}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '6px' }}>
                            {slip.payment_status !== 'PAID' ? (
                              <button
                                onClick={() => {
                                  setPayingSlip(slip);
                                  setTransactionRef(`SAL-${activeRun?.year || new Date().getFullYear()}-${slip.id}`);
                                }}
                                style={{
                                  background: '#10b981', color: '#ffffff', border: 'none', padding: '6px 12px',
                                  borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                                  display: 'inline-flex', alignItems: 'center', gap: '4px'
                                }}
                              >
                                <i className="ti ti-cash" /> Pay Salary
                              </button>
                            ) : (
                              <span style={{ color: '#10b981', fontWeight: 700, fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                <i className="ti ti-check" /> Paid
                              </span>
                            )}
                            <button
                              onClick={() => handleDownloadSlipPDF(slip.id)}
                              style={{
                                background: '#2563eb16', color: '#2563eb', border: 'none', padding: '6px 12px',
                                borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                                display: 'inline-flex', alignItems: 'center', gap: '4px'
                              }}
                            >
                              <i className="ti ti-file-download" /> PDF
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ══ Payroll Runs History ══ */}
          <div style={{ ...cardBg, borderRadius: '16px', border: '1px solid', padding: '20px' }}>
            <h3 style={{ margin: '0 0 14px', fontSize: '15px', fontWeight: 700 }}>Historical Payroll Batches</h3>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {runs.map((r) => (
                <button
                  key={r.id}
                  onClick={() => loadRunDetail(r.id)}
                  style={{
                    background: activeRun?.id === r.id ? '#2563eb' : (darkMode ? '#1e293b' : '#f8fafc'),
                    color: activeRun?.id === r.id ? '#fff' : (darkMode ? '#fff' : '#000'),
                    border: `1px solid ${darkMode ? '#334155' : '#cbd5e1'}`,
                    padding: '10px 16px', borderRadius: '10px', fontWeight: 600, fontSize: '12.5px', cursor: 'pointer'
                  }}
                >
                  <b>{r.month_name}</b> ({r.status}) • ₹{(r.total_net || 0).toLocaleString('en-IN')}
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* ══ PAY SALARY MODAL ══ */}
      {payingSlip && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: darkMode ? '#1e293b' : '#ffffff', color: darkMode ? '#f8fafc' : '#0f172a', width: '100%', maxWidth: '480px', padding: '24px', borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800 }}>Disburse Salary — {payingSlip.employee_name}</h3>
              <button onClick={() => setPayingSlip(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '16px' }}>✕</button>
            </div>

            <div style={{ background: darkMode ? '#0f172a' : '#f8fafc', padding: '14px', borderRadius: '10px', marginBottom: '16px', border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
                <span style={{ color: '#64748b' }}>Role & Department:</span>
                <b>{payingSlip.role} • {payingSlip.department || 'General'}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', paddingTop: '8px', borderTop: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}` }}>
                <span style={{ fontWeight: 600 }}>Net Payable:</span>
                <span style={{ fontWeight: 800, color: '#10b981', fontSize: '17px' }}>₹{payingSlip.net_salary?.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <form onSubmit={handlePaySingleSlip}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: '#64748b' }}>Payment Mode</label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: `1px solid ${darkMode ? '#475569' : '#cbd5e1'}`, background: darkMode ? '#0f172a' : '#fff', color: darkMode ? '#fff' : '#000' }}
                  required
                >
                  <option value="BANK_TRANSFER">Bank Transfer (NEFT / RTGS)</option>
                  <option value="UPI">UPI</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="CASH">Cash</option>
                </select>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: '#64748b' }}>Transaction Reference / UTR #</label>
                <input
                  type="text"
                  placeholder="e.g. UTR-987654 or TXN12345"
                  value={transactionRef}
                  onChange={(e) => setTransactionRef(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: `1px solid ${darkMode ? '#475569' : '#cbd5e1'}`, background: darkMode ? '#0f172a' : '#fff', color: darkMode ? '#fff' : '#000' }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: '#64748b' }}>Remarks</label>
                <input
                  type="text"
                  placeholder="Optional notes"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: `1px solid ${darkMode ? '#475569' : '#cbd5e1'}`, background: darkMode ? '#0f172a' : '#fff', color: darkMode ? '#fff' : '#000' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setPayingSlip(null)}
                  style={{ padding: '9px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'transparent', color: darkMode ? '#fff' : '#000', cursor: 'pointer', fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPay}
                  style={{ padding: '9px 18px', borderRadius: '8px', border: 'none', background: '#10b981', color: '#fff', cursor: 'pointer', fontWeight: 700 }}
                >
                  {submittingPay ? 'Processing...' : 'Confirm & Disburse'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
