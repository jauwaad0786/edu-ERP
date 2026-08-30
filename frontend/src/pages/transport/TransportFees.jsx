import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import transportApi from '../../api/transportApi';
import toast   from 'react-hot-toast';

const FREQUENCIES = ['MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY'];
const PAYMENT_MODES = ['CASH', 'CARD', 'UPI', 'NETBANKING', 'CHEQUE', 'OTHER'];

const STATUS_COLORS = {
  PENDING: { bg: '#fef3c7', color: '#d97706' },
  PARTIAL: { bg: '#fef3c7', color: '#d97706' },
  PAID:    { bg: '#f0fdf4', color: '#16a34a' },
  OVERDUE: { bg: '#fef2f2', color: '#dc2626' },
  WAIVED:  { bg: '#f1f5f9', color: '#64748b' },
};

const EMPTY_STRUCTURE = { name: '', frequency: 'MONTHLY', amount: '', route_id: '', academic_year: '' };
const EMPTY_GENERATE  = { fee_structure_id: '', period_label: '', due_date: '' };

export default function TransportFees() {
  const [darkMode, setDarkMode] = useState(localStorage.getItem('ederp_theme') === 'dark');
  const [tab, setTab] = useState('records'); // 'records' | 'fines' | 'structures'

  const [routes, setRoutes] = useState([]);
  const [allStudents, setAllStudents] = useState([]);

  // ── Fee Structures ──
  const [structures, setStructures] = useState([]);
  const [loadingStructures, setLoadingStructures] = useState(true);
  const [showStructForm, setShowStructForm] = useState(false);
  const [editingStructId, setEditingStructId] = useState(null);
  const [structForm, setStructForm] = useState(EMPTY_STRUCTURE);
  const [savingStruct, setSavingStruct] = useState(false);

  // ── Fee Records ──
  const [records, setRecords] = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [periodFilter, setPeriodFilter] = useState('');
  const [routeFilter, setRouteFilter] = useState('');

  // ── Transport Fines ──
  const [fines, setFines] = useState([]);
  const [loadingFines, setLoadingFines] = useState(false);
  const [showFineModal, setShowFineModal] = useState(false);
  const [fineForm, setFineForm] = useState({ student_id: '', amount: '', fine_type: 'LATE_PAYMENT', reason: '' });
  const [savingFine, setSavingFine] = useState(false);
  const [collectFineRecord, setCollectFineRecord] = useState(null);
  const [collectFineForm, setCollectFineForm] = useState({ amount_paid: '', payment_mode: 'CASH', remarks: '' });
  const [waiveFineRecord, setWaiveFineRecord] = useState(null);
  const [waiveFineForm, setWaiveFineForm] = useState({ waiver_amount: '', reason: '' });

  // ── Generate modal ──
  const [showGenerate, setShowGenerate] = useState(false);
  const [generateForm, setGenerateForm] = useState(EMPTY_GENERATE);
  const [generating, setGenerating] = useState(false);

  // ── Collect payment modal ──
  const [collectRecord, setCollectRecord] = useState(null);
  const [collectForm, setCollectForm] = useState({ amount_paid: '', payment_mode: 'CASH', transaction_ref: '', receipt_number: '', remarks: '' });
  const [collecting, setCollecting] = useState(false);

  // ── Waive modal ──
  const [waiveRecord, setWaiveRecord] = useState(null);
  const [waiveForm, setWaiveForm] = useState({ waiver: '', remarks: '' });
  const [waiving, setWaiving] = useState(false);

  // ── Transactions drawer ──
  const [txnRecord, setTxnRecord] = useState(null);
  const [txns, setTxns] = useState([]);

  const loadFines = useCallback(() => {
    setLoadingFines(true);
    transportApi.fines.list()
      .then(r => setFines(r.data.data || []))
      .catch(() => toast.error('Fines load nahi hue'))
      .finally(() => setLoadingFines(false));
  }, []);

  const loadStructures = useCallback(() => {
    setLoadingStructures(true);
    transportApi.fees.listStructures()
      .then(r => setStructures(r.data.data || []))
      .catch(() => toast.error('Fee structures load nahi hui'))
      .finally(() => setLoadingStructures(false));
  }, []);

  const loadRecords = useCallback(() => {
    setLoadingRecords(true);
    const params = { page };
    if (statusFilter) params.status = statusFilter;
    if (periodFilter) params.period_label = periodFilter;
    if (routeFilter) params.route_id = routeFilter;
    transportApi.fees.listRecords(params)
      .then(r => { setRecords(r.data.data || []); setTotal(r.data.total || 0); })
      .catch(() => toast.error('Fee records load nahi hue'))
      .finally(() => setLoadingRecords(false));
  }, [page, statusFilter, periodFilter, routeFilter]);

  useEffect(() => { loadStructures(); }, [loadStructures]);
  useEffect(() => { loadRecords(); }, [loadRecords]);
  useEffect(() => { loadFines(); }, [loadFines]);
  useEffect(() => {
    transportApi.routes.list({ include_stops: false }).then(r => setRoutes(r.data.data || [])).catch(() => {});
    transportApi.students.browse({ per_page: 200 }).then(r => setAllStudents(r.data.data || [])).catch(() => {});
  }, []);

  // ── Structure CRUD ──
  function openAddStruct() {
    setEditingStructId(null);
    setStructForm(EMPTY_STRUCTURE);
    setShowStructForm(true);
  }
  function openEditStruct(s) {
    setEditingStructId(s.id);
    setStructForm({
      name: s.name || '', frequency: s.frequency || 'MONTHLY',
      amount: s.amount ?? '', route_id: s.route_id || '', academic_year: s.academic_year || '',
    });
    setShowStructForm(true);
  }
  async function handleSaveStruct(e) {
    e.preventDefault();
    if (!structForm.name.trim()) { toast.error('Name required hai'); return; }
    if (!structForm.amount || Number(structForm.amount) <= 0) { toast.error('Amount valid hona chahiye'); return; }

    setSavingStruct(true);
    const payload = {
      name: structForm.name,
      frequency: structForm.frequency,
      amount: Number(structForm.amount),
      route_id: structForm.route_id || null,
      academic_year: structForm.academic_year,
    };
    try {
      if (editingStructId) {
        await transportApi.fees.updateStructure(editingStructId, payload);
        toast.success('Fee structure updated');
      } else {
        await transportApi.fees.createStructure(payload);
        toast.success('Fee structure created');
      }
      setShowStructForm(false);
      loadStructures();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save nahi hua');
    }
    setSavingStruct(false);
  }
  async function handleDeleteStruct(s) {
    if (!window.confirm(`"${s.name}" ko delete karna hai?`)) return;
    try {
      await transportApi.fees.removeStructure(s.id);
      toast.success('Structure deleted');
      loadStructures();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete nahi hua');
    }
  }

  // ── Fine Actions ──
  async function handleSaveFine(e) {
    e.preventDefault();
    if (!fineForm.student_id) { toast.error('Student select karein'); return; }
    if (!fineForm.amount || Number(fineForm.amount) <= 0) { toast.error('Valid fine amount enter karein'); return; }

    setSavingFine(true);
    try {
      await transportApi.fines.create({
        student_id: Number(fineForm.student_id),
        amount: Number(fineForm.amount),
        fine_type: fineForm.fine_type,
        reason: fineForm.reason,
      });
      toast.success('Transport fine added');
      setShowFineModal(false);
      setFineForm({ student_id: '', amount: '', fine_type: 'LATE_PAYMENT', reason: '' });
      loadFines();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Fine create nahi hua');
    }
    setSavingFine(false);
  }

  async function handleCollectFine(e) {
    e.preventDefault();
    if (!collectFineForm.amount_paid || Number(collectFineForm.amount_paid) <= 0) {
      toast.error('Valid amount enter karein'); return;
    }
    try {
      await transportApi.fines.collect(collectFineRecord.id, {
        amount_paid: Number(collectFineForm.amount_paid),
        payment_mode: collectFineForm.payment_mode,
        remarks: collectFineForm.remarks,
      });
      toast.success('Fine payment collected');
      setCollectFineRecord(null);
      loadFines();
      loadRecords();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Payment collect nahi hua');
    }
  }

  async function handleWaiveFine(e) {
    e.preventDefault();
    if (!waiveFineForm.waiver_amount || Number(waiveFineForm.waiver_amount) <= 0) {
      toast.error('Valid waiver amount enter karein'); return;
    }
    try {
      await transportApi.fines.waive(waiveFineRecord.id, {
        waiver_amount: Number(waiveFineForm.waiver_amount),
        reason: waiveFineForm.reason,
      });
      toast.success('Fine waived');
      setWaiveFineRecord(null);
      loadFines();
      loadRecords();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Waive nahi hua — sirf Principal kar sakte hain');
    }
  }

  // ── Generate Records ──
  function openGenerate() {
    setGenerateForm(EMPTY_GENERATE);
    setShowGenerate(true);
  }

  async function handleGenerate(e) {
    e.preventDefault();
    if (!generateForm.fee_structure_id) { toast.error('Fee structure select karein'); return; }
    if (!generateForm.period_label.trim()) { toast.error('Period label required hai (e.g. "April 2026")'); return; }

    setGenerating(true);
    try {
      const r = await transportApi.fees.generateRecords(generateForm);
      toast.success(r.data.message || 'Fee records generated');
      setShowGenerate(false);
      setGenerateForm(EMPTY_GENERATE);
      loadRecords();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Generate nahi hua');
    }
    setGenerating(false);
  }

  // ── Collect Payment ──
  function openCollect(record) {
    setCollectRecord(record);
    setCollectForm({
      amount_paid: record.balance || '',
      payment_mode: 'CASH', transaction_ref: '', receipt_number: '', remarks: '',
    });
  }
  async function handleCollect(e) {
    e.preventDefault();
    if (!collectForm.amount_paid || Number(collectForm.amount_paid) <= 0) { toast.error('Amount paid required hai'); return; }
    setCollecting(true);
    try {
      await transportApi.fees.collect(collectRecord.id, {
        amount_paid: Number(collectForm.amount_paid),
        payment_mode: collectForm.payment_mode,
        transaction_ref: collectForm.transaction_ref,
        receipt_number: collectForm.receipt_number,
        remarks: collectForm.remarks,
      });
      toast.success('Payment collected');
      setCollectRecord(null);
      loadRecords();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Payment collect nahi hua');
    }
    setCollecting(false);
  }

  // ── Waive ──
  function openWaive(record) {
    setWaiveRecord(record);
    setWaiveForm({ waiver: record.balance || '', remarks: '' });
  }
  async function handleWaive(e) {
    e.preventDefault();
    if (waiveForm.waiver === '' || Number(waiveForm.waiver) < 0) { toast.error('Waiver amount valid hona chahiye'); return; }
    setWaiving(true);
    try {
      await transportApi.fees.waive(waiveRecord.id, { waiver: Number(waiveForm.waiver), remarks: waiveForm.remarks });
      toast.success('Waiver applied');
      setWaiveRecord(null);
      loadRecords();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Waive nahi hua — sirf Principal kar sakte hain');
    }
    setWaiving(false);
  }

  // ── Transactions ──
  async function openTxns(record) {
    setTxnRecord(record);
    try {
      const r = await transportApi.fees.transactions(record.id);
      setTxns(r.data.data || []);
    } catch {
      toast.error('Transactions load nahi hui');
    }
  }

  const cardStyle = {
    background: darkMode ? '#1e293b' : '#fff',
    border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
    borderRadius: 12, padding: 18,
  };
  const inputStyle = {
    padding: '8px 10px', fontSize: 12,
    border: '1px solid #e2e8f0', borderRadius: 8, outline: 'none',
  };
  const tabBtn = (key, label) => (
    <button onClick={() => setTab(key)} style={{
      padding: '9px 18px', fontSize: 13, fontWeight: 700, borderRadius: 8, cursor: 'pointer',
      border: 'none', background: tab === key ? '#4f46e5' : (darkMode ? '#1e293b' : '#f1f5f9'),
      color: tab === key ? '#fff' : (darkMode ? '#94a3b8' : '#334155'),
    }}>{label}</button>
  );

  // period totals (client-side, from currently loaded page — good enough for a quick glance)
  const totals = records.reduce((acc, r) => {
    acc.collected += r.paid_amount || 0;
    acc.pending += (r.status === 'PENDING' || r.status === 'PARTIAL' || r.status === 'OVERDUE') ? r.balance : 0;
    return acc;
  }, { collected: 0, pending: 0 });

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: darkMode ? '#0f172a' : '#f8fafc' }}>
      <Sidebar darkMode={darkMode} />
      <div style={{ marginLeft: 232, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Navbar title="Transport Fees & Fines" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />

        <div style={{ padding: 24 }}>
          {/* Summary cards (current page only) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 18 }}>
            <div style={{ ...cardStyle, borderLeft: '4px solid #16a34a' }}>
              <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>COLLECTED (this page)</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#16a34a', marginTop: 4 }}>₹{totals.collected.toLocaleString()}</div>
            </div>
            <div style={{ ...cardStyle, borderLeft: '4px solid #d97706' }}>
              <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>PENDING (this page)</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#d97706', marginTop: 4 }}>₹{totals.pending.toLocaleString()}</div>
            </div>
            <div style={{ ...cardStyle, borderLeft: '4px solid #ef4444' }}>
              <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>FINES / PENALTIES</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#ef4444', marginTop: 4 }}>{fines.length} Recorded</div>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {tabBtn('records', 'Fee Collection')}
            {tabBtn('fines', 'Fines & Penalties')}
            {tabBtn('structures', 'Fee Structures')}
          </div>

          {tab === 'structures' ? (
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
                <button onClick={openAddStruct} style={{
                  background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8,
                  padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}>+ Add Fee Structure</button>
              </div>

              {loadingStructures ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Loading...</div>
              ) : structures.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Koi fee structure nahi mila</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, textAlign: 'left' }}>
                      <th style={{ padding: '8px 6px', color: '#94a3b8', fontSize: 11 }}>NAME</th>
                      <th style={{ padding: '8px 6px', color: '#94a3b8', fontSize: 11 }}>FREQUENCY</th>
                      <th style={{ padding: '8px 6px', color: '#94a3b8', fontSize: 11 }}>AMOUNT</th>
                      <th style={{ padding: '8px 6px', color: '#94a3b8', fontSize: 11 }}>ROUTE</th>
                      <th style={{ padding: '8px 6px', color: '#94a3b8', fontSize: 11 }}>STATUS</th>
                      <th style={{ padding: '8px 6px', color: '#94a3b8', fontSize: 11 }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {structures.map(s => (
                      <tr key={s.id} style={{ borderBottom: `1px solid ${darkMode ? '#334155' : '#f1f5f9'}` }}>
                        <td style={{ padding: '10px 6px', fontWeight: 600, color: darkMode ? '#f1f5f9' : '#0f172a' }}>{s.name}</td>
                        <td style={{ padding: '10px 6px', color: '#64748b' }}>{s.frequency}</td>
                        <td style={{ padding: '10px 6px', color: '#64748b' }}>₹{s.amount.toLocaleString()}</td>
                        <td style={{ padding: '10px 6px', color: '#64748b' }}>{s.route_name}</td>
                        <td style={{ padding: '10px 6px' }}>
                          <span style={{
                            fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                            background: s.status === 'ACTIVE' ? '#f0fdf4' : '#f1f5f9',
                            color: s.status === 'ACTIVE' ? '#16a34a' : '#64748b',
                          }}>{s.status}</span>
                        </td>
                        <td style={{ padding: '10px 6px', whiteSpace: 'nowrap' }}>
                          <button onClick={() => openEditStruct(s)} style={{
                            background: '#eef2ff', color: '#4f46e5', border: 'none', borderRadius: 6,
                            padding: '5px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer', marginRight: 4,
                          }}>Edit</button>
                          <button onClick={() => handleDeleteStruct(s)} style={{
                            background: '#fef2f2', color: '#dc2626', border: 'none', borderRadius: 6,
                            padding: '5px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                          }}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ) : tab === 'records' ? (
            <>
              {/* Filters + Generate */}
              <div style={{ ...cardStyle, marginBottom: 16, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <select value={statusFilter} onChange={e => { setPage(1); setStatusFilter(e.target.value); }} style={inputStyle}>
                    <option value="">All Status</option>
                    {Object.keys(STATUS_COLORS).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <input value={periodFilter} onChange={e => { setPage(1); setPeriodFilter(e.target.value); }}
                    placeholder="Period e.g. April 2026" style={{ ...inputStyle, width: 170 }} />
                  <select value={routeFilter} onChange={e => { setPage(1); setRouteFilter(e.target.value); }} style={inputStyle}>
                    <option value="">All Routes</option>
                    {routes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
                <button onClick={openGenerate} style={{
                  background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8,
                  padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}>+ Generate Fee Records</button>
              </div>

              <div style={cardStyle}>
                {loadingRecords ? (
                  <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Loading...</div>
                ) : records.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Koi fee record nahi mila</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, textAlign: 'left' }}>
                        <th style={{ padding: '8px 6px', color: '#94a3b8', fontSize: 11 }}>STUDENT</th>
                        <th style={{ padding: '8px 6px', color: '#94a3b8', fontSize: 11 }}>PERIOD</th>
                        <th style={{ padding: '8px 6px', color: '#94a3b8', fontSize: 11 }}>AMOUNT</th>
                        <th style={{ padding: '8px 6px', color: '#94a3b8', fontSize: 11 }}>PAID</th>
                        <th style={{ padding: '8px 6px', color: '#94a3b8', fontSize: 11 }}>BALANCE</th>
                        <th style={{ padding: '8px 6px', color: '#94a3b8', fontSize: 11 }}>STATUS</th>
                        <th style={{ padding: '8px 6px', color: '#94a3b8', fontSize: 11 }}>ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map(r => (
                        <tr key={r.id} style={{ borderBottom: `1px solid ${darkMode ? '#334155' : '#f1f5f9'}` }}>
                          <td style={{ padding: '10px 6px' }}>
                            <div style={{ fontWeight: 600, color: darkMode ? '#f1f5f9' : '#0f172a' }}>{r.student_name}</div>
                            <div style={{ fontSize: 11, color: '#94a3b8' }}>{r.admission_no}</div>
                          </td>
                          <td style={{ padding: '10px 6px', color: '#64748b' }}>{r.period_label}</td>
                          <td style={{ padding: '10px 6px', color: '#64748b' }}>₹{r.amount.toLocaleString()}</td>
                          <td style={{ padding: '10px 6px', color: '#64748b' }}>₹{r.paid_amount.toLocaleString()}</td>
                          <td style={{ padding: '10px 6px', fontWeight: 700, color: r.balance > 0 ? '#dc2626' : '#16a34a' }}>₹{r.balance.toLocaleString()}</td>
                          <td style={{ padding: '10px 6px' }}>
                            <span style={{
                              fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                              background: STATUS_COLORS[r.status]?.bg, color: STATUS_COLORS[r.status]?.color,
                            }}>{r.status}</span>
                          </td>
                          <td style={{ padding: '10px 6px', whiteSpace: 'nowrap' }}>
                            {r.status !== 'PAID' && r.status !== 'WAIVED' && (
                              <button onClick={() => openCollect(r)} style={{
                                background: '#f0fdf4', color: '#16a34a', border: 'none', borderRadius: 6,
                                padding: '5px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer', marginRight: 4,
                              }}>Collect</button>
                            )}
                            {r.status !== 'PAID' && r.status !== 'WAIVED' && (
                              <button onClick={() => openWaive(r)} style={{
                                background: '#f1f5f9', color: '#334155', border: 'none', borderRadius: 6,
                                padding: '5px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer', marginRight: 4,
                              }}>Waive</button>
                            )}
                            <button onClick={() => openTxns(r)} style={{
                              background: '#eef2ff', color: '#4f46e5', border: 'none', borderRadius: 6,
                              padding: '5px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                            }}>Receipts</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>{total} records total</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{
                      padding: '6px 14px', fontSize: 12, borderRadius: 6, border: '1px solid #e2e8f0',
                      background: darkMode ? '#0f172a' : '#fff', color: darkMode ? '#e2e8f0' : '#334155',
                      cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.5 : 1,
                    }}>Prev</button>
                    <button disabled={records.length < 25} onClick={() => setPage(p => p + 1)} style={{
                      padding: '6px 14px', fontSize: 12, borderRadius: 6, border: '1px solid #e2e8f0',
                      background: darkMode ? '#0f172a' : '#fff', color: darkMode ? '#e2e8f0' : '#334155',
                      cursor: records.length < 25 ? 'not-allowed' : 'pointer', opacity: records.length < 25 ? 0.5 : 1,
                    }}>Next</button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* ══ TAB: FINES & PENALTIES ══ */
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, color: darkMode ? '#fff' : '#0f172a' }}>
                    Transport Fines & Penalties
                  </h3>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>
                    Manage student damages, late fee charges, and penalty waivers
                  </div>
                </div>
                <button onClick={() => setShowFineModal(true)} style={{
                  background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8,
                  padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6
                }}>
                  + Add Penalty / Fine
                </button>
              </div>

              {loadingFines ? (
                <p style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: '30px 0' }}>Loading fines...</p>
              ) : fines.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>No Outstanding Fines</div>
                  <div style={{ fontSize: 12 }}>All students are in good standing</div>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: `2px solid ${darkMode ? '#334155' : '#e2e8f0'}`, textAlign: 'left' }}>
                        <th style={{ padding: '8px 6px', color: '#94a3b8' }}>STUDENT</th>
                        <th style={{ padding: '8px 6px', color: '#94a3b8' }}>FINE TYPE</th>
                        <th style={{ padding: '8px 6px', color: '#94a3b8' }}>AMOUNT</th>
                        <th style={{ padding: '8px 6px', color: '#94a3b8' }}>PAID</th>
                        <th style={{ padding: '8px 6px', color: '#94a3b8' }}>WAIVED</th>
                        <th style={{ padding: '8px 6px', color: '#94a3b8' }}>BALANCE</th>
                        <th style={{ padding: '8px 6px', color: '#94a3b8' }}>STATUS</th>
                        <th style={{ padding: '8px 6px', color: '#94a3b8' }}>ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fines.map(f => (
                        <tr key={f.id} style={{ borderBottom: `1px solid ${darkMode ? '#334155' : '#f1f5f9'}` }}>
                          <td style={{ padding: '10px 6px', fontWeight: 700, color: darkMode ? '#f1f5f9' : '#0f172a' }}>
                            {f.student_name || 'Student'}
                            <div style={{ fontSize: 10.5, color: '#94a3b8', fontWeight: 400 }}>
                              {f.admission_no ? `Adm: ${f.admission_no}` : ''} {f.class_name ? `• ${f.class_name}` : ''}
                            </div>
                          </td>
                          <td style={{ padding: '10px 6px', color: '#64748b' }}>
                            <span style={{ fontWeight: 600 }}>{f.fine_type}</span>
                            {f.reason && <div style={{ fontSize: 10.5, color: '#94a3b8' }}>{f.reason}</div>}
                          </td>
                          <td style={{ padding: '10px 6px', fontWeight: 700, color: darkMode ? '#fff' : '#0f172a' }}>
                            ₹{f.amount?.toLocaleString()}
                          </td>
                          <td style={{ padding: '10px 6px', color: '#16a34a', fontWeight: 600 }}>
                            ₹{(f.amount_paid || 0).toLocaleString()}
                          </td>
                          <td style={{ padding: '10px 6px', color: '#64748b' }}>
                            ₹{(f.waived_amount || 0).toLocaleString()}
                          </td>
                          <td style={{ padding: '10px 6px', fontWeight: 800, color: (f.outstanding_amount || 0) > 0 ? '#dc2626' : '#16a34a' }}>
                            ₹{(f.outstanding_amount || 0).toLocaleString()}
                          </td>
                          <td style={{ padding: '10px 6px' }}>
                            <span style={{
                              padding: '2px 8px', borderRadius: 12, fontSize: 10.5, fontWeight: 800,
                              background: f.status === 'PAID' ? '#dcfce7' : f.status === 'WAIVED' ? '#f1f5f9' : f.status === 'PARTIALLY_PAID' ? '#fef3c7' : '#fee2e2',
                              color: f.status === 'PAID' ? '#15803d' : f.status === 'WAIVED' ? '#64748b' : f.status === 'PARTIALLY_PAID' ? '#b45309' : '#b91c1c',
                            }}>
                              {f.status}
                            </span>
                          </td>
                          <td style={{ padding: '10px 6px' }}>
                            {(f.outstanding_amount || 0) > 0 && f.status !== 'WAIVED' && (
                              <>
                                <button
                                  onClick={() => {
                                    setCollectFineRecord(f);
                                    setCollectFineForm({ amount_paid: f.outstanding_amount, payment_mode: 'CASH', remarks: '' });
                                  }}
                                  style={{
                                    background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0',
                                    borderRadius: 6, padding: '4px 8px', fontSize: 11, fontWeight: 800, cursor: 'pointer', marginRight: 6
                                  }}
                                >
                                  Collect
                                </button>
                                <button
                                  onClick={() => {
                                    setWaiveFineRecord(f);
                                    setWaiveFineForm({ waiver_amount: f.outstanding_amount, reason: '' });
                                  }}
                                  style={{
                                    background: '#f8fafc', color: '#64748b', border: '1px solid #cbd5e1',
                                    borderRadius: 6, padding: '4px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer'
                                  }}
                                >
                                  Waive
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Add Fine Modal ── */}
      {showFineModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowFineModal(false)}>
          <div className="modal" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h3>Add Transport Fine / Penalty</h3>
              <button className="modal-close" onClick={() => setShowFineModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveFine} className="modal-body">
              <div>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Select Student *</label>
                <select
                  className="form-input"
                  value={fineForm.student_id}
                  onChange={e => setFineForm(f => ({ ...f, student_id: e.target.value }))}
                  required
                >
                  <option value="">-- Choose Student --</option>
                  {allStudents.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.admission_no || 'No Adm'}) {s.class_name ? `• ${s.class_name}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Fine Amount (₹) *</label>
                  <input
                    type="number" min="1" className="form-input"
                    value={fineForm.amount}
                    onChange={e => setFineForm(f => ({ ...f, amount: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Fine Type</label>
                  <select
                    className="form-input"
                    value={fineForm.fine_type}
                    onChange={e => setFineForm(f => ({ ...f, fine_type: e.target.value }))}
                  >
                    <option value="LATE_PAYMENT">Late Payment</option>
                    <option value="DAMAGE">Bus Damage / Seat Tear</option>
                    <option value="MISCONDUCT">Misconduct / Discipline</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Reason / Description</label>
                <textarea
                  className="form-input" rows={2}
                  placeholder="e.g. Window handle broken on Route 2"
                  value={fineForm.reason}
                  onChange={e => setFineForm(f => ({ ...f, reason: e.target.value }))}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                <button type="button" onClick={() => setShowFineModal(false)} style={{
                  background: '#f1f5f9', color: '#334155', border: 'none', borderRadius: 8,
                  padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer'
                }}>Cancel</button>
                <button type="submit" disabled={savingFine} style={{
                  background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8,
                  padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer'
                }}>{savingFine ? 'Saving...' : 'Add Penalty'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Collect Fine Modal ── */}
      {collectFineRecord && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setCollectFineRecord(null)}>
          <div className="modal" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h3>Collect Fine — {collectFineRecord.student_name}</h3>
              <button className="modal-close" onClick={() => setCollectFineRecord(null)}>✕</button>
            </div>
            <form onSubmit={handleCollectFine} className="modal-body">
              <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 10 }}>
                Fine outstanding: <strong style={{ color: '#dc2626' }}>₹{collectFineRecord.outstanding_amount}</strong>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Amount (₹) *</label>
                <input
                  type="number" min="1" className="form-input"
                  value={collectFineForm.amount_paid}
                  onChange={e => setCollectFineForm(f => ({ ...f, amount_paid: e.target.value }))}
                  required
                />
              </div>
              <div style={{ marginTop: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Payment Mode</label>
                <select
                  className="form-input"
                  value={collectFineForm.payment_mode}
                  onChange={e => setCollectFineForm(f => ({ ...f, payment_mode: e.target.value }))}
                >
                  {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div style={{ marginTop: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Remarks</label>
                <textarea
                  className="form-input" rows={2}
                  value={collectFineForm.remarks}
                  onChange={e => setCollectFineForm(f => ({ ...f, remarks: e.target.value }))}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                <button type="button" onClick={() => setCollectFineRecord(null)} style={{
                  background: '#f1f5f9', color: '#334155', border: 'none', borderRadius: 8,
                  padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer'
                }}>Cancel</button>
                <button type="submit" style={{
                  background: '#10b981', color: '#fff', border: 'none', borderRadius: 8,
                  padding: '9px 18px', fontSize: 13, fontWeight: 800, cursor: 'pointer'
                }}>Collect Payment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Waive Fine Modal ── */}
      {waiveFineRecord && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setWaiveFineRecord(null)}>
          <div className="modal" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h3>Waive Fine — {waiveFineRecord.student_name}</h3>
              <button className="modal-close" onClick={() => setWaiveFineRecord(null)}>✕</button>
            </div>
            <form onSubmit={handleWaiveFine} className="modal-body">
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 10 }}>
                Principal-only action. Fine will be marked as waived.
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Waiver Amount (₹) *</label>
                <input
                  type="number" min="1" className="form-input"
                  value={waiveFineForm.waiver_amount}
                  onChange={e => setWaiveFineForm(f => ({ ...f, waiver_amount: e.target.value }))}
                  required
                />
              </div>
              <div style={{ marginTop: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Waiver Reason *</label>
                <textarea
                  className="form-input" rows={2}
                  placeholder="e.g. Approved by Principal on parent appeal"
                  value={waiveFineForm.reason}
                  onChange={e => setWaiveFineForm(f => ({ ...f, reason: e.target.value }))}
                  required
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                <button type="button" onClick={() => setWaiveFineRecord(null)} style={{
                  background: '#f1f5f9', color: '#334155', border: 'none', borderRadius: 8,
                  padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer'
                }}>Cancel</button>
                <button type="submit" style={{
                  background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8,
                  padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer'
                }}>Waive Fine</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Add/Edit Fee Structure modal ── */}
      {showStructForm && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowStructForm(false)}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3>{editingStructId ? 'Edit Fee Structure' : 'Add Fee Structure'}</h3>
              <button className="modal-close" onClick={() => setShowStructForm(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveStruct} className="modal-body">
              <div>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Name *</label>
                <input className="form-input" value={structForm.name}
                  onChange={e => setStructForm(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Frequency</label>
                  <select className="form-input" value={structForm.frequency}
                    onChange={e => setStructForm(f => ({ ...f, frequency: e.target.value }))}>
                    {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Amount (₹) *</label>
                  <input type="number" min="1" className="form-input" value={structForm.amount}
                    onChange={e => setStructForm(f => ({ ...f, amount: e.target.value }))} required />
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Route (optional — leave blank for all routes)</label>
                <select className="form-input" value={structForm.route_id}
                  onChange={e => setStructForm(f => ({ ...f, route_id: e.target.value }))}>
                  <option value="">-- All Routes --</option>
                  {routes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div style={{ marginTop: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Academic Year</label>
                <input className="form-input" placeholder="2026-27" value={structForm.academic_year}
                  onChange={e => setStructForm(f => ({ ...f, academic_year: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                <button type="button" onClick={() => setShowStructForm(false)} style={{
                  background: '#f1f5f9', color: '#334155', border: 'none', borderRadius: 8,
                  padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}>Cancel</button>
                <button type="submit" disabled={savingStruct} style={{
                  background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8,
                  padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: savingStruct ? 'not-allowed' : 'pointer',
                  opacity: savingStruct ? 0.7 : 1,
                }}>{savingStruct ? 'Saving...' : editingStructId ? 'Update' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Generate records modal ── */}
      {showGenerate && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowGenerate(false)}>
          <div className="modal" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h3>Generate Fee Records</h3>
              <button className="modal-close" onClick={() => setShowGenerate(false)}>✕</button>
            </div>
            <form onSubmit={handleGenerate} className="modal-body">
              <div>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Fee Structure *</label>
                <select className="form-input" value={generateForm.fee_structure_id}
                  onChange={e => setGenerateForm(f => ({ ...f, fee_structure_id: e.target.value }))} required>
                  <option value="">-- Select --</option>
                  {structures.map(s => <option key={s.id} value={s.id}>{s.name} (₹{s.amount} / {s.frequency})</option>)}
                </select>
              </div>
              <div style={{ marginTop: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Period Label *</label>
                <input className="form-input" placeholder="e.g. April 2026" value={generateForm.period_label}
                  onChange={e => setGenerateForm(f => ({ ...f, period_label: e.target.value }))} required />
              </div>
              <div style={{ marginTop: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Due Date</label>
                <input type="date" className="form-input" value={generateForm.due_date}
                  onChange={e => setGenerateForm(f => ({ ...f, due_date: e.target.value }))} />
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 10 }}>
                Ye us route/school ke saare ACTIVE transport students ke liye ek-ek record banayega.
                Jinke paas already is period ka record hai unhe skip kar dega — dobara chalana safe hai.
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                <button type="button" onClick={() => setShowGenerate(false)} style={{
                  background: '#f1f5f9', color: '#334155', border: 'none', borderRadius: 8,
                  padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}>Cancel</button>
                <button type="submit" disabled={generating} style={{
                  background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8,
                  padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: generating ? 'not-allowed' : 'pointer',
                  opacity: generating ? 0.7 : 1,
                }}>{generating ? 'Generating...' : 'Generate'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Collect payment modal ── */}
      {collectRecord && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setCollectRecord(null)}>
          <div className="modal" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h3>Collect Payment — {collectRecord.student_name}</h3>
              <button className="modal-close" onClick={() => setCollectRecord(null)}>✕</button>
            </div>
            <form onSubmit={handleCollect} className="modal-body">
              <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 10 }}>
                Balance due: <strong style={{ color: '#dc2626' }}>₹{collectRecord.balance.toLocaleString()}</strong>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Amount Paid (₹) *</label>
                <input type="number" min="1" className="form-input" value={collectForm.amount_paid}
                  onChange={e => setCollectForm(f => ({ ...f, amount_paid: e.target.value }))} required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Payment Mode</label>
                  <select className="form-input" value={collectForm.payment_mode}
                    onChange={e => setCollectForm(f => ({ ...f, payment_mode: e.target.value }))}>
                    {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Receipt Number</label>
                  <input className="form-input" value={collectForm.receipt_number}
                    onChange={e => setCollectForm(f => ({ ...f, receipt_number: e.target.value }))} />
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Transaction Ref</label>
                <input className="form-input" placeholder="UPI ref / cheque no." value={collectForm.transaction_ref}
                  onChange={e => setCollectForm(f => ({ ...f, transaction_ref: e.target.value }))} />
              </div>
              <div style={{ marginTop: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Remarks</label>
                <textarea className="form-input" rows={2} value={collectForm.remarks}
                  onChange={e => setCollectForm(f => ({ ...f, remarks: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                <button type="button" onClick={() => setCollectRecord(null)} style={{
                  background: '#f1f5f9', color: '#334155', border: 'none', borderRadius: 8,
                  padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}>Cancel</button>
                <button type="submit" disabled={collecting} style={{
                  background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8,
                  padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: collecting ? 'not-allowed' : 'pointer',
                  opacity: collecting ? 0.7 : 1,
                }}>{collecting ? 'Collecting...' : 'Collect Payment'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Waive modal ── */}
      {waiveRecord && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setWaiveRecord(null)}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h3>Waive Fee — {waiveRecord.student_name}</h3>
              <button className="modal-close" onClick={() => setWaiveRecord(null)}>✕</button>
            </div>
            <form onSubmit={handleWaive} className="modal-body">
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 10 }}>
                Sirf Principal waiver apply kar sakte hain.
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Waiver Amount (₹) *</label>
                <input type="number" min="0" className="form-input" value={waiveForm.waiver}
                  onChange={e => setWaiveForm(f => ({ ...f, waiver: e.target.value }))} required />
              </div>
              <div style={{ marginTop: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Reason</label>
                <textarea className="form-input" rows={2} value={waiveForm.remarks}
                  onChange={e => setWaiveForm(f => ({ ...f, remarks: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                <button type="button" onClick={() => setWaiveRecord(null)} style={{
                  background: '#f1f5f9', color: '#334155', border: 'none', borderRadius: 8,
                  padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}>Cancel</button>
                <button type="submit" disabled={waiving} style={{
                  background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8,
                  padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: waiving ? 'not-allowed' : 'pointer',
                  opacity: waiving ? 0.7 : 1,
                }}>{waiving ? 'Applying...' : 'Apply Waiver'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Transactions/receipts drawer ── */}
      {txnRecord && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setTxnRecord(null)}>
          <div className="modal" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h3>{txnRecord.student_name} — Payment History</h3>
              <button className="modal-close" onClick={() => setTxnRecord(null)}>✕</button>
            </div>
            <div className="modal-body">
              {txns.length === 0 ? (
                <p style={{ fontSize: 12, color: '#94a3b8' }}>Koi payment nahi hua abhi tak</p>
              ) : txns.map(t => (
                <div key={t.id} style={{ fontSize: 12, padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 700, color: '#16a34a' }}>₹{t.amount_paid.toLocaleString()} · {t.payment_mode}</span>
                    <span style={{ color: '#94a3b8' }}>{t.payment_date?.slice(0, 10)}</span>
                  </div>
                  {(t.receipt_number || t.transaction_ref) && (
                    <div style={{ color: '#64748b', marginTop: 2 }}>
                      {t.receipt_number && `Receipt: ${t.receipt_number}`}{t.receipt_number && t.transaction_ref && ' · '}
                      {t.transaction_ref && `Ref: ${t.transaction_ref}`}
                    </div>
                  )}
                  {t.remarks && <div style={{ color: '#94a3b8', fontStyle: 'italic', marginTop: 2 }}>{t.remarks}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
