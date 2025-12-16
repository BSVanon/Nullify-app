import { P2PKH, PublicKey } from '@bsv/sdk'

import { CONFIG } from '../config.js'

// Nullify merchant identity key - donations go directly to this wallet
// This is the "Everyday Identity Key" from the Nullify developer's Metanet Desktop wallet
export const NULLIFY_MERCHANT_IDENTITY_KEY = '0354d78409df288d4eda0ecd8d00419570ee9b73c15d1bb1ed6b1f4ef3d2d047e8'

/**
 * Build a donation output that pays directly to the Nullify merchant wallet.
 * Uses the same P2PKH mechanism as regular wallet-to-wallet payments.
 * 
 * @param {number} satoshis - Amount in satoshis (default 50)
 * @returns {Object|null} Output object with lockingScript, or null on failure
 */
export function buildDonationOutput(satoshis = 50) {
  if (!Number.isFinite(satoshis) || !Number.isInteger(satoshis) || satoshis <= 0) {
    return null
  }

  try {
    // Derive address from merchant identity key
    let networkPrefix = 'main'
    try {
      const raw = String(CONFIG.BSV_NETWORK || 'main').toLowerCase()
      if (raw === 'test' || raw === 'testnet') {
        networkPrefix = 'test'
      }
    } catch {
      networkPrefix = 'main'
    }

    const pub = PublicKey.fromString(NULLIFY_MERCHANT_IDENTITY_KEY)
    const address = pub.toAddress(networkPrefix)

    const p2pkh = new P2PKH()
    const lockingScript = p2pkh.lock(address)

    return {
      satoshis,
      lockingScript: lockingScript.toHex(),
      outputDescription: 'Nullify donation',
    }
  } catch (error) {
    console.warn('[donationFee] Failed to build donation output', error)
    return null
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
