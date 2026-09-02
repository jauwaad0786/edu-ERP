import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function FinancePayrollPage() {
  const [activeTab, setActiveTab] = useState('slips'); // 'slips', 'runs', 'analytics'
  const [slips, setSlips] = useState([]);
  const [runs, setRuns] = useState([]);
  const [deptExpenses, setDeptExpenses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  // Payment Modal State
  const [payingSlip, setPayingSlip] = useState(null);
  const [paymentMode, setPaymentMode] = useState('BANK_TRANSFER');
  const [transactionRef, setTransactionRef] = useState('');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchSlips = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedMonth) params.append('month', selectedMonth);
      if (selectedYear) params.append('year', selectedYear);
      if (statusFilter) params.append('status', statusFilter);
      if (roleFilter) params.append('role', roleFilter);
      if (search) params.append('search', search);

      const res = await api.get(`/fees-finance/payroll/slips?${params.toString()}`);
      setSlips(res.data || []);
    } catch (err) {
      toast.error('Failed to load employee salary slips');
    } finally {
      setLoading(false);
    }
  };

  const fetchRuns = async () => {
    try {
      const res = await api.get('/hrms/payroll/runs');
      setRuns(res.data || []);
    } catch (err) {
      // HRMS runs fallback
    }
  };

  const fetchAnalytics = async () => {
    try {
      const res = await api.get('/fees-finance/expenses/by-category');
      setDeptExpenses(res.data?.categories || {});
    } catch (err) {
      // analytics fallback
    }
  };

  useEffect(() => {
    fetchSlips();
    fetchRuns();
    fetchAnalytics();
  }, [selectedMonth, selectedYear, statusFilter, roleFilter]);

  const handlePaySingle = async (e) => {
    e.preventDefault();
    if (!payingSlip) return;

    setSubmitting(true);
    try {
      const res = await api.post(`/fees-finance/payroll/slips/${payingSlip.id}/pay`, {
        payment_mode: paymentMode,
        transaction_ref: transactionRef,
        remarks: remarks,
      });
      toast.success(res.data?.message || 'Salary payment disbursed successfully!');
      setPayingSlip(null);
      setTransactionRef('');
      setRemarks('');
      fetchSlips();
      fetchAnalytics();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to disburse salary payment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkPay = async (runId) => {
    if (!window.confirm('Are you sure you want to disburse all pending salaries for this batch? This will create canonical school expense records.')) {
      return;
    }
    try {
      setSubmitting(true);
      const res = await api.post(`/fees-finance/payroll/runs/${runId}/pay-all`, {
        payment_mode: paymentMode,
      });
      toast.success(res.data?.message || 'All salaries disbursed successfully!');
      fetchSlips();
      fetchRuns();
      fetchAnalytics();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to execute bulk salary payout');
    } finally {
      setSubmitting(false);
    }
  };

  const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

  const totalPending = slips.filter(s => s.payment_status === 'PENDING').reduce((acc, s) => acc + (s.net_salary || 0), 0);
  const totalPaid = slips.filter(s => s.payment_status === 'PAID').reduce((acc, s) => acc + (s.net_salary || 0), 0);

  const filteredSlips = slips.filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (s.employee_name || '').toLowerCase().includes(q) ||
      (s.employee_id || '').toLowerCase().includes(q) ||
      (s.role || '').toLowerCase().includes(q) ||
      (s.department || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar title="Staff & Teacher Payroll Disbursements" />
        <div className="page-body">

          {/* Header */}
          <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span className="badge badge-primary">Central Financial Payables</span>
                <span className="text-xs text-muted">HRMS ↔ Finance Unified Flow</span>
              </div>
              <h2 className="page-title">Salary & Payroll Management</h2>
              <p className="page-subtitle">
                Disburse salaries for Teachers, Wardens, Drivers, and Staff. Every payment posts directly to School Expenses and Cashier Audit Logs.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                onClick={() => setActiveTab('slips')}
                className={`btn ${activeTab === 'slips' ? 'btn-primary' : 'btn-outline'}`}
              >
                <i className="ti ti-users"></i> Salary Slips
              </button>
              <button
                onClick={() => setActiveTab('runs')}
                className={`btn ${activeTab === 'runs' ? 'btn-primary' : 'btn-outline'}`}
              >
                <i className="ti ti-calendar-event"></i> Monthly Batches
              </button>
              <button
                onClick={() => setActiveTab('analytics')}
                className={`btn ${activeTab === 'analytics' ? 'btn-primary' : 'btn-outline'}`}
              >
                <i className="ti ti-chart-pie"></i> Salary Analytics
              </button>
            </div>
          </div>

          {/* Metric KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
            <div className="stat-card" style={{ borderLeft: '4px solid #3b82f6' }}>
              <div className="stat-label">Total Employees on Roll</div>
              <div className="stat-value">{slips.length}</div>
              <div className="stat-subtext">Teaching & Non-Teaching Staff</div>
            </div>

            <div className="stat-card" style={{ borderLeft: '4px solid #10b981' }}>
              <div className="stat-label">Disbursed (Paid)</div>
              <div className="stat-value" style={{ color: '#10b981' }}>{fmt(totalPaid)}</div>
              <div className="stat-subtext">Reflected in School Expenses</div>
            </div>

            <div className="stat-card" style={{ borderLeft: '4px solid #f59e0b' }}>
              <div className="stat-label">Pending Disbursement</div>
              <div className="stat-value" style={{ color: '#f59e0b' }}>{fmt(totalPending)}</div>
              <div className="stat-subtext">Approved Payroll Payables</div>
            </div>

            <div className="stat-card" style={{ borderLeft: '4px solid #8b5cf6' }}>
              <div className="stat-label">Total Net Payable</div>
              <div className="stat-value">{fmt(totalPaid + totalPending)}</div>
              <div className="stat-subtext">Gross minus LOP & Deductions</div>
            </div>
          </div>

          {/* ══ TAB 1: SLIPS ══ */}
          {activeTab === 'slips' && (
            <div className="card">
              {/* Filter Bar */}
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Search employee name, ID, role or department..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                <select
                  className="form-select"
                  style={{ width: 140 }}
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                >
                  <option value="1">January</option>
                  <option value="2">February</option>
                  <option value="3">March</option>
                  <option value="4">April</option>
                  <option value="5">May</option>
                  <option value="6">June</option>
                  <option value="7">July</option>
                  <option value="8">August</option>
                  <option value="9">September</option>
                  <option value="10">October</option>
                  <option value="11">November</option>
                  <option value="12">December</option>
                </select>

                <select
                  className="form-select"
                  style={{ width: 110 }}
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                >
                  <option value="2026">2026</option>
                  <option value="2025">2025</option>
                  <option value="2024">2024</option>
                </select>

                <select
                  className="form-select"
                  style={{ width: 130 }}
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">All Statuses</option>
                  <option value="PENDING">PENDING</option>
                  <option value="PAID">PAID</option>
                </select>

                <select
                  className="form-select"
                  style={{ width: 150 }}
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                >
                  <option value="">All Roles</option>
                  <option value="TEACHER">Teachers</option>
                  <option value="STAFF">General Staff</option>
                  <option value="TRANSPORT">Transport Staff</option>
                  <option value="HOSTEL">Hostel Wardens</option>
                  <option value="LIBRARIAN">Librarians</option>
                  <option value="ACCOUNTANT">Accountants</option>
                </select>
              </div>

              {/* Table */}
              <div className="table-responsive">
                <table className="table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Department & Role</th>
                      <th>Attendance Days</th>
                      <th>Gross Pay</th>
                      <th>Deductions</th>
                      <th>Net Payable</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', padding: 32 }}>
                          <i className="ti ti-loader ti-spin" style={{ fontSize: 24, color: 'var(--primary)' }}></i>
                          <div style={{ marginTop: 8, color: 'var(--text-muted)' }}>Loading payroll records...</div>
                        </td>
                      </tr>
                    ) : filteredSlips.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                          No salary records found for this period. Ensure payroll calculation is generated in HRMS.
                        </td>
                      </tr>
                    ) : (
                      filteredSlips.map((slip) => (
                        <tr key={slip.id}>
                          <td>
                            <div style={{ fontWeight: 700 }}>{slip.employee_name}</div>
                            <div className="text-xs text-muted">EMP ID: {slip.employee_id || slip.user_id}</div>
                          </td>
                          <td>
                            <span className="badge badge-outline" style={{ textTransform: 'capitalize' }}>
                              {slip.role?.toLowerCase() || 'Staff'}
                            </span>
                            <div className="text-xs text-muted" style={{ marginTop: 2 }}>
                              {slip.department || 'General Admin'}
                            </div>
                          </td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{slip.payable_days} / {slip.calendar_days} Days</div>
                            <div className="text-xs text-muted">
                              Pres: {slip.present_days} • Abs: {slip.absent_days} • LOP: {slip.unpaid_leave_days}
                            </div>
                          </td>
                          <td style={{ fontWeight: 600 }}>{fmt(slip.gross_salary)}</td>
                          <td style={{ color: slip.total_deductions > 0 ? '#ef4444' : 'inherit', fontWeight: 600 }}>
                            {fmt(slip.total_deductions)}
                          </td>
                          <td style={{ fontWeight: 800, fontSize: 14, color: '#10b981' }}>
                            {fmt(slip.net_salary)}
                          </td>
                          <td>
                            <span
                              className="badge"
                              style={{
                                background: slip.payment_status === 'PAID' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                color: slip.payment_status === 'PAID' ? '#10b981' : '#f59e0b',
                                fontWeight: 700,
                              }}
                            >
                              {slip.payment_status}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {slip.payment_status === 'PAID' ? (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                <span className="text-xs text-success" style={{ fontWeight: 700 }}>
                                  <i className="ti ti-check"></i> Disbursed
                                </span>
                                <button
                                  onClick={() => window.open(`${api.defaults.baseURL}/hrms/payroll/slips/${slip.id}/pdf`, '_blank')}
                                  className="btn btn-sm btn-outline"
                                  title="Download Payslip PDF"
                                >
                                  <i className="ti ti-file-download"></i>
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  setPayingSlip(slip);
                                  setTransactionRef(`SAL-${selectedYear}-${slip.id}`);
                                }}
                                className="btn btn-sm btn-primary"
                              >
                                <i className="ti ti-cash"></i> Pay Salary
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ══ TAB 2: RUNS ══ */}
          {activeTab === 'runs' && (
            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>Approved Monthly Payroll Batches</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
                {runs.map((r) => (
                  <div
                    key={r.id}
                    style={{
                      border: '1px solid var(--border-color)',
                      borderRadius: 12,
                      padding: 18,
                      background: 'var(--surface-color)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                      <div>
                        <h4 style={{ margin: 0, fontWeight: 800 }}>{r.month_name}</h4>
                        <span className="text-xs text-muted">{r.total_employees} Total Employees</span>
                      </div>
                      <span className={`badge ${r.status === 'LOCKED' ? 'badge-success' : 'badge-primary'}`}>
                        {r.status}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                      <span className="text-muted">Total Gross:</span>
                      <span style={{ fontWeight: 600 }}>{fmt(r.total_gross)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                      <span className="text-muted">Total Deductions:</span>
                      <span style={{ fontWeight: 600, color: '#ef4444' }}>{fmt(r.total_deductions)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 14, paddingTop: 6, borderTop: '1px solid var(--border-color)' }}>
                      <span style={{ fontWeight: 700 }}>Net Payout:</span>
                      <span style={{ fontWeight: 800, color: '#10b981' }}>{fmt(r.total_net)}</span>
                    </div>

                    {r.status !== 'LOCKED' && (
                      <button
                        onClick={() => handleBulkPay(r.id)}
                        disabled={submitting}
                        className="btn btn-sm btn-primary"
                        style={{ width: '100%', justifyContent: 'center' }}
                      >
                        <i className="ti ti-check"></i> Disburse All Pending ({r.month_name})
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══ TAB 3: ANALYTICS ══ */}
          {activeTab === 'analytics' && (
            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>Department-Wise Salary & Operational Expenses</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
                {Object.entries(deptExpenses).map(([key, item]) => (
                  <div
                    key={key}
                    style={{
                      border: '1px solid var(--border-color)',
                      borderRadius: 12,
                      padding: 16,
                      background: 'var(--surface-color)',
                    }}
                  >
                    <div className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      {item.department || 'OPERATIONS'}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 15, margin: '4px 0 8px' }}>
                      {item.label || key}
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#3b82f6' }}>
                      {fmt(item.total)}
                    </div>
                    <div className="text-xs text-muted" style={{ marginTop: 4 }}>
                      {item.count} recorded transaction{item.count !== 1 ? 's' : ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ══ PAYMENT MODAL ══ */}
      {payingSlip && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="card" style={{ width: '100%', maxWidth: 480, padding: 24, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Disburse Salary Payment</h3>
              <button onClick={() => setPayingSlip(null)} className="btn btn-sm btn-outline">✕</button>
            </div>

            <div style={{ background: 'var(--surface-hover)', padding: 14, borderRadius: 10, marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{payingSlip.employee_name}</div>
              <div className="text-xs text-muted">{payingSlip.role} • {payingSlip.department || 'General'}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border-color)' }}>
                <span className="text-sm font-semibold">Net Salary to Pay:</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: '#10b981' }}>{fmt(payingSlip.net_salary)}</span>
              </div>
            </div>

            <form onSubmit={handlePaySingle}>
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label font-semibold text-xs">Payment Mode</label>
                <select
                  className="form-select"
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  required
                >
                  <option value="BANK_TRANSFER">Bank Transfer (NEFT / RTGS)</option>
                  <option value="UPI">UPI</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="CASH">Cash</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label font-semibold text-xs">Transaction Reference / UTR #</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. UTR12345678 or Cheque #"
                  value={transactionRef}
                  onChange={(e) => setTransactionRef(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 20 }}>
                <label className="form-label font-semibold text-xs">Remarks / Notes</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Optional notes"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setPayingSlip(null)}
                  className="btn btn-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary"
                >
                  {submitting ? 'Processing...' : 'Confirm & Disburse'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
