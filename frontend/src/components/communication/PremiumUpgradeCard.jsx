import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';

/**
 * PremiumUpgradeCard
 * Self-contained — fetches /api/support/plans/my-plan itself.
 *
 * Props:
 *  - darkMode
 *  - variant : 'full' (default, big card for MyServices/dashboard pages)
 *              | 'banner' (slim inline strip — e.g. top of SupportInbox)
 *  - reason  : optional override message (e.g. from a 429 weekly_limit_reached response)
 */
export default function PremiumUpgradeCard({ darkMode, variant = 'full', reason }) {
  const navigate = useNavigate();
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/support/plans/my-plan')
      .then(r => setPlan(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (!plan || plan.is_premium) return null; // already premium — nothing to upsell

  const border  = darkMode ? '#1e293b' : '#e2e8f0';
  const used    = plan.used_this_week ?? 0;
  const limit   = plan.limit ?? 1;
  const pct     = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;

  const requestUpgrade = () => {
    navigate('/support/tickets/new', {
      state: {
        prefill: {
          subject:  'Premium Support Upgrade Request',
          category: 'GENERAL',
          priority: 'MEDIUM',
          description: 'We would like to activate the Premium Support plan (₹299/month). Please contact our office.',
        },
      },
    });
  };

  // ── Slim banner variant ──────────────────────────────────────────────────
  if (variant === 'banner') {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 16px', borderRadius: 10, marginBottom: 16,
        background: darkMode ? 'rgba(217,119,6,0.1)' : '#fffbeb',
        border: `1px solid ${darkMode ? 'rgba(217,119,6,0.3)' : '#fde68a'}`,
      }}>
        <i className="ti ti-rocket" style={{ fontSize: 18, color: '#d97706', flexShrink: 0 }} aria-hidden="true" />
        <div style={{ flex: 1, fontSize: 12.5, color: darkMode ? '#fcd34d' : '#92400e' }}>
          {reason || `You have utilized ${used}/${limit} support requests this week.`}{' '}
          <strong>Premium Support — ₹299/month</strong> se unlimited assistance milegi.
        </div>
        <button onClick={requestUpgrade} style={{
          flexShrink: 0, padding: '6px 14px', borderRadius: 8, border: 'none',
          background: '#d97706', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
        }}>
          Upgrade
        </button>
      </div>
    );
  }

  // ── Full card variant ────────────────────────────────────────────────────
  return (
    <div style={{
      borderRadius: 14, border: `1px solid ${border}`, overflow: 'hidden',
      background: darkMode ? '#141b2d' : '#fff',
    }}>
      <div style={{
        padding: '18px 20px',
        background: darkMode
          ? 'linear-gradient(135deg, rgba(124,58,237,0.18), rgba(79,70,229,0.1))'
          : 'linear-gradient(135deg, #f5f3ff, #eef2ff)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <i className="ti ti-crown" style={{ fontSize: 20, color: '#7c3aed' }} aria-hidden="true" />
          <span style={{ fontSize: 16, fontWeight: 800, color: darkMode ? '#f1f5f9' : '#1e1b4b' }}>
            Premium Support
          </span>
          <span style={{
            marginLeft: 'auto', fontSize: 18, fontWeight: 800,
            color: darkMode ? '#f1f5f9' : '#1e1b4b',
          }}>
            ₹{plan.upgrade_price}<span style={{ fontSize: 11, fontWeight: 500, opacity: 0.7 }}>/month</span>
          </span>
        </div>

        {/* Usage bar */}
        <div style={{ marginTop: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4, color: darkMode ? '#cbd5e1' : '#475569' }}>
            <span>This week's usage</span>
            <span style={{ fontWeight: 700 }}>{used} / {limit} requests</span>
          </div>
          <div style={{ height: 6, borderRadius: 99, background: darkMode ? '#1e293b' : '#e2e8f0' }}>
            <div style={{
              width: `${pct}%`, height: '100%', borderRadius: 99,
              background: pct >= 100 ? '#dc2626' : '#7c3aed', transition: 'width 0.4s',
            }} />
          </div>
        </div>
      </div>

      <div style={{ padding: '16px 20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
          {(plan.upgrade_benefits || []).map((b, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12, color: darkMode ? '#cbd5e1' : '#334155' }}>
              <i className="ti ti-check" style={{ fontSize: 13, color: '#16a34a', marginTop: 2, flexShrink: 0 }} aria-hidden="true" />
              {b}
            </div>
          ))}
        </div>
        <button onClick={requestUpgrade} style={{
          width: '100%', padding: '10px 0', borderRadius: 8, border: 'none',
          background: '#7c3aed', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <i className="ti ti-rocket" style={{ fontSize: 14 }} aria-hidden="true" /> Request Upgrade
        </button>
      </div>
    </div>
  );
}
