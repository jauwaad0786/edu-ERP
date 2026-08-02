import React, { useState, useEffect, useCallback } from 'react';

const DISMISS_KEY = 'op360_install_prompt_dismissed_at';
const DISMISS_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000; // 30 days — "never annoy user"

function wasRecentlyDismissed() {
  const raw = localStorage.getItem(DISMISS_KEY);
  if (!raw) return false;
  const dismissedAt = Number(raw);
  if (Number.isNaN(dismissedAt)) return false;
  return Date.now() - dismissedAt < DISMISS_COOLDOWN_MS;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      if (wasRecentlyDismissed()) return;
      setDeferredPrompt(event);
      setVisible(true);
    };

    const handleAppInstalled = () => {
      setVisible(false);
      setDeferredPrompt(null);
      localStorage.removeItem(DISMISS_KEY);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    // Whether accepted or dismissed via the native prompt, the browser
    // consumes the event either way — it can't be reused.
    setDeferredPrompt(null);
    setVisible(false);
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  }, []);

  if (!visible || !deferredPrompt) return null;

  return (
    <div style={styles.wrap}>
      <div style={styles.iconBadge}>
        <span style={{ color: '#ff8a00' }}>1</span>
        <span style={{ color: '#fff' }}>P</span>
      </div>
      <div style={styles.body}>
        <div style={styles.title}>Install OP360 EduERP</div>
        <div style={styles.subtitle}>Add to your home screen for faster, app-like access.</div>
      </div>
      <div style={styles.actions}>
        <button type="button" onClick={handleDismiss} style={styles.dismissBtn} aria-label="Dismiss">
          <i className="ti ti-x" />
        </button>
        <button type="button" onClick={handleInstall} style={styles.installBtn}>
          Install
        </button>
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    position: 'fixed',
    left: 16,
    right: 16,
    bottom: 16,
    maxWidth: 420,
    margin: '0 auto',
    zIndex: 9998,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '14px 16px',
    background: '#ffffff',
    borderRadius: 14,
    boxShadow: '0 8px 24px rgba(10, 27, 61, 0.22)',
    border: '1px solid rgba(10, 27, 61, 0.08)',
  },
  iconBadge: {
    flexShrink: 0,
    width: 44,
    height: 44,
    borderRadius: 12,
    background: 'linear-gradient(135deg, #0d2c63 0%, #0a1b3d 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: 16,
  },
  body: { flex: 1, minWidth: 0 },
  title: { fontSize: 14, fontWeight: 700, color: '#0a1b3d' },
  subtitle: { fontSize: 12.5, color: '#6b7280', marginTop: 2 },
  actions: { display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 },
  dismissBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    border: 'none',
    background: 'transparent',
    color: '#9ca3af',
    cursor: 'pointer',
    borderRadius: 8,
    fontSize: 16,
  },
  installBtn: {
    padding: '8px 16px',
    fontSize: 13,
    fontWeight: 700,
    color: '#fff',
    background: '#0176d3',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
};
