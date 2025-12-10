// React hook to bootstrap and expose the wallet CWI with status flags
// Usage: const { ready, error, cwi, version, network, refresh } = useWallet();

import { useEffect, useState, useCallback } from 'react';
import { bootstrapWallet, getCWIUnsafe, getVersion as cwiGetVersion, getNetwork as cwiGetNetwork } from '../lib/wallet/bootstrap.js';

export default function useWallet(options = {}) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [cwi, setCwi] = useState(null);
  const [version, setVersion] = useState(null);
  const [network, setNetwork] = useState(null);

  const hydrate = useCallback(async () => {
    try {
      setError(null);
      const c = await bootstrapWallet({ iframeId: options.iframeId || 'wallet-iframe' });
      setCwi(c);
      setReady(true);
      try {
        const [v, n] = await Promise.all([cwiGetVersion(), cwiGetNetwork()]);
        setVersion(v);
        setNetwork(n);
      } catch (inner) {
        // keep CWI ready but record metadata retrieval error
        console.warn('Wallet metadata fetch failed:', inner);
      }
    } catch (e) {
      setError(e);
      setReady(false);
    }
  }, [options.iframeId]);

  useEffect(() => {
    // Attempt immediate hydrate on mount (post-mount only)
    hydrate();
    // Also listen for CWI readiness signals to rehydrate
    const onMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data || {};
      if (data.type === 'CWI_READY' || data.type === 'BRC7_WALLET_READY') {
        // small delay to allow iframe exposure
        setTimeout(() => hydrate(), 25);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [hydrate]);

  const refresh = useCallback(async () => {
    const current = getCWIUnsafe();
    if (current) setCwi(current);
    await hydrate();
  }, [hydrate]);

  return { ready, error, cwi, version, network, refresh };
}
