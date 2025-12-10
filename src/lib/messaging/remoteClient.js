import { CONFIG } from '@/lib/config'
import { walletBootstrap } from '@/lib/walletBootstrap'

const DEFAULT_TIMEOUT_MS = 15000

function isEnabled() {
  return Boolean(CONFIG.REMOTE_MESSAGING_ENABLED && CONFIG.REMOTE_MESSAGING_API_URL)
}

async function resolveWalletAuth() {
  const status = walletBootstrap.getStatus?.() || {}
  if (status?.wallet && status?.identityKey) {
    return status
  }

  if (typeof walletBootstrap.initialize === 'function') {
    try {
      const initialized = await walletBootstrap.initialize()
      return initialized || walletBootstrap.getStatus?.() || {}
    } catch (error) {
      console.warn('[remoteClient] wallet bootstrap failed', error)
      return status
    }
  }

  return status
}

async function fetchJson(path, { method = 'GET', headers, body, signal, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(path, {
      method,
      headers,
      body,
      signal: signal || controller.signal,
    })

    const contentType = response.headers.get('content-type') || ''
    const isJson = contentType.includes('application/json')
    const payload = isJson ? await response.json().catch(() => null) : await response.text().catch(() => null)

    if (!response.ok) {
      const error = new Error(`Remote messaging request failed: ${response.status}`)
      error.status = response.status
      error.payload = payload
      throw error
    }

    return payload
  } finally {
    clearTimeout(timeout)
  }
}

async function ensureToken(walletClient, identityKey) {
  const baseUrl = CONFIG.REMOTE_MESSAGING_API_URL
  if (!baseUrl) throw new Error('Remote messaging API URL not configured')
  if (!walletClient || !identityKey) throw new Error('Wallet identity required for remote messaging auth')

  const nonceResponse = await fetchJson(`${baseUrl}/v1/auth/nonce`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ publicKey: identityKey }),
  })

  const nonce = nonceResponse?.nonce
  if (!nonce) throw new Error('Remote messaging auth nonce invalid')

  const signatureResult = await walletClient.createSignature?.({ data: nonce })
  const signature = signatureResult?.signature || signatureResult
  if (!signature) throw new Error('Wallet failed to sign nonce for remote messaging')

  const tokenResponse = await fetchJson(`${baseUrl}/v1/auth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ publicKey: identityKey, nonce, signature }),
  })

  const token = tokenResponse?.token
  if (!token) throw new Error('Remote messaging token not issued')
  return token
}

export async function createRemoteMessagingClient() {
  if (!isEnabled()) {
    return null
  }

  const status = await resolveWalletAuth()
  const walletClient = status?.wallet
  const identityKey = status?.identityKey

  if (!walletClient || !identityKey || typeof walletClient.createSignature !== 'function') {
    console.warn('[remoteClient] wallet identity or signature capability missing; remote sync disabled')
    return null
  }

  const baseUrl = CONFIG.REMOTE_MESSAGING_API_URL.replace(/\/$/, '')

  const state = {
    token: null,
    tokenExpiresAt: 0,
  }

  async function getToken() {
    const now = Date.now()
    if (state.token && state.tokenExpiresAt > now + 15000) {
      return state.token
    }

    const token = await ensureToken(walletClient, identityKey)
    const expiresIn = 300 * 1000 // 5 minutes default per spec
    state.token = token
    state.tokenExpiresAt = now + expiresIn
    return token
  }

  async function authorizedFetch(path, options = {}) {
    const token = await getToken()
    const headers = {
      accept: 'application/json',
      ...(options.headers || {}),
      authorization: `Bearer ${token}`,
      'x-nn-wallet-pubkey': identityKey,
    }

    if (options.body && !headers['content-type']) {
      headers['content-type'] = 'application/json'
    }

    try {
      return await fetchJson(`${baseUrl}${path}`, { ...options, headers })
    } catch (error) {
      if (error.status === 401) {
        state.token = null
        state.tokenExpiresAt = 0
      }
      throw error
    }
  }

  async function uploadMetadata(threadId, payload) {
    if (!threadId || !payload) return null

    try {
      const response = await authorizedFetch(`/v1/threads/${threadId}/metadata`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
      return response
    } catch (error) {
      console.warn('[remoteClient] metadata upload failed', threadId, error)
      throw error
    }
  }

  async function uploadMessage(threadId, message) {
    if (!threadId || !message) return null

    try {
      const response = await authorizedFetch(`/v1/threads/${threadId}/messages`, {
        method: 'POST',
        body: JSON.stringify(message),
      })
      return response
    } catch (error) {
      console.warn('[remoteClient] message upload failed', threadId, error)
      throw error
    }
  }

  async function fetchMessages(threadId, { sinceRevision, limit } = {}) {
    if (!threadId) return { messages: [], nextRevision: null }

    const params = new URLSearchParams()
    if (sinceRevision !== undefined && sinceRevision !== null) {
      params.set('sinceRevision', String(sinceRevision))
    }
    if (limit) {
      params.set('limit', String(limit))
    }

    const query = params.toString() ? `?${params.toString()}` : ''

    try {
      return await authorizedFetch(`/v1/threads/${threadId}/messages${query}`, {
        method: 'GET',
      })
    } catch (error) {
      if (error.status === 404) {
        return { messages: [], nextRevision: null }
      }
      console.warn('[remoteClient] fetch messages failed', threadId, error)
      throw error
    }
  }

  async function fetchMetadata(threadId, { revisionSince } = {}) {
    if (!threadId) return null

    const params = new URLSearchParams()
    if (revisionSince !== undefined && revisionSince !== null) {
      params.set('revisionSince', String(revisionSince))
    }
    const query = params.toString() ? `?${params}` : ''

    try {
      return await authorizedFetch(`/v1/threads/${threadId}/metadata${query}`, {
        method: 'GET',
      })
    } catch (error) {
      if (error.status === 404) return null
      console.warn('[remoteClient] fetch metadata failed', threadId, error)
      throw error
    }
  }

  async function listThreads() {
    try {
      return await authorizedFetch('/v1/threads', { method: 'GET' })
    } catch (error) {
      console.warn('[remoteClient] list threads failed', error)
      throw error
    }
  }

  async function purgeThread(threadId, payload) {
    if (!threadId) return null

    try {
      return await authorizedFetch(`/v1/threads/${threadId}/messages`, {
        method: 'DELETE',
        body: JSON.stringify(payload || {}),
      })
    } catch (error) {
      console.warn('[remoteClient] purge thread failed', threadId, error)
      throw error
    }
  }

  return {
    enabled: true,
    uploadMetadata,
    uploadMessage,
    fetchMessages,
    fetchMetadata,
    listThreads,
    purgeThread,
  }
}

let sharedClient = null
let sharedClientInit = null

export async function ensureRemoteMessagingClient() {
  if (!isEnabled()) return null

  if (sharedClient) return sharedClient
  if (sharedClientInit) return sharedClientInit

  sharedClientInit = createRemoteMessagingClient()
    .then((client) => {
      sharedClient = client || null
      return sharedClient
    })
    .catch((error) => {
      console.warn('[remoteClient] failed to initialize shared remote client', error)
      return null
    })
    .finally(() => {
      sharedClientInit = null
    })

  return sharedClientInit
}
