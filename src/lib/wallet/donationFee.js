import { P2PKH } from '@bsv/sdk'

import { CONFIG } from '../config.js'

// Static fallback address - derived from merchant HD key at m/0/0
// Used if HD-invoice system is unavailable
const FALLBACK_FEE_ADDRESS = '1MXKjohFDVj18pQqw8bdm9wiHuaDxHC68Y'

// Cache for the current invoice to avoid creating multiple invoices per transaction
let cachedInvoice = null
let cachedInvoiceExpiry = 0
const INVOICE_CACHE_TTL_MS = 30000 // 30 seconds

/**
 * Fetch a fresh HD-derived address from the helper-cache-server's invoice endpoint.
 * This creates a new invoice with a unique address that the server monitors for payment.
 * 
 * @param {number} satoshis - Amount in satoshis
 * @param {string} [memo] - Optional memo for the invoice
 * @returns {Promise<{address: string, invoiceId: string}|null>} Invoice details or null on failure
 */
async function fetchInvoiceAddress(satoshis, memo = 'Nullify fee') {
  const helperCacheEndpoint = CONFIG.HELPER_CACHE_ENDPOINT || ''
  
  if (!helperCacheEndpoint) {
    console.warn('[donationFee] No HELPER_CACHE_ENDPOINT configured, using fallback address')
    return null
  }

  // Return cached invoice if still valid and same amount
  const now = Date.now()
  if (cachedInvoice && cachedInvoiceExpiry > now && cachedInvoice.amountSatoshis === satoshis) {
    console.log('[donationFee] Using cached invoice:', cachedInvoice.invoiceId)
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
    console.log('[donationFee] Created invoice:', invoice.id, '->', invoice.address)

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
 * Build a donation/fee output.
 * Primary: Uses HD-derived address from helper-cache server (better privacy, tracked invoices)
 * Fallback: Uses static merchant address if server unavailable
 * 
 * @param {number} satoshis - Amount in satoshis (default 50)
 * @returns {Promise<Object|null>} Output object with lockingScript, or null on error
 */
export async function buildDonationOutput(satoshis = 50) {
  if (!Number.isFinite(satoshis) || !Number.isInteger(satoshis) || satoshis <= 0) {
    return null
  }

  // Try HD-invoice system first
  const invoice = await fetchInvoiceAddress(satoshis)
  const address = invoice?.address || FALLBACK_FEE_ADDRESS
  
  if (!invoice) {
    console.log('[donationFee] Using fallback static address:', FALLBACK_FEE_ADDRESS)
  }

  try {
    const p2pkh = new P2PKH()
    const lockingScript = p2pkh.lock(address)

    return {
      satoshis,
      lockingScript: lockingScript.toHex(),
      outputDescription: 'Nullify fee',
      invoiceId: invoice?.invoiceId || null,
    }
  } catch (error) {
    console.warn('[donationFee] Failed to build donation output', error)
    return null
  }
}
