import { useState, useEffect } from 'react';
import { CONFIG } from '@/lib/config';

/**
 * Hook to check helper cache server health
 * Returns status from the /status endpoint
 */
export function useHelperCacheHealth() {
  const [health, setHealth] = useState({
    available: false,
    status: 'checking',
    uptime: null,
    entries: null,
    error: null,
  });

  useEffect(() => {
    const endpoint = CONFIG.HELPER_CACHE_ENDPOINT;
    
    if (!endpoint) {
      setHealth({
        available: false,
        status: 'not-configured',
        uptime: null,
        entries: null,
        error: 'Helper cache endpoint not configured',
      });
      return;
    }

    let cancelled = false;

    async function checkHealth() {
      try {
        const response = await fetch(`${endpoint}/status`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (cancelled) return;

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        setHealth({
          available: true,
          status: data.status || 'ok',
          uptime: data.uptime,
          entries: data.entries,
          error: null,
        });
      } catch (err) {
        if (cancelled) return;
        
        setHealth({
          available: false,
          status: 'unavailable',
          uptime: null,
          entries: null,
          error: err.message,
        });
      }
    }

    // Check immediately
    checkHealth();

    // Check every 30 seconds
    const interval = setInterval(checkHealth, 30000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return health;
}
