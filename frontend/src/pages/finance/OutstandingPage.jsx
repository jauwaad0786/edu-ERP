import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function OutstandingPage() {
  const navigate = useNavigate();
  const [bills, setBills] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedClass, setSelectedClass] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [search, setSearch] = useState('');

  const fetchClasses = async () => {
    try {
      const res = await api.get('/principal/classes');
      setClasses(res.data || []);
    } catch (e) {}
  };

  const fetchOutstanding = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedClass) params.append('class_id', selectedClass);
      if (selectedMonth) params.append('month', selectedMonth);

      const res = await api.get(`/fees-finance/outstanding?${params.toString()}`);
      setBills(res.data || []);
    } catch (err) {
      toast.error('Failed to load outstanding dues');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClasses();
  }, []);

  useEffect(() => {
    fetchOutstanding();
  }, [selectedClass, selectedMonth]);

  const filteredBills = bills.filter((b) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      b.student_name?.toLowerCase().includes(s) ||
      b.admission_no?.toLowerCase().includes(s) ||
      b.bill_no?.toLowerCase().includes(s)
    );
  });

  const totalOutstanding = filteredBills.reduce((sum, b) => sum + (b.balance_due || 0), 0);

  const sendWhatsAppReminder = (bill) => {
    const text = `Dear Parent, this is a reminder regarding the pending fee of ₹${bill.balance_due} for ${bill.student_name} (${bill.admission_no}) for the period ${bill.bill_period_label}. Due date: ${bill.due_date}. Please pay to avoid late fines.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar title="Outstanding Fees & Defaulters" />
        <div className="page-body">

          {/* Page Header */}
          <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span className="badge badge-warning">Defaulter Tracking</span>
                <span className="text-xs text-muted">Unpaid Student Arrears</span>
              </div>
              <h2 className="page-title">Outstanding Fees & Defaulters</h2>
              <p className="page-subtitle">
                Track pending balances by class, fee period, and send instant WhatsApp payment reminders.
              </p>
            </div>

            <div className="stat-card" style={{ padding: '8px 16px', borderLeft: '4px solid #dd7a01', minWidth: 180 }}>
              <div className="stat-label" style={{ margin: 0 }}>Total Unpaid Dues</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#dd7a01' }}>
                {fmt(totalOutstanding)}
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="card mb-6" style={{ padding: 14 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ flex: 1, minWidth: 240 }}>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search defaulter by student name, admission no, or bill no..."
                  className="form-input"
                  style={{ width: '100%', height: 36 }}
                />
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="form-input"
                  style={{ height: 36, width: 140 }}
                />

                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="form-select"
                  style={{ height: 36, width: 140 }}
                >
                  <option value="">All Classes</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.section || ''}
                    </option>
                  ))}
                </select>

                <button
                  onClick={fetchOutstanding}
                  className="btn btn-neutral"
                  style={{ height: 36, padding: '0 12px' }}
                  title="Refresh"
                >
                  <i className="ti ti-refresh"></i>
                </button>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="card">
            <div className="card-header">
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Defaulters List</h3>
                <p className="text-xs text-muted" style={{ margin: 0 }}>Showing {filteredBills.length} pending accounts</p>
              </div>
            </div>

            {loading ? (
              <div className="empty-state">
                <div className="spinner" style={{ width: 28, height: 28 }}></div>
                <p className="mt-4">Loading defaulters...</p>
              </div>
            ) : filteredBills.length === 0 ? (
              <div className="empty-state">
                <i className="ti ti-check" style={{ fontSize: 36, color: '#2e844a' }}></i>
                <h4 style={{ marginTop: 12 }}>No Defaulters Found!</h4>
                <p className="text-xs text-muted">All student dues are clear for the selected filter.</p>
              </div>
            ) : (
              <div className="table-container" style={{ border: 'none' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Student & Class</th>
                      <th>Bill No</th>
                      <th>Period</th>
                      <th style={{ textAlign: 'right' }}>Total Payable</th>
                      <th style={{ textAlign: 'right' }}>Amount Paid</th>
                      <th style={{ textAlign: 'right' }}>Pending Dues</th>
                      <th>Due Date</th>
                      <th style={{ textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBills.map((b) => (
                      <tr key={b.id}>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--neutral-9)' }}>{b.student_name}</div>
                          <div className="text-xs text-muted">{b.admission_no} • {b.class_name}</div>
                        </td>
                        <td style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--neutral-9)' }}>{b.bill_no}</td>
                        <td style={{ fontWeight: 600 }}>{b.bill_period_label}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(b.total_payable)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: '#2e844a' }}>{fmt(b.amount_paid)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 800, color: '#dd7a01' }}>{fmt(b.balance_due)}</td>
                        <td style={{ color: '#ba0517', fontWeight: 600 }}>{b.due_date}</td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                            <button
                              onClick={() => sendWhatsAppReminder(b)}
                              className="btn btn-neutral btn-sm"
                              title="Send WhatsApp Reminder"
                              style={{ color: '#2e844a' }}
                            >
                              <i className="ti ti-brand-whatsapp"></i> Reminder
                            </button>
                            <button
                              onClick={() => navigate(`/finance/students/${b.student_id}/ledger`)}
                              className="btn btn-neutral btn-sm"
                            >
                              <i className="ti ti-file-text"></i> Ledger
                            </button>
                            <button
                              onClick={() => navigate(`/finance/payments/collect?student_id=${b.student_id}`)}
                              className="btn btn-primary btn-sm"
                            >
                              Pay
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
