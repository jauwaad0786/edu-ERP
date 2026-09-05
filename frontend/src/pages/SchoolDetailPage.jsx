// frontend/src/pages/SuperAdmin/SchoolDetail.jsx  ← REPLACE existing file

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Navbar  from '../components/Navbar';
import api     from '../api/axios';

export default function SchoolDetail() {
  const { id }     = useParams();
  const navigate   = useNavigate();

  const [school,   setSchool]   = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState('overview');

  // Edit modal
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving,   setSaving]   = useState(false);

  // Service charge modal
  // Service charge modal
  const [showCharge, setShowCharge] = useState(false);
  const [chargeForm, setChargeForm] = useState({ amount: '', label: 'Monthly Service Charge', charge_date: '', note: '', is_paid: false });
  const [savingCharge, setSavingCharge] = useState(false);

  // Staff / Principal tab — the missing link: school create karne ke baad
  // usi school ke Principal/staff ko yahin se assign karo, alag "Users"
  // page pe jaake school dhoondhne ki zaroorat nahi. Roles /rbac/roles se
  // aate hain (dynamic, RoleManagement.jsx jo bhi banaye wahi yahan dikhega).
  const [staffUsers,      setStaffUsers]      = useState([]);
  const [tenantRoles,     setTenantRoles]     = useState([]);
  const [showCreateStaff, setShowCreateStaff] = useState(false);
  const [staffForm,       setStaffForm]       = useState({});
  const [savingStaff,     setSavingStaff]     = useState(false);
  const [staffCreds,      setStaffCreds]      = useState(null);

  const [msg, setMsg] = useState('');

  // ── School Lifecycle states ──
  const [showArchive,    setShowArchive]    = useState(false);
  const [archiveReason,  setArchiveReason]  = useState('');
  const [archiveConfirm, setArchiveConfirm] = useState('');
  const [archiveSummary, setArchiveSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [actionLoading,  setActionLoading]  = useState(false);

  const [showRecover,    setShowRecover]    = useState(false);

  const [showPermanent,    setShowPermanent]    = useState(false);
  const [permConfirmInput, setPermConfirmInput] = useState('');
  const [permForce,        setPermForce]        = useState(false);

  const load = () => {
    setLoading(true);
    api.get(`/admin/schools/${id}`)
      .then(r => { setSchool(r.data); setEditForm(r.data); })
      .catch(() => navigate('/schools'))
      .finally(() => setLoading(false));
  };

  const loadStaff = () => {
    api.get('/admin/users', { params: { school_id: id, per_page: 200 } })
      .then(r => setStaffUsers(r.data.users || []))
      .catch(() => {});
  };

  useEffect(() => {
    load();
    loadStaff();
    api.get('/rbac/roles', { params: { scope: 'TENANT' } })
      .then(r => setTenantRoles(r.data || []))
      .catch(() => {});
  }, [id]);

  // ── Lifecycle Handlers ──
  const openArchiveDialog = async () => {
    if (!school) return;
    setArchiveReason('');
    setArchiveConfirm('');
    setArchiveSummary(null);
    setShowArchive(true);
    setLoadingSummary(true);
    try {
      const res = await api.get(`/admin/schools/${id}/archive-summary`);
      setArchiveSummary(res.data);
    } catch {}
    finally { setLoadingSummary(false); }
  };

  const handleArchive = async (e) => {
    e.preventDefault();
    if (!school) return;
    if (archiveConfirm.trim() !== school.name.trim()) {
      setMsg(`❌ Please type "${school.name}" exactly to confirm archiving.`);
      return;
    }
    setActionLoading(true);
    try {
      await api.post(`/admin/schools/${id}/archive`, { reason: archiveReason });
      setMsg(`✅ School "${school.name}" successfully archived.`);
      setShowArchive(false);
      load();
    } catch (err) {
      setMsg(`❌ ${err.response?.data?.error || 'Failed to archive school.'}`);
    } finally {
      setActionLoading(false);
    }
  };

  const openRecoverDialog = () => {
    setShowRecover(true);
  };

  const handleRecover = async () => {
    if (!school) return;
    setActionLoading(true);
    try {
      await api.post(`/admin/schools/${id}/recover`);
      setMsg(`✅ School "${school.name}" successfully recovered to ACTIVE.`);
      setShowRecover(false);
      load();
    } catch (err) {
      setMsg(`❌ ${err.response?.data?.error || 'Failed to recover school.'}`);
    } finally {
      setActionLoading(false);
    }
  };

  const openPermanentDialog = async () => {
    if (!school) return;
    setPermConfirmInput('');
    setPermForce(school.is_permanent_delete_eligible ? false : true);
    setArchiveSummary(null);
    setShowPermanent(true);
    setLoadingSummary(true);
    try {
      const res = await api.get(`/admin/schools/${id}/archive-summary`);
      setArchiveSummary(res.data);
    } catch {}
    finally { setLoadingSummary(false); }
  };

  const handlePermanentDelete = async (e) => {
    e.preventDefault();
    if (!school) return;
    const requiredPhrase = `DELETE ${school.name}`;
    if (permConfirmInput.trim() !== requiredPhrase) {
      setMsg(`❌ You must type "${requiredPhrase}" exactly to confirm permanent deletion.`);
      return;
    }
    setActionLoading(true);
    try {
      await api.delete(`/admin/schools/${id}/permanent`, {
        data: {
          confirm_name: permConfirmInput.trim(),
          force: permForce,
        }
      });
      setShowPermanent(false);
      navigate('/schools');
    } catch (err) {
      setMsg(`❌ ${err.response?.data?.error || 'Failed to permanently delete school.'}`);
    } finally {
      setActionLoading(false);
    }
  };

  // ── Toggle activate/deactivate
  const toggleSchool = async () => {
    await api.put(`/admin/schools/${id}/toggle`);
    load();
  };

  // ── Save edit
  const saveEdit = async e => {
    e.preventDefault(); setSaving(true); setMsg('');
    try {
      await api.put(`/admin/schools/${id}`, editForm);
      setMsg('✅ Saved!'); setShowEdit(false); load();
    } catch { setMsg('❌ Error saving'); }
    setSaving(false);
  };

  // ── Add service charge
  const addCharge = async e => {
    e.preventDefault(); setSavingCharge(true);
    try {
      await api.post(`/admin/schools/${id}/service-charges`, chargeForm);
      setShowCharge(false);
      setChargeForm({ amount: '', label: 'Monthly Service Charge', charge_date: '', note: '', is_paid: false });
      load();
    } catch {}
    setSavingCharge(false);
  };

  // ── Toggle charge paid
  // ── Toggle charge paid
  const toggleChargePaid = async chargeId => {
    await api.put(`/admin/service-charges/${chargeId}/toggle-paid`);
    load();
  };

  // ── Create staff/Principal for THIS school — school_id fixed to the
  // school being viewed, so there's no separate "pick a school" step.
  const createStaff = async e => {
    e.preventDefault(); setSavingStaff(true); setMsg('');
    try {
      const r = await api.post('/admin/users', { ...staffForm, school_id: id });
      setShowCreateStaff(false);
      setStaffCreds({
        name: r.data.name, username: r.data.username, email: r.data.email,
        password: r.data.plain_password_temp || staffForm.password || 'EduErp@123',
        role: tenantRoles.find(rl => rl.key === staffForm.role)?.name || staffForm.role,
      });
      setStaffForm({}); loadStaff();
    } catch (err) {
      setMsg('❌ ' + (err.response?.data?.error || 'Error creating staff'));
    }
    setSavingStaff(false);
  };

  const fmt  = n => Number(n || 0).toLocaleString('en-IN');
  const fmtL = n => `₹${(Number(n || 0) / 100000).toFixed(1)}L`;

  if (loading) return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar title="School Detail" />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
          <div style={{ textAlign: 'center', color: '#64748b' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
            <div>Loading school data...</div>
          </div>
        </div>
      </div>
    </div>
  );

  const charges        = school?.service_charges || [];
  const thisMonthPaid  = school?.paid_this_month;
  const collectionPct  = school?.fees_collected && (school.fees_collected + school.fees_pending) > 0
    ? Math.round(school.fees_collected / (school.fees_collected + school.fees_pending) * 100)
    : 0;

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar title={school?.name || 'School Detail'} />
        <div className="page-body">

          {msg && (
            <div className={`alert ${msg.startsWith('✅') ? 'alert-success' : 'alert-error'}`}
              style={{ marginBottom: 16 }}>
              {msg}
            </div>
          )}

          {/* ── Hero Header ── */}
          <div style={{
            background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 60%, #0176d3 100%)',
            borderRadius: 16, padding: '28px 32px', marginBottom: 24,
            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
            boxShadow: '0 4px 24px rgba(1,118,211,0.18)',
          }}>
            <div>
              {/* Back button */}
              <button onClick={() => navigate('/dashboard')} style={{
                background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
                color: '#fff', borderRadius: 6, padding: '4px 12px', fontSize: 12,
                cursor: 'pointer', marginBottom: 14,
              }}>← Back</button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 12,
                  background: 'rgba(255,255,255,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 24, border: '2px solid rgba(255,255,255,0.2)',
                }}>🏫</div>
                <div>
                  <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 800, margin: 0 }}>
                    {school?.name}
                  </h1>
                  <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, margin: '4px 0 0' }}>
                    Code: <strong style={{ color: '#7dd3fc' }}>{school?.code}</strong>
                    &nbsp;·&nbsp; {school?.city}, {school?.state}
                    &nbsp;·&nbsp; Session: {school?.current_session}
                    &nbsp;·&nbsp; {school?.type}
                  </p>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
              {school?.status === 'ARCHIVED' ? (
                <>
                  <div style={{
                    background: 'rgba(217,119,6,0.2)', border: '1px solid #f59e0b',
                    borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 700,
                    color: '#fef3c7',
                  }}>
                    📦 ARCHIVED ({school?.days_remaining_to_permanent_delete ?? 365}d left)
                  </div>
                  <button onClick={openRecoverDialog} style={{
                    background: '#059669', border: '1px solid #10b981',
                    color: '#fff', borderRadius: 8, padding: '8px 16px', fontSize: 13,
                    fontWeight: 700, cursor: 'pointer',
                  }}>♻️ Recover School</button>
                  <button onClick={openPermanentDialog} style={{
                    background: '#dc2626', border: '1px solid #ef4444',
                    color: '#fff', borderRadius: 8, padding: '8px 16px', fontSize: 13,
                    fontWeight: 700, cursor: 'pointer',
                  }}>🗑️ Permanent Delete</button>
                </>
              ) : (
                <>
                  {/* Service charge this month badge */}
                  <div style={{
                    background: thisMonthPaid ? 'rgba(46,196,74,0.15)' : 'rgba(239,68,68,0.15)',
                    border: `1px solid ${thisMonthPaid ? '#22c55e' : '#ef4444'}`,
                    borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600,
                    color: thisMonthPaid ? '#4ade80' : '#f87171',
                  }}>
                    {thisMonthPaid ? '✅ Service Paid' : '⚠️ Service Due'}
                  </div>

                  <button onClick={() => setShowCharge(true)} style={{
                    background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)',
                    color: '#fff', borderRadius: 8, padding: '8px 16px', fontSize: 13,
                    fontWeight: 600, cursor: 'pointer',
                  }}>+ Service Charge</button>

                  <button onClick={() => { setEditForm(school); setShowEdit(true); }} style={{
                    background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)',
                    color: '#fff', borderRadius: 8, padding: '8px 16px', fontSize: 13,
                    fontWeight: 600, cursor: 'pointer',
                  }}>✏️ Edit</button>

                  <button onClick={toggleSchool} style={{
                    background: school?.is_active ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)',
                    border: `1px solid ${school?.is_active ? '#ef4444' : '#22c55e'}`,
                    color: school?.is_active ? '#f87171' : '#4ade80',
                    borderRadius: 8, padding: '8px 16px', fontSize: 13,
                    fontWeight: 700, cursor: 'pointer',
                  }}>
                    {school?.is_active ? '🔴 Deactivate' : '🟢 Activate'}
                  </button>

                  <button onClick={openArchiveDialog} style={{
                    background: '#d97706', border: '1px solid #f59e0b',
                    color: '#fff', borderRadius: 8, padding: '8px 16px', fontSize: 13,
                    fontWeight: 700, cursor: 'pointer',
                  }}>
                    📦 Archive
                  </button>
                </>
              )}
            </div>
          </div>

          {/* ── Archived Warning Banner ── */}
          {school?.status === 'ARCHIVED' && (
            <div style={{
              background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12,
              padding: '16px 20px', marginBottom: 24, display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ fontSize: 28 }}>📦</span>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#92400e' }}>
                    This school is currently ARCHIVED (Inactive)
                  </div>
                  <div style={{ fontSize: 13, color: '#78350f', marginTop: 2 }}>
                    Archived on {school.archived_at ? new Date(school.archived_at).toLocaleDateString() : '—'}
                    {school.archive_reason ? ` • Reason: ${school.archive_reason}` : ''}
                    {school.days_remaining_to_permanent_delete !== undefined && ` • ${school.days_remaining_to_permanent_delete} days remaining in 1-year retention window`}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-sm btn-success" onClick={openRecoverDialog} style={{ fontWeight: 700 }}>
                  ♻️ Recover School
                </button>
                <button className="btn btn-sm btn-error" onClick={openPermanentDialog} style={{ fontWeight: 700 }}>
                  🗑️ Permanent Delete
                </button>
              </div>
            </div>
          )}

          {/* ── Stat Cards ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 24 }}>
            {[
              { icon: '🎒', label: 'Total Students',  value: fmt(school?.total_students),  color: '#0176d3', bg: '#e0f0ff' },
              { icon: '👩‍🏫', label: 'Total Teachers', value: fmt(school?.total_teachers),  color: '#7c3aed', bg: '#f3e8ff' },
              { icon: '🏛',  label: 'Total Classes',  value: fmt(school?.total_classes),   color: '#0891b2', bg: '#e0f9ff' },
              { icon: '✅',  label: 'Fees Collected', value: fmtL(school?.fees_collected), color: '#059669', bg: '#d1fae5' },
              { icon: '⏳',  label: 'Fees Pending',   value: fmtL(school?.fees_pending),   color: '#dc2626', bg: '#fee2e2' },
            ].map(s => (
              <div key={s.label} style={{
                background: '#fff', borderRadius: 12, padding: '20px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
                borderTop: `3px solid ${s.color}`,
              }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 8, background: s.bg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, marginBottom: 12,
                }}>{s.icon}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a' }}>{s.value}</div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 3, fontWeight: 500 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* ── Fee Collection Progress Bar ── */}
          <div style={{
            background: '#fff', borderRadius: 12, padding: '18px 24px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginBottom: 24,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>
                💰 Fee Collection Progress
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: collectionPct >= 80 ? '#059669' : '#f59e0b' }}>
                {collectionPct}%
              </span>
            </div>
            <div style={{ height: 10, background: '#f1f5f9', borderRadius: 99 }}>
              <div style={{
                height: '100%', borderRadius: 99,
                width: `${collectionPct}%`,
                background: collectionPct >= 80
                  ? 'linear-gradient(90deg,#059669,#34d399)'
                  : 'linear-gradient(90deg,#f59e0b,#fbbf24)',
                transition: 'width 0.6s ease',
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 12, color: '#64748b' }}>
              <span>Collected: <strong style={{ color: '#059669' }}>{fmtL(school?.fees_collected)}</strong></span>
              <span>Pending: <strong style={{ color: '#dc2626' }}>{fmtL(school?.fees_pending)}</strong></span>
            </div>
          </div>

          {/* ── Tabs ── */}
          <div style={{ display: 'flex', borderBottom: '2px solid #e2e8f0', marginBottom: 20 }}>
            {[
              ['overview',  '📋 Overview'],
              ['staff',     '👤 Staff & Principal'],
              ['charges',   '💳 Service Charges'],
              ['info',      'ℹ️ Info'],
            ].map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '10px 20px', fontSize: 13, fontWeight: 600,
                color: tab === k ? '#0176d3' : '#64748b',
                borderBottom: tab === k ? '2px solid #0176d3' : '2px solid transparent',
                marginBottom: -2,
              }}>{l}</button>
            ))}
          </div>

          {/* ── Tab: Overview ── */}
          {tab === 'overview' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

              {/* Quick Info */}
              <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
                <h4 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                  🏫 School Info
                </h4>
                {[
                  ['School Code',  school?.code],
                  ['Type',         school?.type],
                  ['City',         school?.city || '—'],
                  ['State',        school?.state || '—'],
                  ['Session',      school?.current_session],
                  ['Phone',        school?.phone || '—'],
                  ['Email',        school?.email || '—'],
                  ['Status',       school?.is_active ? '🟢 Active' : '🔴 Inactive'],
                ].map(([k, v]) => (
                  <div key={k} style={{
                    display: 'flex', justifyContent: 'space-between',
                    padding: '9px 0', borderBottom: '1px solid #f1f5f9',
                    fontSize: 13,
                  }}>
                    <span style={{ color: '#64748b' }}>{k}</span>
                    <strong style={{ color: '#0f172a' }}>{v}</strong>
                  </div>
                ))}
              </div>

              {/* Recent Service Charges Summary */}
              <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                    💳 Recent Service Charges
                  </h4>
                  <button onClick={() => setTab('charges')} style={{
                    fontSize: 11, color: '#0176d3', background: 'none',
                    border: 'none', cursor: 'pointer', fontWeight: 600,
                  }}>View All →</button>
                </div>
                {charges.slice(0, 5).length === 0 ? (
                  <div style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', paddingTop: 20 }}>
                    No service charges yet
                  </div>
                ) : charges.slice(0, 5).map(c => (
                  <div key={c.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '9px 0', borderBottom: '1px solid #f1f5f9', fontSize: 13,
                  }}>
                    <div>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{c.label}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{c.charge_date}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <strong style={{ color: '#0f172a' }}>₹{fmt(c.amount)}</strong>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                        background: c.is_paid ? '#dcfce7' : '#fee2e2',
                        color: c.is_paid ? '#16a34a' : '#dc2626',
                      }}>
                        {c.is_paid ? 'Paid' : 'Due'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Tab: Staff & Principal ── */}
          {tab === 'staff' && (
            <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
              <div style={{ padding: '16px 24px', borderBottom: '1px solid #f1f5f9',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>School Staff</h4>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b' }}>
                    Assign this school's Principal, teachers, and other staff directly.
                  </p>
                </div>
                <button onClick={() => { setStaffForm({}); setShowCreateStaff(true); }}
                  className="btn btn-primary btn-sm">
                  + Create Staff
                </button>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['Name', 'Role', 'Email', 'Status'].map(h => (
                      <th key={h} style={{ padding: '11px 16px', textAlign: 'left',
                        fontSize: 11, fontWeight: 700, color: '#64748b',
                        textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {staffUsers.length === 0 ? (
                    <tr><td colSpan={4} style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>
                      No staff assigned yet — create this school's Principal to get started.
                    </td></tr>
                  ) : staffUsers.map((u, i) => (
                    <tr key={u.id} style={{ borderTop: '1px solid #f1f5f9',
                      background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <td style={{ padding: '13px 16px', fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{u.name}</td>
                      <td style={{ padding: '13px 16px', fontSize: 13, color: '#475569' }}>
                        {tenantRoles.find(r => r.key === u.role)?.name || u.role}
                      </td>
                      <td style={{ padding: '13px 16px', fontSize: 13, color: '#475569' }}>{u.email}</td>
                      <td style={{ padding: '13px 16px' }}>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                          background: u.is_active ? '#dcfce7' : '#fee2e2',
                          color: u.is_active ? '#16a34a' : '#dc2626',
                        }}>
                          {u.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Tab: Service Charges ── */}
          {tab === 'charges' && (
          
            <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
              <div style={{ padding: '16px 24px', borderBottom: '1px solid #f1f5f9',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>All Service Charges</h4>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b' }}>
                    Total: ₹{fmt(charges.reduce((a, c) => a + c.amount, 0))} &nbsp;|&nbsp;
                    Paid: ₹{fmt(charges.filter(c => c.is_paid).reduce((a, c) => a + c.amount, 0))} &nbsp;|&nbsp;
                    Due: ₹{fmt(charges.filter(c => !c.is_paid).reduce((a, c) => a + c.amount, 0))}
                  </p>
                </div>
                <button onClick={() => setShowCharge(true)} className="btn btn-primary btn-sm">
                  + Add Charge
                </button>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['Date', 'Label', 'Amount', 'Note', 'Status', 'Action'].map(h => (
                      <th key={h} style={{ padding: '11px 16px', textAlign: 'left',
                        fontSize: 11, fontWeight: 700, color: '#64748b',
                        textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {charges.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>
                      No charges added yet
                    </td></tr>
                  ) : charges.map((c, i) => (
                    <tr key={c.id} style={{ borderTop: '1px solid #f1f5f9',
                      background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <td style={{ padding: '13px 16px', fontSize: 13, color: '#475569' }}>{c.charge_date}</td>
                      <td style={{ padding: '13px 16px', fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{c.label}</td>
                      <td style={{ padding: '13px 16px', fontSize: 13, fontWeight: 700, color: '#0f172a' }}>₹{fmt(c.amount)}</td>
                      <td style={{ padding: '13px 16px', fontSize: 12, color: '#64748b' }}>{c.note || '—'}</td>
                      <td style={{ padding: '13px 16px' }}>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                          background: c.is_paid ? '#dcfce7' : '#fee2e2',
                          color: c.is_paid ? '#16a34a' : '#dc2626',
                        }}>
                          {c.is_paid ? '✅ Paid' : '⏳ Due'}
                        </span>
                      </td>
                      <td style={{ padding: '13px 16px' }}>
                        <button onClick={() => toggleChargePaid(c.id)} style={{
                          fontSize: 11, padding: '5px 12px', borderRadius: 6,
                          border: '1px solid #e2e8f0', background: '#fff',
                          cursor: 'pointer', fontWeight: 600,
                          color: c.is_paid ? '#dc2626' : '#059669',
                        }}>
                          {c.is_paid ? 'Mark Due' : 'Mark Paid'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Tab: Info ── */}
          {tab === 'info' && (
            <div style={{ background: '#fff', borderRadius: 12, padding: 28, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', maxWidth: 600 }}>
              <h4 style={{ margin: '0 0 20px', fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
                📋 Complete School Information
              </h4>
              {[
                ['School Name',   school?.name],
                ['Code',          school?.code],
                ['Type',          school?.type],
                ['Address',       school?.address || '—'],
                ['City',          school?.city || '—'],
                ['State',         school?.state || '—'],
                ['Phone',         school?.phone || '—'],
                ['Email',         school?.email || '—'],
                ['Session',       school?.current_session],
                ['Status',        school?.is_active ? '🟢 Active' : '🔴 Inactive'],
                ['Total Students',fmt(school?.total_students)],
                ['Total Teachers',fmt(school?.total_teachers)],
                ['Total Classes', fmt(school?.total_classes)],
              ].map(([k, v]) => (
                <div key={k} style={{
                  display: 'flex', justifyContent: 'space-between',
                  padding: '11px 0', borderBottom: '1px solid #f1f5f9', fontSize: 13,
                }}>
                  <span style={{ color: '#64748b', fontWeight: 500 }}>{k}</span>
                  <strong style={{ color: '#0f172a' }}>{v}</strong>
                </div>
              ))}
              <button onClick={() => { setEditForm(school); setShowEdit(true); }}
                className="btn btn-primary btn-sm" style={{ marginTop: 20 }}>
                ✏️ Edit School Info
              </button>
            </div>
          )}

        </div>
      </div>

      {/* ── Edit Modal ── */}
      {showEdit && (
        <div className="modal-backdrop"
          onClick={e => e.target === e.currentTarget && setShowEdit(false)}>
          <div className="modal">
            <div className="modal-header">
              <h3>✏️ Edit School</h3>
              <button className="modal-close" onClick={() => setShowEdit(false)}>✕</button>
            </div>
            <form onSubmit={saveEdit}>
              <div className="modal-body">
                <div className="grid-2">
                  {[
                    ['name',            'School Name *', 'text',  true],
                    ['city',            'City',          'text',  false],
                    ['state',           'State',         'text',  false],
                    ['phone',           'Phone',         'text',  false],
                    ['email',           'Email',         'email', false],
                    ['current_session', 'Session',       'text',  false],
                  ].map(([field, label, type, req]) => (
                    <div className="form-group" key={field}>
                      <label className="form-label">{label}</label>
                      <input className="form-input" type={type} required={req}
                        value={editForm[field] || ''}
                        onChange={e => setEditForm(f => ({ ...f, [field]: e.target.value }))} />
                    </div>
                  ))}
                </div>
                <div className="form-group">
                  <label className="form-label">Address</label>
                  <input className="form-input"
                    value={editForm.address || ''}
                    onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-neutral" onClick={() => setShowEdit(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : '💾 Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Service Charge Modal ── */}
      {showCharge && (
        <div className="modal-backdrop"
          onClick={e => e.target === e.currentTarget && setShowCharge(false)}>
          <div className="modal" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h3>💳 Add Service Charge</h3>
              <button className="modal-close" onClick={() => setShowCharge(false)}>✕</button>
            </div>
            <form onSubmit={addCharge}>
              <div className="modal-body">
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Amount (₹) *</label>
                    <input className="form-input" type="number" required placeholder="5000"
                      value={chargeForm.amount}
                      onChange={e => setChargeForm(f => ({ ...f, amount: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Date *</label>
                    <input className="form-input" type="date" required
                      value={chargeForm.charge_date}
                      onChange={e => setChargeForm(f => ({ ...f, charge_date: e.target.value }))} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Label</label>
                  <input className="form-input"
                    value={chargeForm.label}
                    onChange={e => setChargeForm(f => ({ ...f, label: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Note</label>
                  <input className="form-input" placeholder="Optional note..."
                    value={chargeForm.note}
                    onChange={e => setChargeForm(f => ({ ...f, note: e.target.value }))} />
                </div>
                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input type="checkbox" id="is_paid"
                    checked={chargeForm.is_paid}
                    onChange={e => setChargeForm(f => ({ ...f, is_paid: e.target.checked }))} />
                  <label htmlFor="is_paid" style={{ fontSize: 13, color: '#475569', cursor: 'pointer' }}>
                    Already Paid?
                  </label>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-neutral" onClick={() => setShowCharge(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={savingCharge}>
                  {savingCharge ? 'Adding...' : '💳 Add Charge'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ── Create Staff Modal ── */}
      {showCreateStaff && (
        <div className="modal-backdrop"
          onClick={e => e.target === e.currentTarget && setShowCreateStaff(false)}>
          <div className="modal">
            <div className="modal-header">
              <h3>👤 Create Staff for {school?.name}</h3>
              <button className="modal-close" onClick={() => setShowCreateStaff(false)}>✕</button>
            </div>
            <form onSubmit={createStaff}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input className="form-input" required value={staffForm.name || ''}
                    onChange={e => setStaffForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Email *</label>
                  <input className="form-input" type="email" required value={staffForm.email || ''}
                    onChange={e => setStaffForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Role *</label>
                  <select className="form-select" required value={staffForm.role || ''}
                    onChange={e => setStaffForm(f => ({ ...f, role: e.target.value }))}>
                    <option value="">Select role</option>
                    {tenantRoles.map(r => (
                      <option key={r.key} value={r.key}>{r.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <input className="form-input" type="password"
                    placeholder="Leave blank for default: EduErp@123"
                    onChange={e => setStaffForm(f => ({ ...f, password: e.target.value }))} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-neutral"
                  onClick={() => setShowCreateStaff(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={savingStaff}>
                  {savingStaff ? 'Creating...' : '👤 Create Staff'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Staff Credentials Modal ── */}
      {staffCreds && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h3>✅ Staff Created!</h3>
              <button className="modal-close" onClick={() => setStaffCreds(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{
                background: '#f0fdf4', border: '1px solid #bbf7d0',
                borderRadius: 10, padding: '16px 20px', marginBottom: 16,
              }}>
                {[
                  ['👤 Name',     staffCreds.name],
                  ['🔖 Username', staffCreds.username],
                  ['📧 Email',    staffCreds.email],
                  ['🔑 Password', staffCreds.password],
                  ['🎭 Role',     staffCreds.role],
                ].map(([label, value]) => (
                  <div key={label} style={{
                    display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', fontSize: 13,
                    padding: '8px 0', borderBottom: '1px solid #dcfce7',
                  }}>
                    <span style={{ color: '#64748b' }}>{label}</span>
                    <strong style={{
                      color: '#0f172a',
                      fontFamily: label.includes('Password') ? 'monospace' : 'inherit',
                    }}>{value}</strong>
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => setStaffCreds(null)}>Done</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: ARCHIVE SCHOOL ── */}
      {showArchive && school && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowArchive(false)}>
          <div className="modal" style={{ maxWidth: 580 }}>
            <div className="modal-header" style={{ borderBottom: '1px solid #fed7aa', background: '#fffbeb' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 24 }}>📦</span>
                <div>
                  <h3 style={{ margin: 0, color: '#92400e' }}>Archive School Account</h3>
                  <div style={{ fontSize: 12, color: '#b45309' }}>1-Year Retention &amp; Recovery Protected</div>
                </div>
              </div>
              <button className="modal-close" onClick={() => setShowArchive(false)}>✕</button>
            </div>

            <form onSubmit={handleArchive}>
              <div className="modal-body" style={{ padding: 20 }}>
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: 14, marginBottom: 16 }}>
                  <div style={{ fontWeight: 700, color: '#92400e', marginBottom: 4, fontSize: 13 }}>
                    ⚠️ Archiving Impact:
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#78350f', lineHeight: 1.6 }}>
                    <li>All school logins (Principal, Teachers, Students, Staff) will be immediately suspended.</li>
                    <li>The school will be hidden from operational modules and normal queries.</li>
                    <li><strong>100% of records are preserved</strong> (academic marks, fees, receipts, attendance).</li>
                    <li>Can be <strong>restored anytime</strong> within the 1-year retention window.</li>
                  </ul>
                </div>

                {/* Summary counts */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 8 }}>
                    Records to be preserved in archive:
                  </div>
                  {loadingSummary ? (
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>Loading record breakdown...</div>
                  ) : archiveSummary ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                      {Object.entries(archiveSummary.counts || {}).slice(0, 9).map(([k, v]) => (
                        <div key={k} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 10px' }}>
                          <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>{k.replace(/_/g, ' ')}</div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{fmt(v)}</div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="form-group" style={{ marginBottom: 14 }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>Reason for Archiving (Optional)</label>
                  <input
                    className="form-input"
                    placeholder="e.g. Contract expired, School requested temporary freeze"
                    value={archiveReason}
                    onChange={e => setArchiveReason(e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 8 }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>
                    Type <span style={{ color: '#b45309', fontWeight: 800 }}>{school.name}</span> to confirm:
                  </label>
                  <input
                    className="form-input"
                    required
                    placeholder={`Type ${school.name}`}
                    value={archiveConfirm}
                    onChange={e => setArchiveConfirm(e.target.value)}
                    style={{ borderColor: archiveConfirm === school.name ? '#16a34a' : '#cbd5e1' }}
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
                <button type="button" className="btn btn-neutral" onClick={() => setShowArchive(false)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn"
                  disabled={actionLoading || archiveConfirm.trim() !== school.name.trim()}
                  style={{
                    background: '#d97706',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 700,
                    opacity: archiveConfirm.trim() !== school.name.trim() ? 0.5 : 1
                  }}
                >
                  {actionLoading ? 'Archiving...' : '📦 Confirm & Archive School'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: RECOVER SCHOOL ── */}
      {showRecover && school && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowRecover(false)}>
          <div className="modal" style={{ maxWidth: 520 }}>
            <div className="modal-header" style={{ background: '#ecfdf5', borderBottom: '1px solid #a7f3d0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 24 }}>♻️</span>
                <div>
                  <h3 style={{ margin: 0, color: '#065f46' }}>Recover School</h3>
                  <div style={{ fontSize: 12, color: '#047857' }}>Restore to Active ERP Operations</div>
                </div>
              </div>
              <button className="modal-close" onClick={() => setShowRecover(false)}>✕</button>
            </div>

            <div className="modal-body" style={{ padding: 20 }}>
              <p style={{ fontSize: 14, color: '#334155', lineHeight: 1.6, marginTop: 0 }}>
                Are you sure you want to recover <strong>{school.name}</strong> ({school.code})?
              </p>
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 14, fontSize: 12, color: '#166534', lineHeight: 1.5 }}>
                ✅ <strong>Restoration Effects:</strong>
                <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                  <li>School status will be restored to <strong>ACTIVE</strong>.</li>
                  <li>User accounts (Principal, Teachers, Students) will be re-activated.</li>
                  <li>Operational rosters, academic modules, and fee collection will resume normal function.</li>
                </ul>
              </div>
            </div>

            <div className="modal-footer" style={{ background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
              <button type="button" className="btn btn-neutral" onClick={() => setShowRecover(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-success"
                disabled={actionLoading}
                onClick={handleRecover}
              >
                {actionLoading ? 'Restoring...' : '♻️ Recover & Reactivate School'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: PERMANENT DELETE SCHOOL ── */}
      {showPermanent && school && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowPermanent(false)}>
          <div className="modal" style={{ maxWidth: 580, border: '2px solid #ef4444' }}>
            <div className="modal-header" style={{ background: '#fef2f2', borderBottom: '1px solid #fecaca' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 24 }}>🚨</span>
                <div>
                  <h3 style={{ margin: 0, color: '#991b1b' }}>Permanently Delete School</h3>
                  <div style={{ fontSize: 12, color: '#b91c1c' }}>DANGER: Irreversible Database Wipe</div>
                </div>
              </div>
              <button className="modal-close" onClick={() => setShowPermanent(false)}>✕</button>
            </div>

            <form onSubmit={handlePermanentDelete}>
              <div className="modal-body" style={{ padding: 20 }}>
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 14, marginBottom: 16 }}>
                  <div style={{ fontWeight: 800, color: '#991b1b', marginBottom: 4, fontSize: 13 }}>
                    ⚠️ IRREVERSIBLE ACTION — READ CAREFULLY
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: '#7f1d1d', lineHeight: 1.5 }}>
                    This will permanently and irreversibly wipe <strong>{school.name}</strong> and all affiliated student records, teacher profiles, examination results, fee bills, receipts, attendance logs, and uploaded files from the database.
                  </p>
                </div>

                {!school.is_permanent_delete_eligible && (school.days_remaining_to_permanent_delete > 0 || school.days_remaining_to_permanent_delete !== undefined) && (
                  <div style={{ background: '#fffbeb', border: '1px solid #fed7aa', borderRadius: 8, padding: 12, marginBottom: 16 }}>
                    <div style={{ fontSize: 12, color: '#92400e', fontWeight: 600, marginBottom: 6 }}>
                      ⏳ Retention Notice: {school.days_remaining_to_permanent_delete} days left in 1-year retention window.
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#78350f', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={permForce}
                        onChange={e => setPermForce(e.target.checked)}
                      />
                      <span>Override retention policy &amp; force early permanent deletion</span>
                    </label>
                  </div>
                )}

                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 8 }}>
                    Items to be permanently erased:
                  </div>
                  {loadingSummary ? (
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>Loading record breakdown...</div>
                  ) : archiveSummary ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                      {Object.entries(archiveSummary.counts || {}).slice(0, 9).map(([k, v]) => (
                        <div key={k} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 10px' }}>
                          <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>{k.replace(/_/g, ' ')}</div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: '#dc2626' }}>{fmt(v)}</div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="form-group" style={{ marginBottom: 8 }}>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: 13 }}>
                    To confirm, please type <code style={{ background: '#fee2e2', color: '#991b1b', padding: '2px 6px', borderRadius: 4, fontWeight: 800 }}>DELETE {school.name}</code>:
                  </label>
                  <input
                    className="form-input"
                    required
                    placeholder={`Type DELETE ${school.name}`}
                    value={permConfirmInput}
                    onChange={e => setPermConfirmInput(e.target.value)}
                    style={{ borderColor: permConfirmInput === `DELETE ${school.name}` ? '#dc2626' : '#cbd5e1' }}
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
                <button type="button" className="btn btn-neutral" onClick={() => setShowPermanent(false)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-error"
                  disabled={
                    actionLoading ||
                    permConfirmInput.trim() !== `DELETE ${school.name}` ||
                    (!school.is_permanent_delete_eligible && !permForce)
                  }
                  style={{ fontWeight: 800 }}
                >
                  {actionLoading ? 'Deleting...' : '🚨 Permanently Delete School'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
