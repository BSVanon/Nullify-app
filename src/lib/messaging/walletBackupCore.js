import { joinReceiptStore, guestIdentityStore } from './storage'
import { buildLocalBackupPayload, applyLocalBackupPayload } from '@/lib/settings/localBackup.js'
import { getWallet } from '@/lib/wallet/client.js'
import { encryptWithWalletKey, decryptWithWalletKey, hashIdentityKey } from './backupCrypto'

export const BACKUP_VERSION = 2
export const BACKUP_KEY_PREFIX = 'wallet-backup:'
export const logPrefix = '[wallet-backup]'

/**
 * Gets deterministic key material from the wallet for backup encryption.
 * Uses getPublicKey with a specific protocol/keyID to derive a unique key
 * that only this wallet can reproduce.
 */
export async function getBackupKeyMaterial() {
  const { client } = await getWallet({ autoConnect: false })
  
  if (!client) {
    throw new Error('Wallet not connected')
  }

  // Use getPublicKey with backup-specific derivation path
  // This is deterministic - same wallet will always produce same key
  if (typeof client.getPublicKey === 'function') {
    try {
      const result = await client.getPublicKey({
        protocolID: [2, 'nukenote backup'],
        keyID: 'backup-encryption-key-v1',
      })
      const pubKey = result?.publicKey || result
      if (pubKey) {
        const keyStr = typeof pubKey === 'string' ? pubKey : Buffer.from(pubKey).toString('hex')
        console.log('[wallet-backup] derived backup key from wallet')
        return keyStr
      }
    } catch (error) {
      console.warn('[wallet-backup] getPublicKey with protocol failed, trying identity key', error?.message)
    }
  }

  // Fallback: use identity key directly (still secure, just less isolated)
  if (typeof client.getPublicKey === 'function') {
    try {
      const result = await client.getPublicKey({ identityKey: true })
      const pubKey = result?.publicKey || result
      if (pubKey) {
        const keyStr = typeof pubKey === 'string' ? pubKey : Buffer.from(pubKey).toString('hex')
        console.log('[wallet-backup] using identity key for backup encryption')
        return keyStr
      }
    } catch (error) {
      console.warn('[wallet-backup] getPublicKey identity failed', error?.message)
    }
  }

  throw new Error('Wallet does not support key derivation for backup')
}

/**
 * Generates the backup cache key from identity key.
 */
export async function getBackupCacheKey(identityKey) {
  return hashIdentityKey(identityKey, BACKUP_KEY_PREFIX)
}

/**
 * Collects all thread data for backup.
 */
export async function collectThreadData() {
  const receipts = []
  const identities = []

  await joinReceiptStore.iterate((value, key) => {
    if (value && key) {
      // Skip burned/left threads
      if (value.status === 'burned' || value.status === 'left') {
        return
      }
      // Sanitize receipt - remove transient/sensitive fields
      const sanitized = { ...value }
      delete sanitized.rawKeyBase64
      delete sanitized.rawThreadKeyBase64
      delete sanitized.threadMetadata // Large, can be reconstructed
      receipts.push({ threadId: key, receipt: sanitized })
    }
  })

  await guestIdentityStore.iterate((value, key) => {
    if (value && key) {
      identities.push({
        id: key,
        identity: {
          id: value.id,
          kind: value.kind,
          threadId: value.threadId,
          privateKey: value.privateKey, // Will be encrypted
          publicKey: value.publicKey,
          createdAt: value.createdAt,
        }
      })
    }
  })

  return { receipts, identities }
}

// Re-export shared primitives used by higher-level backup modules
export {
  joinReceiptStore,
  guestIdentityStore,
  buildLocalBackupPayload,
  applyLocalBackupPayload,
  encryptWithWalletKey,
  decryptWithWalletKey,
}
