import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@/lib/messaging/storage', () => ({
  saveVaultMessage: vi.fn(),
  updateVaultMessage: vi.fn(),
  purgeVaultForThread: vi.fn(() => Promise.resolve()),
}))

import { purgeVaultForThread, updateVaultMessage } from '@/lib/messaging/storage'
import { createSubscriptionHandler } from '@/hooks/messaging/useGuestThreads/subscriptionManager'

const THREAD_ID = 'thread-123'

describe('createSubscriptionHandler control events', () => {
  let receipts
  let receiptsRef
  let setReceiptsByThread
  let setMessagesByThread
  let setTypingByThread
  let setConversations
  let typingTimersRef
  let clearTyping
  let removeThreadLocally
  let overlayClientRef
  let conversationFromReceipt
  let updateJoinReceipt
  let deleteJoinReceipt
  let deleteGuestIdentity
  let updateThreadMetadata
  let typingEnabledRef
  let bumpConversationActivity
  let messages
  let conversations

  beforeEach(() => {
    vi.clearAllMocks()

    receipts = {
      [THREAD_ID]: {
        threadId: THREAD_ID,
        status: 'ready',
        identityKind: 'guest',
        threadMetadata: {},
      },
    }
    messages = { [THREAD_ID]: [] }
    conversations = [{ id: THREAD_ID, ctTxid: null, blocked: false }]

    receiptsRef = { current: receipts }
    setReceiptsByThread = vi.fn((updater) => {
      receipts = updater(receipts)
      receiptsRef.current = receipts
    })
    setMessagesByThread = vi.fn((updater) => {
      messages = updater(messages)
    })
    setTypingByThread = vi.fn()
    setConversations = vi.fn((updater) => {
      conversations = updater(conversations)
    })
    typingTimersRef = { current: {} }
    clearTyping = vi.fn()
    removeThreadLocally = vi.fn()
    overlayClientRef = {
      current: {
        publishControl: vi.fn(),
        publishAck: vi.fn(),
        publishTyping: vi.fn(),
      },
    }
    conversationFromReceipt = vi.fn((receipt) => ({
      id: receipt.threadId,
      ctTxid: receipt.ctTxid ?? null,
      mintedAt: receipt.mintedAt ?? null,
      status: receipt.status,
    }))
    updateJoinReceipt = vi.fn(async () => ({
      ...receiptsRef.current[THREAD_ID],
      status: 'burned',
      burnedAt: '2025-01-01T00:00:00.000Z',
      burnedBy: 'peer',
    }))
    deleteJoinReceipt = vi.fn()
    deleteGuestIdentity = vi.fn()
    updateThreadMetadata = vi.fn(async () => ({}))
    typingEnabledRef = { current: true }
    bumpConversationActivity = vi.fn()
  })

  const buildHandler = (overrides = {}) =>
    createSubscriptionHandler({
      threadId: THREAD_ID,
      receiptsRef,
      setMessagesByThread,
      setTypingByThread,
      setReceiptsByThread,
      setConversations,
      typingTimersRef,
      clearTyping,
      removeThreadLocally,
      conversationFromReceipt,
      overlayClientRef,
      updateJoinReceipt,
      deleteJoinReceipt,
      deleteGuestIdentity,
      updateThreadMetadata,
      typingEnabledRef,
      bumpConversationActivity,
      ...overrides,
    })

  it('persists CT metadata on mint-ct control events', async () => {
    const mintedAt = '2025-11-07T12:00:00.000Z'
    const handler = buildHandler()

    await handler({
      type: 'control',
      payload: {
        action: 'mint-ct',
        txid: 'abc123',
        vout: 2,
        occurredAt: mintedAt,
      },
    })

    expect(updateThreadMetadata).toHaveBeenCalledWith(
      THREAD_ID,
      expect.objectContaining({
        ctTxid: 'abc123',
        ctVout: 2,
        mintedAt,
        lastMintTxid: 'abc123',
      }),
    )
    expect(receipts[THREAD_ID]).toEqual(
      expect.objectContaining({
        ctTxid: 'abc123',
        ctVout: 2,
        mintedAt,
        lastMintTxid: 'abc123',
      }),
    )
    expect(conversationFromReceipt).toHaveBeenCalledWith(
      expect.objectContaining({
        threadId: THREAD_ID,
        ctTxid: 'abc123',
      }),
      expect.anything(),
    )
    expect(conversations[0]).toEqual(
      expect.objectContaining({ id: THREAD_ID, ctTxid: 'abc123', mintedAt }),
    )
    expect(purgeVaultForThread).not.toHaveBeenCalled()
  })

  it('marks threads as burned on burn control events', async () => {
    const burnAt = '2025-12-01T00:00:00.000Z'
    receipts = {
      [THREAD_ID]: {
        threadId: THREAD_ID,
        status: 'ready',
        ctTxid: 'abc123',
        ctVout: 1,
        threadMetadata: {},
      },
    }
    receiptsRef.current = receipts
    messages = { [THREAD_ID]: [{ id: 'msg-1' }] }

    updateJoinReceipt.mockResolvedValueOnce({
      ...receipts[THREAD_ID],
      status: 'burned',
      burnedAt: burnAt,
      burnedBy: 'peer',
    })

    const handler = buildHandler()

    await handler({
      type: 'control',
      payload: {
        action: 'burn',
        occurredAt: burnAt,
        actor: 'peer',
      },
    })

    expect(purgeVaultForThread).toHaveBeenCalledWith(THREAD_ID)
    expect(updateJoinReceipt).toHaveBeenCalledWith(
      THREAD_ID,
      expect.objectContaining({
        status: 'burned',
        burnedAt: burnAt,
        burnedBy: 'peer',
      }),
    )
    expect(receipts[THREAD_ID]).toEqual(
      expect.objectContaining({ status: 'burned', burnedAt: burnAt, burnedBy: 'peer' }),
    )
    expect(messages[THREAD_ID]).toEqual([])
    expect(clearTyping).toHaveBeenCalledWith(THREAD_ID)
    expect(conversationFromReceipt).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'burned' }),
    )
  })

  it('promotes sent messages to delivered on relay delivery confirmations', async () => {
    const deliveryTimestamp = '2025-11-08T14:30:00.000Z'
    messages = {
      [THREAD_ID]: [{ id: 'msg-1', delivery: 'sent' }]
    }

    updateVaultMessage.mockResolvedValueOnce({ id: 'msg-1', delivery: 'delivered' })

    const handler = buildHandler()

    await handler({
      type: 'delivery',
      payload: {
        messageId: 'msg-1',
        status: 'relayed',
        timestamp: deliveryTimestamp,
      },
    })

    expect(updateVaultMessage).toHaveBeenCalledWith('msg-1', {
      delivery: 'delivered',
    })

    expect(messages[THREAD_ID]).toEqual([
      expect.objectContaining({ id: 'msg-1', delivery: 'delivered' }),
    ])

    expect(bumpConversationActivity).toHaveBeenCalledWith(
      THREAD_ID,
      deliveryTimestamp,
    )
  })

  it('marks messages as failed when relay delivery reports failure', async () => {
    const failureTimestamp = '2025-11-08T15:45:00.000Z'
    messages = {
      [THREAD_ID]: [{ id: 'msg-2', delivery: 'sent' }]
    }

    updateVaultMessage.mockResolvedValue({ id: 'msg-2', delivery: 'failed' })

    const handler = buildHandler()

    await handler({
      type: 'delivery',
      payload: {
        messageId: 'msg-2',
        status: 'failed',
        timestamp: failureTimestamp,
      },
    })

    expect(updateVaultMessage).toHaveBeenCalledWith('msg-2', {
      delivery: 'failed',
    })

    expect(messages[THREAD_ID]).toEqual([
      expect.objectContaining({ id: 'msg-2', delivery: 'failed' }),
    ])

    expect(bumpConversationActivity).toHaveBeenCalledWith(
      THREAD_ID,
      failureTimestamp,
    )
  })
})
