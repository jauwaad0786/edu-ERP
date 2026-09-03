import React, { useState, useEffect, useMemo } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
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
  department: 'ACCOUNTS',
  amount: '',
  invoice_number: '',
  payment_method: 'CASH',
  payment_date: new Date().toISOString().slice(0, 10),
  status: 'PAID',
  remarks: '',
};

export default function ExpensesPage() {
  const { user } = useAuth();
  const isPrincipal = user?.role === 'PRINCIPAL' || user?.role === 'SUPER_ADMIN';

  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('ederp_theme') === 'dark');
  useEffect(() => { localStorage.setItem('ederp_theme', darkMode ? 'dark' : 'light'); }, [darkMode]);

  const months = useMemo(() => lastNMonths(12), []);
  const [month, setMonth] = useState(months[0]);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [vendors, setVendors] = useState([]);

  useEffect(() => {
    api.get('/finance/vendors').then((r) => setVendors(r.data || [])).catch(() => {});
  }, []);

  const loadExpenses = () => {
    setLoading(true);
    const params = { month };
    if (categoryFilter) params.category = categoryFilter;
    if (departmentFilter) params.department = departmentFilter;
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
  }, [month, categoryFilter, departmentFilter, statusFilter]);

  const openAdd = () => {
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      status: isPrincipal ? 'PAID' : 'PENDING_APPROVAL'
    });
    setModalOpen(true);
  };

  const openEdit = (exp) => {
    setEditingId(exp.id);
    setForm({
      category: exp.category || 'OPERATIONAL',
      title: exp.title || '',
      vendor_name: exp.vendor_name || '',
      department: exp.department || 'ACCOUNTS',
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

    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/finance/expenses/${editingId}`, form);
        toast.success('Expense record updated');
      } else {
        await api.post('/finance/expenses', form);
        toast.success(isPrincipal ? 'Expense recorded' : 'Expense submitted for Principal approval');
      }
      setModalOpen(false);
      loadExpenses();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save expense');
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async (id) => {
    try {
      await api.post(`/finance/expenses/${id}/approve`);
      toast.success('Expense approved');
      loadExpenses();
    } catch (err) {
      toast.error('Approval failed');
    }
  };

  const handleReject = async (id) => {
    const reason = window.prompt('Enter rejection reason:');
    if (reason === null) return;
    try {
      await api.post(`/finance/expenses/${id}/reject`, { reason });
      toast.success('Expense rejected');
      loadExpenses();
    } catch (err) {
      toast.error('Rejection failed');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this expense?')) return;
    try {
      await api.delete(`/finance/expenses/${id}`);
      toast.success('Expense removed');
      loadExpenses();
    } catch (err) {
      toast.error('Delete failed');
    }
  };

  const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
  const inputStyle = {
    width: '100%', padding: '8px 12px', borderRadius: 8,
    border: `1px solid ${darkMode ? '#475569' : '#cbd5e1'}`,
    background: darkMode ? '#1e293b' : '#fff',
    color: darkMode ? '#f8fafc' : '#0f172a', fontSize: 13, marginBottom: 12
  };
  const labelStyle = { display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4, color: darkMode ? '#cbd5e1' : '#475569' };

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar title="Expense Management" />
        <div className="page-body">

          {/* Banner */}
          <div style={{
            background: 'linear-gradient(135deg, #e11d48 0%, #be123c 100%)',
            borderRadius: 14, padding: '22px 26px', color: '#fff', marginBottom: 20,
            boxShadow: '0 4px 20px rgba(225, 29, 72, 0.25)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ background: 'rgba(255,255,255,0.2)', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 800 }}>
                  CENTRAL EXPENDITURE
                </span>
                <span style={{ fontSize: 12, opacity: 0.85 }}>Department Tagging &bull; Multi-Tier Approvals &bull; Vendor &amp; Asset Sync</span>
              </div>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Expenses &amp; Disbursements</h1>
              <p style={{ margin: '4px 0 0', fontSize: 13, opacity: 0.9, maxWidth: 680 }}>
                Audit school operational outlays, authorize staff purchase reimbursements, and review expenses auto-posted from Asset Maintenance and Vendor Bill Payments.
              </p>
            </div>

            <button
              onClick={openAdd}
              style={{
                background: '#fff', color: '#be123c', border: 'none', borderRadius: 10,
                padding: '10px 20px', fontSize: 13, fontWeight: 800, cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', gap: 8
              }}
            >
              <i className="ti ti-plus" />
              Record Expense
            </button>
          </div>

          {/* Filter Bar */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              style={{ ...inputStyle, width: 170, marginBottom: 0 }}
            >
              {months.map(m => <option key={m} value={m}>{m}</option>)}
            </select>

            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              style={{ ...inputStyle, width: 160, marginBottom: 0 }}
            >
              <option value="">All Departments</option>
              <option value="ACADEMIC">Academic</option>
              <option value="ADMIN">Admin</option>
              <option value="ACCOUNTS">Accounts</option>
              <option value="TRANSPORT">Transport</option>
              <option value="HOSTEL">Hostel</option>
              <option value="LIBRARY">Library</option>
              <option value="MAINTENANCE">Maintenance</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ ...inputStyle, width: 160, marginBottom: 0 }}
            >
              <option value="">All Statuses</option>
              <option value="PAID">Paid</option>
              <option value="APPROVED">Approved</option>
              <option value="PENDING_APPROVAL">Pending Approval</option>
              <option value="REJECTED">Rejected</option>
            </select>

            <div style={{ marginLeft: 'auto', alignSelf: 'center', fontSize: 14, fontWeight: 800 }}>
              Total: <span style={{ color: '#e11d48' }}>{fmt(summary?.total_expense)}</span>
            </div>
          </div>

          {/* Table */}
          <div className="card" style={{ background: darkMode ? '#1e293b' : '#fff', padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ background: darkMode ? '#0f172a' : '#f8fafc', borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}` }}>
                  <th style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 11, fontWeight: 800 }}>EXP # &amp; TITLE</th>
                  <th style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 11, fontWeight: 800 }}>CATEGORY / DEPT</th>
                  <th style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 11, fontWeight: 800 }}>VENDOR / PAYEE</th>
                  <th style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 11, fontWeight: 800 }}>SOURCE</th>
                  <th style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 11, fontWeight: 800, textAlign: 'right' }}>AMOUNT (₹)</th>
                  <th style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 11, fontWeight: 800, textAlign: 'center' }}>STATUS</th>
                  <th style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 11, fontWeight: 800, textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>Loading expense records...</td>
                  </tr>
                ) : expenses.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '50px 0', color: '#94a3b8' }}>
                      No expenses found for {month}.
                    </td>
                  </tr>
                ) : (
                  expenses.map(e => (
                    <tr key={e.id} style={{ borderBottom: `1px solid ${darkMode ? '#334155' : '#f1f5f9'}` }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 800, color: '#e11d48' }}>{e.expense_number}</div>
                        <div style={{ fontWeight: 700, color: darkMode ? '#f8fafc' : '#0f172a' }}>{e.title}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>{e.payment_date}</div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div>{e.category}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>Dept: {e.department}</div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>{e.vendor_name || '—'}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 800,
                          background: e.source === 'VENDOR_BILL' ? '#e0f2fe' : e.source === 'ASSET_MAINTENANCE' ? '#ede9fe' : '#f1f5f9',
                          color: e.source === 'VENDOR_BILL' ? '#0369a1' : e.source === 'ASSET_MAINTENANCE' ? '#6d28d9' : '#64748b'
                        }}>
                          {e.source || 'MANUAL'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800 }}>{fmt(e.amount)}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <span style={{
                          padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 800,
                          background: e.status === 'PAID' || e.status === 'APPROVED' ? '#f0fdf4' : e.status === 'PENDING_APPROVAL' ? '#fffbeb' : '#fef2f2',
                          color: e.status === 'PAID' || e.status === 'APPROVED' ? '#16a34a' : e.status === 'PENDING_APPROVAL' ? '#d97706' : '#dc2626'
                        }}>
                          {e.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          {isPrincipal && e.status === 'PENDING_APPROVAL' && (
                            <>
                              <button onClick={() => handleApprove(e.id)} className="btn btn-primary btn-sm" style={{ background: '#16a34a', border: 'none' }}>
                                ✓ Approve
                              </button>
                              <button onClick={() => handleReject(e.id)} className="btn btn-sm" style={{ background: '#dc2626', color: '#fff', border: 'none' }}>
                                ✕
                              </button>
                            </>
                          )}
                          <button onClick={() => openEdit(e)} className="btn btn-neutral btn-sm">Edit</button>
                          {isPrincipal && (
                            <button onClick={() => handleDelete(e.id)} className="btn btn-neutral btn-sm" style={{ color: '#dc2626' }}>🗑️</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

        </div>
      </div>

      {/* ══ MODAL: ADD / EDIT EXPENSE ══ */}
      {modalOpen && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setModalOpen(false)}>
          <div className="modal" style={{ maxWidth: 600, background: darkMode ? '#1e293b' : '#fff' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontWeight: 800 }}>{editingId ? 'Edit Expense' : 'Record New Expense'}</h3>
              <button className="modal-close" onClick={() => setModalOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Expense Title *</label>
                    <input
                      type="text"
                      placeholder="e.g. Science Lab Chemical Reagents"
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      style={inputStyle}
                      required
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Department *</label>
                    <select
                      value={form.department}
                      onChange={(e) => setForm({ ...form, department: e.target.value })}
                      style={inputStyle}
                    >
                      <option value="ACADEMIC">Academic</option>
                      <option value="ADMIN">Admin</option>
                      <option value="ACCOUNTS">Accounts</option>
                      <option value="TRANSPORT">Transport</option>
                      <option value="HOSTEL">Hostel</option>
                      <option value="LIBRARY">Library</option>
                      <option value="MAINTENANCE">Maintenance</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Category</label>
                    <select
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                      style={inputStyle}
                    >
                      <option value="OPERATIONAL">Operational</option>
                      <option value="MAINTENANCE">Maintenance / Repairs</option>
                      <option value="UTILITIES">Utilities (Electricity, Water)</option>
                      <option value="INVENTORY_PURCHASE">Inventory Purchase</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Amount (₹) *</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: e.target.value })}
                      style={inputStyle}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Vendor / Payee</label>
                    <input
                      type="text"
                      placeholder="e.g. Local Hardware Store"
                      value={form.vendor_name}
                      onChange={(e) => setForm({ ...form, vendor_name: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Invoice / Bill #</label>
                    <input
                      type="text"
                      placeholder="e.g. INV-2026-99"
                      value={form.invoice_number}
                      onChange={(e) => setForm({ ...form, invoice_number: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Payment Method</label>
                    <select
                      value={form.payment_method}
                      onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
                      style={inputStyle}
                    >
                      <option value="CASH">Cash</option>
                      <option value="UPI">UPI</option>
                      <option value="BANK_TRANSFER">Bank Transfer</option>
                      <option value="CHEQUE">Cheque</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Date</label>
                    <input
                      type="date"
                      value={form.payment_date}
                      onChange={(e) => setForm({ ...form, payment_date: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer" style={{ borderTop: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, padding: '14px 20px' }}>
                <button type="button" className="btn btn-neutral" onClick={() => setModalOpen(false)}>Cancel</button>
                <button type="submit" disabled={saving} className="btn btn-primary">
                  {saving ? 'Saving...' : editingId ? 'Update Expense' : isPrincipal ? 'Save & Record' : 'Submit for Approval'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
