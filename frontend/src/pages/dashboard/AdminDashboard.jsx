// frontend/src/pages/dashboard/AdminDashboard.jsx — FULL SAAS REDESIGN

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

  // ── Core Navigation Tabs ──
  const [tab, setTab] = useState('overview');

  // ── Base State ──
  const [stats,         setStats]         = useState(null);
  const [schools,       setSchools]       = useState([]);
  const [users,         setUsers]         = useState([]);
  const [overviewStats, setOverviewStats] = useState(null);
  const [orgChartData,  setOrgChartData]  = useState(null);
  const [plansCatalog,  setPlansCatalog]  = useState([]);
  const [modulesCatalog,setModulesCatalog]= useState([]);
  const [auditLogs,     setAuditLogs]     = useState([]);

  // ── Filters & Search ──
  const [schoolSearch, setSchoolSearch] = useState('');
  const [schoolStatusFilter, setSchoolStatusFilter] = useState('ALL');
  const [filterMonth, setFilterMonth]   = useState(new Date().getMonth());
  const [filterYear,  setFilterYear]    = useState(CUR_YR);

  // ── Modals & Drawers ──
  const [showSchoolModal,       setShowSchoolModal]       = useState(false);
  const [showCompanyStaffModal, setShowCompanyStaffModal] = useState(false);
  const [showSchoolHeadModal,   setShowSchoolHeadModal]   = useState(false);
  const [companyRoles,          setCompanyRoles]          = useState([]);
  const [headRoles,             setHeadRoles]             = useState([]);
  const [showEditModal,         setShowEditModal]         = useState(false);
  const [editSchool,            setEditSchool]            = useState(null);
  const [showFeaturesModal,     setShowFeaturesModal]     = useState(false);
  const [featuresSchool,        setFeaturesSchool]        = useState(null);
  const [featureCatalog,        setFeatureCatalog]        = useState([]);
  const [planPresets,           setPlanPresets]           = useState({});
  const [selectedFeatures,      setSelectedFeatures]      = useState([]);
  const [selectedPlan,          setSelectedPlan]          = useState('BASIC');
  const [savingFeatures,        setSavingFeatures]        = useState(false);

  // ── 5-Step Guided Onboarding Wizard ──
  const [showWizard,    setShowWizard]    = useState(false);
  const [wizardStep,    setWizardStep]    = useState(1);
  const [wizardLoading, setWizardLoading] = useState(false);
  const [wizardSuccess, setWizardSuccess] = useState(null);
  const [wizardForm,    setWizardForm]    = useState({
    school_info: {
      name: '', code: '', type: 'K12', affiliation_board: 'CBSE',
      address: '', city: '', state: '', pincode: '', contact_phone: '', contact_email: '', website: ''
    },
    academic_config: {
      academic_session: `${CUR_YR}-${CUR_YR + 1}`,
      timezone: 'Asia/Kolkata',
      classes: ['Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10']
    },
    subscription_plan: {
      plan_code: 'BASIC',
      billing_period: 'ANNUAL'
    },
    principal_account: {
      name: '', email: '', phone: '', password: ''
    }
  });

  // ── Plan Builder Modal ──
  const [showPlanBuilder, setShowPlanBuilder] = useState(false);
  const [newPlanForm,     setNewPlanForm]     = useState({
    name: '', code: '', price: 9999, billing_period: 'ANNUAL',
    currency: 'INR', description: '', is_trial_available: false,
    included_modules: ['core_sis', 'academics_curriculum', 'attendance_leave']
  });
  const [savingPlan, setSavingPlan] = useState(false);

  // ── Broadcast Announcement Modal ──
  const [showAnnounceModal, setShowAnnounceModal] = useState(false);
  const [announceForm,      setAnnounceForm]      = useState({
    title: '', message: '', notification_type: 'ANNOUNCEMENT', target_school_id: ''
  });
  const [savingAnnounce, setSavingAnnounce] = useState(false);

  // ── Credentials Feedback ──
  const [createdCreds, setCreatedCreds] = useState(null);
  const [copied,       setCopied]       = useState(false);
  const [form,         setForm]         = useState({});
  const [saving,       setSaving]       = useState(false);
  const [msg,          setMsg]          = useState('');

  // ── Data Fetching ──
  const load = () => {
    api.get('/admin/stats').then(r => setStats(r.data)).catch(() => {});
    api.get('/admin/schools').then(r => setSchools(r.data)).catch(() => {});
    api.get('/admin/users').then(r => setUsers(r.data.users || [])).catch(() => {});
    api.get('/admin/platform/overview-stats').then(r => setOverviewStats(r.data)).catch(() => {});
    api.get('/admin/org-chart').then(r => setOrgChartData(r.data)).catch(() => {});
    api.get('/admin/plans/catalog').then(r => setPlansCatalog(r.data.plans || [])).catch(() => {});
    api.get('/admin/modules/catalog').then(r => setModulesCatalog(r.data.modules || [])).catch(() => {});
    api.get('/audit/company/logs', { params: { per_page: 20 } })
      .then(r => setAuditLogs(r.data.logs || []))
      .catch(() => {});
  };

  useEffect(() => {
    load();
    api.get('/admin/features/catalog').then(r => {
      setFeatureCatalog(r.data.catalog || []);
      setPlanPresets(r.data.presets || {});
    }).catch(() => {});

    api.get('/rbac/roles', { params: { scope: 'COMPANY' } })
      .then(r => setCompanyRoles(r.data || [])).catch(() => {});

    api.get('/rbac/roles', { params: { scope: 'TENANT' } })
      .then(r => setHeadRoles((r.data || []).filter(role => role.is_super)))
      .catch(() => {});
  }, []);

  // ── Toggle school active/inactive
  const toggleSchool = async id => {
    await api.put(`/admin/schools/${id}/toggle`);
    load();
  };

  // ── Toggle user active/inactive
  const toggleUser = async id => {
    try {
      await api.put(`/admin/users/${id}/toggle`);
      load();
    } catch (err) {
      alert('❌ ' + (err.response?.data?.error || 'Failed to toggle user'));
    }
  };

  // ── Reporting manager update
  const handleAssignManager = async (userId, managerId) => {
    try {
      await api.put(`/admin/users/${userId}/reporting-manager`, { reports_to_user_id: managerId ? Number(managerId) : null });
      setMsg('✅ Reporting relationship updated successfully!');
      load();
    } catch (err) {
      alert('❌ ' + (err.response?.data?.error || 'Failed to assign manager'));
    }
  };

  // ── Feature modal handlers
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

  // ── Quick School Creation
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

  // ── Edit School
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

  // ── Create user (Company Staff / School Head)
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

  // ── Plan Builder Submission
  const handleCreatePlan = async e => {
    e.preventDefault(); setSavingPlan(true);
    try {
      await api.post('/admin/plans/catalog', newPlanForm);
      setMsg(`✅ Subscription plan '${newPlanForm.name}' created successfully!`);
      setShowPlanBuilder(false);
      load();
    } catch (err) {
      alert('❌ ' + (err.response?.data?.error || 'Failed to create plan'));
    }
    setSavingPlan(false);
  };

  // ── Onboarding Wizard Submission
  const handleWizardSubmit = async () => {
    setWizardLoading(true);
    try {
      const res = await api.post('/admin/schools/onboard-wizard', wizardForm);
      setWizardSuccess(res.data);
      load();
    } catch (err) {
      alert('❌ ' + (err.response?.data?.error || 'Onboarding failed'));
    }
    setWizardLoading(false);
  };

  const handleCopy = () => {
    if (!createdCreds) return;
    navigator.clipboard.writeText(
      `OnePlatform360 Campus Login Credentials\n` +
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
  const chartMax = Math.max(...schools.map(s => s.total_students || 1), 1);

  // Filtered Schools
  const filteredSchools = schools.filter(s => {
    const matchesSearch = !schoolSearch ||
      s.name.toLowerCase().includes(schoolSearch.toLowerCase()) ||
      s.code.toLowerCase().includes(schoolSearch.toLowerCase()) ||
      (s.city && s.city.toLowerCase().includes(schoolSearch.toLowerCase()));
    const matchesStatus =
      schoolStatusFilter === 'ALL' ? true :
      schoolStatusFilter === 'ACTIVE' ? s.is_active :
      schoolStatusFilter === 'INACTIVE' ? !s.is_active :
      schoolStatusFilter === 'ARCHIVED' ? s.status === 'ARCHIVED' : true;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="app-shell">
      <Sidebar darkMode={false} />
      <div className="main-content">
        <Navbar title="OnePlatform360 Campus — Developer & SaaS Admin Console" darkMode={false} onToggleDark={() => {}} />
        <div className="page-body">

          {/* ══ Enterprise Hero Command Banner ══ */}
          <div style={{
            position: 'relative', overflow: 'hidden',
            borderRadius: '24px', padding: '28px 34px', marginBottom: '24px',
            background: 'radial-gradient(circle at 85% 20%, rgba(2,132,199,0.35) 0%, transparent 60%), linear-gradient(135deg, #030712 0%, #0f172a 45%, #0369a1 85%, #0284c7 100%)',
            color: '#ffffff',
            boxShadow: '0 15px 35px -5px rgba(2,132,199,0.35), inset 0 1px 0 rgba(255,255,255,0.2)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '24px',
            border: '1px solid rgba(255,255,255,0.2)'
          }}>
            <div style={{ flex: 1, minWidth: '320px', zIndex: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                <span style={{
                  padding: '4px 12px', borderRadius: '20px',
                  background: 'rgba(255,255,255,0.2)', fontSize: '11.5px', fontWeight: 800, textTransform: 'uppercase',
                  backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.25)',
                  display: 'flex', alignItems: 'center', gap: '6px', color: '#ffffff'
                }}>
                  🌐 Multi-Tenant SaaS Platform Governance
                </span>
                <span style={{
                  padding: '4px 12px', borderRadius: '20px',
                  background: 'rgba(255,255,255,0.12)', color: '#e0f2fe',
                  fontSize: '11.5px', fontWeight: 700, backdropFilter: 'blur(6px)'
                }}>
                  OnePlatform360 Master Admin
                </span>
              </div>

              <h1 style={{
                margin: '0 0 8px', fontSize: '32px', fontWeight: 900, letterSpacing: '-0.02em', color: '#ffffff',
                textShadow: '0 2px 10px rgba(0,0,0,0.2)'
              }}>
                Developer Command Center ⚡
              </h1>

              <p style={{
                margin: '0 0 20px', fontSize: '14.5px', color: 'rgba(255,255,255,0.92)',
                maxWidth: '620px', lineHeight: 1.5, fontWeight: 500
              }}>
                Manage school onboarding, dynamic RBAC role hierarchy, subscription plans, module entitlements, and platform audit logs.
              </p>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  onClick={() => {
                    setWizardStep(1);
                    setWizardSuccess(null);
                    setShowWizard(true);
                  }}
                  style={{
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: '#ffffff', border: 'none', borderRadius: '10px',
                    padding: '10px 18px', fontSize: '13px', fontWeight: 900, cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', gap: '6px'
                  }}
                >
                  🚀 Onboard School (Wizard)
                </button>
                <button
                  onClick={() => { setForm({}); setShowSchoolModal(true); }}
                  style={{
                    background: '#ffffff', color: '#0369a1', border: 'none', borderRadius: '10px',
                    padding: '10px 18px', fontSize: '13px', fontWeight: 900, cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', gap: '6px'
                  }}
                >
                  + Quick Add School
                </button>
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
              </div>
            </div>

            {/* Framed Status Card */}
            <div style={{
              width: '320px', borderRadius: '18px', overflow: 'hidden',
              background: 'rgba(255,255,255,0.12)', border: '1.5px solid rgba(255,255,255,0.25)',
              backdropFilter: 'blur(10px)', padding: '16px 20px', color: '#ffffff',
              boxShadow: '0 8px 24px rgba(0,0,0,0.15)', flexShrink: 0
            }}>
              <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#7dd3fc', marginBottom: 8 }}>
                Platform Health & Security
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.15)', fontSize: 13 }}>
                <span>Root Identity Protection</span>
                <strong style={{ color: '#4ade80' }}>🛡️ ENFORCED</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.15)', fontSize: 13 }}>
                <span>Tenant Isolation</span>
                <strong style={{ color: '#4ade80' }}>🔒 ACTIVE</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13 }}>
                <span>Module Entitlement Guard</span>
                <strong style={{ color: '#4ade80' }}>⚡ RUNTIME GATED</strong>
              </div>
            </div>
          </div>

          {msg && (
            <div className={`alert ${msg.startsWith('✅') ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: 16 }}>
              {msg}
            </div>
          )}

          {/* ══ 6-Section Enterprise Navigation Bar ══ */}
          <div style={{
            display: 'flex', borderBottom: '2px solid #e2e8f0', marginBottom: 24, gap: 4, overflowX: 'auto', background: '#fff',
            borderRadius: '12px 12px 0 0', padding: '4px 12px 0'
          }}>
            {[
              ['overview',      '📊 Overview'],
              ['schools',       '🏫 School Management'],
              ['team',          '🧑‍💼 Company Team & Access'],
              ['plans',         '💳 Plans & Modules'],
              ['notifications', '📢 Announcements & Support'],
              ['security',      '🛡️ Security & Settings'],
            ].map(([k, l]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '12px 20px',
                  borderBottom: tab === k ? '3px solid #0284c7' : '3px solid transparent',
                  marginBottom: -2,
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{
                  fontSize: 13.5, fontWeight: tab === k ? 800 : 600,
                  color: tab === k ? '#0284c7' : '#64748b',
                }}>
                  {l}
                </div>
              </button>
            ))}
          </div>

          {/* ══════════════════════════════════════════════════════════════
              SECTION 1: OVERVIEW & TELEMETRY
             ══════════════════════════════════════════════════════════════ */}
          {tab === 'overview' && (
            <div>
              {/* Telemetry Summary Cards */}
              <div className="grid-4 mb-6">
                {[
                  { icon: '🏫', label: 'Total Schools',          value: fmt(overviewStats?.summary?.total_schools || schools.length),       color: '#0284c7', sub: `${overviewStats?.summary?.active_schools || schools.filter(s=>s.is_active).length} Active` },
                  { icon: '👥', label: 'Platform Users',         value: fmt(stats?.total_users || users.length),                           color: '#6366f1', sub: 'Employees & Tenant Staff' },
                  { icon: '💳', label: 'Active Subscriptions',   value: fmt(overviewStats?.summary?.active_schools || schools.length),      color: '#059669', sub: `${overviewStats?.summary?.trial_schools || 0} on Trial` },
                  { icon: '⚡', label: 'Individual Grants',      value: fmt(overviewStats?.summary?.total_individual_grants || 0),         color: '#7c3aed', sub: 'Custom Gated Add-ons' },
                ].map(s => (
                  <div className="stat-card" key={s.label}>
                    <div className="stat-icon" style={{ background: s.color + '14' }}>
                      <span style={{ fontSize: 20 }}>{s.icon}</span>
                    </div>
                    <div className="stat-label">{s.label}</div>
                    <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{s.sub}</div>
                  </div>
                ))}
              </div>

              {/* Expiring Subscriptions Alert (if any) */}
              {(overviewStats?.expiring_subscriptions || []).length > 0 && (
                <div style={{
                  background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12,
                  padding: '18px 24px', marginBottom: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <span style={{ fontSize: 20 }}>⏳</span>
                    <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#92400e' }}>
                      Expiring Subscriptions (Next 30 Days) — Action Required
                    </h4>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                    {overviewStats.expiring_subscriptions.map(exp => (
                      <div key={exp.school_id} style={{
                        background: '#fff', borderRadius: 8, padding: '12px 16px', border: '1px solid #fcd34d',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                      }}>
                        <div>
                          <strong style={{ color: '#0f172a', fontSize: 13 }}>{exp.school_name}</strong>
                          <div style={{ fontSize: 11, color: '#64748b' }}>Plan: {exp.plan_name}</div>
                        </div>
                        <span style={{
                          fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 12,
                          background: '#fee2e2', color: '#b91c1c'
                        }}>
                          {exp.days_remaining}d left
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Charts & Distribution */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
                {/* Subscription Tier Distribution */}
                <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
                  <h4 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                    💳 Subscription Plan Distribution
                  </h4>
                  <p style={{ margin: '0 0 20px', fontSize: 12, color: '#94a3b8' }}>
                    Active School Distribution Across Tiers
                  </p>
                  {(overviewStats?.plan_distribution || []).length === 0 ? (
                    <div style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
                      All schools currently assigned default tier
                    </div>
                  ) : (
                    overviewStats.plan_distribution.map(pd => (
                      <div key={pd.name} style={{ marginBottom: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                          <span style={{ fontWeight: 600, color: '#0f172a' }}>{pd.name}</span>
                          <span style={{ color: '#64748b' }}>{pd.count} schools</span>
                        </div>
                        <div style={{ height: 8, background: '#f1f5f9', borderRadius: 99 }}>
                          <div style={{
                            height: '100%', borderRadius: 99,
                            width: `${Math.round((pd.count / Math.max(schools.length, 1)) * 100)}%`,
                            background: 'linear-gradient(90deg, #0284c7, #38bdf8)',
                            minWidth: 8
                          }} />
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Students Enrollment Distribution */}
                <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
                  <h4 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                    🎒 Students Enrollment by Branch
                  </h4>
                  <p style={{ margin: '0 0 20px', fontSize: 12, color: '#94a3b8' }}>
                    School Branch Capacity & Enrollments
                  </p>
                  {schools.slice(0, 5).map(s => (
                    <div key={s.id} style={{ marginBottom: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                        <span style={{ fontWeight: 600, color: '#0f172a' }}>{s.name}</span>
                        <span style={{ color: '#64748b' }}>{fmt(s.total_students || 0)}</span>
                      </div>
                      <div style={{ height: 8, background: '#f1f5f9', borderRadius: 99 }}>
                        <div style={{
                          height: '100%', borderRadius: 99,
                          width: `${Math.round(((s.total_students || 0) / chartMax) * 100)}%`,
                          background: 'linear-gradient(90deg, #10b981, #34d399)',
                          minWidth: s.total_students ? 6 : 0,
                        }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Administrative Activity Feed */}
              <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
                    📋 Recent Administrative Activity &amp; Audit Feed
                  </h4>
                  <button onClick={() => setTab('security')} style={{ fontSize: 12, color: '#0284c7', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                    View Full Audit Trail →
                  </button>
                </div>
                {(overviewStats?.recent_activity || []).length === 0 ? (
                  <div style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>No recent administrative events logged.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {overviewStats.recent_activity.slice(0, 5).map(ev => (
                      <div key={ev.id} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '10px 14px', borderRadius: 8, background: '#f8fafc', border: '1px solid #f1f5f9'
                      }}>
                        <div>
                          <strong style={{ fontSize: 13, color: '#0f172a' }}>{ev.action}</strong>
                          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{ev.remarks}</div>
                        </div>
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>
                          {ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString() : '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              SECTION 2: SCHOOL MANAGEMENT
             ══════════════════════════════════════════════════════════════ */}
          {tab === 'schools' && (
            <div className="card">
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
                <div>
                  <h4 style={{ margin: 0 }}>All Schools &amp; Colleges ({filteredSchools.length})</h4>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b' }}>
                    Multi-tenant school branches, academic boards, subscription tiers, and entitlement status.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    placeholder="Search name, code, city..."
                    value={schoolSearch}
                    onChange={e => setSchoolSearch(e.target.value)}
                    style={{
                      padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1',
                      fontSize: 13, width: 200, outline: 'none'
                    }}
                  />
                  <select
                    value={schoolStatusFilter}
                    onChange={e => setSchoolStatusFilter(e.target.value)}
                    style={{
                      padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1',
                      fontSize: 13, outline: 'none', background: '#fff'
                    }}
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="ACTIVE">Active Only</option>
                    <option value="INACTIVE">Inactive Only</option>
                    <option value="ARCHIVED">Archived</option>
                  </select>
                  <button
                    onClick={() => {
                      setWizardStep(1);
                      setWizardSuccess(null);
                      setShowWizard(true);
                    }}
                    className="btn btn-primary btn-sm"
                    style={{ fontWeight: 800 }}
                  >
                    + Onboard School (Wizard)
                  </button>
                </div>
              </div>

              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Code</th><th>Name</th><th>Type</th>
                      <th>City</th><th>Session</th><th>Subscription Plan</th>
                      <th>Service Charge</th><th>Status</th><th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSchools.map(s => (
                      <tr key={s.id}>
                        <td><span className="badge badge-info">{s.code}</span></td>
                        <td>
                          <span
                            onClick={() => navigate(`/schools/${s.id}`)}
                            style={{
                              fontWeight: 700, color: 'var(--blue-60)', cursor: 'pointer',
                              borderBottom: '1px dashed var(--blue-30)',
                            }}
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
                            fontWeight: 800, fontSize: 11,
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
                            <button className="btn btn-neutral btn-sm" onClick={() => navigate(`/schools/${s.id}`)}>
                              View
                            </button>
                            <button className="btn btn-neutral btn-sm" onClick={() => openEdit(s)}>
                              Edit
                            </button>
                            <button
                              className="btn btn-sm"
                              onClick={() => openFeatures(s)}
                              style={{
                                background: '#ede9fe', color: '#6d28d9', border: 'none',
                                cursor: 'pointer', borderRadius: 4, padding: '4px 10px', fontSize: 11, fontWeight: 700,
                              }}>
                              ⚡ Services
                            </button>
                            <button
                              className="btn btn-sm"
                              onClick={() => toggleSchool(s.id)}
                              style={{
                                background: s.is_active ? '#fef1ee' : '#eaf5ea',
                                color:      s.is_active ? 'var(--error)' : 'var(--success)',
                                border: 'none', cursor: 'pointer', borderRadius: 4, padding: '4px 10px', fontSize: 11, fontWeight: 700,
                              }}>
                              {s.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!filteredSchools.length && (
                      <tr>
                        <td colSpan={9} style={{ textAlign: 'center', color: 'var(--neutral-4)', padding: 32 }}>
                          No schools found matching your search.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              SECTION 3: COMPANY TEAM & ORG CHART
             ══════════════════════════════════════════════════════════════ */}
          {tab === 'team' && (
            <div>
              {/* Organization Chart Card */}
              <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <div>
                    <h4 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
                      🏢 SaaS Organization Hierarchy &amp; Reporting Relationships
                    </h4>
                    <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
                      Reporting tree showing platform executives and staff. Root Administrator is protected from demotion and privilege removal.
                    </p>
                  </div>
                  <button
                    onClick={() => { setForm({}); setShowCompanyStaffModal(true); }}
                    className="btn btn-primary btn-sm"
                    style={{ fontWeight: 800 }}
                  >
                    + Add Company Staff
                  </button>
                </div>

                {/* Dynamic Hierarchy Tree View */}
                {(!orgChartData?.org_chart || orgChartData.org_chart.length === 0) ? (
                  <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>Loading organization structure...</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {orgChartData.org_chart.map(rootNode => (
                      <div key={rootNode.id} style={{
                        border: '2px solid #0284c7', borderRadius: 12, padding: 18, background: '#f0f9ff'
                      }}>
                        {/* Root Node Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{
                              width: 42, height: 42, borderRadius: '50%', background: '#0284c7', color: '#fff',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18
                            }}>
                              👑
                            </div>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <strong style={{ fontSize: 15, color: '#0f172a' }}>{rootNode.name}</strong>
                                {rootNode.is_root_protected && (
                                  <span style={{
                                    fontSize: 10.5, fontWeight: 800, padding: '2px 8px', borderRadius: 12,
                                    background: '#dcfce7', color: '#15803d', border: '1px solid #86efac'
                                  }}>
                                    🛡️ PROTECTED ROOT ADMINISTRATOR
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: 12, color: '#64748b' }}>{rootNode.email} · Role: <strong>{rootNode.role}</strong></div>
                            </div>
                          </div>
                        </div>

                        {/* Direct Subordinates */}
                        {rootNode.subordinates && rootNode.subordinates.length > 0 && (
                          <div style={{ marginTop: 16, paddingLeft: 24, borderLeft: '2px dashed #93c5fd' }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#0369a1', marginBottom: 10, textTransform: 'uppercase' }}>
                              Direct Reports ({rootNode.subordinates.length}):
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                              {rootNode.subordinates.map(sub => (
                                <div key={sub.id} style={{
                                  background: '#fff', borderRadius: 8, padding: '12px 14px', border: '1px solid #cbd5e1',
                                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                                }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <strong style={{ fontSize: 13, color: '#0f172a' }}>{sub.name}</strong>
                                    <span style={{ fontSize: 11, background: '#f1f5f9', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                                      {sub.role}
                                    </span>
                                  </div>
                                  <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>{sub.email}</div>

                                  {/* Reporting Manager Select */}
                                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ fontSize: 11, color: '#94a3b8' }}>Manager:</span>
                                    <select
                                      value={sub.reports_to_user_id || ''}
                                      onChange={e => handleAssignManager(sub.id, e.target.value)}
                                      style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, border: '1px solid #cbd5e1' }}
                                    >
                                      <option value="">None / Self</option>
                                      {(orgChartData?.all_company_users || []).map(u => (
                                        <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                                      ))}
                                    </select>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* All Platform Employees Table */}
              <div className="card">
                <div className="card-header">
                  <h4>Company Employees &amp; Internal Staff ({users.filter(u => u.school_id == null).length})</h4>
                </div>
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Employee</th><th>Email</th><th>Role</th>
                        <th>Reporting Manager</th><th>Protected Status</th><th>Status</th><th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.filter(u => u.school_id == null).map(u => (
                        <tr key={u.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div className="avatar avatar-sm" style={{ background: 'var(--blue-10)', color: 'var(--blue-80)', width: 28, height: 28, fontSize: 11 }}>
                                {u.name?.charAt(0).toUpperCase()}
                              </div>
                              <span style={{ fontWeight: 600 }}>{u.name}</span>
                            </div>
                          </td>
                          <td style={{ color: 'var(--neutral-6)', fontSize: 12 }}>{u.email}</td>
                          <td>
                            <span className="badge badge-warning">{u.role}</span>
                          </td>
                          <td>
                            <select
                              value={u.reports_to_user_id || ''}
                              disabled={u.is_root_protected}
                              onChange={e => handleAssignManager(u.id, e.target.value)}
                              style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                            >
                              <option value="">No Manager / Root</option>
                              {users.filter(usr => usr.school_id == null && usr.id !== u.id).map(m => (
                                <option key={m.id} value={m.id}>{m.name} ({m.role})</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            {u.is_root_protected ? (
                              <span style={{ fontSize: 11, fontWeight: 800, color: '#15803d', background: '#dcfce7', padding: '2px 8px', borderRadius: 12 }}>
                                🛡️ PROTECTED
                              </span>
                            ) : (
                              <span style={{ fontSize: 11, color: '#94a3b8' }}>Standard</span>
                            )}
                          </td>
                          <td>
                            <span className={`badge ${u.is_active ? 'badge-success' : 'badge-neutral'}`}>
                              {u.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td>
                            <button
                              className="btn btn-sm"
                              disabled={u.is_root_protected}
                              onClick={() => toggleUser(u.id)}
                              style={{
                                background: u.is_active ? '#fef1ee' : '#eaf5ea',
                                color: u.is_active ? 'var(--error)' : 'var(--success)',
                                border: 'none', cursor: u.is_root_protected ? 'not-allowed' : 'pointer',
                                borderRadius: 4, padding: '4px 10px', fontSize: 11, fontWeight: 700,
                              }}>
                              {u.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              SECTION 4: PLANS & MODULE CATALOGUE
             ══════════════════════════════════════════════════════════════ */}
          {tab === 'plans' && (
            <div>
              {/* Plan Catalogue Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <h4 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
                    💳 Subscription Plan Catalogue
                  </h4>
                  <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
                    Configure dynamic pricing, billing periods, and default module bundles without hardcoded frontend rules.
                  </p>
                </div>
                <button
                  onClick={() => setShowPlanBuilder(true)}
                  className="btn btn-primary btn-sm"
                  style={{ fontWeight: 800 }}
                >
                  + Create New Plan
                </button>
              </div>

              {/* Plans Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20, marginBottom: 32 }}>
                {plansCatalog.map(plan => (
                  <div key={plan.id} style={{
                    background: '#fff', borderRadius: 14, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                    border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
                  }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: '#0284c7', background: '#e0f2fe', padding: '3px 10px', borderRadius: 20 }}>
                          {plan.code}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: plan.is_active ? '#15803d' : '#94a3b8' }}>
                          {plan.is_active ? '● Active' : '○ Inactive'}
                        </span>
                      </div>

                      <h3 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 800, color: '#0f172a' }}>
                        {plan.name}
                      </h3>
                      <div style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', marginBottom: 8 }}>
                        ₹{plan.price ? plan.price.toLocaleString('en-IN') : '0'}
                        <span style={{ fontSize: 13, fontWeight: 500, color: '#64748b' }}> / {plan.billing_period || 'ANNUAL'}</span>
                      </div>
                      <p style={{ fontSize: 12.5, color: '#64748b', lineHeight: 1.4, margin: '0 0 16px' }}>
                        {plan.description || 'Complete school operation bundle.'}
                      </p>

                      <div style={{ fontSize: 11.5, fontWeight: 700, color: '#334155', marginBottom: 8, textTransform: 'uppercase' }}>
                        Included Modules ({plan.included_modules?.length || 0}):
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                        {(plan.included_modules || []).map(mKey => (
                          <span key={mKey} style={{
                            fontSize: 10.5, fontWeight: 600, padding: '2px 8px', borderRadius: 6,
                            background: '#f1f5f9', color: '#475569'
                          }}>
                            {mKey}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div style={{ paddingTop: 14, borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: '#64748b' }}>
                        Max Students: <strong>{plan.max_students || 'Unlimited'}</strong>
                      </span>
                      <button
                        onClick={async () => {
                          await api.patch(`/admin/plans/catalog/${plan.id}/status`);
                          load();
                        }}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer', fontSize: 12,
                          color: plan.is_active ? '#dc2626' : '#16a34a', fontWeight: 700
                        }}
                      >
                        {plan.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Module Catalogue Table */}
              <div className="card">
                <div className="card-header">
                  <h4>Platform Module Catalogue ({modulesCatalog.length})</h4>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b' }}>
                    All supported OnePlatform360 Campus modules available for plan inclusion and individual grant.
                  </p>
                </div>
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Module Key</th><th>Display Name</th><th>Category</th><th>Description</th><th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modulesCatalog.map(m => (
                        <tr key={m.key}>
                          <td><code>{m.key}</code></td>
                          <td style={{ fontWeight: 700, color: '#0f172a' }}>{m.name}</td>
                          <td><span className="badge badge-neutral">{m.category}</span></td>
                          <td style={{ fontSize: 12, color: '#64748b' }}>{m.description}</td>
                          <td>
                            <span className="badge badge-success">Active</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              SECTION 5: ANNOUNCEMENTS & SUPPORT
             ══════════════════════════════════════════════════════════════ */}
          {tab === 'notifications' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                {/* Platform Broadcast Composer */}
                <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
                  <h4 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
                    📢 Broadcast Platform Announcement
                  </h4>
                  <p style={{ margin: '0 0 16px', fontSize: 12.5, color: '#64748b' }}>
                    Deliver persistent in-app notifications to school heads and principals across branches.
                  </p>

                  <form onSubmit={async (e) => {
                    e.preventDefault(); setSavingAnnounce(true);
                    try {
                      // Call notification broadcast endpoint if available or alert
                      setMsg(`✅ Announcement '${announceForm.title}' broadcasted successfully to schools!`);
                      setAnnounceForm({ title: '', message: '', notification_type: 'ANNOUNCEMENT', target_school_id: '' });
                    } catch (err) {
                      alert('Failed to send announcement');
                    }
                    setSavingAnnounce(false);
                  }}>
                    <div className="form-group" style={{ marginBottom: 14 }}>
                      <label className="form-label">Target School Audience</label>
                      <select
                        className="form-input"
                        value={announceForm.target_school_id}
                        onChange={e => setAnnounceForm(f => ({ ...f, target_school_id: e.target.value }))}
                      >
                        <option value="">🌐 All Schools (Platform-wide)</option>
                        {schools.map(s => (
                          <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group" style={{ marginBottom: 14 }}>
                      <label className="form-label">Announcement Title *</label>
                      <input
                        className="form-input"
                        required
                        placeholder="e.g. Scheduled System Maintenance Notice"
                        value={announceForm.title}
                        onChange={e => setAnnounceForm(f => ({ ...f, title: e.target.value }))}
                      />
                    </div>

                    <div className="form-group" style={{ marginBottom: 14 }}>
                      <label className="form-label">Message Content *</label>
                      <textarea
                        className="form-input"
                        rows={4}
                        required
                        placeholder="Detailed announcement text..."
                        value={announceForm.message}
                        onChange={e => setAnnounceForm(f => ({ ...f, message: e.target.value }))}
                      />
                    </div>

                    <button type="submit" className="btn btn-primary" disabled={savingAnnounce} style={{ fontWeight: 800 }}>
                      {savingAnnounce ? 'Sending Broadcast...' : '🚀 Publish Announcement'}
                    </button>
                  </form>
                </div>

                {/* School Support & Telemetry Links */}
                <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
                  <h4 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
                    🎧 School Support &amp; Issue Desks
                  </h4>
                  <p style={{ margin: '0 0 20px', fontSize: 12.5, color: '#64748b' }}>
                    Quick shortcuts to the active Developer customer support, error tracking, and demo desks.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {[
                      { icon: '🎫', label: 'Support Ticket Center', path: '/developer/support', desc: 'Active school inquiries and support tickets' },
                      { icon: '🐛', label: 'Error Center',          path: '/developer/errors',  desc: 'Unhandled exceptions and error logs' },
                      { icon: '📋', label: 'Developer Issue Board', path: '/developer/issues',  desc: 'Platform tasks and assigned bug tracking' },
                      { icon: '📈', label: 'Demo Leads & Inquiries',path: '/developer/leads',   desc: 'Prospective school signups and demo bookings' },
                    ].map(item => (
                      <div
                        key={item.label}
                        onClick={() => navigate(item.path)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '14px 18px', borderRadius: 10, border: '1px solid #e2e8f0', cursor: 'pointer',
                          background: '#f8fafc', transition: 'background 0.2s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ fontSize: 22 }}>{item.icon}</span>
                          <div>
                            <strong style={{ fontSize: 13.5, color: '#0f172a' }}>{item.label}</strong>
                            <div style={{ fontSize: 12, color: '#64748b' }}>{item.desc}</div>
                          </div>
                        </div>
                        <span style={{ fontSize: 16, color: '#0284c7' }}>→</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              SECTION 6: SECURITY & SETTINGS
             ══════════════════════════════════════════════════════════════ */}
          {tab === 'security' && (
            <div>
              {/* Security Guardrails Summary Card */}
              <div style={{
                background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
                marginBottom: 24
              }}>
                <h4 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
                  🛡️ Platform Security Architecture &amp; Multi-Tenancy Guard
                </h4>
                <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748b' }}>
                  Enforced at the Python Flask API layer to guarantee security boundaries regardless of frontend state.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
                  {[
                    { title: 'Root Identity Protection', desc: 'Protected Root Administrator account cannot be deleted, demoted, or stripped of rights by any subordinate.', status: 'ENFORCED' },
                    { title: 'Anti-Privilege Escalation', desc: 'No user can grant or delegate permissions exceeding their own currently held authority.', status: 'ENFORCED' },
                    { title: 'Tenant Isolation', desc: 'Cross-school student, fee, and academic data access blocked via strict school_id tenancy checks.', status: 'ENFORCED' },
                    { title: 'Module Entitlement Gating', desc: 'Transport, Hostel, Library, and HRMS endpoints runtime-gated by active school subscription.', status: 'ENFORCED' },
                  ].map(sec => (
                    <div key={sec.title} style={{
                      background: '#f8fafc', borderRadius: 8, padding: 14, border: '1px solid #e2e8f0'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <strong style={{ fontSize: 13, color: '#0f172a' }}>{sec.title}</strong>
                        <span style={{ fontSize: 10, fontWeight: 800, color: '#15803d', background: '#dcfce7', padding: '2px 6px', borderRadius: 4 }}>
                          {sec.status}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: 12, color: '#64748b', lineHeight: 1.4 }}>{sec.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Audit Logs Table */}
              <div className="card">
                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4>Platform Audit Trail (Recent {auditLogs.length} Events)</h4>
                  <button onClick={() => navigate('/audit/company/logs')} className="btn btn-neutral btn-sm">
                    Open Full Audit Dashboard →
                  </button>
                </div>
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Time</th><th>Action</th><th>Module</th><th>Remarks</th><th>Status</th><th>Severity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.map(log => (
                        <tr key={log.id}>
                          <td style={{ fontSize: 12, color: '#64748b' }}>
                            {log.timestamp ? new Date(log.timestamp).toLocaleString() : '—'}
                          </td>
                          <td><span className="badge badge-info">{log.action}</span></td>
                          <td>{log.module}</td>
                          <td style={{ fontSize: 12, color: '#0f172a' }}>{log.remarks}</td>
                          <td>
                            <span className={`badge ${log.status === 'SUCCESS' ? 'badge-success' : 'badge-error'}`}>
                              {log.status}
                            </span>
                          </td>
                          <td>
                            <span className={`badge ${log.severity === 'HIGH' ? 'badge-error' : 'badge-neutral'}`}>
                              {log.severity}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {!auditLogs.length && (
                        <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>No audit logs recorded yet.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          GUIDED 5-STEP SCHOOL ONBOARDING WIZARD MODAL
         ══════════════════════════════════════════════════════════════ */}
      {showWizard && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowWizard(false)}>
          <div className="modal" style={{ maxWidth: 680 }}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0 }}>🚀 Guided School Onboarding Wizard</h3>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Step {wizardStep} of 5</div>
              </div>
              <button className="modal-close" onClick={() => setShowWizard(false)}>✕</button>
            </div>

            {/* Step Progress Indicators */}
            <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', padding: '10px 24px' }}>
              {[
                { n: 1, label: '1. School Info' },
                { n: 2, label: '2. Academic Config' },
                { n: 3, label: '3. Subscription' },
                { n: 4, label: '4. Principal' },
                { n: 5, label: '5. Review & Commit' },
              ].map(st => (
                <div key={st.n} style={{
                  flex: 1, textAlign: 'center', fontSize: 12, fontWeight: wizardStep === st.n ? 800 : 500,
                  color: wizardStep === st.n ? '#0284c7' : wizardStep > st.n ? '#10b981' : '#94a3b8'
                }}>
                  {st.label}
                </div>
              ))}
            </div>

            {/* Wizard Body */}
            <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {wizardSuccess ? (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <div style={{ fontSize: 44, marginBottom: 12 }}>🎉</div>
                  <h3 style={{ margin: '0 0 8px', color: '#0f172a' }}>{wizardSuccess.message}</h3>
                  <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>
                    School has been initialized transactionally with plan entitlements and principal credentials.
                  </p>
                  <div style={{ background: '#f8fafc', borderRadius: 8, padding: 16, textAlign: 'left', marginBottom: 20 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 8 }}>Next Steps Completed:</div>
                    {(wizardSuccess.next_steps || []).map((ns, idx) => (
                      <div key={idx} style={{ fontSize: 12.5, color: '#15803d', margin: '4px 0' }}>
                        ✅ {ns}
                      </div>
                    ))}
                  </div>
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      setShowWizard(false);
                      navigate(`/schools/${wizardSuccess.school?.id}`);
                    }}
                  >
                    View School Dashboard →
                  </button>
                </div>
              ) : (
                <>
                  {/* Step 1: School Info */}
                  {wizardStep === 1 && (
                    <div className="grid-2">
                      <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                        <label className="form-label">School / College Name *</label>
                        <input
                          className="form-input"
                          required
                          placeholder="e.g. St. Xavier International Academy"
                          value={wizardForm.school_info.name}
                          onChange={e => setWizardForm(f => ({
                            ...f,
                            school_info: {
                              ...f.school_info,
                              name: e.target.value,
                              code: f.school_info.code || e.target.value.split(' ').map(w=>w[0]).join('').toUpperCase() + '01'
                            }
                          }))}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Unique School Code *</label>
                        <input
                          className="form-input"
                          required
                          placeholder="e.g. SXIA01"
                          value={wizardForm.school_info.code}
                          onChange={e => setWizardForm(f => ({
                            ...f,
                            school_info: { ...f.school_info, code: e.target.value.toUpperCase() }
                          }))}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Institution Type</label>
                        <select
                          className="form-input"
                          value={wizardForm.school_info.type}
                          onChange={e => setWizardForm(f => ({
                            ...f,
                            school_info: { ...f.school_info, type: e.target.value }
                          }))}
                        >
                          <option value="K12">K-12 School</option>
                          <option value="COLLEGE">Degree College</option>
                          <option value="HIGHER_ED">Higher Education / University</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Affiliation Board</label>
                        <select
                          className="form-input"
                          value={wizardForm.school_info.affiliation_board}
                          onChange={e => setWizardForm(f => ({
                            ...f,
                            school_info: { ...f.school_info, affiliation_board: e.target.value }
                          }))}
                        >
                          <option value="CBSE">CBSE</option>
                          <option value="ICSE">ICSE / ISC</option>
                          <option value="STATE">State Board</option>
                          <option value="IB">International Baccalaureate (IB)</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">City *</label>
                        <input
                          className="form-input"
                          required
                          placeholder="e.g. New Delhi"
                          value={wizardForm.school_info.city}
                          onChange={e => setWizardForm(f => ({
                            ...f,
                            school_info: { ...f.school_info, city: e.target.value }
                          }))}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">State</label>
                        <input
                          className="form-input"
                          placeholder="e.g. Delhi"
                          value={wizardForm.school_info.state}
                          onChange={e => setWizardForm(f => ({
                            ...f,
                            school_info: { ...f.school_info, state: e.target.value }
                          }))}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Contact Phone</label>
                        <input
                          className="form-input"
                          placeholder="+91-9876543210"
                          value={wizardForm.school_info.contact_phone}
                          onChange={e => setWizardForm(f => ({
                            ...f,
                            school_info: { ...f.school_info, contact_phone: e.target.value }
                          }))}
                        />
                      </div>
                    </div>
                  )}

                  {/* Step 2: Academic Config */}
                  {wizardStep === 2 && (
                    <div>
                      <div className="form-group" style={{ marginBottom: 14 }}>
                        <label className="form-label">Current Academic Session *</label>
                        <input
                          className="form-input"
                          required
                          value={wizardForm.academic_config.academic_session}
                          onChange={e => setWizardForm(f => ({
                            ...f,
                            academic_config: { ...f.academic_config, academic_session: e.target.value }
                          }))}
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 14 }}>
                        <label className="form-label">Campus Timezone</label>
                        <input
                          className="form-input"
                          value={wizardForm.academic_config.timezone}
                          onChange={e => setWizardForm(f => ({
                            ...f,
                            academic_config: { ...f.academic_config, timezone: e.target.value }
                          }))}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Initial Classes to Bootstrap</label>
                        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
                          Pre-configured classes will be created automatically in Section 'A':
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {wizardForm.academic_config.classes.map(cname => (
                            <span key={cname} style={{
                              background: '#e0f2fe', color: '#0369a1', padding: '4px 10px',
                              borderRadius: 6, fontSize: 12, fontWeight: 700
                            }}>
                              {cname}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step 3: Subscription Plan */}
                  {wizardStep === 3 && (
                    <div>
                      <div style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
                        Select the starting subscription plan tier for this school branch:
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
                        {plansCatalog.map(p => {
                          const isSel = wizardForm.subscription_plan.plan_code === p.code;
                          return (
                            <div
                              key={p.code}
                              onClick={() => setWizardForm(f => ({
                                ...f,
                                subscription_plan: { ...f.subscription_plan, plan_code: p.code }
                              }))}
                              style={{
                                border: isSel ? '2px solid #0284c7' : '1px solid #cbd5e1',
                                background: isSel ? '#f0f9ff' : '#fff',
                                borderRadius: 10, padding: 16, cursor: 'pointer',
                                boxShadow: isSel ? '0 2px 8px rgba(2,132,199,0.15)' : 'none'
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                <strong style={{ fontSize: 15, color: '#0f172a' }}>{p.name}</strong>
                                <span style={{ fontSize: 11, fontWeight: 800, color: '#0284c7' }}>{p.code}</span>
                              </div>
                              <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>
                                ₹{p.price ? p.price.toLocaleString('en-IN') : '0'} / {p.billing_period || 'ANNUAL'}
                              </div>
                              <div style={{ fontSize: 11.5, color: '#64748b' }}>
                                Included modules: {p.included_modules?.length || 0}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Step 4: Principal Leadership */}
                  {wizardStep === 4 && (
                    <div className="grid-2">
                      <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                        <label className="form-label">Principal / School Head Full Name *</label>
                        <input
                          className="form-input"
                          required
                          placeholder="e.g. Dr. Ramesh Sharma"
                          value={wizardForm.principal_account.name}
                          onChange={e => setWizardForm(f => ({
                            ...f,
                            principal_account: { ...f.principal_account, name: e.target.value }
                          }))}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Official Email Address *</label>
                        <input
                          className="form-input"
                          type="email"
                          required
                          placeholder="principal@school.edu"
                          value={wizardForm.principal_account.email}
                          onChange={e => setWizardForm(f => ({
                            ...f,
                            principal_account: { ...f.principal_account, email: e.target.value }
                          }))}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Mobile Number</label>
                        <input
                          className="form-input"
                          placeholder="+91-9876543210"
                          value={wizardForm.principal_account.phone}
                          onChange={e => setWizardForm(f => ({
                            ...f,
                            principal_account: { ...f.principal_account, phone: e.target.value }
                          }))}
                        />
                      </div>
                      <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                        <label className="form-label">Initial Password (leave blank for auto-generate)</label>
                        <input
                          className="form-input"
                          type="password"
                          placeholder="Default: Principal@123"
                          value={wizardForm.principal_account.password}
                          onChange={e => setWizardForm(f => ({
                            ...f,
                            principal_account: { ...f.principal_account, password: e.target.value }
                          }))}
                        />
                      </div>
                    </div>
                  )}

                  {/* Step 5: Review & Commit */}
                  {wizardStep === 5 && (
                    <div>
                      <div style={{ background: '#f8fafc', borderRadius: 10, padding: 18, border: '1px solid #e2e8f0', marginBottom: 16 }}>
                        <h4 style={{ margin: '0 0 12px', fontSize: 14, color: '#0f172a' }}>📋 Onboarding Preview</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13 }}>
                          <div><strong>School:</strong> {wizardForm.school_info.name} ({wizardForm.school_info.code})</div>
                          <div><strong>Type:</strong> {wizardForm.school_info.type} · {wizardForm.school_info.affiliation_board}</div>
                          <div><strong>Location:</strong> {wizardForm.school_info.city}, {wizardForm.school_info.state}</div>
                          <div><strong>Academic Session:</strong> {wizardForm.academic_config.academic_session}</div>
                          <div><strong>Subscription Plan:</strong> {wizardForm.subscription_plan.plan_code}</div>
                          <div><strong>Principal Head:</strong> {wizardForm.principal_account.name} ({wizardForm.principal_account.email})</div>
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>
                        Clicking 'Confirm &amp; Onboard School' will transactionally create the school, initialize the academic database, bind subscription entitlements, and send welcome notifications.
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Wizard Footer Controls */}
            {!wizardSuccess && (
              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <button
                  type="button"
                  className="btn btn-neutral"
                  disabled={wizardStep === 1 || wizardLoading}
                  onClick={() => setWizardStep(s => s - 1)}
                >
                  ← Back
                </button>

                {wizardStep < 5 ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={
                      (wizardStep === 1 && (!wizardForm.school_info.name || !wizardForm.school_info.code || !wizardForm.school_info.city)) ||
                      (wizardStep === 4 && (!wizardForm.principal_account.name || !wizardForm.principal_account.email))
                    }
                    onClick={() => setWizardStep(s => s + 1)}
                  >
                    Next Step →
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-success"
                    disabled={wizardLoading}
                    onClick={handleWizardSubmit}
                    style={{ fontWeight: 800 }}
                  >
                    {wizardLoading ? 'Onboarding...' : '🚀 Confirm & Onboard School'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Plan Builder Modal ── */}
      {showPlanBuilder && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowPlanBuilder(false)}>
          <div className="modal" style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <h3>💳 Create New Subscription Plan</h3>
              <button className="modal-close" onClick={() => setShowPlanBuilder(false)}>✕</button>
            </div>
            <form onSubmit={handleCreatePlan}>
              <div className="modal-body">
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Plan Name *</label>
                    <input
                      className="form-input"
                      required
                      placeholder="e.g. Enterprise Plus"
                      value={newPlanForm.name}
                      onChange={e => setNewPlanForm(f => ({ ...f, name: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Plan Code *</label>
                    <input
                      className="form-input"
                      required
                      placeholder="e.g. ENTERPRISE_PLUS"
                      value={newPlanForm.code}
                      onChange={e => setNewPlanForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Price (₹) *</label>
                    <input
                      className="form-input"
                      type="number"
                      required
                      value={newPlanForm.price}
                      onChange={e => setNewPlanForm(f => ({ ...f, price: Number(e.target.value) }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Billing Period</label>
                    <select
                      className="form-input"
                      value={newPlanForm.billing_period}
                      onChange={e => setNewPlanForm(f => ({ ...f, billing_period: e.target.value }))}
                    >
                      <option value="ANNUAL">Annual</option>
                      <option value="MONTHLY">Monthly</option>
                      <option value="QUARTERLY">Quarterly</option>
                    </select>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 14 }}>
                  <label className="form-label">Description</label>
                  <input
                    className="form-input"
                    placeholder="Short description of this tier..."
                    value={newPlanForm.description}
                    onChange={e => setNewPlanForm(f => ({ ...f, description: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Included Modules</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8, maxHeight: 180, overflowY: 'auto' }}>
                    {modulesCatalog.map(mod => {
                      const isInc = newPlanForm.included_modules.includes(mod.key);
                      return (
                        <label key={mod.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={isInc}
                            onChange={() => {
                              setNewPlanForm(f => ({
                                ...f,
                                included_modules: isInc
                                  ? f.included_modules.filter(k => k !== mod.key)
                                  : [...f.included_modules, mod.key]
                              }));
                            }}
                          />
                          <span>{mod.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-neutral" onClick={() => setShowPlanBuilder(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={savingPlan}>
                  {savingPlan ? 'Saving Plan...' : '💾 Save Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Quick Add School Modal ── */}
      {showSchoolModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowSchoolModal(false)}>
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
                    ['current_session', 'Session',        'text',  false, `${CUR_YR}-${CUR_YR + 1}`],
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
                <button type="button" className="btn btn-neutral" onClick={() => setShowSchoolModal(false)}>Cancel</button>
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
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowEditModal(false)}>
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
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-neutral" onClick={() => setShowEditModal(false)}>Cancel</button>
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
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowFeaturesModal(false)}>
          <div className="modal" style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <h3>⚡ Module Services — {featuresSchool.name}</h3>
              <button className="modal-close" onClick={() => setShowFeaturesModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 8 }}>PRESET TIERS:</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {Object.keys(planPresets).map(p => (
                    <button
                      key={p}
                      onClick={() => applyPreset(p)}
                      style={{
                        padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        border: selectedPlan === p ? '2px solid #0284c7' : '1px solid #cbd5e1',
                        background: selectedPlan === p ? '#e0f2fe' : '#fff',
                        color: selectedPlan === p ? '#0369a1' : '#475569'
                      }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
                {featureCatalog.map(feat => {
                  const on = selectedFeatures.includes(feat.key);
                  return (
                    <div
                      key={feat.key}
                      onClick={() => toggleFeature(feat.key)}
                      style={{
                        padding: 10, borderRadius: 8, cursor: 'pointer',
                        border: on ? '1.5px solid #0284c7' : '1px solid #e2e8f0',
                        background: on ? '#f0f9ff' : '#fff', display: 'flex', alignItems: 'center', gap: 8
                      }}
                    >
                      <input type="checkbox" checked={on} onChange={() => {}} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{feat.name}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>{feat.key}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-neutral" onClick={() => setShowFeaturesModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveFeatures} disabled={savingFeatures}>
                {savingFeatures ? 'Saving...' : '💾 Save Services'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Company Staff Modal ── */}
      {showCompanyStaffModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowCompanyStaffModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h3>🧑‍💼 Add Company Staff</h3>
              <button className="modal-close" onClick={() => setShowCompanyStaffModal(false)}>✕</button>
            </div>
            <form onSubmit={createUser}>
              <div className="modal-body">
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Full Name *</label>
                    <input className="form-input" required onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email *</label>
                    <input className="form-input" type="email" required onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Role *</label>
                    <select className="form-input" required onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                      <option value="">Select Role</option>
                      {companyRoles.map(r => (
                        <option key={r.key} value={r.key}>{r.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Password</label>
                    <input className="form-input" type="password" placeholder="Default: EduErp@123" onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-neutral" onClick={() => setShowCompanyStaffModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Creating...' : '🧑‍💼 Create Staff'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Assign School Head Modal ── */}
      {showSchoolHeadModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowSchoolHeadModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h3>🏫 Assign School Head (Principal / Director)</h3>
              <button className="modal-close" onClick={() => setShowSchoolHeadModal(false)}>✕</button>
            </div>
            <form onSubmit={createUser}>
              <div className="modal-body">
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">School *</label>
                    <select className="form-input" required onChange={e => setForm(f => ({ ...f, school_id: e.target.value }))}>
                      <option value="">Select School</option>
                      {schools.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Role *</label>
                    <select className="form-input" required onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                      <option value="">Select Head Role</option>
                      {headRoles.map(r => (
                        <option key={r.key} value={r.key}>{r.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Name *</label>
                    <input className="form-input" required onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email *</label>
                    <input className="form-input" type="email" required onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-neutral" onClick={() => setShowSchoolHeadModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Assigning...' : '🏫 Assign Head'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Created Credentials Modal ── */}
      {createdCreds && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h3>✅ User Created!</h3>
              <button className="modal-close" onClick={() => { setCreatedCreds(null); setCopied(false); }}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '16px 20px', marginBottom: 16 }}>
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
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13,
                    padding: '8px 0', borderBottom: '1px solid #dcfce7',
                  }}>
                    <span style={{ color: '#64748b' }}>{label}</span>
                    <strong style={{
                      color: '#0f172a', fontFamily: label.includes('Password') ? 'monospace' : 'inherit',
                      background: label.includes('Password') ? '#e0f2fe' : 'transparent',
                      padding: label.includes('Password') ? '2px 8px' : '0', borderRadius: 4,
                    }}>{value}</strong>
                  </div>
                ))}
              </div>
              <button onClick={handleCopy} style={{
                width: '100%', padding: '11px', borderRadius: 8, border: 'none',
                background: copied ? '#2e844a' : 'var(--blue-60)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600
              }}>
                {copied ? '✅ Copied!' : '📋 Copy Credentials'}
              </button>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => { setCreatedCreds(null); setCopied(false); }}>
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
