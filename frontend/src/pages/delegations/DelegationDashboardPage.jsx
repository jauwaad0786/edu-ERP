import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import CreateDelegationWizardModal from '../../components/delegations/CreateDelegationWizardModal';

export default function DelegationDashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('ederp_theme') === 'dark');
  useEffect(() => { localStorage.setItem('ederp_theme', darkMode ? 'dark' : 'light'); }, [darkMode]);

  const [loading, setLoading] = useState(true);
  const [delegations, setDelegations] = useState([]);
  const [summary, setSummary] = useState({
    total: 0,
    active: 0,
    scheduled: 0,
    expiring_soon: 0,
    expired: 0,
    revoked: 0
  });

  const [activeTab, setActiveTab] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [wizardOpen, setWizardOpen] = useState(false);

  // Sync activeTab and wizard modal with URL query parameters
  useEffect(() => {
    const urlTab = searchParams.get('tab');
    const urlAction = searchParams.get('action');

    if (urlTab) {
      setActiveTab(urlTab.toUpperCase());
    } else {
      setActiveTab('ALL');
    }

    if (urlAction === 'new' || urlAction === 'create') {
      setWizardOpen(true);
    }
  }, [searchParams]);

  // Revoke modal state
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [revokeReason, setRevokeReason] = useState('Regular teacher resumed duties');
  const [revoking, setRevoking] = useState(false);

  // Detail modal state
  const [detailTarget, setDetailTarget] = useState(null);

  const fetchDelegations = () => {
    setLoading(true);
    api.get('/principal/delegations')
      .then(res => {
        setDelegations(res.data?.delegations || []);
        if (res.data?.summary) {
          setSummary(res.data.summary);
        }
      })
      .catch(err => toast.error(err.response?.data?.error || 'Failed to load teacher delegations'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDelegations();
  }, []);

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      await api.post(`/principal/delegations/${revokeTarget.id}/revoke`, {
        reason: revokeReason || 'Manually revoked by Principal'
      });
      toast.success('Delegation revoked immediately. Temporary permissions terminated.');
      setRevokeTarget(null);
      setRevokeReason('Regular teacher resumed duties');
      fetchDelegations();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to revoke delegation');
    } finally {
      setRevoking(false);
    }
  };

  // Filtered delegations based on tab and search
  const filteredDelegations = useMemo(() => {
    return delegations.filter(d => {
      // Tab filter
      if (activeTab === 'ACTIVE' && d.status !== 'ACTIVE') return false;
      if (activeTab === 'SCHEDULED' && d.status !== 'SCHEDULED') return false;
      if (activeTab === 'EXPIRING_SOON' && !d.is_expiring_soon) return false;
      if (activeTab === 'EXPIRED' && d.status !== 'EXPIRED') return false;
      if (activeTab === 'REVOKED' && d.status !== 'REVOKED') return false;

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const srcName = (d.source_teacher?.name || '').toLowerCase();
        const delName = (d.delegate_teacher?.name || '').toLowerCase();
        const reason = (d.reason || '').toLowerCase();
        const scopesStr = (d.scopes || []).map(s => `${s.class_name} ${s.section || ''} ${s.subject_name || ''}`).join(' ').toLowerCase();
        return srcName.includes(q) || delName.includes(q) || reason.includes(q) || scopesStr.includes(q);
      }
      return true;
    });
  }, [delegations, activeTab, searchQuery]);

  const cardBg = {
    background: darkMode ? '#141b2d' : '#ffffff',
    borderColor: darkMode ? '#1e293b' : '#e2e8f0',
    color: darkMode ? '#f8fafc' : '#0f172a'
  };

  const formatDateTime = (isoStr) => {
    if (!isoStr) return '—';
    try {
      const dt = new Date(isoStr);
      return dt.toLocaleString('en-IN', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch {
      return isoStr;
    }
  };

  const getStatusBadge = (status, isExpiringSoon) => {
    if (status === 'REVOKED') {
      return (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '5px',
          padding: '4px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 700,
          background: darkMode ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2',
          color: '#ef4444'
        }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444' }} />
          REVOKED
        </span>
      );
    }
    if (status === 'EXPIRED') {
      return (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '5px',
          padding: '4px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 700,
          background: darkMode ? 'rgba(148, 163, 184, 0.15)' : '#f1f5f9',
          color: '#64748b'
        }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#94a3b8' }} />
          EXPIRED
        </span>
      );
    }
    if (status === 'SCHEDULED') {
      return (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '5px',
          padding: '4px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 700,
          background: darkMode ? 'rgba(56, 189, 248, 0.15)' : '#e0f2fe',
          color: '#0284c7'
        }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#38bdf8' }} />
          SCHEDULED
        </span>
      );
    }
    // ACTIVE
    if (isExpiringSoon) {
      return (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '5px',
          padding: '4px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 700,
          background: darkMode ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7',
          color: '#d97706'
        }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f59e0b' }} />
          EXPIRING SOON
        </span>
      );
    }
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: '5px',
        padding: '4px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 700,
        background: darkMode ? 'rgba(16, 185, 129, 0.15)' : '#d1fae5',
        color: '#059669'
      }}>
        <span style={{
          width: '6px', height: '6px', borderRadius: '50%', background: '#10b981',
          boxShadow: '0 0 8px #10b981'
        }} />
        ACTIVE
      </span>
    );
  };

  const getPermissionLabel = (code) => {
    switch (code) {
      case 'ATTENDANCE_MARK': return 'Attendance';
      case 'MARKS_ENTER': return 'Marks Entry';
      case 'STUDENT_VIEW': return 'Student Roster';
      case 'TIMETABLE_VIEW': return 'Timetable';
      case 'NOTES_MANAGE': return 'Study Notes';
      case 'FEES_COLLECT': return 'Fee Counter';
      default: return code;
    }
  };

  return (
    <div className={`app-shell${darkMode ? ' theme-dark' : ''}`}>
      <Sidebar darkMode={darkMode} />
      <div className="main-content">
        <Navbar
          title="Teacher Delegation & Temporary Access"
          darkMode={darkMode}
          onToggleDark={() => setDarkMode(d => !d)}
        />

        <div className="page-body">
          {/* ══ Hero Header Banner ══ */}
          <div style={{
            position: 'relative', overflow: 'hidden',
            borderRadius: '20px', padding: '26px 32px', marginBottom: '24px',
            background: darkMode
              ? 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 60%, #312e81 100%)'
              : 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 60%, #3b82f6 100%)',
            color: '#ffffff',
            boxShadow: '0 10px 25px -5px rgba(37,99,235,0.25)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <span style={{
                  background: 'rgba(255,255,255,0.18)', borderRadius: '10px',
                  padding: '6px 12px', fontSize: '12px', fontWeight: 700, letterSpacing: '0.05em'
                }}>
                  STAFF &amp; HRMS &bull; ZERO-ROLE-MUTATION
                </span>
              </div>
              <h1 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 6px 0', letterSpacing: '-0.02em' }}>
                Substitute Teacher Delegations
              </h1>
              <p style={{ margin: 0, fontSize: '14px', opacity: 0.88, maxWidth: '680px', lineHeight: 1.5 }}>
                Assign scoped, time-bound teaching duties (attendance, marks, notes, timetable, fees) to available substitute teachers when staff take leave. Access terminates automatically with full audit attribution.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button
                onClick={fetchDelegations}
                disabled={loading}
                style={{
                  background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)',
                  color: '#ffffff', padding: '10px 16px', borderRadius: '12px',
                  fontWeight: 600, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                  transition: 'all 0.2s'
                }}
              >
                <i className={`ti ti-refresh ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>

              <button
                onClick={() => setWizardOpen(true)}
                style={{
                  background: '#ffffff', color: '#1e3a8a', border: 'none',
                  padding: '11px 20px', borderRadius: '12px', fontWeight: 700, fontSize: '14px',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.15)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '8px', transition: 'transform 0.15s ease'
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <i className="ti ti-plus" style={{ fontSize: '16px' }} />
                Assign Substitute Teacher
              </button>
            </div>
          </div>

          {/* ══ Metrics Row ══ */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px', marginBottom: '24px'
          }}>
            {/* Active */}
            <div style={{
              ...cardBg, border: `1px solid ${cardBg.borderColor}`, borderRadius: '16px',
              padding: '20px', display: 'flex', alignItems: 'center', gap: '16px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '12px',
                background: darkMode ? 'rgba(16, 185, 129, 0.15)' : '#d1fae5',
                color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '22px'
              }}>
                <i className="ti ti-check" />
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: darkMode ? '#94a3b8' : '#64748b' }}>
                  Active Delegations
                </div>
                <div style={{ fontSize: '26px', fontWeight: 800, lineHeight: 1.2 }}>
                  {summary.active}
                </div>
              </div>
            </div>

            {/* Scheduled */}
            <div style={{
              ...cardBg, border: `1px solid ${cardBg.borderColor}`, borderRadius: '16px',
              padding: '20px', display: 'flex', alignItems: 'center', gap: '16px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '12px',
                background: darkMode ? 'rgba(56, 189, 248, 0.15)' : '#e0f2fe',
                color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '22px'
              }}>
                <i className="ti ti-calendar-time" />
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: darkMode ? '#94a3b8' : '#64748b' }}>
                  Scheduled / Upcoming
                </div>
                <div style={{ fontSize: '26px', fontWeight: 800, lineHeight: 1.2 }}>
                  {summary.scheduled}
                </div>
              </div>
            </div>

            {/* Expiring Soon */}
            <div style={{
              ...cardBg, border: `1px solid ${cardBg.borderColor}`, borderRadius: '16px',
              padding: '20px', display: 'flex', alignItems: 'center', gap: '16px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '12px',
                background: darkMode ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7',
                color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '22px'
              }}>
                <i className="ti ti-clock-hour-4" />
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: darkMode ? '#94a3b8' : '#64748b' }}>
                  Expiring Soon (&lt;24h)
                </div>
                <div style={{ fontSize: '26px', fontWeight: 800, lineHeight: 1.2 }}>
                  {summary.expiring_soon}
                </div>
              </div>
            </div>

            {/* Expired / Revoked */}
            <div style={{
              ...cardBg, border: `1px solid ${cardBg.borderColor}`, borderRadius: '16px',
              padding: '20px', display: 'flex', alignItems: 'center', gap: '16px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '12px',
                background: darkMode ? 'rgba(148, 163, 184, 0.15)' : '#f1f5f9',
                color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '22px'
              }}>
                <i className="ti ti-history" />
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: darkMode ? '#94a3b8' : '#64748b' }}>
                  Expired / Revoked
                </div>
                <div style={{ fontSize: '26px', fontWeight: 800, lineHeight: 1.2 }}>
                  {summary.expired + summary.revoked}
                </div>
              </div>
            </div>
          </div>

          {/* ══ Filter Tabs & Search Bar ══ */}
          <div style={{
            ...cardBg, border: `1px solid ${cardBg.borderColor}`, borderRadius: '16px',
            padding: '16px 20px', marginBottom: '20px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px'
          }}>
            {/* Tabs */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {[
                { id: 'ALL', label: 'All Delegations', count: summary.total },
                { id: 'ACTIVE', label: 'Active', count: summary.active },
                { id: 'SCHEDULED', label: 'Scheduled', count: summary.scheduled },
                { id: 'EXPIRING_SOON', label: 'Expiring Soon', count: summary.expiring_soon },
                { id: 'EXPIRED', label: 'Expired', count: summary.expired },
                { id: 'REVOKED', label: 'Revoked', count: summary.revoked },
              ].map(tab => {
                const isSelected = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setSearchParams(tab.id === 'ALL' ? {} : { tab: tab.id });
                    }}
                    style={{
                      padding: '8px 14px', borderRadius: '10px', fontSize: '13px', fontWeight: 600,
                      cursor: 'pointer', border: 'none', transition: 'all 0.15s',
                      background: isSelected
                        ? (darkMode ? '#3b82f6' : '#2563eb')
                        : (darkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9'),
                      color: isSelected ? '#ffffff' : (darkMode ? '#cbd5e1' : '#475569')
                    }}
                  >
                    {tab.label}
                    {tab.count > 0 && (
                      <span style={{
                        marginLeft: '6px', padding: '2px 6px', borderRadius: '999px',
                        fontSize: '11px', fontWeight: 700,
                        background: isSelected ? 'rgba(255,255,255,0.25)' : (darkMode ? 'rgba(255,255,255,0.12)' : '#e2e8f0'),
                        color: isSelected ? '#ffffff' : (darkMode ? '#94a3b8' : '#64748b')
                      }}>
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Search */}
            <div style={{ position: 'relative', minWidth: '260px' }}>
              <i className="ti ti-search" style={{
                position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
                color: darkMode ? '#94a3b8' : '#94a3b8'
              }} />
              <input
                type="text"
                placeholder="Search teacher, class, reason..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  width: '100%', padding: '9px 12px 9px 36px', borderRadius: '10px',
                  border: `1px solid ${cardBg.borderColor}`, fontSize: '13px',
                  background: darkMode ? '#0f172a' : '#f8fafc',
                  color: cardBg.color, outline: 'none'
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '14px'
                  }}
                >
                  &times;
                </button>
              )}
            </div>
          </div>

          {/* ══ Delegations List / Table ══ */}
          <div style={{
            ...cardBg, border: `1px solid ${cardBg.borderColor}`, borderRadius: '16px',
            overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}>
            {loading ? (
              <div style={{ padding: '60px', textAlign: 'center', color: darkMode ? '#94a3b8' : '#64748b' }}>
                <i className="ti ti-loader animate-spin" style={{ fontSize: '32px', marginBottom: '12px' }} />
                <p style={{ margin: 0, fontSize: '14px' }}>Loading teacher delegations...</p>
              </div>
            ) : filteredDelegations.length === 0 ? (
              <div style={{ padding: '60px 20px', textAlign: 'center', color: darkMode ? '#94a3b8' : '#64748b' }}>
                <div style={{
                  width: '64px', height: '64px', borderRadius: '16px', margin: '0 auto 16px auto',
                  background: darkMode ? 'rgba(255,255,255,0.05)' : '#f1f5f9',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px'
                }}>
                  <i className="ti ti-switch-horizontal" />
                </div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 6px 0', color: cardBg.color }}>
                  No Delegations Found
                </h3>
                <p style={{ fontSize: '13px', margin: '0 0 16px 0', maxWidth: '400px', marginInline: 'auto' }}>
                  {searchQuery || activeTab !== 'ALL'
                    ? 'No delegation matches your selected filters or search keyword.'
                    : 'No teacher delegations have been scheduled yet. Click below to assign a substitute.'}
                </p>
                {activeTab === 'ALL' && !searchQuery && (
                  <button
                    onClick={() => setWizardOpen(true)}
                    style={{
                      background: '#2563eb', color: '#ffffff', border: 'none',
                      padding: '9px 18px', borderRadius: '10px', fontWeight: 600, fontSize: '13px',
                      cursor: 'pointer'
                    }}
                  >
                    + Create First Delegation
                  </button>
                )}
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{
                      borderBottom: `1px solid ${cardBg.borderColor}`,
                      background: darkMode ? '#101726' : '#f8fafc',
                      color: darkMode ? '#94a3b8' : '#64748b',
                      fontWeight: 600, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em'
                    }}>
                      <th style={{ padding: '14px 18px' }}>Absent &bull; Substitute</th>
                      <th style={{ padding: '14px 18px' }}>Scope &bull; Subject</th>
                      <th style={{ padding: '14px 18px' }}>Permissions</th>
                      <th style={{ padding: '14px 18px' }}>Validity Window</th>
                      <th style={{ padding: '14px 18px' }}>Status</th>
                      <th style={{ padding: '14px 18px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDelegations.map(del => {
                      const isActive = del.status === 'ACTIVE';
                      const isScheduled = del.status === 'SCHEDULED';
                      return (
                        <tr
                          key={del.id}
                          style={{
                            borderBottom: `1px solid ${cardBg.borderColor}`,
                            transition: 'background 0.15s'
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.03)' : '#f8fafc'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          {/* Teachers */}
                          <td style={{ padding: '16px 18px', verticalAlign: 'middle' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div>
                                <div style={{ fontWeight: 700, color: cardBg.color }}>
                                  {del.source_teacher?.name || 'Absent Teacher'}
                                </div>
                                <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                                  Absent ({del.reason})
                                </div>
                              </div>

                              <div style={{
                                width: '28px', height: '28px', borderRadius: '50%',
                                background: darkMode ? '#1e293b' : '#e2e8f0',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: '#2563eb', fontSize: '14px', flexShrink: 0
                              }}>
                                <i className="ti ti-arrow-right" />
                              </div>

                              <div>
                                <div style={{ fontWeight: 700, color: '#2563eb' }}>
                                  {del.delegate_teacher?.name || 'Substitute'}
                                </div>
                                <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                                  Substitute Teacher
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Scopes */}
                          <td style={{ padding: '16px 18px', verticalAlign: 'middle' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {(del.scopes || []).map((sc, idx) => (
                                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{
                                    padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 600,
                                    background: darkMode ? 'rgba(99, 102, 241, 0.15)' : '#e0e7ff',
                                    color: '#4f46e5'
                                  }}>
                                    {sc.class_name} {sc.section || ''}
                                  </span>
                                  <span style={{ fontSize: '12px', color: cardBg.color }}>
                                    {sc.subject_name || <em style={{ color: '#94a3b8' }}>All Subjects</em>}
                                  </span>
                                </div>
                              ))}
                              {(!del.scopes || del.scopes.length === 0) && (
                                <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '12px' }}>
                                  All assigned classes
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Permissions */}
                          <td style={{ padding: '16px 18px', verticalAlign: 'middle' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '240px' }}>
                              {(del.permissions || []).map(p => (
                                <span
                                  key={p}
                                  style={{
                                    padding: '2px 7px', borderRadius: '6px', fontSize: '11px', fontWeight: 600,
                                    background: darkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
                                    color: darkMode ? '#cbd5e1' : '#475569'
                                  }}
                                >
                                  {getPermissionLabel(p)}
                                </span>
                              ))}
                            </div>
                          </td>

                          {/* Validity Window */}
                          <td style={{ padding: '16px 18px', verticalAlign: 'middle' }}>
                            <div style={{ fontSize: '12px' }}>
                              <div style={{ fontWeight: 600, color: cardBg.color }}>
                                {formatDateTime(del.starts_at)}
                              </div>
                              <div style={{ color: '#94a3b8', fontSize: '11px' }}>
                                to {formatDateTime(del.expires_at)}
                              </div>
                              {isActive && (
                                <div style={{
                                  marginTop: '3px', fontSize: '11px', fontWeight: 700,
                                  color: del.is_expiring_soon ? '#d97706' : '#10b981'
                                }}>
                                  {del.is_expiring_soon ? '⚠️ Ends in < 24h' : '● In Effect'}
                                </div>
                              )}
                              {isScheduled && (
                                <div style={{ marginTop: '3px', fontSize: '11px', fontWeight: 700, color: '#0284c7' }}>
                                  🕒 Upcoming Window
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Status */}
                          <td style={{ padding: '16px 18px', verticalAlign: 'middle' }}>
                            {getStatusBadge(del.status, del.is_expiring_soon)}
                          </td>

                          {/* Actions */}
                          <td style={{ padding: '16px 18px', verticalAlign: 'middle', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}>
                              <button
                                onClick={() => setDetailTarget(del)}
                                title="View Delegation Details"
                                style={{
                                  padding: '6px 10px', borderRadius: '8px', border: `1px solid ${cardBg.borderColor}`,
                                  background: darkMode ? '#1e293b' : '#f8fafc',
                                  color: cardBg.color, fontSize: '12px', fontWeight: 600,
                                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
                                }}
                              >
                                <i className="ti ti-eye" />
                                Details
                              </button>

                              {(isActive || isScheduled) && (
                                <button
                                  onClick={() => setRevokeTarget(del)}
                                  title="Revoke Delegation Immediately"
                                  style={{
                                    padding: '6px 10px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)',
                                    background: darkMode ? 'rgba(239, 68, 68, 0.1)' : '#fef2f2',
                                    color: '#ef4444', fontSize: '12px', fontWeight: 600,
                                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
                                  }}
                                >
                                  <i className="ti ti-shield-x" />
                                  Revoke
                                </button>
                              )}
                            </div>
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

      {/* ══ Create Wizard Modal ══ */}
      <CreateDelegationWizardModal
        isOpen={wizardOpen}
        onClose={() => {
          setWizardOpen(false);
          if (searchParams.get('action')) {
            const currentTab = searchParams.get('tab');
            setSearchParams(currentTab ? { tab: currentTab } : {});
          }
        }}
        onSuccess={() => {
          setWizardOpen(false);
          if (searchParams.get('action')) {
            const currentTab = searchParams.get('tab');
            setSearchParams(currentTab ? { tab: currentTab } : {});
          }
          fetchDelegations();
        }}
      />

      {/* ══ Revoke Confirmation Modal ══ */}
      {revokeTarget && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{
            ...cardBg, border: `1px solid ${cardBg.borderColor}`, borderRadius: '18px',
            width: '100%', maxWidth: '480px', padding: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            animation: 'scaleUp 0.15s ease'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{
                width: '44px', height: '44px', borderRadius: '12px',
                background: darkMode ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2',
                color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '22px'
              }}>
                <i className="ti ti-alert-triangle" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>
                  Revoke Substitute Access?
                </h3>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                  Immediate cancellation of temporary authorization
                </div>
              </div>
            </div>

            <p style={{ fontSize: '13px', lineHeight: 1.5, marginBottom: '16px', color: darkMode ? '#cbd5e1' : '#475569' }}>
              This will instantly revoke temporary teaching permissions from <strong>{revokeTarget.delegate_teacher?.name}</strong> for classes delegated by <strong>{revokeTarget.source_teacher?.name}</strong>. Their access to student attendance and mark entry will terminate immediately.
            </p>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                Revocation Reason (Recorded for Audit)
              </label>
              <input
                type="text"
                value={revokeReason}
                onChange={e => setRevokeReason(e.target.value)}
                placeholder="e.g. Regular teacher returned early"
                style={{
                  width: '100%', padding: '9px 12px', borderRadius: '8px',
                  border: `1px solid ${cardBg.borderColor}`, fontSize: '13px',
                  background: darkMode ? '#0f172a' : '#f8fafc',
                  color: cardBg.color, outline: 'none'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                disabled={revoking}
                onClick={() => setRevokeTarget(null)}
                style={{
                  padding: '9px 16px', borderRadius: '8px', border: `1px solid ${cardBg.borderColor}`,
                  background: 'transparent', color: cardBg.color, fontSize: '13px', fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Keep Active
              </button>
              <button
                type="button"
                disabled={revoking}
                onClick={handleRevoke}
                style={{
                  padding: '9px 18px', borderRadius: '8px', border: 'none',
                  background: '#ef4444', color: '#ffffff', fontSize: '13px', fontWeight: 700,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                {revoking ? <i className="ti ti-loader animate-spin" /> : <i className="ti ti-shield-x" />}
                {revoking ? 'Revoking...' : 'Confirm Revoke Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Delegation Detail Modal ══ */}
      {detailTarget && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{
            ...cardBg, border: `1px solid ${cardBg.borderColor}`, borderRadius: '20px',
            width: '100%', maxWidth: '600px', padding: '26px', boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            maxHeight: '90vh', overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '40px', height: '40px', borderRadius: '10px',
                  background: darkMode ? 'rgba(37, 99, 235, 0.2)' : '#dbeafe',
                  color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '20px'
                }}>
                  <i className="ti ti-switch-horizontal" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
                    Delegation Audit Record #{detailTarget.id}
                  </h3>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                    Created on {formatDateTime(detailTarget.created_at)}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setDetailTarget(null)}
                style={{
                  background: 'none', border: 'none', color: '#94a3b8',
                  fontSize: '22px', cursor: 'pointer', padding: '4px'
                }}
              >
                &times;
              </button>
            </div>

            {/* Status & Validity Banner */}
            <div style={{
              background: darkMode ? '#1e293b' : '#f8fafc',
              border: `1px solid ${cardBg.borderColor}`, borderRadius: '12px',
              padding: '14px 18px', marginBottom: '18px', display: 'flex',
              justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600 }}>
                  Current Status
                </div>
                <div style={{ marginTop: '4px' }}>
                  {getStatusBadge(detailTarget.status, detailTarget.is_expiring_soon)}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600 }}>
                  Validity Window
                </div>
                <div style={{ fontSize: '13px', fontWeight: 700, marginTop: '2px', color: cardBg.color }}>
                  {formatDateTime(detailTarget.starts_at)} &rarr; {formatDateTime(detailTarget.expires_at)}
                </div>
              </div>
            </div>

            {/* Teachers Card */}
            <div style={{
              border: `1px solid ${cardBg.borderColor}`, borderRadius: '12px',
              padding: '16px', marginBottom: '18px', display: 'grid', gridTemplateColumns: '1fr auto 1fr',
              gap: '12px', alignItems: 'center'
            }}>
              <div>
                <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>ABSENT TEACHER</div>
                <div style={{ fontSize: '15px', fontWeight: 700, marginTop: '2px', color: cardBg.color }}>
                  {detailTarget.source_teacher?.name}
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                  {detailTarget.source_teacher?.email}
                </div>
              </div>
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%',
                background: darkMode ? '#334155' : '#e2e8f0',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb'
              }}>
                <i className="ti ti-arrow-right" />
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>SUBSTITUTE TEACHER</div>
                <div style={{ fontSize: '15px', fontWeight: 700, marginTop: '2px', color: '#2563eb' }}>
                  {detailTarget.delegate_teacher?.name}
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                  {detailTarget.delegate_teacher?.email}
                </div>
              </div>
            </div>

            {/* Delegated Scopes */}
            <div style={{ marginBottom: '18px' }}>
              <h4 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '8px', color: cardBg.color }}>
                Delegated Classes &amp; Subjects
              </h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {(detailTarget.scopes || []).map((sc, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '8px 12px', borderRadius: '8px',
                      background: darkMode ? '#1e293b' : '#f1f5f9',
                      border: `1px solid ${cardBg.borderColor}`, fontSize: '12px'
                    }}
                  >
                    <strong>{sc.class_name} {sc.section || ''}</strong>
                    <span style={{ color: '#94a3b8', marginLeft: '6px' }}>
                      ({sc.subject_name || 'All Subjects'})
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Delegated Permissions */}
            <div style={{ marginBottom: '18px' }}>
              <h4 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '8px', color: cardBg.color }}>
                Granted Permissions
              </h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {(detailTarget.permissions || []).map(p => (
                  <span
                    key={p}
                    style={{
                      padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
                      background: darkMode ? 'rgba(37,99,235,0.15)' : '#dbeafe',
                      color: '#2563eb'
                    }}
                  >
                    {getPermissionLabel(p)}
                  </span>
                ))}
              </div>
            </div>

            {/* Reason & Notes */}
            <div style={{
              background: darkMode ? '#1e293b' : '#f8fafc',
              border: `1px solid ${cardBg.borderColor}`, borderRadius: '12px',
              padding: '14px', marginBottom: '18px', fontSize: '12px'
            }}>
              <div><strong>Absence Reason:</strong> {detailTarget.reason || 'Not specified'}</div>
              {detailTarget.notes && (
                <div style={{ marginTop: '4px' }}>
                  <strong>Operational Notes:</strong> {detailTarget.notes}
                </div>
              )}
              {detailTarget.status === 'REVOKED' && (
                <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: `1px solid ${cardBg.borderColor}`, color: '#ef4444' }}>
                  <strong>Revocation Details:</strong> Revoked at {formatDateTime(detailTarget.revoked_at)}
                  {detailTarget.revoke_reason && ` - "${detailTarget.revoke_reason}"`}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDetailTarget(null)}
                style={{
                  padding: '8px 18px', borderRadius: '8px', border: 'none',
                  background: '#2563eb', color: '#ffffff', fontSize: '13px', fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
