import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api     from '../../api/axios';
import toast   from 'react-hot-toast';

export default function HostelFees() {
  const [darkMode, setDarkMode] = useState(localStorage.getItem('ederp_theme') === 'dark');
  const [loading, setLoading]   = useState(true);
  const [dues, setDues]         = useState([]);
  const [search, setSearch]     = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [monthFilter, setMonthFilter]   = useState(new Date().toISOString().slice(0, 7));

  // Modals
  const [genModal, setGenModal]       = useState(false);
  const [genMonth, setGenMonth]       = useState(new Date().toISOString().slice(0, 7));
  const [generating, setGenerating]   = useState(false);

  const [collectModal, setCollectModal] = useState(false);
  const [selectedDue, setSelectedDue]   = useState(null);
  const [payAmount, setPayAmount]       = useState('');
  const [payMode, setPayMode]           = useState('CASH');
  const [payRemarks, setPayRemarks]     = useState('');
  const [submitting, setSubmitting]     = useState(false);

  const fetchDues = async () => {
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
  };

  useEffect(() => {
    fetchDues();
  }, [monthFilter, statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchDues();
  };

  const handleGenerateMonthly = async () => {
    try {
      setGenerating(true);
      const res = await api.post('/hostel/fees/generate-monthly', { month: genMonth });
      toast.success(res.data?.message || 'Hostel fees generated successfully');
      setGenModal(false);
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
      toast.success('Payment recorded successfully and synced to Fee Management!');
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
        <Navbar title="Hostel Fees &amp; Billing Ledger" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />

        <div style={{ padding: '24px 28px' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: darkMode ? '#f8fafc' : '#0f172a' }}>
                Hostel Monthly Billing &amp; Collection Ledger
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
                Manage room rent, electricity &amp; mess dues, generate monthly bills, and collect counter payments.
              </p>
            </div>
            <button
              onClick={() => setGenModal(true)}
              style={{
                background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8,
                padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
                boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)'
              }}
            >
              <i className="ti ti-calendar-plus" style={{ fontSize: 16 }}></i>
              Generate Monthly Fees
            </button>
          </div>

          {/* Metric Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 20 }}>
            <div style={cardStyle}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>TOTAL BILLED</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#4f46e5', marginTop: 4 }}>₹{totalDueAmount.toLocaleString()}</div>
            </div>
            <div style={cardStyle}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>COLLECTED AMOUNT</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#16a34a', marginTop: 4 }}>₹{totalPaidAmount.toLocaleString()}</div>
            </div>
            <div style={cardStyle}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>OUTSTANDING DUES</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#dc2626', marginTop: 4 }}>₹{totalOutstanding.toLocaleString()}</div>
            </div>
          </div>

          {/* Filter Bar */}
          <div style={{ ...cardStyle, padding: 14, marginBottom: 20 }}>
            <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <input
                  type="text"
                  placeholder="Search resident or admission no..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ ...inputStyle, marginBottom: 0 }}
                />
              </div>
              <div style={{ width: 170 }}>
                <input
                  type="month"
                  value={monthFilter}
                  onChange={(e) => setMonthFilter(e.target.value)}
                  style={{ ...inputStyle, marginBottom: 0 }}
                />
              </div>
              <div style={{ width: 170 }}>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  style={{ ...inputStyle, marginBottom: 0 }}
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PENDING">Pending / Partial</option>
                  <option value="PAID">Fully Paid</option>
                </select>
              </div>
              <button
                type="submit"
                style={{
                  background: darkMode ? '#334155' : '#f1f5f9', color: darkMode ? '#cbd5e1' : '#475569',
                  border: `1px solid ${darkMode ? '#475569' : '#cbd5e1'}`, borderRadius: 8,
                  padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer'
                }}
              >
                Search
              </button>
            </form>
          </div>

          {/* Dues Table Card */}
          <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: darkMode ? '#0f172a' : '#f8fafc', borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, textAlign: 'left' }}>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>RESIDENT</th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>HOSTEL &amp; ROOM</th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>BILLING MONTH</th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 600, fontSize: 11, textAlign: 'right' }}>DUE (₹)</th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 600, fontSize: 11, textAlign: 'right' }}>PAID (₹)</th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 600, fontSize: 11, textAlign: 'right' }}>OUTSTANDING</th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 600, fontSize: 11, textAlign: 'center' }}>STATUS</th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 600, fontSize: 11, textAlign: 'center' }}>RECEIPT #</th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 600, fontSize: 11, textAlign: 'right' }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="9" style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
                        Loading fee records...
                      </td>
                    </tr>
                  ) : dues.length === 0 ? (
                    <tr>
                      <td colSpan="9" style={{ textAlign: 'center', padding: '50px 0', color: '#94a3b8' }}>
                        <i className="ti ti-file-invoice" style={{ fontSize: 36, display: 'block', marginBottom: 8, opacity: 0.5 }}></i>
                        No hostel fee records found for this period.
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
                            padding: '3px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700
                          }}>
                            {d.month}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>₹{d.amount_due}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: '#16a34a' }}>₹{d.amount_paid}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: d.outstanding > 0 ? '#dc2626' : '#16a34a' }}>
                          ₹{d.outstanding}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <span style={{
                            background: d.status === 'PAID' ? '#f0fdf4' : d.status === 'PARTIAL' ? '#fefce8' : '#fef2f2',
                            color: d.status === 'PAID' ? '#16a34a' : d.status === 'PARTIAL' ? '#ca8a04' : '#dc2626',
                            border: `1px solid ${d.status === 'PAID' ? '#bbf7d0' : d.status === 'PARTIAL' ? '#fef08a' : '#fecaca'}`,
                            padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700
                          }}>
                            {d.status}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          {d.receipt_no ? (
                            <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#64748b' }}>{d.receipt_no}</span>
                          ) : (
                            <span style={{ color: '#94a3b8' }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          {d.outstanding > 0 ? (
                            <button
                              onClick={() => openCollect(d)}
                              style={{
                                background: '#4f46e5', color: '#fff', border: 'none',
                                padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer'
                              }}
                            >
                              Collect
                            </button>
                          ) : (
                            <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>Settled</span>
                          )}
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

      {/* Generate Monthly Dues Modal */}
      {genModal && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setGenModal(false)}>
          <div className="modal" style={{ maxWidth: 440, background: darkMode ? '#1e293b' : '#ffffff', color: darkMode ? '#ffffff' : '#0f172a' }}>
            <div className="modal-header" style={{ borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}` }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Generate Monthly Hostel Fees</h3>
              <button className="modal-close" onClick={() => setGenModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 14px' }}>
                This will resolve each active student's room fee structure (AC/Non-AC &amp; sharing type) and generate an idempotent monthly charge. Existing charges will be safely skipped.
              </p>
              <div>
                <label style={labelStyle}>Billing Month</label>
                <input
                  type="month"
                  value={genMonth}
                  onChange={(e) => setGenMonth(e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>
            <div className="modal-footer" style={{ borderTop: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}` }}>
              <button type="button" className="btn btn-neutral" onClick={() => setGenModal(false)}>Cancel</button>
              <button
                type="button"
                onClick={handleGenerateMonthly}
                disabled={generating}
                style={{
                  background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 6,
                  padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: generating ? 'not-allowed' : 'pointer',
                }}
              >
                {generating ? 'Generating...' : 'Confirm & Generate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Collect Payment Modal */}
      {collectModal && selectedDue && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setCollectModal(false)}>
          <div className="modal" style={{ maxWidth: 460, background: darkMode ? '#1e293b' : '#ffffff', color: darkMode ? '#ffffff' : '#0f172a' }}>
            <div className="modal-header" style={{ borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}` }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Collect Hostel Fee</h3>
              <button className="modal-close" onClick={() => setCollectModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCollectSubmit}>
              <div className="modal-body">
                <div style={{
                  background: darkMode ? '#0f172a' : '#f8fafc', padding: 12, borderRadius: 8,
                  marginBottom: 14, border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`
                }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{selectedDue.student_name}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>
                    {selectedDue.hostel_name} &bull; Room {selectedDue.room_number} &bull; Month: {selectedDue.month}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTop: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}` }}>
                    <span style={{ fontSize: 12, color: '#64748b' }}>Total Due: ₹{selectedDue.amount_due}</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#dc2626' }}>Outstanding: ₹{selectedDue.outstanding}</span>
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Amount to Collect (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    max={selectedDue.outstanding}
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    style={{ ...inputStyle, fontWeight: 700, fontSize: 15, color: '#16a34a' }}
                    required
                  />
                </div>

                <div>
                  <label style={labelStyle}>Payment Mode</label>
                  <select
                    value={payMode}
                    onChange={(e) => setPayMode(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="CASH">Cash</option>
                    <option value="UPI">UPI / Online</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="CHEQUE">Cheque / DD</option>
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Remarks / Transaction Note</label>
                  <input
                    type="text"
                    placeholder="Optional remarks..."
                    value={payRemarks}
                    onChange={(e) => setPayRemarks(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>
              <div className="modal-footer" style={{ borderTop: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}` }}>
                <button type="button" className="btn btn-neutral" onClick={() => setCollectModal(false)}>Cancel</button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6,
                    padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  {submitting ? 'Recording...' : `Collect ₹${payAmount}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
