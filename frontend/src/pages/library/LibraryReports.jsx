import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api     from '../../api/axios';
import toast   from 'react-hot-toast';

const fmt = n => (n || 0).toLocaleString('en-IN');

export default function LibraryReports() {
  const [darkMode, setDarkMode] = useState(localStorage.getItem('ederp_theme') === 'dark');
  const [tab, setTab] = useState('OVERDUE'); // OVERDUE | FINES | HISTORY | POPULAR | ACTIVITY

  const [loading, setLoading] = useState(true);

  // Overdue
  const [overdue, setOverdue] = useState([]);

  // Fines (paid transactions list)
  const [fineFrom, setFineFrom] = useState('');
  const [fineTo, setFineTo]     = useState('');
  const [fines, setFines]       = useState([]);
  const [fineSummary, setFineSummary] = useState({ total_collected: 0, total_pending: 0, total_waived: 0 });

  // Pending fines — Fine Center
  const [pendingFines, setPendingFines] = useState([]);
  const [actingFineId, setActingFineId] = useState(null);
  const [editAmounts, setEditAmounts] = useState({}); // { fineId: 'amount string' }

  // Manual fine modal
  const [manualModal, setManualModal] = useState(false);
  const [manualMemberSearch, setManualMemberSearch] = useState('');
  const [manualMemberResults, setManualMemberResults] = useState([]);
  const [manualSelectedMember, setManualSelectedMember] = useState(null);
  const [manualReason, setManualReason] = useState('LATE_SUBMISSION');
  const [manualAmount, setManualAmount] = useState('');
  const [manualSaving, setManualSaving] = useState(false);

  // Replacement modal
  const [replaceModal, setReplaceModal] = useState(null); // fine object

  // Popular books
  const [popular, setPopular] = useState([]);

  // Activity log
  const [activity, setActivity] = useState([]);

  // History
  const [classes, setClasses] = useState([]);
  const [historyClass, setHistoryClass] = useState('');
  const [historyMonth, setHistoryMonth] = useState('');
  const [historyStatus, setHistoryStatus] = useState('ALL');
  const [historyData, setHistoryData] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const cardStyle = {
    background: darkMode ? '#1e293b' : '#fff',
    border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
    borderRadius: 12, padding: 18,
  };
  const inputStyle = {
    padding: '8px 10px', fontSize: 13, border: '1px solid #e2e8f0', borderRadius: 8,
  };

  const loadOverdue = useCallback(() => {
    setLoading(true);
    api.get('/library/reports/overdue')
      .then(r => setOverdue(r.data || []))
      .catch(() => toast.error('Overdue report load nahi ho paya'))
      .finally(() => setLoading(false));
  }, []);

  const loadFines = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (fineFrom) params.set('from_date', fineFrom);
    if (fineTo)   params.set('to_date', fineTo);
    api.get('/library/reports/fine-collection?' + params.toString())
      .then(r => {
        setFines(r.data.data || []);
        setFineSummary(prev => ({ ...prev, total_collected: r.data.total_collected || 0 }));
      })
      .catch(() => toast.error('Fine report load nahi ho payi'))
      .finally(() => setLoading(false));
  }, [fineFrom, fineTo]);

  const loadPendingFines = useCallback(() => {
    Promise.all([
      api.get('/library/fines?status=PENDING'),
      api.get('/library/fines?status=PARTIAL'),
    ])
      .then(([p, pa]) => {
        const combined = [...(p.data || []), ...(pa.data || [])];
        setPendingFines(combined);
        const totalPending = combined.reduce((s, f) => s + (f.amount - f.amount_paid), 0);
        setFineSummary(prev => ({ ...prev, total_pending: totalPending }));
      })
      .catch(() => setPendingFines([]));
  }, []);

  const loadPopular = useCallback(() => {
    setLoading(true);
    api.get('/library/reports/popular-books')
      .then(r => setPopular(r.data || []))
      .catch(() => toast.error('Popular books report load nahi ho paya'))
      .finally(() => setLoading(false));
  }, []);

  const loadActivity = useCallback(() => {
    setLoading(true);
    api.get('/library/reports/activity-log?limit=50')
      .then(r => setActivity(r.data || []))
      .catch(() => toast.error('Activity log load nahi ho paya'))
      .finally(() => setLoading(false));
  }, []);

  const loadClasses = useCallback(() => {
    api.get('/library/classes').then(r => setClasses(r.data || [])).catch(() => setClasses([]));
  }, []);

  const loadHistory = useCallback(() => {
    setHistoryLoading(true);
    const params = new URLSearchParams();
    params.set('status', historyStatus || 'ALL');
    params.set('per_page', '200');
    if (historyClass) params.set('class_id', historyClass);
    if (historyMonth) params.set('month', historyMonth);
    api.get('/library/issues?' + params.toString())
      .then(r => setHistoryData(r.data?.data || []))
      .catch(() => toast.error('History load nahi ho payi'))
      .finally(() => setHistoryLoading(false));
  }, [historyClass, historyMonth, historyStatus]);

  useEffect(() => {
    if (tab === 'OVERDUE')  loadOverdue();
    if (tab === 'FINES')    { loadFines(); loadPendingFines(); }
    if (tab === 'HISTORY')  { loadClasses(); loadHistory(); }
    if (tab === 'POPULAR')  loadPopular();
    if (tab === 'ACTIVITY') loadActivity();
  }, [tab, loadOverdue, loadFines, loadPendingFines, loadHistory, loadClasses, loadPopular, loadActivity]);

  // History filters change hone pe reload (agar HISTORY tab active hai)
  useEffect(() => {
    if (tab === 'HISTORY') loadHistory();
  }, [historyClass, historyMonth, historyStatus]); // eslint-disable-line

  async function sendReminder(issueId) {
    try {
      await api.post(`/library/reports/overdue/${issueId}/remind`);
      toast.success('Reminder sent');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Reminder nahi bheja ja saka');
    }
  }

  function exportCSV(rows, filename, headers) {
    if (!rows.length) { toast.error('Export karne ke liye data nahi hai'); return; }
    const csvRows = [
      headers.map(h => h.label).join(','),
      ...rows.map(row => headers.map(h => `"${(row[h.key] ?? '').toString().replace(/"/g, '""')}"`).join(',')),
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Fine Center actions ──
  function getEditAmount(fine) {
    return editAmounts[fine.id] ?? String(fine.amount - fine.amount_paid);
  }

  async function collectPendingFine(fine) {
    const amt = parseFloat(getEditAmount(fine));
    if (isNaN(amt) || amt <= 0) { toast.error('Sahi amount daalo'); return; }
    setActingFineId(fine.id);
    try {
      await api.post(`/library/fines/${fine.id}/collect`, { amount: amt });
      toast.success(`₹${amt} collect ho gaya — Fees Management mein bhi update ho gaya`);
      loadPendingFines();
      loadFines();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Collect nahi ho paya');
    }
    setActingFineId(null);
  }

  async function waivePendingFine(fine) {
    const reason = window.prompt('Waive karne ka reason likho:');
    if (!reason) return;
    setActingFineId(fine.id);
    try {
      await api.post(`/library/fines/${fine.id}/waive`, { reason });
      toast.success('Fine waived');
      loadPendingFines();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Waive nahi ho paya');
    }
    setActingFineId(null);
  }

  async function confirmReplacement(addCopy) {
    if (!replaceModal) return;
    setActingFineId(replaceModal.id);
    try {
      await api.post(`/library/fines/${replaceModal.id}/resolve-replacement`, {
        add_replacement_copy: addCopy,
        remarks: addCopy ? 'Student ne naya copy la kar diya' : 'Replacement bina naye copy ke resolve kiya',
      });
      toast.success(addCopy ? 'Fine resolved + naya copy library stock mein add ho gaya' : 'Fine resolved');
      setReplaceModal(null);
      loadPendingFines();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Resolve nahi ho paya');
    }
    setActingFineId(null);
  }

  // ── Manual fine ──
  useEffect(() => {
    if (!manualMemberSearch.trim()) { setManualMemberResults([]); return; }
    const t = setTimeout(() => {
      api.get('/library/members?search=' + encodeURIComponent(manualMemberSearch))
        .then(r => setManualMemberResults(r.data || []))
        .catch(() => setManualMemberResults([]));
    }, 300);
    return () => clearTimeout(t);
  }, [manualMemberSearch]);

  async function submitManualFine() {
    if (!manualSelectedMember) { toast.error('Member select karo'); return; }
    const amt = parseFloat(manualAmount);
    if (isNaN(amt) || amt <= 0) { toast.error('Sahi amount daalo'); return; }
    setManualSaving(true);
    try {
      await api.post('/library/fines/manual', {
        member_id: manualSelectedMember.id,
        reason: manualReason,
        amount: amt,
      });
      toast.success('Fine add ho gayi — Fees Management mein bhi dikh jayegi');
      setManualModal(false);
      setManualSelectedMember(null);
      setManualAmount('');
      setManualReason('LATE_SUBMISSION');
      loadPendingFines();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Fine add nahi ho payi');
    }
    setManualSaving(false);
  }

  const TABS = [
    { key: 'OVERDUE',  label: '⏰ Overdue Books' },
    { key: 'FINES',    label: '💰 Fine Center' },
    { key: 'HISTORY',  label: '📖 Issue History' },
    { key: 'POPULAR',  label: '📈 Popular Books' },
    { key: 'ACTIVITY', label: '📋 Activity Log' },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: darkMode ? '#0f172a' : '#f8fafc' }}>
      <Sidebar darkMode={darkMode} />
      <div style={{ marginLeft: 232, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Navbar title="Library Reports" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />

        <div style={{ padding: 24, maxWidth: 1100 }}>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                padding: '9px 18px', fontSize: 13, fontWeight: 700, borderRadius: 8,
                border: 'none', cursor: 'pointer',
                background: tab === t.key ? '#4f46e5' : (darkMode ? '#1e293b' : '#e2e8f0'),
                color: tab === t.key ? '#fff' : (darkMode ? '#94a3b8' : '#64748b'),
              }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* ── OVERDUE ── */}
          {tab === 'OVERDUE' && (
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h4 style={{ margin: 0, fontSize: 14, color: darkMode ? '#f1f5f9' : '#0f172a' }}>
                  Overdue Books ({overdue.length})
                </h4>
                <button onClick={() => exportCSV(overdue, 'overdue_books.csv', [
                  { key: 'book_title', label: 'Book' },
                  { key: 'member_name', label: 'Member' },
                  { key: 'due_date', label: 'Due Date' },
                  { key: 'overdue_days', label: 'Overdue Days' },
                  { key: 'estimated_fine', label: 'Estimated Fine' },
                ])} style={{
                  background: '#eef2ff', color: '#4f46e5', border: 'none', borderRadius: 6,
                  padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}>
                  ⬇ Export CSV
                </button>
              </div>

              {loading ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Loading...</div>
              ) : overdue.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Koi overdue book nahi hai 🎉</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, textAlign: 'left' }}>
                      <th style={{ padding: '8px 6px', color: '#94a3b8', fontSize: 11 }}>BOOK</th>
                      <th style={{ padding: '8px 6px', color: '#94a3b8', fontSize: 11 }}>MEMBER</th>
                      <th style={{ padding: '8px 6px', color: '#94a3b8', fontSize: 11 }}>DUE DATE</th>
                      <th style={{ padding: '8px 6px', color: '#94a3b8', fontSize: 11 }}>OVERDUE</th>
                      <th style={{ padding: '8px 6px', color: '#94a3b8', fontSize: 11 }}>EST. FINE</th>
                      <th style={{ padding: '8px 6px', color: '#94a3b8', fontSize: 11 }}>ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overdue.map(o => (
                      <tr key={o.issue_id} style={{ borderBottom: `1px solid ${darkMode ? '#334155' : '#f1f5f9'}` }}>
                        <td style={{ padding: '10px 6px', fontWeight: 600, color: darkMode ? '#f1f5f9' : '#0f172a' }}>{o.book_title}</td>
                        <td style={{ padding: '10px 6px', color: '#64748b' }}>{o.member_name}</td>
                        <td style={{ padding: '10px 6px', color: '#64748b' }}>{o.due_date}</td>
                        <td style={{ padding: '10px 6px' }}>
                          <span style={{
                            fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                            background: '#fef2f2', color: '#dc2626',
                          }}>
                            {o.overdue_days} days
                          </span>
                        </td>
                        <td style={{ padding: '10px 6px', color: '#dc2626', fontWeight: 700 }}>₹{fmt(o.estimated_fine)}</td>
                        <td style={{ padding: '10px 6px' }}>
                          <button onClick={() => sendReminder(o.issue_id)} style={{
                            background: '#eff6ff', color: '#0176d3', border: 'none', borderRadius: 6,
                            padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                          }}>
                            🔔 Remind
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ── FINE CENTER ── */}
          {tab === 'FINES' && (
            <>
              <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input type="date" value={fineFrom} onChange={e => setFineFrom(e.target.value)} style={inputStyle} />
                  <span style={{ color: '#94a3b8', fontSize: 12 }}>to</span>
                  <input type="date" value={fineTo} onChange={e => setFineTo(e.target.value)} style={inputStyle} />
                  {(fineFrom || fineTo) && (
                    <button onClick={() => { setFineFrom(''); setFineTo(''); }} style={{
                      background: '#f1f5f9', border: 'none', borderRadius: 6,
                      padding: '7px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}>✕ Clear</button>
                  )}
                </div>
                <button onClick={() => setManualModal(true)} style={{
                  background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8,
                  padding: '9px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}>
                  + Manual Fine Add Karo
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 16 }}>
                {[
                  { label: 'Collected', value: fineSummary.total_collected, color: '#16a34a', bg: '#f0fdf4' },
                  { label: 'Pending',   value: fineSummary.total_pending,   color: '#dc2626', bg: '#fef2f2' },
                  { label: 'Waived',    value: fineSummary.total_waived,    color: '#64748b', bg: '#f1f5f9' },
                ].map(s => (
                  <div key={s.label} style={{ ...cardStyle, background: s.bg, border: 'none' }}>
                    <div style={{ fontSize: 11, color: s.color, fontWeight: 700 }}>{s.label.toUpperCase()}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: s.color, marginTop: 4 }}>₹{fmt(s.value)}</div>
                  </div>
                ))}
              </div>

              {/* Pending fines — action cards */}
              <div style={{ ...cardStyle, marginBottom: 16 }}>
                <h4 style={{ margin: '0 0 4px', fontSize: 14, color: darkMode ? '#f1f5f9' : '#0f172a' }}>
                  ⏳ Pending Fines — Action Needed ({pendingFines.length})
                </h4>
                <p style={{ fontSize: 11, color: '#94a3b8', margin: '0 0 12px' }}>
                  Amount edit karke Collect kar sakte ho (partial recovery), Waive kar sakte ho, ya LOST book ke liye "Replaced with Book" use karo.
                </p>
                {pendingFines.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 20, color: '#94a3b8', fontSize: 13 }}>
                    Koi pending fine nahi hai 🎉
                  </div>
                ) : (
                  pendingFines.map(f => (
                    <div key={f.id} style={{
                      padding: '12px 0', borderBottom: `1px solid ${darkMode ? '#334155' : '#f1f5f9'}`,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: darkMode ? '#f1f5f9' : '#0f172a' }}>
                            {f.member_name} {f.class_name ? `· ${f.class_name}` : ''} {f.roll_number ? `· Roll ${f.roll_number}` : ''}
                          </div>
                          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                            Reason: <strong>{f.reason}</strong>
                            {f.book_title && <> · Book: {f.book_title}</>}
                            {f.book_mrp != null && <> · Book Price: ₹{fmt(f.book_mrp)}</>}
                          </div>
                          {f.overdue_days != null && f.overdue_days > 0 && (
                            <div style={{ fontSize: 11, color: '#dc2626', marginTop: 2 }}>
                              {f.overdue_days} din late
                            </div>
                          )}
                          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                            Original Fine: ₹{fmt(f.amount)} {f.amount_paid > 0 && `· Already Paid: ₹${fmt(f.amount_paid)}`}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input
                            type="number"
                            value={getEditAmount(f)}
                            onChange={e => setEditAmounts(prev => ({ ...prev, [f.id]: e.target.value }))}
                            style={{ width: 90, padding: '5px 8px', fontSize: 12, border: '1px solid #e2e8f0', borderRadius: 6 }}
                          />
                          <button
                            disabled={actingFineId === f.id}
                            onClick={() => collectPendingFine(f)}
                            style={{
                              background: '#f0fdf4', color: '#16a34a', border: 'none', borderRadius: 6,
                              padding: '6px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                            }}>
                            💰 Collect
                          </button>
                          <button
                            disabled={actingFineId === f.id}
                            onClick={() => waivePendingFine(f)}
                            style={{
                              background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: 6,
                              padding: '6px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                            }}>
                            ✕ Waive
                          </button>
                          {f.reason === 'LOST' && (
                            <button
                              disabled={actingFineId === f.id}
                              onClick={() => setReplaceModal(f)}
                              style={{
                                background: '#eff6ff', color: '#0176d3', border: 'none', borderRadius: 6,
                                padding: '6px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                              }}>
                              📚 Replaced with Book
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <h4 style={{ margin: 0, fontSize: 14, color: darkMode ? '#f1f5f9' : '#0f172a' }}>
                    Transactions ({fines.length})
                  </h4>
                  <button onClick={() => exportCSV(fines, 'fine_transactions.csv', [
                    { key: 'member_name', label: 'Member' },
                    { key: 'reason', label: 'Reason' },
                    { key: 'amount', label: 'Amount' },
                    { key: 'status', label: 'Status' },
                    { key: 'created_at', label: 'Date' },
                  ])} style={{
                    background: '#eef2ff', color: '#4f46e5', border: 'none', borderRadius: 6,
                    padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  }}>
                    ⬇ Export CSV
                  </button>
                </div>

                {loading ? (
                  <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Loading...</div>
                ) : fines.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Is range mein koi transaction nahi hai</div>
                ) : (
                  fines.map(f => (
                    <div key={f.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '10px 0', borderBottom: `1px solid ${darkMode ? '#334155' : '#f1f5f9'}`,
                    }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: darkMode ? '#f1f5f9' : '#0f172a' }}>
                          {f.member_name} — {f.reason}
                        </div>
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>
                          {new Date(f.created_at).toLocaleDateString('en-IN')}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: darkMode ? '#f1f5f9' : '#0f172a' }}>₹{fmt(f.amount)}</div>
                        <span style={{
                          fontSize: 10, fontWeight: 700,
                          color: f.status === 'PAID' ? '#16a34a' : f.status === 'WAIVED' ? '#64748b' : '#dc2626',
                        }}>
                          {f.status}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {/* ── ISSUE HISTORY ── */}
          {tab === 'HISTORY' && (
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                <h4 style={{ margin: 0, fontSize: 14, color: darkMode ? '#f1f5f9' : '#0f172a' }}>
                  📖 Issue History ({historyData.length})
                </h4>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <select value={historyClass} onChange={e => setHistoryClass(e.target.value)}
                    style={{ ...inputStyle, minWidth: 130 }}>
                    <option value="">All Classes</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name} - {c.section}</option>)}
                  </select>
                  <input type="month" value={historyMonth} onChange={e => setHistoryMonth(e.target.value)} style={inputStyle} />
                  <select value={historyStatus} onChange={e => setHistoryStatus(e.target.value)}
                    style={{ ...inputStyle, minWidth: 110 }}>
                    <option value="ALL">All Status</option>
                    <option value="ISSUED">Issued</option>
                    <option value="RETURNED">Returned</option>
                    <option value="LOST">Lost</option>
                  </select>
                  {(historyClass || historyMonth || historyStatus !== 'ALL') && (
                    <button onClick={() => { setHistoryClass(''); setHistoryMonth(''); setHistoryStatus('ALL'); }} style={{
                      background: '#f1f5f9', border: 'none', borderRadius: 6,
                      padding: '7px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}>✕ Clear</button>
                  )}
                  <button onClick={() => exportCSV(historyData, 'issue_history.csv', [
                    { key: 'member_name', label: 'Student' },
                    { key: 'class_name', label: 'Class' },
                    { key: 'roll_number', label: 'Roll No' },
                    { key: 'book_title', label: 'Book' },
                    { key: 'issue_date', label: 'Issue Date' },
                    { key: 'due_date', label: 'Due Date' },
                    { key: 'return_date', label: 'Return Date' },
                    { key: 'status', label: 'Status' },
                    { key: 'estimated_fine', label: 'Fine' },
                  ])} style={{
                    background: '#eef2ff', color: '#4f46e5', border: 'none', borderRadius: 6,
                    padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  }}>
                    ⬇ Export CSV
                  </button>
                </div>
              </div>

              {historyLoading ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Loading...</div>
              ) : historyData.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Is filter ke liye koi record nahi mila</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, textAlign: 'left' }}>
                        <th style={{ padding: '8px 6px', color: '#94a3b8', fontSize: 10 }}>STUDENT</th>
                        <th style={{ padding: '8px 6px', color: '#94a3b8', fontSize: 10 }}>CLASS</th>
                        <th style={{ padding: '8px 6px', color: '#94a3b8', fontSize: 10 }}>ROLL</th>
                        <th style={{ padding: '8px 6px', color: '#94a3b8', fontSize: 10 }}>BOOK</th>
                        <th style={{ padding: '8px 6px', color: '#94a3b8', fontSize: 10 }}>ISSUE DATE</th>
                        <th style={{ padding: '8px 6px', color: '#94a3b8', fontSize: 10 }}>DUE DATE</th>
                        <th style={{ padding: '8px 6px', color: '#94a3b8', fontSize: 10 }}>RETURN DATE</th>
                        <th style={{ padding: '8px 6px', color: '#94a3b8', fontSize: 10 }}>STATUS</th>
                        <th style={{ padding: '8px 6px', color: '#94a3b8', fontSize: 10 }}>FINE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyData.map(i => (
                        <tr key={i.id} style={{ borderBottom: `1px solid ${darkMode ? '#334155' : '#f1f5f9'}` }}>
                          <td style={{ padding: '8px 6px', fontWeight: 600, color: darkMode ? '#f1f5f9' : '#0f172a' }}>{i.member_name}</td>
                          <td style={{ padding: '8px 6px', color: '#64748b' }}>{i.class_name || '—'}</td>
                          <td style={{ padding: '8px 6px', color: '#64748b' }}>{i.roll_number || '—'}</td>
                          <td style={{ padding: '8px 6px', color: '#64748b' }}>{i.book_title}</td>
                          <td style={{ padding: '8px 6px', color: '#64748b' }}>{i.issue_date}</td>
                          <td style={{ padding: '8px 6px', color: '#64748b' }}>{i.due_date}</td>
                          <td style={{ padding: '8px 6px', color: '#64748b' }}>{i.return_date || '—'}</td>
                          <td style={{ padding: '8px 6px' }}>
                            <span style={{
                              fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                              background: i.status === 'RETURNED' ? '#f0fdf4' : i.status === 'LOST' ? '#fef2f2' : '#eff6ff',
                              color: i.status === 'RETURNED' ? '#16a34a' : i.status === 'LOST' ? '#dc2626' : '#0176d3',
                            }}>{i.status}</span>
                          </td>
                          <td style={{ padding: '8px 6px' }}>
                            {i.estimated_fine > 0 ? (
                              <span style={{ color: '#dc2626', fontWeight: 700 }}>₹{fmt(i.estimated_fine)}</span>
                            ) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── POPULAR BOOKS ── */}
          {tab === 'POPULAR' && (
            <div style={cardStyle}>
              <h4 style={{ margin: '0 0 14px', fontSize: 14, color: darkMode ? '#f1f5f9' : '#0f172a' }}>
                Most Issued Books
              </h4>
              {loading ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Loading...</div>
              ) : popular.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Abhi data nahi hai</div>
              ) : (
                popular.map((p, idx) => (
                  <div key={p.book_id} style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '10px 0', borderBottom: `1px solid ${darkMode ? '#334155' : '#f1f5f9'}`,
                  }}>
                    <span style={{
                      width: 26, height: 26, borderRadius: '50%',
                      background: idx < 3 ? '#fef3c7' : '#f1f5f9',
                      color: idx < 3 ? '#d97706' : '#64748b',
                      fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {idx + 1}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: darkMode ? '#f1f5f9' : '#0f172a' }}>
                        {p.title}
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>{p.author}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#4f46e5' }}>{p.issue_count}</div>
                      <div style={{ fontSize: 10, color: '#94a3b8' }}>issues</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── ACTIVITY LOG ── */}
          {tab === 'ACTIVITY' && (
            <div style={cardStyle}>
              <h4 style={{ margin: '0 0 14px', fontSize: 14, color: darkMode ? '#f1f5f9' : '#0f172a' }}>
                Recent Activity
              </h4>
              {loading ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Loading...</div>
              ) : activity.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Koi activity nahi hai</div>
              ) : (
                activity.map(a => (
                  <div key={a.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                    padding: '10px 0', borderBottom: `1px solid ${darkMode ? '#334155' : '#f1f5f9'}`,
                  }}>
                    <div>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                        background: '#eef2ff', color: '#4f46e5', marginRight: 8,
                      }}>
                        {a.action}
                      </span>
                      <span style={{ fontSize: 12, color: darkMode ? '#cbd5e1' : '#334155' }}>{a.details}</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap', marginLeft: 12 }}>
                      {new Date(a.created_at).toLocaleString('en-IN')}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* ══ MANUAL FINE MODAL ══ */}
      {manualModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={e => e.target === e.currentTarget && setManualModal(false)}>
          <div style={{
            background: darkMode ? '#1e293b' : '#fff', borderRadius: 12, padding: 20, width: 420,
          }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, color: darkMode ? '#f1f5f9' : '#0f172a' }}>
              + Manual Fine Add Karo
            </h3>

            <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Member</label>
            {manualSelectedMember ? (
              <div style={{
                marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 10,
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{manualSelectedMember.name}</div>
                  <div style={{ fontSize: 11, color: '#16a34a' }}>{manualSelectedMember.card_number}</div>
                </div>
                <button onClick={() => setManualSelectedMember(null)} style={{
                  background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                }}>Change</button>
              </div>
            ) : (
              <>
                <input value={manualMemberSearch} onChange={e => setManualMemberSearch(e.target.value)}
                  placeholder="Search by name or card number..."
                  style={{ ...inputStyle, width: '100%', marginTop: 6, boxSizing: 'border-box' }} />
                {manualMemberResults.length > 0 && (
                  <div style={{ marginTop: 6, maxHeight: 150, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                    {manualMemberResults.map(m => (
                      <div key={m.id}
                        onClick={() => { setManualSelectedMember(m); setManualMemberSearch(''); setManualMemberResults([]); }}
                        style={{ padding: '8px 10px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid #f1f5f9' }}>
                        <strong>{m.name}</strong> — {m.card_number}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginTop: 14 }}>Reason</label>
            <select value={manualReason} onChange={e => setManualReason(e.target.value)}
              style={{ ...inputStyle, width: '100%', marginTop: 6, boxSizing: 'border-box' }}>
              <option value="LATE_SUBMISSION">Late Submission</option>
              <option value="MISCONDUCT">Misconduct / Rule Violation</option>
              <option value="MANUAL">Other / Manual Adjustment</option>
            </select>

            <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginTop: 14 }}>Amount (₹)</label>
            <input type="number" value={manualAmount} onChange={e => setManualAmount(e.target.value)}
              placeholder="e.g. 50"
              style={{ ...inputStyle, width: '100%', marginTop: 6, boxSizing: 'border-box' }} />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button onClick={() => setManualModal(false)} style={{
                background: '#f1f5f9', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer',
              }}>Cancel</button>
              <button onClick={submitManualFine} disabled={manualSaving} style={{
                background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8,
                padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}>
                {manualSaving ? 'Adding...' : '✅ Add Fine'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ REPLACED WITH BOOK MODAL ══ */}
      {replaceModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={e => e.target === e.currentTarget && setReplaceModal(null)}>
          <div style={{
            background: darkMode ? '#1e293b' : '#fff', borderRadius: 12, padding: 20, width: 420,
          }}>
            <h3 style={{ margin: '0 0 10px', fontSize: 16, color: darkMode ? '#f1f5f9' : '#0f172a' }}>
              📚 Book Replace Karke Fine Resolve Karo
            </h3>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
              <strong>{replaceModal.member_name}</strong> ne <strong>{replaceModal.book_title}</strong> khoyi thi
              (₹{fmt(replaceModal.book_mrp)} ki fine thi). Agar student ne cash ki jagah naya physical copy la kar
              diya hai, to yahan se fine waive ho jayegi.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={() => confirmReplacement(true)}
                disabled={actingFineId === replaceModal.id}
                style={{
                  background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: 8,
                  padding: '10px', fontSize: 13, fontWeight: 700, cursor: 'pointer', textAlign: 'left',
                }}>
                ✅ Naya copy library stock mein add karo + Fine waive karo<br/>
                <span style={{ fontWeight: 400, fontSize: 11, color: '#64748b' }}>
                  (Student ne fizikal copy di hai — library ke inventory mein wo copy AVAILABLE ho jayegi)
                </span>
              </button>
              <button
                onClick={() => confirmReplacement(false)}
                disabled={actingFineId === replaceModal.id}
                style={{
                  background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 8,
                  padding: '10px', fontSize: 13, fontWeight: 700, cursor: 'pointer', textAlign: 'left',
                }}>
                ✕ Sirf fine waive karo (koi naya copy add nahi)
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => setReplaceModal(null)} style={{
                background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 12,
              }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
