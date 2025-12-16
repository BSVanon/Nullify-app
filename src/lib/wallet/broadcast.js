/**
 * Manual transaction broadcast utilities
 * Fallback for when wallet's built-in broadcast fails
 */

import { extractAtomicBeef, atomicBeefToRawTxHex } from './txExtract.js'

const BROADCAST_ENDPOINTS = [
  {
    name: 'WhatsOnChain',
    url: 'https://api.whatsonchain.com/v1/bsv/main/tx/raw',
    method: 'POST',
    contentType: 'application/json',
    formatBody: (hex) => JSON.stringify({ txhex: hex }),
    parseResponse: async (res) => {
      const text = await res.text()
      // WoC returns txid as plain text on success
      if (res.ok && /^[0-9a-f]{64}$/i.test(text.trim())) {
        return { success: true, txid: text.trim() }
      }
      return { success: false, error: text }
    }
  },
  {
    name: 'TAAL ARC',
    url: 'https://arc.taal.com/v1/tx',
    method: 'POST',
    contentType: 'application/octet-stream',
    formatBody: (hex) => {
      // Convert hex to binary
      const bytes = new Uint8Array(hex.length / 2)
      for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16)
      }
      return bytes
    },
    parseResponse: async (res) => {
      try {
        const json = await res.json()
        if (res.ok && json.txid) {
          return { success: true, txid: json.txid }
        }
        return { success: false, error: json.detail || json.title || JSON.stringify(json) }
      } catch {
        return { success: false, error: `HTTP ${res.status}` }
      }
    }
  },
  {
    name: 'GorillaPool ARC',
    url: 'https://arc.gorillapool.io/v1/tx',
    method: 'POST',
    contentType: 'application/octet-stream',
    formatBody: (hex) => {
      const bytes = new Uint8Array(hex.length / 2)
      for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16)
      }
      return bytes
    },
    parseResponse: async (res) => {
      try {
        const json = await res.json()
        if (res.ok && json.txid) {
          return { success: true, txid: json.txid }
        }
        return { success: false, error: json.detail || json.title || JSON.stringify(json) }
      } catch {
        return { success: false, error: `HTTP ${res.status}` }
      }
    }
  }
]

/**
 * Broadcast a raw transaction hex to multiple endpoints
 * @param {string} rawTxHex - Raw transaction in hex format
 * @returns {Promise<{success: boolean, txid?: string, endpoint?: string, error?: string}>}
 */
export async function broadcastRawTx(rawTxHex) {
  if (!rawTxHex || typeof rawTxHex !== 'string') {
    return { success: false, error: 'Invalid transaction hex' }
  }

  const errors = []

  for (const endpoint of BROADCAST_ENDPOINTS) {
    try {
      console.log(`[broadcast] Trying ${endpoint.name}...`)
      
      const res = await fetch(endpoint.url, {
        method: endpoint.method,
        headers: { 'Content-Type': endpoint.contentType },
        body: endpoint.formatBody(rawTxHex)
      })

      const result = await endpoint.parseResponse(res)
      
      if (result.success) {
        console.log(`[broadcast] Success via ${endpoint.name}: ${result.txid}`)
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
 * Extract raw tx from wallet response and broadcast if needed
 * @param {Object} walletResponse - Response from wallet.createAction
 * @param {string} expectedTxid - Expected txid to verify
 * @returns {Promise<{broadcasted: boolean, txid?: string, error?: string}>}
 */
export async function ensureBroadcast(walletResponse, expectedTxid) {
  // Check if already successfully sent
  const sendResults = walletResponse?.sendWithResults || []
  const txResult = sendResults.find(r => r.txid === expectedTxid)
  
  if (txResult?.status === 'unproven') {
    // Already broadcast and waiting for proof
    console.log('[broadcast] Transaction already broadcast (unproven)')
    return { broadcasted: true, txid: expectedTxid }
  }

  // Extract raw tx hex from response
  const atomicBeef = extractAtomicBeef(walletResponse)
  if (!atomicBeef) {
    console.warn('[broadcast] Could not extract transaction data from response')
    return { broadcasted: false, error: 'No transaction data in response' }
  }

  let rawTxHex
  try {
    rawTxHex = atomicBeefToRawTxHex(atomicBeef)
  } catch (err) {
    console.warn('[broadcast] Failed to convert to raw tx:', err)
    return { broadcasted: false, error: `Conversion failed: ${err.message}` }
  }

  if (!rawTxHex) {
    return { broadcasted: false, error: 'Could not extract raw transaction hex' }
  }

  console.log(`[broadcast] Attempting manual broadcast for ${expectedTxid}`)
  return broadcastRawTx(rawTxHex)
}
