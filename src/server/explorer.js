// Explorer client utilities for WhatsOnChain (primary) and GorillaPool (fallback)
// Node/CommonJS module

const DEFAULT_PRIMARY = process.env.NEXT_PUBLIC_EXPLORER_PRIMARY_URL || 'https://api.whatsonchain.com';
const DEFAULT_FALLBACK = process.env.NEXT_PUBLIC_EXPLORER_FALLBACK_URL || 'https://api.gorillapool.io';

function netPathFromEnv() {
  const network = (process.env.BSV_NETWORK || 'main').toLowerCase();
  return (network === 'mainnet' || network === 'main') ? 'main' : 'test';
}

async function getUtxos(address, opts = {}) {
  const netPath = opts.netPath || netPathFromEnv();
  const PRIMARY_EXPLORER = opts.primary || DEFAULT_PRIMARY;
  const FALLBACK_EXPLORER = opts.fallback || DEFAULT_FALLBACK;
  // Try WOC
  try {
    const url = `${PRIMARY_EXPLORER}/v1/bsv/${netPath}/address/${encodeURIComponent(address)}/unspent`;
    const r = await fetch(url, { method: 'GET' });
    if (!r.ok) throw new Error(`WOC HTTP ${r.status}`);
    const list = await r.json();
    const utxos = (Array.isArray(list) ? list : []).map(u => ({
      // Prefer big-endian txid for downstream raw lookups
      txid: u.tx_hash_big_endian || u.txid || u.tx_hash,
      vout: u.tx_pos ?? u.vout ?? u.n ?? 0,
      satoshis: u.value ?? u.satoshis ?? 0,
    }));
    return { provider: 'woc', utxos };
  } catch (_e) {
    const base = FALLBACK_EXPLORER.includes('gorillapool.io') ? FALLBACK_EXPLORER : 'https://api.gorillapool.io';
    let url = `${base}/api/bsv/${netPath}/address/${encodeURIComponent(address)}/unspent`;
    let r = await fetch(url, { method: 'GET' });
    if (r.status === 404) {
      url = `${base}/api/bsv/${netPath}/address/${encodeURIComponent(address)}/utxo`;
      r = await fetch(url, { method: 'GET' });
    }
    if (!r.ok) {
      if (r.status === 404) return { provider: 'gorilla', utxos: [] };
      throw new Error(`Gorilla HTTP ${r.status}`);
    }
    const list = await r.json();
    const utxos = (Array.isArray(list) ? list : []).map(u => ({
      txid: u.txid || u.tx_hash || u.tx_hash_big_endian,
      vout: u.vout ?? u.tx_pos ?? u.n ?? 0,
      satoshis: u.satoshis ?? u.value ?? 0,
    }));
    return { provider: 'gorilla', utxos };
  }
}

async function broadcast(rawhex, opts = {}) {
  const netPath = opts.netPath || netPathFromEnv();
  const PRIMARY_EXPLORER = opts.primary || DEFAULT_PRIMARY;
  const FALLBACK_EXPLORER = opts.fallback || DEFAULT_FALLBACK;
  try {
    const url = `${PRIMARY_EXPLORER}/v1/bsv/${netPath}/tx/raw`;
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ txhex: rawhex }) });
    if (!r.ok) throw new Error(`WOC HTTP ${r.status}`);
    const j = await r.json();
    return { provider: 'woc', ...j };
  } catch (_e) {
    const base = FALLBACK_EXPLORER.includes('gorillapool.io') ? FALLBACK_EXPLORER : 'https://api.gorillapool.io';
    const url = `${base}/api/bsv/${netPath}/tx/broadcast`;
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: rawhex });
    if (!r.ok) throw new Error(`Gorilla HTTP ${r.status}`);
    const j = await r.json().catch(() => ({}));
    return { provider: 'gorilla', ...j };
  }
}

async function getTx(txid, opts = {}) {
  const netPath = opts.netPath || netPathFromEnv();
  const PRIMARY_EXPLORER = opts.primary || DEFAULT_PRIMARY;
  const FALLBACK_EXPLORER = opts.fallback || DEFAULT_FALLBACK;
  try {
    const url = `${PRIMARY_EXPLORER}/v1/bsv/${netPath}/tx/hash/${encodeURIComponent(txid)}`;
    const r = await fetch(url, { method: 'GET' });
    if (!r.ok) throw new Error(`WOC HTTP ${r.status}`);
    const j = await r.json();
    return { provider: 'woc', tx: j };
  } catch (_e) {
    const base = FALLBACK_EXPLORER.includes('gorillapool.io') ? FALLBACK_EXPLORER : 'https://api.gorillapool.io';
    const url = `${base}/api/bsv/${netPath}/tx/${encodeURIComponent(txid)}`;
    const r = await fetch(url, { method: 'GET' });
    if (!r.ok) throw new Error(`Gorilla HTTP ${r.status}`);
    const j = await r.json();
    return { provider: 'gorilla', tx: j };
  }
}

async function getRawTx(txid, opts = {}) {
  const netPath = opts.netPath || netPathFromEnv();
  const PRIMARY_EXPLORER = opts.primary || DEFAULT_PRIMARY;
  const FALLBACK_EXPLORER = opts.fallback || DEFAULT_FALLBACK;
  const preferProvider = (opts.preferProvider || '').toLowerCase();
  const attempts = [];
  const tryWoc = async () => {
    const url = `${PRIMARY_EXPLORER}/v1/bsv/${netPath}/tx/raw/${encodeURIComponent(txid)}`;
    const r = await fetch(url, { method: 'GET' });
    if (!r.ok) { attempts.push({ step: 'woc_raw', status: r.status }); throw new Error(`WOC RAW HTTP ${r.status}`); }
    const text = await r.text();
    if (typeof text === 'string' && /^[0-9a-fA-F]+$/.test(text.trim())) {
      return { provider: 'woc', hex: text.trim() };
    }
    try {
      const j = JSON.parse(text);
      const hex = j?.hex || j?.rawtx || j?.txhex || '';
      if (hex && /^[0-9a-fA-F]+$/.test(hex)) return { provider: 'woc', hex };
    } catch (parseErr) {
      attempts.push({ step: 'woc_raw_json_parse', error: parseErr?.message || String(parseErr) });
    }
    attempts.push({ step: 'woc_raw_parse', status: 'no_hex' });
    throw new Error('No hex from WOC');
  };

  const tryWocAlt = async () => {
    const url2 = `${PRIMARY_EXPLORER}/v1/bsv/${netPath}/tx/hash/${encodeURIComponent(txid)}`;
    const r2 = await fetch(url2, { method: 'GET' });
    if (!r2.ok) { attempts.push({ step: 'woc_tx_hash', status: r2.status }); throw new Error(`WOC TX HTTP ${r2.status}`); }
    const j2 = await r2.json();
    const hex2 = j2?.hex || j2?.rawtx || j2?.txhex || '';
    if (hex2 && /^[0-9a-fA-F]+$/.test(hex2)) return { provider: 'woc', hex: hex2 };
    attempts.push({ step: 'woc_tx_hash_parse', status: 'no_hex' });
    throw new Error('No hex from WOC TX');
  };

  const tryGorilla = async () => {
    const base = FALLBACK_EXPLORER.includes('gorillapool.io') ? FALLBACK_EXPLORER : 'https://api.gorillapool.io';
    let url = `${base}/api/bsv/${netPath}/tx/${encodeURIComponent(txid)}/hex`;
    let r = await fetch(url, { method: 'GET' });
    if (r.ok) {
      const t = await r.text();
      const hx = (typeof t === 'string' ? t.trim() : '');
      if (/^[0-9a-fA-F]+$/.test(hx)) return { provider: 'gorilla', hex: hx };
    }
    attempts.push({ step: 'gorilla_hex', status: r.status });
    // Gorilla JSON tx
    url = `${base}/api/bsv/${netPath}/tx/${encodeURIComponent(txid)}`;
    r = await fetch(url, { method: 'GET' });
    if (!r.ok) { attempts.push({ step: 'gorilla_tx', status: r.status }); throw new Error(`Gorilla TX HTTP ${r.status}`); }
    const j3 = await r.json();
    const hex3 = j3?.hex || j3?.rawtx || j3?.txhex || '';
    if (hex3 && /^[0-9a-fA-F]+$/.test(hex3)) return { provider: 'gorilla', hex: hex3 };
    throw new Error('No hex from any provider');
  };

  const tryWocLegacy = async () => {
    // Some WOC deployments expose legacy path /rawtx/{txid}
    const url = `${PRIMARY_EXPLORER}/rawtx/${encodeURIComponent(txid)}`;
    const r = await fetch(url, { method: 'GET' });
    if (!r.ok) { attempts.push({ step: 'woc_legacy_raw', status: r.status }); throw new Error(`WOC LEGACY RAW HTTP ${r.status}`); }
    const t = await r.text();
    const hx = (typeof t === 'string' ? t.trim() : '');
    if (hx && /^[0-9a-fA-F]+$/.test(hx)) return { provider: 'woc', hex: hx };
    attempts.push({ step: 'woc_legacy_raw_parse', status: 'no_hex' });
    throw new Error('No hex from WOC legacy');
  };

  const order = preferProvider === 'woc' ? [tryWoc, tryWocAlt, tryWocLegacy, tryGorilla]
    : preferProvider === 'gorilla' ? [tryGorilla, tryWoc, tryWocAlt, tryWocLegacy]
    : [tryWoc, tryWocAlt, tryWocLegacy, tryGorilla];
  let lastErr = null;
  for (const fn of order) {
    try { return await fn(); } catch(e) { lastErr = e; }
  }
  const payload = { error: (lastErr && String(lastErr.message || lastErr)) || 'No hex', attempts };
  throw new Error(JSON.stringify(payload));
}

module.exports = {
  netPathFromEnv,
  getUtxos,
  broadcast,
  getTx,
  getRawTx,
};
