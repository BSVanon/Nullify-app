import { CONFIG } from '../config.js'
import { getWallet, extractTxid } from './client.js'
import { PublicKey, P2PKH, Transaction } from '@bsv/sdk'
import { PeerPayClient } from '@bsv/message-box-client'
import { extractAtomicBeef, atomicBeefToRawTxHex } from './txExtract.js'
import { sendSatsToIdentityKey, sendSatsToAddress } from './sendUtils.js'
import { buildDonationOutput, clearInvoiceCache } from './donationFee.js'

// Lightweight MessageBox / PeerPay health publisher for diagnostics.
// This avoids any coupling between diagnostics and the payment logic
// while still surfacing when MessageBox is clearly failing.
function publishMessageBoxHealth(partial) {
  if (typeof window === 'undefined') return

  const prev = window.__NULLIFY_MESSAGEBOX_HEALTH__ || {}
  const next = {
    status: 'unknown',
    lastError: null,
    lastOkAt: null,
    lastCheckedAt: Date.now(),
    ...prev,
    ...partial,
  }

  if (partial.status === 'ok') {
    next.lastOkAt = Date.now()
    next.lastError = null
  }

  window.__NULLIFY_MESSAGEBOX_HEALTH__ = next

  try {
    const event = new CustomEvent('nullify:messagebox-health', { detail: next })
    window.dispatchEvent(event)
  } catch (err) {
    console.warn('[MessageBoxHealth] Failed to dispatch health event', err)
  }
}








export async function sendDonation({ amountSats, description }) {
  const amount = Number(amountSats)
  if (!Number.isFinite(amount) || !Number.isInteger(amount) || amount <= 0) {
    throw new Error('Amount must be a positive integer number of sats')
  }

  console.log('[Donation] Sending via HD-invoice system:', { amount })

  // Use HD-invoice system (same as CT/DT minting fees) for privacy and direct merchant receipt
  const donationOutput = await buildDonationOutput(amount)
  if (!donationOutput) {
    throw new Error('Failed to create donation output - invoice system unavailable')
  }

  console.log('[Donation] Invoice created:', {
    invoiceId: donationOutput.invoiceId,
    satoshis: donationOutput.satoshis,
  })

  const { client } = await getWallet()

  const result = await client.createAction({
    description: description || 'Nullify donation',
    outputs: [donationOutput],
    labels: ['wallet payment', 'donation', 'nullify'],
    options: {
      randomizeOutputs: false,
      returnTXIDOnly: false,
    },
  })

  const txid = extractTxid(result)
  const sendStatus = result?.sendWithResults?.[0]?.status
  console.log(`[Donation] txid=${txid}, status=${sendStatus || 'unknown'}`)

  // Clear invoice cache so next donation gets a fresh address
  clearInvoiceCache()

  return { response: { status: 'sent' }, txid }
}

// PeerPay-based sats send using Babbage MessageBox + BRC-29 derivation.
// The recipient's BRC-100 wallet can internalize the payment.
// NOTE: Recipient must have an app actively polling MessageBox to receive!
export async function sendPeerPaySatsToIdentityKey({ identityKey, amountSats, originator }) {
  if (!identityKey || typeof identityKey !== 'string') {
    throw new Error('Recipient identity key is required')
  }

  const amount = Number(amountSats)
  if (!Number.isFinite(amount) || !Number.isInteger(amount) || amount <= 0) {
    throw new Error('Amount must be a positive integer number of sats')
  }

  console.log('[PeerPay] Sending payment:', {
    recipient: identityKey.slice(0, 16) + '...',
    amount,
  })

  const { client } = await getWallet()
  const walletClient = client

  const derivedOriginator =
    originator || (typeof window !== 'undefined' && window.location?.origin) || undefined

  console.log('[PeerPay] Creating PeerPayClient with originator:', derivedOriginator)

  const peerPay = new PeerPayClient({
    walletClient,
    enableLogging: true,
    originator: derivedOriginator,
  })

  console.log('[PeerPay] Calling sendLivePayment...')
  
  const result = await peerPay.sendLivePayment({
    recipient: identityKey,
    amount,
  })

  console.log('[PeerPay] sendLivePayment completed:', result)

  // PeerPayClient does not currently expose txid directly; the wallet will
  // show the outgoing payment and the peer can internalize it into their wallet.
  return result
}

// Start a PeerPay listener that automatically accepts incoming payments into the
// connected wallet. An optional callback can be provided to surface UX (e.g. toasts).
// This helper is safe to call multiple times; callers should ensure they only
// start one listener per session.
export async function startPeerPayAutoAccept({ onPaymentAccepted } = {}) {
  try {
    publishMessageBoxHealth({ status: 'connecting' })

    const { client } = await getWallet()
    const walletClient = client

    const originator =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : undefined

    let peerPay
    try {
      peerPay = new PeerPayClient({
        walletClient,
        enableLogging: true,
        originator,
      })
    } catch (error) {
      console.error('[PeerPay] Failed to construct PeerPayClient', error)
      publishMessageBoxHealth({ status: 'error', lastError: String(error) })
      throw error
    }

    const handleAcceptance = async (payment) => {
      if (!payment) return
      try {
        console.log('[PeerPay] Auto-accepting payment', { messageId: payment.messageId })
        
        // Call internalizeAction directly with seekPermission: false to skip user prompt
        const STANDARD_PAYMENT_OUTPUT_INDEX = 0
        const paymentResult = await walletClient.internalizeAction({
          tx: payment.token.transaction,
          outputs: [{
            paymentRemittance: {
              derivationPrefix: payment.token.customInstructions.derivationPrefix,
              derivationSuffix: payment.token.customInstructions.derivationSuffix,
              senderIdentityKey: payment.sender
            },
            outputIndex: payment.token.outputIndex ?? STANDARD_PAYMENT_OUTPUT_INDEX,
            protocol: 'wallet payment'
          }],
          labels: ['peerpay'],
          description: 'PeerPay Payment',
          seekPermission: false // Auto-accept without user prompt
        }, originator)

        console.log('[PeerPay] Payment internalized successfully')
        
        // Acknowledge the message so it's marked as processed
        await peerPay.acknowledgeMessage({ messageIds: [payment.messageId] })

        if (typeof onPaymentAccepted === 'function') {
          const amount =
            payment?.token && typeof payment.token.amount === 'number'
              ? payment.token.amount
              : null

          onPaymentAccepted({ payment, result: paymentResult, amount })
        }
      } catch (error) {
        // Acknowledge failed messages too - they're likely stale/invalid and will never succeed
        // This prevents endless retry loops for old payments that can't be internalized
        console.warn('[PeerPay] Failed to internalize payment, acknowledging to prevent retry:', payment.messageId)
        try {
          await peerPay.acknowledgeMessage({ messageIds: [payment.messageId] })
        } catch (ackError) {
          console.warn('[PeerPay] Failed to acknowledge stale message:', ackError.message)
        }
      }
    }

    // First, sweep any existing pending payments from MessageBox and auto-accept them.
    try {
      const pending = await peerPay.listIncomingPayments()
      publishMessageBoxHealth({ status: 'ok' })

      if (Array.isArray(pending) && pending.length > 0) {
        console.log('[PeerPay] Processing', pending.length, 'pending payments')
        for (const payment of pending) {
          await handleAcceptance(payment)
        }
      }
    } catch (error) {
      console.warn('[PeerPay] Failed to list incoming payments:', error.message)
      publishMessageBoxHealth({ status: 'degraded', lastError: String(error) })
    }

    // Then, listen for any new live payments and auto-accept them as they arrive.
    try {
      // Fire-and-forget; we do not await this promise so it does not block the UI.
      void peerPay.listenForLivePayments({
        onPayment: async (payment) => {
          console.log('[PeerPay] Incoming live payment:', payment.messageId)
          await handleAcceptance(payment)
        },
      })
      console.log('[PeerPay] Auto-accept listener active')
    } catch (error) {
      console.warn('[PeerPay] Failed to start live listener:', error.message)
    }

    // Poll for incoming payments every 30 seconds as a fallback for WebSocket delivery issues
    const pollInterval = setInterval(async () => {
      try {
        const pending = await peerPay.listIncomingPayments()
        publishMessageBoxHealth({ status: 'ok' })

        if (Array.isArray(pending) && pending.length > 0) {
          console.log('[PeerPay] Poll found', pending.length, 'pending payments')
          for (const payment of pending) {
            await handleAcceptance(payment)
          }
        }
      } catch (error) {
        // Silent fail on poll - don't spam logs
        publishMessageBoxHealth({ status: 'degraded', lastError: String(error) })
      }
    }, 30000) // Poll every 30 seconds (reduced frequency)

    // Store the interval ID so it can be cleared later if needed
    if (typeof window !== 'undefined') {
      window.__NULLIFY_PEERPAY_POLL_INTERVAL__ = pollInterval
    }

    return peerPay
  } catch (error) {
    console.error('[PeerPay] Failed to start auto-accept PeerPay helper', error)
    publishMessageBoxHealth({ status: 'error', lastError: String(error) })
    return null
  }
}

// Dev-only helper: expose a tiny sats send to Bob's legacy address for manual testing.
// Usage in browser console (with Alice's wallet connected):
//   await window.__NULLIFY_DEBUG__.sendTinySatsToBob(50)
if (typeof window !== 'undefined') {
  window.__NULLIFY_DEBUG__ = window.__NULLIFY_DEBUG__ || {}

  if (typeof window.__NULLIFY_DEBUG__.sendTinySatsToBob !== 'function') {
    window.__NULLIFY_DEBUG__.sendTinySatsToBob = async (amountSats = 50) => {
      const targetAddress = '1KAvfC7jEGFaPYcdDMgGW4atBeWqrJP3QD'

      console.log('[Nullify debug] Sending tiny sats to Bob via wallet.createAction', {
        amountSats,
        targetAddress,
      })

      try {
        const { txid, response } = await sendSatsToAddress({
          address: targetAddress,
          amountSats,
          description: `Nullify tiny sats test to Bob (${amountSats} sats)`,
        })
        console.log('[Nullify debug] Tiny sats to Bob success', { txid, response })
        return { txid, response }
      } catch (error) {
        console.error('[Nullify debug] Tiny sats to Bob failed', error)
        throw error
      }
    }
  }

  if (typeof window.__NULLIFY_DEBUG__.startPeerPayListener !== 'function') {
    window.__NULLIFY_DEBUG__.startPeerPayListener = async () => {
      console.log('[Nullify debug] Starting PeerPay auto-accept listener via debug helper...')
      return startPeerPayAutoAccept()
    }
  }
}
