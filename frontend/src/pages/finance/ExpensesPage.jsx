import React, { useState, useEffect, useMemo } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import api from '../../api/axios';
import toast from 'react-hot-toast';

function lastNMonths(n) {
  const out = [];
  const d = new Date();
  d.setDate(1);
  for (let i = 0; i < n; i++) {
    out.push(d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));
    d.setMonth(d.getMonth() - 1);
  }
  return out;
}

const EMPTY_FORM = {
  category: 'OPERATIONAL',
  title: '',
  vendor_name: '',
  amount: '',
  invoice_number: '',
  payment_method: 'CASH',
  payment_date: new Date().toISOString().slice(0, 10),
  status: 'PAID',
  remarks: '',
};

export default function ExpensesPage() {
  const months = useMemo(() => lastNMonths(12), []);
  const [month, setMonth] = useState(months[0]);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [meta, setMeta] = useState({ categories: [], payment_methods: [] });
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [vendors, setVendors] = useState([]);

  useEffect(() => {
    api.get('/finance/meta').then((r) => setMeta(r.data)).catch(() => {});
    api.get('/finance/vendors').then((r) => setVendors(r.data || [])).catch(() => {});
  }, []);

  const loadExpenses = () => {
    setLoading(true);
    const params = { month };
    if (categoryFilter) params.category = categoryFilter;
    if (statusFilter) params.status = statusFilter;

    Promise.all([
      api.get('/finance/expenses', { params }).catch(() => ({ data: { data: [] } })),
      api.get('/finance/expenses/summary', { params: { month } }).catch(() => ({ data: null })),
    ]).then(([exp, sum]) => {
      setExpenses(exp.data?.data || []);
      setSummary(sum.data);
      setLoading(false);
    });
  };

  useEffect(() => {
    loadExpenses();
  }, [month, categoryFilter, statusFilter]);

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (exp) => {
    setEditingId(exp.id);
    setForm({
      category: exp.category || 'OPERATIONAL',
      title: exp.title || '',
      vendor_name: exp.vendor_name || '',
      amount: exp.amount || '',
      invoice_number: exp.invoice_number || '',
      payment_method: exp.payment_method || 'CASH',
      payment_date: exp.payment_date || new Date().toISOString().slice(0, 10),
      status: exp.status || 'PAID',
      remarks: exp.remarks || '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.amount) {
      toast.error('Please enter expense title and amount');
      return;
    }

    try {
      setSaving(true);
      if (editingId) {
        await api.put(`/finance/expenses/${editingId}`, form);
        toast.success('Expense record updated');
      } else {
        await api.post('/finance/expenses', form);
        toast.success('Expense recorded successfully');
      }
      setModalOpen(false);
      loadExpenses();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save expense');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this expense record?')) return;
    try {
      await api.delete(`/finance/expenses/${id}`);
      toast.success('Expense deleted');
      loadExpenses();
    } catch (err) {
      toast.error('Failed to delete expense');
    }
  };

  const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar title="School Expenses & Disbursements" />
        <div className="page-body">

          {/* Page Header */}
          <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span className="badge badge-error">Accounts & Disbursements</span>
                <span className="text-xs text-muted">Voucher & Expense Register</span>
              </div>
              <h2 className="page-title">School Expenses & Bills</h2>
              <p className="page-subtitle">
                Track operational bills, vendor payments, maintenance, and departmental expense vouchers.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="text-xs font-semibold text-muted">Month:</span>
                <select
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="form-select"
                  style={{ width: 170, height: 36, fontSize: 13, fontWeight: 700 }}
                >
                  {months.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <button onClick={openAdd} className="btn btn-primary">
                <i className="ti ti-plus"></i> Record Expense
              </button>
            </div>
          </div>

          {/* Summary KPI Cards */}
          <div className="grid-4 mb-6">
            <div className="stat-card" style={{ borderLeft: '4px solid #ba0517' }}>
              <div className="stat-label">Total Month Expenses</div>
              <div className="stat-value" style={{ fontSize: '1.5rem', color: '#ba0517' }}>
                {fmt(summary?.total_amount)}
              </div>
              <div className="stat-sub">{summary?.count || expenses.length} vouchers recorded</div>
            </div>

            <div className="stat-card" style={{ borderLeft: '4px solid #2e844a' }}>
              <div className="stat-label">Paid Expenses</div>
              <div className="stat-value" style={{ fontSize: '1.5rem', color: '#2e844a' }}>
                {fmt(summary?.paid_amount || summary?.total_amount)}
              </div>
              <div className="stat-sub">Settled disbursements</div>
            </div>

            <div className="stat-card" style={{ borderLeft: '4px solid #dd7a01' }}>
              <div className="stat-label">Pending / Unpaid Bills</div>
              <div className="stat-value" style={{ fontSize: '1.5rem', color: '#dd7a01' }}>
                {fmt(summary?.pending_amount || 0)}
              </div>
              <div className="stat-sub">Vendor bills awaiting payment</div>
            </div>

            <div className="stat-card" style={{ borderLeft: '4px solid #0176d3' }}>
              <div className="stat-label">Vendors & Payees</div>
              <div className="stat-value" style={{ fontSize: '1.5rem', color: '#0176d3' }}>
                {vendors.length}
              </div>
              <div className="stat-sub">Active registered vendors</div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="card mb-6" style={{ padding: 12 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ minWidth: 180 }}>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="form-select"
                  style={{ height: 36 }}
                >
                  <option value="">All Categories</option>
                  <option value="OPERATIONAL">Operational / Utilities</option>
                  <option value="SALARY">Staff Payroll / Salary</option>
                  <option value="MAINTENANCE">Repairs & Maintenance</option>
                  <option value="INVENTORY">Inventory / Supplies</option>
                  <option value="TRANSPORT">Transport & Fuel</option>
                  <option value="EVENTS">Events & Functions</option>
                  <option value="OTHER">Other Expenses</option>
                </select>
              </div>

              <div style={{ minWidth: 150 }}>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="form-select"
                  style={{ height: 36 }}
                >
                  <option value="">All Statuses</option>
                  <option value="PAID">Paid</option>
                  <option value="PENDING">Pending Approval</option>
                </select>
              </div>

              <button
                onClick={loadExpenses}
                className="btn btn-neutral"
                style={{ height: 36, padding: '0 12px' }}
                title="Refresh"
              >
                <i className="ti ti-refresh"></i>
              </button>
            </div>
          </div>

          {/* Expenses Register Table */}
          <div className="card">
            <div className="card-header">
              <div>
                <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, margin: 0 }}>Expense Register ({month})</h3>
                <p className="text-xs text-muted" style={{ margin: 0 }}>
                  Showing {expenses.length} voucher records.
                </p>
              </div>
            </div>

            <div className="table-container" style={{ border: 'none' }}>
              {loading ? (
                <div className="empty-state">
                  <div className="spinner" style={{ width: 28, height: 28 }}></div>
                  <p className="mt-2 text-xs text-muted">Loading expense vouchers...</p>
                </div>
              ) : expenses.length === 0 ? (
                <div className="empty-state">
                  <i className="ti ti-receipt-off" style={{ fontSize: 36, color: 'var(--neutral-4)' }}></i>
                  <h4 style={{ marginTop: 8 }}>No Expenses Recorded</h4>
                  <p className="text-xs text-muted">Click 'Record Expense' to add a new voucher for this month.</p>
                </div>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Title & Description</th>
                      <th>Category</th>
                      <th>Vendor / Payee</th>
                      <th>Payment Mode</th>
                      <th>Invoice No</th>
                      <th style={{ textAlign: 'right' }}>Amount</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((exp) => (
                      <tr key={exp.id}>
                        <td style={{ fontSize: 12, fontWeight: 500 }}>{exp.payment_date}</td>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--neutral-9)' }}>{exp.title}</div>
                          {exp.remarks && <div className="text-xs text-muted">{exp.remarks}</div>}
                        </td>
                        <td>
                          <span className="badge badge-neutral" style={{ fontSize: 10 }}>{exp.category}</span>
                        </td>
                        <td style={{ fontWeight: 600 }}>{exp.vendor_name || '—'}</td>
                        <td style={{ fontSize: 12 }}>{exp.payment_method}</td>
                        <td style={{ fontFamily: 'monospace', color: 'var(--neutral-6)' }}>{exp.invoice_number || '—'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 800, color: '#ba0517' }}>
                          {fmt(exp.amount)}
                        </td>
                        <td>
                          <span className={`badge ${exp.status === 'PAID' ? 'badge-success' : 'badge-warning'}`}>
                            {exp.status}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
                            <button
                              onClick={() => openEdit(exp)}
                              className="btn btn-neutral btn-sm"
                              title="Edit"
                            >
                              <i className="ti ti-edit"></i>
                            </button>
                            <button
                              onClick={() => handleDelete(exp.id)}
                              className="btn btn-neutral btn-sm"
                              style={{ color: '#ba0517' }}
                              title="Delete"
                            >
                              <i className="ti ti-trash"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Add / Edit Expense Modal */}
          {modalOpen && (
            <div className="modal-backdrop">
              <div className="modal">
                <div className="modal-header">
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0 }}>
                    {editingId ? 'Edit Expense Record' : 'Record New Expense'}
                  </h3>
                  <button onClick={() => setModalOpen(false)} className="modal-close">✕</button>
                </div>

                <form onSubmit={handleSubmit}>
                  <div className="modal-body">
                    <div className="form-group">
                      <label className="form-label">Expense Title / Item</label>
                      <input
                        type="text"
                        value={form.title}
                        onChange={(e) => setForm({ ...form, title: e.target.value })}
                        placeholder="e.g. Science Lab Consumables or School Electricity Bill"
                        required
                        className="form-input"
                      />
                    </div>

                    <div className="grid-2">
                      <div className="form-group">
                        <label className="form-label">Category</label>
                        <select
                          value={form.category}
                          onChange={(e) => setForm({ ...form, category: e.target.value })}
                          className="form-select"
                        >
                          <option value="OPERATIONAL">Operational / Utilities</option>
                          <option value="SALARY">Staff Payroll / Salary</option>
                          <option value="MAINTENANCE">Repairs & Maintenance</option>
                          <option value="INVENTORY">Inventory / Supplies</option>
                          <option value="TRANSPORT">Transport & Fuel</option>
                          <option value="EVENTS">Events & Functions</option>
                          <option value="OTHER">Other Expenses</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Amount (₹)</label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={form.amount}
                          onChange={(e) => setForm({ ...form, amount: e.target.value })}
                          placeholder="e.g. 4500"
                          required
                          className="form-input"
                          style={{ fontWeight: 700 }}
                        />
                      </div>
                    </div>

                    <div className="grid-2">
                      <div className="form-group">
                        <label className="form-label">Vendor / Payee</label>
                        <input
                          type="text"
                          value={form.vendor_name}
                          onChange={(e) => setForm({ ...form, vendor_name: e.target.value })}
                          placeholder="e.g. Reliance Power or Gupta Stationery"
                          className="form-input"
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Invoice / Bill Number</label>
                        <input
                          type="text"
                          value={form.invoice_number}
                          onChange={(e) => setForm({ ...form, invoice_number: e.target.value })}
                          placeholder="e.g. INV-9842"
                          className="form-input"
                        />
                      </div>
                    </div>

                    <div className="grid-3">
                      <div className="form-group">
                        <label className="form-label">Payment Mode</label>
                        <select
                          value={form.payment_method}
                          onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
                          className="form-select"
                        >
                          <option value="CASH">Cash</option>
                          <option value="UPI">UPI</option>
                          <option value="BANK_TRANSFER">Bank Transfer / NEFT</option>
                          <option value="CHEQUE">Cheque</option>
                          <option value="CARD">Card</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Payment Date</label>
                        <input
                          type="date"
                          value={form.payment_date}
                          onChange={(e) => setForm({ ...form, payment_date: e.target.value })}
                          className="form-input"
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Status</label>
                        <select
                          value={form.status}
                          onChange={(e) => setForm({ ...form, status: e.target.value })}
                          className="form-select"
                        >
                          <option value="PAID">Paid</option>
                          <option value="PENDING">Pending</option>
                        </select>
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Remarks / Description</label>
                      <input
                        type="text"
                        value={form.remarks}
                        onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                        placeholder="Additional notes..."
                        className="form-input"
                      />
                    </div>
                  </div>

                  <div className="modal-footer">
                    <button type="button" onClick={() => setModalOpen(false)} className="btn btn-neutral">
                      Cancel
                    </button>
                    <button type="submit" disabled={saving} className="btn btn-primary">
                      {saving ? 'Saving...' : 'Save Expense'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
