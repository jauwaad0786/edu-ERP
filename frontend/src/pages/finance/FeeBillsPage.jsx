import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { resolveTenantPath } from '../../utils/routeBuilder';

export default function FeeBillsPage({ defaultOpenGenerate = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [bills, setBills] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [search, setSearch] = useState('');

  // Generate Bills Modal
  const isGenerateTrigger = defaultOpenGenerate || location.pathname.includes('generate-fees') || location.search.includes('action=generate');
  const [genModal, setGenModal] = useState(isGenerateTrigger);
  const [genSession, setGenSession] = useState('2026-27');
  const [genCadence, setGenCadence] = useState('MONTHLY');
  const [genMonth, setGenMonth] = useState('2026-09');
  const [genDueDate, setGenDueDate] = useState('2026-09-10');
  const [genClassId, setGenClassId] = useState('');
  const [forceRegenerate, setForceRegenerate] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (isGenerateTrigger) {
      setGenModal(true);
    }
  }, [location.pathname, location.search, isGenerateTrigger]);

  const fetchClasses = async () => {
    try {
      const res = await api.get('/principal/classes');
      setClasses(res.data || []);
    } catch (e) {}
  };

  const fetchBills = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedClass) params.append('class_id', selectedClass);
      if (selectedStatus) params.append('status', selectedStatus);
      if (selectedMonth) params.append('month', selectedMonth);

      const res = await api.get(`/fees-finance/bills?${params.toString()}`);
      setBills(res.data || []);
    } catch (err) {
      toast.error('Failed to load fee bills');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClasses();
  }, []);

  useEffect(() => {
    fetchBills();
  }, [selectedClass, selectedStatus, selectedMonth]);

  const handleGenerateBills = async (e) => {
    e.preventDefault();
    try {
      setGenerating(true);
      const payload = {
        session: genSession,
        billing_frequency: genCadence,
        bill_month: genMonth,
        due_date: genDueDate,
        class_id: genClassId ? parseInt(genClassId) : null,
        force_regenerate: forceRegenerate,
      };
      const res = await api.post('/fees-finance/bills/generate', payload);
      toast.success(`Generated ${res.data.created_count} bills (${res.data.skipped_count} skipped/existing)`);
      setGenModal(false);
      fetchBills();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to generate fee bills');
    } finally {
      setGenerating(false);
    }
  };

  const downloadBillPDF = async (billId, billNo) => {
    try {
      const res = await api.get(`/fees-finance/bills/${billId}/pdf`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `Demand_Bill_${billNo}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success('Fee Bill PDF downloaded');
    } catch (err) {
      toast.error('Failed to download bill PDF');
    }
  };

  const filteredBills = bills.filter((b) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      b.student_name?.toLowerCase().includes(s) ||
      b.admission_no?.toLowerCase().includes(s) ||
      b.bill_no?.toLowerCase().includes(s)
    );
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PAID':
        return <span className="badge badge-success">PAID</span>;
      case 'PARTIALLY_PAID':
        return <span className="badge badge-warning">PARTIAL</span>;
      case 'OVERDUE':
        return <span className="badge badge-error">OVERDUE</span>;
      case 'CANCELLED':
        return <span className="badge badge-neutral">CANCELLED</span>;
      default:
        return <span className="badge badge-info">ISSUED</span>;
    }
  };

  const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar title="Fee Bills & Advance Demand Notices" />
        <div className="page-body">

          {/* Page Header */}
          <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span className="badge badge-info">Billing & Demand Slips</span>
                <span className="text-xs text-muted">Pre-Due Demand Notices</span>
              </div>
              <h2 className="page-title">Fee Bills Management</h2>
              <p className="page-subtitle">
                Issue advance monthly demand slips before due dates (e.g. September bill generated late August).
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <button
                id="btn-fees-generate"
                onClick={() => setGenModal(true)}
                className="btn btn-primary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 18px',
                  fontWeight: 700,
                  fontSize: '0.92rem',
                  background: '#2563eb',
                  boxShadow: '0 4px 12px rgba(37,99,235,0.22)',
                }}
              >
                <i className="ti ti-calculator" style={{ fontSize: '1.2rem' }}></i>
                Fees Generate
              </button>
              <button
                onClick={() => navigate(resolveTenantPath('/finance/setup', user))}
                className="btn btn-outline"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', fontWeight: 600 }}
              >
                <i className="ti ti-settings"></i>
                Fee Setup & Rates
              </button>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="card mb-6" style={{ padding: 14 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ flex: 1, minWidth: 240, position: 'relative' }}>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search student by name, admission no, or bill no..."
                  className="form-input"
                  style={{ width: '100%', height: 36 }}
                />
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="form-select"
                  style={{ height: 36, width: 140 }}
                >
                  <option value="">All Months</option>
                  <option value="2026-04">April 2026</option>
                  <option value="2026-05">May 2026</option>
                  <option value="2026-06">June 2026</option>
                  <option value="2026-07">July 2026</option>
                  <option value="2026-08">August 2026</option>
                  <option value="2026-09">September 2026</option>
                  <option value="2026-10">October 2026</option>
                  <option value="2026-11">November 2026</option>
                  <option value="2026-12">December 2026</option>
                  <option value="2027-01">January 2027</option>
                  <option value="2027-02">February 2027</option>
                  <option value="2027-03">March 2027</option>
                </select>

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

                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="form-select"
                  style={{ height: 36, width: 130 }}
                >
                  <option value="">All Statuses</option>
                  <option value="ISSUED">ISSUED</option>
                  <option value="PARTIALLY_PAID">PARTIALLY PAID</option>
                  <option value="PAID">PAID</option>
                  <option value="OVERDUE">OVERDUE</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>

                <button
                  onClick={fetchBills}
                  className="btn btn-neutral"
                  style={{ height: 36, padding: '0 12px' }}
                  title="Refresh"
                >
                  <i className="ti ti-refresh"></i>
                </button>
              </div>
            </div>
          </div>

          {/* Bills Table */}
          <div className="card">
            <div className="card-header">
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Fee Bills & Demand Notices</h3>
                <p className="text-xs text-muted" style={{ margin: 0 }}>Showing {filteredBills.length} fee bills</p>
              </div>
            </div>

            {loading ? (
              <div className="empty-state">
                <div className="spinner" style={{ width: 28, height: 28 }}></div>
                <p className="mt-4">Loading fee bills...</p>
              </div>
            ) : filteredBills.length === 0 ? (
              <div className="empty-state">
                <i className="ti ti-file-invoice" style={{ fontSize: 36, color: 'var(--neutral-4)' }}></i>
                <h4 style={{ marginTop: 12 }}>No Fee Bills Found</h4>
                <p className="text-xs text-muted">Generate monthly demand bills using the button above.</p>
              </div>
            ) : (
              <div className="table-container" style={{ border: 'none' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Bill No</th>
                      <th>Student & Class</th>
                      <th>Period</th>
                      <th style={{ textAlign: 'right' }}>Total Payable</th>
                      <th style={{ textAlign: 'right' }}>Paid</th>
                      <th style={{ textAlign: 'right' }}>Balance Due</th>
                      <th>Due Date</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBills.map((b) => (
                      <tr key={b.id}>
                        <td style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--blue-60)' }}>
                          {b.bill_no}
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--neutral-9)' }}>{b.student_name}</div>
                          <div className="text-xs text-muted">
                            {b.admission_no} • {b.class_name}
                          </div>
                        </td>
                        <td style={{ fontWeight: 600 }}>{b.bill_period_label}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(b.total_payable)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: '#2e844a' }}>{fmt(b.amount_paid)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 800, color: b.balance_due > 0 ? '#dd7a01' : '#2e844a' }}>
                          {fmt(b.balance_due)}
                        </td>
                        <td style={{ fontWeight: 500 }}>{b.due_date}</td>
                        <td>{getStatusBadge(b.status)}</td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                            <button
                              onClick={() => downloadBillPDF(b.id, b.bill_no)}
                              className="btn btn-neutral btn-sm"
                              title="Download Demand Slip PDF"
                            >
                              <i className="ti ti-download"></i> PDF
                            </button>
                            <button
                              onClick={() => navigate(`/finance/students/${b.student_id}/ledger`)}
                              className="btn btn-neutral btn-sm"
                              title="View Student Ledger"
                            >
                              <i className="ti ti-file-text"></i> Ledger
                            </button>
                            {b.balance_due > 0 && (
                              <button
                                onClick={() => navigate(`/finance/payments/collect?student_id=${b.student_id}&bill_id=${b.id}`)}
                                className="btn btn-primary btn-sm"
                              >
                                Pay
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Generate Demand Bills Modal */}
          {genModal && (
            <div className="modal-backdrop">
              <div className="modal" style={{ maxWidth: 540 }}>
                <div className="modal-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 8, background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <i className="ti ti-calculator" style={{ fontSize: '1.25rem' }}></i>
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0 }}>Fees Generate Engine</h3>
                      <div className="text-xs text-muted">Generate centralized multi-department fee bills & demand slips</div>
                    </div>
                  </div>
                  <button onClick={() => setGenModal(false)} className="modal-close">✕</button>
                </div>

                <form onSubmit={handleGenerateBills}>
                  <div className="modal-body">
                    {/* Session & Cadence Row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontWeight: 600 }}>Academic Session</label>
                        <select
                          value={genSession}
                          onChange={(e) => setGenSession(e.target.value)}
                          className="form-select"
                          required
                        >
                          <option value="2026-27">2026-27 (Upcoming)</option>
                          <option value="2025-26">2025-26 (Current)</option>
                          <option value="2024-25">2024-25 (Historical)</option>
                        </select>
                      </div>

                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontWeight: 600 }}>Billing Cadence</label>
                        <select
                          value={genCadence}
                          onChange={(e) => setGenCadence(e.target.value)}
                          className="form-select"
                        >
                          <option value="MONTHLY">Monthly (1 Month)</option>
                          <option value="QUARTERLY">Quarterly (3 Months)</option>
                          <option value="HALF_YEARLY">Half-Yearly (6 Months)</option>
                          <option value="ANNUAL">Annual (Full Session)</option>
                        </select>
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 600 }}>Billing Period (Starting Month)</label>
                      <input
                        type="month"
                        value={genMonth}
                        onChange={(e) => setGenMonth(e.target.value)}
                        required
                        className="form-input"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 600 }}>Due Date (Payment Deadline)</label>
                      <input
                        type="date"
                        value={genDueDate}
                        onChange={(e) => setGenDueDate(e.target.value)}
                        required
                        className="form-input"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 600 }}>Target Class / Scope</label>
                      <select
                        value={genClassId}
                        onChange={(e) => setGenClassId(e.target.value)}
                        className="form-select"
                      >
                        <option value="">All Classes (School-wide Bulk Generation)</option>
                        {classes.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} {c.section || ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={{ marginTop: 14, padding: '12px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
                        <input
                          type="checkbox"
                          checked={forceRegenerate}
                          onChange={(e) => setForceRegenerate(e.target.checked)}
                          style={{ width: 17, height: 17, marginTop: 2 }}
                        />
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>
                            Sync & Recalculate with Active Services (Force Refresh)
                          </div>
                          <div className="text-xs text-muted" style={{ marginTop: 2 }}>
                            Re-evaluates active services for students who joined Transport, occupied a Hostel bed, or activated Library card after previous generation.
                          </div>
                        </div>
                      </label>
                    </div>

                    <div style={{ marginTop: 12, padding: '10px 12px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 8, fontSize: '0.8rem', color: '#065f46' }}>
                      <i className="ti ti-shield-check" style={{ marginRight: 6 }}></i>
                      <strong>Duplicate Protection:</strong> Students with existing bills for this period are safely skipped unless Force Refresh is enabled.
                    </div>
                  </div>

                  <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => setGenModal(false)}
                      className="btn btn-neutral"
                      disabled={generating}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={generating}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        background: '#2563eb',
                        fontWeight: 700,
                        padding: '8px 20px',
                      }}
                    >
                      {generating ? (
                        <>
                          <span className="spinner-border spinner-border-sm" role="status"></span>
                          Generating Bills...
                        </>
                      ) : (
                        <>
                          <i className="ti ti-calculator"></i>
                          Generate Fees Now
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
