import { useState, useEffect, useCallback } from 'react';

/**
 * useNetworkStatus
 *
 * Tracks connectivity for offline banners / network-aware UI.
 *
 * Returns:
 *   - isOnline: boolean          (navigator.onLine + online/offline events)
 *   - isSlowConnection: boolean  (best-effort — Network Information API;
 *                                 unsupported browsers like Safari/iOS
 *                                 always report false, never a false "slow")
 *   - effectiveType: string|null ('slow-2g' | '2g' | '3g' | '4g' | null)
 *   - wasOffline: boolean        (true once the connection has dropped at
 *                                 least once this session — useful for
 *                                 showing a one-time "reconnected" toast)
 */
export default function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(!navigator.onLine);
  const [effectiveType, setEffectiveType] = useState(getEffectiveType());

  const handleOnline = useCallback(() => setIsOnline(true), []);
  const handleOffline = useCallback(() => {
    setIsOnline(false);
    setWasOffline(true);
  }, []);
  const handleConnectionChange = useCallback(() => {
    setEffectiveType(getEffectiveType());
  }, []);

  useEffect(() => {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const connection = getConnection();
    if (connection && connection.addEventListener) {
      connection.addEventListener('change', handleConnectionChange);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (connection && connection.removeEventListener) {
        connection.removeEventListener('change', handleConnectionChange);
      }
    };
  }, [handleOnline, handleOffline, handleConnectionChange]);

  const isSlowConnection = effectiveType === 'slow-2g' || effectiveType === '2g';

  return { isOnline, isSlowConnection, effectiveType, wasOffline };
}

function getConnection() {
  return (
    navigator.connection || navigator.mozConnection || navigator.webkitConnection || null
  );
}

function getEffectiveType() {
  const connection = getConnection();
  return connection && connection.effectiveType ? connection.effectiveType : null;
}
