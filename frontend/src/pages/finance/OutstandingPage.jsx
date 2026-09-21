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
    const name = (b.student_name || '').toLowerCase();
    if (name.includes('former student') || b.is_former || b.is_deleted) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      b.student_name?.toLowerCase().includes(s) ||
      b.admission_no?.toLowerCase().includes(s) ||
      b.bill_no?.toLowerCase().includes(s)
    );
  });

  const purgeFormerStudents = async () => {
    if (!window.confirm('Clean up and delete all outstanding bills belonging to former, withdrawn, or deleted students?')) return;
    try {
      const res = await api.post('/fees-finance/outstanding/purge-former');
      toast.success(res.data?.message || 'Purged former student records');
      fetchOutstanding();
    } catch (e) {
      toast.error('Failed to purge former student records');
    }
  };

  const deleteBill = async (billId, billNo) => {
    if (!window.confirm(`Are you sure you want to delete bill ${billNo}?`)) return;
    try {
      await api.delete(`/fees-finance/bills/${billId}`);
      toast.success(`Fee Bill ${billNo} deleted`);
      fetchOutstanding();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to delete fee bill');
    }
  };

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

          {/* Salesforce Blue Hero Banner */}
          <div style={{
            background: 'linear-gradient(135deg, #0176d3 0%, #032d60 100%)',
            borderRadius: 14, padding: '22px 26px', color: '#fff', marginBottom: 20,
            boxShadow: '0 4px 20px rgba(1, 118, 211, 0.25)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ background: 'rgba(255,255,255,0.2)', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 800 }}>
                  DEFAULTER INTELLIGENCE
                </span>
                <span style={{ fontSize: 12, opacity: 0.9 }}>Active Student Arrears &bull; Instant WhatsApp Notices &bull; Ledger Deep-Link</span>
              </div>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Outstanding Fees &amp; Defaulters</h1>
              <p style={{ margin: '4px 0 0', fontSize: 13, opacity: 0.9, maxWidth: 680 }}>
                Live roster of unpaid student arrears. Former and inactive students are strictly excluded to keep auditor records accurate.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{
                background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)',
                borderRadius: 10, padding: '8px 16px', textAlign: 'right', border: '1px solid rgba(255,255,255,0.2)'
              }}>
                <div style={{ fontSize: 11, opacity: 0.85, fontWeight: 700 }}>Total Active Dues</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#fcd34d' }}>{fmt(totalOutstanding)}</div>
              </div>

              <button
                onClick={purgeFormerStudents}
                style={{
                  background: 'rgba(239, 68, 68, 0.2)', color: '#fee2e2', border: '1px solid rgba(239,68,68,0.4)',
                  borderRadius: 10, padding: '10px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6
                }}
                title="Purge lingering bills belonging to former or withdrawn students"
              >
                <i className="ti ti-user-x" />
                Purge Former Student Dues
              </button>
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
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Defaulters List</h3>
                <p className="text-xs text-muted" style={{ margin: 0 }}>Showing {filteredBills.length} active students with unpaid fee balances</p>
              </div>
            </div>

            {loading ? (
              <div className="empty-state">
                <div className="spinner" style={{ width: 28, height: 28 }}></div>
                <p className="mt-4">Loading defaulters...</p>
              </div>
            ) : filteredBills.length === 0 ? (
              <div className="empty-state">
                <i className="ti ti-circle-check" style={{ fontSize: 36, color: '#0176d3' }}></i>
                <h4 style={{ marginTop: 12 }}>No Defaulters Found!</h4>
                <p className="text-xs text-muted">All active student dues are completely settled for the selected criteria.</p>
              </div>
            ) : (
              <div className="table-container" style={{ border: 'none' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Student &amp; Class</th>
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
                          <div className="text-xs text-muted">{b.admission_no} &bull; {b.class_name}</div>
                        </td>
                        <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0176d3' }}>{b.bill_no}</td>
                        <td style={{ fontWeight: 600 }}>{b.bill_period_label}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(b.total_payable)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: '#2e844a' }}>{fmt(b.amount_paid)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 800, color: '#dd7a01' }}>{fmt(b.balance_due)}</td>
                        <td style={{ color: '#0176d3', fontWeight: 600 }}>{b.due_date}</td>
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
                            <button
                              onClick={() => deleteBill(b.id, b.bill_no)}
                              className="btn btn-neutral btn-sm"
                              title="Delete Fee Bill"
                              style={{ color: '#ba0517' }}
                            >
                              <i className="ti ti-trash"></i>
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
