/**
 * Thread-Level Backup & Recovery
 * 
 * Stores encrypted thread metadata on the helper cache so users can recover
 * threads if they clear browser storage. This is single-device recovery only.
 * 
 * SECURITY NOTES:
 * - Thread keys (rawKeyBase64) are NEVER backed up - they're derived from DT tokens
 * - Guest private keys are encrypted with a user-provided recovery passphrase
 * - Backup payloads are encrypted client-side before upload
 * - Burn events must trigger backup deletion (enforced via CT outpoint key)
 * 
 * PRIVACY NOTES:
 * - Helper cache only sees encrypted blobs keyed by CT outpoint
 * - No plaintext metadata ever leaves the client
 * - Recovery requires both the backup AND the passphrase
 */

import { joinReceiptStore, guestIdentityStore } from './storage'
import { isHelperCacheEnabled, buildHelperCacheId } from './helperCacheIntegration'
import { putHelperCacheItem, getHelperCacheItem, deleteHelperCacheItem } from './helperCacheClient'
import { encryptWithPassphrase, decryptWithPassphrase, generateUserSalt } from './backupCrypto'

const BACKUP_VERSION = 1
const BACKUP_PREFIX = 'backup:'
const logPrefix = '[thread-backup]'

/**
 * Builds the backup cache key for a thread.
 * Uses CT outpoint so burns automatically invalidate the backup key.
 */
function buildBackupCacheId(ctTxid, ctVout) {
  const baseId = buildHelperCacheId(ctTxid, ctVout)
  if (!baseId) return null
  return `${BACKUP_PREFIX}${baseId}`
}

/**
 * Prepares a receipt for backup by removing sensitive/transient fields.
 */
function sanitizeReceiptForBackup(receipt) {
  if (!receipt) return null

  // Fields to exclude from backup
  const excludeFields = [
    'rawKeyBase64',
    'rawThreadKeyBase64',
    'threadMetadata', // Large, can be reconstructed
  ]

  const sanitized = { ...receipt }
  for (const field of excludeFields) {
    delete sanitized[field]
  }

  return sanitized
}

/**
 * Prepares a guest identity for backup.
 * Private key is included but will be encrypted.
 */
function sanitizeIdentityForBackup(identity) {
  if (!identity) return null

  return {
    id: identity.id,
    kind: identity.kind,
    threadId: identity.threadId,
    privateKey: identity.privateKey, // Will be encrypted
    publicKey: identity.publicKey,
    createdAt: identity.createdAt,
  }
}

/**
 * Backs up a single thread to the helper cache.
 * 
 * @param {object} options
 * @param {string} options.threadId - Thread ID
 * @param {object} options.receipt - Join receipt
 * @param {object} [options.guestIdentity] - Guest identity (if guest mode)
 * @param {string} options.passphrase - User's recovery passphrase
 * @param {string} options.userSalt - Salt derived from user identity (e.g., wallet pubkey hash)
 * @param {object} [options.logger] - Logger instance
 * @returns {Promise<{success: boolean, cacheId?: string, error?: string}>}
 */
export async function backupThread({
  threadId,
  receipt,
  guestIdentity,
  passphrase,
  userSalt,
  logger = console,
}) {
  if (!isHelperCacheEnabled()) {
    logger.info?.(logPrefix, 'helper cache not configured, skipping backup')
    return { success: false, error: 'Helper cache not configured' }
  }

  if (!receipt?.ctTxid) {
    logger.warn?.(logPrefix, 'receipt missing ctTxid, cannot backup', { threadId })
    return { success: false, error: 'Receipt missing CT outpoint' }
  }

  if (!passphrase || passphrase.length < 8) {
    return { success: false, error: 'Passphrase must be at least 8 characters' }
  }

  if (!userSalt) {
    return { success: false, error: 'User salt required for encryption' }
  }

  const cacheId = buildBackupCacheId(receipt.ctTxid, receipt.ctVout)
  if (!cacheId) {
    return { success: false, error: 'Could not build backup cache ID' }
  }

  try {
    const backupPayload = {
      threadId,
      receipt: sanitizeReceiptForBackup(receipt),
      guestIdentity: guestIdentity ? sanitizeIdentityForBackup(guestIdentity) : null,
      backedUpAt: new Date().toISOString(),
      version: BACKUP_VERSION,
    }

    const encrypted = await encryptWithPassphrase(backupPayload, passphrase, userSalt)

    await putHelperCacheItem(cacheId, {
      encrypted,
      version: BACKUP_VERSION,
      createdAt: new Date().toISOString(),
    })

    logger.info?.(logPrefix, 'thread backed up successfully', { threadId, cacheId })
    return { success: true, cacheId }
  } catch (error) {
    logger.error?.(logPrefix, 'failed to backup thread', {
      threadId,
      error: error?.message || String(error),
    })
    return { success: false, error: error?.message || 'Backup failed' }
  }
}

/**
 * Backs up all local threads to the helper cache.
 * 
 * @param {object} options
 * @param {string} options.passphrase - User's recovery passphrase
 * @param {string} options.userSalt - Salt derived from user identity
 * @param {object} [options.logger] - Logger instance
 * @returns {Promise<{total: number, succeeded: number, failed: number, errors: string[]}>}
 */
export async function backupAllThreads({ passphrase, userSalt, logger = console }) {
  if (!isHelperCacheEnabled()) {
    return { total: 0, succeeded: 0, failed: 0, errors: ['Helper cache not configured'] }
  }

  const results = { total: 0, succeeded: 0, failed: 0, errors: [] }

  try {
    // Collect all receipts
    const receipts = []
    await joinReceiptStore.iterate((value, key) => {
      if (value && key) {
        receipts.push({ threadId: key, receipt: value })
      }
    })

    results.total = receipts.length

    // Collect guest identities
    const identitiesMap = new Map()
    await guestIdentityStore.iterate((value, key) => {
      if (value?.threadId) {
        identitiesMap.set(value.threadId, value)
      }
    })

    // Backup each thread
    for (const { threadId, receipt } of receipts) {
      // Skip burned/left threads
      if (receipt.status === 'burned' || receipt.status === 'left') {
        logger.info?.(logPrefix, 'skipping backup for inactive thread', { threadId, status: receipt.status })
        continue
      }

      const guestIdentity = identitiesMap.get(threadId) || null

      const result = await backupThread({
        threadId,
        receipt,
        guestIdentity,
        passphrase,
        userSalt,
        logger,
      })

      if (result.success) {
        results.succeeded++
      } else {
        results.failed++
        results.errors.push(`${threadId}: ${result.error}`)
      }
    }

    logger.info?.(logPrefix, 'backup all threads complete', results)
    return results
  } catch (error) {
    logger.error?.(logPrefix, 'backup all threads failed', { error: error?.message })
    results.errors.push(error?.message || 'Unknown error')
    return results
  }
}

/**
 * Restores a single thread from the helper cache.
 * 
 * @param {object} options
 * @param {string} options.ctTxid - CT transaction ID
 * @param {number} options.ctVout - CT output index
 * @param {string} options.passphrase - User's recovery passphrase
 * @param {string} options.userSalt - Salt derived from user identity
 * @param {object} [options.logger] - Logger instance
 * @returns {Promise<{success: boolean, threadId?: string, receipt?: object, guestIdentity?: object, error?: string}>}
 */
export async function restoreThread({
  ctTxid,
  ctVout,
  passphrase,
  userSalt,
  logger = console,
}) {
  if (!isHelperCacheEnabled()) {
    return { success: false, error: 'Helper cache not configured' }
  }

  const cacheId = buildBackupCacheId(ctTxid, ctVout)
  if (!cacheId) {
    return { success: false, error: 'Invalid CT outpoint' }
  }

  try {
    const cached = await getHelperCacheItem(cacheId)
    if (!cached?.encrypted) {
      return { success: false, error: 'No backup found for this thread' }
    }

    const decrypted = await decryptWithPassphrase(cached.encrypted, passphrase, userSalt)

    if (!decrypted?.receipt) {
      return { success: false, error: 'Invalid backup data' }
    }

    // Restore receipt to local storage
    const { threadId, receipt, guestIdentity } = decrypted
    await joinReceiptStore.setItem(threadId, receipt)

    // Restore guest identity if present
    if (guestIdentity?.id) {
      await guestIdentityStore.setItem(guestIdentity.id, guestIdentity)
    }

    logger.info?.(logPrefix, 'thread restored successfully', { threadId, cacheId })
    return {
      success: true,
      threadId,
      receipt,
      guestIdentity: guestIdentity || null,
    }
  } catch (error) {
    // Decryption failure likely means wrong passphrase
    if (error?.message?.includes('decrypt') || error?.name === 'OperationError') {
      return { success: false, error: 'Incorrect passphrase' }
    }
    logger.error?.(logPrefix, 'failed to restore thread', {
      cacheId,
      error: error?.message || String(error),
    })
    return { success: false, error: error?.message || 'Restore failed' }
  }
}

/**
 * Deletes a thread backup from the helper cache.
 * Called when a thread is burned to ensure backups are unrecoverable.
 * 
 * @param {object} options
 * @param {string} options.ctTxid - CT transaction ID
 * @param {number} options.ctVout - CT output index
 * @param {object} [options.logger] - Logger instance
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function deleteThreadBackup({ ctTxid, ctVout, logger = console }) {
  if (!isHelperCacheEnabled()) {
    return { success: true } // Nothing to delete
  }

  const cacheId = buildBackupCacheId(ctTxid, ctVout)
  if (!cacheId) {
    return { success: false, error: 'Invalid CT outpoint' }
  }

  try {
    await deleteHelperCacheItem(cacheId)
    logger.info?.(logPrefix, 'thread backup deleted', { cacheId })
    return { success: true }
  } catch (error) {
    logger.warn?.(logPrefix, 'failed to delete thread backup', {
      cacheId,
      error: error?.message || String(error),
    })
    return { success: false, error: error?.message || 'Delete failed' }
  }
}

/**
 * Checks if a backup exists for a thread.
 * 
 * @param {object} options
 * @param {string} options.ctTxid - CT transaction ID
 * @param {number} options.ctVout - CT output index
 * @returns {Promise<boolean>}
 */
export async function hasThreadBackup({ ctTxid, ctVout }) {
  if (!isHelperCacheEnabled()) {
    return false
  }

  const cacheId = buildBackupCacheId(ctTxid, ctVout)
  if (!cacheId) {
    return false
  }

  try {
    const cached = await getHelperCacheItem(cacheId)
    return Boolean(cached?.encrypted)
  } catch {
    return false
  }
}

// Re-export generateUserSalt for backward compatibility
export { generateUserSalt } from './backupCrypto'

export default {
  backupThread,
  backupAllThreads,
  restoreThread,
  deleteThreadBackup,
  hasThreadBackup,
  generateUserSalt,
}
