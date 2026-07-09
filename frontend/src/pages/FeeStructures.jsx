import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar  from '../components/Navbar';
import api     from '../api/axios';
import toast   from 'react-hot-toast';

const FEE_TYPES = ['TUITION', 'EXAM', 'ADMISSION', 'SPORTS', 'UNIFORM', 'BOOKS', 'OTHER'];
const EMPTY_FORM = { class_id: '', fee_type: 'TUITION', amount: '', frequency: 'MONTHLY', due_date_day: 10 };
const fmt = n => Number(n ?? 0).toLocaleString('en-IN');

function StatusPill({ status }) {
  const map = {
    DRAFT:     { bg: '#f3f0ff', color: '#5867e8' },
    PAID:      { bg: '#eaf5ea', color: '#2e844a' },
    PARTIAL:   { bg: '#fef5e4', color: '#dd7a01' },
    PENDING:   { bg: '#e8f4fd', color: '#0176d3' },
    OVERDUE:   { bg: '#fef1ee', color: '#ba0517' },
    CANCELLED: { bg: '#f1f1f1', color: '#666' },
  };
  const s = map[status] || { bg: '#f1f1f1', color: '#666' };
  return (
    <span style={{ background: s.bg, color: s.color, padding: '2px 9px', borderRadius: 100, fontSize: 10, fontWeight: 700 }}>
      {status}
    </span>
  );
}

export default function FeeStructures() {
  const [activeTab, setActiveTab] = useState('rates'); // 'rates' | 'adjustments'

  /* ── Rate Card state ── */
  const [classes, setClasses]   = useState([]);
  const [classFilter, setClassFilter] = useState('');
  const [structures, setStructures] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving]     = useState(false);

  /* ── Adjustments state ── */
  const [adjClassFilter, setAdjClassFilter] = useState('');
  const [adjSearch, setAdjSearch] = useState('');
  const [adjStudents, setAdjStudents] = useState([]);
  const [selStudent, setSelStudent] = useState(null);
  const [studentRecords, setStudentRecords] = useState([]);
  const [adjustModal, setAdjustModal] = useState(null); // { record, type: 'FINE'|'DISCOUNT' }
  const [adjAmount, setAdjAmount] = useState('');
  const [adjReason, setAdjReason] = useState('');
  const [adjSaving, setAdjSaving] = useState(false);

  /* ── Rate Card effects ── */
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

  /* ── Adjustments logic ── */
  const searchStudents = useCallback(() => {
    const params = new URLSearchParams();
    if (adjClassFilter) params.append('class_id', adjClassFilter);
    if (adjSearch) params.append('q', adjSearch);
    api.get('/principal/fees/student-search?' + params.toString())
      .then(r => setAdjStudents(r.data || []))
      .catch(() => setAdjStudents([]));
  }, [adjClassFilter, adjSearch]);

  useEffect(() => {
    if (activeTab === 'adjustments') searchStudents();
  }, [activeTab, searchStudents]);

  async function selectStudent(s) {
    setSelStudent(s);
    try {
      const { data } = await api.get(`/principal/fees/student-records/${s.id}`);
      setStudentRecords(data.records || []);
    } catch {
      toast.error('Records load nahi hue');
    }
  }

  function openAdjust(record, type) {
    setAdjustModal({ record, type });
    setAdjAmount('');
    setAdjReason('');
  }

  async function submitAdjustment() {
    if (!adjAmount || isNaN(adjAmount) || Number(adjAmount) <= 0) {
      toast.error('Sahi amount daalo');
      return;
    }
    if (!adjReason.trim()) {
      toast.error('Reason zaroori hai');
      return;
    }
    setAdjSaving(true);
    try {
      await api.post(`/principal/fees/records/${adjustModal.record.id}/adjust`, {
        type: adjustModal.type, amount: parseFloat(adjAmount), reason: adjReason.trim(),
      });
      toast.success(adjustModal.type === 'FINE' ? 'Fine lag gaya' : 'Waiver apply ho gaya');
      setAdjustModal(null);
      selectStudent(selStudent);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Save nahi hua');
    }
    setAdjSaving(false);
  }

  async function removeAdjustment(record, field) {
    if (!window.confirm(`${field === 'fine' ? 'Fine' : 'Waiver'} remove karna hai?`)) return;
    try {
      await api.delete(`/principal/fees/records/${record.id}/adjust/${field}`);
      toast.success('Removed');
      selectStudent(selStudent);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Remove fail hua');
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
              <h2 className="page-title">Fees — Structures &amp; Adjustments</h2>
              <p className="page-subtitle">
                {activeTab === 'rates'
                  ? 'Class-wise rate card — Generate Fees isi se amount uthata hai'
                  : 'Fine lagao ya fees maaf karo — kisi bhi student ke kisi bhi record pe'}
              </p>
            </div>
            {activeTab === 'rates' && (
              <button className="btn btn-primary" onClick={openCreate}>+ Fee Structure</button>
            )}
          </div>

          {/* ── Tabs ── */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid #e2e8f0' }}>
            <button
              onClick={() => setActiveTab('rates')}
              style={{
                padding: '10px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                border: 'none', background: 'none',
                color: activeTab === 'rates' ? '#0176d3' : '#64748b',
                borderBottom: activeTab === 'rates' ? '2px solid #0176d3' : '2px solid transparent',
              }}
            >
              📋 Rate Card
            </button>
            <button
              onClick={() => setActiveTab('adjustments')}
              style={{
                padding: '10px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                border: 'none', background: 'none',
                color: activeTab === 'adjustments' ? '#0176d3' : '#64748b',
                borderBottom: activeTab === 'adjustments' ? '2px solid #0176d3' : '2px solid transparent',
              }}
            >
              ⚖️ Adjustments
            </button>
          </div>

          {/* ══════════════ RATE CARD TAB ══════════════ */}
          {activeTab === 'rates' && (
            <>
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
                        <tr>
                          <th>Class</th><th>Fee Type</th><th>Amount</th><th>Frequency</th>
                          <th>Due Day</th><th>Status</th><th>Actions</th>
                        </tr>
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
            </>
          )}

          {/* ══════════════ ADJUSTMENTS TAB ══════════════ */}
          {activeTab === 'adjustments' && (
            <div style={{ display: 'grid', gridTemplateColumns: selStudent ? '320px 1fr' : '1fr', gap: 16 }}>

              {/* ── Left: search panel ── */}
              <div className="card">
                <div className="card-body" style={{ padding: 16 }}>
                  <select className="form-select" style={{ width: '100%', marginBottom: 8 }}
                    value={adjClassFilter} onChange={e => setAdjClassFilter(e.target.value)}>
                    <option value="">All Classes</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name} - {c.section}</option>)}
                  </select>
                  <input className="form-input" style={{ width: '100%', marginBottom: 10, boxSizing: 'border-box' }}
                    placeholder="🔍 Naam / Roll No / Admission No..."
                    value={adjSearch}
                    onChange={e => setAdjSearch(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && searchStudents()} />
                  <button onClick={searchStudents}
                    style={{ width: '100%', background: '#0176d3', color: '#fff', border: 'none', borderRadius: 6, padding: '8px', fontSize: 12, fontWeight: 700, cursor: 'pointer', marginBottom: 12 }}>
                    Search
                  </button>

                  <div style={{ maxHeight: 420, overflowY: 'auto' }}>
                    {adjStudents.map(s => (
                      <div key={s.id} onClick={() => selectStudent(s)}
                        style={{
                          padding: '8px 10px', borderRadius: 6, cursor: 'pointer', marginBottom: 4,
                          background: selStudent?.id === s.id ? '#e8f4fd' : 'transparent',
                          border: '1px solid ' + (selStudent?.id === s.id ? '#0176d3' : '#f1f1f1'),
                        }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>{s.class_name} · Roll {s.roll_number}</div>
                      </div>
                    ))}
                    {!adjStudents.length && (
                      <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 12, padding: 20 }}>
                        Class select karo ya search karo
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Right: student's fee records ── */}
              {selStudent && (
                <div className="card">
                  <div className="card-header">
                    <h4>{selStudent.name} — {selStudent.class_name}</h4>
                    <span style={{ fontSize: 11, color: '#64748b' }}>Roll {selStudent.roll_number}</span>
                  </div>
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>Fee Type</th><th>Month</th><th>Amount Due</th>
                          <th>Fine</th><th>Discount</th><th>Effective</th>
                          <th>Paid</th><th>Status</th><th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {studentRecords.map(r => (
                          <tr key={r.id}>
                            <td style={{ fontWeight: 600 }}>{r.fee_type}</td>
                            <td>{r.month}</td>
                            <td>₹{fmt(r.amount_due)}</td>
                            <td>
                              {r.fine > 0 ? (
                                <span title={r.fine_reason} style={{ color: '#ba0517', fontWeight: 700, cursor: 'help' }}>
                                  +₹{fmt(r.fine)}
                                  <button onClick={() => removeAdjustment(r, 'fine')}
                                    style={{ marginLeft: 4, fontSize: 10, background: 'none', border: 'none', color: '#ba0517', cursor: 'pointer' }}>✕</button>
                                </span>
                              ) : '—'}
                            </td>
                            <td>
                              {r.discount > 0 ? (
                                <span title={r.discount_reason} style={{ color: '#2e844a', fontWeight: 700, cursor: 'help' }}>
                                  -₹{fmt(r.discount)}
                                  <button onClick={() => removeAdjustment(r, 'discount')}
                                    style={{ marginLeft: 4, fontSize: 10, background: 'none', border: 'none', color: '#2e844a', cursor: 'pointer' }}>✕</button>
                                </span>
                              ) : '—'}
                            </td>
                            <td style={{ fontWeight: 700 }}>₹{fmt(r.effective_due)}</td>
                            <td style={{ color: '#2e844a' }}>₹{fmt(r.amount_paid)}</td>
                            <td><StatusPill status={r.status} /></td>
                            <td>
                              {!['CANCELLED', 'REFUNDED'].includes(r.status) && (
                                <div style={{ display: 'flex', gap: 4 }}>
                                  <button onClick={() => openAdjust(r, 'FINE')}
                                    style={{ fontSize: 10, background: '#fef1ee', color: '#ba0517', border: 'none', borderRadius: 4, padding: '4px 8px', cursor: 'pointer', fontWeight: 700 }}>
                                    + Fine
                                  </button>
                                  <button onClick={() => openAdjust(r, 'DISCOUNT')}
                                    style={{ fontSize: 10, background: '#eaf5ea', color: '#2e844a', border: 'none', borderRadius: 4, padding: '4px 8px', cursor: 'pointer', fontWeight: 700 }}>
                                    Maaf Karo
                                  </button>
                                </div>
                              )}
                              {r.status === 'DRAFT' && (
                                <div style={{ fontSize: 10, color: '#5867e8', marginTop: 4 }}>
                                  ⚠️ Abhi Draft hai — Fees → Batches se publish karo
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                        {!studentRecords.length && (
                          <tr><td colSpan={9}><div className="empty-state"><p>Is student ka koi fee record nahi hai</p></div></td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* ══════════════ RATE CARD CREATE/EDIT MODAL ══════════════ */}
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

      {/* ══════════════ ADJUSTMENT (FINE/WAIVER) MODAL ══════════════ */}
      {adjustModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setAdjustModal(null)}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h3>{adjustModal.type === 'FINE' ? '⚠️ Fine Lagao' : '✅ Fees Maaf Karo'}</h3>
              <button className="modal-close" onClick={() => setAdjustModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
                {adjustModal.record.fee_type} — {adjustModal.record.month} — Current Effective: ₹{fmt(adjustModal.record.effective_due)}
              </div>
              <label style={labelStyle}>
                {adjustModal.type === 'FINE' ? 'Fine Amount (₹) *' : 'Waiver Amount (₹) *'}
              </label>
              <input type="number" value={adjAmount} onChange={e => setAdjAmount(e.target.value)} style={inputStyle} />
              <label style={labelStyle}>Reason *</label>
              <input
                value={adjReason}
                onChange={e => setAdjReason(e.target.value)}
                placeholder={adjustModal.type === 'FINE' ? 'e.g. Late payment penalty' : 'e.g. Sports scholarship, sibling discount'}
                style={inputStyle}
              />
            </div>
            <div className="modal-footer">
              <button className="btn btn-neutral" onClick={() => setAdjustModal(null)}>Cancel</button>
              <button
                onClick={submitAdjustment}
                disabled={adjSaving}
                style={{
                  background: adjustModal.type === 'FINE' ? '#ba0517' : '#2e844a',
                  color: '#fff', border: 'none', borderRadius: 6, padding: '8px 20px',
                  fontSize: 13, fontWeight: 700, cursor: adjSaving ? 'not-allowed' : 'pointer',
                }}
              >
                {adjSaving ? 'Saving...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
