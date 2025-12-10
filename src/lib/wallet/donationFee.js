import { P2PKH } from '@bsv/sdk'

import { CONFIG } from '../config.js'

// Cache for the current invoice to avoid creating multiple invoices per transaction
let cachedInvoice = null
let cachedInvoiceExpiry = 0
const INVOICE_CACHE_TTL_MS = 30000 // 30 seconds

// Debug logging helper
const debugLog = (...args) => {
  if (CONFIG.DEBUG_VERBOSE) {
    console.log(...args);
  }
};

/**
 * Fetch a fresh HD-derived address from the helper-cache-server's invoice endpoint.
 * This creates a new invoice with a unique address that the server monitors for payment.
 * 
 * @param {number} satoshis - Amount in satoshis
 * @param {string} [memo] - Optional memo for the invoice
 * @returns {Promise<{address: string, invoiceId: string}|null>} Invoice details or null on failure
 */
async function fetchInvoiceAddress(satoshis, memo = 'NukeNote fee') {
  const helperCacheEndpoint = CONFIG.HELPER_CACHE_ENDPOINT || ''
  
  if (!helperCacheEndpoint) {
    console.warn('[donationFee] No HELPER_CACHE_ENDPOINT configured')
    return null
  }

  // Return cached invoice if still valid and same amount
  const now = Date.now()
  if (cachedInvoice && cachedInvoiceExpiry > now && cachedInvoice.amountSatoshis === satoshis) {
    debugLog('[donationFee] Using cached invoice:', cachedInvoice.invoiceId)
    return cachedInvoice
  }

  try {
    const res = await fetch(`${helperCacheEndpoint}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amountSatoshis: satoshis,
        memo
      })
    })

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}))
      console.error('[donationFee] Failed to create invoice:', res.status, errorData)
      return null
    }

    const invoice = await res.json()
    debugLog('[donationFee] Created invoice:', invoice.id, '->', invoice.address)

    // Cache the invoice
    cachedInvoice = {
      address: invoice.address,
      invoiceId: invoice.id,
      amountSatoshis: satoshis
    }
    cachedInvoiceExpiry = now + INVOICE_CACHE_TTL_MS

    return cachedInvoice
  } catch (error) {
    console.error('[donationFee] Failed to fetch invoice address:', error)
    return null
  }
}

/**
 * Clear the cached invoice. Call this after a transaction is successfully created
 * to ensure the next transaction gets a fresh address.
 */
export function clearInvoiceCache() {
  cachedInvoice = null
  cachedInvoiceExpiry = 0
}

/**
 * Build a donation/fee output using a fresh HD-derived address from the server.
 * The server monitors these addresses for incoming payments.
 * 
 * @param {number} satoshis - Amount in satoshis (default 50)
 * @returns {Promise<Object|null>} Output object with lockingScript, or null if not configured
 */
export async function buildDonationOutput(satoshis = 50) {
  if (!Number.isFinite(satoshis) || !Number.isInteger(satoshis) || satoshis <= 0) {
    return null
  }

  const invoice = await fetchInvoiceAddress(satoshis)
  if (!invoice) {
    return null
  }

  try {
    const p2pkh = new P2PKH()
    const lockingScript = p2pkh.lock(invoice.address)

    return {
      satoshis,
      lockingScript: lockingScript.toHex(),
      outputDescription: 'NukeNote fee',
      invoiceId: invoice.invoiceId, // Include for tracking
    }
  } catch (error) {
    console.warn('[donationFee] Failed to build donation output', error)
    return null
  }
}
