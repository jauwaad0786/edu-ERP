import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import api from '../api/axios';
import toast from 'react-hot-toast';

export default function ProvisionalAdmissionsPage() {
  const navigate = useNavigate();

  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');

  // Collect Fee & Confirm Modal
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [pendingRecord, setPendingRecord] = useState(null);
  const [fetchingRecord, setFetchingRecord] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState('CASH');
  const [payRef, setPayRef] = useState('');
  const [payRemarks, setPayRemarks] = useState('');
  const [processingPay, setProcessingPay] = useState(false);

  // Cancel / Delete Modal
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [resStudents, resClasses] = await Promise.all([
        api.get('/principal/students?status=PROVISIONAL'),
        api.get('/principal/classes')
      ]);
      const stList = Array.isArray(resStudents.data) ? resStudents.data : (resStudents.data.data || []);
      setStudents(stList);
      setClasses(resClasses.data || []);
    } catch (err) {
      toast.error('Failed to load provisional admissions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter students
  const filtered = students.filter(s => {
    const sName = (s.name || '').toLowerCase();
    const pNo = (s.provisional_no || s.admission_no || '').toLowerCase();
    const phone = (s.parent_phone || '').toLowerCase();
    const fName = (s.father_name || '').toLowerCase();
    const query = search.toLowerCase();

    const matchesSearch = !query || sName.includes(query) || pNo.includes(query) || phone.includes(query) || fName.includes(query);
    const matchesClass = !classFilter || String(s.class_id) === String(classFilter);

    return matchesSearch && matchesClass;
  });

  // Open Collect & Confirm Modal
  const openConfirmModal = async (student) => {
    setConfirmTarget(student);
    setFetchingRecord(true);
    setPendingRecord(null);
    setPayMode('CASH');
    setPayRef('');
    setPayRemarks('Admission fee clearance & confirmation');

    try {
      // Find pending admission fee record for this student
      const res = await api.get(`/principal/fees?student_id=${student.id}`);
      const recs = res.data?.records || res.data || [];
      const pendingRec = Array.isArray(recs) ? recs.find(r => r.status !== 'PAID' && (r.due_amount > 0 || r.amount > (r.amount_paid || 0))) : null;

      if (pendingRec) {
        setPendingRecord(pendingRec);
        const due = pendingRec.due_amount ?? (pendingRec.amount - (pendingRec.amount_paid || 0));
        setPayAmount(due > 0 ? due : 5000);
      } else {
        setPayAmount(5000);
      }
    } catch (err) {
      setPayAmount(5000);
    } finally {
      setFetchingRecord(false);
    }
  };

  // Submit payment to auto-confirm
  const handleConfirmAdmission = async (e) => {
    e.preventDefault();
    if (!confirmTarget) return;

    setProcessingPay(true);
    try {
      let res;
      if (pendingRecord && pendingRecord.id) {
        // Collect on existing record
        res = await api.post('/principal/fees/collect', {
          record_id: pendingRecord.id,
          amount_paid: parseFloat(payAmount) || 0,
          payment_mode: payMode,
          remarks: payRemarks,
          reference: payRef
        });
      } else {
        // Direct fee record creation and settlement
        res = await api.post('/principal/fees', {
          student_id: confirmTarget.id,
          fee_type: 'ADMISSION',
          amount: parseFloat(payAmount) || 0,
          amount_paid: parseFloat(payAmount) || 0,
          payment_mode: payMode,
          remarks: payRemarks,
          status: 'PAID'
        });
      }

      toast.success(`Admission Confirmed! Official admission number issued.`, { duration: 5000 });
      setConfirmTarget(null);
      loadData();
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.message || 'Payment collection failed';
      toast.error(msg);
    } finally {
      setProcessingPay(false);
    }
  };

  // Cancel / Delete unconfirmed application
  const handleDeleteProvisional = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/principal/students/${deleteTarget.id}`, {
        data: { reason: 'Provisional application cancelled / applicant withdrew' }
      });
      toast.success('Provisional application removed');
      setDeleteTarget(null);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove application');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc', color: '#1e293b', fontFamily: 'Inter, sans-serif' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Navbar />

        <main style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
          {/* Header Banner */}
          <div style={{
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            borderRadius: 16,
            padding: '24px 28px',
            color: '#fff',
            marginBottom: 24,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16,
            boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.15)'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 24 }}>⏳</span>
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: '#f8fafc' }}>
                  Provisional Admissions (Unconfirmed)
                </h1>
                <span style={{
                  background: '#fef3c7',
                  color: '#92400e',
                  fontSize: 12,
                  fontWeight: 700,
                  padding: '2px 10px',
                  borderRadius: 20,
                  border: '1px solid #fde68a'
                }}>
                  {students.length} Pending
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: '#94a3b8', maxWidth: 720, lineHeight: 1.5 }}>
                These applicants registered with admission fees skipped or pending. They hold a temporary <strong>PROV-</strong> identifier and are strictly isolated from regular student rosters, attendance, and official school counts until confirmed.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button
                onClick={() => navigate('/students')}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: '#f8fafc',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: 8,
                  padding: '9px 16px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.15s'
                }}
              >
                <i className="ti ti-arrow-left" /> Back to Confirmed Students
              </button>
              <button
                onClick={() => navigate('/admission')}
                style={{
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '9px 16px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  boxShadow: '0 2px 8px rgba(217, 119, 6, 0.3)'
                }}
              >
                <i className="ti ti-plus" /> + New Admission
              </button>
            </div>
          </div>

          {/* Quick Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 20 }}>
            <div style={{ background: '#ffffff', padding: '16px 20px', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Provisional</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: '#b45309', marginTop: 4 }}>{students.length}</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Awaiting initial admission fee</div>
            </div>

            <div style={{ background: '#ffffff', padding: '16px 20px', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Permanent Admission No</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: '#0284c7', marginTop: 4 }}>Locked 🔒</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Assigned upon fee clearance</div>
            </div>

            <div style={{ background: '#ffffff', padding: '16px 20px', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Monthly Billing Status</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: '#16a34a', marginTop: 4 }}>Excluded ✅</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Safe from monthly fee runs</div>
            </div>
          </div>

          {/* Filters Bar */}
          <div style={{
            background: '#ffffff',
            borderRadius: 12,
            padding: '14px 18px',
            marginBottom: 20,
            border: '1px solid #e2e8f0',
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', flex: 1, minWidth: 260 }}>
              <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 200 }}>
                <i className="ti ti-search" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Search by student, provisional no, father, phone..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 36px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    fontSize: 13,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <select
                value={classFilter}
                onChange={e => setClassFilter(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  fontSize: 13,
                  outline: 'none',
                  background: '#fff',
                  cursor: 'pointer'
                }}
              >
                <option value="">All Applied Classes</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name} {c.section ? `(${c.section})` : ''}</option>
                ))}
              </select>
            </div>

            <button
              onClick={loadData}
              style={{
                background: '#f1f5f9',
                border: '1px solid #cbd5e1',
                borderRadius: 8,
                padding: '8px 14px',
                fontSize: 13,
                fontWeight: 600,
                color: '#475569',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <i className="ti ti-refresh" /> Refresh
            </button>
          </div>

          {/* Table */}
          <div style={{ background: '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            {loading ? (
              <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>
                <i className="ti ti-loader animate-spin" style={{ fontSize: 28, color: '#f59e0b' }} />
                <p style={{ marginTop: 12, fontSize: 14 }}>Loading provisional applicants...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                <span style={{ fontSize: 40 }}>🎉</span>
                <h3 style={{ margin: '12px 0 6px', fontSize: 16, fontWeight: 700, color: '#1e293b' }}>No Provisional Admissions</h3>
                <p style={{ margin: 0, fontSize: 13, color: '#64748b', maxWidth: 440, marginInline: 'auto' }}>
                  {search || classFilter ? 'No applicants match the filter criteria.' : 'All enrolled students have confirmed admissions and fees paid! No pending provisional applications.'}
                </p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      <th style={{ padding: '12px 18px', fontWeight: 600 }}>Provisional No</th>
                      <th style={{ padding: '12px 18px', fontWeight: 600 }}>Student Details</th>
                      <th style={{ padding: '12px 18px', fontWeight: 600 }}>Applied Class</th>
                      <th style={{ padding: '12px 18px', fontWeight: 600 }}>Parent Contact</th>
                      <th style={{ padding: '12px 18px', fontWeight: 600 }}>Status</th>
                      <th style={{ padding: '12px 18px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s, idx) => (
                      <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                        <td style={{ padding: '14px 18px' }}>
                          <span style={{
                            display: 'inline-block',
                            background: '#fef3c7',
                            color: '#92400e',
                            fontWeight: 700,
                            fontFamily: 'monospace',
                            fontSize: 12,
                            padding: '3px 8px',
                            borderRadius: 6,
                            border: '1px solid #fde68a'
                          }}>
                            {s.provisional_no || s.admission_no}
                          </span>
                        </td>
                        <td style={{ padding: '14px 18px' }}>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>{s.name}</div>
                          <div style={{ fontSize: 12, color: '#64748b' }}>Father: {s.father_name || '—'}</div>
                        </td>
                        <td style={{ padding: '14px 18px' }}>
                          <span style={{ background: '#e0f2fe', color: '#0369a1', fontWeight: 600, padding: '2px 8px', borderRadius: 4, fontSize: 12 }}>
                            {s.class_name ? `${s.class_name}${s.section ? ' - ' + s.section : ''}` : (s.class_display || '—')}
                          </span>
                        </td>
                        <td style={{ padding: '14px 18px' }}>
                          <div style={{ fontWeight: 600, color: '#334155' }}>{s.parent_phone || '—'}</div>
                          {s.parent_email && <div style={{ fontSize: 11, color: '#94a3b8' }}>{s.parent_email}</div>}
                        </td>
                        <td style={{ padding: '14px 18px' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            background: '#fee2e2',
                            color: '#991b1b',
                            fontWeight: 600,
                            fontSize: 11,
                            padding: '3px 8px',
                            borderRadius: 12,
                            border: '1px solid #fecaca'
                          }}>
                            <i className="ti ti-alert-circle" /> Fee Due (Unconfirmed)
                          </span>
                        </td>
                        <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: 8 }}>
                            <button
                              onClick={() => openConfirmModal(s)}
                              title="Collect Admission Fee & Confirm Admission"
                              style={{
                                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: 6,
                                padding: '6px 12px',
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                boxShadow: '0 1px 4px rgba(5, 150, 105, 0.2)'
                              }}
                            >
                              <i className="ti ti-cash" /> Collect & Confirm
                            </button>

                            <button
                              onClick={() => navigate(`/students/${s.id}`)}
                              title="Complete Profile & Documents"
                              style={{
                                background: '#f1f5f9',
                                color: '#334155',
                                border: '1px solid #cbd5e1',
                                borderRadius: 6,
                                padding: '6px 10px',
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: 'pointer'
                              }}
                            >
                              <i className="ti ti-user" /> Profile
                            </button>

                            <button
                              onClick={() => setDeleteTarget(s)}
                              title="Cancel Provisional Application"
                              style={{
                                background: '#fee2e2',
                                color: '#dc2626',
                                border: '1px solid #fecaca',
                                borderRadius: 6,
                                padding: '6px 8px',
                                fontSize: 12,
                                cursor: 'pointer'
                              }}
                            >
                              <i className="ti ti-trash" />
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
        </main>
      </div>

      {/* Collect Fee & Confirm Modal */}
      {confirmTarget && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(3px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: 16,
            width: '100%',
            maxWidth: 480,
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
            overflow: 'hidden',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{
              background: 'linear-gradient(135deg, #0f766e 0%, #0d9488 100%)',
              color: '#ffffff',
              padding: '18px 24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Collect Fee & Confirm Admission</h3>
                <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>Issues permanent admission number</div>
              </div>
              <button
                onClick={() => setConfirmTarget(null)}
                style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer' }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleConfirmAdmission} style={{ padding: 24 }}>
              <div style={{ background: '#f8fafc', padding: 14, borderRadius: 10, border: '1px solid #e2e8f0', marginBottom: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>{confirmTarget.name}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>Father: {confirmTarget.father_name || '—'}</div>
                  </div>
                  <span style={{ background: '#fef3c7', color: '#92400e', fontWeight: 700, padding: '3px 8px', borderRadius: 6, fontSize: 11, fontFamily: 'monospace' }}>
                    {confirmTarget.provisional_no || confirmTarget.admission_no}
                  </span>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                  Collection Amount (₹) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  step="any"
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    fontSize: 15,
                    fontWeight: 700,
                    color: '#0f766e',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                    Payment Mode
                  </label>
                  <select
                    value={payMode}
                    onChange={e => setPayMode(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, background: '#fff' }}
                  >
                    <option value="CASH">Cash</option>
                    <option value="UPI">UPI / QR</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                    Ref / Transaction ID
                  </label>
                  <input
                    type="text"
                    placeholder="Optional (e.g. UPI-123)"
                    value={payRef}
                    onChange={e => setPayRef(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                  Receipt Remarks
                </label>
                <input
                  type="text"
                  value={payRemarks}
                  onChange={e => setPayRemarks(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 8, padding: 10, fontSize: 12, color: '#065f46', marginBottom: 20 }}>
                ℹ️ <strong>Auto-Confirm Action:</strong> On collection, the student's status immediately updates to <strong>ACTIVE</strong> and a permanent <strong>ADM-</strong> number is automatically generated and issued.
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setConfirmTarget(null)}
                  style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#475569', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processingPay}
                  style={{
                    padding: '9px 20px',
                    borderRadius: 8,
                    border: 'none',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: '#ffffff',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: processingPay ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 6px rgba(5, 150, 105, 0.3)'
                  }}
                >
                  {processingPay ? 'Confirming...' : 'Collect & Confirm Admission'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete / Cancel Application Confirmation Modal */}
      {deleteTarget && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(3px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16
        }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 420, padding: 24, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 44 }}>⚠️</span>
              <h3 style={{ margin: '10px 0 6px', fontSize: 17, color: '#0f172a' }}>Cancel Provisional Application?</h3>
              <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
                Are you sure you want to cancel the provisional admission for <strong>{deleteTarget.name}</strong> ({deleteTarget.provisional_no || deleteTarget.admission_no})?
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
              <button
                onClick={() => setDeleteTarget(null)}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#475569', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                No, Keep
              </button>
              <button
                onClick={handleDeleteProvisional}
                disabled={deleting}
                style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#ef4444', color: '#fff', fontSize: 13, fontWeight: 700, cursor: deleting ? 'not-allowed' : 'pointer' }}
              >
                {deleting ? 'Cancelling...' : 'Yes, Cancel Application'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
