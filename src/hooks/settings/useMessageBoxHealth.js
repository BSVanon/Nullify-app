import { useEffect, useState } from 'react';

const DEFAULT_HEALTH = {
  status: 'unknown',
  lastError: null,
  lastOkAt: null,
  lastCheckedAt: null,
};

/**
 * Subscribe to MessageBox / PeerPay health updates pushed from wallet helpers.
 *
 * The wallet layer updates `window.__NULLIFY_MESSAGEBOX_HEALTH__` and emits
 * a `nullify:messagebox-health` event whenever status changes. This hook
 * turns that into reactive state for the diagnostics UI.
 */
export function useMessageBoxHealth() {
  const [health, setHealth] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_HEALTH;
    const existing = window.__NULLIFY_MESSAGEBOX_HEALTH__;
    return existing ? { ...DEFAULT_HEALTH, ...existing } : DEFAULT_HEALTH;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handler = (event) => {
      if (!event || !event.detail) return;
      setHealth((prev) => ({ ...prev, ...event.detail }));
    };

    window.addEventListener('nullify:messagebox-health', handler);

    // Sync with any state that might have been set before we subscribed
    const current = window.__NULLIFY_MESSAGEBOX_HEALTH__;
    if (current) {
      setHealth((prev) => ({ ...prev, ...current }));
    }

    return () => {
      window.removeEventListener('nullify:messagebox-health', handler);
    };
  }, []);

  return health;
}
