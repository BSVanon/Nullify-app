// Transaction utilities for building and broadcasting an OP_RETURN anchor tx
// Uses @bsv/sdk only (client-first as per rules)

import OP from '/node_modules/@bsv/sdk/dist/esm/src/script/OP.js';
import LockingScript from '/node_modules/@bsv/sdk/dist/esm/src/script/LockingScript.js';
import P2PKH from '/node_modules/@bsv/sdk/dist/esm/src/script/templates/P2PKH.js';
import Transaction from '/node_modules/@bsv/sdk/dist/esm/src/transaction/Transaction.js';
import PrivateKey from '/node_modules/@bsv/sdk/dist/esm/src/primitives/PrivateKey.js';

function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

export async function wifToAddress(wif) {
  if (!wif) throw new Error('Missing WIF');
  const cleanedWif = wif.replace(/\s+/g, '').replace(/[^\x20-\x7E]/g, '');
  if (!isLikelyWIF(cleanedWif)) {
    const bad = findInvalidBase58Chars(cleanedWif);
    const hint = bad.length ? ` Invalid chars: ${bad.join('')}` : '';
    throw new Error('WIF format invalid: ensure base58 (no 0,O,I,l) and length 51-52.' + hint);
  }
  let priv;
  try { priv = PrivateKey.fromString(cleanedWif); } 
  catch { throw new Error('Invalid WIF: could not decode.'); }
  const prefix = await getNetPrefix();
  return { address: priv.toPublicKey().toAddress(prefix), network: prefix };
}

function opReturnTPF1(hashHex, version = '1', tag = 'TPF1') {
  const enc = new TextEncoder();
  const tagBuf = enc.encode(tag);
  const verBuf = enc.encode(String(version));
  const hashBuf = hexToBytes(hashHex);
  return new LockingScript([
    { op: OP.OP_FALSE },
    { op: OP.OP_RETURN },
    { op: tagBuf.length, data: tagBuf },
    { op: verBuf.length, data: verBuf },
    { op: hashBuf.length, data: hashBuf }
  ]);
}

export function opReturnTPF1Hex(hashHex, version = '1', tag = 'TPF1') {
  const script = opReturnTPF1(hashHex, version, tag);
  return script.toHex();
}

function isLikelyWIF(str) {
  // Base58 without 0 O I l, length typically 51 (uncompressed) or 52 (compressed)
  const base58 = /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/;
  return base58.test(str) && (str.length === 51 || str.length === 52);
}

function findInvalidBase58Chars(str) {
  const allowed = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const bad = new Set();
  for (const ch of str) if (!allowed.includes(ch)) bad.add(ch);
  return [...bad];
}

async function getNetPrefix() {
  try {
    const h = await fetch('/api/health').then(r=>r.json());
    const net = String(h.network || 'main').toLowerCase();
    return (net === 'mainnet' || net === 'main') ? 'main' : 'test';
  } catch {
    return 'main';
  }
}

// Build and sign a single-input P2PKH tx with OP_RETURN and change
// params: {
//   utxo: { txid, vout, satoshis, address },
//   wif: string,
//   changeAddress: string, // P2PKH
//   fee: number, // fixed fee in satoshis
//   hashHex: string, // sha256
//   version?: string
// }
export async function buildAnchorTx(params) {
  const { utxo, wif, changeAddress, fee, hashHex, version = '1' } = params;
  if (!utxo || !utxo.txid || typeof utxo.vout !== 'number') throw new Error('Invalid utxo');
  if (!Number.isInteger(utxo.satoshis) || utxo.satoshis <= 0) throw new Error('Invalid utxo.satoshis');
  if (!wif) throw new Error('Missing WIF');
  // sanitize: remove whitespace and non-printable chars
  const cleanedWif = wif.replace(/\s+/g, '').replace(/[^\x20-\x7E]/g, '');
  if (!isLikelyWIF(cleanedWif)) {
    const bad = findInvalidBase58Chars(cleanedWif);
    const hint = bad.length ? ` Invalid chars: ${bad.join('')}` : '';
    throw new Error('WIF format invalid: ensure base58 (no 0,O,I,l) and length 51-52.' + hint);
  }
  if (!changeAddress) throw new Error('Missing changeAddress');
  if (!Number.isInteger(fee) || fee <= 0) throw new Error('Invalid fee');
  if (!/^[0-9a-fA-F]{64}$/.test(hashHex)) throw new Error('hashHex must be 64-hex');

  let priv;
  try {
    priv = PrivateKey.fromString(cleanedWif);
  } catch (e) {
    throw new Error('Invalid WIF: could not decode. Ensure it is copied exactly without spaces or hidden characters.');
  }
  // Verify WIF corresponds to the provided UTXO address
  const prefix = await getNetPrefix();
  const derivedAddr = priv.toPublicKey().toAddress(prefix);
  if (derivedAddr !== utxo.address) {
    throw new Error('WIF/address mismatch: the provided WIF does not control the UTXO address.');
  }
  const tx = new Transaction();

  // Add P2PKH input placeholder; set unlocking script at sign time via template
  tx.addInput({
    sourceTXID: utxo.txid,
    sourceOutputIndex: utxo.vout,
    unlockingScript: new LockingScript([]),
    sequence: 0xffffffff,
    // Set template for sign() with known sourceSatoshis and lockingScript
    unlockingScriptTemplate: new P2PKH().unlock(
      priv,
      'all',
      false,
      utxo.satoshis,
      new P2PKH().lock(utxo.address)
    )
  });

  // Data output (0 satoshis)
  tx.addOutput({ satoshis: 0, lockingScript: opReturnTPF1(hashHex, version) });

  // Change output = input - fee (all to change)
  const change = utxo.satoshis - fee;
  if (change <= 0) throw new Error('Fee too high for input');
  tx.addP2PKHOutput(changeAddress, change);

  // Sign
  await tx.sign();
  const rawtx = tx.toHex();
  const txid = tx.id('hex');
  return { rawtx, txid };
}

export async function broadcastRawTx(rawtx) {
  // Try server proxy first (optional future), else direct explorers
  // Use server proxy when available to avoid CORS: POST /api/broadcast { rawtx }
  try {
    const r = await fetch('/api/broadcast', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rawtx }) });
    if (r.ok) { const j = await r.json(); return j; }
  } catch (proxyErr) {
    console.warn('Proxy broadcast failed, falling back to direct explorers', proxyErr);
  }
  // Direct to WhatsOnChain
  const health = await fetch('/api/health').then(r=>r.json()).catch(()=>({network:'main'}));
  const net = String(health.network || 'main').toLowerCase();
  const netPath = (net === 'main' || net === 'mainnet') ? 'main' : 'test';
  const wocUrl = `https://api.whatsonchain.com/v1/bsv/${netPath}/tx/raw`; 
  try {
    const r = await fetch(wocUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ txhex: rawtx }) });
    if (r.ok) { const j = await r.json(); return { provider: 'woc', ...j }; }
  } catch (wocErr) {
    console.warn('WhatsOnChain broadcast failed', wocErr);
  }
  // Gorilla fallback
  const gpUrl = `https://api.gorillapool.io/api/bsv/${netPath}/tx/broadcast`; // body: rawtx hex string
  const r2 = await fetch(gpUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: rawtx });
  if (r2.ok) { const j = await r2.json().catch(()=>({})); return { provider: 'gorilla', ...j }; }
  throw new Error('Broadcast failed');
}
