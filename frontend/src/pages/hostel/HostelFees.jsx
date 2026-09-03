import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api     from '../../api/axios';
import toast   from 'react-hot-toast';

const getCurrentMonth = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

const formatMonthName = (ym) => {
  if (!ym) return '';
  try {
    const [y, m] = ym.split('-');
    const d = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
    return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  } catch (e) {
    return ym;
  }
};

const getAdjacentMonth = (ym, delta) => {
  if (!ym) return getCurrentMonth();
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  const nextY = d.getFullYear();
  const nextM = String(d.getMonth() + 1).padStart(2, '0');
  return `${nextY}-${nextM}`;
};

export default function HostelFees() {
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('ederp_theme') === 'dark');

  const [loading, setLoading]   = useState(true);
  const [dues, setDues]         = useState([]);
  const [search, setSearch]     = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [monthFilter, setMonthFilter]   = useState(getCurrentMonth());

  // Generation State
  const [generating, setGenerating]   = useState(false);

  // Collection Modal State
  const [collectModal, setCollectModal] = useState(false);
  const [selectedDue, setSelectedDue]   = useState(null);
  const [payAmount, setPayAmount]       = useState('');
  const [payMode, setPayMode]           = useState('CASH');
  const [payRemarks, setPayRemarks]     = useState('');
  const [submitting, setSubmitting]     = useState(false);

  useEffect(() => {
    localStorage.setItem('ederp_theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const fetchDues = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/hostel/fees/dues', {
        params: { month: monthFilter, status: statusFilter, search }
      });
      setDues(res.data || []);
    } catch (err) {
      toast.error('Failed to load hostel fee records');
    } finally {
      setLoading(false);
    }
  }, [monthFilter, statusFilter, search]);

  useEffect(() => {
    fetchDues();
  }, [fetchDues]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchDues();
  };

  const handleGenerateMonthly = async () => {
    const formatted = formatMonthName(monthFilter);
    if (!window.confirm(`Generate monthly hostel fee billing demand for all active residents for ${formatted}?\n\nBills will automatically sync with Central Finance and debit the Student Financial Ledger.`)) {
      return;
    }
    try {
      setGenerating(true);
      const res = await api.post('/hostel/fees/generate-monthly', { month: monthFilter });
      toast.success(res.data?.message || `Hostel fees generated successfully for ${formatted}`);
      fetchDues();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to generate monthly fees');
    } finally {
      setGenerating(false);
    }
  };

  const openCollect = (due) => {
    setSelectedDue(due);
    setPayAmount(due.outstanding);
    setPayMode('CASH');
    setPayRemarks('');
    setCollectModal(true);
  };

  const handleCollectSubmit = async (e) => {
    e.preventDefault();
    if (!payAmount || parseFloat(payAmount) <= 0) {
      toast.error('Please enter a valid payment amount');
      return;
    }
    try {
      setSubmitting(true);
      await api.post('/hostel/fees/collect', {
        record_id: selectedDue.record_id,
        amount_paid: parseFloat(payAmount),
        payment_mode: payMode,
        remarks: payRemarks,
      });
      toast.success('Payment recorded successfully and synced with Central Finance Ledger!');
      setCollectModal(false);
      fetchDues();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Payment failed');
    } finally {
      setSubmitting(false);
    }
  };

  const totalDueAmount = dues.reduce((acc, d) => acc + (d.amount_due || 0), 0);
  const totalPaidAmount = dues.reduce((acc, d) => acc + (d.amount_paid || 0), 0);
  const totalOutstanding = dues.reduce((acc, d) => acc + (d.outstanding || 0), 0);
  const collectionRate = totalDueAmount > 0 ? Math.round((totalPaidAmount / totalDueAmount) * 100) : 0;

  const cardStyle = {
    background: darkMode ? '#1e293b' : '#ffffff',
    border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
    borderRadius: 14, padding: 18,
    boxShadow: darkMode ? '0 4px 16px rgba(0,0,0,0.25)' : '0 2px 10px rgba(15,23,42,0.03)'
  };

  const inputStyle = {
    width: '100%', padding: '9px 12px', fontSize: 13,
    border: `1px solid ${darkMode ? '#475569' : '#cbd5e1'}`, borderRadius: 8, outline: 'none', boxSizing: 'border-box',
    background: darkMode ? '#0f172a' : '#ffffff', color: darkMode ? '#f1f5f9' : '#0f172a',
    marginBottom: 12,
  };

  const labelStyle = { fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 4, display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: darkMode ? '#0f172a' : '#f8fafc' }}>
      <Sidebar darkMode={darkMode} />
      <div style={{ marginLeft: 232, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Navbar title="Hostel Billing &amp; Collections" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />

        <div style={{ padding: '24px 28px' }}>

          {/* ══ Top Ecosystem Navigation Breadcrumb ══ */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: darkMode ? '#1e293b' : '#ffffff',
            border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
            borderRadius: '12px', padding: '10px 18px', marginBottom: '20px', flexWrap: 'wrap', gap: '10px'
          }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => navigate('/hostel/fee-structures')}
                style={{
                  background: 'transparent',
                  color: darkMode ? '#94a3b8' : '#475569',
                  border: 'none', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                <i className="ti ti-layout-grid" /> 1. Rate Cards (Fee Structures)
              </button>
              <button
                style={{
                  background: '#4f46e5',
                  color: '#ffffff',
                  border: 'none', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', fontWeight: 700, cursor: 'default',
                  display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                <i className="ti ti-cash" /> 2. Monthly Billing &amp; Collections
              </button>
              <button
                onClick={() => navigate('/hostel/fines')}
                style={{
                  background: 'transparent',
                  color: darkMode ? '#94a3b8' : '#475569',
                  border: 'none', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                <i className="ti ti-gavel" /> 3. Hostel Fines &amp; Penalties
              </button>
            </div>

            <button
              onClick={() => navigate('/finance/fees-management')}
              style={{
                background: darkMode ? '#0f172a' : '#f1f5f9',
                color: '#4f46e5',
                border: '1px solid #4f46e5',
                borderRadius: '8px', padding: '8px 14px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px'
              }}
            >
              <i className="ti ti-building-bank" /> Central Fees Management ↗
            </button>
          </div>

          {/* ══ Central Finance Sync Hero Banner ══ */}
          <div style={{
            position: 'relative', overflow: 'hidden',
            borderRadius: '16px', padding: '20px 24px', marginBottom: '22px',
            background: darkMode
              ? 'linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)'
              : 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
            color: '#ffffff',
            boxShadow: '0 8px 24px -4px rgba(79, 70, 229, 0.3)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                  <span style={{
                    padding: '3px 10px', borderRadius: '20px',
                    background: 'rgba(16, 185, 129, 0.25)', border: '1px solid #10b981',
                    fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#a7f3d0'
                  }}>
                    🟢 Central Finance Ledger Live
                  </span>
                  <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.85)' }}>
                    Active Month: <strong>{formatMonthName(monthFilter)}</strong>
                  </span>
                </div>
                <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: '#ffffff' }}>
                  Hostel Monthly Billing &amp; Collections Ledger
                </h1>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'rgba(255,255,255,0.85)', maxWidth: '650px' }}>
                  All bills generated and payments collected here automatically issue canonical receipts (REC-YYYY-XXXXXX) and synchronize immediately with the Central Student Financial Ledger and Principal Dashboard.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={handleGenerateMonthly}
                  disabled={generating}
                  style={{
                    background: '#ffffff', color: '#4f46e5', border: 'none', borderRadius: '10px',
                    padding: '10px 18px', fontSize: '13px', fontWeight: 800, cursor: generating ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 14px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', gap: '6px'
                  }}
                >
                  <i className="ti ti-calendar-plus" />
                  {generating ? `Generating ${formatMonthName(monthFilter)}...` : `⚡ Generate ${formatMonthName(monthFilter)} Bills`}
                </button>
              </div>
            </div>
          </div>

          {/* ══ Month Navigation & Active Month Command Strip ══ */}
          <div style={{
            background: darkMode ? '#111827' : '#ffffff',
            border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : '#cbd5e1'}`,
            borderRadius: '16px', padding: '16px 20px', marginBottom: '22px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px',
            boxShadow: darkMode ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 16px rgba(15,23,42,0.03)'
          }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Active Billing Period
              </div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a', marginTop: '2px' }}>
                📅 {formatMonthName(monthFilter)}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                Showing all resident room rents, mess, power dues, and collection receipts for {formatMonthName(monthFilter)}.
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{
                display: 'flex', alignItems: 'center', background: darkMode ? '#1e293b' : '#f1f5f9',
                border: `1px solid ${darkMode ? '#334155' : '#cbd5e1'}`, borderRadius: '8px', padding: '4px'
              }}>
                <button
                  type="button"
                  title="Previous Month"
                  onClick={() => setMonthFilter(prev => getAdjacentMonth(prev, -1))}
                  style={{
                    background: 'none', border: 'none', color: darkMode ? '#f1f5f9' : '#0f172a',
                    padding: '6px 12px', cursor: 'pointer', fontWeight: 800
                  }}
                >
                  ◀ Prev Month
                </button>
                <input
                  type="month"
                  value={monthFilter}
                  onChange={e => setMonthFilter(e.target.value)}
                  style={{
                    background: 'transparent', border: 'none', outline: 'none',
                    fontWeight: 700, fontSize: '13px', color: darkMode ? '#f1f5f9' : '#0f172a',
                    padding: '4px 6px', cursor: 'pointer'
                  }}
                />
                <button
                  type="button"
                  title="Next Month"
                  onClick={() => setMonthFilter(prev => getAdjacentMonth(prev, 1))}
                  style={{
                    background: 'none', border: 'none', color: darkMode ? '#f1f5f9' : '#0f172a',
                    padding: '6px 12px', cursor: 'pointer', fontWeight: 800
                  }}
                >
                  Next Month ▶
                </button>
              </div>

              <button
                type="button"
                onClick={() => setMonthFilter(getCurrentMonth())}
                style={{
                  background: darkMode ? '#334155' : '#f1f5f9', color: darkMode ? '#cbd5e1' : '#475569',
                  border: `1px solid ${darkMode ? '#475569' : '#cbd5e1'}`, borderRadius: '8px',
                  padding: '9px 14px', fontSize: '12px', fontWeight: 700, cursor: 'pointer'
                }}
              >
                Current Month
              </button>
            </div>
          </div>

          {/* ══ Live Metrics Cards for Active Month ══ */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 20 }}>
            <div style={cardStyle}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>
                TOTAL BILLED ({formatMonthName(monthFilter)})
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#4f46e5', marginTop: 4 }}>
                ₹{totalDueAmount.toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{dues.length} resident records</div>
            </div>

            <div style={cardStyle}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>
                COLLECTED AMOUNT
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#16a34a', marginTop: 4 }}>
                ₹{totalPaidAmount.toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: 11, color: '#16a34a', marginTop: 4 }}>✓ 100% Synced with Central Accounts</div>
            </div>

            <div style={cardStyle}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>
                OUTSTANDING BALANCE
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, color: totalOutstanding > 0 ? '#dc2626' : '#16a34a', marginTop: 4 }}>
                ₹{totalOutstanding.toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: 11, color: '#dc2626', marginTop: 4 }}>Pending collection</div>
            </div>

            <div style={cardStyle}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>
                COLLECTION HEALTH
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, color: collectionRate > 75 ? '#16a34a' : '#d97706', marginTop: 4 }}>
                {collectionRate}%
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Of monthly hostel billing cleared</div>
            </div>
          </div>

          {/* ══ Search & Status Filter Bar ══ */}
          <div style={{ ...cardStyle, padding: 14, marginBottom: 20 }}>
            <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 240 }}>
                <input
                  type="text"
                  placeholder="Search resident student, admission no, or room..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ ...inputStyle, marginBottom: 0 }}
                />
              </div>

              <div style={{ width: 200 }}>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  style={{ ...inputStyle, marginBottom: 0 }}
                >
                  <option value="ALL">All Statuses ({dues.length})</option>
                  <option value="PENDING">Pending &amp; Partial Dues</option>
                  <option value="PAID">Fully Settled (Paid)</option>
                </select>
              </div>

              <button
                type="submit"
                style={{
                  background: darkMode ? '#334155' : '#f1f5f9', color: darkMode ? '#cbd5e1' : '#475569',
                  border: `1px solid ${darkMode ? '#475569' : '#cbd5e1'}`, borderRadius: 8,
                  padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer'
                }}
              >
                Search
              </button>
            </form>
          </div>

          {/* ══ Dues Table Card ══ */}
          <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: darkMode ? '#0f172a' : '#f8fafc', borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, textAlign: 'left' }}>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 800, fontSize: 11 }}>RESIDENT STUDENT</th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 800, fontSize: 11 }}>HOSTEL &amp; BED</th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 800, fontSize: 11 }}>BILLING MONTH</th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 800, fontSize: 11, textAlign: 'right' }}>BILLED (₹)</th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 800, fontSize: 11, textAlign: 'right' }}>PAID (₹)</th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 800, fontSize: 11, textAlign: 'right' }}>BALANCE DUE</th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 800, fontSize: 11, textAlign: 'center' }}>STATUS</th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 800, fontSize: 11, textAlign: 'center' }}>RECEIPT #</th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 800, fontSize: 11, textAlign: 'right' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="9" style={{ textAlign: 'center', padding: '50px 0', color: '#94a3b8' }}>
                        Loading hostel fee records...
                      </td>
                    </tr>
                  ) : dues.length === 0 ? (
                    <tr>
                      <td colSpan="9" style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
                        <div style={{ fontSize: 32, marginBottom: 8 }}>📁</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: darkMode ? '#ffffff' : '#0f172a' }}>
                          No fee records found for {formatMonthName(monthFilter)}
                        </div>
                        <div style={{ fontSize: 12, marginTop: 4 }}>
                          Click "⚡ Generate {formatMonthName(monthFilter)} Bills" above to create charges for this month.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    dues.map((d) => (
                      <tr key={d.record_id} style={{ borderBottom: `1px solid ${darkMode ? '#334155' : '#f1f5f9'}` }}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 700, color: darkMode ? '#f8fafc' : '#0f172a' }}>{d.student_name}</div>
                          <div style={{ fontSize: 11, color: '#94a3b8' }}>{d.admission_no} &bull; {d.class_name}</div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 600 }}>{d.hostel_name || 'Hostel'}</div>
                          <div style={{ fontSize: 11, color: '#94a3b8' }}>Room {d.room_number} &bull; Bed {d.bed_number}</div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            background: darkMode ? '#334155' : '#f1f5f9', color: darkMode ? '#cbd5e1' : '#475569',
                            padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700
                          }}>
                            {formatMonthName(d.month)}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>₹{d.amount_due?.toLocaleString('en-IN')}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: '#16a34a' }}>₹{d.amount_paid?.toLocaleString('en-IN')}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: d.outstanding > 0 ? '#dc2626' : '#16a34a' }}>
                          ₹{d.outstanding?.toLocaleString('en-IN')}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <span style={{
                            background: d.status === 'PAID' ? '#f0fdf4' : d.status === 'PARTIAL' ? '#fffbeb' : '#fef2f2',
                            color: d.status === 'PAID' ? '#16a34a' : d.status === 'PARTIAL' ? '#d97706' : '#dc2626',
                            border: `1px solid ${d.status === 'PAID' ? '#bbf7d0' : d.status === 'PARTIAL' ? '#fef08a' : '#fecaca'}`,
                            padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 800
                          }}>
                            {d.status}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          {d.receipt_no ? (
                            <span style={{
                              fontFamily: 'monospace', fontSize: 11, fontWeight: 700,
                              background: '#eff6ff', color: '#1e40af', padding: '2px 6px', borderRadius: 4,
                              border: '1px solid #bfdbfe'
                            }}>
                              {d.receipt_no}
                            </span>
                          ) : (
                            <span style={{ color: '#94a3b8' }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            {d.outstanding > 0 && (
                              <button
                                onClick={() => openCollect(d)}
                                style={{
                                  background: '#4f46e5', color: '#fff', border: 'none',
                                  padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer'
                                }}
                              >
                                Collect Fee
                              </button>
                            )}
                            <button
                              onClick={() => navigate(`/finance/ledger?student_id=${d.student_id}`)}
                              title="View student's 360° Central Financial Ledger"
                              style={{
                                background: darkMode ? '#334155' : '#f1f5f9', color: darkMode ? '#cbd5e1' : '#475569',
                                border: 'none', padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer'
                              }}
                            >
                              Ledger ↗
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
      </div>

      {/* ══ Collect Payment Modal ══ */}
      {collectModal && selectedDue && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setCollectModal(false)}>
          <div className="modal" style={{ maxWidth: 460, background: darkMode ? '#1e293b' : '#ffffff', color: darkMode ? '#ffffff' : '#0f172a' }}>
            <div className="modal-header" style={{ borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}` }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Collect Hostel Fee</h3>
              <button className="modal-close" onClick={() => setCollectModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCollectSubmit}>
              <div className="modal-body">
                <div style={{
                  background: darkMode ? '#0f172a' : '#f8fafc',
                  border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
                  borderRadius: 10, padding: '12px 14px', marginBottom: 14
                }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a' }}>
                    {selectedDue.student_name}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                    Adm: <strong>{selectedDue.admission_no}</strong> &bull; {selectedDue.class_name}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                    Room: <strong>{selectedDue.room_number}</strong> (Bed {selectedDue.bed_number}) &bull; Month: <strong>{formatMonthName(selectedDue.month)}</strong>
                  </div>
                </div>

                <div style={{
                  background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8,
                  padding: '10px 14px', fontSize: 12, color: '#166534', marginBottom: 14
                }}>
                  ✓ This collection will automatically generate a canonical receipt <strong>REC-YYYY-XXXXXX</strong> and update the student's Central Financial Ledger instantly.
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                  <div>
                    <label style={labelStyle}>Total Billed</label>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>₹{selectedDue.amount_due}</div>
                  </div>
                  <div>
                    <label style={labelStyle}>Balance Due</label>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#dc2626' }}>₹{selectedDue.outstanding}</div>
                  </div>
                </div>

                <label style={labelStyle}>Collection Amount (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  style={inputStyle}
                  required
                />

                <label style={labelStyle}>Payment Mode *</label>
                <select
                  value={payMode}
                  onChange={(e) => setPayMode(e.target.value)}
                  style={inputStyle}
                >
                  <option value="CASH">Cash</option>
                  <option value="UPI">UPI / QR Code</option>
                  <option value="BANK_TRANSFER">Bank Transfer / NEFT</option>
                  <option value="CHEQUE">Cheque</option>
                </select>

                <label style={labelStyle}>Remarks / Transaction Reference</label>
                <input
                  type="text"
                  placeholder="Optional reference / notes..."
                  value={payRemarks}
                  onChange={(e) => setPayRemarks(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div className="modal-footer" style={{ borderTop: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, padding: '14px 20px' }}>
                <button type="button" className="btn btn-neutral" onClick={() => setCollectModal(false)}>Cancel</button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8,
                    padding: '9px 24px', fontSize: 13, fontWeight: 800, cursor: submitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  {submitting ? 'Recording...' : 'Confirm & Issue Receipt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
