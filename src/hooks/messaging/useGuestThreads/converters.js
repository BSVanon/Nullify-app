import { truncateMiddle } from '@/lib/utils'
import {
  normalizeStoredAuthor,
  resolveLocalPublicKey,
  resolvePeerPublicKey
} from './identity'

/**
 * Convert a join receipt to a conversation object for UI display
 */
export const conversationFromReceipt = (receipt, { blocked = false, messages = [] } = {}) => {
  const status = receipt.status || 'pending'
  const guestMode = receipt.identityKind !== 'holder'
  const peerLeft = receipt.peerLeft === true
  const peerLeftAt = receipt.peerLeftAt || null
  
  // Get local pubkey to identify own messages
  const localPubkey = resolveLocalPublicKey(receipt)
  
  // Try to get last message text
  let preview = 'No messages yet'
  if (messages && messages.length > 0) {
    const lastMsg = messages[messages.length - 1]
    const msgText = lastMsg.text || 'No messages yet'
    // Prefix own messages with "You: " (author is normalized to pubkey)
    const isOwnMessage = lastMsg.author === localPubkey || lastMsg.author === 'self'
    preview = isOwnMessage ? `You: ${msgText}` : msgText
  } else if (status === 'blocked') {
    preview = 'Thread blocked. Further messages disabled.'
  } else if (status === 'burned') {
    preview = 'Thread burned. Local vault purged.'
  } else if (status === 'left') {
    preview = 'Left thread. Waiting for cleanup.'
  } else if (peerLeft && !guestMode) {
    preview = '⚠️ Guest left thread. You can burn when ready.'
  }

  const lastActivity = receipt.lastMessageAt || receipt.acceptedAt || receipt.updatedAt || receipt.createdAt || null

  const dtIssuances = Array.isArray(receipt.dtIssuances)
    ? receipt.dtIssuances
    : Array.isArray(receipt.threadMetadata?.dtIssuances)
      ? receipt.threadMetadata.dtIssuances
      : []

  const dtRecipientSet = new Set()
  const dtOutpoints = []

  dtIssuances.forEach((issuance) => {
    if (!issuance || !Array.isArray(issuance.outputs)) return
    const txid = issuance.txid || null
    issuance.outputs.forEach((output) => {
      if (!output) return
      const recipientPubkey = output.recipientPubkey || output.recipient || null
      const vout = Number.isInteger(output.vout) ? output.vout : null

      if (recipientPubkey) {
        dtRecipientSet.add(recipientPubkey)
      }

      if (txid && vout !== null) {
        dtOutpoints.push({ txid, vout, recipientPubkey })
      }
    })
  })

  const dtRecipients = Array.from(dtRecipientSet)
  const dtRecipientCount = dtRecipients.length

  const ctOutpoint =
    receipt?.ctTxid && Number.isInteger(receipt?.ctVout)
      ? { txid: receipt.ctTxid, vout: receipt.ctVout }
      : null

  const peerPublicKey = resolvePeerPublicKey(receipt)
  const selfPublicKey = resolveLocalPublicKey(receipt)
  const peerKind = guestMode ? 'holder' : 'guest'
  const inviterName = receipt.inviterName
    || receipt.threadMetadata?.inviterName
    || receipt.inviter
    || 'Unknown'

  return {
    id: receipt.threadId,
    title: receipt.label || `Thread ${truncateMiddle(receipt.threadId, 12)}`,
    preview,
    lastActivity: lastActivity ? new Date(lastActivity).toLocaleTimeString() : null,
    status,
    ctOutpoint,
    initials: receipt.initials || '??',
    guestMode,
    policy: receipt.policy || 'mutual',
    inviterName,
    inviter: receipt.inviter,
    inviterProfile: receipt.inviterProfile || null,
    lastActivityIso: lastActivity || null,
    blocked: blocked || status === 'blocked',
    presence: { state: 'offline' },
    burnedAt: receipt.burnedAt || null,
    burnedBy: receipt.burnedBy || null,
    upgradedAt: receipt.upgradedAt || null,
    peerLeft,
    peerLeftAt,
    selfPublicKey,
    peerPublicKey,
    peerKind,
    supportsLeave: Boolean(receipt.supportsLeave),
    blobHash: receipt.blobHash || null,
    encKeyWrap: receipt.encKeyWrap || null,
    hintURL: receipt.hintURL || null,
    mintedAt: receipt.mintedAt || null,
    lastMintTxid: receipt.lastMintTxid || null,
    threadMetadata: receipt.threadMetadata || null,
    dtIssuances,
    dtOutpoints,
    dtRecipients,
    dtRecipientCount,
    rawThreadKeyBase64: receipt.rawThreadKeyBase64 || receipt.threadMetadata?.rawKeyBase64 || null,
    peerWalletPublicKey:
      receipt.peerWalletPublicKey || receipt.threadMetadata?.peerWalletPublicKey || null
  }
}

/**
 * Convert a vault message entry to a message object for UI display
 */
export const messageFromVault = (entry, receipt) => ({
  id: entry.id,
  threadId: entry.threadId,
  author: normalizeStoredAuthor(entry.author, receipt),
  text: entry.text ?? (entry.ciphertext ? '[encrypted message]' : ''),
  timestamp: entry.timestamp,
  delivery: entry.delivery || 'sent'
})
