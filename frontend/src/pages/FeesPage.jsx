import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar  from '../components/Navbar';
import api     from '../api/axios';
import toast   from 'react-hot-toast';

/* ── small helpers ──────────────────────────────────────────────────────── */
const fmt  = n => Number(n ?? 0).toLocaleString('en-IN');
const MODES = ['CASH', 'UPI', 'ONLINE', 'CHEQUE'];
const STATUS_OPTS = ['', 'PENDING', 'PAID', 'PARTIAL', 'OVERDUE'];

function Badge({ status }) {
  const map = {
    PAID:    { bg: '#eaf5ea', color: '#2e844a' },
    PARTIAL: { bg: '#fef5e4', color: '#dd7a01' },
    OVERDUE: { bg: '#fef1ee', color: '#ba0517' },
    PENDING: { bg: '#f3f0ff', color: '#5867e8' },
  };
  const s = map[status] || { bg: '#f1f1f1', color: '#666' };
  return (
    <span style={{
      background: s.bg, color: s.color,
      padding: '3px 10px', borderRadius: 100,
      fontSize: 11, fontWeight: 700,
    }}>{status}</span>
  );
}

/* ── main component ─────────────────────────────────────────────────────── */
export default function FeesPage() {
  const [summary,  setSummary]  = useState(null);
  const [records,  setRecords]  = useState([]);
  const [classes,  setClasses]  = useState([]);
  const [search,   setSearch]   = useState('');
  const [filterStatus,  setFilterStatus]  = useState('');
  const [filterClass,   setFilterClass]   = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterFeeType, setFilterFeeType] = useState('');
  const [monthlyTrend, setMonthlyTrend] = useState([]);
  const [classSummary, setClassSummary] = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [msg,      setMsg]      = useState({ text: '', type: '' });

  /* collect modal */
  const [modal,    setModal]    = useState(false);
  const [selRec,   setSelRec]   = useState(null);
  const [payAmt,   setPayAmt]   = useState('');
  const [payMode,  setPayMode]  = useState('CASH');
  const [remarks,  setRemarks]  = useState('');
  const [saving,   setSaving]   = useState(false);
  const [genModal, setGenModal] = useState(false);
  const [genClass, setGenClass] = useState('');
  const [genMonth, setGenMonth] = useState('');
  const [genAmount, setGenAmount] = useState('');
  const [genFeeType, setGenFeeType] = useState('TUITION');
  const [genDueDate, setGenDueDate] = useState('');

  /* receipt modal */
  const [receiptRec, setReceiptRec] = useState(null);

  /* ── load data ── */
  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterStatus) params.append('status',   filterStatus);
    if (filterClass)  params.append('class_id', filterClass);
    if (filterMonth) {
      // FeeRecord.month DB mein "YYYY-MM" format mein store hota hai (Generate Fees se seedha aata hai)
      params.append('month', filterMonth);
    }
    if (filterFeeType) params.append('fee_type', filterFeeType);

    Promise.all([
      api.get('/principal/fees/summary'),
      api.get('/principal/fees/records?' + params.toString()),
      api.get('/principal/classes'),
      api.get('/principal/fees/monthly-trend'),
      api.get('/principal/fees/class-summary' + (filterMonth ? `?month=${filterMonth}` : '')),
    ])
      .then(([s, r, c, mt, cs]) => {
        setMonthlyTrend(Array.isArray(mt.data) ? mt.data : []);
        setClassSummary(Array.isArray(cs.data) ? cs.data : []);
  // records — array ya nested object dono handle karo
        const rawR = r.data;
        setRecords(
          Array.isArray(rawR)          ? rawR :
          Array.isArray(rawR?.records) ? rawR.records :
          Array.isArray(rawR?.data)    ? rawR.data : []
        );
      
        // classes — same pattern
        const rawC = c.data;
        setClasses(
          Array.isArray(rawC)          ? rawC :
          Array.isArray(rawC?.classes) ? rawC.classes :
          Array.isArray(rawC?.data)    ? rawC.data : []
        );
      
        // summary — object expected
        setSummary(s.data?.summary ?? s.data ?? null);
      })
      .catch(() => flash('❌ Data load karne mein error aaya', 'error'))
      .finally(() => setLoading(false));
}, [filterStatus, filterClass, filterMonth, filterFeeType]);

  useEffect(() => { load(); }, [load]);

  function flash(text, type = 'success') {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: '', type: '' }), 3500);
    if (type === 'success') toast.success(text.replace(/^✅\s*/, ''));
    else toast.error(text.replace(/^❌\s*/, ''));
  }

  /* ── open collect modal ── */
  function openCollect(rec) {
    setSelRec(rec);
    setPayAmt(String(rec.amount_due - rec.amount_paid));
    setPayMode('CASH');
    setRemarks('');
    setModal(true);
  }

  /* ── submit payment ── */
  async function submitPayment() {
    if (!payAmt || isNaN(payAmt) || Number(payAmt) <= 0) {
      flash('❌ Sahi amount daalo', 'error'); return;
    }
    setSaving(true);
    try {
      const res = await api.post('/principal/fees/collect', {
        record_id:    selRec.id,
        amount_paid:  parseFloat(payAmt),
        payment_mode: payMode,
        remarks,
      });
      setModal(false);
      flash(`✅ Receipt ${res.data.receipt_no} — ₹${fmt(payAmt)} collect hua`);
      load();
      // Show receipt immediately
      setReceiptRec(res.data);
    } catch (e) {
      flash(e.response?.data?.error || '❌ Payment mein error', 'error');
    }
    setSaving(false);
  }
async function generateFees() {
  if (!genClass || !genMonth || !genAmount) {
    flash('❌ Sab fields bharo', 'error');
    return;
  }

  try {
    const res = await api.post('/principal/fees/generate', {
      class_id: genClass,
      month: genMonth,
      fee_type: genFeeType,
      amount: parseFloat(genAmount),
      due_date: genDueDate,
    });

    flash(`✅ ${res.data.created} fee records generate hue`);
    setGenModal(false);

    setGenClass('');
    setGenMonth('');
    setGenAmount('');
    setGenFeeType('TUITION');
    setGenDueDate('');

    load();

  } catch (e) {
    flash(
      e.response?.data?.error || '❌ Fee generate nahi hua',
      'error'
    );
  }
}  
  
  
  
  /* ── filtered records ── */
  const filtered = records.filter(r => {
    const q = search.toLowerCase();
    return !q
      || r.student_name?.toLowerCase().includes(q)
      || r.father_name?.toLowerCase().includes(q)
      || r.receipt_no?.toLowerCase().includes(q)
      || r.fee_type?.toLowerCase().includes(q)
      || r.class_name?.toLowerCase().includes(q);
  });

  const collectionPct = summary
    ? Math.round((summary.total_collected / (summary.total_due || 1)) * 100)
    : 0;

  /* ════════════════════════════════════════════════════════════════════════ */
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar title="Fee Management" />
        <div className="page-body">

          <div className="page-header">
          <div>
            <h2 className="page-title">Fee Management</h2>
            <p className="page-subtitle">
              Student-wise fees collect, track aur report karo
            </p>
          </div>
        
          <button
            className="btn btn-primary"
            onClick={() => setGenModal(true)}
          >
            ➕ Generate Fees
          </button>
        </div>

          {/* alert */}
          {msg.text && (
            <div style={{
              padding: '10px 16px', borderRadius: 8, marginBottom: 16, fontSize: 13,
              background: msg.type === 'error' ? '#fef1ee' : '#eaf5ea',
              color:      msg.type === 'error' ? '#ba0517' : '#2e844a',
              border: `1px solid ${msg.type === 'error' ? '#f9c9c0' : '#a3d9a5'}`,
            }}>{msg.text}</div>
          )}

          {/* ── summary cards ── */}
          <div className="grid-4 mb-6">
            {[
              { icon: '💰', label: 'Total Revenue',  value: `₹${fmt(summary?.total_collected)}`, color: '#2e844a', bg: '#eaf5ea' },
              { icon: '📋', label: 'Total Billed',   value: `₹${fmt(summary?.total_due)}`,       color: '#0176d3', bg: '#e8f4fd' },
              { icon: '⏳', label: 'Pending Count',  value: fmt(summary?.pending_count),          color: '#dd7a01', bg: '#fef5e4' },
              { icon: '⚠️', label: 'Overdue',        value: fmt(summary?.overdue_count),          color: '#ba0517', bg: '#fef1ee' },
            ].map(s => (
              <div className="stat-card" key={s.label}>
                <div className="stat-icon" style={{ background: s.bg }}>
                  <span style={{ fontSize: 20 }}>{s.icon}</span>
                </div>
                <div className="stat-label">{s.label}</div>
                <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* ── month-wise collection cards (FeeTransaction based) ── */}
          <div className="grid-4 mb-6">
            {[
              { icon: '📅', label: "Today's Collection",     value: `₹${fmt(summary?.today_collection)}`,      color: '#2e844a', bg: '#eaf5ea' },
              { icon: '🗓️', label: `${summary?.this_month || 'This Month'} Collection`, value: `₹${fmt(summary?.this_month_collection)}`, color: '#0176d3', bg: '#e8f4fd' },
              { icon: '💵', label: 'Cash Collection',         value: `₹${fmt(summary?.cash_collection)}`,       color: '#dd7a01', bg: '#fef5e4' },
              { icon: '📱', label: 'UPI + Online Collection',  value: `₹${fmt((summary?.upi_collection || 0) + (summary?.online_collection || 0))}`, color: '#5867e8', bg: '#f3f0ff' },
            ].map(s => (
              <div className="stat-card" key={s.label}>
                <div className="stat-icon" style={{ background: s.bg }}>
                  <span style={{ fontSize: 20 }}>{s.icon}</span>
                </div>
                <div className="stat-label">{s.label}</div>
                <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* ── monthly collection trend ── */}
          {monthlyTrend.length > 0 && (
            <div className="card mb-6">
              <div className="card-header"><h4>📊 Monthly Collection Trend</h4></div>
              <div className="card-body" style={{ padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, height: 200, overflowX: 'auto' }}>
                  {monthlyTrend.map(m => {
                    const max = Math.max(...monthlyTrend.map(x => x.expected || 0), 1);
                    const expH = Math.round((m.expected / max) * 150);
                    const colH = Math.round((m.collected / max) * 150);
                    return (
                      <div key={m.month} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 64 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 150 }}>
                          <div title={`Expected ₹${fmt(m.expected)}`} style={{ width: 16, height: expH, background: '#cbd5e1', borderRadius: 3 }} />
                          <div title={`Collected ₹${fmt(m.collected)}`} style={{ width: 16, height: colH, background: '#2e844a', borderRadius: 3 }} />
                        </div>
                        <div style={{ fontSize: 11, marginTop: 6, color: 'var(--neutral-6)' }}>{m.month}</div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: m.collection_pct >= 70 ? '#2e844a' : '#ba0517' }}>{m.collection_pct}%</div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', gap: 16, marginTop: 14, fontSize: 12 }}>
                  <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#cbd5e1', borderRadius: 2, marginRight: 6 }} />Expected</span>
                  <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#2e844a', borderRadius: 2, marginRight: 6 }} />Collected</span>
                </div>
              </div>
            </div>
          )}

          {/* ── class-wise fee due ── */}
          {classSummary.length > 0 && (
            <div className="card mb-6">
              <div className="card-header"><h4>🏛 Class-wise Fee Due</h4></div>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Class</th><th>Students</th><th>Total Due (₹)</th>
                      <th>Collected (₹)</th><th>Pending (₹)</th><th>Collection %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classSummary.map(c => (
                      <tr key={c.class_id}>
                        <td style={{ fontWeight: 600 }}>{c.class_name} - {c.section}</td>
                        <td>{c.student_count}</td>
                        <td>₹{fmt(c.total_due)}</td>
                        <td style={{ color: '#2e844a', fontWeight: 600 }}>₹{fmt(c.total_collected)}</td>
                        <td style={{ color: c.pending > 0 ? '#ba0517' : '#2e844a', fontWeight: 700 }}>
                          {c.pending > 0 ? `₹${fmt(c.pending)}` : '✅ Clear'}
                        </td>
                        <td>{c.collection_pct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── collection rate bar ── */}
          {summary && (
            <div className="card mb-6">
              <div className="card-body" style={{ padding: '16px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Collection Rate</span>
                  <div style={{ display: 'flex', gap: 20, fontSize: 13 }}>
                    <span>Collected: <strong style={{ color: '#2e844a' }}>₹{fmt(summary.total_collected)}</strong></span>
                    <span>Remaining: <strong style={{ color: '#dd7a01' }}>₹{fmt(summary.total_due - summary.total_collected)}</strong></span>
                    <strong style={{ fontSize: 16, color: collectionPct >= 70 ? '#2e844a' : '#ba0517' }}>
                      {collectionPct}%
                    </strong>
                  </div>
                </div>
                <div style={{ height: 10, background: '#f1f1f1', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{
                    width: `${collectionPct}%`, height: '100%', borderRadius: 99,
                    background: collectionPct >= 70 ? '#2e844a' : collectionPct >= 40 ? '#dd7a01' : '#ba0517',
                    transition: 'width 0.6s ease',
                  }} />
                </div>
              </div>
            </div>
          )}

          {/* ── filters + table ── */}
          <div className="card">
            <div className="card-header" style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', flexWrap: 'wrap', gap: 10,
            }}>
              <h4>Fee Records ({filtered.length})</h4>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {/* search */}
                <input
                  className="form-input"
                  placeholder="🔍 Student / Father / Receipt..."
                  style={{ width: 240 }}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
               {/* class filter */}
                <select className="form-select" style={{ width: 150 }}
                  value={filterClass} onChange={e => setFilterClass(e.target.value)}>
                  <option value="">All Classes</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} - {c.section}
                    </option>
                  ))}
                </select>
                
                {/* status filter */}
                <select className="form-select" style={{ width: 140 }}
                  value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                  {STATUS_OPTS.map(s => (
                    <option key={s} value={s}>{s || 'All Status'}</option>
                  ))}
                </select>
                
                {/* fee type filter */}
                <select
                  className="form-select"
                  style={{ width: 150 }}
                  value={filterFeeType}
                  onChange={e => setFilterFeeType(e.target.value)}
                >
                  <option value="">All Types</option>
                  <option value="TUITION">Tuition</option>
                  <option value="EXAM">Exam</option>
                  <option value="TRANSPORT">Transport</option>
                  <option value="HOSTEL">Hostel</option>
                </select>
                
                 {/* month filter */}
                <input
                  type="month"
                  className="form-input"
                  style={{ width: 170 }}
                  value={filterMonth}
                  onChange={e => setFilterMonth(e.target.value)}
                />

              </div>
            </div>

           

            <div className="table-container">
              {loading ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--neutral-5)' }}>
                  Loading...
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Receipt No</th>
                      <th>Student</th>
                      <th>Father</th>
                      <th>Class</th>
                      <th>Fee Type</th>
                      <th>Month</th>
                      <th>Due (₹)</th>
                      <th>Paid (₹)</th>
                      <th>Balance (₹)</th>
                      <th>Mode</th>
                      <th>Due Date</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(r => {
                      const balance = (r.amount_due || 0) - (r.amount_paid || 0);
                      return (
                        <tr key={r.id}>
                          {/* receipt */}
                          <td style={{ fontSize: 11, color: 'var(--neutral-6)', fontFamily: 'monospace' }}>
                            {r.receipt_no || <span style={{ color: '#ccc' }}>—</span>}
                          </td>

                          {/* student */}
                          <td>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>
                              {r.student_name || '—'}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--neutral-5)' }}>
                              Roll: {r.roll_number || '—'}
                            </div>
                          </td>

                          {/* father */}
                          <td style={{ fontSize: 13 }}>{r.father_name || '—'}</td>

                          {/* class */}
                          <td>
                            <span style={{
                              background: 'var(--blue-10)', color: 'var(--blue-80)',
                              padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                            }}>{r.class_name || '—'}</span>
                          </td>

                          {/* fee type */}
                          <td style={{ fontWeight: 500, fontSize: 13 }}>{r.fee_type || '—'}</td>

                          {/* month */}
                          <td style={{ fontSize: 12, color: 'var(--neutral-6)' }}>{r.month || '—'}</td>

                          {/* due */}
                          <td style={{ fontWeight: 600 }}>₹{fmt(r.amount_due)}</td>

                          {/* paid */}
                          <td style={{ fontWeight: 600, color: '#2e844a' }}>₹{fmt(r.amount_paid)}</td>

                          {/* balance */}
                          <td style={{
                            fontWeight: 700,
                            color: balance > 0 ? '#ba0517' : '#2e844a',
                          }}>
                            {balance > 0 ? `₹${fmt(balance)}` : '✅ Clear'}
                          </td>

                          {/* payment mode */}
                          <td>
                            {r.payment_mode ? (
                              <span style={{
                                background: '#f3f0ff', color: '#5867e8',
                                padding: '2px 8px', borderRadius: 4,
                                fontSize: 11, fontWeight: 600,
                              }}>{r.payment_mode}</span>
                            ) : <span style={{ color: '#ccc' }}>—</span>}
                          </td>

                          {/* due date */}
                          <td style={{ fontSize: 12, color: 'var(--neutral-6)' }}>
                            {r.due_date || '—'}
                          </td>

                          {/* status */}
                          <td><Badge status={r.status} /></td>

                          {/* actions */}
                          <td>
                            <div style={{ display: 'flex', gap: 6 }}>
                              {r.status !== 'PAID' && (
                                <button
                                  onClick={() => openCollect(r)}
                                  style={{
                                    background: '#eaf5ea', color: '#2e844a',
                                    border: 'none', borderRadius: 4,
                                    padding: '4px 10px', fontSize: 11,
                                    fontWeight: 700, cursor: 'pointer',
                                  }}>
                                  💸 Collect
                                </button>
                              )}
                              {r.receipt_no && (
                                <button
                                  onClick={() => setReceiptRec(r)}
                                  style={{
                                    background: '#e8f4fd', color: '#0176d3',
                                    border: 'none', borderRadius: 4,
                                    padding: '4px 10px', fontSize: 11,
                                    fontWeight: 700, cursor: 'pointer',
                                  }}>
                                  🧾 Receipt
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {!filtered.length && !loading && (
                      <tr>
                        <td colSpan={13}>
                          <div className="empty-state">
                            <div className="empty-state-icon">💰</div>
                            <p>Koi fee record nahi mila</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* ══ COLLECT FEE MODAL ══════════════════════════════════════════════ */}
      {modal && selRec && (
        <div className="modal-backdrop"
          onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal" style={{ width: 460 }}>
            <div className="modal-header">
              <h3>💸 Fee Collect Karo</h3>
              <button className="modal-close" onClick={() => setModal(false)}>✕</button>
            </div>

            <div className="modal-body">
              {/* student info box */}
              <div style={{
                background: '#f8faff', border: '1px solid #dde8f5',
                borderRadius: 10, padding: '14px 16px', marginBottom: 20,
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: 13 }}>
                  {[
                    ['👤 Student',   selRec.student_name],
                    ['👨 Father',    selRec.father_name],
                    ['🏛 Class',     selRec.class_name],
                    ['🔢 Roll No.',  selRec.roll_number],
                    ['📋 Fee Type',  selRec.fee_type],
                    ['📅 Month',     selRec.month],
                  ].map(([label, val]) => (
                    <div key={label}>
                      <div style={{ color: 'var(--neutral-5)', fontSize: 11 }}>{label}</div>
                      <div style={{ fontWeight: 600 }}>{val || '—'}</div>
                    </div>
                  ))}
                </div>

                {/* amount summary */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  marginTop: 14, paddingTop: 12,
                  borderTop: '1px solid #dde8f5', fontSize: 13,
                }}>
                  <span>Total Due: <strong>₹{fmt(selRec.amount_due)}</strong></span>
                  <span>Already Paid: <strong style={{ color: '#2e844a' }}>₹{fmt(selRec.amount_paid)}</strong></span>
                  <span>Balance: <strong style={{ color: '#ba0517' }}>
                    ₹{fmt(selRec.amount_due - selRec.amount_paid)}
                  </strong></span>
                </div>
              </div>

              {/* amount input */}
              <div className="form-group">
                <label className="form-label">Amount to Collect (₹) *</label>
                <input
                  className="form-input"
                  type="number"
                  min="1"
                  max={selRec.amount_due - selRec.amount_paid}
                  value={payAmt}
                  onChange={e => setPayAmt(e.target.value)}
                  placeholder="Amount daalo"
                />
              </div>

              {/* payment mode */}
              <div className="form-group">
                <label className="form-label">Payment Mode *</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {MODES.map(m => (
                    <button key={m}
                      onClick={() => setPayMode(m)}
                      style={{
                        padding: '7px 16px', borderRadius: 6, fontSize: 12,
                        fontWeight: 600, cursor: 'pointer', border: '2px solid',
                        borderColor: payMode === m ? '#0176d3' : '#e2e8f0',
                        background:  payMode === m ? '#e8f4fd' : '#fff',
                        color:       payMode === m ? '#0176d3' : '#64748b',
                        transition:  'all 0.15s',
                      }}>
                      {m === 'CASH' ? '💵' : m === 'UPI' ? '📱' : m === 'ONLINE' ? '🌐' : '📝'} {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* remarks */}
              <div className="form-group">
                <label className="form-label">Remarks (optional)</label>
                <input
                  className="form-input"
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  placeholder="Koi note..."
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-neutral" onClick={() => setModal(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={submitPayment} disabled={saving}>
                {saving ? 'Processing...' : '✅ Confirm & Generate Receipt'}
              </button>
            </div>
          </div>
        </div>
      )}
{genModal && (
  <div
    className="modal-backdrop"
    onClick={e => e.target === e.currentTarget && setGenModal(false)}
  >
    <div className="modal" style={{ width: 420 }}>
      <div className="modal-header">
        <h3>➕ Generate Monthly Fees</h3>
        <button
          className="modal-close"
          onClick={() => setGenModal(false)}
        >
          ✕
        </button>
      </div>

      <div className="modal-body">

        <div className="form-group">
          <label className="form-label">Class *</label>

          <select
            className="form-select"
            value={genClass}
            onChange={e => setGenClass(e.target.value)}
          >
            <option value="">Select Class</option>

            {classes.map(c => (
              <option key={c.id} value={c.id}>
                {c.name} - {c.section}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Month *</label>

          <input
            type="month"
            className="form-input"
            value={genMonth}
            onChange={e => setGenMonth(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Fee Type *</label>

          <select
            className="form-select"
            value={genFeeType}
            onChange={e => setGenFeeType(e.target.value)}
          >
            <option value="TUITION">Tuition</option>
            <option value="EXAM">Exam</option>
            <option value="TRANSPORT">Transport</option>
            <option value="HOSTEL">Hostel</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Amount *</label>

          <input
            type="number"
            className="form-input"
            placeholder="500"
            value={genAmount}
            onChange={e => setGenAmount(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Due Date</label>

          <input
            type="date"
            className="form-input"
            value={genDueDate}
            onChange={e => setGenDueDate(e.target.value)}
          />
        </div>

      </div>

      <div className="modal-footer">
        <button
          className="btn btn-neutral"
          onClick={() => setGenModal(false)}
        >
          Cancel
        </button>

        <button
          className="btn btn-primary"
          onClick={generateFees}
        >
          ✅ Generate
        </button>
      </div>
    </div>
  </div>
)}
      {/* ══ RECEIPT MODAL ══════════════════════════════════════════════════ */}
      {receiptRec && (
        <div className="modal-backdrop"
          onClick={e => e.target === e.currentTarget && setReceiptRec(null)}>
          <div className="modal" style={{ width: 420 }}>
            <div className="modal-header">
              <h3>🧾 Fee Receipt</h3>
              <button className="modal-close" onClick={() => setReceiptRec(null)}>✕</button>
            </div>
            <div className="modal-body">
              {/* receipt design */}
              <div id="receipt-print" style={{
                border: '2px solid #0176d3', borderRadius: 12,
                padding: 20, fontFamily: 'monospace',
              }}>
                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#0176d3' }}>
                    🏫 EduERP School
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>Fee Receipt</div>
                  <div style={{
                    fontSize: 11, background: '#e8f4fd', color: '#0176d3',
                    padding: '4px 12px', borderRadius: 100, display: 'inline-block',
                    marginTop: 6, fontWeight: 700,
                  }}>
                    {receiptRec.receipt_no}
                  </div>
                </div>

                <div style={{ borderTop: '1px dashed #cbd5e1', margin: '12px 0' }} />

                {[
                  ['Student',      receiptRec.student_name],
                  ['Father',       receiptRec.father_name],
                  ['Class',        receiptRec.class_name],
                  ['Roll No.',     receiptRec.roll_number],
                  ['Fee Type',     receiptRec.fee_type],
                  ['Month',        receiptRec.month],
                  ['Amount Paid',  `₹${fmt(receiptRec.amount_paid)}`],
                  ['Payment Mode', receiptRec.payment_mode],
                  ['Paid Date',    receiptRec.paid_date || new Date().toLocaleDateString('en-IN')],
                  ['Status',       receiptRec.status],
                ].map(([label, val]) => (
                  <div key={label} style={{
                    display: 'flex', justifyContent: 'space-between',
                    fontSize: 12, marginBottom: 8,
                  }}>
                    <span style={{ color: '#64748b' }}>{label}</span>
                    <strong style={{
                      color: label === 'Amount Paid' ? '#2e844a'
                           : label === 'Status'      ? '#0176d3' : '#0f172a',
                    }}>{val || '—'}</strong>
                  </div>
                ))}

                <div style={{ borderTop: '1px dashed #cbd5e1', margin: '12px 0' }} />
                <div style={{ textAlign: 'center', fontSize: 11, color: '#94a3b8' }}>
                  Dhanyawaad! 🙏 EduERP School Management
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-neutral" onClick={() => setReceiptRec(null)}>
                Close
              </button>
              <button className="btn btn-primary" onClick={() => window.print()}>
                🖨️ Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
