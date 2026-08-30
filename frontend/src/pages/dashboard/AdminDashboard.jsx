// frontend/src/pages/SuperAdmin/AdminDashboard.jsx — FULL REPLACE

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api     from '../../api/axios';
import OneP360BotDrawer from '../../AI/components/OneP360BotDrawer';


const MONTHS  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const CUR_YR  = new Date().getFullYear();
const YEARS   = [CUR_YR, CUR_YR - 1, CUR_YR - 2];

export default function AdminDashboard() {
  const navigate = useNavigate();

  const [stats,        setStats]        = useState(null);
  const [schools,      setSchools]      = useState([]);
  const [users,        setUsers]        = useState([]);
  const [tab,          setTab]          = useState('schools');

  // Filters
  const [filterMonth, setFilterMonth]   = useState(new Date().getMonth());
  const [filterYear,  setFilterYear]    = useState(CUR_YR);

  // Modals
  // Modals
  // Modals
  const [showSchoolModal,       setShowSchoolModal]       = useState(false);
  // Two separate, purpose-built creation flows instead of one combined
  // "role + optional school" form — Company Staff never carries a
  // school_id, School Head always does. Mixing them in one dropdown was
  // the actual source of the confusion (and of 'Principal' showing up
  // next to 'Developer' earlier).
  const [showCompanyStaffModal, setShowCompanyStaffModal] = useState(false);
  const [showSchoolHeadModal,   setShowSchoolHeadModal]   = useState(false);
  const [companyRoles,          setCompanyRoles]          = useState([]);
  const [headRoles,             setHeadRoles]             = useState([]);
  const [showEditModal,     setShowEditModal]     = useState(false);
  const [editSchool,        setEditSchool]        = useState(null);
  const [showFeaturesModal, setShowFeaturesModal] = useState(false);
  const [featuresSchool,    setFeaturesSchool]    = useState(null);
  const [featureCatalog,    setFeatureCatalog]    = useState([]);
  const [planPresets,       setPlanPresets]       = useState({});
  const [selectedFeatures,  setSelectedFeatures]  = useState([]);
  const [selectedPlan,      setSelectedPlan]      = useState('BASIC');
  const [savingFeatures,    setSavingFeatures]    = useState(false);

  const [createdCreds, setCreatedCreds] = useState(null);
  const [copied,       setCopied]       = useState(false);
  const [form,   setForm]   = useState({});
  const [saving, setSaving] = useState(false);
  const [msg,    setMsg]    = useState('');

  // ── Load all data
  // ── Load all data
  // ── Load all data
  const load = () => {
    api.get('/admin/stats').then(r => setStats(r.data)).catch(() => {});
    api.get('/admin/schools').then(r => setSchools(r.data)).catch(() => {});
    // /admin/users returns a paginated object ({ users, total, page, ... }),
    // never a bare array — setUsers(r.data) was storing the whole object,
    // which crashed users.length/.map the moment this tab rendered.
    api.get('/admin/users').then(r => setUsers(r.data.users || [])).catch(() => {});
  };
  useEffect(() => {
    load();
    api.get('/admin/features/catalog').then(r => {
      setFeatureCatalog(r.data.catalog);
      setPlanPresets(r.data.presets);
    }).catch(() => {});
    // Company Staff dropdown: every COMPANY-scope role (CEO..Intern).
    api.get('/rbac/roles', { params: { scope: 'COMPANY' } })
      .then(r => setCompanyRoles(r.data || [])).catch(() => {});
    // School Head dropdown: only "head of school" roles (Director,
    // Principal — is_super=True in the seed data), not the full TENANT
    // list. Regular staff go through that school's own "Staff & Principal"
    // tab (SchoolDetailPage.jsx), where the school context is already fixed.
    api.get('/rbac/roles', { params: { scope: 'TENANT' } })
      .then(r => setHeadRoles((r.data || []).filter(role => role.is_super)))
      .catch(() => {});
  }, []);

  // ── Toggle school active/inactive
  const toggleSchool = async id => {
    await api.put(`/admin/schools/${id}/toggle`);
    load();
  };

  // ── Services / Features modal
  const openFeatures = s => {
    setFeaturesSchool(s);
    setSelectedFeatures(s.enabled_features || []);
    setSelectedPlan(s.plan || 'BASIC');
    setShowFeaturesModal(true);
  };

  const applyPreset = plan => {
    setSelectedPlan(plan);
    setSelectedFeatures(planPresets[plan] || []);
  };

  const toggleFeature = key => {
    setSelectedFeatures(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const saveFeatures = async () => {
    setSavingFeatures(true);
    try {
      await api.put(`/admin/schools/${featuresSchool.id}/features`, {
        features: selectedFeatures,
        plan: selectedPlan,
      });
      setShowFeaturesModal(false);
      load();
    } catch (err) {
      alert('❌ ' + (err.response?.data?.error || 'Error saving services'));
    }
    setSavingFeatures(false);
  };

  // ── Create school
  const createSchool = async e => {
    e.preventDefault(); setSaving(true); setMsg('');
    try {
      await api.post('/admin/schools', form);
      setMsg('✅ School created!');
      setShowSchoolModal(false); setForm({}); load();
    } catch (err) {
      setMsg('❌ ' + (err.response?.data?.error || 'Error'));
    }
    setSaving(false);
  };

  // ── Edit school
  const openEdit = s => { setEditSchool(s); setForm({ ...s }); setShowEditModal(true); };
  const saveEdit = async e => {
    e.preventDefault(); setSaving(true); setMsg('');
    try {
      await api.put(`/admin/schools/${editSchool.id}`, form);
      setMsg('✅ School updated!');
      setShowEditModal(false); setForm({}); load();
    } catch (err) {
      setMsg('❌ ' + (err.response?.data?.error || 'Error'));
    }
    setSaving(false);
  };

  

  // ── Create user
  // ── Create user — shared by both Company Staff and School Head forms
  // (same /admin/users endpoint); each form just populates `form`
  // differently (Company Staff never sets school_id).
  const createUser = async e => {
    e.preventDefault(); setSaving(true); setMsg('');
    try {
      const r = await api.post('/admin/users', form);
      setShowCompanyStaffModal(false);
      setShowSchoolHeadModal(false);
      const roleName = [...companyRoles, ...headRoles].find(rl => rl.key === form.role)?.name || form.role;
      setCreatedCreds({
        name:     r.data.name,
        username: r.data.username,
        email:    r.data.email,
        password: r.data.plain_password_temp || form.password || 'EduErp@123',
        role:     roleName,
        school:   schools.find(s => String(s.id) === String(form.school_id))?.name || '—',
      });
      setForm({}); load();
    } catch (err) {
      setMsg('❌ ' + (err.response?.data?.error || 'Error'));
    }
    setSaving(false);
  };

  // ── Toggle user
  const toggleUser = async id => {
    await api.put(`/admin/users/${id}/toggle`);
    load();
  };

  // ── Copy credentials
  const handleCopy = () => {
    if (!createdCreds) return;
    navigator.clipboard.writeText(
      `EduERP Login Credentials\n` +
      `Name:     ${createdCreds.name}\n` +
      `Email:    ${createdCreds.email}\n` +
      `Password: ${createdCreds.password}\n` +
      `Role:     ${createdCreds.role}\n` +
      `School:   ${createdCreds.school}\n` +
      `Login at: ${window.location.origin}/login`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fmt  = n => n?.toLocaleString('en-IN') ?? '—';
  const fmtL = n => `₹${(Number(n || 0) / 100000).toFixed(1)}L`;

  // ── Chart: total fees per school (mock bars from schools list)
  const chartMax = Math.max(...schools.map(s => s.total_students || 1), 1);

  return (
    <div className="app-shell">
      <Sidebar darkMode={false} />
      <div className="main-content">
        <Navbar title="Super Admin — Control Center" darkMode={false} onToggleDark={() => {}} />
        <div className="page-body">

          {/* ══ Super Admin Enterprise Hero Command Banner ══ */}
          <div style={{
            position: 'relative', overflow: 'hidden',
            borderRadius: '24px', padding: '28px 34px', marginBottom: '24px',
            background: 'radial-gradient(circle at 85% 20%, rgba(2,132,199,0.3) 0%, transparent 60%), linear-gradient(135deg, #030712 0%, #0f172a 45%, #0369a1 85%, #0284c7 100%)',
            color: '#ffffff',
            boxShadow: '0 15px 35px -5px rgba(2,132,199,0.35), inset 0 1px 0 rgba(255,255,255,0.2)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '24px',
            border: '1px solid rgba(255,255,255,0.2)'
          }}>
            {/* Background Ambient Glows */}
            <div style={{
              position: 'absolute', top: '-50px', right: '280px', width: '220px', height: '220px',
              borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none', filter: 'blur(30px)'
            }} />
            <div style={{
              position: 'absolute', bottom: '-40px', left: '15%', width: '180px', height: '180px',
              borderRadius: '50%', background: 'rgba(56,189,248,0.15)', pointerEvents: 'none', filter: 'blur(40px)'
            }} />

            <div style={{ flex: 1, minWidth: '300px', zIndex: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                <span style={{
                  padding: '4px 12px', borderRadius: '20px',
                  background: 'rgba(255,255,255,0.2)', fontSize: '11.5px', fontWeight: 800, textTransform: 'uppercase',
                  backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.25)',
                  display: 'flex', alignItems: 'center', gap: '6px', color: '#ffffff'
                }}>
                  🌐 Multi-School Network Governance
                </span>
                <span style={{
                  padding: '4px 12px', borderRadius: '20px',
                  background: 'rgba(255,255,255,0.12)', color: '#e0f2fe',
                  fontSize: '11.5px', fontWeight: 700, backdropFilter: 'blur(6px)'
                }}>
                  School ERP Super Admin Control
                </span>
              </div>

              <h1 style={{
                margin: '0 0 8px', fontSize: '32px', fontWeight: 900, letterSpacing: '-0.02em', color: '#ffffff',
                textShadow: '0 2px 10px rgba(0,0,0,0.2)'
              }}>
                School Operations Control Center 🏫
              </h1>

              <p style={{
                margin: '0 0 20px', fontSize: '14.5px', color: 'rgba(255,255,255,0.92)',
                maxWidth: '540px', lineHeight: 1.5, fontWeight: 500
              }}>
                Manage school branches, Principals, teacher staff credentials, academic board sessions, and student enrollments.
              </p>

              {/* Action Buttons & Filters */}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <select
                  value={filterMonth}
                  onChange={e => setFilterMonth(Number(e.target.value))}
                  style={{
                    padding: '9px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.3)',
                    fontSize: '13px', color: '#ffffff', cursor: 'pointer', background: 'rgba(255,255,255,0.18)',
                    backdropFilter: 'blur(8px)', outline: 'none', fontWeight: 700
                  }}>
                  {MONTHS.map((m, i) => <option key={m} value={i} style={{ color: '#0f172a' }}>{m}</option>)}
                </select>

                <select
                  value={filterYear}
                  onChange={e => setFilterYear(Number(e.target.value))}
                  style={{
                    padding: '9px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.3)',
                    fontSize: '13px', color: '#ffffff', cursor: 'pointer', background: 'rgba(255,255,255,0.18)',
                    backdropFilter: 'blur(8px)', outline: 'none', fontWeight: 700
                  }}>
                  {YEARS.map(y => <option key={y} value={y} style={{ color: '#0f172a' }}>{y}</option>)}
                </select>

                <button
                  onClick={() => { setForm({}); setShowCompanyStaffModal(true); }}
                  style={{
                    background: 'rgba(255,255,255,0.16)', color: '#ffffff', border: '1.5px solid rgba(255,255,255,0.35)',
                    borderRadius: '10px', padding: '10px 16px', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                    backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', gap: '6px'
                  }}
                >
                  🧑‍💼 Company Staff
                </button>
                <button
                  onClick={() => { setForm({}); setShowSchoolHeadModal(true); }}
                  style={{
                    background: 'rgba(255,255,255,0.16)', color: '#ffffff', border: '1.5px solid rgba(255,255,255,0.35)',
                    borderRadius: '10px', padding: '10px 16px', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                    backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', gap: '6px'
                  }}
                >
                  🏫 Assign School Head
                </button>
                <button
                  onClick={() => { setForm({}); setShowSchoolModal(true); }}
                  style={{
                    background: '#ffffff', color: '#0369a1', border: 'none', borderRadius: '10px',
                    padding: '10px 18px', fontSize: '13px', fontWeight: 900, cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', gap: '6px'
                  }}
                >
                  + Add School
                </button>
              </div>
            </div>

            {/* Framed 3D Isometric Admin HQ & Command Tower Card */}
            <div style={{
              width: '320px', height: '160px', borderRadius: '18px', overflow: 'hidden',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              background: 'rgba(255,255,255,0.12)',
              border: '1.5px solid rgba(255,255,255,0.25)',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
              padding: '6px',
              position: 'relative'
            }}>
              <img
                src="/assets/illustrations/admin_hero.jpg"
                alt="Admin Headquarters"
                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '14px' }}
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
              <div style={{
                position: 'absolute', bottom: '12px', right: '14px',
                background: 'rgba(3,7,18,0.85)', color: '#ffffff',
                padding: '3px 8px', borderRadius: '6px', fontSize: '10.5px',
                fontWeight: 800, backdropFilter: 'blur(6px)', letterSpacing: '0.04em'
              }}>
                🌐 GLOBAL HQ
              </div>
            </div>
          </div>

          {msg && (
            <div className={`alert ${msg.startsWith('✅') ? 'alert-success' : 'alert-error'}`}
              style={{ marginBottom: 16 }}>
              {msg}
            </div>
          )}

          {/* ── Stat Cards ── */}
          <div className="grid-4 mb-6">
            {[
              { icon: '🏫', label: 'Active Schools',  value: fmt(stats?.total_schools),  color: '#0176d3' },
              { icon: '👥', label: 'Total Users',     value: fmt(stats?.total_users),    color: '#5867e8' },
              { icon: '🎒', label: 'Total Students',  value: fmt(stats?.total_students), color: '#2e844a' },
              { icon: '👩‍🏫', label: 'Total Teachers', value: fmt(stats?.total_teachers), color: '#dd7a01' },
            ].map(s => (
              <div className="stat-card" key={s.label}>
                <div className="stat-icon" style={{ background: s.color + '14' }}>
                  <span style={{ fontSize: 20 }}>{s.icon}</span>
                </div>
                <div className="stat-label">{s.label}</div>
                <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* ── Charts Row ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>

            {/* Chart 1: School-wise Students */}
            <div style={{ background: '#fff', borderRadius: 12, padding: 24,
              boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
              <h4 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                🎒 Students per School
              </h4>
              <p style={{ margin: '0 0 20px', fontSize: 12, color: '#94a3b8' }}>
                {MONTHS[filterMonth]} {filterYear}
              </p>
              {schools.length === 0 ? (
                <div style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
                  No schools yet
                </div>
              ) : schools.map(s => (
                <div key={s.id} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between',
                    fontSize: 12, marginBottom: 5 }}>
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>{s.name}</span>
                    <span style={{ color: '#64748b' }}>{fmt(s.total_students || 0)}</span>
                  </div>
                  <div style={{ height: 8, background: '#f1f5f9', borderRadius: 99 }}>
                    <div style={{
                      height: '100%', borderRadius: 99,
                      width: `${Math.round(((s.total_students || 0) / chartMax) * 100)}%`,
                      background: 'linear-gradient(90deg, #0176d3, #38bdf8)',
                      transition: 'width 0.5s ease',
                      minWidth: s.total_students ? 6 : 0,
                    }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Chart 2: Service Charge Collection */}
            <div style={{ background: '#fff', borderRadius: 12, padding: 24,
              boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
              <h4 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                💳 Service Charge Status
              </h4>
              <p style={{ margin: '0 0 20px', fontSize: 12, color: '#94a3b8' }}>
                {MONTHS[filterMonth]} {filterYear} — All Schools
              </p>

              {/* Summary */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
                {[
                  { label: 'Total Schools', value: schools.length,                                   color: '#0176d3', bg: '#e0f0ff' },
                  { label: 'Paid',          value: schools.filter(s => s.paid_this_month).length,    color: '#059669', bg: '#d1fae5' },
                  { label: 'Due',           value: schools.filter(s => !s.paid_this_month).length,   color: '#dc2626', bg: '#fee2e2' },
                ].map(c => (
                  <div key={c.label} style={{
                    background: c.bg, borderRadius: 10, padding: '14px 12px', textAlign: 'center',
                  }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: c.color }}>{c.value}</div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{c.label}</div>
                  </div>
                ))}
              </div>

              {/* Per school badge */}
              {schools.length === 0 ? (
                <div style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center' }}>No schools yet</div>
              ) : schools.map(s => (
                <div key={s.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 0', borderBottom: '1px solid #f1f5f9', fontSize: 13,
                }}>
                  <span style={{ fontWeight: 500, color: '#0f172a' }}>{s.name}</span>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                    background: s.paid_this_month ? '#dcfce7' : '#fee2e2',
                    color:      s.paid_this_month ? '#16a34a' : '#dc2626',
                  }}>
                    {s.paid_this_month ? '✅ Paid' : '⏳ Due'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Tabs ── */}
          <div style={{ display: 'flex', borderBottom: '2px solid var(--neutral-2)', marginBottom: 20 }}>
            {[['schools', '🏫 Schools'], ['users', '👥 Users']].map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '10px 20px', fontSize: 13, fontWeight: 600,
                color: tab === k ? 'var(--blue-60)' : 'var(--neutral-6)',
                borderBottom: tab === k ? '2px solid var(--blue-60)' : '2px solid transparent',
                marginBottom: -2,
              }}>{l}</button>
            ))}
          </div>

          {/* ── Schools Table ── */}
          {tab === 'schools' && (
            <div className="card">
              <div className="card-header">
                <h4>All Schools ({schools.length})</h4>
              </div>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Code</th><th>Name</th><th>Type</th>
                      <th>City</th><th>Session</th><th>Plan</th>
                      <th>Service</th>
                      <th>Status</th><th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schools.map(s => (
                      <tr key={s.id}>
                        <td><span className="badge badge-info">{s.code}</span></td>
                        <td>
                          <span
                            onClick={() => navigate(`/schools/${s.id}`)}
                            style={{
                              fontWeight: 600, color: 'var(--blue-60)',
                              cursor: 'pointer',
                              borderBottom: '1px dashed var(--blue-30)',
                            }}
                            onMouseEnter={e => e.target.style.color = 'var(--blue-80)'}
                            onMouseLeave={e => e.target.style.color = 'var(--blue-60)'}
                          >
                            {s.name}
                          </span>
                        </td>
                        <td><span className="badge badge-neutral">{s.type}</span></td>
                        <td style={{ color: 'var(--neutral-6)' }}>{s.city || '—'}</td>
                        <td>{s.current_session}</td>
                        <td>
                          <span className="badge" style={{
                            background:
                              s.plan === 'ENTERPRISE'   ? '#fef3c7' :
                              s.plan === 'PROFESSIONAL' ? '#dbeafe' : '#f1f5f9',
                            color:
                              s.plan === 'ENTERPRISE'   ? '#92400e' :
                              s.plan === 'PROFESSIONAL' ? '#1d4ed8' : '#475569',
                            fontWeight: 700, fontSize: 11,
                          }}>
                            {s.plan || 'BASIC'}
                          </span>
                        </td>
                        <td>
                          <span style={{
                            fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                            background: s.paid_this_month ? '#dcfce7' : '#fee2e2',
                            color:      s.paid_this_month ? '#16a34a' : '#dc2626',
                          }}>
                            {s.paid_this_month ? '✅ Paid' : '⏳ Due'}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${s.is_active ? 'badge-success' : 'badge-error'}`}>
                            {s.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <button
                              className="btn btn-neutral btn-sm"
                              onClick={() => navigate(`/schools/${s.id}`)}>
                              View
                            </button>
                            <button
                              className="btn btn-neutral btn-sm"
                              onClick={() => openEdit(s)}>
                              Edit
                            </button>
                            <button
                              className="btn btn-sm"
                              onClick={() => openFeatures(s)}
                              style={{
                                background: '#ede9fe', color: '#6d28d9',
                                border: 'none', cursor: 'pointer', borderRadius: 4,
                                padding: '4px 10px', fontSize: 11, fontWeight: 700,
                              }}>
                              ⚡ Services
                            </button>
                            <button
                              className="btn btn-sm"
                              onClick={() => toggleSchool(s.id)}
                              style={{
                                background: s.is_active ? '#fef1ee' : '#eaf5ea',
                                color:      s.is_active ? 'var(--error)' : 'var(--success)',
                                border: 'none', cursor: 'pointer', borderRadius: 4,
                                padding: '4px 10px', fontSize: 11, fontWeight: 700,
                              }}>
                              {s.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!schools.length && (
                      <tr>
                        <td colSpan={9} style={{ textAlign: 'center', color: 'var(--neutral-4)', padding: 32 }}>
                          No schools yet. Add one!
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Users Table ── */}
          {tab === 'users' && (
            <div className="card">
              <div className="card-header">
                <h4>All Users ({users.length})</h4>
              </div>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th><th>Email</th><th>Role</th>
                      <th>School</th><th>Status</th><th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div className="avatar avatar-sm" style={{
                              background: 'var(--blue-10)', color: 'var(--blue-80)',
                              width: 28, height: 28, fontSize: 11,
                            }}>
                              {u.name?.charAt(0).toUpperCase()}
                            </div>
                            <span style={{ fontWeight: 500 }}>{u.name}</span>
                          </div>
                        </td>
                        <td style={{ color: 'var(--neutral-6)', fontSize: 12 }}>{u.email}</td>
                        <td>
                          <span className={`badge ${
                            u.role === 'SUPER_ADMIN' ? 'badge-error'   :
                            u.role === 'PRINCIPAL'   ? 'badge-warning' :
                            u.role === 'TEACHER'     ? 'badge-info'    : 'badge-success'
                          }`}>{u.role}</span>
                        </td>
                        <td style={{ color: 'var(--neutral-6)', fontSize: 12 }}>
                          {schools.find(s => s.id === u.school_id)?.name || '—'}
                        </td>
                        <td>
                          <span className={`badge ${u.is_active ? 'badge-success' : 'badge-neutral'}`}>
                            {u.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td>
                          <button className="btn btn-sm" onClick={() => toggleUser(u.id)}
                            style={{
                              background: u.is_active ? '#fef1ee' : '#eaf5ea',
                              color: u.is_active ? 'var(--error)' : 'var(--success)',
                              border: 'none', cursor: 'pointer', borderRadius: 4,
                              padding: '4px 10px', fontSize: 11, fontWeight: 700,
                            }}>
                            {u.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!users.length && (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', color: 'var(--neutral-4)', padding: 32 }}>
                          No users yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ══════════ MODALS ══════════ */}

      {/* ── Add School Modal ── */}
      {showSchoolModal && (
        <div className="modal-backdrop"
          onClick={e => e.target === e.currentTarget && setShowSchoolModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h3>🏫 Add New School</h3>
              <button className="modal-close" onClick={() => setShowSchoolModal(false)}>✕</button>
            </div>
            <form onSubmit={createSchool}>
              <div className="modal-body">
                <div className="grid-2">
                  {[
                    ['name',            'School Name *',  'text',  true,  'Delhi Public School'],
                    ['code',            'School Code *',  'text',  true,  'DPS001'],
                    ['city',            'City',           'text',  false, 'New Delhi'],
                    ['state',           'State',          'text',  false, 'Delhi'],
                    ['phone',           'Phone',          'text',  false, '+91-XXXXX-XXXXX'],
                    ['email',           'Email',          'email', false, 'info@school.edu'],
                    ['current_session', 'Session',        'text',  false, '2024-25'],
                  ].map(([field, label, type, req, ph]) => (
                    <div className="form-group" key={field}>
                      <label className="form-label">{label}</label>
                      <input className="form-input" type={type} placeholder={ph} required={req}
                        onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} />
                    </div>
                  ))}
                  <div className="form-group">
                    <label className="form-label">Type</label>
                    <select className="form-select"
                      onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                      <option value="SCHOOL">School</option>
                      <option value="COLLEGE">College</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Address</label>
                  <input className="form-input" placeholder="Full address..."
                    onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-neutral"
                  onClick={() => setShowSchoolModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Creating...' : '🏫 Create School'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit School Modal ── */}
      {showEditModal && editSchool && (
        <div className="modal-backdrop"
          onClick={e => e.target === e.currentTarget && setShowEditModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h3>✏️ Edit School — {editSchool.name}</h3>
              <button className="modal-close" onClick={() => setShowEditModal(false)}>✕</button>
            </div>
            <form onSubmit={saveEdit}>
              <div className="modal-body">
                <div className="grid-2">
                  {[
                    ['name',            'School Name *',  'text',  true],
                    ['city',            'City',           'text',  false],
                    ['state',           'State',          'text',  false],
                    ['phone',           'Phone',          'text',  false],
                    ['email',           'Email',          'email', false],
                    ['current_session', 'Session',        'text',  false],
                  ].map(([field, label, type, req]) => (
                    <div className="form-group" key={field}>
                      <label className="form-label">{label}</label>
                      <input className="form-input" type={type} required={req}
                        value={form[field] || ''}
                        onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} />
                    </div>
                  ))}
                </div>
                <div className="form-group">
                  <label className="form-label">Address</label>
                  <input className="form-input"
                    value={form.address || ''}
                    onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-neutral"
                  onClick={() => setShowEditModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : '💾 Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ── Services / Features Modal ── */}
      {showFeaturesModal && featuresSchool && (
        <div className="modal-backdrop"
          onClick={e => e.target === e.currentTarget && setShowFeaturesModal(false)}>
          <div className="modal" style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <h3>⚡ Services — {featuresSchool.name}</h3>
              <button className="modal-close" onClick={() => setShowFeaturesModal(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ maxHeight: '65vh', overflowY: 'auto' }}>

              {/* Plan presets */}
              <p style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>
                Quick-fill ek plan ke hisab se, fir neeche manually har service ko alag se on/off bhi kar sakte ho.
              </p>
              <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                {['BASIC', 'PROFESSIONAL', 'ENTERPRISE'].map(p => (
                  <button key={p} type="button"
                    onClick={() => applyPreset(p)}
                    style={{
                      flex: 1, padding: '10px', borderRadius: 8, cursor: 'pointer',
                      border: selectedPlan === p ? '2px solid var(--blue-60)' : '1px solid #e2e8f0',
                      background: selectedPlan === p ? '#eff6ff' : '#fff',
                      fontWeight: 700, fontSize: 12,
                      color: selectedPlan === p ? 'var(--blue-60)' : '#475569',
                    }}>
                    Apply {p.charAt(0) + p.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>

              {/* Feature checklist grouped by tier */}
              {['BASIC', 'PROFESSIONAL', 'ENTERPRISE'].map(tier => (
                <div key={tier} style={{ marginBottom: 18 }}>
                  <div style={{
                    fontSize: 11, fontWeight: 800, color: '#94a3b8',
                    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8,
                  }}>
                    {tier}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {featureCatalog.filter(f => f.tier === tier).map(f => {
                      const checked = selectedFeatures.includes(f.key);
                      return (
                        <label key={f.key} style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '8px 10px', borderRadius: 6, cursor: 'pointer',
                          background: checked ? '#f0fdf4' : '#f8fafc',
                          border: checked ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
                          fontSize: 12.5,
                        }}>
                          <input type="checkbox" checked={checked}
                            onChange={() => toggleFeature(f.key)} />
                          <span style={{ color: checked ? '#166534' : '#334155' }}>{f.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-neutral"
                onClick={() => setShowFeaturesModal(false)}>Cancel</button>
              <button type="button" className="btn btn-primary" disabled={savingFeatures}
                onClick={saveFeatures}>
                {savingFeatures ? 'Saving...' : '💾 Save Services'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Company Staff Modal — COMPANY-scope roles only, no school field ── */}
      {showCompanyStaffModal && (
        <div className="modal-backdrop"
          onClick={e => e.target === e.currentTarget && setShowCompanyStaffModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h3>🧑‍💼 Add Company Staff</h3>
              <button className="modal-close" onClick={() => setShowCompanyStaffModal(false)}>✕</button>
            </div>
            <form onSubmit={createUser}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input className="form-input" placeholder="John Doe" required
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Email *</label>
                  <input className="form-input" type="email" placeholder="john@oneplatform360.com" required
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Role *</label>
                  <select className="form-select" required
                    onChange={e => setForm(f => ({ ...f, role: e.target.value, school_id: null }))}>
                    <option value="">Select role</option>
                    {companyRoles.map(r => (
                      <option key={r.key} value={r.key}>{r.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <input className="form-input" type="password"
                    placeholder="Leave blank for default: EduErp@123"
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input className="form-input" placeholder="+91-XXXXX-XXXXX"
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-neutral"
                  onClick={() => setShowCompanyStaffModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Creating...' : '🧑‍💼 Create Staff'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Assign School Head Modal — pick a school, then Director/Principal
           only. Other school staff are created from that school's own
           "Staff & Principal" tab, not here. ── */}
      {showSchoolHeadModal && (
        <div className="modal-backdrop"
          onClick={e => e.target === e.currentTarget && setShowSchoolHeadModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h3>🏫 Assign School Head</h3>
              <button className="modal-close" onClick={() => setShowSchoolHeadModal(false)}>✕</button>
            </div>
            <form onSubmit={createUser}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input className="form-input" placeholder="John Doe" required
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Email *</label>
                  <input className="form-input" type="email" placeholder="john@school.edu" required
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">School *</label>
                    <select className="form-select" required
                      onChange={e => setForm(f => ({ ...f, school_id: e.target.value }))}>
                      <option value="">Select school</option>
                      {schools.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Role *</label>
                    <select className="form-select" required
                      onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                      <option value="">Select role</option>
                      {headRoles.map(r => (
                        <option key={r.key} value={r.key}>{r.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <input className="form-input" type="password"
                    placeholder="Leave blank for default: EduErp@123"
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input className="form-input" placeholder="+91-XXXXX-XXXXX"
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-neutral"
                  onClick={() => setShowSchoolHeadModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Assigning...' : '🏫 Assign Head'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Credentials Modal ── */}
      {createdCreds && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h3>✅ User Created!</h3>
              <button className="modal-close"
                onClick={() => { setCreatedCreds(null); setCopied(false); }}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{
                background: '#f0fdf4', border: '1px solid #bbf7d0',
                borderRadius: 10, padding: '16px 20px', marginBottom: 16,
              }}>
                <p style={{ fontSize: 12, color: '#166534', fontWeight: 600, marginBottom: 14 }}>
                  📋 Share these login credentials with the user:
                </p>
                {[
                  ['👤 Name',     createdCreds.name],
                  ['📧 Email',    createdCreds.email],
                  ['🔑 Password', createdCreds.password],
                  ['🎭 Role',     createdCreds.role],
                  ['🏫 School',   createdCreds.school],
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
                      background: label.includes('Password') ? '#e0f2fe' : 'transparent',
                      padding: label.includes('Password') ? '2px 8px' : '0',
                      borderRadius: 4,
                    }}>{value}</strong>
                  </div>
                ))}
              </div>
              <div style={{
                background: '#fffbeb', border: '1px solid #fde68a',
                borderRadius: 8, padding: '10px 14px', marginBottom: 16,
                fontSize: 12, color: '#92400e',
              }}>
                ⚠️ Save these credentials now — password cannot be retrieved later.
              </div>
              <button onClick={handleCopy} style={{
                width: '100%', padding: '11px', borderRadius: 8, border: 'none',
                background: copied ? '#2e844a' : 'var(--blue-60)',
                color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                transition: 'background 0.2s',
              }}>
                {copied ? '✅ Copied!' : '📋 Copy Credentials'}
              </button>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary"
                onClick={() => { setCreatedCreds(null); setCopied(false); }}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      <OneP360BotDrawer />
    </div>
  );
}

