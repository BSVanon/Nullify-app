// Parent<->Iframe RPC proxy bridge for wallet calls via postMessage
// This is future-proof for cross-origin iframes. In same-origin, prefer direct CWI.
// Schema:
//  Parent -> Iframe: { action: 'proxyRpcCall', method, params, requestId, pageId }
//  Iframe -> Parent: { type: 'RPC_RESULT', requestId, payload: { ok: boolean, result?, error? }, pageId }

const DEFAULT_TIMEOUT = 8000;

function uuidv4() {
  // RFC4122-ish simple generator for request correlation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export function createRpcProxy(targetWindow, origin, { pageId = Math.floor(Math.random()*2**31) } = {}) {
  if (!targetWindow || !origin) throw new Error('createRpcProxy requires targetWindow and origin');

  const pending = new Map();

  const onMessage = (event) => {
    if (event.origin !== origin) return;
    const data = event.data || {};
    if (data && data.type === 'RPC_RESULT' && data.pageId === pageId) {
      const { requestId, payload } = data;
      const entry = pending.get(requestId);
      if (!entry) return;
      pending.delete(requestId);
      if (payload && payload.ok) {
        entry.resolve(payload.result);
      } else {
        const errMsg = payload && payload.error ? payload.error : 'RPC error';
        entry.reject(new Error(errMsg));
      }
    }
  };

  window.addEventListener('message', onMessage);

  const call = (method, params, timeoutMs = DEFAULT_TIMEOUT) => {
    return new Promise((resolve, reject) => {
      const requestId = uuidv4();
      const timer = setTimeout(() => {
        pending.delete(requestId);
        reject(new Error(`RPC timeout for ${method}`));
      }, timeoutMs);
      pending.set(requestId, {
        resolve: (v) => { clearTimeout(timer); resolve(v); },
        reject: (e) => { clearTimeout(timer); reject(e); }
      });

      const message = { action: 'proxyRpcCall', method, data: params, pageId, requestId };
      try {
        targetWindow.postMessage(message, origin);
      } catch (e) {
        clearTimeout(timer);
        pending.delete(requestId);
        reject(e);
      }
    });
  };

  // Construct a proxy object with known wallet methods
  const api = {};
  const methods = [
    'getVersion','getNetwork','getPublicKey','createAction','encrypt','decrypt',
    'createSignature','verifySignature','createHmac','verifyHmac','findCertificates',
    'isAuthenticated','waitForAuthentication'
  ];
  for (const m of methods) {
    api[m] = (params) => call(m, params);
  }

  api.__teardown = () => {
    window.removeEventListener('message', onMessage);
    pending.clear();
  };

  return api;
}
