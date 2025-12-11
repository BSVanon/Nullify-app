import * as secp from 'noble-secp256k1'

/**
 * Convert bytes to base64url encoding
 */
function toBase64Url(bytes) {
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  const base64 = btoa(binary)
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function toHex(uint8) {
  return Array.from(uint8, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Generate an invite for a holder thread
 * @param {object} params
 * @param {string} params.threadId - Thread ID
 * @param {string} params.holderPublicKey - Holder's wallet public key
 * @param {string} params.holderName - Display name for holder
 * @param {string} params.threadKeyBase64 - Raw thread secret in base64
 * @param {string} params.policy - Thread policy (mutual/initiator)
 * @param {object} params.inviterProfile - Optional profile data {displayName, avatarHash}
 * @param {object} keyWrapping - Key wrapping utilities
 * @returns {Promise<string>} Invite URL
 */
export async function generateInvite({
  threadId,
  holderPublicKey,
  holderName = 'Thread Creator',
  threadKeyBase64,
  policy = 'mutual',
  keyWrapping,
  guestPrivateKeyHex,
  guestPublicKey,
  tokens,
  inviterProfile,
}) {
  if (!threadId) throw new Error('threadId required')
  if (!holderPublicKey) throw new Error('holderPublicKey required')
  if (!threadKeyBase64) throw new Error('threadKeyBase64 required for invite generation')

  // Resolve key wrapping utilities
  const { wrapKeyWithECIES } = keyWrapping?.wrapKeyWithECIES
    ? keyWrapping
    : await import('@/lib/crypto/keyWrapping.js')

  // Generate guest identity for invitee (or use provided guest keys)
  let localGuestPrivateKeyHex = guestPrivateKeyHex || null
  let guestPublicKeyHex = guestPublicKey || null

  if (!localGuestPrivateKeyHex) {
    const guestPrivateKeyBytes = secp.utils.randomPrivateKey()
    localGuestPrivateKeyHex = toHex(guestPrivateKeyBytes)
  }

  if (!guestPublicKeyHex) {
    const guestPublicKeyBytes = secp.getPublicKey(localGuestPrivateKeyHex, true)
    guestPublicKeyHex = typeof guestPublicKeyBytes === 'string'
      ? guestPublicKeyBytes
      : toHex(guestPublicKeyBytes)
  }

  // Decode thread secret from base64
  const threadSecretBytes = Uint8Array.from(atob(threadKeyBase64), c => c.charCodeAt(0))

  // Wrap thread secret with guest public key
  const wrappedKey = await wrapKeyWithECIES(threadSecretBytes, guestPublicKeyHex)

  // Create invite payload
  const invitePayload = {
    proto: 'Nullify.Invite',
    v: 1,
    t: 'invite',
    threadId,
    inviter: holderPublicKey,
    inviterName: holderName,
    policy,
    wrap: wrappedKey,
    sig: '', // Placeholder - real signature would require wallet signing
    exp: Math.floor(Date.now() / 1000) + 86400 * 7, // 7 days
  }

  // Embed guest identity hints so the recipient can reconstruct the same keypair
  invitePayload.guest = {
    keyDerivation: {
      scheme: 'secp256k1-direct-v1',
      privateKeyHex: localGuestPrivateKeyHex,
    },
    publicKey: guestPublicKeyHex,
  }

  // Optionally embed CT/DT metadata for this invite (for immediate DT validation)
  if (tokens && (tokens.ct || tokens.dtIssuance)) {
    invitePayload.tokens = {}
    if (tokens.ct) {
      invitePayload.tokens.ct = tokens.ct
    }
    if (tokens.dtIssuance) {
      invitePayload.tokens.dtIssuance = tokens.dtIssuance
    }
  }

  // Embed inviter profile if provided (for auto-population after verification)
  if (inviterProfile && inviterProfile.displayName) {
    invitePayload.meta = {
      inviterProfile: {
        displayName: inviterProfile.displayName,
        avatarHash: inviterProfile.avatarHash || null
      }
    }
  }

  // Create signature statement
  const statement = {
    intent: 'nullify.invite',
    threadId,
    inviter: holderPublicKey,
    guestPublicKey: guestPublicKeyHex,
    policy,
    timestamp: new Date().toISOString(),
  }

  // Sign with guest key as placeholder (in production, holder would sign)
  const statementPayload = new TextEncoder().encode(JSON.stringify(statement))
  const statementHash = await secp.utils.sha256(statementPayload)
  const signature = await secp.sign(statementHash, localGuestPrivateKeyHex)
  const signatureHex = Array.from(signature, byte => byte.toString(16).padStart(2, '0')).join('')
  
  invitePayload.sig = signatureHex
  invitePayload.inviteHash = Array.from(statementHash, byte => byte.toString(16).padStart(2, '0')).join('')

  // Encode invite as base64url
  const inviteJson = JSON.stringify(invitePayload)
  const inviteBytes = new TextEncoder().encode(inviteJson)
  const inviteBlob = toBase64Url(inviteBytes)

  // Generate invite URL
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'
  return `${baseUrl}/invite/${inviteBlob}`
}
