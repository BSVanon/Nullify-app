/**
 * Manual transaction broadcast utilities
 * Fallback for when wallet's built-in broadcast fails
 * 
 * IMPORTANT: When the wallet spends unconfirmed UTXOs, the BEEF envelope
 * contains the full parent transaction chain. ARC endpoints accept BEEF
 * format and will process the entire chain. WhatsOnChain only accepts
 * raw tx hex and will fail with "Missing inputs" if parents aren't confirmed.
 */

import { extractAtomicBeef, atomicBeefToRawTxHex } from './txExtract.js'

/**
 * Convert various formats to Uint8Array for binary submission
 */
function toUint8Array(data) {
  if (data instanceof Uint8Array) return data
  if (Array.isArray(data)) return new Uint8Array(data)
  if (typeof data === 'string') {
    // Try hex first
    if (/^[0-9a-fA-F]+$/.test(data) && data.length % 2 === 0) {
      const bytes = new Uint8Array(data.length / 2)
      for (let i = 0; i < data.length; i += 2) {
        bytes[i / 2] = parseInt(data.slice(i, i + 2), 16)
      }
      return bytes
    }
    // Try base64
    try {
      const bin = atob(data)
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      return bytes
    } catch {
      return null
    }
  }
  return null
}

/**
 * ARC endpoints that support BEEF format (BRC-95)
 * These can process transactions with unconfirmed parent chains
 */
const ARC_BEEF_ENDPOINTS = [
  {
    name: 'GorillaPool ARC (BEEF)',
    url: 'https://arc.gorillapool.io/v1/tx',
    contentType: 'application/octet-stream'
  },
  {
    name: 'TAAL ARC (BEEF)',
    url: 'https://arc.taal.com/v1/tx',
    contentType: 'application/octet-stream'
  }
]

/**
 * Fallback endpoints for raw tx hex (only works if all inputs are confirmed)
 */
const RAW_TX_ENDPOINTS = [
  {
    name: 'WhatsOnChain',
    url: 'https://api.whatsonchain.com/v1/bsv/main/tx/raw',
    contentType: 'application/json',
    formatBody: (hex) => JSON.stringify({ txhex: hex })
  }
]

/**
 * Parse ARC response (same format for both TAAL and GorillaPool)
 */
async function parseArcResponse(res) {
  try {
    const json = await res.json()
    if (res.ok && json.txid) {
      return { success: true, txid: json.txid }
    }
    return { success: false, error: json.detail || json.title || json.message || JSON.stringify(json) }
  } catch {
    const text = await res.text().catch(() => '')
    return { success: false, error: `HTTP ${res.status}: ${text}` }
  }
}

/**
 * Broadcast BEEF envelope to ARC endpoints
 * BEEF format includes parent transaction chain, solving "Missing inputs" errors
 * @param {Uint8Array|number[]} beefData - BEEF envelope as binary
 * @returns {Promise<{success: boolean, txid?: string, endpoint?: string, error?: string}>}
 */
export async function broadcastBeef(beefData) {
  const bytes = toUint8Array(beefData)
  if (!bytes || bytes.length === 0) {
    return { success: false, error: 'Invalid BEEF data' }
  }

  console.log(`[broadcast] Broadcasting BEEF envelope (${bytes.length} bytes)`)
  const errors = []

  for (const endpoint of ARC_BEEF_ENDPOINTS) {
    try {
      console.log(`[broadcast] Trying ${endpoint.name}...`)
      
      const res = await fetch(endpoint.url, {
        method: 'POST',
        headers: { 'Content-Type': endpoint.contentType },
        body: bytes
      })

      const result = await parseArcResponse(res)
      
      if (result.success) {
        console.log(`[broadcast] BEEF broadcast success via ${endpoint.name}: ${result.txid}`)
        return { success: true, txid: result.txid, endpoint: endpoint.name }
      }
      
      console.warn(`[broadcast] ${endpoint.name} failed:`, result.error)
      errors.push(`${endpoint.name}: ${result.error}`)
    } catch (err) {
      console.warn(`[broadcast] ${endpoint.name} error:`, err.message)
      errors.push(`${endpoint.name}: ${err.message}`)
    }
  }

  return { success: false, error: errors.join('; ') }
}

/**
 * Broadcast raw transaction hex (fallback, only works if all inputs confirmed)
 * @param {string} rawTxHex - Raw transaction in hex format
 * @returns {Promise<{success: boolean, txid?: string, endpoint?: string, error?: string}>}
 */
export async function broadcastRawTx(rawTxHex) {
  if (!rawTxHex || typeof rawTxHex !== 'string') {
    return { success: false, error: 'Invalid transaction hex' }
  }

  const errors = []

  for (const endpoint of RAW_TX_ENDPOINTS) {
    try {
      console.log(`[broadcast] Trying ${endpoint.name} (raw tx)...`)
      
      const res = await fetch(endpoint.url, {
        method: 'POST',
        headers: { 'Content-Type': endpoint.contentType },
        body: endpoint.formatBody(rawTxHex)
      })

      const text = await res.text()
      if (res.ok && /^[0-9a-f]{64}$/i.test(text.trim())) {
        console.log(`[broadcast] Raw tx success via ${endpoint.name}: ${text.trim()}`)
        return { success: true, txid: text.trim(), endpoint: endpoint.name }
      }
      
      console.warn(`[broadcast] ${endpoint.name} failed:`, text)
      errors.push(`${endpoint.name}: ${text}`)
    } catch (err) {
      console.warn(`[broadcast] ${endpoint.name} error:`, err.message)
      errors.push(`${endpoint.name}: ${err.message}`)
    }
  }

  return { success: false, error: errors.join('; ') }
}

/**
 * Extract tx data from wallet response and broadcast if needed
 * Prioritizes BEEF format for ARC endpoints (handles unconfirmed parent chains)
 * Falls back to raw tx for WhatsOnChain if BEEF fails
 * 
 * @param {Object} walletResponse - Response from wallet.createAction
 * @param {string} expectedTxid - Expected txid to verify
 * @returns {Promise<{broadcasted: boolean, txid?: string, endpoint?: string, error?: string}>}
 */
export async function ensureBroadcast(walletResponse, expectedTxid) {
  // Check if already successfully sent
  const sendResults = walletResponse?.sendWithResults || []
  const txResult = sendResults.find(r => r.txid === expectedTxid)
  
  if (txResult?.status === 'unproven') {
    console.log('[broadcast] Transaction already broadcast (unproven)')
    return { broadcasted: true, txid: expectedTxid }
  }

  // Extract BEEF envelope from response
  const atomicBeef = extractAtomicBeef(walletResponse)
  if (!atomicBeef) {
    console.warn('[broadcast] Could not extract transaction data from response')
    return { broadcasted: false, error: 'No transaction data in response' }
  }

  console.log(`[broadcast] Attempting broadcast for ${expectedTxid}`)

  // Step 1: Try BEEF broadcast to ARC endpoints (handles unconfirmed parent chains)
  const beefBytes = toUint8Array(atomicBeef)
  if (beefBytes && beefBytes.length > 0) {
    const beefResult = await broadcastBeef(beefBytes)
    if (beefResult.success) {
      return { broadcasted: true, txid: beefResult.txid, endpoint: beefResult.endpoint }
    }
    console.warn('[broadcast] BEEF broadcast failed, trying raw tx fallback...')
  }

  // Step 2: Fallback to raw tx (only works if all inputs are confirmed)
  let rawTxHex
  try {
    rawTxHex = atomicBeefToRawTxHex(atomicBeef)
  } catch (err) {
    console.warn('[broadcast] Failed to extract raw tx:', err)
    return { broadcasted: false, error: `BEEF failed, raw extraction failed: ${err.message}` }
  }

  if (!rawTxHex) {
    return { broadcasted: false, error: 'Could not extract raw transaction hex' }
  }

  const rawResult = await broadcastRawTx(rawTxHex)
  if (rawResult.success) {
    return { broadcasted: true, txid: rawResult.txid, endpoint: rawResult.endpoint }
  }

  return { broadcasted: false, error: `All broadcast attempts failed` }
}
