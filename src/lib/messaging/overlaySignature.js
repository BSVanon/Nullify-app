/**
 * Overlay Message Signature Verification
 * 
 * SECURITY: All overlay messages should be signed by the sender to prevent spoofing.
 * This module provides utilities for verifying message signatures before processing.
 */

/**
 * Verify an overlay message signature
 * 
 * @param {Object} envelope - The overlay message envelope
 * @param {string} envelope.type - Message type (message, ack, typing, control)
 * @param {string} envelope.threadId - Thread identifier
 * @param {Object} envelope.payload - Message payload
 * @param {string} envelope.payload.sig - Base64-encoded signature (optional for backward compat)
 * @param {string} envelope.payload.author - Sender's public key
 * @returns {Promise<{valid: boolean, reason: string, verified: boolean}>}
 */
export async function verifyOverlaySignature(envelope) {
  // Backward compatibility: if no signature, mark as unverified but allow
  // This enables gradual rollout without breaking existing clients
  if (!envelope?.payload?.sig) {
    return {
      valid: true,
      verified: false,
      reason: 'NO_SIGNATURE',
    }
  }

  const { payload } = envelope
  const { sig, author } = payload

  if (!author) {
    return {
      valid: false,
      verified: false,
      reason: 'NO_AUTHOR',
    }
  }

  try {
    const { PublicKey, Signature, Hash } = await import('/node_modules/@bsv/sdk/dist/esm/mod.js')

    // Reconstruct the signed message (exclude sig field)
    const messageToVerify = { ...payload }
    delete messageToVerify.sig
    const messageBytes = new TextEncoder().encode(JSON.stringify(messageToVerify))
    const messageHash = Hash.sha256(messageBytes)

    // Parse public key and signature
    const pubKey = PublicKey.fromString(author, 'hex')
    const signature = Signature.fromDER(
      Uint8Array.from(atob(sig), c => c.charCodeAt(0)),
      'binary'
    )

    // Verify signature
    const isValid = pubKey.verify(messageHash, signature)

    return {
      valid: isValid,
      verified: true,
      reason: isValid ? 'VALID_SIGNATURE' : 'INVALID_SIGNATURE',
    }
  } catch (error) {
    console.warn('[overlaySignature] Verification failed:', error.message)
    return {
      valid: false,
      verified: false,
      reason: `VERIFICATION_ERROR: ${error.message}`,
    }
  }
}

/**
 * Sign an overlay message payload
 * 
 * @param {Object} payload - The message payload to sign
 * @param {Object} wallet - WalletClient instance
 * @returns {Promise<Object>} Payload with sig field added
 */
export async function signOverlayPayload(payload, wallet) {
  if (!wallet) {
    console.warn('[overlaySignature] No wallet available for signing')
    return payload
  }

  try {
    const { Hash } = await import('/node_modules/@bsv/sdk/dist/esm/mod.js')

    // Create message hash
    const messageBytes = new TextEncoder().encode(JSON.stringify(payload))
    const messageHash = Hash.sha256(messageBytes)

    // Sign using wallet
    const signResult = await wallet.createSignature({
      data: Array.from(messageHash),
      protocolID: [2, 'Nullify Overlay'],
      keyID: 'overlay-sig',
    })

    const sig = signResult.signature || signResult
    const sigBase64 = typeof sig === 'string' ? sig : btoa(String.fromCharCode(...sig))

    return {
      ...payload,
      sig: sigBase64,
    }
  } catch (error) {
    console.warn('[overlaySignature] Signing failed:', error.message)
    // Return unsigned payload for backward compatibility
    return payload
  }
}

/**
 * Check if an envelope should be trusted based on signature verification
 * 
 * @param {Object} envelope - The overlay message envelope
 * @param {Object} options - Verification options
 * @param {boolean} options.requireSignature - If true, reject unsigned messages
 * @returns {Promise<{trusted: boolean, reason: string}>}
 */
export async function isEnvelopeTrusted(envelope, { requireSignature = false } = {}) {
  const result = await verifyOverlaySignature(envelope)

  if (requireSignature && !result.verified) {
    return {
      trusted: false,
      reason: 'SIGNATURE_REQUIRED',
    }
  }

  if (result.verified && !result.valid) {
    return {
      trusted: false,
      reason: 'SIGNATURE_INVALID',
    }
  }

  return {
    trusted: true,
    reason: result.reason,
  }
}
