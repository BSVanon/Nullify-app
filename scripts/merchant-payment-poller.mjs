#!/usr/bin/env node
/**
 * Merchant Payment Poller
 * 
 * Polls the helper-cache-server for pending BRC-29 payment notifications
 * and internalizes them using the local MetaNet Desktop wallet.
 * 
 * Usage:
 *   node scripts/merchant-payment-poller.mjs
 * 
 * Environment:
 *   HELPER_CACHE_ENDPOINT - URL of the helper-cache-server (default: http://94.72.113.93:4100)
 *   MERCHANT_IDENTITY_KEY - Your 66-char merchant identity key
 *   POLL_INTERVAL_MS - Polling interval in milliseconds (default: 30000)
 */

import { WalletClient } from '@bsv/sdk'

// Configuration
const HELPER_CACHE_ENDPOINT = process.env.HELPER_CACHE_ENDPOINT || 'http://94.72.113.93:4100'
const MERCHANT_IDENTITY_KEY = process.env.MERCHANT_IDENTITY_KEY || '024a37fb37807c63c81acbed3e166404db7bd05bc1baa9c5f4d8248c4ce6d30d61'
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '30000', 10)
const WALLET_ORIGIN = 'http://localhost:3301'

let walletClient = null

async function getWallet() {
  if (walletClient) return walletClient
  
  console.log('[poller] Connecting to MetaNet Desktop wallet...')
  walletClient = new WalletClient('json-api', WALLET_ORIGIN)
  
  // Verify connection
  const { publicKey } = await walletClient.getPublicKey({ identityKey: true })
  console.log('[poller] Connected to wallet:', publicKey.slice(0, 16) + '...')
  
  if (publicKey !== MERCHANT_IDENTITY_KEY) {
    console.warn('[poller] WARNING: Connected wallet identity does not match MERCHANT_IDENTITY_KEY')
    console.warn('[poller]   Wallet:', publicKey)
    console.warn('[poller]   Expected:', MERCHANT_IDENTITY_KEY)
  }
  
  return walletClient
}

async function fetchPendingPayments() {
  const url = `${HELPER_CACHE_ENDPOINT}/payments/${MERCHANT_IDENTITY_KEY}`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to fetch payments: ${res.status} ${res.statusText}`)
  }
  const data = await res.json()
  return data.payments || []
}

async function acknowledgePayment(notificationId) {
  const url = `${HELPER_CACHE_ENDPOINT}/payments/${MERCHANT_IDENTITY_KEY}/${notificationId}`
  const res = await fetch(url, { method: 'DELETE' })
  if (!res.ok) {
    console.warn(`[poller] Failed to acknowledge payment ${notificationId}: ${res.status}`)
    return false
  }
  return true
}

async function internalizePayment(payment) {
  const wallet = await getWallet()
  const { token, senderIdentityKey, notificationId } = payment
  
  if (!token || !senderIdentityKey) {
    console.error('[poller] Invalid payment - missing token or senderIdentityKey:', notificationId)
    return false
  }
  
  const { transaction, customInstructions, outputIndex = 0, amount } = token
  
  if (!transaction || !customInstructions) {
    console.error('[poller] Invalid token - missing transaction or customInstructions:', notificationId)
    return false
  }
  
  const { derivationPrefix, derivationSuffix } = customInstructions
  
  if (!derivationPrefix || !derivationSuffix) {
    console.error('[poller] Invalid customInstructions - missing derivation data:', notificationId)
    return false
  }
  
  console.log('[poller] Internalizing payment:', {
    notificationId,
    amount,
    outputIndex,
    sender: senderIdentityKey.slice(0, 16) + '...',
    derivationPrefix: derivationPrefix.slice(0, 8) + '...'
  })
  
  try {
    const result = await wallet.internalizeAction({
      tx: transaction,
      outputs: [{
        outputIndex,
        protocol: 'wallet payment',
        paymentRemittance: {
          derivationPrefix,
          derivationSuffix,
          senderIdentityKey
        }
      }],
      description: `NukeNote fee payment`,
      labels: ['nukenote-fee', 'peerpay']
    })
    
    console.log('[poller] Payment internalized successfully:', {
      notificationId,
      reference: result?.reference || 'no-ref'
    })
    
    return true
  } catch (err) {
    console.error('[poller] Failed to internalize payment:', notificationId, err.message)
    return false
  }
}

async function pollOnce() {
  try {
    const payments = await fetchPendingPayments()
    
    if (payments.length === 0) {
      console.log('[poller] No pending payments')
      return
    }
    
    console.log(`[poller] Found ${payments.length} pending payment(s)`)
    
    for (const payment of payments) {
      const success = await internalizePayment(payment)
      
      if (success) {
        await acknowledgePayment(payment.notificationId)
        console.log('[poller] Payment processed and acknowledged:', payment.notificationId)
      } else {
        console.warn('[poller] Payment failed, will retry next poll:', payment.notificationId)
      }
    }
  } catch (err) {
    console.error('[poller] Poll error:', err.message)
  }
}

async function main() {
  console.log('[poller] Starting merchant payment poller')
  console.log('[poller] Config:', {
    endpoint: HELPER_CACHE_ENDPOINT,
    merchantKey: MERCHANT_IDENTITY_KEY.slice(0, 16) + '...',
    pollInterval: POLL_INTERVAL_MS + 'ms'
  })
  
  // Initial poll
  await pollOnce()
  
  // Continuous polling
  console.log(`[poller] Polling every ${POLL_INTERVAL_MS / 1000}s... (Ctrl+C to stop)`)
  setInterval(pollOnce, POLL_INTERVAL_MS)
}

main().catch(err => {
  console.error('[poller] Fatal error:', err)
  process.exit(1)
})
