import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api     from '../../api/axios';
import toast   from 'react-hot-toast';

export default function HostelInventory() {
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('ederp_theme') === 'dark');
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
      setHostels(res.data);
      if (res.data.length > 0) {
        setSelectedHostel(res.data[0].id);
      }
    });
  }, []);

  const fetchInventory = async () => {
    if (!selectedHostel) return;
    try {
      setLoading(true);
      const res = await api.get('/hostel/inventory', { params: { hostel_id: selectedHostel } });
      setItems(res.data);
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
    if (!window.confirm('Delete this asset entry?')) return;
    try {
      await api.delete(`/hostel/inventory/${itemId}`);
      toast.success('Asset deleted');
      fetchInventory();
    } catch (err) {
      toast.error('Delete failed');
    }
  };

  return (
    <div className={`app-shell${darkMode ? ' theme-dark' : ''}`}>
      <Sidebar darkMode={darkMode} />
      <div className="main-content">
        <Navbar title="Room Assets &amp; Inventory Tracker" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />

        <div className="page-body">
          {/* Header */}
          <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
            <div>
              <h2 className="fw-bold mb-1" style={{ color: darkMode ? '#f8fafc' : '#1e293b' }}>Hostel Inventory &amp; Assets</h2>
              <p className="text-muted mb-0">Track furniture, electrical equipment, mattresses, cupboards, and asset conditions.</p>
            </div>
            <button
              className="btn btn-primary d-flex align-items-center gap-2"
              onClick={() => setAddModal(true)}
              style={{ borderRadius: '10px', padding: '10px 18px', fontWeight: 600 }}
            >
              <i className="ti ti-plus fs-5"></i>
              Add New Asset
            </button>
          </div>

          {/* Controls Bar */}
          <div className="card border-0 shadow-sm p-3 mb-4" style={{ borderRadius: '16px', background: darkMode ? '#1e293b' : '#ffffff' }}>
            <div className="d-flex align-items-center gap-3">
              <label className="form-label mb-0 fw-semibold text-muted small">SELECT HOSTEL:</label>
              <select
                className="form-select"
                style={{ maxWidth: '280px' }}
                value={selectedHostel}
                onChange={(e) => setSelectedHostel(e.target.value)}
              >
                {hostels.map((h) => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="card border-0 shadow-sm" style={{ borderRadius: '16px', background: darkMode ? '#1e293b' : '#ffffff', overflow: 'hidden' }}>
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead style={{ background: darkMode ? '#0f172a' : '#f8fafc', color: darkMode ? '#cbd5e1' : '#64748b' }}>
                  <tr>
                    <th className="py-3 px-4">Asset Name &amp; Code</th>
                    <th className="py-3">Category</th>
                    <th className="py-3 text-center">Quantity</th>
                    <th className="py-3">Room / Assigned Resident</th>
                    <th className="py-3 text-center">Condition</th>
                    <th className="py-3">Remarks</th>
                    <th className="py-3 text-end px-4">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="7" className="text-center py-5 text-muted">
                        <div className="spinner-border spinner-border-sm me-2 text-primary" role="status"></div>
                        Loading inventory...
                      </td>
                    </tr>
                  ) : items.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center py-5 text-muted">
                        No asset records found in this hostel.
                      </td>
                    </tr>
                  ) : (
                    items.map((i) => (
                      <tr key={i.id}>
                        <td className="px-4">
                          <div className="fw-bold" style={{ color: darkMode ? '#f8fafc' : '#0f172a' }}>{i.item_name}</div>
                          {i.item_code && <small className="text-muted font-monospace">{i.item_code}</small>}
                        </td>
                        <td>
                          <span className="badge bg-light text-dark border px-2 py-1">{i.category}</span>
                        </td>
                        <td className="text-center fw-bold">{i.quantity}</td>
                        <td>
                          {i.room_number ? (
                            <div>Room {i.room_number}</div>
                          ) : (
                            <span className="text-muted small">Hostel General</span>
                          )}
                          {i.assigned_student_name && <small className="text-primary d-block">{i.assigned_student_name}</small>}
                        </td>
                        <td className="text-center">
                          <select
                            className={`form-select form-select-sm fw-semibold ${
                              i.condition === 'GOOD' ? 'text-success border-success-subtle' :
                              i.condition === 'DAMAGED' ? 'text-danger border-danger-subtle' :
                              i.condition === 'LOST' ? 'text-dark border-secondary' : 'text-warning'
                            }`}
                            value={i.condition}
                            onChange={(e) => handleConditionChange(i.id, e.target.value)}
                            style={{ minWidth: '130px' }}
                          >
                            <option value="GOOD">Good Condition</option>
                            <option value="REPAIR_NEEDED">Repair Needed</option>
                            <option value="DAMAGED">Damaged</option>
                            <option value="LOST">Lost</option>
                          </select>
                        </td>
                        <td>
                          <small className="text-muted">{i.remarks || '—'}</small>
                        </td>
                        <td className="text-end px-4">
                          <button
                            className="btn btn-sm btn-outline-danger p-1"
                            onClick={() => handleDeleteItem(i.id)}
                            title="Delete Asset"
                          >
                            <i className="ti ti-trash"></i>
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
        <div className="modal show d-block" tabIndex="-1" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <form onSubmit={handleAddItem} className="modal-content" style={{ borderRadius: '16px', background: darkMode ? '#1e293b' : '#ffffff', color: darkMode ? '#fff' : '#000' }}>
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold">Add Hostel Asset / Inventory</h5>
                <button type="button" className="btn-close" onClick={() => setAddModal(false)}></button>
              </div>
              <div className="modal-body py-3">
                <div className="row g-2 mb-3">
                  <div className="col-md-7">
                    <label className="form-label fw-semibold">Item Name *</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Wooden Study Table / Ceiling Fan"
                      value={itemName}
                      onChange={(e) => setItemName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="col-md-5">
                    <label className="form-label fw-semibold">Asset / Tag Code</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. AST-101-A"
                      value={itemCode}
                      onChange={(e) => setItemCode(e.target.value)}
                    />
                  </div>
                </div>

                <div className="row g-2 mb-3">
                  <div className="col-md-4">
                    <label className="form-label fw-semibold">Category</label>
                    <select
                      className="form-select"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                    >
                      <option value="FURNITURE">Furniture</option>
                      <option value="ELECTRICAL">Electrical</option>
                      <option value="BEDDING">Bedding / Mattress</option>
                      <option value="FIXTURE">Bathroom / Fixture</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-semibold">Quantity</label>
                    <input
                      type="number"
                      min="1"
                      className="form-control"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-semibold">Initial State</label>
                    <select
                      className="form-select"
                      value={condition}
                      onChange={(e) => setCondition(e.target.value)}
                    >
                      <option value="GOOD">Good</option>
                      <option value="REPAIR_NEEDED">Repair Needed</option>
                      <option value="DAMAGED">Damaged</option>
                    </select>
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold">Remarks</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Manufacturer, purchase note or initial condition..."
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer border-0 pt-0">
                <button type="button" className="btn btn-light" onClick={() => setAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary px-4 fw-semibold" disabled={submitting}>
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
