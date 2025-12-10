import { base64UrlDecode } from '../utils'

/**
 * Wrap an encryption key using AES-GCM with ECDH
 * @param {Uint8Array} keyToWrap - The AES key to wrap (32 bytes)
 * @param {string} recipientPubKey - Hex-encoded public key (33 or 65 bytes)
 * @returns {Promise<string>} Base64-encoded wrapped key
 */
export async function wrapKeyWithECIES(keyToWrap, recipientPubKey) {
  if (!keyToWrap || keyToWrap.length !== 32) {
    throw new Error('keyToWrap must be 32 bytes (AES-256 key)')
  }
  if (!recipientPubKey || typeof recipientPubKey !== 'string') {
    throw new Error('recipientPubKey must be a hex string')
  }

  const { PublicKey, PrivateKey, Hash } = await import('/node_modules/@bsv/sdk/dist/esm/mod.js')

  // Parse recipient's public key
  const recipientKey = PublicKey.fromString(recipientPubKey, 'hex')

  // Generate ephemeral key pair
  const ephemeralPrivateKey = PrivateKey.fromRandom()
  const ephemeralPublicKey = ephemeralPrivateKey.toPublicKey()

  // Derive shared secret using ECDH
  const sharedSecret = recipientKey.deriveSharedSecret(ephemeralPrivateKey)
  
  // Hash the shared secret to get AES key (32 bytes)
  const keyMaterialArray = Hash.sha256(sharedSecret.encode(true))
  const keyMaterial = new Uint8Array(keyMaterialArray)

  // Use Web Crypto API for AES-GCM encryption
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyMaterial,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  )

  // Generate random IV (12 bytes for GCM)
  const iv = crypto.getRandomValues(new Uint8Array(12))

  // Encrypt the key to wrap
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    keyToWrap
  )

  // Combine: ephemeral pubkey (33) + IV (12) + encrypted data
  const ephemeralPubKeyBytes = ephemeralPublicKey.encode(true)
  const combined = new Uint8Array(33 + 12 + encrypted.byteLength)
  combined.set(ephemeralPubKeyBytes, 0)
  combined.set(iv, 33)
  combined.set(new Uint8Array(encrypted), 45)

  // Return as base64
  return btoa(String.fromCharCode(...combined))
}

/**
 * Unwrap an encryption key using ECIES with a private key
 * @param {string} wrappedKey - Base64-encoded wrapped key
 * @param {string} recipientPrivKey - WIF or hex-encoded private key
 * @returns {Promise<Uint8Array>} Unwrapped AES key (32 bytes)
 */
export async function unwrapKeyWithECIES(wrappedKey, recipientPrivKey) {
  if (!wrappedKey || typeof wrappedKey !== 'string') {
    throw new Error('wrappedKey must be a base64 string')
  }
  if (!recipientPrivKey || typeof recipientPrivKey !== 'string') {
    throw new Error('recipientPrivKey required')
  }

  const { PrivateKey, PublicKey, Hash } = await import('/node_modules/@bsv/sdk/dist/esm/mod.js')

  // Parse private key (support either WIF or raw hex). Our guest identities
  // store privateKey as 64-char hex; only treat input as WIF if it matches
  // typical WIF length and Base58 charset.
  let privKey
  try {
    const maybeWif =
      typeof recipientPrivKey === 'string' &&
      (recipientPrivKey.length === 51 || recipientPrivKey.length === 52) &&
      /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/.test(
        recipientPrivKey,
      )

    privKey = maybeWif
      ? PrivateKey.fromWif(recipientPrivKey)
      : PrivateKey.fromString(recipientPrivKey, 'hex')
  } catch (error) {
    console.error('[keyWrapping] Failed to parse recipientPrivKey', error)
    throw error
  }

  // Decode base64 / base64url
  const decoded = base64UrlDecode(wrappedKey)
  const combined = Uint8Array.from(decoded, (c) => c.charCodeAt(0))

  // Extract components: ephemeral pubkey (33) + IV (12) + encrypted data
  const ephemeralPubKeyBytes = combined.slice(0, 33)
  const iv = combined.slice(33, 45)
  const encryptedData = combined.slice(45)

  // Parse ephemeral public key
  const ephemeralPublicKey = PublicKey.fromString(
    Array.from(ephemeralPubKeyBytes).map(b => b.toString(16).padStart(2, '0')).join(''),
    'hex'
  )

  // Derive shared secret using ECDH
  const sharedSecret = ephemeralPublicKey.deriveSharedSecret(privKey)
  
  // Hash the shared secret to get AES key
  const keyMaterialArray = Hash.sha256(sharedSecret.encode(true))
  const keyMaterial = new Uint8Array(keyMaterialArray)

  // Use Web Crypto API for AES-GCM decryption
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyMaterial,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  )

  // Decrypt with explicit authentication tag verification
  let decrypted;
  try {
    decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      encryptedData
    )
  } catch (error) {
    // AES-GCM authentication failure manifests as OperationError
    if (error.name === 'OperationError') {
      throw new Error('Key unwrap failed: authentication tag mismatch or corrupted ciphertext. The wrapped key may have been tampered with or the wrong private key was used.')
    }
    throw error
  }

  return new Uint8Array(decrypted)
}

/**
 * Wrap a key using the connected wallet's public key
 * @param {Uint8Array} keyToWrap - The AES key to wrap
 * @param {Object} wallet - WalletClient instance
 * @returns {Promise<string>} Base64-encoded wrapped key
 */
export async function wrapKeyWithWallet(keyToWrap, wallet) {
  if (!wallet) {
    throw new Error('Wallet instance required')
  }

  // Get wallet's public key
  const result = await wallet.getPublicKey({ identityKey: true })
  const publicKey = result.publicKey || result.identityKey || result

  if (!publicKey) {
    throw new Error('Failed to get public key from wallet')
  }

  // Wrap using ECIES
  return wrapKeyWithECIES(keyToWrap, publicKey)
}
