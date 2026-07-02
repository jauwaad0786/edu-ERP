import React, { useState, useEffect, useMemo } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

const COLORS = ['#4f46e5', '#7c3aed', '#16a34a', '#d97706', '#dc2626', '#0891b2', '#db2777', '#65a30d', '#9333ea', '#0284c7', '#ca8a04', '#be185d'];

function prettyLabel(v) {
  if (!v) return '';
  return v.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
}

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

function StatCard({ icon, label, value, sub, color, darkMode }) {
  return (
    <div className="stat-card" style={{ background: darkMode ? '#141b2d' : undefined, borderColor: darkMode ? '#1e293b' : undefined }}>
      <div className="stat-icon" style={{ background: color + '16' }}>
        <i className={`ti ${icon}`} style={{ fontSize: 18, color }} aria-hidden="true" />
      </div>
      <div className="stat-label" style={{ color: darkMode ? '#94a3b8' : undefined }}>{label}</div>
      <div className="stat-value" style={{ color }}>{value ?? '—'}</div>
      {sub && <div className="stat-sub" style={{ color: darkMode ? '#64748b' : undefined }}>{sub}</div>}
    </div>
  );
}

const EMPTY_FORM = {
  category: '', title: '', vendor_name: '', amount: '', invoice_number: '',
  payment_method: 'CASH', payment_date: new Date().toISOString().slice(0, 10),
  status: 'PAID', remarks: '',
};

export default function ExpensesPage() {
  const { user } = useAuth();
  const isPrincipal = user?.role === 'PRINCIPAL';

  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('ederp_theme') === 'dark');
  useEffect(() => { localStorage.setItem('ederp_theme', darkMode ? 'dark' : 'light'); }, [darkMode]);

  const months = useMemo(() => lastNMonths(12), []);
  const [month, setMonth]           = useState(months[0]);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter]     = useState('');

  const [meta, setMeta]         = useState({ categories: [], payment_methods: [] });
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary]   = useState(null);
  const [loading, setLoading]   = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [saving, setSaving]       = useState(false);

  const [vendors, setVendors]                       = useState([]);
  const [vendorDropdownOpen, setVendorDropdownOpen] = useState(false);
  const [creatingVendor, setCreatingVendor]         = useState(false);
  const [newVendorName, setNewVendorName]           = useState('');
  const [savingVendor, setSavingVendor]             = useState(false);

  useEffect(() => {
    api.get('/finance/meta').then(r => setMeta(r.data)).catch(() => {});
    api.get('/finance/vendors').then(r => setVendors(r.data || [])).catch(() => {});
  }, []);

  const load = () => {
    setLoading(true);
    const params = { month };
    if (categoryFilter) params.category = categoryFilter;
    if (statusFilter)   params.status   = statusFilter;

    Promise.all([
      api.get('/finance/expenses', { params }).catch(() => ({ data: { data: [] } })),
      api.get('/finance/expenses/summary', { params: { month } }).catch(() => ({ data: null })),
    ]).then(([exp, sum]) => {
      setExpenses(exp.data?.data || []);
      setSummary(sum.data);
      setLoading(false);
    });
  };

  useEffect(load, [month, categoryFilter, statusFilter]);

  const fmt = n => Number(n || 0).toLocaleString('en-IN');

  const openAdd = () => { setEditingId(null); setForm({ ...EMPTY_FORM, payment_date: new Date().toISOString().slice(0, 10) }); setModalOpen(true); };
  const openEdit = (e) => {
    setEditingId(e.id);
    setForm({
      category: e.category, title: e.title, vendor_name: e.vendor_name,
      amount: e.amount, invoice_number: e.invoice_number,
      payment_method: e.payment_method, payment_date: e.payment_date,
      status: e.status, remarks: e.remarks,
    });
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.category || !form.title.trim() || !form.amount) {
      alert('Category, title aur amount zaroori hai');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await api.patch(`/finance/expenses/${editingId}`, form);
      } else {
        await api.post('/finance/expenses', form);
      }
      setModalOpen(false);
      load();
    } catch (err) {
      alert(err?.response?.data?.error || 'Save nahi hua, dobara try karo');
    }
    setSaving(false);
  };

  const remove = async (id) => {
    if (!window.confirm('Ye expense delete karna hai? Ye action undo nahi ho sakta.')) return;
    try {
      await api.delete(`/finance/expenses/${id}`);
      load();
    } catch {
      alert('Delete nahi hua');
    }
  };

  const filteredVendors = vendors.filter(v =>
    v.name.toLowerCase().includes((form.vendor_name || '').toLowerCase())
  );
  const exactVendorMatch = vendors.some(
    v => v.name.toLowerCase() === (form.vendor_name || '').trim().toLowerCase()
  );

  const selectVendor = (name) => {
    setForm(f => ({ ...f, vendor_name: name }));
    setVendorDropdownOpen(false);
  };

  const openCreateVendor = () => {
    setNewVendorName(form.vendor_name.trim());
    setCreatingVendor(true);
  };

  const saveNewVendor = async () => {
    if (!newVendorName.trim()) return;
    setSavingVendor(true);
    try {
      const r = await api.post('/finance/vendors', { name: newVendorName.trim(), category: 'OTHER' });
      setVendors(v => [...v, r.data]);
      setForm(f => ({ ...f, vendor_name: r.data.name }));
      setCreatingVendor(false);
      setVendorDropdownOpen(false);
    } catch (err) {
      alert(err?.response?.data?.error || 'Vendor save nahi hua');
    }
    setSavingVendor(false);
  };
  const cardBg = { background: darkMode ? '#141b2d' : undefined, borderColor: darkMode ? '#1e293b' : undefined };
  const totalExpense    = summary?.total_expense || 0;
  const salaryTotal      = expenses.filter(e => e.category === 'TEACHER_SALARY' || e.category === 'STAFF_SALARY').reduce((a, e) => a + e.amount, 0);
  const autoCount        = expenses.filter(e => e.source !== 'MANUAL').length;
  const topCategory      = summary?.categories?.[0];

  return (
    <div className={`app-shell${darkMode ? ' theme-dark' : ''}`}>
      <Sidebar darkMode={darkMode} />
      <div className="main-content">
        <Navbar title="Expenses" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />
        <div className="page-body">

          <div className="page-header flex justify-between items-center">
            <div>
              <h2 className="page-title">Expense Management</h2>
              <p className="page-subtitle">School ke saare kharche — ek jagah par</p>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <select className="form-select" style={{ width: 170 }} value={month} onChange={e => setMonth(e.target.value)}>
                {months.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <button className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={openAdd}>
                <i className="ti ti-plus" style={{ fontSize: 14 }} aria-hidden="true" /> Add Expense
              </button>
            </div>
          </div>

          <div className="grid-4 mb-6">
            <StatCard icon="ti-receipt-2" label={`Total Expense — ${month}`} value={`₹${fmt(totalExpense)}`}
              sub={`${expenses.length} entries`} color="#dc2626" darkMode={darkMode} />
            <StatCard icon="ti-users" label="Salary Expense" value={`₹${fmt(salaryTotal)}`}
              sub="Teacher + Staff" color="#4f46e5" darkMode={darkMode} />
            <StatCard icon="ti-chart-pie" label="Top Category" value={topCategory ? prettyLabel(topCategory.category) : '—'}
              sub={topCategory ? `₹${fmt(topCategory.amount)} · ${topCategory.pct}%` : 'Koi data nahi'} color="#d97706" darkMode={darkMode} />
            <StatCard icon="ti-bolt" label="Auto-linked" value={autoCount}
              sub="Salary/Inventory se auto-aayi" color="#0891b2" darkMode={darkMode} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, marginBottom: 24, alignItems: 'start' }}>

            <div className="card" style={{ margin: 0, ...cardBg }}>
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <i className="ti ti-list" style={{ color: '#4f46e5', fontSize: 17 }} aria-hidden="true" /> Expense Entries
                </h4>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select className="form-select" style={{ width: 160, fontSize: 12 }} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
                    <option value="">All Categories</option>
                    {meta.categories.map(c => <option key={c} value={c}>{prettyLabel(c)}</option>)}
                  </select>
                  <select className="form-select" style={{ width: 120, fontSize: 12 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                    <option value="">All Status</option>
                    <option value="PAID">Paid</option>
                    <option value="PENDING">Pending</option>
                  </select>
                </div>
              </div>

              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Title</th><th>Category</th><th>Vendor</th><th>Amount</th>
                      <th>Date</th><th>Method</th><th>Status</th><th>Source</th>
                      {isPrincipal && <th>Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={9} style={{ textAlign: 'center', padding: 24, color: 'var(--neutral-4)' }}>Loading...</td></tr>
                    ) : expenses.length === 0 ? (
                      <tr><td colSpan={9} style={{ textAlign: 'center', padding: 24, color: 'var(--neutral-4)' }}>Is mahine koi expense nahi hai</td></tr>
                    ) : expenses.map(e => (
                      <tr key={e.id}>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{e.title}</div>
                          {e.invoice_number && <div style={{ fontSize: 11, color: 'var(--neutral-5)' }}>Inv #{e.invoice_number}</div>}
                        </td>
                        <td style={{ fontSize: 12 }}>{prettyLabel(e.category)}</td>
                        <td style={{ fontSize: 12 }}>{e.vendor_name || '—'}</td>
                        <td style={{ fontWeight: 700, fontSize: 13, color: '#dc2626' }}>₹{fmt(e.amount)}</td>
                        <td style={{ fontSize: 12 }}>{e.payment_date}</td>
                        <td style={{ fontSize: 12 }}>{prettyLabel(e.payment_method)}</td>
                        <td>
                          <span style={{
                            padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                            background: e.status === 'PAID' ? (darkMode ? 'rgba(22,163,74,0.15)' : '#dcfce7') : (darkMode ? 'rgba(217,119,6,0.15)' : '#fef3c7'),
                            color: e.status === 'PAID' ? '#16a34a' : '#d97706',
                          }}>{e.status}</span>
                        </td>
                        <td>
                          {e.source !== 'MANUAL' ? (
                            <span style={{
                              fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                              background: darkMode ? 'rgba(37,99,235,0.15)' : '#eff6ff', color: '#2563eb',
                            }}>{e.source === 'SALARY_AUTO' ? 'Salary' : 'Inventory'}</span>
                          ) : <span style={{ fontSize: 11, color: 'var(--neutral-5)' }}>Manual</span>}
                        </td>
                        {isPrincipal && (
                          <td>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button onClick={() => openEdit(e)} style={{
                                background: 'none', border: 'none', cursor: 'pointer', color: '#4f46e5', padding: 4,
                              }}><i className="ti ti-edit" style={{ fontSize: 15 }} aria-hidden="true" /></button>
                              <button onClick={() => remove(e.id)} style={{
                                background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: 4,
                              }}><i className="ti ti-trash" style={{ fontSize: 15 }} aria-hidden="true" /></button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card" style={{ margin: 0, ...cardBg }}>
              <div className="card-header">
                <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <i className="ti ti-chart-pie" style={{ color: '#7c3aed', fontSize: 17 }} aria-hidden="true" /> Category Breakdown
                </h4>
              </div>
              <div style={{ padding: '12px 16px' }}>
                {!summary || summary.categories.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 30, color: 'var(--neutral-4)', fontSize: 13 }}>Koi expense data nahi hai</div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={summary.categories} dataKey="amount" nameKey="category" innerRadius={45} outerRadius={80} paddingAngle={2}>
                          {summary.categories.map((c, i) => <Cell key={c.category} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v) => `₹${fmt(v)}`} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                      {summary.categories.map((c, i) => (
                        <div key={c.category} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                          <span style={{ width: 9, height: 9, borderRadius: '50%', background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                          <span style={{ flex: 1, color: darkMode ? '#cbd5e1' : '#334155' }}>{prettyLabel(c.category)}</span>
                          <span style={{ fontWeight: 700 }}>{c.pct}%</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {modalOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setModalOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: darkMode ? '#141b2d' : '#fff', borderRadius: 14, width: 480, maxWidth: '92vw',
            maxHeight: '88vh', overflowY: 'auto', padding: 24,
          }}>
            <h3 style={{ margin: '0 0 18px', fontSize: 16, color: darkMode ? '#f1f5f9' : '#0f172a' }}>
              {editingId ? 'Edit Expense' : 'Add Expense'}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="form-label">Category *</label>
                <select className="form-select" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  <option value="">Select category</option>
                  {meta.categories.map(c => <option key={c} value={c}>{prettyLabel(c)}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Title *</label>
                <input className="form-input" placeholder="e.g. July Electricity Bill" value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ position: 'relative' }}>
                  <label className="form-label">Vendor Name</label>
                  <input
                    className="form-input"
                    placeholder="Type ya list se select karo"
                    value={form.vendor_name}
                    onChange={e => { setForm(f => ({ ...f, vendor_name: e.target.value })); setVendorDropdownOpen(true); }}
                    onFocus={() => setVendorDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setVendorDropdownOpen(false), 150)}
                  />
                  {vendorDropdownOpen && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20,
                      background: darkMode ? '#1c2436' : '#fff',
                      border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
                      borderRadius: 8, marginTop: 4, maxHeight: 180, overflowY: 'auto',
                      boxShadow: '0 6px 16px rgba(0,0,0,0.15)',
                    }}>
                      {filteredVendors.map(v => (
                        <div key={v.id}
                          onMouseDown={() => selectVendor(v.name)}
                          style={{ padding: '8px 12px', fontSize: 13, cursor: 'pointer', color: darkMode ? '#e2e8f0' : '#0f172a' }}
                        >{v.name}</div>
                      ))}
                      {form.vendor_name.trim() && !exactVendorMatch && (
                        <div
                          onMouseDown={openCreateVendor}
                          style={{ padding: '8px 12px', fontSize: 13, cursor: 'pointer', color: '#4f46e5', fontWeight: 600, borderTop: filteredVendors.length ? `1px solid ${darkMode ? '#334155' : '#e2e8f0'}` : 'none' }}
                        >+ Create "{form.vendor_name.trim()}"</div>
                      )}
                      {!filteredVendors.length && !form.vendor_name.trim() && (
                        <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--neutral-5)' }}>Type karke naya vendor add karo</div>
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <label className="form-label">Amount (₹) *</label>
                  <input className="form-input" type="number" placeholder="0" value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label">Payment Method</label>
                  <select className="form-select" value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}>
                    {meta.payment_methods.map(m => <option key={m} value={m}>{prettyLabel(m)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Payment Date</label>
                  <input className="form-input" type="date" value={form.payment_date}
                    onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label">Invoice Number</label>
                  <input className="form-input" placeholder="Optional" value={form.invoice_number}
                    onChange={e => setForm(f => ({ ...f, invoice_number: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Status</label>
                  <select className="form-select" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                    <option value="PAID">Paid</option>
                    <option value="PENDING">Pending</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="form-label">Remarks</label>
                <textarea className="form-input" rows={2} placeholder="Optional note" value={form.remarks}
                  onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button className="btn btn-neutral btn-sm" onClick={() => setModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary btn-sm" disabled={saving} onClick={save}>
                {saving ? 'Saving...' : editingId ? 'Update Expense' : 'Save Expense'}
              </button>
            </div>
          </div>
        </div>
      )}

      {creatingVendor && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1100,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setCreatingVendor(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: darkMode ? '#141b2d' : '#fff', borderRadius: 14, width: 360, maxWidth: '90vw', padding: 22,
          }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 15, color: darkMode ? '#f1f5f9' : '#0f172a' }}>Create New Vendor</h3>
            <label className="form-label">Vendor Name *</label>
            <input className="form-input" value={newVendorName}
              onChange={e => setNewVendorName(e.target.value)} autoFocus />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
              <button className="btn btn-neutral btn-sm" onClick={() => setCreatingVendor(false)}>Cancel</button>
              <button className="btn btn-primary btn-sm" disabled={savingVendor} onClick={saveNewVendor}>
                {savingVendor ? 'Saving...' : 'Create & Select'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .theme-dark { background: #0b1220; }
        .theme-dark .main-content { background: #0b1220; }
        .theme-dark .card, .theme-dark .stat-card { background: #141b2d !important; border-color: #1e293b !important; }
        .theme-dark .card-header { border-color: #1e293b !important; }
        .theme-dark h2, .theme-dark h3, .theme-dark h4, .theme-dark .page-title, .theme-dark .stat-value { color: #f1f5f9 !important; }
        .theme-dark .page-subtitle, .theme-dark .stat-label, .theme-dark .stat-sub { color: #94a3b8 !important; }
        .theme-dark .table-container, .theme-dark table { background: #141b2d !important; }
        .theme-dark th { background: #1c2436 !important; color: #94a3b8 !important; border-color: #1e293b !important; }
        .theme-dark td { border-color: #1e293b !important; color: #cbd5e1 !important; }
        .theme-dark .btn-neutral { background: #1e293b !important; color: #cbd5e1 !important; border-color: #334155 !important; }
        .theme-dark .form-select, .theme-dark .form-input { background: #0f172a !important; color: #e2e8f0 !important; border-color: #334155 !important; }
        .theme-dark .form-label { color: #94a3b8 !important; }
      `}</style>
    </div>
  );
}
