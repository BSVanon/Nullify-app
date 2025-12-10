// BRC-6 RPC proxy: child page -> parent wallet (XDM) via postMessage
// Schema matches test-wallets/brc6-test-wallet/index.html implementation:
// Child -> Parent: { type: 'CWI', id, call, params }
// Parent -> Child: { type: 'CWI', id, result } or { type: 'CWI', id, status:'error', code, description }

const DEFAULT_TIMEOUT = 8000;

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export function createBrc6Proxy(targetWindow, origin, { timeoutMs = DEFAULT_TIMEOUT } = {}) {
  if (!targetWindow || !origin) throw new Error('createBrc6Proxy requires targetWindow and origin');

  const pending = new Map();

  const onMessage = (event) => {
    if (event.origin !== origin) return;
    const data = event.data || {};
    if (!data || data.type !== 'CWI' || !data.id) return;
    const entry = pending.get(data.id);
    if (!entry) return;
    pending.delete(data.id);
    if (data.status === 'error') {
      const msg = data.description || data.code || 'CWI error';
      entry.reject(new Error(msg));
    } else {
      entry.resolve(data.result);
    }
  };

  window.addEventListener('message', onMessage);

  const call = (method, params) => {
    return new Promise((resolve, reject) => {
      const id = uuidv4();
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`CWI timeout for ${method}`));
      }, timeoutMs);
      pending.set(id, {
        resolve: (v) => { clearTimeout(timer); resolve(v); },
        reject: (e) => { clearTimeout(timer); reject(e); }
      });
      try {
        targetWindow.postMessage({ type: 'CWI', id, call: method, params }, origin);
      } catch (e) {
        clearTimeout(timer);
        pending.delete(id);
        reject(e);
      }
    });
  };

  const api = {};
  const methods = [
    'getVersion','getNetwork','getPublicKey','createAction','encrypt','decrypt',
    'createSignature','verifySignature','createHmac','verifyHmac','isAuthenticated','waitForAuthentication'
  ];
  for (const m of methods) api[m] = (params) => call(m, params);

  api.__teardown = () => {
    window.removeEventListener('message', onMessage);
    pending.clear();
  };

  return api;
}
