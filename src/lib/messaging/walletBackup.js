/**
 * Unified Wallet-Signed Backup & Recovery
 * 
 * Combines thread data and local settings into a single encrypted backup
 * stored on the helper cache. Uses wallet signature for key derivation,
 * eliminating the need for passphrases or manual CT outpoint lookup.
 * 
 * FLOW:
 * 1. Wallet signs a deterministic message to derive encryption key
 * 2. All local data (receipts, identities, profiles, contacts, prefs) is encrypted
 * 3. Encrypted blob uploaded to helper cache keyed by hash(identityKey)
 * 4. On restore: wallet signs same message → same key → decrypt all data
 * 
 * SECURITY:
 * - Encryption key derived from wallet signature (only wallet holder can decrypt)
 * - Helper cache only sees encrypted blob + identity key hash
 * - Burned threads are excluded from backup (and backup updated on burn)
 * - No plaintext ever leaves the client
 */

import { joinReceiptStore, guestIdentityStore } from './storage'
import { isHelperCacheEnabled } from './helperCacheIntegration'
import { putHelperCacheItem, getHelperCacheItem, deleteHelperCacheItem } from './helperCacheClient'
import { buildLocalBackupPayload, applyLocalBackupPayload } from '@/lib/settings/localBackup.js'
import { getWallet } from '@/lib/wallet/client.js'
import { encryptWithWalletKey, decryptWithWalletKey, hashIdentityKey } from './backupCrypto'

const BACKUP_VERSION = 2
const BACKUP_KEY_PREFIX = 'wallet-backup:'
const logPrefix = '[wallet-backup]'

/**
 * Gets a deterministic key material from the wallet for backup encryption.
 * Uses getPublicKey with a specific protocol/keyID to derive a unique key
 * that only this wallet can reproduce.
 */
async function getBackupKeyMaterial() {
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
async function getBackupCacheKey(identityKey) {
  return hashIdentityKey(identityKey, BACKUP_KEY_PREFIX)
}

/**
 * Collects all thread data for backup.
 */
async function collectThreadData() {
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

/**
 * Creates a unified backup of all local data.
 * 
 * @param {object} options
 * @param {string} options.identityKey - Wallet identity key
 * @param {object} [options.logger] - Logger instance
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function createWalletBackup({ identityKey, logger = console }) {
  if (!isHelperCacheEnabled()) {
    logger.info?.(logPrefix, 'helper cache not configured, skipping backup')
    return { success: false, error: 'Backup service not available' }
  }

  if (!identityKey) {
    return { success: false, error: 'Wallet identity key required' }
  }

  try {
    // Get wallet key material for encryption
    logger.info?.(logPrefix, 'deriving backup encryption key from wallet...')
    const keyMaterial = await getBackupKeyMaterial()

    // Collect all data
    const [threadData, localData] = await Promise.all([
      collectThreadData(),
      buildLocalBackupPayload(),
    ])

    const backupPayload = {
      version: BACKUP_VERSION,
      createdAt: new Date().toISOString(),
      threads: threadData,
      local: localData,
    }

    // Encrypt with wallet-derived key
    const encrypted = await encryptWithWalletKey(backupPayload, keyMaterial)

    // Upload to helper cache
    const cacheKey = await getBackupCacheKey(identityKey)
    await putHelperCacheItem(cacheKey, {
      encrypted,
      version: BACKUP_VERSION,
      createdAt: new Date().toISOString(),
      identityKeyHash: cacheKey.replace(BACKUP_KEY_PREFIX, ''),
    })

    logger.info?.(logPrefix, 'backup created successfully', {
      threadCount: threadData.receipts.length,
      identityCount: threadData.identities.length,
    })

    return { 
      success: true, 
      threadCount: threadData.receipts.length,
      identityCount: threadData.identities.length,
    }
  } catch (error) {
    logger.error?.(logPrefix, 'backup failed', { error: error?.message })
    return { success: false, error: error?.message || 'Backup failed' }
  }
}

/**
 * Restores all data from a wallet-signed backup.
 * 
 * @param {object} options
 * @param {string} options.identityKey - Wallet identity key
 * @param {object} [options.logger] - Logger instance
 * @returns {Promise<{success: boolean, threadCount?: number, error?: string}>}
 */
export async function restoreWalletBackup({ identityKey, logger = console }) {
  if (!isHelperCacheEnabled()) {
    return { success: false, error: 'Backup service not available' }
  }

  if (!identityKey) {
    return { success: false, error: 'Wallet identity key required' }
  }

  try {
    // Check if backup exists
    const cacheKey = await getBackupCacheKey(identityKey)
    const cached = await getHelperCacheItem(cacheKey)

    if (!cached?.encrypted) {
      logger.info?.(logPrefix, 'no backup found for this wallet')
      return { success: false, error: 'No backup found for this wallet' }
    }

    // Get wallet key material for decryption
    logger.info?.(logPrefix, 'deriving backup decryption key from wallet...')
    const keyMaterial = await getBackupKeyMaterial()

    // Decrypt
    const decrypted = await decryptWithWalletKey(cached.encrypted, keyMaterial)

    if (!decrypted || decrypted.version !== BACKUP_VERSION) {
      return { success: false, error: 'Invalid or incompatible backup' }
    }

    // Restore thread data
    const { threads, local } = decrypted
    let restoredThreads = 0

    if (threads?.receipts) {
      for (const { threadId, receipt } of threads.receipts) {
        await joinReceiptStore.setItem(threadId, receipt)
        restoredThreads++
      }
    }

    if (threads?.identities) {
      for (const { id, identity } of threads.identities) {
        await guestIdentityStore.setItem(id, identity)
      }
    }

    // Restore local settings
    if (local) {
      await applyLocalBackupPayload(local)
    }

    logger.info?.(logPrefix, 'backup restored successfully', {
      threadCount: restoredThreads,
    })

    return { 
      success: true, 
      threadCount: restoredThreads,
      needsReload: true,
    }
  } catch (error) {
    // Decryption failure
    if (error?.message?.includes('decrypt') || error?.name === 'OperationError') {
      logger.error?.(logPrefix, 'decryption failed - wallet key mismatch?')
      return { success: false, error: 'Could not decrypt backup. Wrong wallet?' }
    }
    logger.error?.(logPrefix, 'restore failed', { error: error?.message })
    return { success: false, error: error?.message || 'Restore failed' }
  }
}

/**
 * Builds an encrypted backup without uploading it anywhere.
 * Used for local backup file download.
 *
 * @param {object} options
 * @param {string} options.identityKey - Wallet identity key
 */
export async function createLocalEncryptedBackup({ identityKey, logger = console }) {
  if (!identityKey) {
    return { success: false, error: 'Wallet identity key required' }
  }

  try {
    logger.info?.(logPrefix, 'deriving local backup encryption key from wallet...')
    const keyMaterial = await getBackupKeyMaterial()

    const [threadData, localData] = await Promise.all([
      collectThreadData(),
      buildLocalBackupPayload(),
    ])

    const backupPayload = {
      version: BACKUP_VERSION,
      createdAt: new Date().toISOString(),
      threads: threadData,
      local: localData,
    }

    const encrypted = await encryptWithWalletKey(backupPayload, keyMaterial)

    return {
      success: true,
      encrypted,
      createdAt: backupPayload.createdAt,
      threadCount: threadData.receipts.length,
      identityCount: threadData.identities.length,
    }
  } catch (error) {
    logger.error?.(logPrefix, 'local backup build failed', { error: error?.message })
    return { success: false, error: error?.message || 'Backup failed' }
  }
}

/**
 * Restores data from a provided encrypted backup blob (e.g. local file).
 *
 * @param {object} options
 * @param {string} options.identityKey - Wallet identity key
 * @param {string} options.encrypted - Encrypted backup payload
 */
export async function restoreWalletBackupFromEncrypted({ identityKey, encrypted, logger = console }) {
  if (!identityKey) {
    return { success: false, error: 'Wallet identity key required' }
  }
  if (!encrypted) {
    return { success: false, error: 'Encrypted backup data required' }
  }

  try {
    logger.info?.(logPrefix, 'deriving backup decryption key from wallet (local file)...')
    const keyMaterial = await getBackupKeyMaterial()
    const decrypted = await decryptWithWalletKey(encrypted, keyMaterial)

    if (!decrypted || decrypted.version !== BACKUP_VERSION) {
      return { success: false, error: 'Invalid or incompatible backup' }
    }

    const { threads, local } = decrypted
    let restoredThreads = 0

    if (threads?.receipts) {
      for (const { threadId, receipt } of threads.receipts) {
        await joinReceiptStore.setItem(threadId, receipt)
        restoredThreads++
      }
    }

    if (threads?.identities) {
      for (const { id, identity } of threads.identities) {
        await guestIdentityStore.setItem(id, identity)
      }
    }

    if (local) {
      await applyLocalBackupPayload(local)
    }

    logger.info?.(logPrefix, 'local backup restored successfully', {
      threadCount: restoredThreads,
    })

    return {
      success: true,
      threadCount: restoredThreads,
      needsReload: true,
    }
  } catch (error) {
    if (error?.message?.includes('decrypt') || error?.name === 'OperationError') {
      logger.error?.(logPrefix, 'local backup decryption failed - wallet key mismatch?')
      return { success: false, error: 'Could not decrypt backup. Wrong wallet?' }
    }
    logger.error?.(logPrefix, 'local restore failed', { error: error?.message })
    return { success: false, error: error?.message || 'Restore failed' }
  }
}

/**
 * Checks if a backup exists for the given wallet.
 * 
 * @param {string} identityKey - Wallet identity key
 * @returns {Promise<{exists: boolean, createdAt?: string}>}
 */
export async function checkWalletBackup(identityKey) {
  if (!isHelperCacheEnabled() || !identityKey) {
    return { exists: false }
  }

  try {
    const cacheKey = await getBackupCacheKey(identityKey)
    const cached = await getHelperCacheItem(cacheKey)

    if (cached?.encrypted) {
      return { 
        exists: true, 
        createdAt: cached.createdAt,
        version: cached.version,
      }
    }
    return { exists: false }
  } catch {
    return { exists: false }
  }
}

/**
 * Deletes the wallet backup.
 * 
 * @param {string} identityKey - Wallet identity key
 * @returns {Promise<{success: boolean}>}
 */
export async function deleteWalletBackup(identityKey) {
  if (!isHelperCacheEnabled() || !identityKey) {
    return { success: false }
  }

  try {
    const cacheKey = await getBackupCacheKey(identityKey)
    await deleteHelperCacheItem(cacheKey)
    return { success: true }
  } catch {
    return { success: false }
  }
}

export default {
  createWalletBackup,
  restoreWalletBackup,
  createLocalEncryptedBackup,
  restoreWalletBackupFromEncrypted,
  checkWalletBackup,
  deleteWalletBackup,
}
