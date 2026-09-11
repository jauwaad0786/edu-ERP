import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar  from '../components/Navbar';
import api     from '../api/axios';

const TIER_ORDER = ['BASIC', 'PROFESSIONAL', 'ENTERPRISE'];

const TIER_COLORS = {
  BASIC:        { bg: '#f1f5f9', text: '#475569', border: '#e2e8f0' },
  PROFESSIONAL: { bg: '#dbeafe', text: '#1d4ed8', border: '#bfdbfe' },
  ENTERPRISE:   { bg: '#fef3c7', text: '#92400e', border: '#fde68a' },
};

export default function MyServices() {
  const [data,        setData]        = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [upgradeInfo, setUpgradeInfo] = useState(null); // { tier, label, price }

  useEffect(() => {
    api.get('/principal/my-services')
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const fmtPrice = p => `₹${Number(p || 0).toLocaleString('en-IN')}`;

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar title="My Plan & Services" />
        <div className="page-body">

          <div className="page-header" style={{ marginBottom: 20 }}>
            <h2 className="page-title">⚡ My Plan & Services</h2>
            <p className="page-subtitle">
              A list of services available to your school. Locked services will
              unlock when you upgrade your plan.
            </p>
          </div>

          {loading && (
            <div style={{ color: '#94a3b8', fontSize: 13, padding: '40px 0', textAlign: 'center' }}>
              Loading...
            </div>
          )}

          {!loading && data && (
            <>
              {/* Current plan banner */}
              <div style={{
                background: 'linear-gradient(135deg, #0176d3, #5867e8)',
                borderRadius: 14, padding: '22px 26px', marginBottom: 24,
                color: '#fff', display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', flexWrap: 'wrap', gap: 12,
              }}>
                <div>
                  <div style={{ fontSize: 11, opacity: 0.8, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    Current Plan
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>
                    {data.current_plan === 'PROFESSIONAL' ? 'Professional' :
                     data.current_plan === 'ENTERPRISE'   ? 'Enterprise'   : 'Basic'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 24, fontWeight: 800 }}>{fmtPrice(data.current_price)}</div>
                  <div style={{ fontSize: 11, opacity: 0.85 }}>per month</div>
                </div>
              </div>

              {/* Feature list grouped by tier */}
              {TIER_ORDER.map(tier => {
                const tierFeatures = data.features.filter(f => f.tier === tier);
                if (!tierFeatures.length) return null;
                const colors = TIER_COLORS[tier];
                const tierInfo = data.pricing[tier];

                return (
                  <div key={tier} style={{ marginBottom: 24 }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12,
                    }}>
                      <span style={{
                        fontSize: 11, fontWeight: 800, padding: '4px 12px', borderRadius: 20,
                        background: colors.bg, color: colors.text, border: `1px solid ${colors.border}`,
                        textTransform: 'uppercase', letterSpacing: '0.04em',
                      }}>
                        {tierInfo?.label || tier}
                      </span>
                      <span style={{ fontSize: 12, color: '#94a3b8' }}>
                        {fmtPrice(tierInfo?.price)}/month
                      </span>
                    </div>

                    <div style={{
                      display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                      gap: 12,
                    }}>
                      {tierFeatures.map(f => (
                        <div key={f.key}
                          role={!f.is_active ? 'button' : undefined}
                          tabIndex={!f.is_active ? 0 : undefined}
                          onClick={() => !f.is_active && setUpgradeInfo({
                            tier: f.tier, label: f.tier_label, price: f.tier_price, feature: f.label,
                          })}
                          onKeyDown={e => {
                            if (!f.is_active && (e.key === 'Enter' || e.key === ' ')) {
                              e.preventDefault();
                              setUpgradeInfo({
                                tier: f.tier, label: f.tier_label, price: f.tier_price, feature: f.label,
                              });
                            }
                          }}
                          style={{
                            position: 'relative',
                            background: f.is_active ? '#fff' : '#f8fafc',
                            border: f.is_active ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
                            borderRadius: 10, padding: '14px 16px',
                            cursor: f.is_active ? 'default' : 'pointer',
                            opacity: f.is_active ? 1 : 0.6,
                            transition: 'all 0.15s',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            gap: 10,
                          }}
                          onMouseEnter={e => { if (!f.is_active) e.currentTarget.style.opacity = 0.85; }}
                          onMouseLeave={e => { if (!f.is_active) e.currentTarget.style.opacity = 0.6; }}
                        >
                          <span style={{
                            fontSize: 13, fontWeight: 600,
                            color: f.is_active ? '#0f172a' : '#94a3b8',
                          }}>
                            {f.label}
                          </span>
                          {f.is_active ? (
                            <span style={{
                              fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 20,
                              background: '#dcfce7', color: '#16a34a', flexShrink: 0,
                            }}>
                              ✅ Active
                            </span>
                          ) : (
                            <span style={{
                              fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 20,
                              background: '#f1f5f9', color: '#64748b', flexShrink: 0,
                              display: 'flex', alignItems: 'center', gap: 3,
                            }}>
                              🔒 Locked
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </>
          )}

        </div>
      </div>

      {/* ── Upgrade prompt modal ── */}
      {upgradeInfo && (
        <div className="modal-backdrop"
          role="button"
          tabIndex={0}
          aria-label="Close modal"
          onClick={e => e.target === e.currentTarget && setUpgradeInfo(null)}
          onKeyDown={e => e.key === 'Escape' && setUpgradeInfo(null)}>
          <div className="modal" style={{ maxWidth: 380 }}>
            <div className="modal-header">
              <h3>🔒 Locked Feature</h3>
              <button className="modal-close" onClick={() => setUpgradeInfo(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ textAlign: 'center', padding: '24px 20px' }}>
              <div style={{ fontSize: 38, marginBottom: 10 }}>⚡</div>
              <p style={{ fontSize: 14, color: '#0f172a', fontWeight: 600, marginBottom: 6 }}>
                "{upgradeInfo.feature}" is not available yet.
              </p>
              <p style={{ fontSize: 13, color: '#64748b', marginBottom: 18 }}>
                This feature is included in the <strong>{upgradeInfo.label}</strong> plan
                ({fmtPrice(upgradeInfo.price)}/month). Please contact your admin to upgrade.
              </p>
              <button onClick={() => setUpgradeInfo(null)} style={{
                width: '100%', padding: '11px', borderRadius: 8, border: 'none',
                background: 'var(--blue-60)', color: '#fff',
                cursor: 'pointer', fontSize: 13, fontWeight: 600,
              }}>
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
