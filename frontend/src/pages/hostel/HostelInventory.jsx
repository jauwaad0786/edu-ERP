import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api     from '../../api/axios';
import toast   from 'react-hot-toast';

export default function HostelInventory() {
  const [darkMode, setDarkMode] = useState(localStorage.getItem('ederp_theme') === 'dark');
  const [loading, setLoading]   = useState(true);
  const [items, setItems]       = useState([]);
  const [hostels, setHostels]   = useState([]);
  const [selectedHostel, setSelectedHostel] = useState('');

  // Modal
  const [addModal, setAddModal]   = useState(false);
  const [itemName, setItemName]   = useState('');
  const [itemCode, setItemCode]   = useState('');
  const [category, setCategory]   = useState('FURNITURE');
  const [quantity, setQuantity]   = useState('1');
  const [condition, setCondition] = useState('GOOD');
  const [remarks, setRemarks]     = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get('/hostel/hostels').then((res) => {
      setHostels(res.data || []);
      if (res.data && res.data.length > 0) {
        setSelectedHostel(res.data[0].id);
      }
    }).catch(() => {});
  }, []);

  const fetchInventory = async () => {
    if (!selectedHostel) return;
    try {
      setLoading(true);
      const res = await api.get('/hostel/inventory', { params: { hostel_id: selectedHostel } });
      setItems(res.data || []);
    } catch (err) {
      toast.error('Failed to load inventory assets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, [selectedHostel]);

  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!itemName.trim()) {
      toast.error('Item name is required');
      return;
    }
    try {
      setSubmitting(true);
      await api.post('/hostel/inventory', {
        hostel_id: selectedHostel,
        item_name: itemName,
        item_code: itemCode,
        category,
        quantity: parseInt(quantity, 10) || 1,
        condition,
        remarks,
      });
      toast.success('Inventory asset added');
      setAddModal(false);
      setItemName('');
      setItemCode('');
      setRemarks('');
      fetchInventory();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add asset');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConditionChange = async (itemId, newCondition) => {
    try {
      await api.patch(`/hostel/inventory/${itemId}`, { condition: newCondition });
      toast.success('Asset condition updated');
      fetchInventory();
    } catch (err) {
      toast.error('Failed to update condition');
    }
  };

  const handleDeleteItem = async (itemId) => {
    if (!window.confirm('Are you sure you want to delete this asset entry?')) return;
    try {
      await api.delete(`/hostel/inventory/${itemId}`);
      toast.success('Asset deleted');
      fetchInventory();
    } catch (err) {
      toast.error('Delete failed');
    }
  };

  const cardStyle = {
    background: darkMode ? '#1e293b' : '#fff',
    border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
    borderRadius: 12, padding: 20,
  };
  const inputStyle = {
    width: '100%', padding: '9px 12px', fontSize: 13,
    border: `1px solid ${darkMode ? '#334155' : '#cbd5e1'}`, borderRadius: 8, outline: 'none', boxSizing: 'border-box',
    background: darkMode ? '#0f172a' : '#ffffff', color: darkMode ? '#ffffff' : '#0f172a',
    marginBottom: 12,
  };
  const labelStyle = { fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4, display: 'block' };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: darkMode ? '#0f172a' : '#f8fafc' }}>
      <Sidebar darkMode={darkMode} />
      <div style={{ marginLeft: 232, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Navbar title="Room Assets &amp; Inventory Tracker" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />

        <div style={{ padding: '24px 28px' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: darkMode ? '#f8fafc' : '#0f172a' }}>
                Hostel Inventory &amp; Room Assets
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
                Track room furniture, electrical fixtures, mattresses, and asset conditions across hostels.
              </p>
            </div>
            <button
              onClick={() => setAddModal(true)}
              style={{
                background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8,
                padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
                boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)'
              }}
            >
              <i className="ti ti-plus" style={{ fontSize: 16 }}></i>
              Add New Asset
            </button>
          </div>

          {/* Controls Bar */}
          <div style={{ ...cardStyle, padding: 14, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
            <label style={{ ...labelStyle, marginBottom: 0, fontSize: 12 }}>SELECT HOSTEL:</label>
            <select
              style={{ ...inputStyle, width: 'auto', minWidth: 240, marginBottom: 0 }}
              value={selectedHostel}
              onChange={(e) => setSelectedHostel(e.target.value)}
            >
              {hostels.map((h) => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
          </div>

          {/* Table Card */}
          <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: darkMode ? '#0f172a' : '#f8fafc', borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, textAlign: 'left' }}>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>ASSET NAME &amp; CODE</th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>CATEGORY</th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 600, fontSize: 11, textAlign: 'center' }}>QUANTITY</th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>LOCATION / ROOM</th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 600, fontSize: 11, textAlign: 'center' }}>CONDITION</th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>REMARKS</th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 600, fontSize: 11, textAlign: 'right' }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
                        Loading assets...
                      </td>
                    </tr>
                  ) : items.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '50px 0', color: '#94a3b8' }}>
                        <i className="ti ti-box" style={{ fontSize: 36, display: 'block', marginBottom: 8, opacity: 0.5 }}></i>
                        No asset records found in this hostel. Click "Add New Asset" to register items.
                      </td>
                    </tr>
                  ) : (
                    items.map((i) => (
                      <tr key={i.id} style={{ borderBottom: `1px solid ${darkMode ? '#334155' : '#f1f5f9'}` }}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 700, color: darkMode ? '#f8fafc' : '#0f172a' }}>{i.item_name}</div>
                          {i.item_code && <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>{i.item_code}</div>}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            background: darkMode ? '#334155' : '#f1f5f9', color: darkMode ? '#cbd5e1' : '#475569',
                            padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600
                          }}>
                            {i.category}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700 }}>
                          {i.quantity}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {i.room_number ? (
                            <div style={{ fontWeight: 600 }}>Room {i.room_number}</div>
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: 12 }}>Hostel General</span>
                          )}
                          {i.assigned_student_name && <div style={{ fontSize: 11, color: '#4f46e5' }}>{i.assigned_student_name}</div>}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <select
                            style={{
                              padding: '5px 10px', fontSize: 12, fontWeight: 600, borderRadius: 6,
                              border: `1px solid ${darkMode ? '#334155' : '#cbd5e1'}`,
                              background: i.condition === 'GOOD' ? (darkMode ? '#064e3b' : '#f0fdf4') :
                                          i.condition === 'DAMAGED' ? (darkMode ? '#7f1d1d' : '#fef2f2') :
                                          i.condition === 'LOST' ? (darkMode ? '#1e293b' : '#f1f5f9') : (darkMode ? '#78350f' : '#fefce8'),
                              color: i.condition === 'GOOD' ? '#16a34a' :
                                     i.condition === 'DAMAGED' ? '#dc2626' :
                                     i.condition === 'LOST' ? '#64748b' : '#d97706',
                              outline: 'none', cursor: 'pointer'
                            }}
                            value={i.condition}
                            onChange={(e) => handleConditionChange(i.id, e.target.value)}
                          >
                            <option value="GOOD">Good Condition</option>
                            <option value="REPAIR_NEEDED">Repair Needed</option>
                            <option value="DAMAGED">Damaged</option>
                            <option value="LOST">Lost</option>
                          </select>
                        </td>
                        <td style={{ padding: '12px 16px', color: '#64748b', fontSize: 12 }}>
                          {i.remarks || '—'}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <button
                            onClick={() => handleDeleteItem(i.id)}
                            style={{
                              background: 'none', border: 'none', color: '#ef4444',
                              cursor: 'pointer', padding: 6, borderRadius: 4
                            }}
                            title="Delete Asset"
                          >
                            <i className="ti ti-trash" style={{ fontSize: 16 }}></i>
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
      </div>

      {/* Add Modal */}
      {addModal && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setAddModal(false)}>
          <div className="modal" style={{ maxWidth: 480, background: darkMode ? '#1e293b' : '#ffffff', color: darkMode ? '#ffffff' : '#0f172a' }}>
            <div className="modal-header" style={{ borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}` }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Add Hostel Asset / Inventory</h3>
              <button className="modal-close" onClick={() => setAddModal(false)}>✕</button>
            </div>
            <form onSubmit={handleAddItem}>
              <div className="modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Item Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Wooden Study Table"
                      value={itemName}
                      onChange={(e) => setItemName(e.target.value)}
                      style={inputStyle}
                      required
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Asset / Tag Code</label>
                    <input
                      type="text"
                      placeholder="e.g. AST-101-A"
                      value={itemCode}
                      onChange={(e) => setItemCode(e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={labelStyle}>Category</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      style={inputStyle}
                    >
                      <option value="FURNITURE">Furniture</option>
                      <option value="ELECTRICAL">Electrical</option>
                      <option value="BEDDING">Bedding</option>
                      <option value="FIXTURE">Fixture</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Quantity</label>
                    <input
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Condition</label>
                    <select
                      value={condition}
                      onChange={(e) => setCondition(e.target.value)}
                      style={inputStyle}
                    >
                      <option value="GOOD">Good</option>
                      <option value="REPAIR_NEEDED">Repair</option>
                      <option value="DAMAGED">Damaged</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Remarks / Notes</label>
                  <textarea
                    rows="3"
                    placeholder="Manufacturer, purchase note or room location..."
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
                  ></textarea>
                </div>
              </div>
              <div className="modal-footer" style={{ borderTop: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}` }}>
                <button type="button" className="btn btn-neutral" onClick={() => setAddModal(false)}>Cancel</button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 6,
                    padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  {submitting ? 'Adding...' : 'Save Asset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
