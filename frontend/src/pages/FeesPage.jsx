import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
  const [summary,  setSummary]  = useState(null);
  const [records,  setRecords]  = useState([]);
  const [classes,  setClasses]  = useState([]);
  const [search,   setSearch]   = useState('');
  const [filterStatus,  setFilterStatus]  = useState('');
  const [filterClass,   setFilterClass]   = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterFeeType, setFilterFeeType] = useState('');
  const [snapshotMonth, setSnapshotMonth] = useState('');
  const [classSummary, setClassSummary] = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [msg,      setMsg]      = useState({ text: '', type: '' });
  const [batches, setBatches] = useState([]);         // DRAFT — pending review
  const [publishedBatches, setPublishedBatches] = useState([]); // PUBLISHED — reviewed/passed
  const [showBatches, setShowBatches] = useState(false);
  const [reviewTab, setReviewTab] = useState('PENDING');
  const [batchRecords, setBatchRecords] = useState(null);
  const [editingRecId, setEditingRecId] = useState(null);
  const [editAmt, setEditAmt] = useState('');
  const [missingStudents, setMissingStudents] = useState([]);
  const [addStudentId, setAddStudentId] = useState('');

  /* collect modal (single record) */
  const [modal,    setModal]    = useState(false);
  const [selRec,   setSelRec]   = useState(null);
  const [payAmt,   setPayAmt]   = useState('');
  const [payMode,  setPayMode]  = useState('CASH');
  const [remarks,  setRemarks]  = useState('');
  const [saving,   setSaving]   = useState(false);

  /* generate fees modal */
  const [genModal, setGenModal] = useState(false);
  const [genClass, setGenClass] = useState('');
  const [genMonth, setGenMonth] = useState('');
  const [genFeeType, setGenFeeType] = useState('TUITION');
  const [genWindowStart, setGenWindowStart] = useState('');
  const [genWindowEnd, setGenWindowEnd] = useState('');

  /* receipts */
  const [receiptRec, setReceiptRec] = useState(null);      // single collect
  const [receiptGroup, setReceiptGroup] = useState(null);  // multi collect

  /* multi-select combine/separate collection */
  const [selectedIds, setSelectedIds] = useState([]);
  const [multiCollectModal, setMultiCollectModal] = useState(false);
  const [collectMode, setCollectMode] = useState('COMBINED');
  const [multiPayMode, setMultiPayMode] = useState('CASH');
  const [multiRemarks, setMultiRemarks] = useState('');
  const [multiSaving, setMultiSaving] = useState(false);

  /* bulk class notice */
  const [bulkNoticeModal, setBulkNoticeModal] = useState(false);
  const [bulkNoticeClass, setBulkNoticeClass] = useState('');
  const [bulkNoticeMonth, setBulkNoticeMonth] = useState('');

  /* ── load data ── */
  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterStatus) params.append('status',   filterStatus);
    if (filterClass)  params.append('class_id', filterClass);
    if (filterMonth) params.append('month', filterMonth);
    if (filterFeeType) params.append('fee_type', filterFeeType);

    Promise.all([
      api.get('/principal/fees/summary' + (snapshotMonth ? `?month=${snapshotMonth}` : '')),
      api.get('/principal/fees/records?' + params.toString()),
      api.get('/principal/classes'),
      api.get('/principal/fees/class-summary' + (snapshotMonth ? `?month=${snapshotMonth}` : '')),
    ])
      .then(([s, r, c, cs]) => {
        setClassSummary(Array.isArray(cs.data) ? cs.data : []);
        const rawR = r.data;
        setRecords(
          Array.isArray(rawR)          ? rawR :
          Array.isArray(rawR?.records) ? rawR.records :
          Array.isArray(rawR?.data)    ? rawR.data : []
        );
        const rawC = c.data;
        setClasses(
          Array.isArray(rawC)          ? rawC :
          Array.isArray(rawC?.classes) ? rawC.classes :
          Array.isArray(rawC?.data)    ? rawC.data : []
        );
        setSummary(s.data?.summary ?? s.data ?? null);
      })
      .catch(() => flash('❌ Data load karne mein error aaya', 'error'))
      .finally(() => setLoading(false));
  }, [filterStatus, filterClass, filterMonth, filterFeeType, snapshotMonth]);

  useEffect(() => { load(); }, [load]);

  function flash(text, type = 'success') {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: '', type: '' }), 3500);
    if (type === 'success') toast.success(text.replace(/^✅\s*/, ''));
    else toast.error(text.replace(/^❌\s*/, ''));
  }

  /* ── single collect ── */
  function openCollect(rec) {
    setSelRec(rec);
    setPayAmt(String(rec.amount_due - rec.amount_paid));
    setPayMode('CASH');
    setRemarks('');
    setModal(true);
  }

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
      setReceiptRec(res.data);
    } catch (e) {
      flash(e.response?.data?.error || '❌ Payment mein error', 'error');
    }
    setSaving(false);
  }

  /* ── batches ── */
  function loadBatches() {
    api.get('/principal/fees/batches?status=DRAFT')
      .then(r => setBatches(r.data || []))
      .catch(() => {});
    // NEW — reviewed/published count bhi laao, widget mein dono dikhane ke liye
    api.get('/principal/fees/batches?status=PUBLISHED')
      .then(r => setPublishedBatches(r.data || []))
      .catch(() => {});
  }

  useEffect(() => { loadBatches(); }, []);

  async function openBatchReview(batchId) {
    const { data } = await api.get(`/principal/fees/batches/${batchId}/records`);
    setBatchRecords(data);
    loadMissingStudents(batchId);
  }

  async function publishBatch(batchId) {
    if (!window.confirm('Publish karne ke baad parents ko ye fees dikhengi. Confirm?')) return;
    try {
      await api.post(`/principal/fees/batches/${batchId}/publish`);
      flash('✅ Batch published');
      setBatchRecords(null);
      loadBatches();
      load();
    } catch (e) {
      flash(e.response?.data?.error || '❌ Publish fail hua', 'error');
    }
  }

  async function loadMissingStudents(batchId) {
    try {
      const { data } = await api.get(`/principal/fees/batches/${batchId}/missing-students`);
      setMissingStudents(data || []);
    } catch { setMissingStudents([]); }
  }

  async function saveRecordAmount(recId) {
    if (!editAmt || isNaN(editAmt) || Number(editAmt) <= 0) {
      flash('❌ Sahi amount daalo', 'error'); return;
    }
    try {
      await api.patch(`/principal/fees/records/${recId}`, { amount_due: parseFloat(editAmt) });
      flash('✅ Amount updated');
      setEditingRecId(null);
      openBatchReview(batchRecords.batch.id);
    } catch (e) {
      flash(e.response?.data?.error || '❌ Update fail hua', 'error');
    }
  }

  async function addStudentToBatch() {
    if (!addStudentId) return;
    try {
      await api.post(`/principal/fees/batches/${batchRecords.batch.id}/add-student`, {
        student_id: addStudentId,
      });
      flash('✅ Student add hua');
      setAddStudentId('');
      openBatchReview(batchRecords.batch.id);
    } catch (e) {
      flash(e.response?.data?.error || '❌ Add fail hua', 'error');
    }
  }

  async function deleteBatch(batchId) {
    if (!window.confirm('Ye poori draft batch delete karni hai?')) return;
    try {
      await api.delete(`/principal/fees/batches/${batchId}`);
      flash('✅ Draft batch deleted');
      setBatchRecords(null);
      loadBatches();
    } catch (e) {
      flash(e.response?.data?.error || '❌ Delete fail hua', 'error');
    }
  }

  /* ── generate fees ── */
  async function generateFees() {
    if (!genClass || !genMonth || !genFeeType) {
      flash('❌ Class, Month aur Fee Type zaroori hai', 'error');
      return;
    }
    if (genWindowStart && genWindowEnd && genWindowStart > genWindowEnd) {
      flash('❌ Collection start date, end date se pehle honi chahiye', 'error');
      return;
    }
    try {
      const res = await api.post('/principal/fees/generate', {
        class_id: genClass,
        month: genMonth,
        fee_type: genFeeType,
        window_start: genWindowStart || undefined,
        window_end: genWindowEnd || undefined,
      });
      const dueMsg = res.data.window_end ? ` — Due Date: ${res.data.due_date}` : '';
      flash(`✅ ${res.data.created} records DRAFT mein bane${dueMsg} — Batches tab se review + publish karo`);
      setGenModal(false);
      setGenClass('');
      setGenMonth('');
      setGenFeeType('TUITION');
      setGenWindowStart('');
      setGenWindowEnd('');
      load();
    } catch (e) {
      if (e.response?.data?.error === 'no_fee_structure') {
        flash('❌ Is class/fee-type ke liye pehle Fee Structure banao', 'error');
      } else if (e.response?.data?.error === 'already_generated') {
        flash(`❌ ${e.response.data.message}`, 'error');
      } else {
        flash(e.response?.data?.error || '❌ Fee generate nahi hua', 'error');
      }
    }
  }

  /* ── filtered records (defined before multi-select helpers use it) ── */
  const filtered = records.filter(r => {
    const q = search.toLowerCase();
    return !q
      || r.student_name?.toLowerCase().includes(q)
      || r.father_name?.toLowerCase().includes(q)
      || r.receipt_no?.toLowerCase().includes(q)
      || r.fee_type?.toLowerCase().includes(q)
      || r.class_name?.toLowerCase().includes(q);
  });

  /* ── multi-select combine/separate collect ── */
  function toggleSelect(id) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function openMultiCollect() {
    if (selectedIds.length < 2) {
      flash('❌ Kam se kam 2 records select karo combine/separate collect ke liye', 'error');
      return;
    }
    const recs = filtered.filter(r => selectedIds.includes(r.id));
    const firstStudent = recs[0]?.student_id;
    if (recs.some(r => r.student_id !== firstStudent)) {
      flash('❌ Combined payment sirf ek student ke records ke liye ho sakti hai', 'error');
      return;
    }
    setCollectMode('COMBINED');
    setMultiPayMode('CASH');
    setMultiRemarks('');
    setMultiCollectModal(true);
  }

  async function submitMultiPayment() {
    const recs = filtered.filter(r => selectedIds.includes(r.id));
    setMultiSaving(true);
    try {
      const res = await api.post('/principal/fees/collect-multiple', {
        payments: recs.map(r => ({ record_id: r.id, amount: r.amount_due - r.amount_paid })),
        payment_mode: multiPayMode,
        remarks: multiRemarks,
        mode: collectMode,
      });
      setMultiCollectModal(false);
      setSelectedIds([]);
      flash(`✅ ${res.data.receipts.length} receipt(s) generate hui`);
      setReceiptGroup(res.data);
      load();
    } catch (e) {
      flash(e.response?.data?.error || '❌ Payment mein error', 'error');
    }
    setMultiSaving(false);
  }

  /* ── bulk class notice ── */
  async function downloadBulkNotice() {
    if (!bulkNoticeClass) { flash('❌ Class select karo', 'error'); return; }
    const month = bulkNoticeMonth || new Date().toISOString().slice(0, 7);
    try {
      const res = await api.get(
        `/principal/fees/notices/bulk?class_id=${bulkNoticeClass}&month=${month}`,
        { responseType: 'blob' }   // ← axios ab token bhejega, blob PDF wapas aayega
      );
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `FeeNotices_class${bulkNoticeClass}_${month}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setBulkNoticeModal(false);
    } catch (e) {
      flash('❌ PDF download fail hua', 'error');
    }
  }
  // NEW — receipt PDF ko axios ke through fetch karo (blob), taaki auth token bhi jaye
  async function downloadReceipt(receiptNo) {
    if (!receiptNo) {
      flash('❌ Receipt number missing hai', 'error');
      return;
    }
    try {
      const res = await api.get(`/principal/fees/receipt/${receiptNo}/pdf`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      window.open(url, '_blank');
      // Optional cleanup after a delay so the new tab has time to load it
      setTimeout(() => window.URL.revokeObjectURL(url), 10000);
    } catch (e) {
      flash(e.response?.status === 404 ? '❌ Receipt nahi mila' : '❌ PDF download fail hua', 'error');
    }
  }

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
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-neutral" onClick={() => setBulkNoticeModal(true)}>
                📄 Class Notice PDF
              </button>
              <button className="btn btn-primary" onClick={() => setGenModal(true)}>🧾 Generate This Month's Bills</button>
            </div>
          </div>

          {/* ── Draft batches pending banner ── */}
          

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

          {/* ── month-wise collection cards ── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
            <div>
              <h4 style={{ margin: 0 }}>🗓️ Collection Snapshot</h4>
              <span style={{ fontSize: 11, color: 'var(--neutral-6)' }}>Cards + Class-wise Due neeche — dono isi filter se refresh honge</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--neutral-6)' }}>Month/Year:</span>
              <input
                type="month"
                className="form-input"
                style={{ width: 170 }}
                value={snapshotMonth}
                onChange={e => setSnapshotMonth(e.target.value)}
              />
              {snapshotMonth && (
                <button
                  onClick={() => setSnapshotMonth('')}
                  style={{
                    background: '#f1f1f1', border: 'none', borderRadius: 4,
                    padding: '6px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  }}>
                  ✕ Clear
                </button>
              )}
            </div>
          </div>
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

          {/* ── class-wise fee due ── */}
          {classSummary.length > 0 && (
            <div className="card mb-6">
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4>🏛 Class-wise Fee Due</h4>
                <span style={{ fontSize: 11, color: 'var(--neutral-6)' }}>
                  {snapshotMonth
                    ? `Showing: ${new Date(snapshotMonth + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}`
                    : 'Showing: All Time — upar month select karo'}
                </span>
              </div>
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
                        <td
                          style={{ fontWeight: 600, color: '#0176d3', cursor: 'pointer', textDecoration: 'underline dashed' }}
                          title="Is class ke students dekhne ke liye click karein"
                          onClick={() => navigate(`/students?class_id=${c.class_id}`)}
                        >
                          {c.class_name} - {c.section}
                        </td>
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

          {/* ── selected records bar (combine/separate collect) ── */}
          {selectedIds.length > 0 && (
            <div style={{
              background: '#e8f4fd', border: '1px solid #bfdbfe', borderRadius: 8,
              padding: '8px 14px', marginBottom: 10, display: 'flex',
              justifyContent: 'space-between', alignItems: 'center', fontSize: 13,
            }}>
              <span>☑️ {selectedIds.length} record(s) select kiye</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={openMultiCollect}
                  style={{ background: '#0176d3', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  💸 Collect Selected (Combine/Separate)
                </button>
                <button onClick={() => setSelectedIds([])}
                  style={{ background: '#f1f1f1', border: 'none', borderRadius: 6, padding: '5px 14px', fontSize: 12, cursor: 'pointer' }}>
                  ✕ Clear
                </button>
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
                <input
                  className="form-input"
                  placeholder="🔍 Student / Father / Receipt..."
                  style={{ width: 240 }}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                <select className="form-select" style={{ width: 150 }}
                  value={filterClass} onChange={e => setFilterClass(e.target.value)}>
                  <option value="">All Classes</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name} - {c.section}</option>
                  ))}
                </select>
                <select className="form-select" style={{ width: 140 }}
                  value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                  {STATUS_OPTS.map(s => (
                    <option key={s} value={s}>{s || 'All Status'}</option>
                  ))}
                </select>
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
                  <option value="ADMISSION">Admission</option>
                  <option value="LIBRARY">Library</option>
                </select>
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
                      <th style={{ width: 30 }}></th>
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
                      const balance = (r.effective_due ?? r.amount_due ?? 0) - (r.amount_paid || 0);
                      return (
                        <tr key={r.id}>
                          {/* select checkbox — DRAFT/PAID select nahi ho sakte */}
                          <td>
                            {r.status !== 'PAID' && r.status !== 'DRAFT' && (
                              <input type="checkbox"
                                checked={selectedIds.includes(r.id)}
                                onChange={() => toggleSelect(r.id)} />
                            )}
                          </td>

                          <td style={{ fontSize: 11, color: 'var(--neutral-6)', fontFamily: 'monospace' }}>
                            {r.receipt_no || <span style={{ color: '#ccc' }}>—</span>}
                          </td>

                          <td>
                            <div
                              style={{ fontWeight: 600, fontSize: 13, color: '#0176d3', cursor: r.student_id ? 'pointer' : 'default', textDecoration: r.student_id ? 'underline dashed' : 'none' }}
                              onClick={() => r.student_id && navigate(`/students/${r.student_id}`)}
                              title={r.student_id ? 'Profile dekhne ke liye click karein' : ''}
                            >
                              {r.student_name || '—'}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--neutral-5)' }}>
                              Roll: {r.roll_number || '—'}
                            </div>
                          </td>

                          <td style={{ fontSize: 13 }}>{r.father_name || '—'}</td>

                          <td>
                            <span style={{
                              background: 'var(--blue-10)', color: 'var(--blue-80)',
                              padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                            }}>{r.class_name || '—'}</span>
                          </td>

                          <td style={{ fontWeight: 500, fontSize: 13 }}>{r.fee_type || '—'}</td>

                          <td style={{ fontSize: 12, color: 'var(--neutral-6)' }}>{r.month || '—'}</td>

                          <td>
                            <div style={{ fontWeight: 600 }}>₹{fmt(r.amount_due)}</div>
                            {r.fine > 0 && <div style={{ fontSize: 10, color: '#ba0517' }}>+₹{fmt(r.fine)} fine</div>}
                            {r.discount > 0 && <div style={{ fontSize: 10, color: '#2e844a' }}>-₹{fmt(r.discount)} discount</div>}
                          </td>
                          <td style={{ fontWeight: 600, color: '#2e844a' }}>₹{fmt(r.amount_paid)}</td>
                          <td style={{ fontWeight: 700, color: (r.effective_due - r.amount_paid) > 0 ? '#ba0517' : '#2e844a' }}>
                            {(r.effective_due - r.amount_paid) > 0 ? `₹${fmt(r.effective_due - r.amount_paid)}` : '✅ Clear'}
                          </td>

                          <td>
                            {r.payment_mode ? (
                              <span style={{
                                background: '#f3f0ff', color: '#5867e8',
                                padding: '2px 8px', borderRadius: 4,
                                fontSize: 11, fontWeight: 600,
                              }}>{r.payment_mode}</span>
                            ) : <span style={{ color: '#ccc' }}>—</span>}
                          </td>

                          <td style={{ fontSize: 12, color: 'var(--neutral-6)' }}>
                            {r.due_date || '—'}
                          </td>

                          <td><Badge status={r.status} /></td>

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
                                  onClick={() => downloadReceipt(r.receipt_no)}
                                  style={{
                                    background: '#e8f4fd', color: '#0176d3',
                                    border: 'none', borderRadius: 4,
                                    padding: '4px 10px', fontSize: 11,
                                    fontWeight: 700, cursor: 'pointer',
                                  }}>
                                  🧾 PDF Receipt
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {!filtered.length && !loading && (
                      <tr>
                        <td colSpan={14}>
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

      {/* ══ ALWAYS-VISIBLE REVIEW STATUS WIDGET — screen ke side pe fixed ══ */}
      <div style={{
        position: 'fixed', top: 100, right: 16, zIndex: 40,
        width: 190, background: '#fff', borderRadius: 12,
        boxShadow: '0 4px 16px rgba(0,0,0,0.12)', border: '1px solid #e2e8f0',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '8px 12px', background: '#0176d3', color: '#fff',
          fontSize: 11, fontWeight: 700,
        }}>
          📋 Fee Batch Review
        </div>
        <button
          onClick={() => { setReviewTab('PENDING'); setShowBatches(true); }}
          style={{
            width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '10px 12px', border: 'none', borderBottom: '1px solid #f1f5f9',
            background: batches.length > 0 ? '#fffbeb' : '#fff', cursor: 'pointer',
          }}>
          <span style={{ fontSize: 12, color: '#64748b' }}>⏳ Pending Review</span>
          <span style={{
            fontSize: 13, fontWeight: 800,
            color: batches.length > 0 ? '#dd7a01' : '#94a3b8',
          }}>{batches.length}</span>
        </button>
        <button
          onClick={() => { setReviewTab('REVIEWED'); setShowBatches(true); }}
          style={{
            width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '10px 12px', border: 'none', background: '#fff', cursor: 'pointer',
          }}>
          <span style={{ fontSize: 12, color: '#64748b' }}>✅ Reviewed / Passed</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: '#2e844a' }}>{publishedBatches.length}</span>
        </button>
      </div>

      {/* ══ SINGLE COLLECT FEE MODAL ═══════════════════════════════════════ */}
      {modal && selRec && (
        <div className="modal-backdrop"
          onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal" style={{ width: 460 }}>
            <div className="modal-header">
              <h3>💸 Fee Collect Karo</h3>
              <button className="modal-close" onClick={() => setModal(false)}>✕</button>
            </div>

            <div className="modal-body">
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

      {/* ══ MULTI-COLLECT (COMBINE/SEPARATE) MODAL ═══════════════════════════ */}
      {multiCollectModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setMultiCollectModal(false)}>
          <div className="modal" style={{ width: 460 }}>
            <div className="modal-header">
              <h3>💸 {selectedIds.length} Records Collect Karo</h3>
              <button className="modal-close" onClick={() => setMultiCollectModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ background: '#f8faff', border: '1px solid #dde8f5', borderRadius: 8, padding: 12, marginBottom: 16 }}>
                {filtered.filter(r => selectedIds.includes(r.id)).map(r => (
                  <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span>{r.fee_type} ({r.source || 'ACADEMIC'})</span>
                    <strong>₹{fmt(r.amount_due - r.amount_paid)}</strong>
                  </div>
                ))}
              </div>

              <div className="form-group">
                <label className="form-label">Kaise Collect Karein? *</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setCollectMode('COMBINED')}
                    style={{
                      flex: 1, padding: '10px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      border: collectMode === 'COMBINED' ? '2px solid #0176d3' : '1px solid #e2e8f0',
                      background: collectMode === 'COMBINED' ? '#eff6ff' : '#fff',
                      color: collectMode === 'COMBINED' ? '#0176d3' : '#64748b',
                    }}>
                    🧾 Ek Sath<br/><span style={{ fontWeight: 400, fontSize: 10 }}>Ek receipt, ek PDF</span>
                  </button>
                  <button onClick={() => setCollectMode('SEPARATE')}
                    style={{
                      flex: 1, padding: '10px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      border: collectMode === 'SEPARATE' ? '2px solid #0176d3' : '1px solid #e2e8f0',
                      background: collectMode === 'SEPARATE' ? '#eff6ff' : '#fff',
                      color: collectMode === 'SEPARATE' ? '#0176d3' : '#64748b',
                    }}>
                    📑 Alag Alag<br/><span style={{ fontWeight: 400, fontSize: 10 }}>Source-wise alag PDF</span>
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Payment Mode *</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {MODES.map(m => (
                    <button key={m} onClick={() => setMultiPayMode(m)}
                      style={{
                        padding: '7px 16px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        border: '2px solid', borderColor: multiPayMode === m ? '#0176d3' : '#e2e8f0',
                        background: multiPayMode === m ? '#e8f4fd' : '#fff',
                        color: multiPayMode === m ? '#0176d3' : '#64748b',
                      }}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Remarks (optional)</label>
                <input className="form-input" value={multiRemarks} onChange={e => setMultiRemarks(e.target.value)} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-neutral" onClick={() => setMultiCollectModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={submitMultiPayment} disabled={multiSaving}>
                {multiSaving ? 'Processing...' : '✅ Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ GENERATE FEES MODAL ═══════════════════════════════════════════ */}
      {genModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setGenModal(false)}>
          <div className="modal" style={{ width: 420 }}>
            <div className="modal-header">
              <h3>➕ Generate Fees</h3>
              <button className="modal-close" onClick={() => setGenModal(false)}>✕</button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Class *</label>
                <select className="form-select" value={genClass} onChange={e => setGenClass(e.target.value)}>
                  <option value="">Select Class</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name} - {c.section}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Month *</label>
                <input type="month" className="form-input" value={genMonth} onChange={e => setGenMonth(e.target.value)} />
              </div>

              <div className="form-group">
                <label className="form-label">Fee Type *</label>
                <select className="form-select" value={genFeeType} onChange={e => setGenFeeType(e.target.value)}>
                  <option value="TUITION">Tuition</option>
                  <option value="EXAM">Exam</option>
                  <option value="TRANSPORT">Transport</option>
                  <option value="HOSTEL">Hostel</option>
                  <option value="ADMISSION">Admission</option>
                  <option value="LIBRARY">Library</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Collection Start (optional)</label>
                <input type="date" className="form-input" value={genWindowStart}
                  onChange={e => setGenWindowStart(e.target.value)} />
              </div>

              <div className="form-group">
                <label className="form-label">Last Date to Pay (optional)</label>
                <input type="date" className="form-input" value={genWindowEnd}
                  onChange={e => setGenWindowEnd(e.target.value)} />
                <span style={{ fontSize: 11, color: '#64748b' }}>
                  Ye hi Due Date banegi. Khali chodo to Fee Structure ka default due-day use hoga.
                </span>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-neutral" onClick={() => setGenModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={generateFees}>✅ Generate</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ BULK CLASS NOTICE MODAL ═══════════════════════════════════════ */}
      {bulkNoticeModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setBulkNoticeModal(false)}>
          <div className="modal" style={{ width: 400 }}>
            <div className="modal-header">
              <h3>📄 Class Notice PDF (Bulk)</h3>
              <button className="modal-close" onClick={() => setBulkNoticeModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 12, color: '#64748b', marginBottom: 14 }}>
                Ek hi PDF mein poori class — roll-number order — har student ka page (tuition+hostel+library+sports+exam sab consolidated).
              </p>
              <div className="form-group">
                <label className="form-label">Class *</label>
                <select className="form-select" value={bulkNoticeClass} onChange={e => setBulkNoticeClass(e.target.value)}>
                  <option value="">Select Class</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name} - {c.section}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Month</label>
                <input type="month" className="form-input" value={bulkNoticeMonth} onChange={e => setBulkNoticeMonth(e.target.value)} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-neutral" onClick={() => setBulkNoticeModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={downloadBulkNotice}>⬇ Download PDF</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ DRAFT BATCHES LIST MODAL ══════════════════════════════════════ */}
      {showBatches && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowBatches(false)}>
          <div className="modal" style={{ width: 520 }}>
            <div className="modal-header">
              <h3>📋 Fee Batch Review</h3>
              <button className="modal-close" onClick={() => setShowBatches(false)}>✕</button>
            </div>

            <div style={{ display: 'flex', gap: 4, padding: '0 16px', borderBottom: '1px solid #e2e8f0' }}>
              <button onClick={() => setReviewTab('PENDING')}
                style={{
                  padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none', background: 'none',
                  color: reviewTab === 'PENDING' ? '#dd7a01' : '#64748b',
                  borderBottom: reviewTab === 'PENDING' ? '2px solid #dd7a01' : '2px solid transparent',
                }}>⏳ Pending ({batches.length})</button>
              <button onClick={() => setReviewTab('REVIEWED')}
                style={{
                  padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none', background: 'none',
                  color: reviewTab === 'REVIEWED' ? '#2e844a' : '#64748b',
                  borderBottom: reviewTab === 'REVIEWED' ? '2px solid #2e844a' : '2px solid transparent',
                }}>✅ Reviewed ({publishedBatches.length})</button>
            </div>

            <div className="modal-body">
              {reviewTab === 'PENDING' && batches.map(b => (
                <div key={b.id} style={{
                  border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, marginBottom: 8,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div>
                    <strong>{b.class_name}</strong> — {b.fee_type} — {b.month}
                    <div style={{ fontSize: 11, color: '#64748b' }}>
                      {b.generated_count} created, {b.skipped_count} skipped
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => openBatchReview(b.id)} style={{ background: '#e8f4fd', color: '#0176d3', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Review</button>
                    <button onClick={() => deleteBatch(b.id)} style={{ background: '#fef2f2', color: '#dc2626', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Delete</button>
                  </div>
                </div>
              ))}
              {reviewTab === 'PENDING' && !batches.length && (
                <p style={{ color: '#94a3b8', textAlign: 'center', padding: 20 }}>Sab review ho chuka hai ✅</p>
              )}

              {reviewTab === 'REVIEWED' && publishedBatches.map(b => (
                <div key={b.id} style={{
                  border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, marginBottom: 8,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fdf9',
                }}>
                  <div>
                    <strong>{b.class_name}</strong> — {b.fee_type} — {b.month}
                    <div style={{ fontSize: 11, color: '#64748b' }}>
                      {b.generated_count} students · Published
                    </div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#2e844a' }}>✅ Confirmed</span>
                </div>
              ))}
              {reviewTab === 'REVIEWED' && !publishedBatches.length && (
                <p style={{ color: '#94a3b8', textAlign: 'center', padding: 20 }}>Abhi tak koi batch review/publish nahi hui</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ BATCH RECORD REVIEW + PUBLISH MODAL ═══════════════════════════ */}
      {batchRecords && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setBatchRecords(null)}>
          <div className="modal" style={{ width: 600, maxHeight: '80vh', overflow: 'auto' }}>
            <div className="modal-header">
              <h3>Review — {batchRecords.batch.fee_type} — {batchRecords.batch.month}</h3>
              <button className="modal-close" onClick={() => setBatchRecords(null)}>✕</button>
            </div>
            <div className="modal-body">
              <table style={{ width: '100%', fontSize: 12 }}>
                <thead><tr><th>Student</th><th>Amount Due</th><th>Due Date</th><th>Action</th></tr></thead>
                <tbody>
                  {batchRecords.records.map(r => (
                    <tr key={r.id}>
                      <td>{r.student_name}</td>
                      <td>
                        {editingRecId === r.id ? (
                          <input type="number" value={editAmt} autoFocus
                            onChange={e => setEditAmt(e.target.value)}
                            style={{ width: 80, fontSize: 12, padding: '2px 6px' }} />
                        ) : `₹${fmt(r.amount_due)}`}
                      </td>
                      <td>{r.due_date}</td>
                      <td>
                        {editingRecId === r.id ? (
                          <>
                            <button onClick={() => saveRecordAmount(r.id)}
                              style={{ fontSize: 10, marginRight: 4, background: '#eaf5ea', color: '#2e844a', border: 'none', borderRadius: 4, padding: '3px 8px', cursor: 'pointer' }}>✓ Save</button>
                            <button onClick={() => setEditingRecId(null)}
                              style={{ fontSize: 10, background: '#f1f1f1', border: 'none', borderRadius: 4, padding: '3px 8px', cursor: 'pointer' }}>✕</button>
                          </>
                        ) : (
                          <button onClick={() => { setEditingRecId(r.id); setEditAmt(String(r.amount_due)); }}
                            style={{ fontSize: 10, background: '#e8f4fd', color: '#0176d3', border: 'none', borderRadius: 4, padding: '3px 8px', cursor: 'pointer' }}>Edit</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {missingStudents.length > 0 && (
                <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px dashed #e2e8f0' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                    + Missed Student Add Karo ({missingStudents.length} available)
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <select className="form-select" style={{ flex: 1, fontSize: 12 }}
                      value={addStudentId} onChange={e => setAddStudentId(e.target.value)}>
                      <option value="">Select student...</option>
                      {missingStudents.map(s => (
                        <option key={s.id} value={s.id}>{s.name} — Roll {s.roll_number}</option>
                      ))}
                    </select>
                    <button onClick={addStudentToBatch} disabled={!addStudentId}
                      style={{ fontSize: 12, background: '#0176d3', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer' }}>
                      + Add
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-neutral" onClick={() => deleteBatch(batchRecords.batch.id)}>🗑️ Delete Batch</button>
              <button className="btn btn-primary" onClick={() => publishBatch(batchRecords.batch.id)}>✅ Publish</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ SINGLE RECEIPT MODAL ═══════════════════════════════════════════ */}
      {receiptRec && (
        <div className="modal-backdrop"
          onClick={e => e.target === e.currentTarget && setReceiptRec(null)}>
          <div className="modal" style={{ width: 420 }}>
            <div className="modal-header">
              <h3>🧾 Fee Receipt</h3>
              <button className="modal-close" onClick={() => setReceiptRec(null)}>✕</button>
            </div>
            <div className="modal-body">
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

      {/* ══ MULTI-RECEIPT MODAL (combine/separate collect ka result) ═══════ */}
      {receiptGroup && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setReceiptGroup(null)}>
          <div className="modal" style={{ width: 460 }}>
            <div className="modal-header">
              <h3>🧾 {receiptGroup.mode === 'SEPARATE' ? 'Multiple Receipts' : 'Receipt'} — {receiptGroup.student_name}</h3>
              <button className="modal-close" onClick={() => setReceiptGroup(null)}>✕</button>
            </div>
            <div className="modal-body">
              {receiptGroup.receipts.map(rcp => (
                <div key={rcp.receipt_no} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <strong style={{ fontSize: 13 }}>{rcp.receipt_no}</strong>
                    <span style={{ fontSize: 11, color: '#64748b' }}>{rcp.source_group}</span>
                  </div>
                  {rcp.items.map((it, i) => (
                    <div key={i} style={{ fontSize: 12, color: '#475569', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{it.fee_type}</span><span>₹{fmt(it.amount)}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, paddingTop: 6, borderTop: '1px dashed #e2e8f0' }}>
                    <strong style={{ fontSize: 12 }}>Total</strong>
                    <strong style={{ fontSize: 12, color: '#2e844a' }}>₹{fmt(rcp.total)}</strong>
                  </div>
                  <button
                    onClick={() => downloadReceipt(rcp.receipt_no)}
                    style={{ marginTop: 8, width: '100%', background: '#e8f4fd', color: '#0176d3', border: 'none', borderRadius: 6, padding: '6px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    🖨️ PDF Download
                  </button>
                </div>
              ))}
            </div>
            <div className="modal-footer">
              <button className="btn btn-neutral" onClick={() => setReceiptGroup(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
