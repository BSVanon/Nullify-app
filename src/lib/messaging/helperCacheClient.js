import { CONFIG } from '@/lib/config'

const DEFAULT_RETRY_DELAYS = [0, 300, 1000]
const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504])

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function getHelperCacheBaseUrl() {
  const base = (CONFIG.HELPER_CACHE_ENDPOINT || '').trim()
  if (!base) return ''
  return base.endsWith('/') ? base.slice(0, -1) : base
}

export function isHelperCacheConfigured() {
  return Boolean(getHelperCacheBaseUrl())
}

function buildUrl(path) {
  const base = getHelperCacheBaseUrl()
  if (!base) throw new Error('Helper cache endpoint not configured')
  if (!path) return base
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

async function fetchWithRetry(path, init = {}, options = {}) {
  const {
    retryDelays = DEFAULT_RETRY_DELAYS,
    retryStatuses = RETRYABLE_STATUSES,
    logger = console
  } = options

  const url = buildUrl(path)
  const attempts = Math.max(1, retryDelays.length || 1)

  let attempt = 0
  while (attempt < attempts) {
    if (attempt > 0) {
      const delay = retryDelays[attempt] ?? retryDelays[retryDelays.length - 1]
      if (delay > 0) await sleep(delay)
    }

    try {
      const response = await fetch(url, init)
      if (response.ok) {
        return response
      }

      const shouldRetry = retryStatuses instanceof Set
        ? retryStatuses.has(response.status)
        : Array.isArray(retryStatuses) && retryStatuses.includes(response.status)

      if (!shouldRetry) {
        const bodyText = await response.text().catch(() => '')
        const error = new Error(`Helper cache request failed (${response.status}): ${bodyText}`)
        error.fatal = true
        error.status = response.status
        throw error
      }

      if (attempt === attempts - 1) {
        const bodyText = await response.text().catch(() => '')
        const error = new Error(`Helper cache request failed (${response.status}): ${bodyText}`)
        error.status = response.status
        throw error
      }

      logger.warn?.(
        '[helper-cache] request failed, retrying',
        {
          attempt: attempt + 1,
          status: response.status,
          url
        }
      )
    } catch (error) {
      if (error?.fatal) {
        throw error
      }
      if (attempt === attempts - 1) {
        const finalError = new Error(`Helper cache request error: ${error.message}`)
        finalError.cause = error
        throw finalError
      }
      logger.warn?.('[helper-cache] network error, retrying', {
        attempt: attempt + 1,
        error: error.message,
        url
      })
    }

    attempt += 1
  }

  throw new Error('Helper cache request failed after retries')
}

export async function helperCacheHealth(options = {}) {
  const response = await fetchWithRetry('/health', { method: 'GET', signal: options.signal }, options)
  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    return response.json()
  }
  return response.text()
}

export async function putHelperCacheItem(id, payload, options = {}) {
  if (!id) throw new Error('id is required to store helper cache item')
  const body = JSON.stringify({ id, payload })
  const response = await fetchWithRetry(
    '/cache',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      signal: options.signal
    },
    options
  )
  return response.json()
}

export async function getHelperCacheItem(id, options = {}) {
  if (!id) throw new Error('id is required to load helper cache item')
  let response
  try {
    response = await fetchWithRetry(`/cache/${encodeURIComponent(id)}`, { method: 'GET', signal: options.signal }, options)
  } catch (error) {
    if (error?.status === 404) {
      return null
    }
    throw error
  }
  const contentType = response.headers?.get?.('content-type') || ''
  if (contentType.includes('application/json')) {
    return response.json()
  }
  return response.text()
}

export async function deleteHelperCacheItem(id, options = {}) {
  if (!id) throw new Error('id is required to delete helper cache item')
  try {
    const response = await fetchWithRetry(
      `/cache/${encodeURIComponent(id)}`,
      { method: 'DELETE', signal: options.signal },
      options
    )
    return response.json()
  } catch (error) {
    if (error?.status === 404) {
      return { deleted: false }
    }
    throw error
  }
}

export async function getHelperCacheStatus(options = {}) {
  const response = await fetchWithRetry('/status', { method: 'GET', signal: options.signal }, options)
  const contentType = response.headers?.get?.('content-type') || ''
  if (contentType.includes('application/json')) {
    return response.json()
  }
  return {
    raw: await response.text()
  }
}

export async function getHelperCacheQuota(options = {}) {
  let response
  try {
    response = await fetchWithRetry('/quota', { method: 'GET', signal: options.signal }, options)
  } catch (error) {
    if (error?.status === 404) {
      return null
    }
    throw error
  }

  const contentType = response.headers?.get?.('content-type') || ''
  if (contentType.includes('application/json')) {
    return response.json()
  }
  return null
}

export async function pruneHelperCache(options = {}) {
  try {
    const response = await fetchWithRetry(
      '/cache/prune',
      { method: 'POST', signal: options.signal },
      options
    )
    const contentType = response.headers?.get?.('content-type') || ''
    if (contentType.includes('application/json')) {
      return response.json()
    }
    return { ok: response.ok }
  } catch (error) {
    if (error?.status === 404) {
      // try legacy endpoint
      const fallbackResponse = await fetchWithRetry(
        '/cache/prune-expired',
        { method: 'POST', signal: options.signal },
        options
      )
      const contentType = fallbackResponse.headers?.get?.('content-type') || ''
      if (contentType.includes('application/json')) {
        return fallbackResponse.json()
      }
      return { ok: fallbackResponse.ok }
    }
    throw error
  }
}

// Expose internals for testing
export const __testables = {
  fetchWithRetry,
  DEFAULT_RETRY_DELAYS,
  RETRYABLE_STATUSES
}
