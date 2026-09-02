import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function LeaveManagementPage() {
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('ederp_theme') === 'dark');
  useEffect(() => { localStorage.setItem('ederp_theme', darkMode ? 'dark' : 'light'); }, [darkMode]);

  const [activeTab, setActiveTab] = useState('requests'); // requests, balances, types, official_duty
  const [loading, setLoading] = useState(true);

  const [requests, setRequests] = useState([]);
  const [balances, setBalances] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [officialDuties, setOfficialDuties] = useState([]);

  // Review Modal State
  const [reviewModal, setReviewModal] = useState({ show: false, request: null, isOD: false, remarks: '' });
  const [submittingReview, setSubmittingReview] = useState(false);

  // New Leave Type Modal State
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [typeForm, setTypeForm] = useState({ name: '', code: '', annual_quota: 12, is_paid: true, allow_half_day: true });

  const loadData = () => {
    setLoading(true);
    Promise.all([
      api.get('/hrms/leaves/requests'),
      api.get('/hrms/leaves/balances'),
      api.get('/hrms/leaves/types'),
      api.get('/hrms/official-duty'),
    ])
      .then(([reqRes, balRes, typeRes, odRes]) => {
        setRequests(reqRes.data || []);
        setBalances(balRes.data || []);
        setLeaveTypes(typeRes.data || []);
        setOfficialDuties(odRes.data || []);
      })
      .catch(err => toast.error(err.response?.data?.error || 'Failed to load leave data'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleReview = async (approve) => {
    if (!reviewModal.request) return;
    setSubmittingReview(true);
    try {
      if (reviewModal.isOD) {
        await api.post(`/hrms/official-duty/${reviewModal.request.id}/review`, {
          approve, remarks: reviewModal.remarks
        });
        toast.success(approve ? 'Official duty approved' : 'Official duty rejected');
      } else {
        await api.post(`/hrms/leaves/requests/${reviewModal.request.id}/review`, {
          approve, remarks: reviewModal.remarks
        });
        toast.success(approve ? 'Leave approved and synced to attendance' : 'Leave rejected');
      }
      setReviewModal({ show: false, request: null, isOD: false, remarks: '' });
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Action failed');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleCreateType = async (e) => {
    e.preventDefault();
    try {
      await api.post('/hrms/leaves/types', typeForm);
      toast.success('Leave type created');
      setShowTypeModal(false);
      setTypeForm({ name: '', code: '', annual_quota: 12, is_paid: true, allow_half_day: true });
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create leave type');
    }
  };

  const cardBg = {
    background: darkMode ? '#141b2d' : '#ffffff',
    borderColor: darkMode ? '#1e293b' : '#e2e8f0',
    color: darkMode ? '#f8fafc' : '#0f172a'
  };

  const pendingCount = requests.filter(r => r.status === 'PENDING').length;
  const pendingODCount = officialDuties.filter(d => d.status === 'PENDING').length;

  return (
    <div className={`app-shell${darkMode ? ' theme-dark' : ''}`}>
      <Sidebar darkMode={darkMode} />
      <div className="main-content">
        <Navbar title="Leave &amp; Official Duty Hub" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />

        <div className="page-body">
          {/* Header Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
            <div>
              <h2 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: 800 }}>Employee Leave Management</h2>
              <span style={{ fontSize: '13px', color: '#64748b' }}>
                Leave approvals, session balances, policy quotas, and outdoor duty tracking
              </span>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setShowTypeModal(true)}
                style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '9px 16px', borderRadius: '8px', fontWeight: 700, fontSize: '12.5px', cursor: 'pointer' }}
              >
                + Configure Leave Type
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: `1px solid ${darkMode ? '#1e293b' : '#e2e8f0'}`, paddingBottom: '10px' }}>
            {[
              { id: 'requests', label: `Leave Applications (${pendingCount} Pending)`, icon: 'ti-calendar-event', badge: pendingCount },
              { id: 'official_duty', label: `Official Duty (${pendingODCount} Pending)`, icon: 'ti-briefcase', badge: pendingODCount },
              { id: 'balances', label: 'Employee Leave Balances', icon: 'ti-chart-bar' },
              { id: 'types', label: 'Leave Types & Policy', icon: 'ti-settings' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  background: activeTab === tab.id ? (darkMode ? '#3b82f6' : '#eff6ff') : 'transparent',
                  color: activeTab === tab.id ? (darkMode ? '#ffffff' : '#2563eb') : '#64748b',
                  border: activeTab === tab.id ? (darkMode ? 'none' : '1px solid #bfdbfe') : 'none',
                  padding: '8px 16px', borderRadius: '8px', fontWeight: 700, fontSize: '12.5px',
                  display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer'
                }}
              >
                <i className={`ti ${tab.icon}`} /> {tab.label}
              </button>
            ))}
          </div>

          {/* ══ TAB 1: Leave Requests Queue ══ */}
          {activeTab === 'requests' && (
            <div style={{ ...cardBg, borderRadius: '16px', border: '1px solid', overflow: 'hidden' }}>
              {requests.length === 0 ? (
                <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
                  <i className="ti ti-calendar-off" style={{ fontSize: '36px', marginBottom: '8px' }} />
                  <p>No leave requests found.</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: darkMode ? '#0f172a' : '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
                        <th style={{ padding: '14px 18px' }}>Employee</th>
                        <th style={{ padding: '14px 18px' }}>Leave Type</th>
                        <th style={{ padding: '14px 18px' }}>Duration</th>
                        <th style={{ padding: '14px 18px' }}>Days</th>
                        <th style={{ padding: '14px 18px' }}>Reason</th>
                        <th style={{ padding: '14px 18px' }}>Status</th>
                        <th style={{ padding: '14px 18px', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {requests.map((r) => (
                        <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '12px 18px', fontWeight: 700 }}>
                            {r.employee_name}
                            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 400 }}>ID: {r.employee_id} • {r.role}</div>
                          </td>
                          <td style={{ padding: '12px 18px' }}>
                            <span style={{
                              background: r.is_paid ? '#10b98118' : '#ef444418',
                              color: r.is_paid ? '#10b981' : '#ef4444',
                              padding: '3px 8px', borderRadius: '6px', fontSize: '11.5px', fontWeight: 700
                            }}>
                              {r.leave_type_name} ({r.leave_type_code})
                            </span>
                          </td>
                          <td style={{ padding: '12px 18px', color: '#64748b' }}>
                            {r.from_date} {r.from_date !== r.to_date ? `to ${r.to_date}` : ''}
                          </td>
                          <td style={{ padding: '12px 18px', fontWeight: 700 }}>
                            {r.days_count} {r.is_half_day ? '(Half Day)' : 'Day(s)'}
                          </td>
                          <td style={{ padding: '12px 18px', maxWidth: '220px', color: '#475569' }}>
                            {r.reason}
                          </td>
                          <td style={{ padding: '12px 18px' }}>
                            <span style={{
                              background: r.status === 'APPROVED' ? '#10b98118' : r.status === 'REJECTED' ? '#ef444418' : '#f59e0b18',
                              color: r.status === 'APPROVED' ? '#10b981' : r.status === 'REJECTED' ? '#ef4444' : '#f59e0b',
                              padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 800
                            }}>
                              {r.status}
                            </span>
                          </td>
                          <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                            {r.status === 'PENDING' ? (
                              <button
                                onClick={() => setReviewModal({ show: true, request: r, isOD: false, remarks: '' })}
                                style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                              >
                                Review Request
                              </button>
                            ) : (
                              <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>Reviewed by {r.reviewer_name || 'Admin'}</span>
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

          {/* ══ TAB 2: Official Duty ══ */}
          {activeTab === 'official_duty' && (
            <div style={{ ...cardBg, borderRadius: '16px', border: '1px solid', overflow: 'hidden' }}>
              {officialDuties.length === 0 ? (
                <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
                  <i className="ti ti-briefcase-off" style={{ fontSize: '36px', marginBottom: '8px' }} />
                  <p>No official duty requests found.</p>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: darkMode ? '#0f172a' : '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
                      <th style={{ padding: '14px 18px' }}>Employee</th>
                      <th style={{ padding: '14px 18px' }}>Duty Type</th>
                      <th style={{ padding: '14px 18px' }}>Date Range</th>
                      <th style={{ padding: '14px 18px' }}>Location</th>
                      <th style={{ padding: '14px 18px' }}>Purpose</th>
                      <th style={{ padding: '14px 18px' }}>Status</th>
                      <th style={{ padding: '14px 18px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {officialDuties.map((d) => (
                      <tr key={d.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 18px', fontWeight: 700 }}>
                          {d.employee_name}
                          <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 400 }}>ID: {d.employee_id}</div>
                        </td>
                        <td style={{ padding: '12px 18px', fontWeight: 600 }}>{d.duty_type}</td>
                        <td style={{ padding: '12px 18px', color: '#64748b' }}>{d.from_date} to {d.to_date}</td>
                        <td style={{ padding: '12px 18px' }}>📍 {d.location}</td>
                        <td style={{ padding: '12px 18px', maxWidth: '200px' }}>{d.purpose}</td>
                        <td style={{ padding: '12px 18px' }}>
                          <span style={{
                            background: d.status === 'APPROVED' ? '#10b98118' : d.status === 'REJECTED' ? '#ef444418' : '#f59e0b18',
                            color: d.status === 'APPROVED' ? '#10b981' : d.status === 'REJECTED' ? '#ef4444' : '#f59e0b',
                            padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 800
                          }}>
                            {d.status}
                          </span>
                        </td>
                        <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                          {d.status === 'PENDING' ? (
                            <button
                              onClick={() => setReviewModal({ show: true, request: d, isOD: true, remarks: '' })}
                              style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                            >
                              Review OD
                            </button>
                          ) : (
                            <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>Reviewed</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ══ TAB 3: Balances Table ══ */}
          {activeTab === 'balances' && (
            <div style={{ ...cardBg, borderRadius: '16px', border: '1px solid', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', fontWeight: 700 }}>
                Leave Balance Quotas (Academic Year {new Date().getFullYear()})
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: darkMode ? '#0f172a' : '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
                    <th style={{ padding: '12px 18px' }}>Employee</th>
                    <th style={{ padding: '12px 18px' }}>Leave Type</th>
                    <th style={{ padding: '12px 18px' }}>Allocated</th>
                    <th style={{ padding: '12px 18px' }}>Used</th>
                    <th style={{ padding: '12px 18px' }}>Pending Approval</th>
                    <th style={{ padding: '12px 18px' }}>Remaining Days</th>
                  </tr>
                </thead>
                <tbody>
                  {balances.map((b) => (
                    <tr key={b.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 18px', fontWeight: 700 }}>{b.employee_name}</td>
                      <td style={{ padding: '12px 18px' }}>{b.leave_type_name} ({b.leave_type_code})</td>
                      <td style={{ padding: '12px 18px' }}>{b.allocated}</td>
                      <td style={{ padding: '12px 18px', color: '#ef4444' }}>{b.used}</td>
                      <td style={{ padding: '12px 18px', color: '#f59e0b' }}>{b.pending}</td>
                      <td style={{ padding: '12px 18px', fontWeight: 800, color: '#10b981' }}>{b.remaining} Days</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ══ TAB 4: Leave Types Configuration ══ */}
          {activeTab === 'types' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              {leaveTypes.map((t) => (
                <div key={t.id} style={{ ...cardBg, borderRadius: '14px', border: '1px solid', padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>{t.name}</h4>
                    <span style={{
                      background: t.is_paid ? '#10b98118' : '#ef444418',
                      color: t.is_paid ? '#10b981' : '#ef4444',
                      padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 800
                    }}>
                      {t.is_paid ? 'PAID LEAVE' : 'UNPAID (LOP)'}
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '12px' }}>
                    Code: <b>{t.code}</b> • Annual Quota: <b>{t.annual_quota} Days</b>
                  </div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                    Half-day allowed: {t.allow_half_day ? 'Yes' : 'No'} • Requires Approval: {t.requires_approval ? 'Yes' : 'No'}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Review Approval Modal */}
          {reviewModal.show && (
            <div style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px'
            }}>
              <div style={{ ...cardBg, borderRadius: '18px', width: '100%', maxWidth: '520px', padding: '24px', border: '1px solid' }}>
                <h3 style={{ margin: '0 0 12px', fontSize: '17px', fontWeight: 800 }}>
                  Review {reviewModal.isOD ? 'Official Duty' : 'Leave Request'}
                </h3>
                <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#64748b' }}>
                  For <b>{reviewModal.request?.employee_name}</b> ({reviewModal.request?.from_date} to {reviewModal.request?.to_date})
                </p>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Review Remarks / Notes</label>
                  <textarea
                    rows={3} placeholder="Approval / Rejection comments..."
                    value={reviewModal.remarks} onChange={e => setReviewModal({ ...reviewModal, remarks: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                  <button
                    onClick={() => setReviewModal({ show: false, request: null, isOD: false, remarks: '' })}
                    style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'transparent', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => handleReview(false)} disabled={submittingReview}
                      style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#ef4444', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleReview(true)} disabled={submittingReview}
                      style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', background: '#10b981', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Approve &amp; Sync Attendance
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* New Leave Type Modal */}
          {showTypeModal && (
            <div style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px'
            }}>
              <div style={{ ...cardBg, borderRadius: '18px', width: '100%', maxWidth: '480px', padding: '24px', border: '1px solid' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: '17px', fontWeight: 800 }}>Create Leave Type</h3>
                <form onSubmit={handleCreateType}>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Leave Type Name *</label>
                    <input
                      type="text" required placeholder="e.g. Special Privilege Leave" value={typeForm.name}
                      onChange={e => setTypeForm({ ...typeForm, name: e.target.value })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                    />
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Code *</label>
                    <input
                      type="text" required placeholder="e.g. SPL" value={typeForm.code}
                      onChange={e => setTypeForm({ ...typeForm, code: e.target.value })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                    />
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Annual Quota (Days)</label>
                    <input
                      type="number" value={typeForm.annual_quota}
                      onChange={e => setTypeForm({ ...typeForm, annual_quota: parseFloat(e.target.value) || 0 })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                    />
                  </div>
                  <div style={{ marginBottom: '16px', display: 'flex', gap: '16px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px' }}>
                      <input
                        type="checkbox" checked={typeForm.is_paid}
                        onChange={e => setTypeForm({ ...typeForm, is_paid: e.target.checked })}
                      />
                      Paid Leave (No salary deduction)
                    </label>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button
                      type="button" onClick={() => setShowTypeModal(false)}
                      style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'transparent', cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', background: '#3b82f6', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Create Leave Type
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
