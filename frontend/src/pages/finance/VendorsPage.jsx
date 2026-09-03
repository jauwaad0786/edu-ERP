import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

export default function VendorsPage() {
  const { user } = useAuth();
  const isPrincipal = user?.role === 'PRINCIPAL' || user?.role === 'SUPER_ADMIN';

  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('ederp_theme') === 'dark');
  useEffect(() => { localStorage.setItem('ederp_theme', darkMode ? 'dark' : 'light'); }, [darkMode]);

  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Modals
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    name: '', contact_person: '', phone: '', email: '', address: '',
    gst_number: '', pan_number: '', category: 'STATIONERY', payment_terms: 'Net 30',
    bank_name: '', bank_account_no: '', bank_ifsc: '', notes: ''
  });

  const [historyVendor, setHistoryVendor] = useState(null);
  const [historyData, setHistoryData] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/finance/vendors', {
        params: { search, category: categoryFilter }
      });
      setVendors(res.data || []);
    } catch (err) {
      toast.error('Failed to load vendors');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, categoryFilter]);

  const handleSaveVendor = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await api.post('/finance/vendors', form);
      toast.success('Vendor profile registered');
      setModalOpen(false);
      setForm({
        name: '', contact_person: '', phone: '', email: '', address: '',
        gst_number: '', pan_number: '', category: 'STATIONERY', payment_terms: 'Net 30',
        bank_name: '', bank_account_no: '', bank_ifsc: '', notes: ''
      });
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save vendor');
    } finally {
      setSubmitting(false);
    }
  };

  const openHistory = async (v) => {
    setHistoryVendor(v);
    setHistoryLoading(true);
    try {
      const res = await api.get(`/finance/vendors/${v.id}/history`);
      setHistoryData(res.data);
    } catch (err) {
      toast.error('Failed to load vendor ledger history');
    } finally {
      setHistoryLoading(false);
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
        <Navbar title="Vendors & Suppliers" />
        <div className="page-body">

          {/* Banner */}
          <div style={{
            background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
            borderRadius: 14, padding: '22px 26px', color: '#fff', marginBottom: 20,
            boxShadow: '0 4px 20px rgba(37, 99, 235, 0.25)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ background: 'rgba(255,255,255,0.2)', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 800 }}>
                  SUPPLIER DIRECTORY
                </span>
                <span style={{ fontSize: 12, opacity: 0.85 }}>GST &bull; Bank Accounts &bull; Bills &bull; Outstanding Balances</span>
              </div>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Vendors &amp; Suppliers</h1>
              <p style={{ margin: '4px 0 0', fontSize: 13, opacity: 0.9, maxWidth: 680 }}>
                Maintain approved school vendor profiles with bank and GST details, view real-time outstanding balances, and track purchase order and billing histories.
              </p>
            </div>

            <button
              onClick={() => setModalOpen(true)}
              style={{
                background: '#fff', color: '#1d4ed8', border: 'none', borderRadius: 10,
                padding: '10px 20px', fontSize: 13, fontWeight: 800, cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', gap: 8
              }}
            >
              <i className="ti ti-plus" />
              Add Vendor
            </button>
          </div>

          {/* Search & Filter */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
            <input
              type="text"
              placeholder="Search by vendor code, company name, phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ ...inputStyle, width: 280, marginBottom: 0 }}
            />

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{ ...inputStyle, width: 180, marginBottom: 0 }}
            >
              <option value="">All Categories</option>
              <option value="STATIONERY">Stationery</option>
              <option value="BOOKS">Books &amp; Publications</option>
              <option value="UNIFORM">Uniforms</option>
              <option value="IT_EQUIPMENT">IT &amp; Hardware</option>
              <option value="FURNITURE">Furniture</option>
              <option value="MAINTENANCE">Repairs &amp; Maintenance</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          {/* Vendors Table */}
          <div className="card" style={{ background: darkMode ? '#1e293b' : '#fff', padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ background: darkMode ? '#0f172a' : '#f8fafc', borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}` }}>
                  <th style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 11, fontWeight: 800 }}>CODE &amp; VENDOR NAME</th>
                  <th style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 11, fontWeight: 800 }}>CATEGORY</th>
                  <th style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 11, fontWeight: 800 }}>CONTACT &amp; PHONE</th>
                  <th style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 11, fontWeight: 800 }}>TERMS &amp; GST</th>
                  <th style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 11, fontWeight: 800, textAlign: 'right' }}>TOTAL BILLED</th>
                  <th style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 11, fontWeight: 800, textAlign: 'right' }}>OUTSTANDING (₹)</th>
                  <th style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 11, fontWeight: 800, textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>Loading vendor directory...</td>
                  </tr>
                ) : vendors.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '50px 0', color: '#94a3b8' }}>
                      No vendors registered yet.
                    </td>
                  </tr>
                ) : (
                  vendors.map(v => (
                    <tr key={v.id} style={{ borderBottom: `1px solid ${darkMode ? '#334155' : '#f1f5f9'}` }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 800, color: '#2563eb' }}>{v.vendor_code}</div>
                        <div style={{ fontWeight: 700, color: darkMode ? '#f8fafc' : '#0f172a' }}>{v.name}</div>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 12 }}>{v.category}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontSize: 12 }}>{v.contact_person || '—'}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>📞 {v.phone || '—'}</div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontSize: 12 }}>{v.payment_terms || 'Net 30'}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>GST: {v.gst_number || 'Unregistered'}</div>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>{fmt(v.total_purchases)}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: v.outstanding_balance > 0 ? '#dc2626' : '#16a34a' }}>
                        {fmt(v.outstanding_balance)}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <button
                          onClick={() => openHistory(v)}
                          className="btn btn-neutral btn-sm"
                          title="View purchase and payment history"
                        >
                          📜 Ledger &amp; Bills
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

        </div>
      </div>

      {/* ══ MODAL: ADD VENDOR ══ */}
      {modalOpen && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setModalOpen(false)}>
          <div className="modal" style={{ maxWidth: 640, background: darkMode ? '#1e293b' : '#fff' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontWeight: 800 }}>Register New Vendor</h3>
              <button className="modal-close" onClick={() => setModalOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveVendor}>
              <div className="modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Company / Vendor Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Apex Stationery Mart"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      style={inputStyle}
                      required
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Category</label>
                    <select
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                      style={inputStyle}
                    >
                      <option value="STATIONERY">Stationery</option>
                      <option value="BOOKS">Books &amp; Publications</option>
                      <option value="UNIFORM">Uniforms</option>
                      <option value="IT_EQUIPMENT">IT &amp; Hardware</option>
                      <option value="FURNITURE">Furniture</option>
                      <option value="MAINTENANCE">Maintenance</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Contact Person</label>
                    <input
                      type="text"
                      placeholder="e.g. Ramesh Gupta"
                      value={form.contact_person}
                      onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Phone Number</label>
                    <input
                      type="text"
                      placeholder="e.g. 9876543210"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Payment Terms</label>
                    <select
                      value={form.payment_terms}
                      onChange={(e) => setForm({ ...form, payment_terms: e.target.value })}
                      style={inputStyle}
                    >
                      <option value="Net 15">Net 15 Days</option>
                      <option value="Net 30">Net 30 Days</option>
                      <option value="Net 45">Net 45 Days</option>
                      <option value="Immediate">Immediate / COD</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>GST Number</label>
                    <input
                      type="text"
                      placeholder="e.g. 07AAAAA0000A1Z5"
                      value={form.gst_number}
                      onChange={(e) => setForm({ ...form, gst_number: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>PAN Number</label>
                    <input
                      type="text"
                      placeholder="e.g. ABCDE1234F"
                      value={form.pan_number}
                      onChange={(e) => setForm({ ...form, pan_number: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Bank Name</label>
                    <input
                      type="text"
                      placeholder="e.g. State Bank of India"
                      value={form.bank_name}
                      onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Bank Account Number</label>
                    <input
                      type="text"
                      placeholder="e.g. 123456789012"
                      value={form.bank_account_no}
                      onChange={(e) => setForm({ ...form, bank_account_no: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Bank IFSC Code</label>
                    <input
                      type="text"
                      placeholder="e.g. SBIN0001234"
                      value={form.bank_ifsc}
                      onChange={(e) => setForm({ ...form, bank_ifsc: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer" style={{ borderTop: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, padding: '14px 20px' }}>
                <button type="button" className="btn btn-neutral" onClick={() => setModalOpen(false)}>Cancel</button>
                <button type="submit" disabled={submitting} className="btn btn-primary">
                  {submitting ? 'Saving...' : 'Register Vendor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══ MODAL: VENDOR LEDGER HISTORY ══ */}
      {historyVendor && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setHistoryVendor(null)}>
          <div className="modal" style={{ maxWidth: 680, background: darkMode ? '#1e293b' : '#fff' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontWeight: 800 }}>Vendor Ledger: {historyVendor.name} ({historyVendor.vendor_code})</h3>
              <button className="modal-close" onClick={() => setHistoryVendor(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ maxHeight: 460, overflowY: 'auto' }}>
              {historyLoading ? (
                <div style={{ textAlign: 'center', padding: 30, color: '#94a3b8' }}>Loading vendor statement...</div>
              ) : historyData ? (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, background: darkMode ? '#0f172a' : '#f8fafc', padding: 12, borderRadius: 8, marginBottom: 16 }}>
                    <div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>Total Invoiced</div>
                      <div style={{ fontSize: 16, fontWeight: 700 }}>{fmt(historyData.total_purchases)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>Total Paid</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#16a34a' }}>{fmt(historyData.total_paid)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>Outstanding Due</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: historyData.outstanding_balance > 0 ? '#dc2626' : '#16a34a' }}>
                        {fmt(historyData.outstanding_balance)}
                      </div>
                    </div>
                  </div>

                  <h4 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 800 }}>Vendor Invoices / Bills</h4>
                  {historyData.bills?.length === 0 ? (
                    <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>No bills generated yet.</div>
                  ) : (
                    <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', marginBottom: 16 }}>
                      <thead>
                        <tr style={{ background: darkMode ? '#1e293b' : '#e2e8f0' }}>
                          <th style={{ padding: 6 }}>Bill #</th>
                          <th style={{ padding: 6 }}>Date</th>
                          <th style={{ padding: 6, textAlign: 'right' }}>Total</th>
                          <th style={{ padding: 6, textAlign: 'right' }}>Balance</th>
                          <th style={{ padding: 6, textAlign: 'center' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historyData.bills.map((b, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                            <td style={{ padding: 6, fontWeight: 700 }}>{b.bill_number}</td>
                            <td style={{ padding: 6 }}>{b.bill_date}</td>
                            <td style={{ padding: 6, textAlign: 'right' }}>{fmt(b.total_amount)}</td>
                            <td style={{ padding: 6, textAlign: 'right', fontWeight: 700, color: b.balance_amount > 0 ? '#dc2626' : '#16a34a' }}>
                              {fmt(b.balance_amount)}
                            </td>
                            <td style={{ padding: 6, textAlign: 'center' }}>{b.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  <h4 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 800 }}>Payment Disbursals</h4>
                  {historyData.payments?.length === 0 ? (
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>No payments logged yet.</div>
                  ) : (
                    <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: darkMode ? '#1e293b' : '#e2e8f0' }}>
                          <th style={{ padding: 6 }}>Payment #</th>
                          <th style={{ padding: 6 }}>Date</th>
                          <th style={{ padding: 6 }}>Mode &amp; Ref</th>
                          <th style={{ padding: 6, textAlign: 'right' }}>Amount Paid</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historyData.payments.map((p, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                            <td style={{ padding: 6, fontWeight: 700 }}>{p.payment_number}</td>
                            <td style={{ padding: 6 }}>{p.payment_date}</td>
                            <td style={{ padding: 6 }}>{p.payment_mode} ({p.reference_no || 'Direct'})</td>
                            <td style={{ padding: 6, textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>{fmt(p.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              ) : null}
            </div>
            <div className="modal-footer" style={{ borderTop: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, padding: '14px 20px' }}>
              <button type="button" className="btn btn-neutral" onClick={() => setHistoryVendor(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
