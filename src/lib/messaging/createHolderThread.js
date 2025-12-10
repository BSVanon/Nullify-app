import * as secp from 'noble-secp256k1'
import { saveJoinReceipt, saveThreadMetadata } from './storage'

/**
 * Generate a random thread ID
 */
function generateThreadId() {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Generate a random thread secret key
 */
async function generateThreadSecret() {
  const secretBytes = new Uint8Array(32)
  crypto.getRandomValues(secretBytes)
  return secretBytes
}

/**
 * Convert bytes to base64
 */
function toBase64(bytes) {
  if (typeof btoa === 'function') {
    let binary = ''
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte)
    })
    return btoa(binary)
  }
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64')
  }
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Create a new holder thread with wallet identity
 * @param {object} walletBootstrap - Wallet bootstrap instance
 * @param {object} keyWrapping - Key wrapping utilities
 * @returns {object} New thread receipt and metadata
 */
export async function createHolderThread({ walletBootstrap, keyWrapping }) {
  // Ensure wallet is connected
  if (typeof walletBootstrap?.getStatus !== 'function') {
    throw new Error('Wallet bootstrap unavailable')
  }

  let status = walletBootstrap.getStatus()
  if (!status?.wallet) {
    const initialized = await walletBootstrap.initialize?.()
    status = { ...status, ...initialized }
  }

  const walletPublicKey = status?.identityKey
  if (!walletPublicKey) {
    throw new Error('Wallet connection required to create thread')
  }

  // Resolve key wrapping utilities
  const { wrapKeyWithECIES } = keyWrapping?.wrapKeyWithECIES
    ? keyWrapping
    : await import('@/lib/crypto/keyWrapping.js')

  // Generate thread ID and secret
  const threadId = generateThreadId()
  const secretBytes = await generateThreadSecret()
  const rawKeyBase64 = toBase64(secretBytes)

  // Wrap thread secret with wallet public key
  const wrappedKey = await wrapKeyWithECIES(secretBytes, walletPublicKey)

  // Generate blobHash (SHA-256 of empty thread data for now)
  const emptyBlob = new TextEncoder().encode(JSON.stringify({ messages: [] }))
  const blobHashBytes = await crypto.subtle.digest('SHA-256', emptyBlob)
  const blobHash = Array.from(new Uint8Array(blobHashBytes), byte => byte.toString(16).padStart(2, '0')).join('')

  // Create receipt
  const createdAt = new Date().toISOString()
  const receipt = {
    threadId,
    identityKind: 'holder',
    holderPublicKey: walletPublicKey,
    guestIdentityId: null,
    guestPublicKey: null,
    wrap: wrappedKey,
    policy: 'mutual',
    inviter: walletPublicKey,
    inviterName: 'Self',
    label: `New Thread`,
    initials: 'NT',
    status: 'active',
    createdAt,
    acceptedAt: createdAt,
    updatedAt: createdAt,
    supportsLeave: false, // Holders can only burn, not leave
  }

  // Create thread metadata with required CT mint fields
  const metadata = {
    threadId,
    policy: 'mutual',
    rawKeyBase64,
    blobHash,
    encKeyWrap: wrappedKey,
    hintURL: '',
    createdAt,
  }

  // Persist receipt and metadata
  await saveJoinReceipt(threadId, receipt)
  await saveThreadMetadata(threadId, metadata)

  return {
    receipt,
    metadata,
    rawKeyBase64,
  }
}
