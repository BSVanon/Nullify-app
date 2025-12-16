import { P2PKH, PublicKey } from '@bsv/sdk'

import { CONFIG } from '../config.js'
import { NULLIFY_MERCHANT_PAYMAIL, resolvePaymailDestination } from './paymail.js'

// Nullify merchant identity key - donations go directly to this wallet
// This is the "Everyday Identity Key" from the Nullify developer's Metanet Desktop wallet
export const NULLIFY_MERCHANT_IDENTITY_KEY = '0354d78409df288d4eda0ecd8d00419570ee9b73c15d1bb1ed6b1f4ef3d2d047e8'

/**
 * Build donation outputs by resolving paymail destination.
 * 
 * @param {number} satoshis - Amount in satoshis (default 50)
 * @returns {Array} Array of output objects, or empty array on failure
 */
export async function buildDonationOutput(satoshis = 50) {
  if (!Number.isFinite(satoshis) || !Number.isInteger(satoshis) || satoshis <= 0) {
    return []
  }

  try {
    const destination = await resolvePaymailDestination(NULLIFY_MERCHANT_PAYMAIL, satoshis)
    return destination.outputs
  } catch (error) {
    console.warn('[donationFee] Failed to resolve paymail destination', error)
    return []
  }
}

/**
 * No-op for backwards compatibility.
 * Previously cleared the invoice cache when using HD-derived addresses from the server.
 * Now donations go directly to merchant wallet, so no cache to clear.
 */
export function clearInvoiceCache() {
  // No-op - invoice cache no longer exists
}
