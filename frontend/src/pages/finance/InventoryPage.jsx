import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

export default function InventoryPage() {
  const { user } = useAuth();
  const isPrincipal = user?.role === 'PRINCIPAL' || user?.role === 'SUPER_ADMIN';

  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('ederp_theme') === 'dark');
  useEffect(() => { localStorage.setItem('ederp_theme', darkMode ? 'dark' : 'light'); }, [darkMode]);

  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [search, setSearch] = useState('');

  // Modals
  const [addModal, setAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    name: '', category: 'STATIONERY', subcategory: '', unit: 'PIECES', brand: '',
    quantity: 0, unit_price: 0, selling_price: 0, min_stock: 5, reorder_level: 10,
    storage_location: 'Store Room', remarks: ''
  });

  const [issueModal, setIssueModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [issueForm, setIssueForm] = useState({
    quantity: 1, issued_to_name: '', department: 'ACADEMIC', class_name: '', reason: ''
  });

  const [adjustModal, setAdjustModal] = useState(false);
  const [adjustForm, setAdjustForm] = useState({ adjustment_qty: '', reason: '' });

  const [movementModal, setMovementModal] = useState(false);
  const [movements, setMovements] = useState([]);
  const [loadingMovements, setLoadingMovements] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const params = {};
      if (categoryFilter) params.category = categoryFilter;
      if (lowStockOnly) params.low_stock = 'true';
      if (search) params.search = search;

      const [iRes, sRes] = await Promise.all([
        api.get('/finance/inventory', { params }),
        api.get('/finance/inventory/summary')
      ]);
      setItems(iRes.data || []);
      setSummary(sRes.data || null);
    } catch (err) {
      toast.error('Failed to load inventory data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [categoryFilter, lowStockOnly, search]);

  // Handle Add Item
  const handleAddItem = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await api.post('/finance/inventory', addForm);
      toast.success('Inventory item registered');
      setAddModal(false);
      setAddForm({
        name: '', category: 'STATIONERY', subcategory: '', unit: 'PIECES', brand: '',
        quantity: 0, unit_price: 0, selling_price: 0, min_stock: 5, reorder_level: 10,
        storage_location: 'Store Room', remarks: ''
      });
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add item');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Issue Stock
  const handleIssueStock = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const res = await api.post('/finance/inventory/issue', {
        item_id: selectedItem.id,
        ...issueForm
      });
      toast.success(res.data.message || 'Stock issued successfully');
      setIssueModal(false);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to issue stock');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Adjust Stock
  const handleAdjustStock = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const res = await api.post('/finance/inventory/adjust', {
        item_id: selectedItem.id,
        ...adjustForm
      });
      toast.success(res.data.message || 'Stock adjusted successfully');
      setAdjustModal(false);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to adjust stock');
    } finally {
      setSubmitting(false);
    }
  };

  // View Movement History
  const viewHistory = async (item) => {
    setSelectedItem(item);
    setMovementModal(true);
    setLoadingMovements(true);
    try {
      const res = await api.get(`/finance/inventory/${item.id}/movements`);
      setMovements(res.data || []);
    } catch (err) {
      toast.error('Failed to load stock movements');
    } finally {
      setLoadingMovements(false);
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
        <Navbar title="Inventory & Supplies" />
        <div className="page-body">

          {/* Banner & Information */}
          <div style={{
            background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
            borderRadius: 14, padding: '22px 26px', color: '#fff', marginBottom: 20,
            boxShadow: '0 4px 20px rgba(13, 148, 136, 0.25)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ background: 'rgba(255,255,255,0.2)', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 800 }}>
                  CONSUMABLES &amp; SUPPLIES
                </span>
                <span style={{ fontSize: 12, opacity: 0.85 }}>Stationery &bull; Paper &bull; Uniforms &bull; Chalk &bull; Cleaning Supplies</span>
              </div>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Consumables &amp; Stock Register</h1>
              <p style={{ margin: '4px 0 0', fontSize: 13, opacity: 0.9, maxWidth: 680 }}>
                Manage school supplies, track department/classroom issues with automatic deduction, perform audited physical count adjustments, and monitor low-stock thresholds.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <Link
                to="/finance/assets"
                style={{
                  background: 'rgba(255,255,255,0.15)', color: '#fff', textDecoration: 'none', border: '1px solid rgba(255,255,255,0.3)',
                  borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6
                }}
              >
                💻 View School Assets ➔
              </Link>
              <button
                onClick={() => setAddModal(true)}
                style={{
                  background: '#fff', color: '#0f766e', border: 'none', borderRadius: 10,
                  padding: '10px 20px', fontSize: 13, fontWeight: 800, cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', gap: 8
                }}
              >
                <i className="ti ti-plus" />
                Add Consumable
              </button>
            </div>
          </div>

          {/* Stat Cards */}
          {summary && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
              <div className="stat-card" style={{ background: darkMode ? '#1e293b' : '#fff', borderLeft: '4px solid #0d9488' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8' }}>TOTAL ITEMS</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: darkMode ? '#f8fafc' : '#0f172a' }}>{summary.total_items}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>Stock value: {fmt(summary.total_stock_value)}</div>
              </div>

              <div className="stat-card" style={{ background: darkMode ? '#1e293b' : '#fff', borderLeft: '4px solid #16a34a' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8' }}>TOTAL STOCK VALUE</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#16a34a' }}>{fmt(summary.total_stock_value)}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>Across all stores</div>
              </div>

              <div className="stat-card" style={{ background: darkMode ? '#1e293b' : '#fff', borderLeft: '4px solid #dc2626' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8' }}>LOW STOCK ALERTS</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#dc2626' }}>{summary.low_stock_count}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>Needs restocking</div>
              </div>

              <div className="stat-card" style={{ background: darkMode ? '#1e293b' : '#fff', borderLeft: '4px solid #0284c7' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8' }}>PROCUREMENT</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#0284c7', marginTop: 4 }}>
                  <Link to="/finance/purchases" style={{ color: '#0284c7', textDecoration: 'none' }}>
                    Raise Purchase Order ➔
                  </Link>
                </div>
                <div style={{ fontSize: 12, color: '#64748b' }}>Vendor orders &amp; GRN</div>
              </div>
            </div>
          )}

          {/* Filters Bar */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
            <input
              type="text"
              placeholder="Search by item code, name, brand..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ ...inputStyle, width: 280, marginBottom: 0 }}
            />

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{ ...inputStyle, width: 170, marginBottom: 0 }}
            >
              <option value="">All Categories</option>
              <option value="STATIONERY">Stationery</option>
              <option value="BOOKS">Books &amp; Printing</option>
              <option value="UNIFORM">Uniforms</option>
              <option value="SPORTS">Sports Equipment</option>
              <option value="CLEANING">Cleaning &amp; Housekeeping</option>
              <option value="OTHER">Other</option>
            </select>

            <button
              onClick={() => setLowStockOnly(!lowStockOnly)}
              style={{
                padding: '8px 16px', borderRadius: 8, border: 'none', fontWeight: 800, fontSize: 12, cursor: 'pointer',
                background: lowStockOnly ? '#dc2626' : (darkMode ? '#1e293b' : '#e2e8f0'),
                color: lowStockOnly ? '#fff' : (darkMode ? '#94a3b8' : '#475569')
              }}
            >
              ⚠️ Low Stock Only
            </button>
          </div>

          {/* Table */}
          <div className="card" style={{ background: darkMode ? '#1e293b' : '#fff', padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ background: darkMode ? '#0f172a' : '#f8fafc', borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}` }}>
                  <th style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 11, fontWeight: 800 }}>CODE &amp; ITEM NAME</th>
                  <th style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 11, fontWeight: 800 }}>CATEGORY</th>
                  <th style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 11, fontWeight: 800 }}>LOCATION</th>
                  <th style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 11, fontWeight: 800, textAlign: 'right' }}>AVAILABLE STOCK</th>
                  <th style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 11, fontWeight: 800, textAlign: 'right' }}>UNIT RATE (₹)</th>
                  <th style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 11, fontWeight: 800, textAlign: 'right' }}>TOTAL VALUE (₹)</th>
                  <th style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 11, fontWeight: 800, textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>Loading inventory...</td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '50px 0', color: '#94a3b8' }}>
                      No consumable items found.
                    </td>
                  </tr>
                ) : (
                  items.map(it => {
                    const isLow = (it.quantity || 0) <= (it.min_stock || 0);
                    return (
                      <tr key={it.id} style={{ borderBottom: `1px solid ${darkMode ? '#334155' : '#f1f5f9'}` }}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#0d9488' }}>{it.item_code || it.sku}</span>
                            {isLow && (
                              <span style={{ background: '#fef2f2', color: '#dc2626', fontSize: 10, padding: '1px 6px', borderRadius: 4, fontWeight: 800 }}>
                                Low Stock
                              </span>
                            )}
                          </div>
                          <div style={{ fontWeight: 700, color: darkMode ? '#f8fafc' : '#0f172a' }}>{it.name}</div>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 12 }}>{it.category}</td>
                        <td style={{ padding: '12px 16px', fontSize: 12 }}>{it.storage_location || it.location || 'Store Room'}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <span style={{ fontWeight: 800, fontSize: 14, color: isLow ? '#dc2626' : (darkMode ? '#f8fafc' : '#0f172a') }}>
                            {it.quantity} {it.unit}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>{fmt(it.unit_price)}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700 }}>
                          {fmt((it.quantity || 0) * (it.unit_price || 0))}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            <button
                              onClick={() => { setSelectedItem(it); setIssueForm({ quantity: 1, issued_to_name: '', department: 'ACADEMIC', class_name: '', reason: '' }); setIssueModal(true); }}
                              className="btn btn-neutral btn-sm"
                              title="Issue to class, student or teacher"
                            >
                              📤 Issue
                            </button>
                            <button
                              onClick={() => { setSelectedItem(it); setAdjustForm({ adjustment_qty: '', reason: '' }); setAdjustModal(true); }}
                              className="btn btn-neutral btn-sm"
                              title="Audit adjustment"
                            >
                              ⚖️ Adjust
                            </button>
                            <button
                              onClick={() => viewHistory(it)}
                              className="btn btn-neutral btn-sm"
                              title="Stock movement audit log"
                            >
                              📜 Trail
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

        </div>
      </div>

      {/* ══ MODAL: ADD CONSUMABLE ITEM ══ */}
      {addModal && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setAddModal(false)}>
          <div className="modal" style={{ maxWidth: 600, background: darkMode ? '#1e293b' : '#fff' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontWeight: 800 }}>Add Consumable Stock Item</h3>
              <button className="modal-close" onClick={() => setAddModal(false)}>✕</button>
            </div>
            <form onSubmit={handleAddItem}>
              <div className="modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Item Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. A4 Paper Ream (75 GSM)"
                      value={addForm.name}
                      onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                      style={inputStyle}
                      required
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Category *</label>
                    <select
                      value={addForm.category}
                      onChange={(e) => setAddForm({ ...addForm, category: e.target.value })}
                      style={inputStyle}
                    >
                      <option value="STATIONERY">Stationery</option>
                      <option value="BOOKS">Books &amp; Printing</option>
                      <option value="UNIFORM">Uniforms</option>
                      <option value="SPORTS">Sports Equipment</option>
                      <option value="CLEANING">Cleaning Supplies</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Opening Qty</label>
                    <input
                      type="number"
                      min="0"
                      value={addForm.quantity}
                      onChange={(e) => setAddForm({ ...addForm, quantity: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Unit of Measure</label>
                    <select
                      value={addForm.unit}
                      onChange={(e) => setAddForm({ ...addForm, unit: e.target.value })}
                      style={inputStyle}
                    >
                      <option value="PIECES">Pieces</option>
                      <option value="REAMS">Reams</option>
                      <option value="BOXES">Boxes</option>
                      <option value="PACKETS">Packets</option>
                      <option value="KG">Kg</option>
                      <option value="LITERS">Liters</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Unit Cost Price (₹) *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={addForm.unit_price}
                      onChange={(e) => setAddForm({ ...addForm, unit_price: e.target.value })}
                      style={inputStyle}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Low Stock Alert Threshold</label>
                    <input
                      type="number"
                      min="1"
                      value={addForm.min_stock}
                      onChange={(e) => setAddForm({ ...addForm, min_stock: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Storage Location</label>
                    <input
                      type="text"
                      placeholder="e.g. Stationery Store, Shelf B"
                      value={addForm.storage_location}
                      onChange={(e) => setAddForm({ ...addForm, storage_location: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer" style={{ borderTop: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, padding: '14px 20px' }}>
                <button type="button" className="btn btn-neutral" onClick={() => setAddModal(false)}>Cancel</button>
                <button type="submit" disabled={submitting} className="btn btn-primary">
                  {submitting ? 'Adding...' : 'Register Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══ MODAL: ISSUE INVENTORY ══ */}
      {issueModal && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setIssueModal(false)}>
          <div className="modal" style={{ maxWidth: 480, background: darkMode ? '#1e293b' : '#fff' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontWeight: 800 }}>Issue Stock: {selectedItem?.name}</h3>
              <button className="modal-close" onClick={() => setIssueModal(false)}>✕</button>
            </div>
            <form onSubmit={handleIssueStock}>
              <div className="modal-body">
                <div style={{ background: darkMode ? '#0f172a' : '#f8fafc', padding: 10, borderRadius: 8, marginBottom: 12, fontSize: 12 }}>
                  <div>Available Stock: <strong>{selectedItem?.quantity} {selectedItem?.unit}</strong></div>
                </div>

                <label style={labelStyle}>Issue Quantity *</label>
                <input
                  type="number"
                  min="1"
                  max={selectedItem?.quantity}
                  value={issueForm.quantity}
                  onChange={(e) => setIssueForm({ ...issueForm, quantity: e.target.value })}
                  style={inputStyle}
                  required
                />

                <label style={labelStyle}>Issued To (Staff/Teacher/Student Name)</label>
                <input
                  type="text"
                  placeholder="e.g. Teacher Rahul / Amit Sharma"
                  value={issueForm.issued_to_name}
                  onChange={(e) => setIssueForm({ ...issueForm, issued_to_name: e.target.value })}
                  style={inputStyle}
                />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Department</label>
                    <select
                      value={issueForm.department}
                      onChange={(e) => setIssueForm({ ...issueForm, department: e.target.value })}
                      style={inputStyle}
                    >
                      <option value="ACADEMIC">Academic</option>
                      <option value="EXAMINATION">Examination</option>
                      <option value="ADMIN">Administration</option>
                      <option value="SPORTS">Sports</option>
                      <option value="HOSTEL">Hostel</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Class (if applicable)</label>
                    <input
                      type="text"
                      placeholder="e.g. Class 8-A"
                      value={issueForm.class_name}
                      onChange={(e) => setIssueForm({ ...issueForm, class_name: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                </div>

                <label style={labelStyle}>Reason / Purpose *</label>
                <input
                  type="text"
                  placeholder="e.g. Annual exam question paper printing"
                  value={issueForm.reason}
                  onChange={(e) => setIssueForm({ ...issueForm, reason: e.target.value })}
                  style={inputStyle}
                  required
                />
              </div>

              <div className="modal-footer" style={{ borderTop: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, padding: '14px 20px' }}>
                <button type="button" className="btn btn-neutral" onClick={() => setIssueModal(false)}>Cancel</button>
                <button type="submit" disabled={submitting} className="btn btn-primary">
                  {submitting ? 'Issuing...' : 'Confirm Stock Issue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══ MODAL: ADJUST INVENTORY ══ */}
      {adjustModal && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setAdjustModal(false)}>
          <div className="modal" style={{ maxWidth: 460, background: darkMode ? '#1e293b' : '#fff' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontWeight: 800 }}>Adjust Stock: {selectedItem?.name}</h3>
              <button className="modal-close" onClick={() => setAdjustModal(false)}>✕</button>
            </div>
            <form onSubmit={handleAdjustStock}>
              <div className="modal-body">
                <div style={{ background: darkMode ? '#0f172a' : '#f8fafc', padding: 10, borderRadius: 8, marginBottom: 12, fontSize: 12 }}>
                  <div>Current System Stock: <strong>{selectedItem?.quantity} {selectedItem?.unit}</strong></div>
                </div>

                <label style={labelStyle}>Adjustment Quantity (+ or -) *</label>
                <input
                  type="number"
                  placeholder="e.g. -5 (for damaged/lost) or +10 (audit surplus)"
                  value={adjustForm.adjustment_qty}
                  onChange={(e) => setAdjustForm({ ...adjustForm, adjustment_qty: e.target.value })}
                  style={inputStyle}
                  required
                />

                <label style={labelStyle}>Mandatory Audit Reason *</label>
                <textarea
                  placeholder="Explain why physical stock differs from system count..."
                  value={adjustForm.reason}
                  onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                  style={{ ...inputStyle, height: 75 }}
                  required
                />
              </div>

              <div className="modal-footer" style={{ borderTop: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, padding: '14px 20px' }}>
                <button type="button" className="btn btn-neutral" onClick={() => setAdjustModal(false)}>Cancel</button>
                <button type="submit" disabled={submitting} className="btn btn-primary">
                  {submitting ? 'Adjusting...' : 'Save Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══ MODAL: STOCK MOVEMENT TRAIL ══ */}
      {movementModal && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setMovementModal(false)}>
          <div className="modal" style={{ maxWidth: 640, background: darkMode ? '#1e293b' : '#fff' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontWeight: 800 }}>Audit Trail: {selectedItem?.name}</h3>
              <button className="modal-close" onClick={() => setMovementModal(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ maxHeight: 420, overflowY: 'auto' }}>
              {loadingMovements ? (
                <div style={{ textAlign: 'center', padding: 30, color: '#94a3b8' }}>Loading movement trail...</div>
              ) : movements.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 30, color: '#94a3b8' }}>No stock movements recorded yet.</div>
              ) : (
                movements.map((m, i) => (
                  <div key={i} style={{ background: darkMode ? '#0f172a' : '#f8fafc', padding: 10, borderRadius: 8, marginBottom: 8, fontSize: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
                      <span style={{
                        color: m.movement_type === 'PURCHASE' || m.movement_type === 'STOCK_IN' ? '#16a34a' : m.movement_type === 'ISSUE' ? '#0284c7' : '#dc2626'
                      }}>
                        {m.movement_type} ({m.quantity > 0 && (m.movement_type === 'PURCHASE' || m.movement_type === 'STOCK_IN') ? `+${m.quantity}` : `-${m.quantity}`})
                      </span>
                      <span style={{ color: '#94a3b8', fontSize: 11 }}>{m.movement_date}</span>
                    </div>
                    <div style={{ color: '#64748b', marginTop: 2 }}>
                      Stock: {m.previous_stock} ➔ {m.new_stock} &bull; Ref: {m.reference_no || 'Manual'}
                    </div>
                    <div style={{ marginTop: 2 }}>
                      {m.reason || (m.issued_to_name ? `Issued to: ${m.issued_to_name}` : 'Stock update')}
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="modal-footer" style={{ borderTop: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, padding: '14px 20px' }}>
              <button type="button" className="btn btn-neutral" onClick={() => setMovementModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
