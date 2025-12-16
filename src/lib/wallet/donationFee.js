import { P2PKH } from '@bsv/sdk'

// Static merchant fee address - derived from merchant HD key at m/0/0
// This is the simplest approach: wallet sees UTXOs arrive automatically
// No server polling, no internalization needed - funds go directly to this address
const MERCHANT_FEE_ADDRESS = '1MXKjohFDVj18pQqw8bdm9wiHuaDxHC68Y'

/**
 * No-op for backwards compatibility.
 * Static address approach doesn't need invoice caching.
 */
export function clearInvoiceCache() {
  // No-op - static address doesn't use invoice cache
}

/**
 * Build a donation/fee output paying to the static merchant address.
 * Uses simple P2PKH - the merchant wallet sees UTXOs arrive automatically.
 * 
 * @param {number} satoshis - Amount in satoshis (default 50)
 * @returns {Object|null} Output object with lockingScript, or null on invalid input
 */
export function buildDonationOutput(satoshis = 50) {
  if (!Number.isFinite(satoshis) || !Number.isInteger(satoshis) || satoshis <= 0) {
    return null
  }

  try {
    const p2pkh = new P2PKH()
    const lockingScript = p2pkh.lock(MERCHANT_FEE_ADDRESS)

    return {
      satoshis,
      lockingScript: lockingScript.toHex(),
      outputDescription: 'Nullify fee',
    }
  } catch (error) {
    console.warn('[donationFee] Failed to build donation output', error)
    return null
  }
}
