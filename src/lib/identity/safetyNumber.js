/**
 * Safety Number Generation
 * 
 * Generates human-verifiable fingerprints from public keys for manual identity verification.
 * Format: 12 groups of 5 digits (e.g., "12345 67890 12345 ...")
 */

import { Hash } from '@bsv/sdk'

/**
 * Generate a safety number (fingerprint) from a public key
 * @param {string} pubkeyHex - Hex-encoded public key
 * @returns {string} Formatted safety number (12 groups of 5 digits)
 */
export function safetyNumber(pubkeyHex) {
  if (!pubkeyHex || typeof pubkeyHex !== 'string') {
    throw new Error('pubkeyHex is required and must be a string')
  }

  // Normalize to lowercase for consistent hashing
  const normalizedHex = pubkeyHex.toLowerCase()

  // Double-hash for fingerprint (SHA256 twice)
  // Convert hex string to Uint8Array for browser compatibility
  const pubkeyBytes = new Uint8Array(
    normalizedHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16))
  )
  const hash1 = Hash.sha256(pubkeyBytes)
  const hash2 = Hash.sha256(hash1)

  // Convert to decimal groups
  const groups = []
  for (let i = 0; i < 12; i++) {
    // Take 2 bytes at a time, convert to 5-digit decimal
    const offset = (i * 2) % hash2.length
    const value = (hash2[offset] << 8) | hash2[offset + 1]
    const group = String(value % 100000).padStart(5, '0')
    groups.push(group)
  }

  return groups.join(' ')
}

export function jointSafetyNumber(pubkeyHexA, pubkeyHexB) {
  if (!pubkeyHexA || !pubkeyHexB || typeof pubkeyHexA !== 'string' || typeof pubkeyHexB !== 'string') {
    throw new Error('pubkeyHexA and pubkeyHexB are required and must be strings')
  }

  const [a, b] = [pubkeyHexA.toLowerCase(), pubkeyHexB.toLowerCase()].sort()
  const hex = a + b

  const bytes = new Uint8Array(
    hex.match(/.{1,2}/g).map(byte => parseInt(byte, 16))
  )
  const hash1 = Hash.sha256(bytes)
  const hash2 = Hash.sha256(hash1)

  const groups = []
  for (let i = 0; i < 12; i++) {
    const offset = (i * 2) % hash2.length
    const value = (hash2[offset] << 8) | hash2[offset + 1]
    const group = String(value % 100000).padStart(5, '0')
    groups.push(group)
  }

  return groups.join(' ')
}

/**
 * Generate a QR code data URL for a safety number
 * @param {string} pubkeyHex - Hex-encoded public key
 * @returns {string} Safety number (plain text for QR encoding)
 */
export function safetyNumberQR(pubkeyHex) {
  // Return the raw safety number for QR encoding
  // The UI component will handle QR generation
  return safetyNumber(pubkeyHex)
}

/**
 * Compare two safety numbers (case-insensitive, whitespace-tolerant)
 * @param {string} a - First safety number
 * @param {string} b - Second safety number
 * @returns {boolean} True if they match
 */
export function compareSafetyNumbers(a, b) {
  if (!a || !b) return false
  
  // Normalize: remove whitespace, convert to lowercase
  const normalize = (s) => s.replace(/\s+/g, '').toLowerCase()
  
  return normalize(a) === normalize(b)
}
