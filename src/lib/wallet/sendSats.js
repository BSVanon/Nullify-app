import { CONFIG } from '../config.js'
import { getWallet, extractTxid } from './client.js'
import { PublicKey, P2PKH, Transaction } from '@bsv/sdk'
import { PeerPayClient } from '@bsv/message-box-client'
import { NULLIFY_MERCHANT_PAYMAIL, resolvePaymailDestination, submitPaymailTransaction } from './paymail.js'
import { extractAtomicBeef, atomicBeefToRawTxHex } from './txExtract.js'
import { sendSatsToIdentityKey, sendSatsToAddress } from './sendUtils.js'

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

  console.log('[Donation] Sending via paymail:', {
    paymail: NULLIFY_MERCHANT_PAYMAIL,
    amount,
  })

  // Resolve paymail to get payment destination (BRC-28)
  const destination = await resolvePaymailDestination(NULLIFY_MERCHANT_PAYMAIL, amount)

  const { client } = await getWallet()

  // Build outputs from paymail destination
  const outputs = destination.outputs.map(out => ({
    satoshis: out.satoshis,
    lockingScript: out.script,
    outputDescription: 'Nullify donation',
  }))

  console.log('[Donation] Creating action with outputs:', outputs)

  const result = await client.createAction({
    description: description || 'Nullify donation',
    outputs,
    // Use 'wallet payment' protocol so this is covered by manifest grouped permissions
    labels: ['wallet payment', 'donation', 'nullify'],
    options: {
      randomizeOutputs: false,
      returnTXIDOnly: false,
    },
  })

  console.log('[Donation] Payment sent:', result)

  const txid = extractTxid(result)

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
        console.log('[PeerPay] Auto-accepting payment without user prompt', payment)
        
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

        console.log('[PeerPay] Payment internalized successfully', paymentResult)
        
        // Acknowledge the message so it's marked as processed
        await peerPay.acknowledgeMessage({ messageIds: [payment.messageId] })
        console.log('[PeerPay] Payment acknowledged')

        if (typeof onPaymentAccepted === 'function') {
          const amount =
            payment?.token && typeof payment.token.amount === 'number'
              ? payment.token.amount
              : null

          onPaymentAccepted({ payment, result: paymentResult, amount })
        }
      } catch (error) {
        console.error('[PeerPay] Failed to accept incoming payment', error)
      }
    }

    // First, sweep any existing pending payments from MessageBox and auto-accept them.
    try {
      console.log('[PeerPay] Checking for existing incoming payments to auto-accept...')
      const pending = await peerPay.listIncomingPayments()

      publishMessageBoxHealth({ status: 'ok' })

      if (Array.isArray(pending) && pending.length > 0) {
        console.log('[PeerPay] Found pending PeerPay payments',
          pending.map((p) => ({
            messageId: p.messageId,
            amount:
              p.token && typeof p.token.amount === 'number'
                ? p.token.amount
                : null,
          })),
        )

        for (const payment of pending) {
          console.log('[PeerPay] Auto-accepting existing PeerPay payment', payment)
          await handleAcceptance(payment)
        }
      } else {
        console.log('[PeerPay] No existing PeerPay payments found')
      }
    } catch (error) {
      console.error('[PeerPay] Failed to list/accept existing PeerPay payments', error)
      publishMessageBoxHealth({ status: 'degraded', lastError: String(error) })
    }

    // Then, listen for any new live payments and auto-accept them as they arrive.
    try {
      // Fire-and-forget; we do not await this promise so it does not block the UI.
      void peerPay.listenForLivePayments({
        onPayment: async (payment) => {
          console.log('[PeerPay] Incoming live PeerPay payment', payment)
          await handleAcceptance(payment)
        },
      })

      console.log('[PeerPay] Auto-accept listener active')
    } catch (error) {
      console.error('[PeerPay] Failed to start live PeerPay listener', error)
    }

    // Poll for incoming payments every 10 seconds as a fallback for WebSocket delivery issues
    const pollInterval = setInterval(async () => {
      try {
        console.log('[PeerPay] Polling for incoming payments...')
        const pending = await peerPay.listIncomingPayments()

        publishMessageBoxHealth({ status: 'ok' })

        if (Array.isArray(pending) && pending.length > 0) {
          console.log('[PeerPay] Found pending payments during poll', pending.length)
          for (const payment of pending) {
            console.log('[PeerPay] Auto-accepting polled payment', payment)
            await handleAcceptance(payment)
          }
        }
      } catch (error) {
        console.error('[PeerPay] Failed to poll for incoming payments', error)
        publishMessageBoxHealth({ status: 'degraded', lastError: String(error) })
      }
    }, 10000) // Poll every 10 seconds

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
