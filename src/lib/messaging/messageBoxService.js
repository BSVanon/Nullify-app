/**
 * MessageBox Service
 * 
 * Uses @bsv/message-box-client to send and receive P2P messages
 * via the BSV MessageBox store-and-forward system.
 * 
 * This enables wallet holders to communicate without going out-of-band.
 */

import { MessageBoxClient } from '@bsv/message-box-client'

// Default MessageBox host (Babbage's public instance)
const DEFAULT_MESSAGEBOX_HOST = 'https://messagebox.babbage.systems'

// MessageBox name for NukeNote thread invites
const NUKENOTE_INVITE_BOX = 'nukenote_invites'

// Singleton client instance
let messageBoxClient = null
let clientIdentityKey = null

/**
 * Initialize or get the MessageBox client
 * @param {Object} walletClient - BSV WalletClient instance
 * @param {string} host - MessageBox server host (optional)
 * @returns {Promise<MessageBoxClient>}
 */
export async function getMessageBoxClient(walletClient, host = DEFAULT_MESSAGEBOX_HOST) {
  if (!walletClient) {
    throw new Error('WalletClient is required for MessageBox')
  }

  // Get current identity key
  const { publicKey } = await walletClient.getPublicKey({ identityKey: true })
  
  // Reuse client if identity hasn't changed
  if (messageBoxClient && clientIdentityKey === publicKey) {
    return messageBoxClient
  }

  // Create new client
  messageBoxClient = new MessageBoxClient({
    host,
    walletClient,
  })

  // Initialize the client
  await messageBoxClient.init()
  clientIdentityKey = publicKey

  console.log('[MessageBoxService] Initialized for identity:', publicKey.slice(0, 16) + '...')
  return messageBoxClient
}

/**
 * Send a thread invite to a wallet contact via MessageBox
 * @param {Object} params
 * @param {Object} params.walletClient - BSV WalletClient instance
 * @param {string} params.recipientPubKey - Recipient's wallet identity public key
 * @param {string} params.threadId - Thread ID
 * @param {string} params.inviteUrl - Full invite URL
 * @param {string} params.senderName - Sender's display name (optional)
 * @returns {Promise<{ success: boolean, messageId?: string, error?: string }>}
 */
export async function sendThreadInvite({
  walletClient,
  recipientPubKey,
  threadId,
  inviteUrl,
  senderName = 'Someone',
}) {
  try {
    const client = await getMessageBoxClient(walletClient)

    // Construct the invite message payload
    const invitePayload = {
      type: 'nukenote_thread_invite',
      version: 1,
      threadId,
      inviteUrl,
      senderName,
      timestamp: new Date().toISOString(),
    }

    // Send the message
    await client.sendMessage({
      recipient: recipientPubKey,
      messageBox: NUKENOTE_INVITE_BOX,
      body: JSON.stringify(invitePayload),
    })

    console.log('[MessageBoxService] Sent thread invite to:', recipientPubKey.slice(0, 16) + '...')
    return { success: true }
  } catch (error) {
    console.error('[MessageBoxService] Failed to send thread invite:', error)
    return { success: false, error: error.message || 'Failed to send invite' }
  }
}

/**
 * Listen for incoming thread invites
 * @param {Object} params
 * @param {Object} params.walletClient - BSV WalletClient instance
 * @param {Function} params.onInvite - Callback when invite received: (invite) => void
 * @returns {Promise<Function>} Cleanup function to stop listening
 */
export async function listenForInvites({ walletClient, onInvite }) {
  try {
    const client = await getMessageBoxClient(walletClient)

    // Initialize WebSocket connection for live messages
    await client.initializeConnection()

    // Listen for live messages in our invite box
    await client.listenForLiveMessages({
      messageBox: NUKENOTE_INVITE_BOX,
      onMessage: async (msg) => {
        try {
          const payload = JSON.parse(msg.body)
          if (payload.type === 'nukenote_thread_invite') {
            console.log('[MessageBoxService] Received thread invite:', payload)
            onInvite?.({
              ...payload,
              messageId: msg.messageId,
              senderPubKey: msg.sender,
            })
          }
        } catch (parseError) {
          console.warn('[MessageBoxService] Failed to parse invite message:', parseError)
        }
      },
    })

    console.log('[MessageBoxService] Listening for invites...')

    // Return cleanup function
    return () => {
      // MessageBoxClient doesn't have a direct "stop listening" method,
      // but closing the connection will stop it
      console.log('[MessageBoxService] Stopped listening for invites')
    }
  } catch (error) {
    console.error('[MessageBoxService] Failed to start invite listener:', error)
    throw error
  }
}

/**
 * Check for pending invites (poll-based)
 * @param {Object} params
 * @param {Object} params.walletClient - BSV WalletClient instance
 * @returns {Promise<Array>} Array of pending invites
 */
export async function checkPendingInvites({ walletClient }) {
  try {
    const client = await getMessageBoxClient(walletClient)

    // List messages in our invite box
    const messages = await client.listMessages({
      messageBox: NUKENOTE_INVITE_BOX,
    })

    // Parse and filter valid invites
    const invites = []
    for (const msg of messages) {
      try {
        const payload = JSON.parse(msg.body)
        if (payload.type === 'nukenote_thread_invite') {
          invites.push({
            ...payload,
            messageId: msg.messageId,
            senderPubKey: msg.sender,
          })
        }
      } catch {
        // Skip invalid messages
      }
    }

    console.log('[MessageBoxService] Found', invites.length, 'pending invites')
    return invites
  } catch (error) {
    console.error('[MessageBoxService] Failed to check pending invites:', error)
    return []
  }
}

/**
 * Acknowledge (delete) processed invites
 * @param {Object} params
 * @param {Object} params.walletClient - BSV WalletClient instance
 * @param {Array<string>} params.messageIds - Message IDs to acknowledge
 */
export async function acknowledgeInvites({ walletClient, messageIds }) {
  if (!messageIds?.length) return

  try {
    const client = await getMessageBoxClient(walletClient)
    await client.acknowledgeMessage({ messageIds })
    console.log('[MessageBoxService] Acknowledged', messageIds.length, 'invites')
  } catch (error) {
    console.error('[MessageBoxService] Failed to acknowledge invites:', error)
  }
}

/**
 * Close the MessageBox client connection
 */
export function closeMessageBoxClient() {
  if (messageBoxClient) {
    // MessageBoxClient may have a close method for WebSocket
    messageBoxClient = null
    clientIdentityKey = null
    console.log('[MessageBoxService] Client closed')
  }
}
