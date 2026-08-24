import React, { useState, useEffect, useMemo } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from 'recharts';

const COLORS = ['#6366f1', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16', '#3b82f6', '#14b8a6', '#f97316', '#a855f7'];

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

const EMPTY_FORM = {
  category: '', title: '', vendor_name: '', amount: '', invoice_number: '',
  payment_method: 'CASH', payment_date: new Date().toISOString().slice(0, 10),
  status: 'PAID', remarks: '',
};

export default function ExpensesPage() {
  const { user } = useAuth();
  const isPrincipal = user?.role === 'PRINCIPAL' || user?.role === 'ACCOUNTANT' || user?.role === 'SUPER_ADMIN';

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
      const res = await api.post('/finance/vendors', { name: newVendorName.trim() });
      const created = res.data?.data || res.data;
      setVendors(prev => [...prev, created]);
      setForm(f => ({ ...f, vendor_name: created.name }));
      setCreatingVendor(false);
      setVendorDropdownOpen(false);
    } catch (err) {
      alert(err?.response?.data?.error || 'Vendor create nahi ho paya');
    }
    setSavingVendor(false);
  };

  const totalExpense = summary?.total_expense ?? expenses.reduce((a, b) => a + Number(b.amount || 0), 0);
  const salaryTotal  = summary?.salary_total  ?? expenses.filter(e => e.source === 'SALARY_AUTO').reduce((a, b) => a + Number(b.amount || 0), 0);
  const topCategory  = summary?.category_breakdown?.[0];
  const autoCount    = summary?.auto_linked_count ?? expenses.filter(e => e.source !== 'MANUAL').length;

  const pieData = (summary?.category_breakdown || []).map((c, i) => ({
    name: prettyLabel(c.category),
    value: Number(c.amount || 0),
    color: COLORS[i % COLORS.length],
  })).filter(x => x.value > 0);

  return (
    <div className={`app-shell${darkMode ? ' theme-dark' : ''}`}>
      <Sidebar darkMode={darkMode} />
      <div className="main-content">
        <Navbar title="Financial Accounts &amp; Expense Center" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />
        <div className="page-body">

          {/* ══ Hero Command Banner ══ */}
          <div style={{
            position: 'relative', overflow: 'hidden',
            borderRadius: '20px', padding: '24px 28px', marginBottom: '22px',
            background: darkMode
              ? 'linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)'
              : 'linear-gradient(135deg, #4338ca 0%, #6366f1 50%, #818cf8 100%)',
            color: '#ffffff',
            boxShadow: '0 10px 30px -5px rgba(79, 70, 229, 0.35)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span style={{
                    padding: '3px 10px', borderRadius: '20px',
                    background: 'rgba(255,255,255,0.2)', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase'
                  }}>
                    💰 Accounts &amp; Disbursements
                  </span>
                  <span style={{ fontSize: '12px', opacity: 0.9 }}>
                    Fiscal Month: {month}
                  </span>
                </div>
                <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em', color: '#ffffff' }}>
                  Expense Management Center
                </h1>
                <p style={{ margin: '4px 0 0', fontSize: '13.5px', color: 'rgba(255,255,255,0.85)' }}>
                  Record vendor bills, payroll disbursements, inventory requisitions, and utility expenses.
                </p>
              </div>

              {/* Month Selector & Quick Action */}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <select
                  className="form-select"
                  style={{
                    width: '180px', fontSize: '13px', borderRadius: '10px', fontWeight: 700,
                    background: 'rgba(255,255,255,0.15)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.3)',
                    backdropFilter: 'blur(6px)'
                  }}
                  value={month}
                  onChange={e => setMonth(e.target.value)}
                >
                  {months.map(m => <option key={m} value={m} style={{ color: '#0f172a' }}>{m}</option>)}
                </select>
                <button
                  onClick={openAdd}
                  style={{
                    background: '#ffffff', color: '#4f46e5', border: 'none', borderRadius: '10px',
                    padding: '10px 18px', fontSize: '13px', fontWeight: 800, cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', gap: '6px'
                  }}
                >
                  <i className="ti ti-plus" /> Add New Expense
                </button>
              </div>
            </div>
          </div>

          {/* ══ Bento Stat Cards ══ */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: '14px', marginBottom: '22px'
          }}>
            <div style={{
              background: darkMode ? '#111827' : '#ffffff',
              border: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : '#e2e8f0'}`,
              borderRadius: '16px', padding: '18px',
              boxShadow: darkMode ? '0 4px 16px rgba(0,0,0,0.3)' : '0 4px 16px rgba(15,23,42,0.03)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11.5px', color: darkMode ? '#94a3b8' : '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                  Total Expense ({month})
                </span>
                <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'rgba(239,68,68,0.15)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="ti ti-receipt-2" />
                </div>
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#ef4444' }}>
                ₹{fmt(totalExpense)}
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{expenses.length} Total vouchers</div>
            </div>

            <div style={{
              background: darkMode ? '#111827' : '#ffffff',
              border: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : '#e2e8f0'}`,
              borderRadius: '16px', padding: '18px',
              boxShadow: darkMode ? '0 4px 16px rgba(0,0,0,0.3)' : '0 4px 16px rgba(15,23,42,0.03)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11.5px', color: darkMode ? '#94a3b8' : '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                  Payroll / Salaries
                </span>
                <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'rgba(99,102,241,0.15)', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="ti ti-users" />
                </div>
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#6366f1' }}>
                ₹{fmt(salaryTotal)}
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Teacher &amp; staff compensation</div>
            </div>

            <div style={{
              background: darkMode ? '#111827' : '#ffffff',
              border: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : '#e2e8f0'}`,
              borderRadius: '16px', padding: '18px',
              boxShadow: darkMode ? '0 4px 16px rgba(0,0,0,0.3)' : '0 4px 16px rgba(15,23,42,0.03)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11.5px', color: darkMode ? '#94a3b8' : '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                  Top Category
                </span>
                <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'rgba(245,158,11,0.15)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="ti ti-chart-pie" />
                </div>
              </div>
              <div style={{ fontSize: '20px', fontWeight: 900, color: '#f59e0b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {topCategory ? prettyLabel(topCategory.category) : '—'}
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                {topCategory ? `₹${fmt(topCategory.amount)} · ${topCategory.pct}%` : 'No data'}
              </div>
            </div>

            <div style={{
              background: darkMode ? '#111827' : '#ffffff',
              border: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : '#e2e8f0'}`,
              borderRadius: '16px', padding: '18px',
              boxShadow: darkMode ? '0 4px 16px rgba(0,0,0,0.3)' : '0 4px 16px rgba(15,23,42,0.03)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11.5px', color: darkMode ? '#94a3b8' : '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                  Automated Entries
                </span>
                <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'rgba(6,182,212,0.15)', color: '#06b6d4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="ti ti-bolt" />
                </div>
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#06b6d4' }}>
                {autoCount}
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Synced from payroll &amp; inventory</div>
            </div>
          </div>

          {/* ══ Main Ledger & Category Distribution Grid ══ */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px', marginBottom: '24px', alignItems: 'start' }}>

            {/* Expense Entries Table */}
            <div className="card" style={{
              borderRadius: '18px', margin: 0,
              background: darkMode ? '#111827' : '#ffffff',
              border: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : '#e2e8f0'}`,
              boxShadow: darkMode ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 20px rgba(15,23,42,0.03)'
            }}>
              <div className="card-header" style={{
                padding: '16px 20px', borderBottom: `1px solid ${darkMode ? '#1f2937' : '#f1f5f9'}`,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap'
              }}>
                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="ti ti-list" style={{ color: '#6366f1', fontSize: '18px' }} /> Expense Vouchers &amp; Bills
                </h4>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select
                    className="form-select"
                    style={{
                      width: '150px', fontSize: '12px', borderRadius: '8px',
                      background: darkMode ? '#1e293b' : '#ffffff',
                      borderColor: darkMode ? '#334155' : '#cbd5e1',
                      color: darkMode ? '#ffffff' : '#0f172a'
                    }}
                    value={categoryFilter}
                    onChange={e => setCategoryFilter(e.target.value)}
                  >
                    <option value="">All Categories</option>
                    {meta.categories.map(c => <option key={c} value={c}>{prettyLabel(c)}</option>)}
                  </select>
                  <select
                    className="form-select"
                    style={{
                      width: '110px', fontSize: '12px', borderRadius: '8px',
                      background: darkMode ? '#1e293b' : '#ffffff',
                      borderColor: darkMode ? '#334155' : '#cbd5e1',
                      color: darkMode ? '#ffffff' : '#0f172a'
                    }}
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                  >
                    <option value="">All Status</option>
                    <option value="PAID">Paid</option>
                    <option value="PENDING">Pending</option>
                  </select>
                </div>
              </div>

              <div className="table-container" style={{ border: 'none' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Title &amp; Invoice</th><th>Category</th><th>Vendor</th><th>Amount</th>
                      <th>Date</th><th>Method</th><th>Status</th><th>Source</th>
                      {isPrincipal && <th>Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={9} style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>Loading expense ledger...</td></tr>
                    ) : expenses.length === 0 ? (
                      <tr><td colSpan={9} style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>Is mahine koi expense record nahi hai</td></tr>
                    ) : expenses.map(e => (
                      <tr key={e.id}>
                        <td>
                          <div style={{ fontWeight: 700, fontSize: '13.5px', color: darkMode ? '#ffffff' : '#0f172a' }}>{e.title}</div>
                          {e.invoice_number && <div style={{ fontSize: '11px', color: '#94a3b8' }}>Inv #{e.invoice_number}</div>}
                        </td>
                        <td style={{ fontSize: '12px' }}>{prettyLabel(e.category)}</td>
                        <td style={{ fontSize: '12px', color: '#94a3b8' }}>{e.vendor_name || '—'}</td>
                        <td style={{ fontWeight: 800, fontSize: '13.5px', color: '#ef4444' }}>₹{fmt(e.amount)}</td>
                        <td style={{ fontSize: '12px' }}>{e.payment_date}</td>
                        <td style={{ fontSize: '12px' }}>{prettyLabel(e.payment_method)}</td>
                        <td>
                          <span style={{
                            padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 800,
                            background: e.status === 'PAID' ? (darkMode ? 'rgba(16,185,129,0.15)' : '#dcfce7') : (darkMode ? 'rgba(245,158,11,0.15)' : '#fef3c7'),
                            color: e.status === 'PAID' ? '#10b981' : '#d97706',
                          }}>{e.status}</span>
                        </td>
                        <td>
                          {e.source !== 'MANUAL' ? (
                            <span style={{
                              fontSize: '10.5px', fontWeight: 800, padding: '2px 8px', borderRadius: '12px',
                              background: darkMode ? 'rgba(99,102,241,0.2)' : '#e0e7ff', color: '#6366f1',
                            }}>{e.source === 'SALARY_AUTO' ? 'Payroll' : 'Inventory'}</span>
                          ) : <span style={{ fontSize: '11px', color: '#94a3b8' }}>Manual</span>}
                        </td>
                        {isPrincipal && (
                          <td>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button onClick={() => openEdit(e)} style={{
                                background: 'none', border: 'none', cursor: 'pointer', color: '#6366f1', padding: '4px',
                              }}><i className="ti ti-edit" style={{ fontSize: '15px' }} /></button>
                              <button onClick={() => remove(e.id)} style={{
                                background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px',
                              }}><i className="ti ti-trash" style={{ fontSize: '15px' }} /></button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Category Breakdown Donut Card */}
            <div className="card" style={{
              borderRadius: '18px', margin: 0,
              background: darkMode ? '#111827' : '#ffffff',
              border: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : '#e2e8f0'}`,
              padding: '20px', boxShadow: darkMode ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 20px rgba(15,23,42,0.03)'
            }}>
              <h4 style={{ margin: '0 0 14px', fontSize: '15px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a' }}>
                Category Breakdown
              </h4>
              {pieData.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 10px', color: '#94a3b8', fontSize: '13px' }}>
                  Is mahine koi breakdown data nahi hai
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={42} outerRadius={68}>
                        {pieData.map(entry => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={val => `₹${fmt(val)}`} />
                    </PieChart>
                  </ResponsiveContainer>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                    {summary?.category_breakdown?.slice(0, 5).map((c, i) => (
                      <div key={c.category} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: darkMode ? '#cbd5e1' : '#475569' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: COLORS[i % COLORS.length] }} />
                          {prettyLabel(c.category)}
                        </span>
                        <span style={{ fontWeight: 700, color: darkMode ? '#ffffff' : '#0f172a' }}>
                          ₹{fmt(c.amount)} ({c.pct}%)
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

          </div>

          {/* ══ Add/Edit Expense Modal ══ */}
          {modalOpen && (
            <div
              style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999,
                backdropFilter: 'blur(6px)'
              }}
              onClick={e => e.target === e.currentTarget && setModalOpen(false)}
            >
              <div style={{
                background: darkMode ? '#111827' : '#ffffff', borderRadius: '20px', padding: '28px',
                width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto',
                border: `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`,
                boxShadow: '0 20px 40px rgba(0,0,0,0.4)'
              }}>
                <h3 style={{ margin: '0 0 18px', fontSize: '18px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a' }}>
                  {editingId ? '✏️ Edit Expense Voucher' : '➕ Record New Expense'}
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: darkMode ? '#94a3b8' : '#64748b', display: 'block', marginBottom: '4px' }}>
                      Category *
                    </label>
                    <select
                      className="form-select"
                      style={{
                        width: '100%', borderRadius: '8px', fontSize: '13px',
                        background: darkMode ? '#0f172a' : '#ffffff',
                        borderColor: darkMode ? '#334155' : '#cbd5e1',
                        color: darkMode ? '#ffffff' : '#0f172a'
                      }}
                      value={form.category}
                      onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    >
                      <option value="">-- Select Category --</option>
                      {meta.categories.map(c => <option key={c} value={c}>{prettyLabel(c)}</option>)}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: darkMode ? '#94a3b8' : '#64748b', display: 'block', marginBottom: '4px' }}>
                      Amount (₹) *
                    </label>
                    <input
                      type="number"
                      className="form-input"
                      style={{
                        width: '100%', borderRadius: '8px', fontSize: '13px', fontWeight: 700,
                        background: darkMode ? '#0f172a' : '#ffffff',
                        borderColor: darkMode ? '#334155' : '#cbd5e1',
                        color: darkMode ? '#ffffff' : '#0f172a'
                      }}
                      placeholder="0.00"
                      value={form.amount}
                      onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: darkMode ? '#94a3b8' : '#64748b', display: 'block', marginBottom: '4px' }}>
                    Title / Purpose *
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    style={{
                      width: '100%', borderRadius: '8px', fontSize: '13px',
                      background: darkMode ? '#0f172a' : '#ffffff',
                      borderColor: darkMode ? '#334155' : '#cbd5e1',
                      color: darkMode ? '#ffffff' : '#0f172a'
                    }}
                    placeholder="e.g. Science Lab Chemical Reagents"
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: darkMode ? '#94a3b8' : '#64748b', display: 'block', marginBottom: '4px' }}>
                      Vendor / Payee
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      style={{
                        width: '100%', borderRadius: '8px', fontSize: '13px',
                        background: darkMode ? '#0f172a' : '#ffffff',
                        borderColor: darkMode ? '#334155' : '#cbd5e1',
                        color: darkMode ? '#ffffff' : '#0f172a'
                      }}
                      placeholder="e.g. Apex Stationers"
                      value={form.vendor_name}
                      onChange={e => setForm(f => ({ ...f, vendor_name: e.target.value }))}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: darkMode ? '#94a3b8' : '#64748b', display: 'block', marginBottom: '4px' }}>
                      Payment Method
                    </label>
                    <select
                      className="form-select"
                      style={{
                        width: '100%', borderRadius: '8px', fontSize: '13px',
                        background: darkMode ? '#0f172a' : '#ffffff',
                        borderColor: darkMode ? '#334155' : '#cbd5e1',
                        color: darkMode ? '#ffffff' : '#0f172a'
                      }}
                      value={form.payment_method}
                      onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}
                    >
                      {meta.payment_methods.map(m => <option key={m} value={m}>{prettyLabel(m)}</option>)}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: darkMode ? '#94a3b8' : '#64748b', display: 'block', marginBottom: '4px' }}>
                      Payment Date
                    </label>
                    <input
                      type="date"
                      className="form-input"
                      style={{
                        width: '100%', borderRadius: '8px', fontSize: '13px',
                        background: darkMode ? '#0f172a' : '#ffffff',
                        borderColor: darkMode ? '#334155' : '#cbd5e1',
                        color: darkMode ? '#ffffff' : '#0f172a'
                      }}
                      value={form.payment_date}
                      onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: darkMode ? '#94a3b8' : '#64748b', display: 'block', marginBottom: '4px' }}>
                      Invoice / Bill Number
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      style={{
                        width: '100%', borderRadius: '8px', fontSize: '13px',
                        background: darkMode ? '#0f172a' : '#ffffff',
                        borderColor: darkMode ? '#334155' : '#cbd5e1',
                        color: darkMode ? '#ffffff' : '#0f172a'
                      }}
                      placeholder="e.g. INV-2024-991"
                      value={form.invoice_number}
                      onChange={e => setForm(f => ({ ...f, invoice_number: e.target.value }))}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
                  <button
                    onClick={() => setModalOpen(false)}
                    style={{
                      padding: '10px 16px', borderRadius: '10px', border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
                      background: darkMode ? '#1e293b' : '#f8fafc',
                      color: darkMode ? '#ffffff' : '#334155', cursor: 'pointer', fontSize: '13px', fontWeight: 600
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    disabled={saving}
                    onClick={save}
                    style={{
                      padding: '10px 20px', borderRadius: '10px', border: 'none',
                      background: '#6366f1', color: '#ffffff', cursor: 'pointer',
                      fontSize: '13px', fontWeight: 800
                    }}
                  >
                    {saving ? 'Saving...' : 'Save Voucher'}
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
