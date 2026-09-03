import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

export default function PurchasesPage() {
  const { user } = useAuth();
  const isPrincipal = user?.role === 'PRINCIPAL' || user?.role === 'SUPER_ADMIN';

  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('ederp_theme') === 'dark');
  useEffect(() => { localStorage.setItem('ederp_theme', darkMode ? 'dark' : 'light'); }, [darkMode]);

  const [activeTab, setActiveTab] = useState('ORDERS'); // 'ORDERS' | 'BILLS'
  const [loading, setLoading] = useState(true);

  const [orders, setOrders] = useState([]);
  const [bills, setBills] = useState([]);
  const [vendors, setVendors] = useState([]);

  // Filter states
  const [statusFilter, setStatusFilter] = useState('');
  const [vendorFilter, setVendorFilter] = useState('');

  // Modals
  const [createPoModal, setCreatePoModal] = useState(false);
  const [poForm, setPoForm] = useState({
    vendor_id: '',
    target_type: 'INVENTORY',
    expected_delivery_date: '',
    notes: '',
    items: [{ item_name: '', category: 'STATIONERY', unit: 'PIECES', ordered_qty: 1, unit_price: 0, tax_pct: 0, is_asset: false }]
  });

  const [grnModal, setGrnModal] = useState(false);
  const [selectedPo, setSelectedPo] = useState(null);
  const [grnForm, setGrnForm] = useState({ challan_no: '', notes: '', items: [] });

  const [payModal, setPayModal] = useState(false);
  const [selectedBill, setSelectedBill] = useState(null);
  const [payForm, setPayForm] = useState({ amount: '', payment_mode: 'BANK_TRANSFER', reference_no: '', notes: '' });

  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [vRes, poRes, bRes] = await Promise.all([
        api.get('/finance/vendors'),
        api.get('/finance/purchases/orders', { params: { status: statusFilter, vendor_id: vendorFilter } }),
        api.get('/finance/purchases/bills', { params: { vendor_id: vendorFilter } }),
      ]);
      setVendors(vRes.data || []);
      setOrders(poRes.data || []);
      setBills(bRes.data || []);
    } catch (err) {
      toast.error('Failed to load purchase records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter, vendorFilter]);

  // Handle PO line item changes
  const handleItemChange = (idx, field, val) => {
    const updated = [...poForm.items];
    updated[idx][field] = val;
    setPoForm({ ...poForm, items: updated });
  };

  const addItemRow = () => {
    setPoForm({
      ...poForm,
      items: [...poForm.items, { item_name: '', category: 'STATIONERY', unit: 'PIECES', ordered_qty: 1, unit_price: 0, tax_pct: 0, is_asset: poForm.target_type === 'ASSET' }]
    });
  };

  const removeItemRow = (idx) => {
    if (poForm.items.length <= 1) return;
    setPoForm({ ...poForm, items: poForm.items.filter((_, i) => i !== idx) });
  };

  // Submit PO
  const handleCreatePo = async (e) => {
    e.preventDefault();
    if (!poForm.vendor_id) {
      toast.error('Please select a vendor');
      return;
    }
    for (const it of poForm.items) {
      if (!it.item_name.trim()) {
        toast.error('Item name is required for all line items');
        return;
      }
    }
    try {
      setSubmitting(true);
      await api.post('/finance/purchases/orders', poForm);
      toast.success('Purchase order created successfully');
      setCreatePoModal(false);
      setPoForm({
        vendor_id: '',
        target_type: 'INVENTORY',
        expected_delivery_date: '',
        notes: '',
        items: [{ item_name: '', category: 'STATIONERY', unit: 'PIECES', ordered_qty: 1, unit_price: 0, tax_pct: 0, is_asset: false }]
      });
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create purchase order');
    } finally {
      setSubmitting(false);
    }
  };

  // Approve PO
  const handleApprovePo = async (poId) => {
    try {
      await api.post(`/finance/purchases/orders/${poId}/approve`);
      toast.success('Purchase order approved! Ready to receive goods.');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to approve order');
    }
  };

  // Open GRN Modal
  const openGrnModal = (po) => {
    setSelectedPo(po);
    setGrnForm({
      challan_no: '',
      notes: '',
      items: po.items.map(it => ({
        po_item_id: it.id,
        item_name: it.item_name,
        ordered_qty: it.ordered_qty,
        received_qty: it.ordered_qty - (it.received_qty || 0),
        rejected_qty: 0,
        rejection_reason: ''
      }))
    });
    setGrnModal(true);
  };

  // Submit GRN
  const handleProcessGrn = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const res = await api.post(`/finance/purchases/orders/${selectedPo.id}/grn`, grnForm);
      toast.success(res.data.message || 'Goods received and recorded!');
      setGrnModal(false);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to process goods receipt');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Pay Bill Modal
  const openPayModal = (bill) => {
    setSelectedBill(bill);
    setPayForm({
      amount: bill.balance_amount,
      payment_mode: 'BANK_TRANSFER',
      reference_no: '',
      notes: ''
    });
    setPayModal(true);
  };

  // Submit Payment
  const handlePayBill = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const res = await api.post(`/finance/purchases/bills/${selectedBill.id}/pay`, payForm);
      toast.success(res.data.message || 'Payment recorded successfully!');
      setPayModal(false);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Payment failed');
    } finally {
      setSubmitting(false);
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
        <Navbar title="Purchases & Procurement" />
        <div className="page-body">

          {/* Header Banner */}
          <div style={{
            background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
            borderRadius: 14, padding: '22px 26px', color: '#fff', marginBottom: 24,
            boxShadow: '0 4px 20px rgba(2, 132, 199, 0.25)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ background: 'rgba(255,255,255,0.2)', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 800 }}>
                  PROCUREMENT LIFECYCLE
                </span>
                <span style={{ fontSize: 12, opacity: 0.85 }}>Vendor &bull; PO &bull; GRN &bull; Inventory/Assets &bull; Bills &bull; Payments</span>
              </div>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Purchases &amp; Vendor Billing</h1>
              <p style={{ margin: '4px 0 0', fontSize: 13, opacity: 0.9, maxWidth: 650 }}>
                Manage school purchase orders, receive verified goods (GRN), auto-sync consumables into stock and equipment into the Asset Register, and clear vendor bills with partial payment support.
              </p>
            </div>

            <button
              onClick={() => setCreatePoModal(true)}
              style={{
                background: '#fff', color: '#0369a1', border: 'none', borderRadius: 10,
                padding: '10px 20px', fontSize: 13, fontWeight: 800, cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', gap: 8
              }}
            >
              <i className="ti ti-plus" />
              New Purchase Order
            </button>
          </div>

          {/* Navigation Tabs & Filters */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setActiveTab('ORDERS')}
                style={{
                  padding: '9px 20px', borderRadius: 8, border: 'none', fontWeight: 800, fontSize: 13, cursor: 'pointer',
                  background: activeTab === 'ORDERS' ? '#0284c7' : (darkMode ? '#1e293b' : '#e2e8f0'),
                  color: activeTab === 'ORDERS' ? '#fff' : (darkMode ? '#94a3b8' : '#475569')
                }}
              >
                📋 Purchase Orders ({orders.length})
              </button>
              <button
                onClick={() => setActiveTab('BILLS')}
                style={{
                  padding: '9px 20px', borderRadius: 8, border: 'none', fontWeight: 800, fontSize: 13, cursor: 'pointer',
                  background: activeTab === 'BILLS' ? '#0284c7' : (darkMode ? '#1e293b' : '#e2e8f0'),
                  color: activeTab === 'BILLS' ? '#fff' : (darkMode ? '#94a3b8' : '#475569')
                }}
              >
                🧾 Vendor Bills &amp; Payments ({bills.length})
              </button>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <select
                value={vendorFilter}
                onChange={(e) => setVendorFilter(e.target.value)}
                style={{ ...inputStyle, width: 200, marginBottom: 0 }}
              >
                <option value="">All Vendors</option>
                {vendors.map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>

              {activeTab === 'ORDERS' && (
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  style={{ ...inputStyle, width: 180, marginBottom: 0 }}
                >
                  <option value="">All Statuses</option>
                  <option value="PENDING_APPROVAL">Pending Approval</option>
                  <option value="APPROVED">Approved</option>
                  <option value="PARTIALLY_RECEIVED">Partially Received</option>
                  <option value="RECEIVED">Received</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              )}
            </div>
          </div>

          {/* TAB 1: PURCHASE ORDERS */}
          {activeTab === 'ORDERS' && (
            <div className="card" style={{ background: darkMode ? '#1e293b' : '#fff', padding: 0, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: darkMode ? '#0f172a' : '#f8fafc', borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}` }}>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 11, fontWeight: 800 }}>PO # &amp; DATE</th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 11, fontWeight: 800 }}>VENDOR</th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 11, fontWeight: 800 }}>TARGET</th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 11, fontWeight: 800 }}>ITEMS SUMMARY</th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 11, fontWeight: 800, textAlign: 'right' }}>TOTAL (₹)</th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 11, fontWeight: 800, textAlign: 'center' }}>STATUS</th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 11, fontWeight: 800, textAlign: 'right' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>Loading orders...</td>
                    </tr>
                  ) : orders.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '50px 0', color: '#94a3b8' }}>
                        No purchase orders found. Click "New Purchase Order" to raise one.
                      </td>
                    </tr>
                  ) : (
                    orders.map(po => (
                      <tr key={po.id} style={{ borderBottom: `1px solid ${darkMode ? '#334155' : '#f1f5f9'}` }}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 800, color: darkMode ? '#f8fafc' : '#0f172a' }}>{po.po_number}</div>
                          <div style={{ fontSize: 11, color: '#94a3b8' }}>{po.order_date}</div>
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>{po.vendor_name}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 800,
                            background: po.target_type === 'ASSET' ? '#ede9fe' : '#e0f2fe',
                            color: po.target_type === 'ASSET' ? '#6d28d9' : '#0369a1'
                          }}>
                            {po.target_type}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontSize: 12 }}>
                            {po.items?.map(it => `${it.item_name} (×${it.ordered_qty})`).join(', ')}
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800 }}>
                          {fmt(po.total_amount)}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <span style={{
                            padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 800,
                            background: po.status === 'RECEIVED' ? '#f0fdf4' : po.status === 'APPROVED' ? '#eff6ff' : po.status === 'PARTIALLY_RECEIVED' ? '#fffbeb' : '#fef2f2',
                            color: po.status === 'RECEIVED' ? '#16a34a' : po.status === 'APPROVED' ? '#2563eb' : po.status === 'PARTIALLY_RECEIVED' ? '#d97706' : '#dc2626'
                          }}>
                            {po.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          {isPrincipal && po.status === 'PENDING_APPROVAL' && (
                            <button
                              onClick={() => handleApprovePo(po.id)}
                              style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                            >
                              ✓ Approve
                            </button>
                          )}
                          {(po.status === 'APPROVED' || po.status === 'PARTIALLY_RECEIVED') && (
                            <button
                              onClick={() => openGrnModal(po)}
                              style={{ background: '#0284c7', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                            >
                              📦 Receive Goods (GRN)
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 2: VENDOR BILLS & PAYMENTS */}
          {activeTab === 'BILLS' && (
            <div className="card" style={{ background: darkMode ? '#1e293b' : '#fff', padding: 0, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: darkMode ? '#0f172a' : '#f8fafc', borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}` }}>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 11, fontWeight: 800 }}>BILL # &amp; DATE</th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 11, fontWeight: 800 }}>VENDOR</th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 11, fontWeight: 800, textAlign: 'right' }}>TOTAL BILLED (₹)</th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 11, fontWeight: 800, textAlign: 'right' }}>PAID (₹)</th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 11, fontWeight: 800, textAlign: 'right' }}>BALANCE DUE (₹)</th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 11, fontWeight: 800, textAlign: 'center' }}>STATUS</th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 11, fontWeight: 800, textAlign: 'right' }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>Loading vendor bills...</td>
                    </tr>
                  ) : bills.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '50px 0', color: '#94a3b8' }}>
                        No vendor bills generated yet. Bills are automatically created when goods are received (GRN).
                      </td>
                    </tr>
                  ) : (
                    bills.map(b => (
                      <tr key={b.id} style={{ borderBottom: `1px solid ${darkMode ? '#334155' : '#f1f5f9'}` }}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 800 }}>{b.bill_number}</div>
                          <div style={{ fontSize: 11, color: '#94a3b8' }}>{b.bill_date}</div>
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>{b.vendor_name}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>{fmt(b.total_amount)}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: '#16a34a' }}>{fmt(b.paid_amount)}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: b.balance_amount > 0 ? '#dc2626' : '#16a34a' }}>
                          {fmt(b.balance_amount)}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <span style={{
                            padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 800,
                            background: b.status === 'PAID' ? '#f0fdf4' : b.status === 'PARTIAL' ? '#fffbeb' : '#fef2f2',
                            color: b.status === 'PAID' ? '#16a34a' : b.status === 'PARTIAL' ? '#d97706' : '#dc2626'
                          }}>
                            {b.status}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          {b.balance_amount > 0 && (
                            <button
                              onClick={() => openPayModal(b)}
                              style={{ background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                            >
                              💳 Pay Bill
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

        </div>
      </div>

      {/* ══ MODAL: CREATE PURCHASE ORDER ══ */}
      {createPoModal && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setCreatePoModal(false)}>
          <div className="modal" style={{ maxWidth: 680, background: darkMode ? '#1e293b' : '#fff' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontWeight: 800 }}>Create New Purchase Order</h3>
              <button className="modal-close" onClick={() => setCreatePoModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreatePo}>
              <div className="modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Select Vendor *</label>
                    <select
                      value={poForm.vendor_id}
                      onChange={(e) => setPoForm({ ...poForm, vendor_id: e.target.value })}
                      style={inputStyle}
                      required
                    >
                      <option value="">-- Choose Vendor --</option>
                      {vendors.map(v => (
                        <option key={v.id} value={v.id}>{v.name} ({v.vendor_code})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Procurement Target *</label>
                    <select
                      value={poForm.target_type}
                      onChange={(e) => {
                        const target = e.target.value;
                        setPoForm({
                          ...poForm,
                          target_type: target,
                          items: poForm.items.map(it => ({ ...it, is_asset: target === 'ASSET' }))
                        });
                      }}
                      style={inputStyle}
                    >
                      <option value="INVENTORY">Inventory (Consumables, Supplies)</option>
                      <option value="ASSET">School Assets (Equipment, Laptops, Furniture)</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Expected Delivery Date</label>
                    <input
                      type="date"
                      value={poForm.expected_delivery_date}
                      onChange={(e) => setPoForm({ ...poForm, expected_delivery_date: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>PO Remarks / Reference</label>
                    <input
                      type="text"
                      placeholder="Notes for vendor or school office"
                      value={poForm.notes}
                      onChange={(e) => setPoForm({ ...poForm, notes: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                </div>

                <div style={{ marginTop: 10, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 800 }}>Order Line Items</span>
                  <button type="button" onClick={addItemRow} className="btn btn-neutral btn-sm">+ Add Item</button>
                </div>

                {poForm.items.map((it, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder="Item name (e.g. A4 Paper / Laptops)"
                      value={it.item_name}
                      onChange={(e) => handleItemChange(idx, 'item_name', e.target.value)}
                      style={{ ...inputStyle, marginBottom: 0 }}
                      required
                    />
                    <input
                      type="number"
                      placeholder="Qty"
                      min="1"
                      value={it.ordered_qty}
                      onChange={(e) => handleItemChange(idx, 'ordered_qty', e.target.value)}
                      style={{ ...inputStyle, marginBottom: 0 }}
                      required
                    />
                    <input
                      type="number"
                      placeholder="Rate (₹)"
                      step="0.01"
                      value={it.unit_price}
                      onChange={(e) => handleItemChange(idx, 'unit_price', e.target.value)}
                      style={{ ...inputStyle, marginBottom: 0 }}
                      required
                    />
                    <div style={{ fontSize: 12, fontWeight: 800, textAlign: 'right' }}>
                      {fmt(it.ordered_qty * it.unit_price)}
                    </div>
                    {poForm.items.length > 1 && (
                      <button type="button" onClick={() => removeItemRow(idx)} style={{ background: 'transparent', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 16 }}>
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="modal-footer" style={{ borderTop: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, padding: '14px 20px' }}>
                <button type="button" className="btn btn-neutral" onClick={() => setCreatePoModal(false)}>Cancel</button>
                <button type="submit" disabled={submitting} className="btn btn-primary">
                  {submitting ? 'Creating...' : 'Submit Purchase Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══ MODAL: RECEIVE GOODS (GRN) ══ */}
      {grnModal && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setGrnModal(false)}>
          <div className="modal" style={{ maxWidth: 680, background: darkMode ? '#1e293b' : '#fff' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontWeight: 800 }}>Goods Receipt Note (GRN) — {selectedPo?.po_number}</h3>
              <button className="modal-close" onClick={() => setGrnModal(false)}>✕</button>
            </div>
            <form onSubmit={handleProcessGrn}>
              <div className="modal-body">
                <div style={{
                  background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8,
                  padding: '10px 14px', fontSize: 12, color: '#166534', marginBottom: 14
                }}>
                  ✓ <strong>Automated Verification</strong>: Only received quantity will enter stock or the Asset Register. A corresponding Vendor Bill will be generated automatically for the verified quantity.
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Delivery Challan / Invoice #</label>
                    <input
                      type="text"
                      placeholder="e.g. DC-10293"
                      value={grnForm.challan_no}
                      onChange={(e) => setGrnForm({ ...grnForm, challan_no: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Receipt Remarks</label>
                    <input
                      type="text"
                      placeholder="e.g. Package inspected upon delivery"
                      value={grnForm.notes}
                      onChange={(e) => setGrnForm({ ...grnForm, notes: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                </div>

                <span style={{ fontSize: 13, fontWeight: 800, display: 'block', marginBottom: 8 }}>Item Quantities Verified</span>

                {grnForm.items.map((it, idx) => (
                  <div key={idx} style={{ background: darkMode ? '#0f172a' : '#f8fafc', border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, borderRadius: 8, padding: 10, marginBottom: 8 }}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>{it.item_name} (Ordered: {it.ordered_qty})</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 8 }}>
                      <div>
                        <label style={{ fontSize: 11, color: '#16a34a', fontWeight: 700 }}>Received Qty *</label>
                        <input
                          type="number"
                          min="0"
                          value={it.received_qty}
                          onChange={(e) => {
                            const updated = [...grnForm.items];
                            updated[idx].received_qty = Number(e.target.value);
                            setGrnForm({ ...grnForm, items: updated });
                          }}
                          style={{ ...inputStyle, marginBottom: 0 }}
                          required
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: '#dc2626', fontWeight: 700 }}>Damaged/Rejected</label>
                        <input
                          type="number"
                          min="0"
                          value={it.rejected_qty}
                          onChange={(e) => {
                            const updated = [...grnForm.items];
                            updated[idx].rejected_qty = Number(e.target.value);
                            setGrnForm({ ...grnForm, items: updated });
                          }}
                          style={{ ...inputStyle, marginBottom: 0 }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>Rejection Reason</label>
                        <input
                          type="text"
                          placeholder="Optional reason for rejection"
                          value={it.rejection_reason}
                          onChange={(e) => {
                            const updated = [...grnForm.items];
                            updated[idx].rejection_reason = e.target.value;
                            setGrnForm({ ...grnForm, items: updated });
                          }}
                          style={{ ...inputStyle, marginBottom: 0 }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="modal-footer" style={{ borderTop: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, padding: '14px 20px' }}>
                <button type="button" className="btn btn-neutral" onClick={() => setGrnModal(false)}>Cancel</button>
                <button type="submit" disabled={submitting} className="btn btn-primary">
                  {submitting ? 'Processing...' : 'Confirm Goods Receipt & Generate Bill'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══ MODAL: PAY VENDOR BILL ══ */}
      {payModal && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setPayModal(false)}>
          <div className="modal" style={{ maxWidth: 480, background: darkMode ? '#1e293b' : '#fff' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontWeight: 800 }}>Pay Vendor Bill — {selectedBill?.bill_number}</h3>
              <button className="modal-close" onClick={() => setPayModal(false)}>✕</button>
            </div>
            <form onSubmit={handlePayBill}>
              <div className="modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div>
                    <label style={labelStyle}>Total Billed</label>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{fmt(selectedBill?.total_amount)}</div>
                  </div>
                  <div>
                    <label style={labelStyle}>Remaining Balance Due</label>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#dc2626' }}>{fmt(selectedBill?.balance_amount)}</div>
                  </div>
                </div>

                <label style={labelStyle}>Payment Amount (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  max={selectedBill?.balance_amount}
                  value={payForm.amount}
                  onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
                  style={inputStyle}
                  required
                />

                <label style={labelStyle}>Payment Mode *</label>
                <select
                  value={payForm.payment_mode}
                  onChange={(e) => setPayForm({ ...payForm, payment_mode: e.target.value })}
                  style={inputStyle}
                >
                  <option value="BANK_TRANSFER">Bank Transfer / NEFT / RTGS</option>
                  <option value="UPI">UPI / QR</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="CASH">Cash</option>
                </select>

                <label style={labelStyle}>Transaction Reference / Cheque #</label>
                <input
                  type="text"
                  placeholder="e.g. UTR-9988776655"
                  value={payForm.reference_no}
                  onChange={(e) => setPayForm({ ...payForm, reference_no: e.target.value })}
                  style={inputStyle}
                />
              </div>

              <div className="modal-footer" style={{ borderTop: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, padding: '14px 20px' }}>
                <button type="button" className="btn btn-neutral" onClick={() => setPayModal(false)}>Cancel</button>
                <button type="submit" disabled={submitting} className="btn btn-primary">
                  {submitting ? 'Recording...' : 'Confirm Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
