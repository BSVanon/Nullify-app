import { isHelperCacheEnabled } from './helperCacheIntegration'
import { putHelperCacheItem, getHelperCacheItem, deleteHelperCacheItem } from './helperCacheClient'
import {
  BACKUP_VERSION,
  BACKUP_KEY_PREFIX,
  logPrefix,
  getBackupKeyMaterial,
  getBackupCacheKey,
  collectThreadData,
  buildLocalBackupPayload,
  applyLocalBackupPayload,
  joinReceiptStore,
  guestIdentityStore,
  decryptWithWalletKey,
} from './walletBackupCore'

/**
 * Creates a unified backup of all local data and uploads it to helper cache.
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
 * Restores all data from a wallet-signed backup stored in helper cache.
 */
export async function restoreWalletBackup({ identityKey, logger = console }) {
  if (!isHelperCacheEnabled()) {
    return { success: false, error: 'Backup service not available' }
  }

  if (!identityKey) {
    return { success: false, error: 'Wallet identity key required' }
  }

  try {
    const cacheKey = await getBackupCacheKey(identityKey)
    const cached = await getHelperCacheItem(cacheKey)

    if (!cached?.encrypted) {
      logger.info?.(logPrefix, 'no backup found for this wallet')
      return { success: false, error: 'No backup found for this wallet' }
    }

    logger.info?.(logPrefix, 'deriving backup decryption key from wallet...')
    const keyMaterial = await getBackupKeyMaterial()

    const decrypted = await decryptWithWalletKey(cached.encrypted, keyMaterial)

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

    logger.info?.(logPrefix, 'backup restored successfully', {
      threadCount: restoredThreads,
    })

    return {
      success: true,
      threadCount: restoredThreads,
      needsReload: true,
    }
  } catch (error) {
    if (error?.message?.includes('decrypt') || error?.name === 'OperationError') {
      logger.error?.(logPrefix, 'decryption failed - wallet key mismatch?')
      return { success: false, error: 'Could not decrypt backup. Wrong wallet?' }
    }
    logger.error?.(logPrefix, 'restore failed', { error: error?.message })
    return { success: false, error: error?.message || 'Restore failed' }
  }
}

/**
 * Checks if a backup exists for the given wallet.
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
 * Deletes the wallet backup from helper cache.
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
  checkWalletBackup,
  deleteWalletBackup,
}
