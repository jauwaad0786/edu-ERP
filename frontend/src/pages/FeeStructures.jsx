// NEW FILE — src/pages/fees/FeeStructures.jsx
import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar  from '../components/Navbar';
import api     from '../api/axios';
import toast   from 'react-hot-toast';

const FEE_TYPES = ['TUITION', 'EXAM', 'ADMISSION', 'SPORTS', 'UNIFORM', 'BOOKS', 'OTHER'];
const EMPTY_FORM = { class_id: '', fee_type: 'TUITION', amount: '', frequency: 'MONTHLY', due_date_day: 10 };

export default function FeeStructures() {
  const [classes, setClasses]   = useState([]);
  const [classFilter, setClassFilter] = useState('');
  const [structures, setStructures] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    api.get('/principal/classes').then(r => setClasses(r.data || []))
      .catch(() => toast.error('Classes load nahi hui'));
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    const params = classFilter ? `?class_id=${classFilter}` : '';
    api.get('/principal/fee-structures' + params)
      .then(r => setStructures(r.data || []))
      .catch(() => toast.error('Fee structures load nahi hui'))
      .finally(() => setLoading(false));
  }, [classFilter]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setForm({ ...EMPTY_FORM, class_id: classFilter });
    setEditingId(null);
    setShowModal(true);
  }

  function openEdit(fs) {
    setForm({
      class_id: fs.class_id || '', fee_type: fs.fee_type,
      amount: fs.amount, frequency: fs.frequency, due_date_day: fs.due_date_day,
    });
    setEditingId(fs.id);
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.fee_type || !form.amount) {
      toast.error('Fee type aur amount zaroori hai');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await api.patch(`/principal/fee-structures/${editingId}`, form);
        toast.success('Fee structure updated');
      } else {
        await api.post('/principal/fee-structures', form);
        toast.success('Fee structure created');
      }
      setShowModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save nahi ho paya');
    }
    setSaving(false);
  }

  async function handleDelete(id) {
    if (!window.confirm('Ye fee structure delete karni hai?')) return;
    try {
      await api.delete(`/principal/fee-structures/${id}`);
      toast.success('Deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Delete fail hua (shayad already use ho chuki hai)');
    }
  }

  const inputStyle = { width: '100%', padding: '9px 12px', fontSize: 13, border: '1px solid #e2e8f0', borderRadius: 8, marginBottom: 10, boxSizing: 'border-box' };
  const labelStyle = { fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4, display: 'block' };

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar title="Fee Structures" />
        <div className="page-body">
          <div className="page-header">
            <div>
              <h2 className="page-title">Fee Structures</h2>
              <p className="page-subtitle">Class-wise fee pricing — yahan se hi Generate Fees amount uthata hai</p>
            </div>
            <button className="btn btn-primary" onClick={openCreate}>+ Fee Structure</button>
          </div>

          <select className="form-select" style={{ width: 220, marginBottom: 16 }}
            value={classFilter} onChange={e => setClassFilter(e.target.value)}>
            <option value="">All Classes</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name} - {c.section}</option>)}
          </select>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Loading...</div>
          ) : (
            <div className="card">
              <div className="table-container">
                <table>
                  <thead>
                    <tr><th>Class</th><th>Fee Type</th><th>Amount</th><th>Frequency</th><th>Due Day</th><th>Status</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {structures.map(fs => (
                      <tr key={fs.id}>
                        <td>{fs.class_name}</td>
                        <td><strong>{fs.fee_type}</strong></td>
                        <td>₹{Number(fs.amount).toLocaleString('en-IN')}</td>
                        <td>{fs.frequency}</td>
                        <td>{fs.due_date_day}</td>
                        <td>
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                            background: fs.status === 'ACTIVE' ? '#f0fdf4' : '#fef2f2',
                            color: fs.status === 'ACTIVE' ? '#16a34a' : '#dc2626',
                          }}>{fs.status}</span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => openEdit(fs)} style={{ background: '#f1f5f9', color: '#334155', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Edit</button>
                            <button onClick={() => handleDelete(fs.id)} style={{ background: '#fef2f2', color: '#dc2626', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!structures.length && (
                      <tr><td colSpan={7}><div className="empty-state"><p>Koi fee structure nahi bani abhi</p></div></td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h3>{editingId ? 'Edit Fee Structure' : 'New Fee Structure'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <label style={labelStyle}>Class *</label>
              <select style={inputStyle} value={form.class_id} disabled={!!editingId}
                onChange={e => setForm({ ...form, class_id: e.target.value })}>
                <option value="">Select Class</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name} - {c.section}</option>)}
              </select>

              <label style={labelStyle}>Fee Type *</label>
              <select style={inputStyle} value={form.fee_type} disabled={!!editingId}
                onChange={e => setForm({ ...form, fee_type: e.target.value })}>
                {FEE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>

              <label style={labelStyle}>Monthly Amount (₹) *</label>
              <input type="number" style={inputStyle} value={form.amount}
                onChange={e => setForm({ ...form, amount: e.target.value })} />

              <label style={labelStyle}>Due Date Day (1-28)</label>
              <input type="number" min="1" max="28" style={inputStyle} value={form.due_date_day}
                onChange={e => setForm({ ...form, due_date_day: e.target.value })} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-neutral" onClick={() => setShowModal(false)}>Cancel</button>
              <button onClick={handleSave} disabled={saving} style={{ background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 20px', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
