import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api     from '../../api/axios';
import toast   from 'react-hot-toast';

export default function WhatsAppSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [copied, setCopied] = useState(false);

  const [settings, setSettings] = useState(null);

  const [form, setForm] = useState({
    business_name: '', business_phone: '', phone_number_id: '', business_account_id: '',
    access_token: '', app_secret: '', verify_token: '', app_id: '', api_version: 'v21.0',
  });

  const load = () => {
    setLoading(true);
    api.get('/principal/whatsapp/settings')
      .then(r => {
        setSettings(r.data);
        setForm(f => ({
          ...f,
          business_name: r.data.business_name,
          business_phone: r.data.business_phone,
          phone_number_id: r.data.phone_number_id,
          business_account_id: r.data.business_account_id,
          verify_token: r.data.verify_token,
          app_id: r.data.app_id,
          api_version: r.data.api_version,
          access_token: '', // masked value kabhi input mein nahi daalte
          app_secret: '',
        }));
      })
      .catch(() => toast.error('Settings load nahi hui'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form };
      // Empty token fields mat bhejo — matlab user ne change nahi kiya
      if (!payload.access_token) delete payload.access_token;
      if (!payload.app_secret)   delete payload.app_secret;

      const r = await api.post('/principal/whatsapp/settings', payload);
      setSettings(r.data);
      setForm(f => ({ ...f, access_token: '', app_secret: '' }));
      toast.success('✅ Configuration saved!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save nahi hua');
    }
    setSaving(false);
  }

  async function handleVerify() {
    setVerifying(true);
    try {
      const r = await api.post('/principal/whatsapp/settings/verify');
      toast.success(r.data.message || 'Connected!');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Verification fail hua');
      load();
    }
    setVerifying(false);
  }

  async function handleDisconnect() {
    if (!window.confirm('WhatsApp disconnect karna chahte ho? Saved token clear ho jayega.')) return;
    setDisconnecting(true);
    try {
      await api.delete('/principal/whatsapp/settings');
      toast.success('Disconnected');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Disconnect nahi hua');
    }
    setDisconnecting(false);
  }

  function copyWebhook() {
    if (!settings?.webhook_url) return;
    navigator.clipboard.writeText(settings.webhook_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const STATUS_STYLE = {
    CONNECTED:    { bg: '#f0fdf4', color: '#16a34a', label: '🟢 Connected' },
    DISCONNECTED: { bg: '#f1f5f9', color: '#64748b', label: '⚪ Disconnected' },
    FAILED:       { bg: '#fef2f2', color: '#dc2626', label: '🔴 Failed' },
  };

  if (loading) {
    return (
      <div className="app-shell">
        <Sidebar />
        <div className="main-content">
          <Navbar title="WhatsApp Integration" />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#64748b' }}>
            ⏳ Loading...
          </div>
        </div>
      </div>
    );
  }

  const statusInfo = STATUS_STYLE[settings?.connection_status] || STATUS_STYLE.DISCONNECTED;

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar title="WhatsApp Integration" />
        <div className="page-body">

          {/* ── Header ── */}
          <div className="page-header">
            <div>
              <h2 className="page-title">💬 WhatsApp Cloud API</h2>
              <p className="page-subtitle">
                Apna Meta WhatsApp Business Account connect karo — fee reminders, attendance alerts, aur announcements bhejne ke liye
              </p>
            </div>
            <span style={{
              background: statusInfo.bg, color: statusInfo.color,
              borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700,
            }}>
              {statusInfo.label}
            </span>
          </div>

          <div style={{ maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* ── Status Card ── */}
            <div className="card" style={{ margin: 0 }}>
              <div className="card-body" style={{ padding: '18px 24px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Last Sync</div>
                    <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>
                      {settings?.last_sync ? new Date(settings.last_sync).toLocaleString('en-IN') : '—'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Last Test</div>
                    <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>
                      {settings?.last_test ? new Date(settings.last_test).toLocaleString('en-IN') : '—'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Result</div>
                    <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4, color: statusInfo.color }}>
                      {settings?.last_test_result || '—'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <form onSubmit={handleSave}>

              {/* ── Business Information ── */}
              <div className="card" style={{ margin: 0, marginBottom: 20 }}>
                <div className="card-header"><h4 style={{ margin: 0 }}>🏢 Business Information</h4></div>
                <div className="card-body" style={{ padding: 24 }}>
                  <div className="form-group" style={{ marginBottom: 16 }}>
                    <label className="form-label">Business Name</label>
                    <input className="form-input" value={form.business_name}
                      onChange={e => setForm(f => ({ ...f, business_name: e.target.value }))}
                      placeholder="e.g. Delhi Public School" />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                    <div className="form-group">
                      <label className="form-label">Business Phone Number</label>
                      <input className="form-input" value={form.business_phone}
                        onChange={e => setForm(f => ({ ...f, business_phone: e.target.value }))}
                        placeholder="+91 98765 43210" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Phone Number ID *</label>
                      <input className="form-input" value={form.phone_number_id}
                        onChange={e => setForm(f => ({ ...f, phone_number_id: e.target.value }))}
                        placeholder="From Meta Business Suite" required />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">WhatsApp Business Account ID</label>
                    <input className="form-input" value={form.business_account_id}
                      onChange={e => setForm(f => ({ ...f, business_account_id: e.target.value }))}
                      placeholder="WABA ID" />
                  </div>
                </div>
              </div>

              {/* ── Authentication ── */}
              <div className="card" style={{ margin: 0, marginBottom: 20 }}>
                <div className="card-header"><h4 style={{ margin: 0 }}>🔐 Authentication</h4></div>
                <div className="card-body" style={{ padding: 24 }}>
                  <div className="form-group" style={{ marginBottom: 16 }}>
                    <label className="form-label">Permanent Access Token *</label>
                    <input className="form-input" type="password" value={form.access_token}
                      onChange={e => setForm(f => ({ ...f, access_token: e.target.value }))}
                      placeholder={settings?.access_token_masked ? settings.access_token_masked : 'Meta se generated access token paste karo'} />
                    {settings?.has_access_token && (
                      <div style={{ fontSize: 11, color: '#16a34a', marginTop: 4 }}>
                        ✓ Token saved ({settings.access_token_masked}) — nayi value type karo sirf change karne ke liye
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                    <div className="form-group">
                      <label className="form-label">Webhook Verify Token</label>
                      <input className="form-input" value={form.verify_token}
                        onChange={e => setForm(f => ({ ...f, verify_token: e.target.value }))}
                        placeholder="apna custom verify token banao" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">App ID</label>
                      <input className="form-input" value={form.app_id}
                        onChange={e => setForm(f => ({ ...f, app_id: e.target.value }))}
                        placeholder="Meta App ID" />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                    <div className="form-group">
                      <label className="form-label">App Secret <span style={{ color: '#94a3b8', fontWeight: 400 }}>(optional)</span></label>
                      <input className="form-input" type="password" value={form.app_secret}
                        onChange={e => setForm(f => ({ ...f, app_secret: e.target.value }))}
                        placeholder={settings?.app_secret_masked ? settings.app_secret_masked : 'Optional'} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">API Version</label>
                      <input className="form-input" value={form.api_version}
                        onChange={e => setForm(f => ({ ...f, api_version: e.target.value }))}
                        placeholder="v21.0" />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Webhook URL <span style={{ color: '#94a3b8', fontWeight: 400 }}>(read-only — Meta dashboard mein paste karo)</span></label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input className="form-input" readOnly value={settings?.webhook_url || ''}
                        style={{ background: '#f8fafc', color: '#64748b' }} />
                      <button type="button" onClick={copyWebhook} style={{
                        background: copied ? '#16a34a' : '#0176d3', color: '#fff', border: 'none',
                        borderRadius: 6, padding: '0 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                      }}>
                        {copied ? '✅ Copied' : '📋 Copy'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Actions ── */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button type="submit" disabled={saving} className="btn btn-primary" style={{ minWidth: 160 }}>
                  {saving ? '⏳ Saving...' : '💾 Save Configuration'}
                </button>
                <button type="button" onClick={handleVerify} disabled={verifying || !settings?.phone_number_id} style={{
                  background: '#eff6ff', color: '#0176d3', border: 'none', borderRadius: 8,
                  padding: '10px 20px', fontSize: 13, fontWeight: 700,
                  cursor: (verifying || !settings?.phone_number_id) ? 'not-allowed' : 'pointer',
                  opacity: (verifying || !settings?.phone_number_id) ? 0.6 : 1,
                }}>
                  {verifying ? '⏳ Testing...' : '🔍 Test Connection'}
                </button>
                {settings?.connection_status === 'CONNECTED' && (
                  <button type="button" onClick={handleDisconnect} disabled={disconnecting} style={{
                    background: '#fef2f2', color: '#dc2626', border: 'none', borderRadius: 8,
                    padding: '10px 20px', fontSize: 13, fontWeight: 700,
                    cursor: disconnecting ? 'not-allowed' : 'pointer',
                  }}>
                    {disconnecting ? '⏳ Disconnecting...' : '🔌 Disconnect'}
                  </button>
                )}
              </div>
            </form>

            {/* Note */}
            <div style={{
              background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10,
              padding: '14px 18px', fontSize: 12, color: '#1e40af', lineHeight: 1.7,
            }}>
              <strong>📌 Setup steps:</strong> Meta Business Suite → WhatsApp → API Setup se Phone Number ID
              aur Permanent Access Token le lo → yahan paste karo → <strong>Save Configuration</strong> →
              phir <strong>Test Connection</strong> click karo. Webhook URL upar se copy karke Meta ke
              Webhook config mein daal do.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
