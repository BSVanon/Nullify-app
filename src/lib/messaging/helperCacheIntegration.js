/**
 * Helper cache integration helpers
 */

import {
  isHelperCacheConfigured,
  putHelperCacheItem,
  getHelperCacheItem
} from './helperCacheClient'

const logPrefix = '[helper-cache]'

export function isHelperCacheEnabled() {
  return isHelperCacheConfigured()
}

export function buildHelperCacheId(ctTxid, ctVout) {
  if (!ctTxid || (!Number.isInteger(ctVout) && typeof ctVout !== 'number')) {
    return null
  }
  const vout = Number(ctVout)
  return `${ctTxid}:${Number.isInteger(vout) && vout >= 0 ? vout : 0}`
}

export async function enrollThreadHelperCache({
  threadId,
  ctTxid,
  ctVout,
  payload,
  logger = console
}) {
  if (!isHelperCacheEnabled()) {
    return null
  }

  const cacheId = buildHelperCacheId(ctTxid, ctVout)
  if (!cacheId) {
    logger.warn?.(logPrefix, 'missing CT outpoint for helper cache enrollment', {
      threadId,
      ctTxid,
      ctVout
    })
    return null
  }

  if (!payload || typeof payload !== 'object') {
    logger.warn?.(logPrefix, 'missing payload for helper cache enrollment', {
      threadId,
      cacheId
    })
    return null
  }

  const enrolledAt = new Date().toISOString()

  try {
    await putHelperCacheItem(cacheId, {
      ...payload,
      threadId,
      enrolledAt,
      version: 1
    })

    logger.info?.(logPrefix, 'enrolled helper cache entry', {
      threadId,
      cacheId
    })

    return {
      cacheId,
      enrolled: true,
      enrolledAt
    }
  } catch (error) {
    logger.warn?.(logPrefix, 'failed to enroll helper cache entry', {
      threadId,
      cacheId,
      error: error?.message || String(error)
    })
    return {
      cacheId,
      enrolled: false,
      error: error?.message || String(error),
      lastAttemptAt: enrolledAt
    }
  }
}

export async function fetchHelperCachePayload(cacheId, { logger = console, signal } = {}) {
  if (!cacheId || !isHelperCacheEnabled()) {
    return null
  }

  try {
    const result = await getHelperCacheItem(cacheId, { signal })
    logger.info?.(logPrefix, 'fetched helper cache entry', { cacheId })
    return result
  } catch (error) {
    if (error?.status === 404) {
      logger.info?.(logPrefix, 'helper cache entry missing', { cacheId })
      return null
    }
    logger.warn?.(logPrefix, 'failed to fetch helper cache entry', {
      cacheId,
      error: error?.message || String(error)
    })
    return null
  }
}

/**
 * Fetch pending messages from helper cache for a thread
 * Used when recipient comes online to retrieve messages sent while offline
 */
export async function fetchPendingMessages(cacheId, { logger = console, signal } = {}) {
  if (!cacheId || !isHelperCacheEnabled()) {
    return []
  }

  const messagesKey = `${cacheId}:messages`

  try {
    const result = await getHelperCacheItem(messagesKey, { signal })
    if (!result) {
      return []
    }

    // Handle both single message and array formats
    const messages = Array.isArray(result) ? result : [result]
    
    logger.info?.(logPrefix, 'fetched pending messages from helper cache', {
      cacheId,
      count: messages.length
    })

    return messages.filter(m => m?.message).map(m => m.message)
  } catch (error) {
    if (error?.status === 404) {
      return []
    }
    logger.warn?.(logPrefix, 'failed to fetch pending messages', {
      cacheId,
      error: error?.message || String(error)
    })
    return []
  }
}

/**
 * Clear pending messages from helper cache after successful delivery
 */
export async function clearPendingMessages(cacheId, { logger = console } = {}) {
  if (!cacheId || !isHelperCacheEnabled()) {
    return false
  }

  const { deleteHelperCacheItem } = await import('./helperCacheClient')
  const messagesKey = `${cacheId}:messages`

  try {
    await deleteHelperCacheItem(messagesKey)
    logger.info?.(logPrefix, 'cleared pending messages from helper cache', { cacheId })
    return true
  } catch (error) {
    logger.warn?.(logPrefix, 'failed to clear pending messages', {
      cacheId,
      error: error?.message || String(error)
    })
    return false
  }
}
