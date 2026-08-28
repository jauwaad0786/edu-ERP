import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api     from '../../api/axios';
import toast   from 'react-hot-toast';

export default function LibraryFines() {
  const [darkMode, setDarkMode] = useState(localStorage.getItem('ederp_theme') === 'dark');
  const [fines, setFines] = useState([]);
  const [loading, setLoading] = useState(true);

  // ── Filters ──
  const [statusFilter, setStatusFilter] = useState('OUTSTANDING'); // 'OUTSTANDING' | 'ALL' | 'PAID' | 'WAIVED'
  const [searchTerm, setSearchTerm]     = useState('');
  const [reasonFilter, setReasonFilter] = useState('ALL');

  // ── Modals State ──
  const [collectModal, setCollectModal] = useState(null); // Fine object
  const [collectAmount, setCollectAmount] = useState('');
  const [collectMode, setCollectMode]   = useState('CASH');
  const [collectRemarks, setCollectRemarks] = useState('');
  const [collecting, setCollecting]     = useState(false);

  const [waiveModal, setWaiveModal]     = useState(null); // Fine object
  const [waiveAmount, setWaiveAmount]   = useState('');
  const [waiveReason, setWaiveReason]   = useState('');
  const [waiving, setWaiving]           = useState(false);

  const [manualModal, setManualModal]   = useState(false);
  const [manualMemberSearch, setManualMemberSearch] = useState('');
  const [manualMemberResults, setManualMemberResults] = useState([]);
  const [manualSelectedMember, setManualSelectedMember] = useState(null);
  const [manualReason, setManualReason] = useState('LOST_CARD');
  const [manualAmount, setManualAmount] = useState('50');
  const [manualRemarks, setManualRemarks] = useState('');
  const [creatingManual, setCreatingManual] = useState(false);

  // ── Fetch Fines ──
  const loadFines = useCallback(() => {
    setLoading(true);
    let url = '/library/fines';
    if (statusFilter !== 'ALL') {
      url += `?status=${statusFilter}`;
    }
    api.get(url)
      .then(r => setFines(r.data || []))
      .catch(() => {
        toast.error('Failed to load library fines');
        setFines([]);
      })
      .finally(() => setLoading(false));
  }, [statusFilter]);

  useEffect(() => {
    loadFines();
  }, [loadFines]);

  // ── Debounced Member Search for Manual Fine ──
  useEffect(() => {
    if (!manualMemberSearch.trim()) { setManualMemberResults([]); return; }
    const t = setTimeout(() => {
      api.get('/library/members?search=' + encodeURIComponent(manualMemberSearch.trim()))
        .then(r => setManualMemberResults(r.data || []))
        .catch(() => setManualMemberResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [manualMemberSearch]);

  // ── Collect Payment Handler ──
  async function handleCollectPayment() {
    if (!collectModal) return;
    const amt = parseFloat(collectAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error('Please enter a valid payment amount');
      return;
    }
    setCollecting(true);
    try {
      await api.post(`/library/fines/${collectModal.id}/collect`, {
        amount: amt,
        payment_mode: collectMode,
        remarks: collectRemarks || 'Collected at Library Desk',
      });
      toast.success(`Payment of ₹${amt} collected successfully! Status updated in Fee Management.`);
      setCollectModal(null);
      loadFines();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Payment collection failed');
    }
    setCollecting(false);
  }

  // ── Waive Fine Handler ──
  async function handleWaiveFine() {
    if (!waiveModal) return;
    const amt = parseFloat(waiveAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error('Please enter a valid waiver amount');
      return;
    }
    if (!waiveReason.trim()) {
      toast.error('Please enter a waiver reason for audit records');
      return;
    }
    setWaiving(true);
    try {
      await api.post(`/library/fines/${waiveModal.id}/waive`, {
        waived_amount: amt,
        reason: waiveReason.trim(),
      });
      toast.success(`₹${amt} waived successfully. Discount synced with Fee Management.`);
      setWaiveModal(null);
      loadFines();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Waiver failed');
    }
    setWaiving(false);
  }

  // ── Create Manual Fine Handler ──
  async function handleCreateManualFine() {
    if (!manualSelectedMember) {
      toast.error('Please select a student or staff member');
      return;
    }
    const amt = parseFloat(manualAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error('Please enter a valid fine amount');
      return;
    }
    setCreatingManual(true);
    try {
      await api.post('/library/fines/manual', {
        member_id: manualSelectedMember.id,
        reason: manualReason,
        amount: amt,
        remarks: manualRemarks || 'Manual assessment',
      });
      toast.success(`Fine of ₹${amt} assessed to ${manualSelectedMember.name} (Logged as Pending Due in Fee Management)`);
      setManualModal(false);
      setManualSelectedMember(null);
      setManualMemberSearch('');
      setManualAmount('50');
      setManualRemarks('');
      loadFines();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create fine');
    }
    setCreatingManual(false);
  }

  // ── Filtered List ──
  const filteredFines = fines.filter(f => {
    if (reasonFilter !== 'ALL' && f.reason !== reasonFilter) return false;
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      (f.member_name || '').toLowerCase().includes(q) ||
      (f.class_name || '').toLowerCase().includes(q) ||
      (f.roll_number || '').toLowerCase().includes(q) ||
      (f.book_title || '').toLowerCase().includes(q) ||
      (f.reason || '').toLowerCase().includes(q) ||
      (f.receipt_no || '').toLowerCase().includes(q)
    );
  });

  // ── Calculate KPIs ──
  const totalOutstanding = fines.reduce((sum, f) => sum + (f.outstanding_amount || 0), 0);
  const totalCollected   = fines.reduce((sum, f) => sum + (f.amount_paid || 0), 0);
  const totalWaived      = fines.reduce((sum, f) => sum + (f.waived_amount || 0), 0);

  const cardStyle = {
    background: darkMode ? '#111827' : '#ffffff',
    border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
    borderRadius: '16px',
    padding: '20px',
    boxShadow: darkMode ? '0 10px 25px rgba(0,0,0,0.3)' : '0 4px 20px rgba(0,0,0,0.05)',
  };

  const inputStyle = {
    width: '100%',
    padding: '10px 14px',
    fontSize: '13.5px',
    background: darkMode ? '#1e293b' : '#f8fafc',
    border: `1px solid ${darkMode ? '#334155' : '#cbd5e1'}`,
    borderRadius: '10px',
    color: darkMode ? '#ffffff' : '#0f172a',
    outline: 'none',
    boxSizing: 'border-box',
  };

  function getReasonBadge(reason) {
    switch (reason) {
      case 'OVERDUE':
        return <span className="badge badge-error">LATE OVERDUE</span>;
      case 'LOST':
        return <span className="badge badge-error" style={{ background: '#7f1d1d', color: '#fecaca' }}>BOOK LOST</span>;
      case 'DAMAGED':
        return <span className="badge badge-warning">BOOK DAMAGED</span>;
      case 'LOST_CARD':
        return <span className="badge badge-info">LOST CARD</span>;
      default:
        return <span className="badge badge-secondary">{reason || 'OTHER'}</span>;
    }
  }

  function getStatusBadge(status, outstanding) {
    if (status === 'PAID' || outstanding <= 0) {
      return <span className="badge badge-success">PAID</span>;
    }
    if (status === 'WAIVED') {
      return <span className="badge badge-secondary">WAIVED</span>;
    }
    if (status === 'PARTIALLY_PAID' || status === 'PARTIAL') {
      return <span className="badge badge-warning">PARTIAL DUE</span>;
    }
    return <span className="badge badge-error">OUTSTANDING</span>;
  }

  return (
    <div className={`app-shell${darkMode ? ' theme-dark' : ''}`}>
      <Sidebar darkMode={darkMode} />
      <div className="main-content">
        <Navbar title="Library Fines & Dues Management" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />

        <div className="page-body" style={{ padding: '24px', maxWidth: '1200px' }}>

          {/* ══ Header Banner ══ */}
          <div style={{
            background: darkMode
              ? 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #0f172a 100%)'
              : 'linear-gradient(135deg, #4338ca 0%, #4f46e5 50%, #6366f1 100%)',
            borderRadius: '20px', padding: '24px 30px', marginBottom: '24px', color: '#ffffff',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px'
          }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.18)', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 700, marginBottom: '8px' }}>
                💳 Financial Ledger Integration
              </div>
              <h2 style={{ margin: '0 0 6px', fontSize: '24px', fontWeight: 800 }}>
                Library Fines &amp; Fee Collection
              </h2>
              <p style={{ margin: 0, fontSize: '13.5px', color: 'rgba(255,255,255,0.85)' }}>
                Track outstanding library dues, collect payments with ledger sync, and audit fine waivers.
              </p>
            </div>

            <button
              onClick={() => setManualModal(true)}
              style={{
                background: '#ffffff', color: '#4338ca', border: 'none', borderRadius: '12px',
                padding: '12px 24px', fontSize: '13.5px', fontWeight: 800, cursor: 'pointer',
                boxShadow: '0 6px 18px rgba(0,0,0,0.18)'
              }}
            >
              + Assess Manual Fine / Penalty
            </button>
          </div>

          {/* ══ KPI Summary Cards ══ */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div style={cardStyle}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', marginBottom: '6px' }}>
                Total Outstanding Dues
              </div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: '#ef4444' }}>
                ₹{totalOutstanding.toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '4px' }}>
                Unpaid library penalties in system
              </div>
            </div>

            <div style={cardStyle}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#10b981', textTransform: 'uppercase', marginBottom: '6px' }}>
                Total Fine Collected
              </div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: '#10b981' }}>
                ₹{totalCollected.toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '4px' }}>
                Successfully paid &amp; synced to Fee Management
              </div>
            </div>

            <div style={cardStyle}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#8b5cf6', textTransform: 'uppercase', marginBottom: '6px' }}>
                Total Amount Waived
              </div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: '#8b5cf6' }}>
                ₹{totalWaived.toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '4px' }}>
                Authorized discounts &amp; exemptions
              </div>
            </div>

            <div style={cardStyle}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase', marginBottom: '6px' }}>
                Total Fine Records
              </div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: darkMode ? '#fff' : '#0f172a' }}>
                {fines.length}
              </div>
              <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '4px' }}>
                Filtered ledger transactions
              </div>
            </div>
          </div>

          {/* ══ Filter & Search Bar ══ */}
          <div style={{ ...cardStyle, marginBottom: '20px', padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
              
              {/* Status Tabs */}
              <div style={{ display: 'flex', gap: '8px' }}>
                {[
                  { id: 'OUTSTANDING', label: '⚠️ Outstanding Dues' },
                  { id: 'ALL',         label: 'All Fines' },
                  { id: 'PAID',        label: '✅ Paid' },
                  { id: 'WAIVED',      label: '🛡️ Waived' },
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => setStatusFilter(t.id)}
                    style={{
                      padding: '8px 16px', fontSize: '13px', fontWeight: 700, borderRadius: '8px', border: 'none', cursor: 'pointer',
                      background: statusFilter === t.id ? '#4f46e5' : (darkMode ? '#1e293b' : '#f1f5f9'),
                      color: statusFilter === t.id ? '#ffffff' : (darkMode ? '#94a3b8' : '#475569'),
                      transition: 'all 0.2s'
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Search & Reason */}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', flex: 1, justifyContent: 'flex-end' }}>
                <select
                  value={reasonFilter}
                  onChange={e => setReasonFilter(e.target.value)}
                  style={{ ...inputStyle, width: '160px', padding: '8px 12px' }}
                >
                  <option value="ALL">All Reasons</option>
                  <option value="OVERDUE">Late Overdue</option>
                  <option value="LOST">Book Lost</option>
                  <option value="DAMAGED">Book Damaged</option>
                  <option value="LOST_CARD">Lost Card</option>
                  <option value="MANUAL">Manual Penalty</option>
                </select>

                <input
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Search student, class, roll, book title..."
                  style={{ ...inputStyle, width: '260px', padding: '8px 12px' }}
                />

                <button
                  onClick={loadFines}
                  style={{
                    padding: '8px 14px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 700,
                    border: `1px solid ${darkMode ? '#334155' : '#cbd5e1'}`,
                    background: darkMode ? '#1e293b' : '#f1f5f9', color: darkMode ? '#e2e8f0' : '#475569', cursor: 'pointer'
                  }}
                >
                  ⟳ Refresh
                </button>
              </div>

            </div>
          </div>

          {/* ══ Fines Data Table ══ */}
          <div style={cardStyle}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>Loading library fines and ledger records...</div>
            ) : filteredFines.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                No fines found for the selected filter.
              </div>
            ) : (
              <div className="table-container" style={{ border: 'none' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Student / Member</th>
                      <th>Class &amp; Roll</th>
                      <th>Reason</th>
                      <th>Book / Details</th>
                      <th>Fine Amount</th>
                      <th>Paid / Waived</th>
                      <th>Outstanding</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFines.map(f => (
                      <tr key={f.id}>
                        <td>
                          <div style={{ fontWeight: 700, color: darkMode ? '#fff' : '#0f172a' }}>{f.member_name}</div>
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>Ref #{f.id} · {f.created_at ? f.created_at.slice(0, 10) : ''}</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{f.class_name || 'Staff'}</div>
                          {f.roll_number && <div style={{ fontSize: '11px', color: '#94a3b8' }}>Roll: {f.roll_number}</div>}
                        </td>
                        <td>{getReasonBadge(f.reason)}</td>
                        <td>
                          <div style={{ fontWeight: 600, color: '#3b82f6' }}>{f.book_title || f.remarks || 'Library Fine'}</div>
                          {f.book_mrp > 0 && <div style={{ fontSize: '11px', color: '#94a3b8' }}>MRP: ₹{f.book_mrp}</div>}
                        </td>
                        <td style={{ fontWeight: 700 }}>₹{f.amount}</td>
                        <td style={{ fontSize: '12.5px' }}>
                          <span style={{ color: '#10b981', fontWeight: 600 }}>₹{f.amount_paid || 0}</span>
                          {f.waived_amount > 0 && (
                            <span style={{ color: '#8b5cf6', marginLeft: '6px' }}>(₹{f.waived_amount} waived)</span>
                          )}
                        </td>
                        <td>
                          <strong style={{ color: (f.outstanding_amount || 0) > 0 ? '#ef4444' : '#10b981', fontSize: '14px' }}>
                            ₹{f.outstanding_amount || 0}
                          </strong>
                        </td>
                        <td>{getStatusBadge(f.status, f.outstanding_amount || 0)}</td>
                        <td style={{ textAlign: 'right' }}>
                          {(f.outstanding_amount || 0) > 0 ? (
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                              <button
                                onClick={() => {
                                  setCollectModal(f);
                                  setCollectAmount(String(f.outstanding_amount));
                                  setCollectMode('CASH');
                                  setCollectRemarks('');
                                }}
                                style={{
                                  background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '6px',
                                  padding: '6px 12px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer',
                                  boxShadow: '0 2px 6px rgba(16,185,129,0.3)'
                                }}
                              >
                                💵 Collect
                              </button>
                              <button
                                onClick={() => {
                                  setWaiveModal(f);
                                  setWaiveAmount(String(f.outstanding_amount));
                                  setWaiveReason('');
                                }}
                                style={{
                                  background: '#8b5cf6', color: '#ffffff', border: 'none', borderRadius: '6px',
                                  padding: '6px 12px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer'
                                }}
                              >
                                🛡️ Waive
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 700 }}>
                              Settled ✓
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ══════════════════════════════════════════════════════════════════════
              MODAL 1: COLLECT FINE PAYMENT
             ══════════════════════════════════════════════════════════════════════ */}
          {collectModal && (
            <div
              style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999,
                backdropFilter: 'blur(6px)'
              }}
              onClick={e => e.target === e.currentTarget && setCollectModal(null)}
            >
              <div style={{
                background: darkMode ? '#111827' : '#ffffff', borderRadius: '20px', padding: '28px',
                width: '100%', maxWidth: '460px',
                border: `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`,
                boxShadow: '0 20px 40px rgba(0,0,0,0.4)'
              }}>
                <h3 style={{ margin: '0 0 14px', fontSize: '18px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a' }}>
                  💵 Collect Library Fine Payment
                </h3>

                <div style={{
                  background: darkMode ? '#1e293b' : '#f8fafc', borderRadius: '12px', padding: '14px', marginBottom: '16px',
                  border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`
                }}>
                  <div style={{ fontSize: '14.5px', fontWeight: 700, color: darkMode ? '#fff' : '#0f172a' }}>
                    {collectModal.member_name} {collectModal.class_name ? `(${collectModal.class_name})` : ''}
                  </div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                    Reason: <strong>{collectModal.reason}</strong> · Total Fine: ₹{collectModal.amount}
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#ef4444', marginTop: '6px' }}>
                    Outstanding Balance: ₹{collectModal.outstanding_amount}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                      Collection Amount (₹):
                    </label>
                    <input
                      type="number"
                      value={collectAmount}
                      onChange={e => setCollectAmount(e.target.value)}
                      max={collectModal.outstanding_amount}
                      style={{ ...inputStyle, fontSize: '16px', fontWeight: 800 }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
                      Payment Method:
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {['CASH', 'UPI', 'CARD', 'CHEQUE'].map(m => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setCollectMode(m)}
                          style={{
                            flex: 1, padding: '8px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, border: 'none', cursor: 'pointer',
                            background: collectMode === m ? '#10b981' : (darkMode ? '#1e293b' : '#f1f5f9'),
                            color: collectMode === m ? '#ffffff' : (darkMode ? '#94a3b8' : '#475569')
                          }}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                      Remarks / Receipt Notes:
                    </label>
                    <input
                      value={collectRemarks}
                      onChange={e => setCollectRemarks(e.target.value)}
                      placeholder="e.g. Paid in full at library counter..."
                      style={inputStyle}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setCollectModal(null)}
                    style={{
                      padding: '10px 18px', borderRadius: '10px', border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
                      background: darkMode ? '#1e293b' : '#f8fafc',
                      color: darkMode ? '#ffffff' : '#334155', cursor: 'pointer', fontSize: '13px', fontWeight: 600
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    disabled={collecting}
                    onClick={handleCollectPayment}
                    style={{
                      padding: '10px 24px', borderRadius: '10px', border: 'none',
                      background: '#10b981', color: '#ffffff', cursor: collecting ? 'not-allowed' : 'pointer',
                      fontSize: '13.5px', fontWeight: 800, boxShadow: '0 4px 14px rgba(16,185,129,0.35)'
                    }}
                  >
                    {collecting ? '⏳ Processing...' : '✅ Confirm Collection'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════════
              MODAL 2: WAIVE FINE
             ══════════════════════════════════════════════════════════════════════ */}
          {waiveModal && (
            <div
              style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999,
                backdropFilter: 'blur(6px)'
              }}
              onClick={e => e.target === e.currentTarget && setWaiveModal(null)}
            >
              <div style={{
                background: darkMode ? '#111827' : '#ffffff', borderRadius: '20px', padding: '28px',
                width: '100%', maxWidth: '460px',
                border: `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`,
                boxShadow: '0 20px 40px rgba(0,0,0,0.4)'
              }}>
                <h3 style={{ margin: '0 0 14px', fontSize: '18px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a' }}>
                  🛡️ Waive Library Fine
                </h3>

                <div style={{
                  background: darkMode ? '#1e293b' : '#f8fafc', borderRadius: '12px', padding: '14px', marginBottom: '16px',
                  border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`
                }}>
                  <div style={{ fontSize: '14.5px', fontWeight: 700, color: darkMode ? '#fff' : '#0f172a' }}>
                    {waiveModal.member_name}
                  </div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                    Reason: <strong>{waiveModal.reason}</strong> · Outstanding: <strong>₹{waiveModal.outstanding_amount}</strong>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                      Waiver Amount (₹):
                    </label>
                    <input
                      type="number"
                      value={waiveAmount}
                      onChange={e => setWaiveAmount(e.target.value)}
                      max={waiveModal.outstanding_amount}
                      style={{ ...inputStyle, fontSize: '16px', fontWeight: 800 }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                      Waiver Reason / Approval Note *:
                    </label>
                    <input
                      value={waiveReason}
                      onChange={e => setWaiveReason(e.target.value)}
                      placeholder="e.g. Principal approved medical exemption..."
                      style={inputStyle}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setWaiveModal(null)}
                    style={{
                      padding: '10px 18px', borderRadius: '10px', border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
                      background: darkMode ? '#1e293b' : '#f8fafc',
                      color: darkMode ? '#ffffff' : '#334155', cursor: 'pointer', fontSize: '13px', fontWeight: 600
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    disabled={waiving}
                    onClick={handleWaiveFine}
                    style={{
                      padding: '10px 24px', borderRadius: '10px', border: 'none',
                      background: '#8b5cf6', color: '#ffffff', cursor: waiving ? 'not-allowed' : 'pointer',
                      fontSize: '13.5px', fontWeight: 800, boxShadow: '0 4px 14px rgba(139,92,246,0.35)'
                    }}
                  >
                    {waiving ? '⏳ Waiving...' : '✅ Confirm Waiver'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════════
              MODAL 3: ASSESS MANUAL FINE / PENALTY
             ══════════════════════════════════════════════════════════════════════ */}
          {manualModal && (
            <div
              style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999,
                backdropFilter: 'blur(6px)'
              }}
              onClick={e => e.target === e.currentTarget && setManualModal(false)}
            >
              <div style={{
                background: darkMode ? '#111827' : '#ffffff', borderRadius: '20px', padding: '28px',
                width: '100%', maxWidth: '480px',
                border: `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`,
                boxShadow: '0 20px 40px rgba(0,0,0,0.4)'
              }}>
                <h3 style={{ margin: '0 0 14px', fontSize: '18px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a' }}>
                  + Assess Manual Fine / Penalty
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
                  {/* Select Member */}
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                      Select Student / Member:
                    </label>
                    {manualSelectedMember ? (
                      <div style={{
                        background: darkMode ? '#1e293b' : '#f0fdf4', border: '1.5px solid #10b981',
                        borderRadius: '10px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                      }}>
                        <span style={{ fontWeight: 700, color: darkMode ? '#34d399' : '#15803d' }}>
                          👤 {manualSelectedMember.name} ({manualSelectedMember.card_number})
                        </span>
                        <button
                          type="button"
                          onClick={() => { setManualSelectedMember(null); setManualMemberSearch(''); }}
                          style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', padding: '4px 8px', fontSize: '11px', cursor: 'pointer' }}
                        >
                          Change
                        </button>
                      </div>
                    ) : (
                      <div>
                        <input
                          value={manualMemberSearch}
                          onChange={e => setManualMemberSearch(e.target.value)}
                          placeholder="Type student name or card #..."
                          style={inputStyle}
                        />
                        {manualMemberResults.length > 0 && (
                          <div style={{
                            marginTop: '6px', maxHeight: '180px', overflowY: 'auto',
                            background: darkMode ? '#1e293b' : '#ffffff', border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
                            borderRadius: '8px', boxShadow: '0 6px 16px rgba(0,0,0,0.15)'
                          }}>
                            {manualMemberResults.map(m => (
                              <div
                                key={m.id}
                                onClick={() => { setManualSelectedMember(m); setManualMemberResults([]); }}
                                style={{
                                  padding: '8px 12px', cursor: 'pointer', fontSize: '12.5px',
                                  borderBottom: `1px solid ${darkMode ? '#334155' : '#f1f5f9'}`,
                                  display: 'flex', justifyContent: 'space-between'
                                }}
                              >
                                <strong>{m.name}</strong>
                                <span style={{ color: '#6366f1' }}>{m.card_number}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Reason & Amount */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                        Penalty Reason:
                      </label>
                      <select
                        value={manualReason}
                        onChange={e => setManualReason(e.target.value)}
                        style={inputStyle}
                      >
                        <option value="LOST_CARD">Lost Library Card</option>
                        <option value="MISSING_PAGES">Missing / Torn Pages</option>
                        <option value="DAMAGED">Damaged Book Spine</option>
                        <option value="MANUAL">Other Penalty</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                        Amount (₹):
                      </label>
                      <input
                        type="number"
                        value={manualAmount}
                        onChange={e => setManualAmount(e.target.value)}
                        style={{ ...inputStyle, fontWeight: 700 }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                      Remarks / Notes:
                    </label>
                    <input
                      value={manualRemarks}
                      onChange={e => setManualRemarks(e.target.value)}
                      placeholder="e.g. Card re-issuance fee..."
                      style={inputStyle}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setManualModal(false)}
                    style={{
                      padding: '10px 18px', borderRadius: '10px', border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
                      background: darkMode ? '#1e293b' : '#f8fafc',
                      color: darkMode ? '#ffffff' : '#334155', cursor: 'pointer', fontSize: '13px', fontWeight: 600
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    disabled={creatingManual}
                    onClick={handleCreateManualFine}
                    style={{
                      padding: '10px 24px', borderRadius: '10px', border: 'none',
                      background: '#4f46e5', color: '#ffffff', cursor: creatingManual ? 'not-allowed' : 'pointer',
                      fontSize: '13.5px', fontWeight: 800, boxShadow: '0 4px 14px rgba(79,70,229,0.35)'
                    }}
                  >
                    {creatingManual ? '⏳ Saving...' : '✅ Assess Penalty'}
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
