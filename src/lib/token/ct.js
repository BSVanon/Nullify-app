// src/lib/token/ct.js
// Minimal, focused Control Token (CT) scaffolding for Nullify (BRC-100/PushDrop-aligned)
// No signing/custody here. Keep pure data shaping and validation. All chain ops happen elsewhere via @bsv/sdk.

/**
 * createCTPayload
 * Normalise Control Token payload (two-TX default, atomic optional).
 *
 * @param {object} params
 * @param {string} params.blobHash - SHA-256 of ciphertext (hex)
 * @param {string} [params.hintURL] - Optional human-friendly locator
 * @param {string} params.encKeyWrap - Wrapped symmetric key material
 * @param {object} [params.meta] - Additional metadata (name, created, expiry, version, etc.)
 * @returns {object} normalized CT payload
 */
export function createCTPayload({ blobHash, hintURL = '', encKeyWrap, meta = {} }) {
  const nowIso = new Date().toISOString();
  return {
    type: 'CT',
    blobHash: String(blobHash || ''),
    hintURL: hintURL ? String(hintURL) : '',
    encKeyWrap: String(encKeyWrap || ''),
    meta: {
      name: String(meta.name || ''),
      created: String(meta.created || nowIso),
      expiry: meta.expiry || null,
      version: String(meta.version || '1.0'),
      ...meta
    },
    timestamp: Date.now()
  };
}

/**
 * validateCTPayload
 * Basic structural validation only (no cryptographic verification here).
 * Returns { ok: boolean, errors: string[] }
 */
export function validateCTPayload(payload) {
  const errors = [];
  if (!payload || typeof payload !== 'object') errors.push('payload must be object');
  if (payload.type !== 'CT') errors.push('type must be CT');
  if (!/^[0-9a-fA-F]{64}$/.test(String(payload.blobHash || ''))) errors.push('blobHash must be 64-hex');
  if (!payload.encKeyWrap) errors.push('encKeyWrap (wrapped key) required');
  if (!payload.meta || typeof payload.meta !== 'object') errors.push('meta required');
  return { ok: errors.length === 0, errors };
}

/**
 * wrapCTForPushDrop
 * Return a compact object intended for embedding in a PushDrop-like data field.
 * This avoids leaking unnecessary fields and keeps consistency across builders.
 */
export function wrapCTForPushDrop(payload) {
  const { ok, errors } = validateCTPayload(payload);
  if (!ok) throw new Error('Invalid CT payload: ' + errors.join(', '));
  return {
    t: 'CT',
    h: payload.blobHash,
    u: payload.hintURL || undefined,
    k: payload.encKeyWrap,
    m: payload.meta,
    ts: payload.timestamp
  };
}

/**
 * unwrapCTFromPushDrop
 * Turns the compact PushDrop object back into the normalized CT payload shape.
 */
export function unwrapCTFromPushDrop(obj) {
  if (!obj || typeof obj !== 'object') return null;
  return {
    type: 'CT',
    blobHash: obj.h || '',
    hintURL: obj.u || '',
    encKeyWrap: obj.k || '',
    meta: obj.m || {},
    timestamp: obj.ts || Date.now()
  };
}
