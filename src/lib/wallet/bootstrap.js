// Wallet bootstrap for NukeNote (BRC-7 first)
// - Detects and returns a stable CWI interface
// - Works with same-origin iframe (preferred) or window injection
// - No secrets, no mock data; leaves advanced methods to wallet implementation

const HANDSHAKE_TIMEOUT_MS = 5000;
const POLL_INTERVAL_MS = 150;

let cachedCWI = null;
let initialized = false;

function getIframe(iframeId = 'wallet-iframe') {
  try {
    return document.getElementById(iframeId) || null;
  } catch (err) {
    console.warn('Unable to access iframe element', err);
    return null;
  }
}

function isCWI(obj) {
  return !!obj && typeof obj.getVersion === 'function' && typeof obj.getNetwork === 'function';
}

function tryResolveFromIframe(iframe) {
  if (!iframe || !iframe.contentWindow) return null;
  const cwi = iframe.contentWindow.CWI;
  return isCWI(cwi) ? cwi : null;
}

function tryResolveFromWindow() {
  return isCWI(window.CWI) ? window.CWI : null;
}

async function waitForCWI({ iframeId = 'wallet-iframe', timeoutMs = HANDSHAKE_TIMEOUT_MS } = {}) {
  // Fast-path: cached
  if (cachedCWI && isCWI(cachedCWI)) return cachedCWI;

  // Fast-path: window injection present
  const fromWindow = tryResolveFromWindow();
  if (fromWindow) {
    cachedCWI = fromWindow;
    return cachedCWI;
  }

  // Try iframe
  const iframe = getIframe(iframeId);
  const t0 = Date.now();

  // Poll contentWindow.CWI while listening for readiness signals
  return await new Promise((resolve, reject) => {
    const maybeResolve = () => {
      const fromIframe = tryResolveFromIframe(iframe);
      if (fromIframe) {
        cachedCWI = fromIframe;
        cleanup();
        resolve(cachedCWI);
      }
    };

    const onMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data || {};
      if (data.type === 'CWI_READY' || data.type === 'BRC7_WALLET_READY') {
        // Give the iframe a tick to expose CWI
        setTimeout(maybeResolve, 50);
      }
    };

    const poll = setInterval(() => {
      if (Date.now() - t0 > timeoutMs) {
        cleanup();
        reject(new Error('CWI wait timeout'));
      } else {
        maybeResolve();
      }
    }, POLL_INTERVAL_MS);

    const cleanup = () => {
      clearInterval(poll);
      window.removeEventListener('message', onMessage);
    };

    window.addEventListener('message', onMessage);
    // Initial attempt in case it's already there
    maybeResolve();
  });
}

export async function bootstrapWallet(options = {}) {
  if (initialized && cachedCWI) return cachedCWI;

  // If iframe exists, proactively send REQUEST_CWI once it loads
  const iframe = getIframe(options.iframeId);
  if (iframe) {
    if (iframe.contentWindow) {
      iframe.contentWindow.postMessage({ type: 'REQUEST_CWI' }, window.location.origin);
    } else {
      iframe.addEventListener('load', () => {
        try {
          iframe.contentWindow?.postMessage({ type: 'REQUEST_CWI' }, window.location.origin);
        } catch (postMessageErr) {
          console.debug('Unable to postMessage REQUEST_CWI after iframe load', postMessageErr);
        }
      });
    }
  }

  const cwi = await waitForCWI({ iframeId: options.iframeId });
  initialized = true;
  return cwi;
}

export function getCWIUnsafe() {
  return cachedCWI || tryResolveFromWindow() || tryResolveFromIframe(getIframe());
}

// Convenience wrappers (will throw if not initialized)
export async function getVersion() {
  const cwi = getCWIUnsafe();
  if (!cwi) throw new Error('CWI not ready');
  return await cwi.getVersion();
}

export async function getNetwork() {
  const cwi = getCWIUnsafe();
  if (!cwi) throw new Error('CWI not ready');
  return await cwi.getNetwork();
}
