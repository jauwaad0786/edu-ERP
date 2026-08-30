import React, { useState, useEffect } from 'react';
import {
  getAIConfig, saveAIConfig, testConnection,
  getQuotas, setQuota, getAIAnalytics,
} from '../../AI/services/aiApi';

const TABS = ['Configuration', 'Quotas', 'Analytics'];

export default function AIManagement() {
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
      setForm(prev => ({ ...prev, api_key: '' })); // Clear key from form
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
      setTestResult({ success: false, message: 'Connection test failed' });
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

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.loader}>Loading AI Management...</div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.headerIcon}>🤖</div>
          <div>
            <h1 style={styles.title}>1P360 BOT — AI Management</h1>
            <p style={styles.subtitle}>Configure AI provider, models, quotas and monitor usage</p>
          </div>
        </div>
        <div style={styles.statusBadge(config?.key_configured)}>
          {config?.key_configured ? '✓ Configured' : '⚠ Not Configured'}
        </div>
      </div>

      {/* Status bar */}
      {config && (
        <div style={styles.statusBar}>
          <span style={styles.statusItem}>
            <span style={styles.statusDot(true)} />
            Provider: <strong>{config.provider}</strong>
          </span>
          <span style={styles.statusItem}>
            Model: <strong>{config.model}</strong>
          </span>
          <span style={styles.statusItem}>
            API Key: <strong>{config.key_configured ? 'Configured ✓' : 'Not Set'}</strong>
          </span>
        </div>
      )}

      {/* Notification */}
      {msg && (
        <div style={styles.notification(msg.type)}>
          {msg.text}
          <button style={styles.notifClose} onClick={() => setMsg(null)}>✕</button>
        </div>
      )}

      {/* Tabs */}
      <div style={styles.tabBar}>
        {TABS.map(t => (
          <button
            key={t}
            style={styles.tabBtn(tab === t)}
            onClick={() => setTab(t)}
          >
            {t === 'Configuration' && '⚙️ '}
            {t === 'Quotas' && '📊 '}
            {t === 'Analytics' && '📈 '}
            {t}
          </button>
        ))}
      </div>

      {/* ── Configuration Tab ─────────────────────────────────────────── */}
      {tab === 'Configuration' && (
        <div style={styles.grid2}>
          <form onSubmit={handleSave} style={styles.card}>
            <h3 style={styles.cardTitle}>🔧 Provider Configuration</h3>

            {/* Provider */}
            <div style={styles.formGroup}>
              <label style={styles.label}>AI Provider</label>
              <div style={styles.providerCards}>
                {providers.map(p => (
                  <div
                    key={p.key}
                    style={styles.providerCard(form.provider === p.key)}
                    onClick={() => {
                      const firstModel = p.models[0]?.id || '';
                      setForm(prev => ({ ...prev, provider: p.key, model: firstModel }));
                      setTestResult(null);
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
                      {p.key === 'GROQ' ? '⚡' : '🟢'} {p.label}
                    </div>
                    <div style={{ fontSize: 11, opacity: 0.7 }}>
                      {p.key === 'GROQ' ? 'Ultra-fast LPU inference' : 'GPT-4o family'}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Model */}
            <div style={styles.formGroup}>
              <label style={styles.label}>Model</label>
              <select
                style={styles.input}
                value={form.model}
                onChange={e => setForm(prev => ({ ...prev, model: e.target.value }))}
              >
                {models.map(m => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </div>

            {/* API Key */}
            <div style={styles.formGroup}>
              <label style={styles.label}>
                API Key
                {config?.key_configured && (
                  <span style={{ color: '#34d399', fontSize: 11, marginLeft: 8 }}>
                    ● Configured (leave blank to keep current)
                  </span>
                )}
              </label>
              <input
                type="password"
                style={styles.input}
                placeholder={config?.key_configured ? '••••••••••• (keep current)' : 'Enter API key...'}
                value={form.api_key}
                onChange={e => setForm(prev => ({ ...prev, api_key: e.target.value }))}
                autoComplete="new-password"
              />
              <div style={styles.hint}>
                API key is encrypted at rest. Never stored or returned as plaintext.
              </div>
            </div>

            {/* Temperature */}
            <div style={styles.formRow}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Temperature ({form.temperature})</label>
                <input
                  type="range" min="0" max="1" step="0.05"
                  style={{ width: '100%', accentColor: '#3b82f6' }}
                  value={form.temperature}
                  onChange={e => setForm(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#475569', marginTop: 4 }}>
                  <span>Precise</span><span>Balanced</span><span>Creative</span>
                </div>
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Max Tokens</label>
                <input
                  type="number" min="100" max="4000" step="100"
                  style={styles.input}
                  value={form.max_tokens}
                  onChange={e => setForm(prev => ({ ...prev, max_tokens: parseInt(e.target.value) }))}
                />
              </div>
            </div>

            {/* Test Connection Result */}
            {testResult && (
              <div style={styles.testResult(testResult.success)}>
                {testResult.success ? '✓' : '✗'} {testResult.message}
                {testResult.latency_ms && <span style={{ opacity: 0.7, marginLeft: 8 }}>({testResult.latency_ms}ms)</span>}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button
                type="button"
                style={styles.btnSecondary}
                onClick={handleTest}
                disabled={testing}
              >
                {testing ? '⏳ Testing...' : '🔌 Test Connection'}
              </button>
              <button type="submit" style={styles.btnPrimary} disabled={saving}>
                {saving ? '⏳ Saving...' : '💾 Save Configuration'}
              </button>
            </div>
          </form>

          {/* Current Status Card */}
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>📊 Current AI Status</h3>
            {config ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <StatusItem label="Status"   value={config.is_active ? 'Active ✓' : 'Inactive'} green={config.is_active} />
                <StatusItem label="Provider" value={config.provider} />
                <StatusItem label="Model"    value={config.model} />
                <StatusItem label="API Key"  value={config.key_configured ? 'Configured ✓' : 'Not Set'} green={config.key_configured} />
                <StatusItem label="Temperature" value={config.temperature} />
                <StatusItem label="Max Tokens"  value={config.max_tokens} />
                <StatusItem label="Last Updated" value={config.updated_at
                  ? new Date(config.updated_at).toLocaleString() : 'Never'} />
              </div>
            ) : (
              <div style={{ color: '#ef4444', fontSize: 13 }}>
                ⚠️ AI is not configured yet. Set up a provider above to enable 1P360 BOT.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Quotas Tab ─────────────────────────────────────────────────── */}
      {tab === 'Quotas' && (
        <div style={styles.grid2}>
          <form onSubmit={handleSetQuota} style={styles.card}>
            <h3 style={styles.cardTitle}>📊 Set Daily Query Limits</h3>
            <div style={styles.formGroup}>
              <label style={styles.label}>Role</label>
              <select
                style={styles.input}
                value={quotaForm.role}
                onChange={e => setQuotaForm(prev => ({ ...prev, role: e.target.value }))}
              >
                {['PRINCIPAL', 'VICE_PRINCIPAL', 'TEACHER', 'ACCOUNTANT', 'LIBRARIAN', 'HOSTEL', 'TRANSPORT'].map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Daily Limit (queries/day)</label>
              <input
                type="number" min="0" max="10000"
                style={styles.input}
                value={quotaForm.daily_limit}
                onChange={e => setQuotaForm(prev => ({ ...prev, daily_limit: parseInt(e.target.value) }))}
              />
            </div>
            <button type="submit" style={styles.btnPrimary}>
              💾 Set Limit
            </button>
          </form>

          <div style={styles.card}>
            <h3 style={styles.cardTitle}>📋 Current Quotas</h3>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 14 }}>
              School-specific overrides shown below. Global defaults used if not set.
            </div>

            {/* Default quotas */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', textTransform: 'uppercase', marginBottom: 8 }}>
                Global Defaults
              </div>
              {Object.entries(defaultQuotas).map(([role, limit]) => (
                <div key={role} style={styles.quotaRow}>
                  <span style={{ color: '#94a3b8', fontSize: 13 }}>{role}</span>
                  <span style={{ color: '#63b3ed', fontWeight: 600, fontSize: 13 }}>{limit}/day</span>
                </div>
              ))}
            </div>

            {/* Custom quotas */}
            {quotas.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', textTransform: 'uppercase', marginBottom: 8 }}>
                  Custom Overrides
                </div>
                {quotas.map(q => (
                  <div key={q.id} style={styles.quotaRow}>
                    <span style={{ color: '#94a3b8', fontSize: 13 }}>
                      {q.role} {q.school_id ? `(School ${q.school_id})` : '(Global)'}
                    </span>
                    <span style={{ color: '#34d399', fontWeight: 600, fontSize: 13 }}>
                      {q.daily_limit}/day
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Analytics Tab ──────────────────────────────────────────────── */}
      {tab === 'Analytics' && analytics && (
        <div>
          {/* Today Summary */}
          <div style={styles.analyticsGrid}>
            {[
              { label: 'Total Queries Today',   value: analytics.today.total_queries,   icon: '💬', color: '#3b82f6' },
              { label: 'Cache Hit Rate',         value: `${analytics.today.cache_hit_rate}%`, icon: '⚡', color: '#f59e0b' },
              { label: 'Avg Response Time',      value: `${analytics.today.avg_response_ms}ms`, icon: '⏱️', color: '#8b5cf6' },
              { label: 'Errors Today',           value: analytics.today.error_queries,   icon: '⚠️', color: '#ef4444' },
              { label: 'Total Tokens Today',     value: analytics.today.total_tokens.toLocaleString(), icon: '🔤', color: '#06b6d4' },
              { label: 'Estimated Cost Today',   value: `$${analytics.today.estimated_cost.toFixed(4)}`, icon: '💰', color: '#10b981' },
            ].map(stat => (
              <div key={stat.label} style={styles.statCard(stat.color)}>
                <div style={{ fontSize: 26, marginBottom: 8 }}>{stat.icon}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{stat.label}</div>
              </div>
            ))}
          </div>

          <div style={styles.grid2}>
            {/* By Role */}
            <div style={styles.card}>
              <h3 style={styles.cardTitle}>👥 Usage by Role</h3>
              {analytics.by_role.map(r => (
                <div key={r.role} style={styles.quotaRow}>
                  <span style={{ color: '#94a3b8', fontSize: 13 }}>{r.role}</span>
                  <span style={{ color: '#63b3ed', fontWeight: 600 }}>{r.queries} queries</span>
                </div>
              ))}
              {analytics.by_role.length === 0 && (
                <div style={{ color: '#475569', fontSize: 12 }}>No usage today yet.</div>
              )}
            </div>

            {/* By Intent */}
            <div style={styles.card}>
              <h3 style={styles.cardTitle}>🎯 Top Query Types</h3>
              {analytics.by_intent.slice(0, 8).map(i => (
                <div key={i.intent} style={styles.quotaRow}>
                  <span style={{ color: '#94a3b8', fontSize: 12 }}>{i.intent}</span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ color: '#f59e0b', fontSize: 11 }}>⚡{i.cache_hits}</span>
                    <span style={{ color: '#63b3ed', fontWeight: 600, fontSize: 12 }}>{i.queries}</span>
                  </div>
                </div>
              ))}
              {analytics.by_intent.length === 0 && (
                <div style={{ color: '#475569', fontSize: 12 }}>No queries today yet.</div>
              )}
            </div>

            {/* This Month */}
            <div style={styles.card}>
              <h3 style={styles.cardTitle}>📅 This Month</h3>
              <StatusItem label="Total Queries" value={analytics.this_month.total_queries.toLocaleString()} />
              <StatusItem label="Total Tokens"  value={analytics.this_month.total_tokens.toLocaleString()} />
              <StatusItem label="Estimated Cost" value={`$${analytics.this_month.estimated_cost.toFixed(4)}`} />
            </div>

            {/* Cache */}
            <div style={styles.card}>
              <h3 style={styles.cardTitle}>⚡ Cache Status</h3>
              <StatusItem label="Total Cache Entries" value={analytics.cache.total_entries} />
              <StatusItem label="Valid Entries"        value={analytics.cache.valid_entries} green />
              <StatusItem label="Expired Entries"      value={analytics.cache.total_entries - analytics.cache.valid_entries} />
            </div>
          </div>
        </div>
      )}

      {tab === 'Analytics' && !analytics && (
        <div style={styles.card}>
          <div style={{ color: '#475569', fontSize: 13 }}>No analytics data yet. Wait for AI queries to be processed.</div>
        </div>
      )}
    </div>
  );
}

function StatusItem({ label, value, green }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(99,179,237,0.08)' }}>
      <span style={{ fontSize: 12, color: '#64748b' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: green ? '#34d399' : '#94a3b8' }}>{String(value)}</span>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────

const styles = {
  page: {
    padding: '24px',
    background: '#0f172a',
    minHeight: '100vh',
    color: '#e2e8f0',
    fontFamily: "'Inter', system-ui, sans-serif",
  },
  loader: { color: '#64748b', textAlign: 'center', padding: 60, fontSize: 14 },
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 16 },
  headerIcon: {
    width: 52, height: 52, borderRadius: 14,
    background: 'linear-gradient(135deg, #1d4ed8, #7c3aed)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 26, flexShrink: 0,
    boxShadow: '0 0 24px rgba(59,130,246,0.35)',
  },
  title: { fontSize: 22, fontWeight: 700, margin: 0, color: '#e2e8f0' },
  subtitle: { fontSize: 13, color: '#64748b', margin: '4px 0 0', },
  statusBadge: (ok) => ({
    padding: '6px 16px', borderRadius: 20, fontSize: 12, fontWeight: 600,
    background: ok ? 'rgba(52,211,153,0.1)' : 'rgba(245,158,11,0.1)',
    border: `1px solid ${ok ? 'rgba(52,211,153,0.3)' : 'rgba(245,158,11,0.3)'}`,
    color: ok ? '#34d399' : '#f59e0b',
  }),
  statusBar: {
    display: 'flex', gap: 24, padding: '12px 20px', marginBottom: 20,
    background: 'rgba(30,41,59,0.5)', borderRadius: 10,
    border: '1px solid rgba(99,179,237,0.1)',
    flexWrap: 'wrap',
  },
  statusItem: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#94a3b8' },
  statusDot:  (ok) => ({
    width: 8, height: 8, borderRadius: '50%',
    background: ok ? '#22c55e' : '#ef4444',
    display: 'inline-block', marginRight: 2,
  }),
  notification: (type) => ({
    padding: '12px 16px', borderRadius: 10, marginBottom: 16, fontSize: 13,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: type === 'success' ? 'rgba(52,211,153,0.1)' : 'rgba(239,68,68,0.1)',
    border: `1px solid ${type === 'success' ? 'rgba(52,211,153,0.3)' : 'rgba(239,68,68,0.3)'}`,
    color: type === 'success' ? '#34d399' : '#fca5a5',
  }),
  notifClose: { background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 14 },
  tabBar: { display: 'flex', gap: 4, marginBottom: 20 },
  tabBtn: (active) => ({
    padding: '9px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
    fontSize: 13, fontWeight: active ? 600 : 400, transition: 'all 0.2s',
    background: active ? 'rgba(59,130,246,0.2)' : 'rgba(30,41,59,0.5)',
    color: active ? '#93c5fd' : '#64748b',
    borderBottom: active ? '2px solid #3b82f6' : '2px solid transparent',
  }),
  grid2: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: 20 },
  card: {
    background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(99,179,237,0.1)',
    borderRadius: 14, padding: '24px',
  },
  cardTitle: { fontSize: 15, fontWeight: 600, color: '#e2e8f0', marginBottom: 20, marginTop: 0 },
  formGroup: { marginBottom: 18 },
  formRow: { display: 'flex', gap: 16 },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' },
  input: {
    width: '100%', padding: '10px 14px', borderRadius: 9,
    background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(99,179,237,0.2)',
    color: '#e2e8f0', fontSize: 13, outline: 'none', boxSizing: 'border-box',
  },
  hint: { fontSize: 11, color: '#334155', marginTop: 6 },
  providerCards: { display: 'flex', gap: 12 },
  providerCard: (active) => ({
    flex: 1, padding: '14px 16px', borderRadius: 10, cursor: 'pointer',
    background: active ? 'rgba(59,130,246,0.15)' : 'rgba(15,23,42,0.6)',
    border: `1px solid ${active ? 'rgba(59,130,246,0.4)' : 'rgba(99,179,237,0.1)'}`,
    color: active ? '#93c5fd' : '#64748b', transition: 'all 0.2s',
    userSelect: 'none',
  }),
  testResult: (ok) => ({
    padding: '10px 14px', borderRadius: 8, fontSize: 12, marginTop: 12,
    background: ok ? 'rgba(52,211,153,0.08)' : 'rgba(239,68,68,0.08)',
    border: `1px solid ${ok ? 'rgba(52,211,153,0.25)' : 'rgba(239,68,68,0.25)'}`,
    color: ok ? '#34d399' : '#fca5a5',
  }),
  btnPrimary: {
    padding: '10px 22px', borderRadius: 9, border: 'none', cursor: 'pointer',
    background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
    color: 'white', fontSize: 13, fontWeight: 600, boxShadow: '0 4px 12px rgba(59,130,246,0.3)',
  },
  btnSecondary: {
    padding: '10px 22px', borderRadius: 9, cursor: 'pointer',
    background: 'rgba(99,179,237,0.1)', border: '1px solid rgba(99,179,237,0.2)',
    color: '#63b3ed', fontSize: 13, fontWeight: 600,
  },
  quotaRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '8px 0', borderBottom: '1px solid rgba(99,179,237,0.06)',
  },
  analyticsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14, marginBottom: 20 },
  statCard: (color) => ({
    background: 'rgba(30,41,59,0.6)', border: `1px solid ${color}25`,
    borderRadius: 12, padding: '18px 16px', textAlign: 'center',
  }),
};
