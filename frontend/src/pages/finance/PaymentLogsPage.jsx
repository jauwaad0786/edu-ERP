import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function PaymentLogsPage() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedMode, setSelectedMode] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [session, setSession] = useState('2026-27');

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('session', session);
      if (selectedDept) params.append('department', selectedDept);
      if (selectedMode) params.append('payment_mode', selectedMode);
      if (selectedStatus) params.append('status', selectedStatus);
      if (search) params.append('search', search);

      const res = await api.get(`/fees-finance/payments?${params.toString()}`);
      setPayments(res.data || []);
    } catch (err) {
      toast.error('Failed to load payment logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [session, selectedDept, selectedMode, selectedStatus]);

  const downloadReceiptPDF = async (paymentId, receiptNo) => {
    try {
      const res = await api.get(`/fees-finance/payments/${paymentId}/receipt-pdf`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `Receipt_${receiptNo}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success('Payment Receipt PDF downloaded');
    } catch (err) {
      toast.error('Failed to download receipt PDF');
    }
  };

  const fmt = (v) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(v || 0);

  const totalCollected = payments
    .filter((p) => p.status === 'VALID')
    .reduce((sum, p) => sum + (p.total_paid || 0), 0);

  const filtered = payments.filter((p) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      (p.receipt_no || '').toLowerCase().includes(s) ||
      (p.student_name || '').toLowerCase().includes(s) ||
      (p.admission_no || '').toLowerCase().includes(s) ||
      (p.collected_by_name || '').toLowerCase().includes(s) ||
      (p.transaction_ref || '').toLowerCase().includes(s)
    );
  });

  return (
    <div className="finance-page-container" style={{ padding: '24px 32px', background: '#f8f9fa', minHeight: '100vh' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, color: 'var(--neutral-9)' }}>
            Payment Logs & Cashier Audit Trail
          </h2>
          <p className="text-xs text-muted" style={{ marginTop: 4 }}>
            Real-time audit log of all fee, hostel, transport, and fine collections across staff roles (Principal, Accountant, Warden, Librarian).
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <select
            value={session}
            onChange={(e) => setSession(e.target.value)}
            className="form-select"
            style={{ width: 130, fontWeight: 700 }}
          >
            <option value="2026-27">2026-27</option>
            <option value="2025-26">2025-26</option>
            <option value="2024-25">2024-25</option>
          </select>
          <button onClick={fetchPayments} className="btn btn-neutral" title="Refresh">
            <i className="ti ti-refresh"></i>
          </button>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid-4 mb-6">
        <div className="stat-card" style={{ borderLeft: '4px solid #2e844a' }}>
          <div className="stat-label">Total Valid Collections</div>
          <div className="stat-value" style={{ color: '#2e844a' }}>{fmt(totalCollected)}</div>
          <div className="stat-sub">{payments.filter((p) => p.status === 'VALID').length} settled receipts</div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid #0176d3' }}>
          <div className="stat-label">Total Transactions</div>
          <div className="stat-value" style={{ color: '#0176d3' }}>{payments.length}</div>
          <div className="stat-sub">Across all counters & services</div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid #7c3aed' }}>
          <div className="stat-label">Collection Counters Active</div>
          <div className="stat-value" style={{ color: '#7c3aed' }}>
            {new Set(payments.map((p) => p.collected_by_name)).size} Staff
          </div>
          <div className="stat-sub">Accountant, Warden, Library, Principal</div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid #ba0517' }}>
          <div className="stat-label">Cancelled / Voided</div>
          <div className="stat-value" style={{ color: '#ba0517' }}>
            {payments.filter((p) => p.status === 'CANCELLED').length}
          </div>
          <div className="stat-sub">Audit-logged reversals</div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="card mb-6" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 12, alignItems: 'center' }}>
          <div>
            <input
              type="text"
              placeholder="Search by receipt #, student name, admission #, cashier..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="form-input"
            />
          </div>

          <div>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="form-select"
            >
              <option value="">All Departments</option>
              <option value="ACCOUNTS">ACCOUNTS</option>
              <option value="HOSTEL">HOSTEL</option>
              <option value="LIBRARY">LIBRARY</option>
              <option value="TRANSPORT">TRANSPORT</option>
            </select>
          </div>

          <div>
            <select
              value={selectedMode}
              onChange={(e) => setSelectedMode(e.target.value)}
              className="form-select"
            >
              <option value="">All Modes</option>
              <option value="CASH">CASH</option>
              <option value="UPI">UPI / QR Code</option>
              <option value="ONLINE">Online Portal</option>
              <option value="CHEQUE">Cheque</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
            </select>
          </div>

          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="form-select"
            >
              <option value="">All Statuses</option>
              <option value="VALID">VALID (Active)</option>
              <option value="CANCELLED">CANCELLED (Void)</option>
            </select>
          </div>

          <div>
            <button onClick={() => { setSearch(''); setSelectedDept(''); setSelectedMode(''); setSelectedStatus(''); }} className="btn btn-neutral">
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Payments Table */}
      <div className="card">
        <div className="table-responsive">
          <table className="table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#fafaf9', borderBottom: '1px solid var(--neutral-2)' }}>
                <th style={{ padding: '12px 16px', fontSize: 12, fontWeight: 700 }}>Receipt #</th>
                <th style={{ padding: '12px 16px', fontSize: 12, fontWeight: 700 }}>Date & Time</th>
                <th style={{ padding: '12px 16px', fontSize: 12, fontWeight: 700 }}>Student & Class</th>
                <th style={{ padding: '12px 16px', fontSize: 12, fontWeight: 700 }}>Collected By (Staff Role)</th>
                <th style={{ padding: '12px 16px', fontSize: 12, fontWeight: 700 }}>Department</th>
                <th style={{ padding: '12px 16px', fontSize: 12, fontWeight: 700 }}>Payment Mode</th>
                <th style={{ padding: '12px 16px', fontSize: 12, fontWeight: 700, textAlign: 'right' }}>Amount Paid</th>
                <th style={{ padding: '12px 16px', fontSize: 12, fontWeight: 700, textAlign: 'center' }}>Receipt PDF</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: 32 }}>
                    <div className="spinner-border text-primary" role="status"></div>
                    <div className="text-xs text-muted" style={{ marginTop: 8 }}>Loading payment audit records...</div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: 32 }}>
                    <i className="ti ti-receipt-off" style={{ fontSize: 32, color: 'var(--neutral-4)' }}></i>
                    <div style={{ marginTop: 8, fontWeight: 600 }}>No payment transactions found</div>
                    <div className="text-xs text-muted">Try adjusting filters or search query.</div>
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--neutral-2)', opacity: p.status === 'CANCELLED' ? 0.6 : 1 }}>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontWeight: 800, fontFamily: 'monospace', color: '#0176d3' }}>
                        {p.receipt_no}
                      </span>
                      {p.status === 'CANCELLED' && (
                        <span className="badge badge-error" style={{ marginLeft: 6, fontSize: 10 }}>CANCELLED</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13 }}>
                      {p.payment_date}
                      <div className="text-xs text-muted">{p.created_at ? new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{p.student_name}</div>
                      <div className="text-xs text-muted">
                        Adm: <strong>{p.admission_no}</strong> • {p.class_name}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{p.collected_by_name}</div>
                      <span className="badge badge-neutral" style={{ fontSize: 10, marginTop: 2 }}>
                        {p.collector_role || 'STAFF'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span className="badge badge-neutral" style={{ fontWeight: 700 }}>
                        {p.department || 'ACCOUNTS'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13 }}>
                      <div style={{ fontWeight: 600 }}>{p.payment_mode}</div>
                      {p.transaction_ref && (
                        <div className="text-xs text-muted" style={{ fontFamily: 'monospace' }}>
                          Ref: {p.transaction_ref}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, fontSize: 14, color: p.status === 'CANCELLED' ? 'var(--neutral-5)' : '#2e844a' }}>
                      {fmt(p.total_paid)}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <button
                        onClick={() => downloadReceiptPDF(p.id, p.receipt_no)}
                        className="btn btn-neutral"
                        style={{ padding: '4px 8px', fontSize: 12 }}
                        title="Download Official PDF Receipt"
                      >
                        <i className="ti ti-file-download" style={{ color: '#0176d3' }}></i> PDF
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
  );
}
