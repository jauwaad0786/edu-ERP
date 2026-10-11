import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import api from '../api/axios';
import toast from 'react-hot-toast';

export default function StudentLeavePage() {
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('ederp_theme') === 'dark');
  useEffect(() => { localStorage.setItem('ederp_theme', darkMode ? 'dark' : 'light'); }, [darkMode]);

  const curUser = JSON.parse(localStorage.getItem('ederp_user') || '{}');
  const role = String(curUser.role || '').toUpperCase();
  const isParent = role === 'PARENT';
  const isStudent = role === 'STUDENT';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [requests, setRequests] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [children, setChildren] = useState([]);
  const [selectedChildId, setSelectedChildId] = useState('');

  // Apply Leave Modal State
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    leave_type_id: '',
    from_date: '',
    to_date: '',
    is_half_day: false,
    reason: '',
    child_id: '',
  });

  const loadData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true); else setRefreshing(true);
    try {
      const [leavesRes, typesRes, kidsRes] = await Promise.all([
        api.get('/hrms/my/leaves').catch(() => ({ data: { requests: [] } })),
        api.get('/hrms/leaves/types').catch(() => ({ data: [] })),
        isParent ? api.get('/student/children').catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
      ]);

      const reqs = leavesRes.data?.requests || (Array.isArray(leavesRes.data) ? leavesRes.data : []);
      setRequests(reqs);

      const types = Array.isArray(typesRes.data) ? typesRes.data : (typesRes.data?.types || []);
      setLeaveTypes(types);
      if (types.length > 0 && !form.leave_type_id) {
        setForm(prev => ({ ...prev, leave_type_id: types[0].id }));
      }

      if (isParent) {
        const rawKids = kidsRes.data;
        const kList = Array.isArray(rawKids) ? rawKids : (rawKids?.children || []);
        setChildren(kList);
        if (kList.length > 0 && !selectedChildId) {
          setSelectedChildId(kList[0].id);
          setForm(prev => ({ ...prev, child_id: kList[0].id }));
        }
      }
    } catch {
      toast.error('Failed to load leave records');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isParent, selectedChildId, form.leave_type_id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleApplySubmit = async (e) => {
    e.preventDefault();
    if (!form.leave_type_id || !form.from_date || !form.to_date || !form.reason.trim()) {
      toast.error('Please fill all required fields');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        leave_type_id: form.leave_type_id,
        from_date: form.from_date,
        to_date: form.to_date,
        is_half_day: form.is_half_day,
        reason: form.reason.trim(),
      };
      if (isParent) {
        payload.student_id = form.child_id || selectedChildId;
      }

      await api.post('/hrms/leaves/requests', payload);
      toast.success('Leave application submitted for principal approval!');
      setShowApplyModal(false);
      setForm(prev => ({
        ...prev,
        from_date: '',
        to_date: '',
        is_half_day: false,
        reason: '',
      }));
      loadData(true);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit leave application');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredRequests = requests.filter(r => {
    if (!isParent || !selectedChildId) return true;
    // If request user or student matches
    if (r.student_id) return String(r.student_id) === String(selectedChildId);
    return true;
  });

  const stats = {
    total: filteredRequests.length,
    pending: filteredRequests.filter(r => (r.status || '').toUpperCase() === 'PENDING').length,
    approved: filteredRequests.filter(r => (r.status || '').toUpperCase() === 'APPROVED').length,
    rejected: filteredRequests.filter(r => (r.status || '').toUpperCase() === 'REJECTED').length,
  };

  return (
    <div className={`app-shell ${darkMode ? 'dark' : ''}`}>
      <Sidebar />
      <div className="main-content">
        <Navbar title={isStudent ? 'My Leave Applications' : isParent ? 'Child Leave Applications' : 'Leave Management'} />

        <div className="page-body" style={{ padding: '24px 32px' }}>
          {/* Header Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
            <div>
              <h2 style={{ fontSize: 24, fontWeight: 800, color: darkMode ? '#f8fafc' : '#0f172a', margin: 0 }}>
                {isStudent ? '🎒 Student Leave Applications' : isParent ? '👨‍👩‍👦 Child Leave Applications' : '📋 Leave Applications'}
              </h2>
              <p style={{ color: darkMode ? '#94a3b8' : '#64748b', fontSize: 13, marginTop: 4, margin: 0 }}>
                {isParent
                  ? 'Submit official absence notices for your children directly to the school principal and teachers.'
                  : 'Submit absence notices or medical leave requests directly for official verification.'}
              </p>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                className="btn btn-secondary"
                onClick={() => loadData(true)}
                disabled={refreshing}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 8, fontWeight: 600 }}
              >
                🔄 {refreshing ? 'Refreshing...' : 'Refresh'}
              </button>
              <button
                className="btn btn-primary"
                onClick={() => setShowApplyModal(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '9px 20px', borderRadius: 8, fontWeight: 700,
                  background: 'linear-gradient(135deg, #0284c7, #0b57d0)',
                  boxShadow: '0 4px 12px rgba(11, 87, 208, 0.25)',
                }}
              >
                ➕ Apply for Leave
              </button>
            </div>
          </div>

          {/* Child Switcher for Parents */}
          {isParent && children.length > 0 && (
            <div style={{
              background: darkMode ? '#1e293b' : '#fff',
              border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
              borderRadius: 12, padding: '12px 18px', marginBottom: 20,
              display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
            }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: darkMode ? '#cbd5e1' : '#475569' }}>
                Select Child:
              </span>
              {children.map(c => {
                const isSel = String(selectedChildId) === String(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSelectedChildId(c.id);
                      setForm(prev => ({ ...prev, child_id: c.id }));
                    }}
                    style={{
                      padding: '7px 16px', borderRadius: 20, border: '1.5px solid',
                      borderColor: isSel ? '#0284c7' : (darkMode ? '#475569' : '#cbd5e1'),
                      background: isSel ? '#0284c7' : (darkMode ? '#0f172a' : '#f8fafc'),
                      color: isSel ? '#fff' : (darkMode ? '#f1f5f9' : '#1e293b'),
                      fontWeight: 700, fontSize: 13, cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    👤 {c.name} ({c.class_display || c.class_name || 'Class'})
                  </button>
                );
              })}
            </div>
          )}

          {/* KPI Statistics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 16, marginBottom: 24 }}>
            <div style={{
              background: darkMode ? '#1e293b' : '#fff',
              border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
              borderRadius: 12, padding: 18,
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total Applications</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: darkMode ? '#f8fafc' : '#0f172a', marginTop: 4 }}>
                {stats.total}
              </div>
            </div>

            <div style={{
              background: darkMode ? '#1e293b' : '#fff',
              border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
              borderRadius: 12, padding: 18,
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#d97706', textTransform: 'uppercase' }}>Pending Review</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: '#d97706', marginTop: 4 }}>
                {stats.pending}
              </div>
            </div>

            <div style={{
              background: darkMode ? '#1e293b' : '#fff',
              border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
              borderRadius: 12, padding: 18,
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#16a34a', textTransform: 'uppercase' }}>Approved</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: '#16a34a', marginTop: 4 }}>
                {stats.approved}
              </div>
            </div>

            <div style={{
              background: darkMode ? '#1e293b' : '#fff',
              border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
              borderRadius: 12, padding: 18,
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', textTransform: 'uppercase' }}>Rejected</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: '#dc2626', marginTop: 4 }}>
                {stats.rejected}
              </div>
            </div>
          </div>

          {/* Applications Table / Cards */}
          <div style={{
            background: darkMode ? '#1e293b' : '#fff',
            border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
            borderRadius: 14, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
          }}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ fontSize: 15, fontWeight: 700, color: darkMode ? '#f8fafc' : '#0f172a', margin: 0 }}>
                Leave History ({filteredRequests.length})
              </h4>
            </div>

            {loading ? (
              <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
                Loading leave records...
              </div>
            ) : filteredRequests.length === 0 ? (
              <div style={{ padding: 48, textAlign: 'center' }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>🏖️</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: darkMode ? '#cbd5e1' : '#334155' }}>
                  No Leave Applications Found
                </div>
                <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 4, maxWidth: 380, margin: '8px auto 16px' }}>
                  You have not submitted any leave applications yet. Click "Apply for Leave" above to request an absence.
                </p>
                <button
                  className="btn btn-primary"
                  onClick={() => setShowApplyModal(true)}
                  style={{ padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}
                >
                  Apply Now
                </button>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: darkMode ? '#0f172a' : '#f8fafc', color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      <th style={{ padding: '12px 18px' }}>Leave Type</th>
                      <th style={{ padding: '12px 18px' }}>Dates & Duration</th>
                      <th style={{ padding: '12px 18px' }}>Reason</th>
                      <th style={{ padding: '12px 18px' }}>Status</th>
                      <th style={{ padding: '12px 18px' }}>Reviewer Remarks</th>
                      <th style={{ padding: '12px 18px' }}>Applied On</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRequests.map(r => {
                      const st = (r.status || 'PENDING').toUpperCase();
                      const isApproved = st === 'APPROVED';
                      const isPending = st === 'PENDING';
                      const isRejected = st === 'REJECTED';

                      const badgeBg = isApproved ? '#dcfce7' : isPending ? '#fef3c7' : '#fee2e2';
                      const badgeColor = isApproved ? '#15803d' : isPending ? '#b45309' : '#b91c1c';

                      return (
                        <tr key={r.id} style={{ borderBottom: `1px solid ${darkMode ? '#334155' : '#f1f5f9'}` }}>
                          <td style={{ padding: '14px 18px', fontWeight: 600, color: darkMode ? '#f1f5f9' : '#1e293b' }}>
                            {r.leave_type_name || 'Leave'}
                            {r.is_half_day && (
                              <span style={{ marginLeft: 6, fontSize: 10, background: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: 4 }}>
                                Half Day
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '14px 18px', color: darkMode ? '#cbd5e1' : '#334155' }}>
                            <div>{r.from_date} {r.to_date !== r.from_date && `→ ${r.to_date}`}</div>
                            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                              {r.days_count} {r.days_count === 1 ? 'day' : 'days'}
                            </div>
                          </td>
                          <td style={{ padding: '14px 18px', color: darkMode ? '#cbd5e1' : '#475569', maxWidth: 260 }}>
                            {r.reason}
                          </td>
                          <td style={{ padding: '14px 18px' }}>
                            <span style={{
                              padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                              background: badgeBg, color: badgeColor, display: 'inline-block',
                            }}>
                              {isPending ? '⏳ PENDING REVIEW' : isApproved ? '✅ APPROVED' : '❌ REJECTED'}
                            </span>
                          </td>
                          <td style={{ padding: '14px 18px', color: darkMode ? '#94a3b8' : '#64748b' }}>
                            {r.review_remarks ? (
                              <span>💬 {r.review_remarks}</span>
                            ) : (
                              <span style={{ color: '#94a3b8' }}>—</span>
                            )}
                          </td>
                          <td style={{ padding: '14px 18px', color: '#94a3b8', fontSize: 12 }}>
                            {r.created_at ? r.created_at.slice(0, 10) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Apply Leave Modal */}
      {showApplyModal && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          backdropFilter: 'blur(3px)',
        }}>
          <div style={{
            background: darkMode ? '#1e293b' : '#fff',
            borderRadius: 16, width: '100%', maxWidth: 520, padding: 28,
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: darkMode ? '#f8fafc' : '#0f172a' }}>
                Apply for Leave
              </h3>
              <button
                onClick={() => setShowApplyModal(false)}
                style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleApplySubmit}>
              {/* If Parent: Child Selector */}
              {isParent && children.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>
                    Child *
                  </label>
                  <select
                    className="form-select"
                    value={form.child_id}
                    onChange={e => setForm({ ...form, child_id: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8 }}
                  >
                    {children.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.class_display || c.class_name || 'Class'})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Leave Type */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>
                  Leave Category *
                </label>
                <select
                  className="form-select"
                  value={form.leave_type_id}
                  onChange={e => setForm({ ...form, leave_type_id: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8 }}
                  required
                >
                  {leaveTypes.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Pickers */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>
                    Start Date *
                  </label>
                  <input
                    type="date"
                    className="form-input"
                    value={form.from_date}
                    onChange={e => setForm({ ...form, from_date: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8 }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>
                    End Date *
                  </label>
                  <input
                    type="date"
                    className="form-input"
                    value={form.to_date}
                    onChange={e => setForm({ ...form, to_date: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8 }}
                    required
                  />
                </div>
              </div>

              {/* Half Day Checkbox */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: darkMode ? '#cbd5e1' : '#334155' }}>
                  <input
                    type="checkbox"
                    checked={form.is_half_day}
                    onChange={e => setForm({ ...form, is_half_day: e.target.checked })}
                  />
                  Half-Day Leave
                </label>
              </div>

              {/* Reason */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>
                  Reason / Remarks *
                </label>
                <textarea
                  className="form-input"
                  rows={3}
                  placeholder="State the reason for absence..."
                  value={form.reason}
                  onChange={e => setForm({ ...form, reason: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, resize: 'vertical' }}
                  required
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowApplyModal(false)}
                  style={{ padding: '9px 18px', borderRadius: 8 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                  style={{ padding: '9px 24px', borderRadius: 8, fontWeight: 700 }}
                >
                  {submitting ? 'Submitting...' : 'Submit Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
