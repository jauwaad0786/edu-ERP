import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from 'recharts';

const COLORS = ['#4f46e5', '#7c3aed', '#16a34a', '#d97706', '#dc2626', '#0891b2', '#db2777', '#65a30d', '#9333ea', '#0284c7', '#ca8a04', '#be185d'];

function prettyLabel(v) {
  if (!v) return '';
  return v.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
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
  name: '', category: '', sku: '', vendor_name: '', quantity: 1, unit_price: '',
  min_stock: 5, purchase_date: new Date().toISOString().slice(0, 10),
  location: '', assigned_to: '', condition: 'NEW', remarks: '',
};

const EMPTY_RESTOCK = { quantity: '', unit_price: '', vendor_name: '', purchase_date: new Date().toISOString().slice(0, 10) };

export default function InventoryPage() {
  const { user } = useAuth();
  const isPrincipal = user?.role === 'PRINCIPAL';

  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('ederp_theme') === 'dark');
  useEffect(() => { localStorage.setItem('ederp_theme', darkMode ? 'dark' : 'light'); }, [darkMode]);

  const [meta, setMeta]         = useState({ categories: [], conditions: [], statuses: [] });
  const [items, setItems]       = useState([]);
  const [summary, setSummary]   = useState(null);
  const [loading, setLoading]   = useState(true);

  const [categoryFilter, setCategoryFilter] = useState('');
  const [lowStockOnly, setLowStockOnly]     = useState(false);
  const [search, setSearch]                 = useState('');

  const [modalOpen, setModalOpen]     = useState(false);
  const [form, setForm]               = useState(EMPTY_FORM);
  const [saving, setSaving]           = useState(false);

  const [restockItem, setRestockItem] = useState(null);
  const [restockForm, setRestockForm] = useState(EMPTY_RESTOCK);
  const [restocking, setRestocking]   = useState(false);

  const [vendors, setVendors]                       = useState([]);
  const [vendorDropdownOpen, setVendorDropdownOpen] = useState(false);
  const [creatingVendor, setCreatingVendor]         = useState(false);
  const [newVendorName, setNewVendorName]           = useState('');
  const [savingVendor, setSavingVendor]             = useState(false);

  useEffect(() => {
    api.get('/finance/inventory/meta').then(r => setMeta(r.data)).catch(() => {});
    api.get('/finance/vendors').then(r => setVendors(r.data || [])).catch(() => {});
  }, []);

  const load = () => {
    setLoading(true);
    const params = {};
    if (categoryFilter) params.category = categoryFilter;
    if (lowStockOnly)   params.low_stock = 'true';
    if (search.trim())  params.search = search.trim();

    Promise.all([
      api.get('/finance/inventory', { params }).catch(() => ({ data: [] })),
      api.get('/finance/inventory/summary').catch(() => ({ data: null })),
    ]).then(([it, sum]) => {
      setItems(it.data || []);
      setSummary(sum.data);
      setLoading(false);
    });
  };

  useEffect(load, [categoryFilter, lowStockOnly, search]);

  const fmt  = n => Number(n || 0).toLocaleString('en-IN');
  const cardBg = { background: darkMode ? '#141b2d' : undefined, borderColor: darkMode ? '#1e293b' : undefined };

  const openAdd = () => { setForm({ ...EMPTY_FORM, purchase_date: new Date().toISOString().slice(0, 10) }); setModalOpen(true); };

  const save = async () => {
    if (!form.name.trim() || !form.category || !form.unit_price) {
      alert('Item name, category aur unit price zaroori hai');
      return;
    }
    setSaving(true);
    try {
      await api.post('/finance/inventory', form);
      setModalOpen(false);
      load();
    } catch (err) {
      alert(err?.response?.data?.error || 'Save nahi hua, dobara try karo');
    }
    setSaving(false);
  };

  const openRestock = (item) => {
    setRestockItem(item);
    setRestockForm({ ...EMPTY_RESTOCK, unit_price: item.unit_price, vendor_name: item.vendor_name });
  };

  const doRestock = async () => {
    if (!restockForm.quantity || Number(restockForm.quantity) <= 0) {
      alert('Quantity 0 se zyada honi chahiye');
      return;
    }
    setRestocking(true);
    try {
      await api.post(`/finance/inventory/${restockItem.id}/restock`, restockForm);
      setRestockItem(null);
      load();
    } catch (err) {
      alert(err?.response?.data?.error || 'Restock nahi hua');
    }
    setRestocking(false);
  };

  const remove = async (id) => {
    if (!window.confirm('Ye item delete karna hai?')) return;
    try {
      await api.delete(`/finance/inventory/${id}`);
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

  const chartData = (summary?.by_category || []).map(c => ({ category: c.category, value: c.value }));

  return (
    <div className={`app-shell${darkMode ? ' theme-dark' : ''}`}>
      <Sidebar darkMode={darkMode} />
      <div className="main-content">
        <Navbar title="Inventory" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />
        <div className="page-body">

          <div className="page-header flex justify-between items-center">
            <div>
              <h2 className="page-title">Inventory Management</h2>
              <p className="page-subtitle">Item purchase karte hi Expenses mein turant reflect hoga</p>
            </div>
            <button className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={openAdd}>
              <i className="ti ti-plus" style={{ fontSize: 14 }} aria-hidden="true" /> Add Item
            </button>
          </div>

          <div className="grid-4 mb-6">
            <StatCard icon="ti-package" label="Total Items" value={summary?.total_items ?? 0}
              sub="Active inventory" color="#4f46e5" darkMode={darkMode} />
            <StatCard icon="ti-currency-rupee" label="Total Value" value={`₹${fmt(summary?.total_value)}`}
              sub="Current stock worth" color="#16a34a" darkMode={darkMode} />
            <StatCard icon="ti-alert-triangle" label="Low Stock" value={summary?.low_stock_count ?? 0}
              sub="Minimum se neeche" color="#dc2626" darkMode={darkMode} />
            <StatCard icon="ti-category" label="Categories" value={summary?.by_category?.length ?? 0}
              sub="Active types" color="#d97706" darkMode={darkMode} />
          </div>

          {summary?.low_stock_count > 0 && (
            <div className="card mb-6" style={{ ...cardBg, borderColor: '#fca5a5' }}>
              <div style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <i className="ti ti-alert-triangle" style={{ color: '#dc2626', fontSize: 16 }} aria-hidden="true" />
                <span style={{ fontSize: 13, fontWeight: 600, color: '#dc2626' }}>Low Stock Alert:</span>
                {summary.low_stock_items.map(i => (
                  <span key={i.id} style={{
                    fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                    background: darkMode ? 'rgba(220,38,38,0.15)' : '#fee2e2', color: '#dc2626',
                  }}>{i.name} ({i.quantity} left)</span>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, marginBottom: 24, alignItems: 'start' }}>

            <div className="card" style={{ margin: 0, ...cardBg }}>
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <i className="ti ti-boxes" style={{ color: '#4f46e5', fontSize: 17 }} aria-hidden="true" /> Items
                </h4>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <input className="form-input" placeholder="Search items..." style={{ width: 160, fontSize: 12 }}
                    value={search} onChange={e => setSearch(e.target.value)} />
                  <select className="form-select" style={{ width: 150, fontSize: 12 }} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
                    <option value="">All Categories</option>
                    {meta.categories.map(c => <option key={c} value={c}>{prettyLabel(c)}</option>)}
                  </select>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, cursor: 'pointer' }}>
                    <input type="checkbox" checked={lowStockOnly} onChange={e => setLowStockOnly(e.target.checked)} />
                    Low stock only
                  </label>
                </div>
              </div>

              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Item</th><th>Category</th><th>SKU</th><th>Qty</th>
                      <th>Unit Price</th><th>Value</th><th>Location</th><th>Condition</th>
                      {isPrincipal && <th>Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={9} style={{ textAlign: 'center', padding: 24, color: 'var(--neutral-4)' }}>Loading...</td></tr>
                    ) : items.length === 0 ? (
                      <tr><td colSpan={9} style={{ textAlign: 'center', padding: 24, color: 'var(--neutral-4)' }}>Koi item nahi mila</td></tr>
                    ) : items.map(i => (
                      <tr key={i.id}>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{i.name}</div>
                          {i.vendor_name && <div style={{ fontSize: 11, color: 'var(--neutral-5)' }}>{i.vendor_name}</div>}
                        </td>
                        <td style={{ fontSize: 12 }}>{prettyLabel(i.category)}</td>
                        <td style={{ fontSize: 12 }}>{i.sku || '—'}</td>
                        <td>
                          <span style={{
                            fontWeight: 700, fontSize: 13,
                            color: i.low_stock ? '#dc2626' : (darkMode ? '#e2e8f0' : '#0f172a'),
                          }}>{i.quantity}</span>
                          {i.low_stock && <i className="ti ti-alert-triangle" style={{ fontSize: 12, color: '#dc2626', marginLeft: 4 }} aria-hidden="true" />}
                        </td>
                        <td style={{ fontSize: 12 }}>₹{fmt(i.unit_price)}</td>
                        <td style={{ fontWeight: 700, fontSize: 13, color: '#16a34a' }}>₹{fmt(i.total_value)}</td>
                        <td style={{ fontSize: 12 }}>{i.location || '—'}</td>
                        <td style={{ fontSize: 12 }}>{prettyLabel(i.condition)}</td>
                        {isPrincipal && (
                          <td>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button onClick={() => openRestock(i)} title="Restock" style={{
                                background: 'none', border: 'none', cursor: 'pointer', color: '#16a34a', padding: 4,
                              }}><i className="ti ti-truck-delivery" style={{ fontSize: 15 }} aria-hidden="true" /></button>
                              <button onClick={() => remove(i.id)} title="Delete" style={{
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
                  <i className="ti ti-chart-pie" style={{ color: '#7c3aed', fontSize: 17 }} aria-hidden="true" /> Value by Category
                </h4>
              </div>
              <div style={{ padding: '12px 16px' }}>
                {chartData.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 30, color: 'var(--neutral-4)', fontSize: 13 }}>Koi data nahi hai</div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={chartData} dataKey="value" nameKey="category" innerRadius={42} outerRadius={75} paddingAngle={2}>
                          {chartData.map((c, i) => <Cell key={c.category} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v) => `₹${fmt(v)}`} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                      {summary.by_category.map((c, i) => (
                        <div key={c.category} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                          <span style={{ width: 9, height: 9, borderRadius: '50%', background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                          <span style={{ flex: 1, color: darkMode ? '#cbd5e1' : '#334155' }}>{prettyLabel(c.category)}</span>
                          <span style={{ fontWeight: 700 }}>₹{fmt(c.value)}</span>
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
            background: darkMode ? '#141b2d' : '#fff', borderRadius: 14, width: 500, maxWidth: '92vw',
            maxHeight: '88vh', overflowY: 'auto', padding: 24,
          }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 16, color: darkMode ? '#f1f5f9' : '#0f172a' }}>Add Inventory Item</h3>
            <p style={{ margin: '0 0 18px', fontSize: 12, color: darkMode ? '#94a3b8' : '#64748b' }}>Save karte hi ek linked Expense entry bhi ban jaayegi</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="form-label">Item Name *</label>
                <input className="form-input" placeholder="e.g. A4 Register" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label">Category *</label>
                  <select className="form-select" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                    <option value="">Select category</option>
                    {meta.categories.map(c => <option key={c} value={c}>{prettyLabel(c)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">SKU (optional)</label>
                  <input className="form-input" placeholder="e.g. STA-REG-001" value={form.sku}
                    onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label">Quantity *</label>
                  <input className="form-input" type="number" value={form.quantity}
                    onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Unit Price (₹) *</label>
                  <input className="form-input" type="number" value={form.unit_price}
                    onChange={e => setForm(f => ({ ...f, unit_price: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ position: 'relative' }}>
                  <label className="form-label">Vendor</label>
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
                      borderRadius: 8, marginTop: 4, maxHeight: 160, overflowY: 'auto',
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
                    </div>
                  )}
                </div>
                <div>
                  <label className="form-label">Min Stock (alert level)</label>
                  <input className="form-input" type="number" value={form.min_stock}
                    onChange={e => setForm(f => ({ ...f, min_stock: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label">Purchase Date</label>
                  <input className="form-input" type="date" value={form.purchase_date}
                    onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Condition</label>
                  <select className="form-select" value={form.condition} onChange={e => setForm(f => ({ ...f, condition: e.target.value }))}>
                    {meta.conditions.map(c => <option key={c} value={c}>{prettyLabel(c)}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label">Location</label>
                  <input className="form-input" placeholder="e.g. Computer Lab" value={form.location}
                    onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Assigned To</label>
                  <input className="form-input" placeholder="e.g. Class 8-A" value={form.assigned_to}
                    onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))} />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button className="btn btn-neutral btn-sm" onClick={() => setModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary btn-sm" disabled={saving} onClick={save}>
                {saving ? 'Saving...' : 'Save Item'}
              </button>
            </div>
          </div>
        </div>
      )}

      {restockItem && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setRestockItem(null)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: darkMode ? '#141b2d' : '#fff', borderRadius: 14, width: 420, maxWidth: '92vw', padding: 24,
          }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 16, color: darkMode ? '#f1f5f9' : '#0f172a' }}>Restock — {restockItem.name}</h3>
            <p style={{ margin: '0 0 18px', fontSize: 12, color: darkMode ? '#94a3b8' : '#64748b' }}>
              Abhi stock: {restockItem.quantity} units · Ye purchase bhi ek nayi Expense banaayegi
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="form-label">Quantity to Add *</label>
                <input className="form-input" type="number" value={restockForm.quantity}
                  onChange={e => setRestockForm(f => ({ ...f, quantity: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label">Unit Price (₹)</label>
                  <input className="form-input" type="number" value={restockForm.unit_price}
                    onChange={e => setRestockForm(f => ({ ...f, unit_price: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Purchase Date</label>
                  <input className="form-input" type="date" value={restockForm.purchase_date}
                    onChange={e => setRestockForm(f => ({ ...f, purchase_date: e.target.value }))} />
                </div>
              </div>
              <div style={{ position: 'relative' }}>
                <label className="form-label">Vendor</label>
                <input
                  className="form-input"
                  value={restockForm.vendor_name}
                  onChange={e => { setRestockForm(f => ({ ...f, vendor_name: e.target.value })); setVendorDropdownOpen(true); }}
                  onFocus={() => setVendorDropdownOpen(true)}
                  onBlur={() => setTimeout(() => setVendorDropdownOpen(false), 150)}
                />
                {vendorDropdownOpen && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20,
                    background: darkMode ? '#1c2436' : '#fff',
                    border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
                    borderRadius: 8, marginTop: 4, maxHeight: 140, overflowY: 'auto',
                    boxShadow: '0 6px 16px rgba(0,0,0,0.15)',
                  }}>
                    {vendors.filter(v => v.name.toLowerCase().includes((restockForm.vendor_name || '').toLowerCase())).map(v => (
                      <div key={v.id}
                        onMouseDown={() => { setRestockForm(f => ({ ...f, vendor_name: v.name })); setVendorDropdownOpen(false); }}
                        style={{ padding: '8px 12px', fontSize: 13, cursor: 'pointer', color: darkMode ? '#e2e8f0' : '#0f172a' }}
                      >{v.name}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button className="btn btn-neutral btn-sm" onClick={() => setRestockItem(null)}>Cancel</button>
              <button className="btn btn-primary btn-sm" disabled={restocking} onClick={doRestock}>
                {restocking ? 'Saving...' : 'Confirm Restock'}
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
