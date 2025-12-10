import { WalletClient } from '@bsv/sdk'
import { CONFIG } from '../config.js'

const ORIGIN = (CONFIG.METANET_DESKTOP_ORIGIN || 'http://localhost:3321').replace(/\/$/, '')
let parsedHost
try {
  parsedHost = new URL(ORIGIN).host
} catch (err) {
  parsedHost = ORIGIN.replace(/^https?:\/\//, '')
}

const API_BASE = `${ORIGIN}/v1`
const JSON_HEADERS = { 'content-type': 'application/json' }

let cachedClient = null
let cachedIdentityKey = null
let cachedVersion = null
let cachedNetwork = null
let inflightConnectPromise = null

export const JSON_API_CAPABILITIES = [
  'createAction',
  'getPublicKey',
  'wrapDataKey',
  'acquireCertificate',
  'listCertificates',
  'proveCertificate',
  'relinquishCertificate',
  'discoverByAttributes',
  'discoverByIdentityKey',
  'findCertificates',
  'waitForAuthentication'
]

function isJsonResponse(res) {
  const contentType = res.headers.get('content-type') || ''
  return contentType.includes('application/json')
}

async function walletRequest(route, { method = 'POST', query = '', body } = {}) {
  const queryPart = query ? `?${query}` : ''
  const response = await fetch(`${API_BASE}/${route}${queryPart}`, {
    method,
    headers: body ? JSON_HEADERS : undefined,
    body: body ? JSON.stringify(body) : undefined
    // credentials: 'include' // Removed: causes CORS error with wildcard Access-Control-Allow-Origin
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`Wallet ${route} ${response.status}: ${text}`)
  }

  if (response.status === 204) return null
  return isJsonResponse(response) ? response.json() : response.text()
}

function normalizeIdentityKey(value) {
  if (!value) throw new Error('Wallet did not return an identity key')
  if (typeof value === 'string') return value
  if (typeof value === 'object') {
    return (
      value.identityKey ||
      value.publicKey ||
      value.key ||
      value.result ||
      null
    )
  }
  return null
}

async function getVersionRaw() {
  return await walletRequest('getVersion', { method: 'GET' })
}

async function getNetworkRaw() {
  return await walletRequest('getNetwork')
}

async function fetchIdentityKey() {
  const result = await walletRequest('getPublicKey', {
    method: 'GET',
    query: 'identityKey=true'
  })
  const normalized = normalizeIdentityKey(result)
  if (!normalized) throw new Error('Unable to resolve identity key from wallet response')
  return normalized
}

async function isAuthenticated() {
  // Metanet Desktop doesn't expose /v1/isAuthenticated endpoint
  // Skip auth check and assume authenticated if wallet is reachable
  return true
}

async function waitForAuthentication() {
  // Call the BRC-100 waitForAuthentication endpoint to trigger grouped permissions popup
  // This reads the manifest.json and presents all protocolPermissions in one dialog
  try {
    await walletRequest('waitForAuthentication', { method: 'POST', body: {} })
    console.log('[jsonApiClient] waitForAuthentication completed')
  } catch (error) {
    // Older wallet versions may not support this endpoint - that's OK, continue silently
    // The wallet will fall back to per-action permission prompts
    if (error?.message?.includes('404') || error?.message?.includes('not found')) {
      console.log('[jsonApiClient] waitForAuthentication not supported by wallet, continuing')
      return
    }
    // Log other errors but don't fail - permissions will be requested individually
    console.warn('[jsonApiClient] waitForAuthentication error (non-fatal):', error.message)
  }
}

export async function ensureAuthenticated() {
  // Call waitForAuthentication to trigger grouped permissions popup (BRC-100)
  // This presents all protocol permissions from manifest.json in a single dialog
  await waitForAuthentication()
  return true
}

function createWalletClient() {
  if (!cachedClient) {
    cachedClient = new WalletClient('json-api', parsedHost)
  }
  return cachedClient
}

function resetCachedMetadata() {
  cachedIdentityKey = null
  cachedNetwork = null
  cachedVersion = null
}

export function getCachedJsonApiWallet() {
  if (!cachedClient || !cachedIdentityKey) return null
  return {
    walletClient: cachedClient,
    identityKey: cachedIdentityKey,
    version: cachedVersion,
    network: cachedNetwork
  }
}

export async function connectJsonApiWallet() {
  if (cachedClient && cachedIdentityKey) {
    console.log('[jsonApiClient] Returning cached JSON-API client')
    return {
      walletClient: cachedClient,
      identityKey: cachedIdentityKey,
      version: cachedVersion,
      network: cachedNetwork
    }
  }

  if (inflightConnectPromise) return inflightConnectPromise

  inflightConnectPromise = (async () => {
    await ensureAuthenticated()

    const [identityKey, versionRaw, networkRaw] = await Promise.all([
      fetchIdentityKey(),
      getVersionRaw().catch(() => null),
      getNetworkRaw().catch(() => null)
    ])

    cachedIdentityKey = identityKey
    cachedVersion = typeof versionRaw === 'string' ? versionRaw : (versionRaw?.version || null)
    cachedNetwork = typeof networkRaw === 'string' ? networkRaw : (networkRaw?.network || null)

    const walletClient = createWalletClient()
    inflightConnectPromise = null

    console.log('[jsonApiClient] JSON-API connection established:', { identityKey, version: cachedVersion, network: cachedNetwork })
    return {
      walletClient,
      identityKey,
      version: cachedVersion,
      network: cachedNetwork
    }
  })().catch(err => {
    console.error('[jsonApiClient] JSON-API connection failed, resetting cache:', err)
    resetCachedMetadata()
    cachedClient = null  // Also reset the client, not just metadata
    inflightConnectPromise = null
    throw err
  })

  return inflightConnectPromise
}

async function withJsonApiWallet(handlerName, fn) {
  const { walletClient } = await connectJsonApiWallet()
  const handler = walletClient && walletClient[handlerName]
  if (typeof handler !== 'function') {
    throw new Error(`Connected wallet does not support ${handlerName}`)
  }
  return handler.call(walletClient, fn)
}

export async function acquireCertificate(parameters) {
  const { walletClient } = await connectJsonApiWallet()
  if (typeof walletClient.acquireCertificate !== 'function') {
    throw new Error('Connected wallet does not support certificate issuance')
  }
  return walletClient.acquireCertificate(parameters)
}

export async function listCertificates(filters = {}) {
  const { walletClient } = await connectJsonApiWallet()
  if (typeof walletClient.listCertificates !== 'function') {
    throw new Error('Connected wallet does not support certificate listing')
  }
  return walletClient.listCertificates(filters)
}

export async function proveCertificate(options) {
  const { walletClient } = await connectJsonApiWallet()
  if (typeof walletClient.proveCertificate !== 'function') {
    throw new Error('Connected wallet does not support certificate proofs')
  }
  return walletClient.proveCertificate(options)
}

export async function relinquishCertificate(options) {
  const { walletClient } = await connectJsonApiWallet()
  if (typeof walletClient.relinquishCertificate !== 'function') {
    throw new Error('Connected wallet does not support certificate revocation')
  }
  return walletClient.relinquishCertificate(options)
}

export async function discoverByAttributes(attributes) {
  const { walletClient } = await connectJsonApiWallet()
  if (typeof walletClient.discoverByAttributes !== 'function') {
    throw new Error('Connected wallet does not support attribute discovery')
  }
  return walletClient.discoverByAttributes(attributes)
}

export async function discoverByIdentityKey(options) {
  const { walletClient } = await connectJsonApiWallet()
  if (typeof walletClient.discoverByIdentityKey !== 'function') {
    throw new Error('Connected wallet does not support identity discovery')
  }
  return walletClient.discoverByIdentityKey(options)
}

export async function findCertificates(filters) {
  const { walletClient } = await connectJsonApiWallet()
  if (typeof walletClient.findCertificates !== 'function') {
    throw new Error('Connected wallet does not expose findCertificates')
  }
  return walletClient.findCertificates(filters)
}

export async function createSignature(options) {
  const { walletClient } = await connectJsonApiWallet()
  if (typeof walletClient.createSignature !== 'function') {
    throw new Error('Connected wallet does not support createSignature')
  }
  
  try {
    console.log('[jsonApiClient] createSignature called with options:', options)
    const result = await walletClient.createSignature(options)
    console.log('[jsonApiClient] createSignature result:', result)
    return result
  } catch (error) {
    console.error('[jsonApiClient] createSignature SDK error:', error)
    console.error('[jsonApiClient] createSignature error stack:', error.stack)
    
    // Fallback: try direct wallet API call bypassing SDK wrapper
    console.log('[jsonApiClient] Attempting direct wallet API fallback...')
    try {
      const directResult = await walletRequest('createSignature', {
        method: 'POST',
        body: options
      })
      console.log('[jsonApiClient] Direct wallet API signature succeeded:', directResult)
      return directResult
    } catch (directError) {
      console.error('[jsonApiClient] Direct wallet API also failed:', directError)
      throw new Error(`Wallet signature failed (SDK: ${error.message}, Direct: ${directError.message})`)
    }
  }
}

export async function getCachedIdentityKey() {
  if (cachedIdentityKey) return cachedIdentityKey
  const { identityKey } = await connectJsonApiWallet()
  return identityKey
}

export async function getCachedNetwork() {
  if (cachedNetwork) return cachedNetwork
  const { network } = await connectJsonApiWallet()
  return network
}

export async function getCachedVersion() {
  if (cachedVersion) return cachedVersion
  const { version } = await connectJsonApiWallet()
  return version
}

export async function jsonApiWalletRequest(route, options) {
  return walletRequest(route, options)
}

export function resetJsonApiCache() {
  cachedClient = null
  resetCachedMetadata()
}
