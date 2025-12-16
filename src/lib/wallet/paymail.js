import { CONFIG } from '../config.js'

// Nullify merchant paymail address for donations.
// Paymail provides a standard way to receive payments without requiring
// the recipient to run any polling service - the payment goes directly on-chain.
export const NULLIFY_MERCHANT_PAYMAIL = 'nullify@paymail.us'

function getHelperCacheBaseUrl() {
  const base = (CONFIG.HELPER_CACHE_ENDPOINT || '').trim()
  if (!base) return ''
  return base.endsWith('/') ? base.slice(0, -1) : base
}

// Resolve a paymail address to get a P2P payment destination (BRC-28).
// Uses helper-cache proxy to avoid CORS issues with paymail providers.
// Returns { outputs: [{ script, satoshis }], reference } or throws on failure.
export async function resolvePaymailDestination(paymail, satoshis) {
  if (!paymail || !paymail.includes('@')) {
    throw new Error(`Invalid paymail address: ${paymail}`)
  }

  console.log('[Paymail] Resolving via proxy:', { paymail, satoshis })

  // Use helper-cache proxy to avoid CORS
  const base = getHelperCacheBaseUrl()
  if (!base) throw new Error('Helper cache endpoint not configured')
  const proxyUrl = `${base}/paymail/resolve`
  const res = await fetch(proxyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paymail, satoshis }),
  })

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}))
    throw new Error(errData.error || `Failed to resolve paymail: ${res.status}`)
  }

  const destination = await res.json()
  console.log('[Paymail] Payment destination:', destination)

  // destination should have: { outputs: [{ script, satoshis }], reference }
  if (!destination.outputs || !Array.isArray(destination.outputs) || destination.outputs.length === 0) {
    throw new Error('Paymail provider returned invalid payment destination')
  }

  return destination
}

export async function submitPaymailTransaction({ paymail, reference, hex, metadata }) {
  console.log('[Paymail] Submitting transaction via proxy:', {
    paymail,
    reference,
    hexPreview: typeof hex === 'string' ? `${hex.slice(0, 16)}...` : null,
  })

  const base = getHelperCacheBaseUrl()
  if (!base) throw new Error('Helper cache endpoint not configured')
  const proxyUrl = `${base}/paymail/submit`
  const res = await fetch(proxyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paymail, reference, hex, metadata }),
  })

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}))
    throw new Error(errData.error || `Failed to submit paymail transaction: ${res.status}`)
  }

  const response = await res.json().catch(() => ({}))
  console.log('[Paymail] Submit response:', response)
  return response
}
