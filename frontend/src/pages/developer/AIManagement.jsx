import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import {
  getAIConfig, saveAIConfig, testConnection,
  getQuotas, setQuota, getAIAnalytics,
} from '../../AI/services/aiApi';

const TABS = ['Configuration', 'Quotas', 'Analytics'];

export default function AIManagement() {
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('ederp_theme') === 'dark');
  useEffect(() => { localStorage.setItem('ederp_theme', darkMode ? 'dark' : 'light'); }, [darkMode]);

  const [tab,           setTab]           = useState('Configuration');
  const [config,        setConfig]        = useState(null);
  const [providers,     setProviders]     = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [saving,        setSaving]        = useState(false);
  const [testing,       setTesting]       = useState(false);
  const [testResult,    setTestResult]    = useState(null);
  const [analytics,     setAnalytics]     = useState(null);
  const [quotas,        setQuotas]        = useState([]);
  const [defaultQuotas, setDefaultQuotas] = useState({});
  const [msg,           setMsg]           = useState(null);

  // Form state
  const [form, setForm] = useState({
    provider:    'GROQ',
    model:       'llama-3.3-70b-versatile',
    api_key:     '',
    temperature: 0.3,
    max_tokens:  800,
  });

  const [quotaForm, setQuotaForm] = useState({ role: 'PRINCIPAL', daily_limit: 50 });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [cfgData, analyticsData, quotaData] = await Promise.allSettled([
        getAIConfig(),
        getAIAnalytics(),
        getQuotas(),
      ]);

      if (cfgData.status === 'fulfilled') {
        const d = cfgData.value;
        setProviders(d.providers || []);
        setDefaultQuotas(d.default_quotas || {});
        if (d.config) {
          setConfig(d.config);
          setForm(prev => ({
            ...prev,
            provider:    d.config.provider    || 'GROQ',
            model:       d.config.model       || 'llama-3.3-70b-versatile',
            temperature: d.config.temperature || 0.3,
            max_tokens:  d.config.max_tokens  || 800,
          }));
        }
      }

      if (analyticsData.status === 'fulfilled') {
        setAnalytics(analyticsData.value);
      }

      if (quotaData.status === 'fulfilled') {
        setQuotas(quotaData.value.quotas || []);
      }
    } catch (_) {}
    setLoading(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const result = await saveAIConfig(form);
      setConfig(result.config);
      setMsg({ type: 'success', text: result.message || 'Configuration saved ✓' });
      setForm(prev => ({ ...prev, api_key: '' }));
    } catch (err) {
      setMsg({ type: 'error', text: err?.response?.data?.error || 'Save failed' });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testConnection({
        provider: form.provider,
        model:    form.model,
        api_key:  form.api_key || undefined,
      });
      setTestResult(result);
    } catch (err) {
      setTestResult({ success: false, message: err?.response?.data?.error || 'Connection test failed' });
    } finally {
      setTesting(false);
    }
  };

  const handleSetQuota = async (e) => {
    e.preventDefault();
    try {
      await setQuota(quotaForm);
      setMsg({ type: 'success', text: `${quotaForm.role} quota updated to ${quotaForm.daily_limit}/day ✓` });
      const d = await getQuotas();
      setQuotas(d.quotas || []);
    } catch (err) {
      setMsg({ type: 'error', text: err?.response?.data?.error || 'Failed to set quota' });
    }
  };

  const selectedProvider = providers.find(p => p.key === form.provider);
  const models = selectedProvider?.models || [];

  return (
    <div className={`app-shell${darkMode ? ' theme-dark' : ''}`}>
      <Sidebar darkMode={darkMode} />
      <div className="main-content" style={{ minHeight: '100vh', background: darkMode ? '#0b132b' : '#f8fafc' }}>
        <Navbar
          title="1P360 BOT — AI Configuration"
          darkMode={darkMode}
          onToggleDark={() => setDarkMode(d => !d)}
        />

        <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
          {/* Header Banner */}
          <div style={{
            background: darkMode ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' : '#ffffff',
            border: `1px solid ${darkMode ? 'rgba(99,179,237,0.15)' : '#e2e8f0'}`,
            borderRadius: '16px',
            padding: '24px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: darkMode ? '0 4px 20px rgba(0,0,0,0.3)' : '0 2px 10px rgba(0,0,0,0.04)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
                width: '54px', height: '54px', borderRadius: '14px',
                background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '28px', color: '#fff', boxShadow: '0 4px 16px rgba(59,130,246,0.4)',
              }}>
                🤖
              </div>
              <div>
                <h1 style={{ fontSize: '20px', fontWeight: '700', margin: 0, color: darkMode ? '#f1f5f9' : '#0f172a' }}>
                  1P360 BOT Management
                </h1>
                <p style={{ fontSize: '13px', margin: '4px 0 0', color: darkMode ? '#94a3b8' : '#64748b' }}>
                  Enterprise School ERP AI Assistant • Provider Configuration, Quotas & Token Analytics
                </p>
              </div>
            </div>

            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              padding: '8px 16px', borderRadius: '99px',
              background: config?.key_configured ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)',
              border: `1px solid ${config?.key_configured ? 'rgba(34,197,94,0.3)' : 'rgba(245,158,11,0.3)'}`,
              color: config?.key_configured ? '#22c55e' : '#f59e0b',
              fontWeight: 600, fontSize: '13px',
            }}>
              <span style={{
                width: '8px', height: '8px', borderRadius: '50%',
                background: config?.key_configured ? '#22c55e' : '#f59e0b',
                display: 'inline-block',
              }} />
              {config?.key_configured ? 'AI Service Ready ✓' : 'API Key Required ⚠️'}
            </div>
          </div>

          {/* Quick Status Line */}
          {config && (
            <div style={{
              display: 'flex', gap: '20px', padding: '12px 18px', marginBottom: '20px',
              background: darkMode ? 'rgba(30,41,59,0.7)' : '#f1f5f9',
              borderRadius: '12px', border: `1px solid ${darkMode ? 'rgba(99,179,237,0.12)' : '#e2e8f0'}`,
              fontSize: '13px', color: darkMode ? '#94a3b8' : '#475569', flexWrap: 'wrap',
            }}>
              <span>Active Provider: <strong style={{ color: '#3b82f6' }}>{config.provider}</strong></span>
              <span>•</span>
              <span>Model: <strong style={{ color: darkMode ? '#e2e8f0' : '#1e293b' }}>{config.model}</strong></span>
              <span>•</span>
              <span>Temperature: <strong>{config.temperature}</strong></span>
              <span>•</span>
              <span>Max Tokens: <strong>{config.max_tokens}</strong></span>
            </div>
          )}

          {/* Notification Alert */}
          {msg && (
            <div style={{
              padding: '14px 18px', borderRadius: '10px', marginBottom: '20px', fontSize: '13px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: msg.type === 'success' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
              border: `1px solid ${msg.type === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
              color: msg.type === 'success' ? '#22c55e' : '#ef4444',
            }}>
              <span>{msg.text}</span>
              <button
                onClick={() => setMsg(null)}
                style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '15px' }}
              >✕</button>
            </div>
          )}

          {/* Tab Navigation */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
            {TABS.map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  padding: '10px 22px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                  fontSize: '13.5px', fontWeight: tab === t ? 600 : 500, transition: 'all 0.2s',
                  background: tab === t ? (darkMode ? '#3b82f6' : '#2563eb') : (darkMode ? '#1e293b' : '#e2e8f0'),
                  color: tab === t ? '#ffffff' : (darkMode ? '#94a3b8' : '#475569'),
                  boxShadow: tab === t ? '0 4px 12px rgba(37,99,235,0.3)' : 'none',
                }}
              >
                {t === 'Configuration' && '⚙️ '}
                {t === 'Quotas' && '📊 '}
                {t === 'Analytics' && '📈 '}
                {t}
              </button>
            ))}
          </div>

          {/* Tab 1: Configuration */}
          {tab === 'Configuration' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '24px' }}>
              <form onSubmit={handleSave} style={{
                background: darkMode ? '#1e293b' : '#ffffff',
                border: `1px solid ${darkMode ? 'rgba(99,179,237,0.12)' : '#e2e8f0'}`,
                borderRadius: '16px', padding: '24px',
                boxShadow: darkMode ? '0 4px 20px rgba(0,0,0,0.2)' : '0 2px 10px rgba(0,0,0,0.03)',
              }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 20px', color: darkMode ? '#f1f5f9' : '#0f172a' }}>
                  🔧 AI Provider Setup
                </h3>

                {/* Provider Chooser */}
                <div style={{ marginBottom: '18px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: darkMode ? '#94a3b8' : '#64748b', marginBottom: '8px', textTransform: 'uppercase' }}>
                    Select Provider
                  </label>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    {providers.map(p => (
                      <div
                        key={p.key}
                        onClick={() => {
                          const firstModel = p.models[0]?.id || '';
                          setForm(prev => ({ ...prev, provider: p.key, model: firstModel }));
                          setTestResult(null);
                        }}
                        style={{
                          flex: 1, padding: '14px', borderRadius: '12px', cursor: 'pointer',
                          background: form.provider === p.key ? (darkMode ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.08)') : (darkMode ? '#0f172a' : '#f8fafc'),
                          border: `2px solid ${form.provider === p.key ? '#3b82f6' : (darkMode ? 'rgba(99,179,237,0.1)' : '#e2e8f0')}`,
                          transition: 'all 0.2s',
                        }}
                      >
                        <div style={{ fontWeight: 700, fontSize: '14px', color: form.provider === p.key ? '#3b82f6' : (darkMode ? '#e2e8f0' : '#1e293b') }}>
                          {p.key === 'GROQ' ? '⚡ Groq LPU' : '🟢 OpenAI'}
                        </div>
                        <div style={{ fontSize: '11px', color: darkMode ? '#64748b' : '#94a3b8', marginTop: '4px' }}>
                          {p.key === 'GROQ' ? 'Ultra-fast inference (Recommended)' : 'GPT-4o mini / GPT-4o'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Model Selector */}
                <div style={{ marginBottom: '18px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: darkMode ? '#94a3b8' : '#64748b', marginBottom: '8px', textTransform: 'uppercase' }}>
                    Model
                  </label>
                  <select
                    value={form.model}
                    onChange={e => setForm(prev => ({ ...prev, model: e.target.value }))}
                    style={{
                      width: '100%', padding: '11px 14px', borderRadius: '10px',
                      background: darkMode ? '#0f172a' : '#ffffff',
                      border: `1px solid ${darkMode ? 'rgba(99,179,237,0.2)' : '#cbd5e1'}`,
                      color: darkMode ? '#f1f5f9' : '#0f172a', fontSize: '13.5px', outline: 'none',
                    }}
                  >
                    {models.map(m => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </select>
                </div>

                {/* API Key */}
                <div style={{ marginBottom: '18px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: darkMode ? '#94a3b8' : '#64748b', marginBottom: '8px', textTransform: 'uppercase' }}>
                    API Key
                    {config?.key_configured && (
                      <span style={{ color: '#22c55e', fontSize: '11px', marginLeft: '10px', fontWeight: 'normal' }}>
                        ✓ Key already encrypted & saved
                      </span>
                    )}
                  </label>
                  <input
                    type="password"
                    placeholder={config?.key_configured ? '•••••••••••••••• (Leave blank to keep existing key)' : `Enter ${form.provider} API key...`}
                    value={form.api_key}
                    onChange={e => setForm(prev => ({ ...prev, api_key: e.target.value }))}
                    autoComplete="new-password"
                    style={{
                      width: '100%', padding: '11px 14px', borderRadius: '10px',
                      background: darkMode ? '#0f172a' : '#ffffff',
                      border: `1px solid ${darkMode ? 'rgba(99,179,237,0.2)' : '#cbd5e1'}`,
                      color: darkMode ? '#f1f5f9' : '#0f172a', fontSize: '13.5px', outline: 'none',
                    }}
                  />
                  <span style={{ fontSize: '11px', color: darkMode ? '#64748b' : '#94a3b8', display: 'block', marginTop: '6px' }}>
                    🔒 Key is encrypted with AES-256 at rest. It is never logged or exposed to users.
                  </span>
                </div>

                {/* Temperature & Max Tokens */}
                <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: darkMode ? '#94a3b8' : '#64748b', marginBottom: '6px', textTransform: 'uppercase' }}>
                      Temperature ({form.temperature})
                    </label>
                    <input
                      type="range" min="0" max="1" step="0.05"
                      value={form.temperature}
                      onChange={e => setForm(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                      style={{ width: '100%', accentColor: '#3b82f6' }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: darkMode ? '#94a3b8' : '#64748b', marginBottom: '6px', textTransform: 'uppercase' }}>
                      Max Tokens
                    </label>
                    <input
                      type="number" min="100" max="4000" step="100"
                      value={form.max_tokens}
                      onChange={e => setForm(prev => ({ ...prev, max_tokens: parseInt(e.target.value) }))}
                      style={{
                        width: '100%', padding: '8px 12px', borderRadius: '8px',
                        background: darkMode ? '#0f172a' : '#ffffff',
                        border: `1px solid ${darkMode ? 'rgba(99,179,237,0.2)' : '#cbd5e1'}`,
                        color: darkMode ? '#f1f5f9' : '#0f172a', fontSize: '13px', outline: 'none',
                      }}
                    />
                  </div>
                </div>

                {/* Connection Test Output */}
                {testResult && (
                  <div style={{
                    padding: '12px 16px', borderRadius: '10px', fontSize: '13px', marginBottom: '18px',
                    background: testResult.success ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                    border: `1px solid ${testResult.success ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                    color: testResult.success ? '#22c55e' : '#ef4444',
                  }}>
                    {testResult.success ? '✓ ' : '✗ '} {testResult.message}
                    {testResult.latency_ms && <span style={{ opacity: 0.8, marginLeft: '8px' }}>({testResult.latency_ms}ms)</span>}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    type="button"
                    onClick={handleTest}
                    disabled={testing}
                    style={{
                      flex: 1, padding: '11px 18px', borderRadius: '10px', cursor: 'pointer',
                      background: darkMode ? 'rgba(99,179,237,0.12)' : '#f1f5f9',
                      border: `1px solid ${darkMode ? 'rgba(99,179,237,0.25)' : '#cbd5e1'}`,
                      color: darkMode ? '#63b3ed' : '#2563eb', fontWeight: 600, fontSize: '13px',
                    }}
                  >
                    {testing ? '⏳ Testing...' : '🔌 Test Connection'}
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    style={{
                      flex: 1, padding: '11px 18px', borderRadius: '10px', cursor: 'pointer',
                      background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', border: 'none',
                      color: '#ffffff', fontWeight: 600, fontSize: '13px',
                      boxShadow: '0 4px 14px rgba(59,130,246,0.35)',
                    }}
                  >
                    {saving ? '⏳ Saving...' : '💾 Save Configuration'}
                  </button>
                </div>
              </form>

              {/* Status Overview Card */}
              <div style={{
                background: darkMode ? '#1e293b' : '#ffffff',
                border: `1px solid ${darkMode ? 'rgba(99,179,237,0.12)' : '#e2e8f0'}`,
                borderRadius: '16px', padding: '24px',
                boxShadow: darkMode ? '0 4px 20px rgba(0,0,0,0.2)' : '0 2px 10px rgba(0,0,0,0.03)',
              }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 20px', color: darkMode ? '#f1f5f9' : '#0f172a' }}>
                  📋 Active AI Status
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <StatusRow label="Status" value={config?.is_active ? 'Active & Ready' : 'Inactive'} green={config?.is_active} darkMode={darkMode} />
                  <StatusRow label="Active Provider" value={config?.provider || 'None'} darkMode={darkMode} />
                  <StatusRow label="Active Model" value={config?.model || 'None'} darkMode={darkMode} />
                  <StatusRow label="API Key Stored" value={config?.key_configured ? 'Yes (Encrypted)' : 'No'} green={config?.key_configured} darkMode={darkMode} />
                  <StatusRow label="Default Temperature" value={config?.temperature ?? 0.3} darkMode={darkMode} />
                  <StatusRow label="Max Tokens per Query" value={config?.max_tokens ?? 800} darkMode={darkMode} />
                  <StatusRow label="Last Updated" value={config?.updated_at ? new Date(config.updated_at).toLocaleString() : 'Never'} darkMode={darkMode} />
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Quotas */}
          {tab === 'Quotas' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
              <form onSubmit={handleSetQuota} style={{
                background: darkMode ? '#1e293b' : '#ffffff',
                border: `1px solid ${darkMode ? 'rgba(99,179,237,0.12)' : '#e2e8f0'}`,
                borderRadius: '16px', padding: '24px',
              }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 18px', color: darkMode ? '#f1f5f9' : '#0f172a' }}>
                  📊 Set Daily Role Limits
                </h3>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: darkMode ? '#94a3b8' : '#64748b', marginBottom: '8px' }}>
                    Role
                  </label>
                  <select
                    value={quotaForm.role}
                    onChange={e => setQuotaForm(prev => ({ ...prev, role: e.target.value }))}
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: '10px',
                      background: darkMode ? '#0f172a' : '#ffffff',
                      border: `1px solid ${darkMode ? 'rgba(99,179,237,0.2)' : '#cbd5e1'}`,
                      color: darkMode ? '#f1f5f9' : '#0f172a',
                    }}
                  >
                    {['PRINCIPAL', 'VICE_PRINCIPAL', 'TEACHER', 'ACCOUNTANT', 'LIBRARIAN', 'HOSTEL', 'TRANSPORT', 'SUPER_ADMIN'].map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <div style={{ marginBottom: '18px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: darkMode ? '#94a3b8' : '#64748b', marginBottom: '8px' }}>
                    Daily Query Limit
                  </label>
                  <input
                    type="number" min="0" max="10000"
                    value={quotaForm.daily_limit}
                    onChange={e => setQuotaForm(prev => ({ ...prev, daily_limit: parseInt(e.target.value) }))}
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: '10px',
                      background: darkMode ? '#0f172a' : '#ffffff',
                      border: `1px solid ${darkMode ? 'rgba(99,179,237,0.2)' : '#cbd5e1'}`,
                      color: darkMode ? '#f1f5f9' : '#0f172a',
                    }}
                  />
                </div>
                <button
                  type="submit"
                  style={{
                    padding: '10px 22px', borderRadius: '10px', cursor: 'pointer',
                    background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', border: 'none',
                    color: '#ffffff', fontWeight: 600, fontSize: '13px',
                  }}
                >
                  💾 Save Quota Limit
                </button>
              </form>

              <div style={{
                background: darkMode ? '#1e293b' : '#ffffff',
                border: `1px solid ${darkMode ? 'rgba(99,179,237,0.12)' : '#e2e8f0'}`,
                borderRadius: '16px', padding: '24px',
              }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 16px', color: darkMode ? '#f1f5f9' : '#0f172a' }}>
                  📋 Configured Quotas
                </h3>
                {Object.entries(defaultQuotas).map(([role, limit]) => (
                  <div key={role} style={{
                    display: 'flex', justifyContent: 'space-between', padding: '10px 0',
                    borderBottom: `1px solid ${darkMode ? 'rgba(99,179,237,0.08)' : '#f1f5f9'}`,
                  }}>
                    <span style={{ color: darkMode ? '#94a3b8' : '#475569', fontSize: '13px' }}>{role}</span>
                    <span style={{ color: '#3b82f6', fontWeight: 600, fontSize: '13px' }}>{limit} queries/day</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 3: Analytics */}
          {tab === 'Analytics' && analytics && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                {[
                  { label: 'Queries Today',   value: analytics.today.total_queries,   icon: '💬', color: '#3b82f6' },
                  { label: 'Cache Hit Rate',  value: `${analytics.today.cache_hit_rate}%`, icon: '⚡', color: '#f59e0b' },
                  { label: 'Avg Latency',     value: `${analytics.today.avg_response_ms}ms`, icon: '⏱️', color: '#8b5cf6' },
                  { label: 'Total Tokens',    value: analytics.today.total_tokens.toLocaleString(), icon: '🔤', color: '#06b6d4' },
                  { label: 'Estimated Cost',  value: `$${analytics.today.estimated_cost.toFixed(4)}`, icon: '💰', color: '#10b981' },
                ].map(stat => (
                  <div key={stat.label} style={{
                    background: darkMode ? '#1e293b' : '#ffffff',
                    border: `1px solid ${darkMode ? 'rgba(99,179,237,0.12)' : '#e2e8f0'}`,
                    borderRadius: '14px', padding: '18px', textAlign: 'center',
                  }}>
                    <div style={{ fontSize: '24px', marginBottom: '6px' }}>{stat.icon}</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: stat.color }}>{stat.value}</div>
                    <div style={{ fontSize: '11px', color: darkMode ? '#94a3b8' : '#64748b', marginTop: '4px' }}>{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusRow({ label, value, green, darkMode }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0',
      borderBottom: `1px solid ${darkMode ? 'rgba(99,179,237,0.08)' : '#f1f5f9'}`,
    }}>
      <span style={{ fontSize: '13px', color: darkMode ? '#94a3b8' : '#64748b' }}>{label}</span>
      <span style={{ fontSize: '13.5px', fontWeight: 600, color: green ? '#22c55e' : (darkMode ? '#e2e8f0' : '#1e293b') }}>
        {String(value)}
      </span>
    </div>
  );
}
