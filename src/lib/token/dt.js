// src/lib/token/dt.js
// Minimal, focused Data Token (DT) scaffolding for Nullify (BRC-100/PushDrop-aligned)
// Pure data shaping and validation. No signing/custody here.

/**
 * createDTPayload
 * Normalize DT payload fields prior to embedding.
 *
 * @param {object} params
 * @param {('outpoint'|'same-tx')} [params.mode] - Reference style (default outpoint)
 * @param {string} [params.ctTxid] - Required when mode === 'outpoint'
 * @param {number} params.ctVout - CT output index
 * @param {string} params.recipient - Recipient address or pubkey identifier
 * @param {string} [params.permissions] - Access rights (e.g., 'read-only')
 * @param {object} [params.meta] - Metadata bag
 * @returns {object} normalized DT payload
 */
export function createDTPayload({ mode = 'outpoint', ctTxid = '', ctVout, recipient, permissions = 'read-only', meta = {}, wrappedKey = '' }) {
  const nowIso = new Date().toISOString();
  const ctRefMode = mode === 'same-tx' ? 'same-tx' : 'outpoint';
  const payload = {
    type: 'DT',
    ctRefMode,
    ctTxid: ctRefMode === 'outpoint' ? String(ctTxid || '') : '',
    ctVout: Number.isInteger(ctVout) ? ctVout : null,
    recipient: String(recipient || ''),
    permissions: String(permissions || 'read-only'),
    meta: {
      created: String(meta.created || nowIso),
      version: String(meta.version || '1.0'),
      ...meta
    },
    wrappedKey: wrappedKey ? String(wrappedKey) : '',
    timestamp: Date.now()
  };
  return payload;
}

/**
 * validateDTPayload
 * Structural checks only (no on-chain verification here).
 */
export function validateDTPayload(payload) {
  const errors = [];
  if (!payload || typeof payload !== 'object') errors.push('payload must be object');
  if (payload.type !== 'DT') errors.push('type must be DT');
  if (payload.ctRefMode !== 'same-tx' && payload.ctRefMode !== 'outpoint') errors.push('ctRefMode must be outpoint or same-tx');
  if (payload.ctRefMode === 'outpoint' && !/^[0-9a-fA-F]{64}$/.test(String(payload.ctTxid || ''))) errors.push('ctTxid must be txid (64-hex)');
  if (!Number.isInteger(payload.ctVout) || payload.ctVout < 0) errors.push('ctVout must be a non-negative integer');
  if (!payload.recipient) errors.push('recipient required');
  if (!payload.permissions) errors.push('permissions required');
  if (!payload.meta || typeof payload.meta !== 'object') errors.push('meta required');
  if (!payload.wrappedKey) errors.push('wrappedKey required');
  return { ok: errors.length === 0, errors };
}

/**
 * wrapDTForPushDrop
 * Compact representation for embedding in a PushDrop-like data field.
 */
export function wrapDTForPushDrop(payload) {
  const { ok, errors } = validateDTPayload(payload);
  if (!ok) throw new Error('Invalid DT payload: ' + errors.join(', '));
  return {
    t: 'DT',
    mode: payload.ctRefMode,
    txid: payload.ctRefMode === 'outpoint' ? payload.ctTxid : undefined,
    vout: payload.ctVout,
    to: payload.recipient,
    p: payload.permissions,
    m: payload.meta,
    k: payload.wrappedKey,
    ts: payload.timestamp
  };
}

/**
 * unwrapDTFromPushDrop
 * Expand compact form to normalized DT payload.
 */
export function unwrapDTFromPushDrop(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const ctRefMode = obj.mode === 'same-tx' ? 'same-tx' : 'outpoint';
  return {
    type: 'DT',
    ctRefMode,
    ctTxid: ctRefMode === 'outpoint' ? (obj.txid || '') : '',
    ctVout: typeof obj.vout === 'number' ? obj.vout : parseInt(obj.vout ?? '0', 10) || 0,
    recipient: obj.to || '',
    permissions: obj.p || 'read-only',
    meta: obj.m || {},
    wrappedKey: obj.k || '',
    timestamp: obj.ts || Date.now()
  };
}
