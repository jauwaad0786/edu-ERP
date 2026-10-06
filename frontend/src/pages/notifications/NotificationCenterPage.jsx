import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const CATEGORIES = [
  { id: 'ALL', label: 'All Categories', icon: 'ti-apps' },
  { id: 'GENERAL', label: 'General', icon: 'ti-info-circle' },
  { id: 'FEES', label: 'Fees & Finance', icon: 'ti-currency-rupee' },
  { id: 'ATTENDANCE', label: 'Attendance', icon: 'ti-calendar-check' },
  { id: 'EXAMS', label: 'Exams & Schedules', icon: 'ti-notebook' },
  { id: 'RESULTS', label: 'Results & RMS', icon: 'ti-award' },
  { id: 'HOSTEL', label: 'Hostel', icon: 'ti-building' },
  { id: 'TRANSPORT', label: 'Transport & GPS', icon: 'ti-bus' },
  { id: 'HRMS', label: 'HRMS & Payroll', icon: 'ti-briefcase' },
  { id: 'ADMISSION', label: 'Admissions', icon: 'ti-user-plus' },
  { id: 'COMMUNICATION', label: 'Announcements', icon: 'ti-speakerphone' },
];

const PRIORITY_BADGES = {
  LOW: { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' },
  MEDIUM: { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },
  HIGH: { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' },
  CRITICAL: { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' },
};

export default function NotificationCenterPage() {
  const [darkMode] = useState(() => localStorage.getItem('ederp_theme') === 'dark');
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState('overview');

  // Overview Stats
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // History State
  const [history, setHistory] = useState([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyCategory, setHistoryCategory] = useState('ALL');
  const [historyPriority, setHistoryPriority] = useState('ALL');
  const [historySearch, setHistorySearch] = useState('');
  const [historyLoading, setHistoryLoading] = useState(false);

  // Compose State
  const [composeData, setComposeData] = useState({
    title: '',
    message: '',
    category: 'GENERAL',
    priority: 'MEDIUM',
    deep_link: '',
    channels: ['in_app', 'push'],
    target_type: 'ALL',
    roles: ['TEACHERS', 'STUDENTS', 'PARENTS', 'STAFF'],
    class_ids: [],
    scheduled_at: '',
  });
  const [classesList, setClassesList] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Template Library State
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);

  // Rules State
  const [rules, setRules] = useState([]);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);

  // Delivery Logs State
  const [logs, setLogs] = useState([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsPage, setLogsPage] = useState(1);
  const [logsStatusFilter, setLogsStatusFilter] = useState('ALL');
  const [logsLoading, setLogsLoading] = useState(false);

  // Registered Devices State
  const [devices, setDevices] = useState([]);
  const [devicesTotal, setDevicesTotal] = useState(0);
  const [devicesPage, setDevicesPage] = useState(1);
  const [devicesPlatform, setDevicesPlatform] = useState('ALL');
  const [devicesLoading, setDevicesLoading] = useState(false);

  // Preferences State
  const [preferences, setPreferences] = useState([]);
  const [prefLoading, setPrefLoading] = useState(false);
  const [quietHours, setQuietHours] = useState({ start: '22:00', end: '07:00' });

  // ── 1. Fetch Stats ──
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await api.get('/notification-center/stats');
      setStats(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // ── 2. Fetch History ──
  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const params = {
        page: historyPage,
        per_page: 15,
        category: historyCategory,
        priority: historyPriority,
        search: historySearch,
      };
      const res = await api.get('/notification-center/history', { params });
      setHistory(res.data.data || []);
      setHistoryTotal(res.data.total || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setHistoryLoading(false);
    }
  }, [historyPage, historyCategory, historyPriority, historySearch]);

  // ── 3. Fetch Templates ──
  const fetchTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    try {
      const res = await api.get('/notification-center/templates');
      setTemplates(res.data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setTemplatesLoading(false);
    }
  }, []);

  // ── 4. Fetch Rules ──
  const fetchRules = useCallback(async () => {
    setRulesLoading(true);
    try {
      const res = await api.get('/notification-center/rules');
      setRules(res.data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setRulesLoading(false);
    }
  }, []);

  // ── 5. Fetch Delivery Logs ──
  const fetchLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const params = { page: logsPage, per_page: 20, status: logsStatusFilter };
      const res = await api.get('/notification-center/logs', { params });
      setLogs(res.data.data || []);
      setLogsTotal(res.data.total || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLogsLoading(false);
    }
  }, [logsPage, logsStatusFilter]);

  // ── 6. Fetch Devices ──
  const fetchDevices = useCallback(async () => {
    setDevicesLoading(true);
    try {
      const params = { page: devicesPage, per_page: 20, platform: devicesPlatform };
      const res = await api.get('/notification-center/devices', { params });
      setDevices(res.data.data || []);
      setDevicesTotal(res.data.total || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setDevicesLoading(false);
    }
  }, [devicesPage, devicesPlatform]);

  // ── 7. Fetch Preferences ──
  const fetchPreferences = useCallback(async () => {
    setPrefLoading(true);
    try {
      const res = await api.get('/notification-center/preferences');
      const data = res.data.data || [];
      setPreferences(data);
      if (data.length > 0 && data[0].quiet_hours_start) {
        setQuietHours({
          start: data[0].quiet_hours_start || '22:00',
          end: data[0].quiet_hours_end || '07:00',
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setPrefLoading(false);
    }
  }, []);

  // ── Fetch Classes for Compose selector ──
  useEffect(() => {
    api.get('/classes')
      .then(res => setClassesList(res.data || []))
      .catch(() => {});
  }, []);

  // Trigger loads based on active tab
  useEffect(() => {
    if (activeTab === 'overview') fetchStats();
    if (activeTab === 'history') fetchHistory();
    if (activeTab === 'templates') fetchTemplates();
    if (activeTab === 'rules') { fetchRules(); fetchTemplates(); }
    if (activeTab === 'logs') fetchLogs();
    if (activeTab === 'devices') fetchDevices();
    if (activeTab === 'preferences') fetchPreferences();
  }, [activeTab, fetchStats, fetchHistory, fetchTemplates, fetchRules, fetchLogs, fetchDevices, fetchPreferences]);

  // ── Send Compose Handler ──
  const handleSendCompose = async (e) => {
    e.preventDefault();
    if (!composeData.title.trim() || !composeData.message.trim()) {
      toast.error('Title and message are required');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        ...composeData,
        roles: composeData.roles,
        class_ids: composeData.class_ids,
        channels: composeData.channels,
      };
      const res = await api.post('/notification-center/send', payload);
      toast.success(res.data.message || 'Notification sent successfully!');
      setComposeData({
        title: '',
        message: '',
        category: 'GENERAL',
        priority: 'MEDIUM',
        deep_link: '',
        channels: ['in_app', 'push'],
        target_type: 'ALL',
        roles: ['TEACHERS', 'STUDENTS', 'PARENTS', 'STAFF'],
        class_ids: [],
        scheduled_at: '',
      });
      setActiveTab('history');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send notification');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Rule Toggle ──
  const handleToggleRule = async (ruleId) => {
    try {
      const res = await api.patch(`/notification-center/rules/${ruleId}/toggle`);
      toast.success(res.data.message);
      fetchRules();
    } catch (err) {
      toast.error('Failed to toggle rule');
    }
  };

  // Styles
  const cardBg = {
    background: darkMode ? '#1e293b' : '#ffffff',
    border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
    borderRadius: '12px',
    boxShadow: darkMode ? '0 4px 6px -1px rgba(0, 0, 0, 0.4)' : '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
  };

  const navTabStyle = (key) => ({
    padding: '10px 18px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: activeTab === key ? (darkMode ? '#3b82f6' : '#2563eb') : 'transparent',
    color: activeTab === key ? '#ffffff' : (darkMode ? '#94a3b8' : '#64748b'),
    transition: 'all 0.15s ease',
  });

  return (
    <div className={`app-shell${darkMode ? ' theme-dark' : ''}`}>
      <Sidebar darkMode={darkMode} />
      <div className="main-content">
        <Navbar title="Notification Management Center" darkMode={darkMode} onToggleDark={() => {}} />
        <div className="page-body" style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto' }}>

          {/* Header Banner */}
          <div style={{
            ...cardBg,
            padding: '24px 28px',
            marginBottom: '20px',
            background: darkMode
              ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'
              : 'linear-gradient(135deg, #eff6ff 0%, #ffffff 100%)',
            borderLeft: '6px solid #2563eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{
                  padding: '8px',
                  background: '#2563eb',
                  color: '#fff',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <i className="ti ti-bell-ringing" style={{ fontSize: '22px' }} />
                </span>
                <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: darkMode ? '#f8fafc' : '#0f172a' }}>
                  Notification Management Center
                </h1>
              </div>
              <p style={{ margin: '6px 0 0 0', fontSize: '13.5px', color: darkMode ? '#94a3b8' : '#64748b' }}>
                Event-driven multi-tenant broadcast hub with Expo mobile push, web PWA push, automated workflows, and delivery auditing.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setActiveTab('compose')}
                className="btn btn-primary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 18px',
                  fontWeight: 600,
                  fontSize: '13.5px',
                  borderRadius: '8px',
                  background: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
                }}
              >
                <i className="ti ti-send" /> Compose Notification
              </button>
            </div>
          </div>

          {/* Tab Navigation Navigation Bar */}
          <div style={{
            display: 'flex',
            gap: '6px',
            overflowX: 'auto',
            paddingBottom: '8px',
            marginBottom: '20px',
            borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
          }}>
            <button style={navTabStyle('overview')} onClick={() => setActiveTab('overview')}>
              <i className="ti ti-dashboard" /> Overview
            </button>
            <button style={navTabStyle('compose')} onClick={() => setActiveTab('compose')}>
              <i className="ti ti-send" /> Compose Broadcast
            </button>
            <button style={navTabStyle('history')} onClick={() => setActiveTab('history')}>
              <i className="ti ti-history" /> History & Feed
            </button>
            <button style={navTabStyle('templates')} onClick={() => setActiveTab('templates')}>
              <i className="ti ti-template" /> Templates
            </button>
            <button style={navTabStyle('rules')} onClick={() => setActiveTab('rules')}>
              <i className="ti ti-cpu" /> Automation Rules
            </button>
            <button style={navTabStyle('logs')} onClick={() => setActiveTab('logs')}>
              <i className="ti ti-receipt" /> Delivery Logs
            </button>
            <button style={navTabStyle('devices')} onClick={() => setActiveTab('devices')}>
              <i className="ti ti-devices" /> Push Devices
            </button>
            <button style={navTabStyle('preferences')} onClick={() => setActiveTab('preferences')}>
              <i className="ti ti-adjustments" /> User Preferences
            </button>
            <button style={navTabStyle('push-status')} onClick={() => setActiveTab('push-status')}>
              <i className="ti ti-antenna" /> Push Gateways
            </button>
          </div>

          {/* ══════════ TAB 1: OVERVIEW & ANALYTICS ══════════ */}
          {activeTab === 'overview' && (
            <div>
              {statsLoading ? (
                <div style={{ textAlign: 'center', padding: '60px' }}>Loading real-time stats...</div>
              ) : stats && (
                <>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '16px',
                    marginBottom: '24px'
                  }}>
                    {/* Sent Today */}
                    <div style={{ ...cardBg, padding: '20px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: darkMode ? '#94a3b8' : '#64748b' }}>
                          Sent Today
                        </span>
                        <span style={{ padding: '8px', background: '#dbeafe', color: '#1d4ed8', borderRadius: '8px' }}>
                          <i className="ti ti-calendar-event" style={{ fontSize: '18px' }} />
                        </span>
                      </div>
                      <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '12px', color: darkMode ? '#f8fafc' : '#0f172a' }}>
                        {stats.sent_today}
                      </div>
                      <div style={{ fontSize: '12px', color: '#10b981', marginTop: '4px', fontWeight: 500 }}>
                        Active notifications dispatched
                      </div>
                    </div>

                    {/* Delivery Rate */}
                    <div style={{ ...cardBg, padding: '20px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: darkMode ? '#94a3b8' : '#64748b' }}>
                          Delivery Success Rate
                        </span>
                        <span style={{ padding: '8px', background: '#dcfce7', color: '#15803d', borderRadius: '8px' }}>
                          <i className="ti ti-circle-check" style={{ fontSize: '18px' }} />
                        </span>
                      </div>
                      <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '12px', color: '#10b981' }}>
                        {stats.delivery_rate}%
                      </div>
                      <div style={{ fontSize: '12px', color: darkMode ? '#94a3b8' : '#64748b', marginTop: '4px' }}>
                        Based on last 7 days audit logs
                      </div>
                    </div>

                    {/* Active Push Devices */}
                    <div style={{ ...cardBg, padding: '20px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: darkMode ? '#94a3b8' : '#64748b' }}>
                          Push Devices Registered
                        </span>
                        <span style={{ padding: '8px', background: '#fae8ff', color: '#86198f', borderRadius: '8px' }}>
                          <i className="ti ti-device-mobile" style={{ fontSize: '18px' }} />
                        </span>
                      </div>
                      <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '12px', color: darkMode ? '#f8fafc' : '#0f172a' }}>
                        {stats.active_devices}
                      </div>
                      <div style={{ fontSize: '12px', color: darkMode ? '#94a3b8' : '#64748b', marginTop: '4px' }}>
                        Mobile App & PWA endpoints
                      </div>
                    </div>

                    {/* Pending Scheduled */}
                    <div style={{ ...cardBg, padding: '20px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: darkMode ? '#94a3b8' : '#64748b' }}>
                          Scheduled in Queue
                        </span>
                        <span style={{ padding: '8px', background: '#ffedd5', color: '#c2410c', borderRadius: '8px' }}>
                          <i className="ti ti-clock" style={{ fontSize: '18px' }} />
                        </span>
                      </div>
                      <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '12px', color: '#f59e0b' }}>
                        {stats.pending_scheduled}
                      </div>
                      <div style={{ fontSize: '12px', color: darkMode ? '#94a3b8' : '#64748b', marginTop: '4px' }}>
                        Worker runner every 60s
                      </div>
                    </div>
                  </div>

                  {/* Device Platforms & Quick Action Card */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', flexWrap: 'wrap' }}>
                    <div style={{ ...cardBg, padding: '22px' }}>
                      <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 16px 0' }}>
                        Device Platform Breakdown
                      </h3>
                      <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                        {Object.entries(stats.platform_breakdown || {}).map(([p, cnt]) => (
                          <div key={p} style={{
                            padding: '12px 18px',
                            borderRadius: '10px',
                            background: darkMode ? '#0f172a' : '#f8fafc',
                            border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            minWidth: '130px'
                          }}>
                            <i className={p === 'android' ? 'ti ti-brand-android' : p === 'ios' ? 'ti ti-brand-apple' : 'ti ti-browser'}
                              style={{ fontSize: '22px', color: p === 'android' ? '#10b981' : p === 'ios' ? '#64748b' : '#3b82f6' }} />
                            <div>
                              <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, color: '#64748b' }}>
                                {p}
                              </div>
                              <div style={{ fontSize: '18px', fontWeight: 800 }}>{cnt}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div style={{ ...cardBg, padding: '22px' }}>
                      <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 16px 0' }}>
                        Quick Actions
                      </h3>
                      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => setActiveTab('compose')}
                          style={{
                            padding: '10px 16px',
                            borderRadius: '8px',
                            background: '#2563eb',
                            color: '#fff',
                            border: 'none',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}>
                          <i className="ti ti-plus" /> New Broadcast
                        </button>
                        <button
                          onClick={() => setActiveTab('templates')}
                          style={{
                            padding: '10px 16px',
                            borderRadius: '8px',
                            background: darkMode ? '#334155' : '#e2e8f0',
                            color: darkMode ? '#f8fafc' : '#0f172a',
                            border: 'none',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}>
                          <i className="ti ti-template" /> View Templates
                        </button>
                        <button
                          onClick={() => setActiveTab('rules')}
                          style={{
                            padding: '10px 16px',
                            borderRadius: '8px',
                            background: darkMode ? '#334155' : '#e2e8f0',
                            color: darkMode ? '#f8fafc' : '#0f172a',
                            border: 'none',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}>
                          <i className="ti ti-settings" /> Automated Rules
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ══════════ TAB 2: COMPOSE & BROADCAST ══════════ */}
          {activeTab === 'compose' && (
            <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '24px' }}>
              <div style={{ ...cardBg, padding: '24px' }}>
                <h3 style={{ fontSize: '17px', fontWeight: 700, margin: '0 0 18px 0' }}>
                  Compose & Send Notification
                </h3>

                <form onSubmit={handleSendCompose} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  {/* Template Picker Preset */}
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                      ⚡ Pre-Fill from Template (Optional)
                    </label>
                    <select
                      className="form-select"
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: `1px solid ${darkMode ? '#334155' : '#cbd5e1'}`, background: darkMode ? '#0f172a' : '#fff', color: darkMode ? '#fff' : '#000' }}
                      onChange={(e) => {
                        const tCode = e.target.value;
                        const tpl = templates.find(t => t.code === tCode);
                        if (tpl) {
                          setComposeData(prev => ({
                            ...prev,
                            title: tpl.title_template,
                            message: tpl.body_template,
                            category: tpl.category,
                            priority: tpl.default_priority,
                            deep_link: tpl.deep_link_template || '',
                          }));
                        }
                      }}
                    >
                      <option value="">-- Choose a template to prefill --</option>
                      {templates.map(t => (
                        <option key={t.code} value={t.code}>{t.name} ({t.code})</option>
                      ))}
                    </select>
                  </div>

                  {/* Target Audience */}
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
                      Target Audience
                    </label>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      {['ALL', 'ROLE', 'CLASS'].map(type => (
                        <label key={type} style={{
                          padding: '8px 16px',
                          borderRadius: '8px',
                          border: `1px solid ${composeData.target_type === type ? '#2563eb' : (darkMode ? '#334155' : '#e2e8f0')}`,
                          background: composeData.target_type === type ? (darkMode ? '#1e3a8a' : '#eff6ff') : 'transparent',
                          cursor: 'pointer',
                          fontSize: '13px',
                          fontWeight: 600
                        }}>
                          <input
                            type="radio"
                            name="target_type"
                            value={type}
                            checked={composeData.target_type === type}
                            onChange={() => setComposeData(c => ({ ...c, target_type: type }))}
                            style={{ marginRight: '6px' }}
                          />
                          {type === 'ALL' ? 'Entire School' : type === 'ROLE' ? 'Specific Roles' : 'By Class / Grade'}
                        </label>
                      ))}
                    </div>

                    {/* Roles Checkboxes */}
                    {composeData.target_type === 'ROLE' && (
                      <div style={{ marginTop: '12px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                        {['TEACHERS', 'STUDENTS', 'PARENTS', 'STAFF'].map(role => (
                          <label key={role} style={{ fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <input
                              type="checkbox"
                              checked={composeData.roles.includes(role)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setComposeData(c => ({ ...c, roles: [...c.roles, role] }));
                                } else {
                                  setComposeData(c => ({ ...c, roles: c.roles.filter(r => r !== role) }));
                                }
                              }}
                            />
                            {role}
                          </label>
                        ))}
                      </div>
                    )}

                    {/* Class Selector */}
                    {composeData.target_type === 'CLASS' && (
                      <div style={{ marginTop: '12px' }}>
                        <select
                          className="form-select"
                          multiple
                          style={{ width: '100%', height: '90px', padding: '8px', borderRadius: '8px' }}
                          value={composeData.class_ids.map(String)}
                          onChange={(e) => {
                            const selected = Array.from(e.target.selectedOptions, o => Number(o.value));
                            setComposeData(c => ({ ...c, class_ids: selected }));
                          }}
                        >
                          {classesList.map(cls => (
                            <option key={cls.id} value={cls.id}>{cls.name} {cls.section || ''}</option>
                          ))}
                        </select>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>Hold Ctrl/Cmd to select multiple classes. Parents are automatically included.</span>
                      </div>
                    )}
                  </div>

                  {/* Title */}
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                      Notification Title *
                    </label>
                    <input
                      className="form-control"
                      value={composeData.title}
                      placeholder="e.g. Fee Reminder: October Term"
                      maxLength={200}
                      onChange={e => setComposeData(c => ({ ...c, title: e.target.value }))}
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: `1px solid ${darkMode ? '#334155' : '#cbd5e1'}`, background: darkMode ? '#0f172a' : '#fff', color: darkMode ? '#fff' : '#000' }}
                    />
                  </div>

                  {/* Message */}
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                      Message Content *
                    </label>
                    <textarea
                      className="form-control"
                      rows={4}
                      value={composeData.message}
                      placeholder="Enter announcement details..."
                      maxLength={500}
                      onChange={e => setComposeData(c => ({ ...c, message: e.target.value }))}
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: `1px solid ${darkMode ? '#334155' : '#cbd5e1'}`, background: darkMode ? '#0f172a' : '#fff', color: darkMode ? '#fff' : '#000' }}
                    />
                  </div>

                  {/* Category, Priority, Deep Link in 3 Columns */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Category</label>
                      <select
                        className="form-select"
                        value={composeData.category}
                        onChange={e => setComposeData(c => ({ ...c, category: e.target.value }))}
                        style={{ width: '100%', padding: '8px', borderRadius: '6px' }}
                      >
                        {CATEGORIES.filter(c => c.id !== 'ALL').map(c => (
                          <option key={c.id} value={c.id}>{c.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Priority</label>
                      <select
                        className="form-select"
                        value={composeData.priority}
                        onChange={e => setComposeData(c => ({ ...c, priority: e.target.value }))}
                        style={{ width: '100%', padding: '8px', borderRadius: '6px' }}
                      >
                        <option value="LOW">Low</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HIGH">High</option>
                        <option value="CRITICAL">Critical</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Deep Link Route</label>
                      <input
                        className="form-control"
                        value={composeData.deep_link}
                        placeholder="/fees or /exams"
                        onChange={e => setComposeData(c => ({ ...c, deep_link: e.target.value }))}
                        style={{ width: '100%', padding: '8px', borderRadius: '6px' }}
                      />
                    </div>
                  </div>

                  {/* Delivery Channels */}
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Delivery Channels</label>
                    <div style={{ display: 'flex', gap: '20px' }}>
                      <label style={{ fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <input
                          type="checkbox"
                          checked={composeData.channels.includes('in_app')}
                          onChange={e => {
                            if (e.target.checked) setComposeData(c => ({ ...c, channels: [...c.channels, 'in_app'] }));
                            else setComposeData(c => ({ ...c, channels: c.channels.filter(x => x !== 'in_app') }));
                          }}
                        />
                        <i className="ti ti-bell" style={{ color: '#2563eb' }} /> In-App Bell
                      </label>

                      <label style={{ fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <input
                          type="checkbox"
                          checked={composeData.channels.includes('push')}
                          onChange={e => {
                            if (e.target.checked) setComposeData(c => ({ ...c, channels: [...c.channels, 'push'] }));
                            else setComposeData(c => ({ ...c, channels: c.channels.filter(x => x !== 'push') }));
                          }}
                        />
                        <i className="ti ti-device-mobile" style={{ color: '#10b981' }} /> Push (Mobile & Web)
                      </label>
                    </div>
                  </div>

                  {/* Scheduled For Later */}
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                      Schedule for Later (Optional)
                    </label>
                    <input
                      type="datetime-local"
                      className="form-control"
                      value={composeData.scheduled_at}
                      onChange={e => setComposeData(c => ({ ...c, scheduled_at: e.target.value }))}
                      style={{ padding: '8px', borderRadius: '6px' }}
                    />
                    <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '10px' }}>Leave empty to send immediately</span>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn btn-primary"
                    style={{
                      padding: '12px',
                      borderRadius: '8px',
                      fontWeight: 700,
                      fontSize: '14px',
                      background: '#2563eb',
                      color: '#fff',
                      border: 'none',
                      cursor: isSubmitting ? 'not-allowed' : 'pointer',
                      marginTop: '10px'
                    }}
                  >
                    {isSubmitting ? 'Dispatching...' : (composeData.scheduled_at ? 'Schedule Notification' : 'Send Broadcast Now')}
                  </button>
                </form>
              </div>

              {/* Live Preview Column */}
              <div>
                <div style={{ ...cardBg, padding: '22px', position: 'sticky', top: '20px' }}>
                  <h4 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 16px 0' }}>
                    📱 Live Recipient Preview
                  </h4>

                  {/* Mobile Push Simulation Box */}
                  <div style={{
                    background: '#0f172a',
                    borderRadius: '24px',
                    padding: '24px 16px',
                    color: '#fff',
                    maxWidth: '320px',
                    margin: '0 auto',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                    border: '4px solid #334155'
                  }}>
                    <div style={{ textAlign: 'center', fontSize: '11px', color: '#94a3b8', marginBottom: '14px' }}>
                      Mobile Lock Screen Push Notification
                    </div>

                    <div style={{
                      background: 'rgba(255, 255, 255, 0.12)',
                      backdropFilter: 'blur(10px)',
                      borderRadius: '14px',
                      padding: '12px 14px',
                      border: '1px solid rgba(255, 255, 255, 0.2)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700 }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6' }} />
                          Edu ERP
                        </div>
                        <span style={{ fontSize: '10px', color: '#94a3b8' }}>Now</span>
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '2px' }}>
                        {composeData.title || 'Notification Title'}
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#e2e8f0', lineHeight: 1.3 }}>
                        {composeData.message || 'Notification content summary preview will appear here...'}
                      </div>
                      {composeData.deep_link && (
                        <div style={{ fontSize: '10px', color: '#60a5fa', marginTop: '6px' }}>
                          Tap to open: {composeData.deep_link}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* In-App Bell Simulation */}
                  <div style={{ marginTop: '20px', borderTop: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, paddingTop: '16px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: darkMode ? '#94a3b8' : '#64748b', marginBottom: '8px' }}>
                      Web In-App Bell Dropdown Preview
                    </div>
                    <div style={{
                      background: darkMode ? '#0f172a' : '#f8fafc',
                      borderRadius: '10px',
                      padding: '12px',
                      border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
                      display: 'flex',
                      gap: '10px'
                    }}>
                      <span style={{ padding: '8px', background: '#eff6ff', color: '#2563eb', borderRadius: '8px', height: 'fit-content' }}>
                        <i className="ti ti-bell" />
                      </span>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: darkMode ? '#f8fafc' : '#0f172a' }}>
                          {composeData.title || 'Notification Title'}
                        </div>
                        <div style={{ fontSize: '12px', color: darkMode ? '#94a3b8' : '#64748b', marginTop: '2px' }}>
                          {composeData.message || 'Notification message...'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══════════ TAB 3: HISTORY & FEED ══════════ */}
          {activeTab === 'history' && (
            <div style={{ ...cardBg, padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
                <h3 style={{ fontSize: '17px', fontWeight: 700, margin: 0 }}>
                  Notification History ({historyTotal})
                </h3>

                {/* Filters */}
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    placeholder="Search by title..."
                    value={historySearch}
                    onChange={e => { setHistorySearch(e.target.value); setHistoryPage(1); }}
                    style={{ padding: '8px 12px', borderRadius: '6px', border: `1px solid ${darkMode ? '#334155' : '#cbd5e1'}`, fontSize: '13px' }}
                  />

                  <select
                    value={historyCategory}
                    onChange={e => { setHistoryCategory(e.target.value); setHistoryPage(1); }}
                    style={{ padding: '8px', borderRadius: '6px', fontSize: '13px' }}
                  >
                    {CATEGORIES.map(c => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>

                  <select
                    value={historyPriority}
                    onChange={e => { setHistoryPriority(e.target.value); setHistoryPage(1); }}
                    style={{ padding: '8px', borderRadius: '6px', fontSize: '13px' }}
                  >
                    <option value="ALL">All Priorities</option>
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>
              </div>

              {historyLoading ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>Loading history...</div>
              ) : history.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                  <i className="ti ti-bell-off" style={{ fontSize: '32px', marginBottom: '8px', display: 'block' }} />
                  No notifications matching the selected criteria.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {history.map(item => {
                    const pBadge = PRIORITY_BADGES[item.priority] || PRIORITY_BADGES.MEDIUM;
                    return (
                      <div key={item.id} style={{
                        padding: '16px 20px',
                        borderRadius: '10px',
                        background: darkMode ? '#0f172a' : '#f8fafc',
                        border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: '16px'
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 700,
                              background: pBadge.bg,
                              color: pBadge.color,
                              border: `1px solid ${pBadge.border}`
                            }}>
                              {item.priority}
                            </span>
                            <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                              {item.category || 'GENERAL'}
                            </span>
                            <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                              Channel: {item.channel || 'in_app'}
                            </span>
                            <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                              • {new Date(item.created_at).toLocaleString()}
                            </span>
                          </div>

                          <div style={{ fontSize: '14.5px', fontWeight: 700, color: darkMode ? '#f8fafc' : '#0f172a' }}>
                            {item.title}
                          </div>
                          <div style={{ fontSize: '13px', color: darkMode ? '#cbd5e1' : '#475569', marginTop: '4px' }}>
                            {item.message}
                          </div>
                          {item.deep_link && (
                            <div style={{ fontSize: '11.5px', color: '#2563eb', marginTop: '6px', fontWeight: 600 }}>
                              🔗 {item.deep_link}
                            </div>
                          )}
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <span style={{
                            padding: '4px 10px',
                            borderRadius: '20px',
                            fontSize: '11px',
                            fontWeight: 600,
                            background: item.is_read ? '#dcfce7' : '#eff6ff',
                            color: item.is_read ? '#166534' : '#1d4ed8'
                          }}>
                            {item.is_read ? 'Read' : 'Unread'}
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  {/* Pagination */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                    <button
                      disabled={historyPage <= 1}
                      onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                      style={{ padding: '6px 14px', borderRadius: '6px', border: `1px solid ${darkMode ? '#334155' : '#cbd5e1'}` }}
                    >
                      Previous
                    </button>
                    <span style={{ padding: '6px 12px', fontSize: '13px' }}>Page {historyPage}</span>
                    <button
                      disabled={history.length < 15}
                      onClick={() => setHistoryPage(p => p + 1)}
                      style={{ padding: '6px 14px', borderRadius: '6px', border: `1px solid ${darkMode ? '#334155' : '#cbd5e1'}` }}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══════════ TAB 4: TEMPLATES ══════════ */}
          {activeTab === 'templates' && (
            <div style={{ ...cardBg, padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <h3 style={{ fontSize: '17px', fontWeight: 700, margin: 0 }}>Template Library</h3>
                  <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: '#64748b' }}>
                    Manage title & body placeholders for automated notifications across all modules.
                  </p>
                </div>
                <button
                  onClick={() => { setEditingTemplate(null); setTemplateModalOpen(true); }}
                  className="btn btn-primary"
                  style={{ padding: '8px 16px', borderRadius: '6px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <i className="ti ti-plus" /> Custom Template
                </button>
              </div>

              {templatesLoading ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>Loading templates...</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                  {templates.map(tpl => (
                    <div key={tpl.id} style={{
                      padding: '18px',
                      borderRadius: '10px',
                      background: darkMode ? '#0f172a' : '#f8fafc',
                      border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between'
                    }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: '#dbeafe', color: '#1e40af' }}>
                            {tpl.category}
                          </span>
                          <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                            {tpl.is_system ? 'System Default' : 'School Custom'}
                          </span>
                        </div>

                        <div style={{ fontSize: '15px', fontWeight: 700, color: darkMode ? '#f8fafc' : '#0f172a' }}>
                          {tpl.name}
                        </div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace', marginTop: '2px' }}>
                          Code: {tpl.code}
                        </div>

                        <div style={{ marginTop: '12px', fontSize: '12.5px', fontWeight: 600 }}>
                          Title: <span style={{ fontWeight: 400 }}>{tpl.title_template}</span>
                        </div>
                        <div style={{ marginTop: '6px', fontSize: '12px', color: darkMode ? '#cbd5e1' : '#475569' }}>
                          Body: {tpl.body_template}
                        </div>
                        {tpl.deep_link_template && (
                          <div style={{ fontSize: '11px', color: '#2563eb', marginTop: '8px' }}>
                            Deep link: {tpl.deep_link_template}
                          </div>
                        )}
                      </div>

                      <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, paddingTop: '10px' }}>
                        <button
                          onClick={() => { setEditingTemplate(tpl); setTemplateModalOpen(true); }}
                          style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, background: '#2563eb', color: '#fff', border: 'none', cursor: 'pointer' }}
                        >
                          {tpl.is_system ? 'Customize for School' : 'Edit Template'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ══════════ TAB 5: AUTOMATION RULES ══════════ */}
          {activeTab === 'rules' && (
            <div style={{ ...cardBg, padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <h3 style={{ fontSize: '17px', fontWeight: 700, margin: 0 }}>Automated Event Triggers & Rules</h3>
                  <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: '#64748b' }}>
                    Control automatic push & in-app dispatches triggered by existing school operations.
                  </p>
                </div>
              </div>

              {rulesLoading ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>Loading rules...</div>
              ) : rules.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                  No automated rules configured for this school. All default event triggers are active.
                </div>
              ) : (
                <table className="table" style={{ width: '100%', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${darkMode ? '#334155' : '#e2e8f0'}` }}>
                      <th style={{ textAlign: 'left', padding: '12px' }}>Event Trigger</th>
                      <th style={{ textAlign: 'left', padding: '12px' }}>Assigned Template</th>
                      <th style={{ textAlign: 'left', padding: '12px' }}>Audience Roles</th>
                      <th style={{ textAlign: 'left', padding: '12px' }}>Channels</th>
                      <th style={{ textAlign: 'center', padding: '12px' }}>Delay (min)</th>
                      <th style={{ textAlign: 'center', padding: '12px' }}>Status</th>
                      <th style={{ textAlign: 'right', padding: '12px' }}>Toggle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rules.map(rule => (
                      <tr key={rule.id} style={{ borderBottom: `1px solid ${darkMode ? '#1e293b' : '#f1f5f9'}` }}>
                        <td style={{ padding: '12px', fontWeight: 600 }}>{rule.event_name}</td>
                        <td style={{ padding: '12px' }}>{rule.template_name || rule.template_code || 'Default'}</td>
                        <td style={{ padding: '12px' }}>{(rule.target_roles || []).join(', ')}</td>
                        <td style={{ padding: '12px' }}>{(rule.channels || []).join(', ')}</td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>{rule.delay_minutes || 0}</td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <span style={{
                            padding: '3px 10px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: 700,
                            background: rule.is_enabled ? '#dcfce7' : '#fee2e2',
                            color: rule.is_enabled ? '#15803d' : '#b91c1c'
                          }}>
                            {rule.is_enabled ? 'ENABLED' : 'DISABLED'}
                          </span>
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right' }}>
                          <button
                            onClick={() => handleToggleRule(rule.id)}
                            style={{
                              padding: '5px 12px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: 600,
                              background: rule.is_enabled ? '#ef4444' : '#10b981',
                              color: '#fff',
                              border: 'none',
                              cursor: 'pointer'
                            }}
                          >
                            {rule.is_enabled ? 'Disable' : 'Enable'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ══════════ TAB 6: DELIVERY AUDIT LOGS ══════════ */}
          {activeTab === 'logs' && (
            <div style={{ ...cardBg, padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
                <h3 style={{ fontSize: '17px', fontWeight: 700, margin: 0 }}>
                  Delivery Audit Logs ({logsTotal})
                </h3>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <select
                    value={logsStatusFilter}
                    onChange={e => { setLogsStatusFilter(e.target.value); setLogsPage(1); }}
                    style={{ padding: '8px', borderRadius: '6px', fontSize: '13px' }}
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="SENT">Sent Successfully</option>
                    <option value="FAILED">Failed</option>
                    <option value="DEVICE_NOT_FOUND">Device Not Found</option>
                  </select>
                </div>
              </div>

              {logsLoading ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>Loading audit logs...</div>
              ) : logs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                  No delivery logs recorded yet.
                </div>
              ) : (
                <table className="table" style={{ width: '100%', fontSize: '12.5px' }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${darkMode ? '#334155' : '#e2e8f0'}` }}>
                      <th style={{ textAlign: 'left', padding: '10px' }}>Timestamp</th>
                      <th style={{ textAlign: 'left', padding: '10px' }}>Recipient</th>
                      <th style={{ textAlign: 'left', padding: '10px' }}>Channel</th>
                      <th style={{ textAlign: 'center', padding: '10px' }}>Status</th>
                      <th style={{ textAlign: 'left', padding: '10px' }}>Target Token</th>
                      <th style={{ textAlign: 'left', padding: '10px' }}>Error Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map(log => (
                      <tr key={log.id} style={{ borderBottom: `1px solid ${darkMode ? '#1e293b' : '#f1f5f9'}` }}>
                        <td style={{ padding: '10px' }}>{new Date(log.created_at).toLocaleString()}</td>
                        <td style={{ padding: '10px', fontWeight: 600 }}>{log.recipient_name || `User #${log.user_id}`}</td>
                        <td style={{ padding: '10px' }}>
                          <span style={{ textTransform: 'uppercase', fontSize: '11px', fontWeight: 700, color: log.channel === 'expo_push' ? '#10b981' : '#2563eb' }}>
                            {log.channel}
                          </span>
                        </td>
                        <td style={{ padding: '10px', textAlign: 'center' }}>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '12px',
                            fontSize: '10.5px',
                            fontWeight: 700,
                            background: log.status === 'SENT' ? '#dcfce7' : log.status === 'FAILED' ? '#fee2e2' : '#f1f5f9',
                            color: log.status === 'SENT' ? '#166534' : log.status === 'FAILED' ? '#991b1b' : '#475569'
                          }}>
                            {log.status}
                          </span>
                        </td>
                        <td style={{ padding: '10px', fontFamily: 'monospace', fontSize: '11px', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {log.recipient_target || '—'}
                        </td>
                        <td style={{ padding: '10px', color: '#dc2626', fontSize: '11.5px' }}>
                          {log.error_message || 'None'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ══════════ TAB 7: REGISTERED DEVICES ══════════ */}
          {activeTab === 'devices' && (
            <div style={{ ...cardBg, padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                <h3 style={{ fontSize: '17px', fontWeight: 700, margin: 0 }}>
                  Active Push Devices ({devicesTotal})
                </h3>

                <select
                  value={devicesPlatform}
                  onChange={e => { setDevicesPlatform(e.target.value); setDevicesPage(1); }}
                  style={{ padding: '8px', borderRadius: '6px', fontSize: '13px' }}
                >
                  <option value="ALL">All Platforms</option>
                  <option value="android">Android</option>
                  <option value="ios">iOS</option>
                  <option value="web">Web Browser</option>
                </select>
              </div>

              {devicesLoading ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>Loading registered devices...</div>
              ) : devices.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                  No push devices registered yet. Users will appear here when they log into the Mobile App or allow Web Push.
                </div>
              ) : (
                <table className="table" style={{ width: '100%', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${darkMode ? '#334155' : '#e2e8f0'}` }}>
                      <th style={{ textAlign: 'left', padding: '10px' }}>User</th>
                      <th style={{ textAlign: 'left', padding: '10px' }}>Role</th>
                      <th style={{ textAlign: 'left', padding: '10px' }}>Platform</th>
                      <th style={{ textAlign: 'left', padding: '10px' }}>Device Name</th>
                      <th style={{ textAlign: 'left', padding: '10px' }}>App Version</th>
                      <th style={{ textAlign: 'left', padding: '10px' }}>Last Seen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {devices.map(dev => (
                      <tr key={dev.id} style={{ borderBottom: `1px solid ${darkMode ? '#1e293b' : '#f1f5f9'}` }}>
                        <td style={{ padding: '10px', fontWeight: 600 }}>{dev.user_name}</td>
                        <td style={{ padding: '10px' }}>{dev.user_role}</td>
                        <td style={{ padding: '10px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textTransform: 'capitalize' }}>
                            <i className={dev.platform === 'android' ? 'ti ti-brand-android' : dev.platform === 'ios' ? 'ti ti-brand-apple' : 'ti ti-browser'} />
                            {dev.platform}
                          </span>
                        </td>
                        <td style={{ padding: '10px' }}>{dev.device_name || 'Standard Device'}</td>
                        <td style={{ padding: '10px' }}>{dev.app_version || '1.0.0'}</td>
                        <td style={{ padding: '10px' }}>{dev.last_seen ? new Date(dev.last_seen).toLocaleString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ══════════ TAB 8: USER PREFERENCES ══════════ */}
          {activeTab === 'preferences' && (
            <div style={{ ...cardBg, padding: '24px', maxWidth: '780px', margin: '0 auto' }}>
              <h3 style={{ fontSize: '17px', fontWeight: 700, margin: '0 0 8px 0' }}>
                My Personal Channel Preferences
              </h3>
              <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#64748b' }}>
                Configure which category notifications you receive via In-App Bell and Mobile Push, and customize quiet hours.
              </p>

              {prefLoading ? (
                <div>Loading preferences...</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {CATEGORIES.filter(c => c.id !== 'ALL').map(cat => {
                    const existingPref = preferences.find(p => p.category === cat.id);
                    const inApp = existingPref ? existingPref.in_app_enabled : true;
                    const push = existingPref ? existingPref.push_enabled : true;

                    return (
                      <div key={cat.id} style={{
                        padding: '14px 18px',
                        borderRadius: '8px',
                        background: darkMode ? '#0f172a' : '#f8fafc',
                        border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <i className={cat.icon} style={{ fontSize: '18px', color: '#2563eb' }} />
                          <span style={{ fontWeight: 600, fontSize: '13.5px' }}>{cat.label}</span>
                        </div>

                        <div style={{ display: 'flex', gap: '20px' }}>
                          <label style={{ fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <input
                              type="checkbox"
                              checked={inApp}
                              onChange={async (e) => {
                                const newInApp = e.target.checked;
                                await api.put('/notification-center/preferences', {
                                  category: cat.id,
                                  in_app_enabled: newInApp,
                                  push_enabled: push
                                });
                                fetchPreferences();
                                toast.success(`In-App preference updated for ${cat.label}`);
                              }}
                            />
                            In-App Bell
                          </label>

                          <label style={{ fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <input
                              type="checkbox"
                              checked={push}
                              onChange={async (e) => {
                                const newPush = e.target.checked;
                                await api.put('/notification-center/preferences', {
                                  category: cat.id,
                                  in_app_enabled: inApp,
                                  push_enabled: newPush
                                });
                                fetchPreferences();
                                toast.success(`Push preference updated for ${cat.label}`);
                              }}
                            />
                            Push Notifications
                          </label>
                        </div>
                      </div>
                    );
                  })}

                  {/* Quiet Hours Card */}
                  <div style={{
                    marginTop: '16px',
                    padding: '18px',
                    borderRadius: '8px',
                    border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
                    background: darkMode ? '#0f172a' : '#f8fafc'
                  }}>
                    <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 700 }}>
                      🌙 Push Quiet Hours
                    </h4>
                    <p style={{ margin: '0 0 14px 0', fontSize: '12.5px', color: '#64748b' }}>
                      Push notifications received during this window will be silently delivered to in-app bell without waking your device.
                    </p>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                      <div>
                        <label style={{ fontSize: '12px', display: 'block', fontWeight: 600 }}>Start Time</label>
                        <input
                          type="time"
                          value={quietHours.start}
                          onChange={e => setQuietHours(q => ({ ...q, start: e.target.value }))}
                          style={{ padding: '6px 10px', borderRadius: '6px' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '12px', display: 'block', fontWeight: 600 }}>End Time</label>
                        <input
                          type="time"
                          value={quietHours.end}
                          onChange={e => setQuietHours(q => ({ ...q, end: e.target.value }))}
                          style={{ padding: '6px 10px', borderRadius: '6px' }}
                        />
                      </div>
                      <button
                        onClick={async () => {
                          await api.put('/notification-center/preferences', {
                            category: 'GENERAL',
                            quiet_hours_start: quietHours.start,
                            quiet_hours_end: quietHours.end
                          });
                          toast.success('Quiet hours saved!');
                        }}
                        className="btn btn-primary btn-sm"
                        style={{ marginTop: '18px' }}
                      >
                        Save Quiet Hours
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══════════ TAB 9: PUSH STATUS ══════════ */}
          {activeTab === 'push-status' && (
            <div style={{ ...cardBg, padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
              <h3 style={{ fontSize: '17px', fontWeight: 700, margin: '0 0 8px 0' }}>
                Push Notification Gateway Diagnostics
              </h3>
              <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#64748b' }}>
                Operational health of mobile push (Expo SDK) and web browser push (VAPID) dispatchers.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Expo Push Gateway */}
                <div style={{
                  padding: '20px',
                  borderRadius: '10px',
                  border: '1px solid #d1fae5',
                  background: darkMode ? '#064e3b' : '#ecfdf5',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981' }} />
                      <span style={{ fontSize: '15px', fontWeight: 700 }}>Expo Mobile Push Gateway</span>
                    </div>
                    <p style={{ margin: '6px 0 0 0', fontSize: '12.5px', color: darkMode ? '#d1fae5' : '#065f46' }}>
                      Ready. Dispatches to React Native Android and iOS devices using Expo Push Service. Batch capacity: 100 per chunk.
                    </p>
                  </div>
                  <span style={{ padding: '4px 12px', borderRadius: '12px', background: '#10b981', color: '#fff', fontSize: '11px', fontWeight: 700 }}>
                    ACTIVE
                  </span>
                </div>

                {/* Web Push Gateway */}
                <div style={{
                  padding: '20px',
                  borderRadius: '10px',
                  border: '1px solid #e0f2fe',
                  background: darkMode ? '#0c4a6e' : '#f0f9ff',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#0284c7' }} />
                      <span style={{ fontSize: '15px', fontWeight: 700 }}>Web Push (VAPID) Gateway</span>
                    </div>
                    <p style={{ margin: '6px 0 0 0', fontSize: '12.5px', color: darkMode ? '#e0f2fe' : '#0369a1' }}>
                      Supported via pywebpush and Service Worker push subscription.
                    </p>
                  </div>
                  <span style={{ padding: '4px 12px', borderRadius: '12px', background: '#0284c7', color: '#fff', fontSize: '11px', fontWeight: 700 }}>
                    CONFIGURED
                  </span>
                </div>

                {/* In-App Bell Engine */}
                <div style={{
                  padding: '20px',
                  borderRadius: '10px',
                  border: '1px solid #f3e8ff',
                  background: darkMode ? '#581c87' : '#faf5ff',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#a855f7' }} />
                      <span style={{ fontSize: '15px', fontWeight: 700 }}>In-App Bell & Audit Database Engine</span>
                    </div>
                    <p style={{ margin: '6px 0 0 0', fontSize: '12.5px', color: darkMode ? '#f3e8ff' : '#6b21a8' }}>
                      Real-time database store in support_notifications & notification_delivery_logs with retention cleanups.
                    </p>
                  </div>
                  <span style={{ padding: '4px 12px', borderRadius: '12px', background: '#a855f7', color: '#fff', fontSize: '11px', fontWeight: 700 }}>
                    ONLINE
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ══════════ TEMPLATE EDIT / CUSTOMIZE MODAL ══════════ */}
          {templateModalOpen && (
            <div style={{
              position: 'fixed',
              top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: '20px'
            }}>
              <div style={{ ...cardBg, width: '100%', maxWidth: '580px', padding: '24px' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '17px', fontWeight: 700 }}>
                  {editingTemplate ? `Customize Template: ${editingTemplate.name}` : 'New Custom Template'}
                </h3>

                <form onSubmit={async (e) => {
                  e.preventDefault();
                  const formEl = e.target;
                  const payload = {
                    code: formEl.code.value,
                    name: formEl.name.value,
                    category: formEl.category.value,
                    title_template: formEl.title_template.value,
                    body_template: formEl.body_template.value,
                    deep_link_template: formEl.deep_link_template.value,
                    default_priority: formEl.default_priority.value,
                  };
                  try {
                    if (editingTemplate && editingTemplate.id) {
                      await api.put(`/notification-center/templates/${editingTemplate.id}`, payload);
                    } else {
                      await api.post('/notification-center/templates', payload);
                    }
                    toast.success('Template saved successfully!');
                    setTemplateModalOpen(false);
                    fetchTemplates();
                  } catch (err) {
                    toast.error(err.response?.data?.error || 'Failed to save template');
                  }
                }} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, display: 'block' }}>Code Identifier</label>
                    <input
                      name="code"
                      defaultValue={editingTemplate?.code || ''}
                      disabled={Boolean(editingTemplate)}
                      required
                      style={{ width: '100%', padding: '8px', borderRadius: '6px' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, display: 'block' }}>Template Name</label>
                    <input
                      name="name"
                      defaultValue={editingTemplate?.name || ''}
                      required
                      style={{ width: '100%', padding: '8px', borderRadius: '6px' }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 600, display: 'block' }}>Category</label>
                      <select name="category" defaultValue={editingTemplate?.category || 'GENERAL'} style={{ width: '100%', padding: '8px', borderRadius: '6px' }}>
                        {CATEGORIES.filter(c => c.id !== 'ALL').map(c => (
                          <option key={c.id} value={c.id}>{c.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 600, display: 'block' }}>Default Priority</label>
                      <select name="default_priority" defaultValue={editingTemplate?.default_priority || 'MEDIUM'} style={{ width: '100%', padding: '8px', borderRadius: '6px' }}>
                        <option value="LOW">Low</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HIGH">High</option>
                        <option value="CRITICAL">Critical</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, display: 'block' }}>Title Template (supports {'{token}'})</label>
                    <input
                      name="title_template"
                      defaultValue={editingTemplate?.title_template || ''}
                      required
                      style={{ width: '100%', padding: '8px', borderRadius: '6px' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, display: 'block' }}>Body Template (supports {'{token}'})</label>
                    <textarea
                      name="body_template"
                      rows={3}
                      defaultValue={editingTemplate?.body_template || ''}
                      required
                      style={{ width: '100%', padding: '8px', borderRadius: '6px' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, display: 'block' }}>Deep Link Route</label>
                    <input
                      name="deep_link_template"
                      defaultValue={editingTemplate?.deep_link_template || ''}
                      placeholder="/fees, /exams, etc."
                      style={{ width: '100%', padding: '8px', borderRadius: '6px' }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                    <button
                      type="button"
                      onClick={() => setTemplateModalOpen(false)}
                      style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'transparent' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      style={{ padding: '8px 18px', borderRadius: '6px', background: '#2563eb', color: '#fff', border: 'none', fontWeight: 600 }}
                    >
                      Save Template
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
