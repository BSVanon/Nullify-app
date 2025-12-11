/**
 * Backup Encryption Utilities
 * 
 * Shared cryptographic functions for thread and wallet backup modules.
 * Provides AES-GCM encryption with both passphrase-based (PBKDF2) and
 * wallet-derived (HKDF) key derivation.
 */

/**
 * Derives an encryption key from a passphrase using PBKDF2.
 * Uses a fixed salt derived from the user's identity to ensure deterministic key derivation.
 */
export async function deriveKeyFromPassphrase(passphrase, salt) {
  const encoder = new TextEncoder()
  const passphraseKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode(salt),
      iterations: 100000,
      hash: 'SHA-256',
    },
    passphraseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

/**
 * Derives an encryption key from a wallet signature using HKDF.
 * The wallet signs a fixed message, and we derive an AES key from it.
 */
export async function deriveKeyFromSignature(signature) {
  const encoder = new TextEncoder()
  
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(signature),
    'HKDF',
    false,
    ['deriveKey']
  )

  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      salt: encoder.encode('nullify-backup-salt'),
      info: encoder.encode('nullify-backup-key'),
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

/**
 * Encrypts data with AES-GCM using a passphrase-derived key.
 */
export async function encryptWithPassphrase(data, passphrase, salt) {
  const key = await deriveKeyFromPassphrase(passphrase, salt)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoder = new TextEncoder()
  
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(JSON.stringify(data))
  )

  const combined = new Uint8Array(iv.length + ciphertext.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(ciphertext), iv.length)

  return btoa(String.fromCharCode(...combined))
}

/**
 * Decrypts data encrypted with encryptWithPassphrase.
 */
export async function decryptWithPassphrase(encryptedBase64, passphrase, salt) {
  const key = await deriveKeyFromPassphrase(passphrase, salt)
  
  const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0))
  const iv = combined.slice(0, 12)
  const ciphertext = combined.slice(12)

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  )

  const decoder = new TextDecoder()
  return JSON.parse(decoder.decode(decrypted))
}

/**
 * Encrypts data with AES-GCM using wallet-derived key.
 */
export async function encryptWithWalletKey(data, signature) {
  const key = await deriveKeyFromSignature(signature)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoder = new TextEncoder()
  
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(JSON.stringify(data))
  )

  const combined = new Uint8Array(iv.length + ciphertext.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(ciphertext), iv.length)

  return btoa(String.fromCharCode(...combined))
}

/**
 * Decrypts data encrypted with encryptWithWalletKey.
 */
export async function decryptWithWalletKey(encryptedBase64, signature) {
  const key = await deriveKeyFromSignature(signature)
  
  const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0))
  const iv = combined.slice(0, 12)
  const ciphertext = combined.slice(12)

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  )

  const decoder = new TextDecoder()
  return JSON.parse(decoder.decode(decrypted))
}

/**
 * Generates a deterministic salt from a user's wallet identity key.
 * This ensures the same passphrase produces the same encryption key across sessions.
 */
export async function generateUserSalt(identityKey) {
  if (!identityKey) {
    throw new Error('Identity key required to generate user salt')
  }

  const encoder = new TextEncoder()
  const data = encoder.encode(`nullify-backup-salt:${identityKey}`)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = new Uint8Array(hashBuffer)
  
  return Array.from(hashArray.slice(0, 16))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Generates a cache key hash from an identity key.
 */
export async function hashIdentityKey(identityKey, prefix = '') {
  const encoder = new TextEncoder()
  const data = encoder.encode(`${prefix}${identityKey}`)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = new Uint8Array(hashBuffer)
  
  return prefix + Array.from(hashArray.slice(0, 16))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}
