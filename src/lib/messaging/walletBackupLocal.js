import {
  BACKUP_VERSION,
  logPrefix,
  getBackupKeyMaterial,
  collectThreadData,
  buildLocalBackupPayload,
  applyLocalBackupPayload,
  joinReceiptStore,
  guestIdentityStore,
  decryptWithWalletKey,
} from './walletBackupCore'
import { encryptWithWalletKey } from './backupCrypto'

/**
 * Builds an encrypted backup without uploading it anywhere.
 * Used for local backup file download.
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

export default {
  createLocalEncryptedBackup,
  restoreWalletBackupFromEncrypted,
}
