import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

export default function AssetsPage() {
  const { user } = useAuth();
  const isPrincipal = user?.role === 'PRINCIPAL' || user?.role === 'SUPER_ADMIN';

  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('ederp_theme') === 'dark');
  useEffect(() => { localStorage.setItem('ederp_theme', darkMode ? 'dark' : 'light'); }, [darkMode]);

  const [loading, setLoading] = useState(true);
  const [assets, setAssets] = useState([]);
  const [summary, setSummary] = useState(null);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [conditionFilter, setConditionFilter] = useState('');
  const [search, setSearch] = useState('');

  // Modals
  const [createModal, setCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '', category: 'LAPTOPS', serial_number: '', model_number: '', brand: '',
    purchase_cost: '', purchase_date: '', location: 'Store / Unassigned', department: 'ADMIN',
    warranty_start: '', warranty_end: '', notes: ''
  });

  const [transferModal, setTransferModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [transferForm, setTransferForm] = useState({ to_user_name: '', to_location: '', to_department: '', reason: '' });

  const [maintModal, setMaintModal] = useState(false);
  const [maintForm, setMaintForm] = useState({ title: '', description: '', cost: '', vendor_name: '', performed_by: '' });

  const [conditionModal, setConditionModal] = useState(false);
  const [condForm, setCondForm] = useState({ condition: 'GOOD', notes: '' });

  const [disposeModal, setDisposeModal] = useState(false);
  const [disposeForm, setDisposeForm] = useState({ disposal_method: 'RETIRED', disposal_amount: 0, reason: '' });

  const [historyModal, setHistoryModal] = useState(false);
  const [assetDetail, setAssetDetail] = useState(null);

  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [aRes, sRes] = await Promise.all([
        api.get('/finance/assets', {
          params: { category: categoryFilter, status: statusFilter, condition: conditionFilter, search }
        }),
        api.get('/finance/assets/summary')
      ]);
      setAssets(aRes.data || []);
      setSummary(sRes.data || null);
    } catch (err) {
      toast.error('Failed to load school assets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [categoryFilter, statusFilter, conditionFilter, search]);

  // Create Asset
  const handleCreateAsset = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await api.post('/finance/assets', createForm);
      toast.success('Asset registered successfully in system');
      setCreateModal(false);
      setCreateForm({
        name: '', category: 'LAPTOPS', serial_number: '', model_number: '', brand: '',
        purchase_cost: '', purchase_date: '', location: 'Store / Unassigned', department: 'ADMIN',
        warranty_start: '', warranty_end: '', notes: ''
      });
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create asset');
    } finally {
      setSubmitting(false);
    }
  };

  // Transfer Asset
  const handleTransferAsset = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await api.post(`/finance/assets/${selectedAsset.id}/transfer`, transferForm);
      toast.success('Asset assigned / transferred successfully');
      setTransferModal(false);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to transfer asset');
    } finally {
      setSubmitting(false);
    }
  };

  // Record Maintenance
  const handleRecordMaint = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const res = await api.post(`/finance/assets/${selectedAsset.id}/maintenance`, maintForm);
      toast.success(res.data.message || 'Maintenance recorded & expense posted to Finance');
      setMaintModal(false);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to log maintenance');
    } finally {
      setSubmitting(false);
    }
  };

  // Condition Inspection
  const handleConditionSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await api.post(`/finance/assets/${selectedAsset.id}/condition`, condForm);
      toast.success('Asset condition updated');
      setConditionModal(false);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update condition');
    } finally {
      setSubmitting(false);
    }
  };

  // Dispose Asset
  const handleDisposeSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await api.post(`/finance/assets/${selectedAsset.id}/dispose`, disposeForm);
      toast.success('Asset retired/disposed. Historical record retained.');
      setDisposeModal(false);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to dispose asset');
    } finally {
      setSubmitting(false);
    }
  };

  // View full history
  const viewAssetHistory = async (asset) => {
    try {
      const res = await api.get(`/finance/assets/${asset.id}`);
      setAssetDetail(res.data);
      setHistoryModal(true);
    } catch (err) {
      toast.error('Failed to load asset history');
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
        <Navbar title="School Asset Management" />
        <div className="page-body">

          {/* Top Banner */}
          <div style={{
            background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
            borderRadius: 14, padding: '22px 26px', color: '#fff', marginBottom: 20,
            boxShadow: '0 4px 20px rgba(79, 70, 229, 0.25)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ background: 'rgba(255,255,255,0.2)', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 800 }}>
                  CAPITAL ASSETS &amp; PROPERTY
                </span>
                <span style={{ fontSize: 12, opacity: 0.85 }}>Laptops &bull; Projectors &bull; Desktops &bull; Benches &bull; CCTV &bull; Lab Gear</span>
              </div>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>School Asset Register</h1>
              <p style={{ margin: '4px 0 0', fontSize: 13, opacity: 0.9, maxWidth: 650 }}>
                Individual serialized tracking of long-term equipment with assignment history, condition monitoring, warranty alerts, and repair costs auto-posted to Finance.
              </p>
            </div>

            <button
              onClick={() => setCreateModal(true)}
              style={{
                background: '#fff', color: '#4f46e5', border: 'none', borderRadius: 10,
                padding: '10px 20px', fontSize: 13, fontWeight: 800, cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', gap: 8
              }}
            >
              <i className="ti ti-plus" />
              Register New Asset
            </button>
          </div>

          {/* KPI Stat Cards */}
          {summary && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
              <div className="stat-card" style={{ background: darkMode ? '#1e293b' : '#fff', borderLeft: '4px solid #4f46e5' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8' }}>TOTAL ASSETS</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: darkMode ? '#f8fafc' : '#0f172a' }}>{summary.total_assets}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>Book Value: {fmt(summary.total_asset_value)}</div>
              </div>

              <div className="stat-card" style={{ background: darkMode ? '#1e293b' : '#fff', borderLeft: '4px solid #16a34a' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8' }}>IN USE / ASSIGNED</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#16a34a' }}>{summary.assigned_count}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{summary.available_count} In Storage</div>
              </div>

              <div className="stat-card" style={{ background: darkMode ? '#1e293b' : '#fff', borderLeft: '4px solid #d97706' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8' }}>UNDER MAINTENANCE</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#d97706' }}>{summary.under_repair_count}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>Repairs / Inspection</div>
              </div>

              <div className="stat-card" style={{ background: darkMode ? '#1e293b' : '#fff', borderLeft: '4px solid #dc2626' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8' }}>WARRANTY EXPIRING</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#dc2626' }}>{summary.warranty_expiring_count}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>Next 30 Days</div>
              </div>
            </div>
          )}

          {/* Search & Filter Bar */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
            <input
              type="text"
              placeholder="Search by tag (AST-001), name, serial #, teacher..."
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
              <option value="LAPTOPS">Laptops</option>
              <option value="DESKTOPS">Desktops</option>
              <option value="PROJECTORS">Projectors</option>
              <option value="PRINTERS">Printers</option>
              <option value="CCTV">CCTV</option>
              <option value="FURNITURE">Furniture</option>
              <option value="LAB_EQUIPMENT">Lab Equipment</option>
              <option value="AIR_CONDITIONERS">Air Conditioners</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ ...inputStyle, width: 160, marginBottom: 0 }}
            >
              <option value="">All Statuses</option>
              <option value="AVAILABLE">Available / Store</option>
              <option value="ASSIGNED">Assigned / In Use</option>
              <option value="UNDER_MAINTENANCE">Under Maintenance</option>
              <option value="DISPOSED">Disposed / Retired</option>
            </select>

            <select
              value={conditionFilter}
              onChange={(e) => setConditionFilter(e.target.value)}
              style={{ ...inputStyle, width: 150, marginBottom: 0 }}
            >
              <option value="">All Conditions</option>
              <option value="NEW">New</option>
              <option value="GOOD">Good</option>
              <option value="FAIR">Fair</option>
              <option value="DAMAGED">Damaged</option>
            </select>
          </div>

          {/* Asset Register Table */}
          <div className="card" style={{ background: darkMode ? '#1e293b' : '#fff', padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ background: darkMode ? '#0f172a' : '#f8fafc', borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}` }}>
                  <th style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 11, fontWeight: 800 }}>TAG ID &amp; ASSET NAME</th>
                  <th style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 11, fontWeight: 800 }}>CATEGORY</th>
                  <th style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 11, fontWeight: 800 }}>CURRENT ASSIGNMENT</th>
                  <th style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 11, fontWeight: 800 }}>LOCATION / DEPT</th>
                  <th style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 11, fontWeight: 800, textAlign: 'center' }}>CONDITION</th>
                  <th style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 11, fontWeight: 800, textAlign: 'center' }}>STATUS</th>
                  <th style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 11, fontWeight: 800, textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>Loading asset register...</td>
                  </tr>
                ) : assets.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '50px 0', color: '#94a3b8' }}>
                      No assets found. Click "Register New Asset" or purchase via the Purchases module.
                    </td>
                  </tr>
                ) : (
                  assets.map(a => (
                    <tr key={a.id} style={{ borderBottom: `1px solid ${darkMode ? '#334155' : '#f1f5f9'}` }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#4f46e5' }}>{a.asset_tag}</span>
                          {a.is_warranty_expiring_soon && (
                            <span style={{ background: '#fef2f2', color: '#dc2626', fontSize: 10, padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>
                              Warranty Expiring
                            </span>
                          )}
                        </div>
                        <div style={{ fontWeight: 700, color: darkMode ? '#f8fafc' : '#0f172a' }}>{a.name}</div>
                        {a.serial_number && <div style={{ fontSize: 11, color: '#94a3b8' }}>S/N: {a.serial_number}</div>}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{a.category}</span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {a.assigned_to_name ? (
                          <div style={{ fontWeight: 700, color: '#0369a1' }}>👤 {a.assigned_to_name}</div>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: 12 }}>Unassigned</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontSize: 12 }}>{a.location || 'Store Room'}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>{a.department}</div>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 800,
                          background: a.condition === 'NEW' || a.condition === 'GOOD' ? '#f0fdf4' : a.condition === 'FAIR' ? '#fffbeb' : '#fef2f2',
                          color: a.condition === 'NEW' || a.condition === 'GOOD' ? '#16a34a' : a.condition === 'FAIR' ? '#d97706' : '#dc2626'
                        }}>
                          {a.condition}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 800,
                          background: a.status === 'ASSIGNED' ? '#eff6ff' : a.status === 'AVAILABLE' ? '#f0fdf4' : a.status === 'UNDER_MAINTENANCE' ? '#fffbeb' : '#f1f5f9',
                          color: a.status === 'ASSIGNED' ? '#2563eb' : a.status === 'AVAILABLE' ? '#16a34a' : a.status === 'UNDER_MAINTENANCE' ? '#d97706' : '#64748b'
                        }}>
                          {a.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => { setSelectedAsset(a); setTransferForm({ to_user_name: '', to_location: a.location || '', to_department: a.department || '', reason: '' }); setTransferModal(true); }}
                            className="btn btn-neutral btn-sm"
                            title="Assign or Transfer Asset"
                          >
                            🔄 Transfer
                          </button>
                          <button
                            onClick={() => { setSelectedAsset(a); setMaintForm({ title: '', description: '', cost: '', vendor_name: a.vendor_name || '', performed_by: '' }); setMaintModal(true); }}
                            className="btn btn-neutral btn-sm"
                            title="Log Repair / Maintenance"
                          >
                            🛠️ Repair
                          </button>
                          <button
                            onClick={() => viewAssetHistory(a)}
                            className="btn btn-neutral btn-sm"
                            title="View Lifecycle History"
                          >
                            📜 History
                          </button>
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

      {/* ══ MODAL: REGISTER ASSET ══ */}
      {createModal && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setCreateModal(false)}>
          <div className="modal" style={{ maxWidth: 640, background: darkMode ? '#1e293b' : '#fff' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontWeight: 800 }}>Register New School Asset</h3>
              <button className="modal-close" onClick={() => setCreateModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateAsset}>
              <div className="modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Asset Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Dell Latitude 3420 Laptop"
                      value={createForm.name}
                      onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                      style={inputStyle}
                      required
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Category *</label>
                    <select
                      value={createForm.category}
                      onChange={(e) => setCreateForm({ ...createForm, category: e.target.value })}
                      style={inputStyle}
                    >
                      <option value="LAPTOPS">Laptops</option>
                      <option value="DESKTOPS">Desktops</option>
                      <option value="PROJECTORS">Projectors</option>
                      <option value="PRINTERS">Printers</option>
                      <option value="CCTV">CCTV</option>
                      <option value="FURNITURE">Furniture</option>
                      <option value="LAB_EQUIPMENT">Lab Equipment</option>
                      <option value="AIR_CONDITIONERS">Air Conditioners</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Serial Number</label>
                    <input
                      type="text"
                      placeholder="e.g. SN-88392-DL"
                      value={createForm.serial_number}
                      onChange={(e) => setCreateForm({ ...createForm, serial_number: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Brand / Manufacturer</label>
                    <input
                      type="text"
                      placeholder="e.g. Dell / HP / Epson"
                      value={createForm.brand}
                      onChange={(e) => setCreateForm({ ...createForm, brand: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Purchase Cost (₹)</label>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={createForm.purchase_cost}
                      onChange={(e) => setCreateForm({ ...createForm, purchase_cost: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Purchase Date</label>
                    <input
                      type="date"
                      value={createForm.purchase_date}
                      onChange={(e) => setCreateForm({ ...createForm, purchase_date: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Warranty Start Date</label>
                    <input
                      type="date"
                      value={createForm.warranty_start}
                      onChange={(e) => setCreateForm({ ...createForm, warranty_start: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Warranty End Date</label>
                    <input
                      type="date"
                      value={createForm.warranty_end}
                      onChange={(e) => setCreateForm({ ...createForm, warranty_end: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Storage Location</label>
                    <input
                      type="text"
                      placeholder="e.g. Room 102, Server Room, Main Store"
                      value={createForm.location}
                      onChange={(e) => setCreateForm({ ...createForm, location: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Department</label>
                    <select
                      value={createForm.department}
                      onChange={(e) => setCreateForm({ ...createForm, department: e.target.value })}
                      style={inputStyle}
                    >
                      <option value="ADMIN">Admin</option>
                      <option value="ACADEMIC">Academic</option>
                      <option value="SCIENCE">Science Lab</option>
                      <option value="COMPUTER">Computer Lab</option>
                      <option value="LIBRARY">Library</option>
                      <option value="HOSTEL">Hostel</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="modal-footer" style={{ borderTop: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, padding: '14px 20px' }}>
                <button type="button" className="btn btn-neutral" onClick={() => setCreateModal(false)}>Cancel</button>
                <button type="submit" disabled={submitting} className="btn btn-primary">
                  {submitting ? 'Registering...' : 'Register Asset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══ MODAL: TRANSFER / ASSIGN ASSET ══ */}
      {transferModal && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setTransferModal(false)}>
          <div className="modal" style={{ maxWidth: 500, background: darkMode ? '#1e293b' : '#fff' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontWeight: 800 }}>Transfer Asset: {selectedAsset?.asset_tag}</h3>
              <button className="modal-close" onClick={() => setTransferModal(false)}>✕</button>
            </div>
            <form onSubmit={handleTransferAsset}>
              <div className="modal-body">
                <div style={{ background: darkMode ? '#0f172a' : '#f8fafc', padding: 10, borderRadius: 8, marginBottom: 12, fontSize: 12 }}>
                  <div><strong>Asset:</strong> {selectedAsset?.name}</div>
                  <div><strong>Currently with:</strong> {selectedAsset?.assigned_to_name || 'Unassigned'} ({selectedAsset?.location})</div>
                </div>

                <label style={labelStyle}>Assign to Teacher / Staff Name</label>
                <input
                  type="text"
                  placeholder="e.g. Teacher Rahul Sharma"
                  value={transferForm.to_user_name}
                  onChange={(e) => setTransferForm({ ...transferForm, to_user_name: e.target.value })}
                  style={inputStyle}
                />

                <label style={labelStyle}>New Physical Location</label>
                <input
                  type="text"
                  placeholder="e.g. Physics Lab, Staff Room 2"
                  value={transferForm.to_location}
                  onChange={(e) => setTransferForm({ ...transferForm, to_location: e.target.value })}
                  style={inputStyle}
                  required
                />

                <label style={labelStyle}>Department</label>
                <select
                  value={transferForm.to_department}
                  onChange={(e) => setTransferForm({ ...transferForm, to_department: e.target.value })}
                  style={inputStyle}
                >
                  <option value="ACADEMIC">Academic</option>
                  <option value="ADMIN">Admin</option>
                  <option value="SCIENCE">Science Lab</option>
                  <option value="COMPUTER">Computer Lab</option>
                  <option value="LIBRARY">Library</option>
                </select>

                <label style={labelStyle}>Reason for Transfer *</label>
                <input
                  type="text"
                  placeholder="e.g. Assigned for Class 10 teaching"
                  value={transferForm.reason}
                  onChange={(e) => setTransferForm({ ...transferForm, reason: e.target.value })}
                  style={inputStyle}
                  required
                />
              </div>

              <div className="modal-footer" style={{ borderTop: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, padding: '14px 20px' }}>
                <button type="button" className="btn btn-neutral" onClick={() => setTransferModal(false)}>Cancel</button>
                <button type="submit" disabled={submitting} className="btn btn-primary">
                  {submitting ? 'Transferring...' : 'Confirm Transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══ MODAL: LOG MAINTENANCE ══ */}
      {maintModal && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setMaintModal(false)}>
          <div className="modal" style={{ maxWidth: 500, background: darkMode ? '#1e293b' : '#fff' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontWeight: 800 }}>Log Asset Maintenance</h3>
              <button className="modal-close" onClick={() => setMaintModal(false)}>✕</button>
            </div>
            <form onSubmit={handleRecordMaint}>
              <div className="modal-body">
                <div style={{
                  background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8,
                  padding: '10px 14px', fontSize: 12, color: '#166534', marginBottom: 14
                }}>
                  💰 <strong>Finance Synchronized</strong>: Any repair cost entered below will automatically post an approved Expense record in Central Finance under "Maintenance".
                </div>

                <label style={labelStyle}>Maintenance Title *</label>
                <input
                  type="text"
                  placeholder="e.g. Projector Lamp Replacement / OS Reinstall"
                  value={maintForm.title}
                  onChange={(e) => setMaintForm({ ...maintForm, title: e.target.value })}
                  style={inputStyle}
                  required
                />

                <label style={labelStyle}>Repair Details</label>
                <textarea
                  placeholder="Diagnostic details and parts replaced"
                  value={maintForm.description}
                  onChange={(e) => setMaintForm({ ...maintForm, description: e.target.value })}
                  style={{ ...inputStyle, height: 70 }}
                />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Repair Cost (₹)</label>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={maintForm.cost}
                      onChange={(e) => setMaintForm({ ...maintForm, cost: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Technician / Vendor</label>
                    <input
                      type="text"
                      placeholder="e.g. Suresh IT Services"
                      value={maintForm.vendor_name}
                      onChange={(e) => setMaintForm({ ...maintForm, vendor_name: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer" style={{ borderTop: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, padding: '14px 20px' }}>
                <button type="button" className="btn btn-neutral" onClick={() => setMaintModal(false)}>Cancel</button>
                <button type="submit" disabled={submitting} className="btn btn-primary">
                  {submitting ? 'Recording...' : 'Record Repair & Post Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══ MODAL: ASSET LIFECYCLE HISTORY ══ */}
      {historyModal && assetDetail && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setHistoryModal(false)}>
          <div className="modal" style={{ maxWidth: 650, background: darkMode ? '#1e293b' : '#fff' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontWeight: 800 }}>Lifecycle History: {assetDetail.name} ({assetDetail.asset_tag})</h3>
              <button className="modal-close" onClick={() => setHistoryModal(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ maxHeight: 450, overflowY: 'auto' }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 800 }}>Assignment &amp; Transfer Trail</h4>
              {assetDetail.assignments?.length === 0 ? (
                <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>No assignments logged yet.</div>
              ) : (
                <div style={{ marginBottom: 18 }}>
                  {assetDetail.assignments.map((h, i) => (
                    <div key={i} style={{ borderLeft: '2px solid #4f46e5', paddingLeft: 10, marginBottom: 8, fontSize: 12 }}>
                      <div style={{ fontWeight: 700 }}>{h.transfer_date}: {h.from_user_name} ➔ {h.to_user_name}</div>
                      <div style={{ color: '#64748b' }}>Location: {h.to_location} &bull; Reason: {h.reason}</div>
                    </div>
                  ))}
                </div>
              )}

              <h4 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 800 }}>Maintenance &amp; Repairs</h4>
              {assetDetail.maintenance_records?.length === 0 ? (
                <div style={{ fontSize: 12, color: '#94a3b8' }}>No repairs logged.</div>
              ) : (
                <div>
                  {assetDetail.maintenance_records.map((m, i) => (
                    <div key={i} style={{ background: darkMode ? '#0f172a' : '#f8fafc', padding: 8, borderRadius: 6, marginBottom: 8, fontSize: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                        <span>{m.title} ({m.maintenance_date})</span>
                        <span style={{ color: '#dc2626' }}>{fmt(m.cost)}</span>
                      </div>
                      <div style={{ color: '#64748b' }}>{m.description} &bull; Tech: {m.vendor_name || m.performed_by || 'School IT'}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer" style={{ borderTop: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, padding: '14px 20px' }}>
              <button type="button" className="btn btn-neutral" onClick={() => setHistoryModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
