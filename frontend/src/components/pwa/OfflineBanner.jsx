import React, { useState, useEffect, useRef } from 'react';
import useNetworkStatus from '../../hooks/useNetworkStatus';

// Small delay so the "Back online" confirmation is visible before the
// banner disappears, instead of vanishing the instant connectivity returns.
const RECONNECTED_DISPLAY_MS = 2200;

export default function OfflineBanner() {
  const { isOnline, isSlowConnection } = useNetworkStatus();
  const [showReconnected, setShowReconnected] = useState(false);
  const wasOfflineBefore = useRef(false);

  useEffect(() => {
    if (!isOnline) {
      wasOfflineBefore.current = true;
      setShowReconnected(false);
      return;
    }

    if (isOnline && wasOfflineBefore.current) {
      wasOfflineBefore.current = false;
      setShowReconnected(true);
      const timer = setTimeout(() => setShowReconnected(false), RECONNECTED_DISPLAY_MS);
      return () => clearTimeout(timer);
    }
  }, [isOnline]);

  const handleRetry = () => {
    window.location.reload();
  };

  if (isOnline && !showReconnected && !isSlowConnection) return null;

  return (
    <div style={styles.wrap(isOnline ? (showReconnected ? 'success' : 'slow') : 'offline')}>
      {!isOnline && (
        <>
          <i className="ti ti-wifi-off" style={styles.icon} />
          <span style={styles.text}>You're offline — showing cached data where available.</span>
          <button type="button" onClick={handleRetry} style={styles.retryBtn}>
            <i className="ti ti-refresh" style={{ marginRight: 6 }} />
            Retry
          </button>
        </>
      )}

      {isOnline && showReconnected && (
        <>
          <i className="ti ti-wifi" style={styles.icon} />
          <span style={styles.text}>Back online.</span>
        </>
      )}

      {isOnline && !showReconnected && isSlowConnection && (
        <>
          <i className="ti ti-signal-2g" style={styles.icon} />
          <span style={styles.text}>Slow connection detected — some things may take longer to load.</span>
        </>
      )}
    </div>
  );
}

const styles = {
  wrap: (variant) => ({
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: '10px 16px',
    fontSize: 14,
    fontWeight: 500,
    color: '#fff',
    background:
      variant === 'offline' ? '#dc2626' : variant === 'success' ? '#16a34a' : '#f59e0b',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
  }),
  icon: { fontSize: 18, flexShrink: 0 },
  text: { textAlign: 'center' },
  retryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    marginLeft: 8,
    padding: '4px 12px',
    fontSize: 13,
    fontWeight: 600,
    color: '#dc2626',
    background: '#fff',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
  },
};
