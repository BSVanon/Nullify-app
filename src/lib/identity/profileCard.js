/**
 * ProfileCard - Lightweight signed identity for guest users
 * 
 * Guests don't have wallets, so they use ephemeral keys to sign
 * a simple profile card that can be distributed via overlay.
 */

import { PrivateKey, Hash, Signature } from '@bsv/sdk'

/**
 * Create and sign a ProfileCard for a guest identity
 * @param {Object} input
 * @param {string} input.displayName - Guest's chosen display name
 * @param {string} [input.avatarHash] - SHA256 hash of avatar (optional)
 * @param {number} [input.colorSeed] - Deterministic color seed
 * @param {Function} signFn - Async function that signs bytes: (Uint8Array) => Promise<Uint8Array>
 * @param {string} issuerPubKey - Hex-encoded public key of the guest
 * @returns {Promise<Object>} Signed ProfileCard
 */
export async function signProfileCard(input, signFn, issuerPubKey) {
  if (!input.displayName) {
    throw new Error('displayName is required')
  }
  if (!signFn || typeof signFn !== 'function') {
    throw new Error('signFn must be a function')
  }
  if (!issuerPubKey) {
    throw new Error('issuerPubKey is required')
  }

  const card = {
    proto: 'Nullify.ProfileCard',
    v: 1,
    displayName: input.displayName,
    avatarHash: input.avatarHash || null,
    colorSeed: input.colorSeed || Math.floor(Math.random() * 1000),
    since: new Date().toISOString(),
    issuerPubKey
  }

  // Canonicalize: stable JSON with sorted keys
  const canonical = canonicalizeJSON(card)
  const messageBytes = new TextEncoder().encode(canonical)
  
  // Sign the canonical JSON
  const sigBytes = await signFn(messageBytes)
  // Convert to base64 using browser-compatible method
  const sigBase64 = btoa(String.fromCharCode(...sigBytes))

  return {
    ...card,
    sig: sigBase64
  }
}

/**
 * Verify a ProfileCard's signature
 * @param {Object} card - ProfileCard to verify
 * @returns {boolean} True if signature is valid
 */
export function verifyProfileCard(card) {
  if (!card || !card.sig || !card.issuerPubKey) {
    console.warn('[profileCard] Invalid card structure')
    return false
  }

  try {
    // Extract signature and reconstruct canonical message
    const { sig, ...cardWithoutSig } = card
    const canonical = canonicalizeJSON(cardWithoutSig)
    const messageBytes = new TextEncoder().encode(canonical)
    const messageHash = Hash.sha256(messageBytes)

    // Verify signature
    // Convert from base64 using browser-compatible method
    const binaryString = atob(sig)
    const sigBytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      sigBytes[i] = binaryString.charCodeAt(i)
    }
    const signature = Signature.fromDER(sigBytes)
    const pubKey = PrivateKey.fromString(card.issuerPubKey, 'hex').toPublicKey()

    const isValid = signature.verify(messageHash, pubKey)
    
    if (!isValid) {
      console.warn('[profileCard] Signature verification failed')
    }
    
    return isValid
  } catch (error) {
    console.error('[profileCard] Verification error:', error)
    return false
  }
}

/**
 * Canonicalize JSON for signing (stable key order)
 * @param {Object} obj
 * @returns {string}
 */
function canonicalizeJSON(obj) {
  const sortedKeys = Object.keys(obj).sort()
  const sorted = {}
  for (const key of sortedKeys) {
    sorted[key] = obj[key]
  }
  return JSON.stringify(sorted)
}
