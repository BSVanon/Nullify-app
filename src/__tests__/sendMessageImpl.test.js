import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@/lib/messaging/storage', () => ({
  saveVaultMessage: vi.fn(async (threadId, payload) => ({
    // Spread payload first so our explicit fields (including id) take precedence
    ...payload,
    id: 'stored-1',
    threadId,
    timestamp: '2025-11-12T00:00:00.000Z',
  })),
}))

// Mock the converters module
vi.mock('@/hooks/messaging/useGuestThreads/converters', () => ({
  messageFromVault: vi.fn((stored) => stored),
}))

vi.mock('@/hooks/messaging/useGuestThreads/identity', () => ({
  normalizeLocalAuthor: vi.fn(() => 'normalized-author'),
  resolveLocalPublicKey: vi.fn(() => 'local-pubkey'),
}))

vi.mock('@/lib/messaging/validateThreadAccess', () => ({
  validateThreadAccess: vi.fn(),
}))

vi.mock('@/lib/messaging/helperCacheIntegration', () => ({
  isHelperCacheEnabled: vi.fn(() => false),
  buildHelperCacheId: vi.fn(() => null),
}))

vi.mock('@/lib/messaging/helperCacheClient', () => ({
  putHelperCacheItem: vi.fn(),
}))

import { saveVaultMessage } from '@/lib/messaging/storage'
import { validateThreadAccess } from '@/lib/messaging/validateThreadAccess'
import { sendMessageImpl } from '@/hooks/messaging/useGuestThreads/impl/messaging'

describe('sendMessageImpl', () => {
  const THREAD_ID = 'thread-123'
  const receipt = {
    threadId: THREAD_ID,
    status: 'ready',
    guestPublicKey: 'guest-key',
    holderPublicKey: null,
  }

  let setMessagesByThread
  let bumpConversationActivity
  let overlayClientRef

  beforeEach(() => {
    vi.clearAllMocks()
    setMessagesByThread = vi.fn()
    bumpConversationActivity = vi.fn()
    overlayClientRef = { current: { publishMessage: vi.fn() } }
  })

  it('throws and does not send when DT validation fails', async () => {
    validateThreadAccess.mockReturnValue({
      hasAccess: false,
      reason: 'NO_DT_FOUND',
      details: 'No Data Token found for this user. Access denied.',
    })

    await expect(
      sendMessageImpl({
        threadId: THREAD_ID,
        author: 'self',
        text: 'hello',
        receiptsByThread: { [THREAD_ID]: receipt },
        setMessagesByThread,
        bumpConversationActivity,
        overlayClientRef,
      }),
    ).rejects.toThrow(/Access denied/i)

    expect(saveVaultMessage).not.toHaveBeenCalled()
    expect(overlayClientRef.current.publishMessage).not.toHaveBeenCalled()
    expect(setMessagesByThread).not.toHaveBeenCalled()
  })

  it('persists and publishes message when DT validation passes', async () => {
    validateThreadAccess.mockReturnValue({
      hasAccess: true,
      reason: 'VALID_DT',
    })

    const result = await sendMessageImpl({
      threadId: THREAD_ID,
      author: 'self',
      text: 'hello',
      receiptsByThread: { [THREAD_ID]: receipt },
      setMessagesByThread,
      bumpConversationActivity,
      overlayClientRef,
    })

    expect(saveVaultMessage).toHaveBeenCalledTimes(1)
    expect(setMessagesByThread).toHaveBeenCalledTimes(1)
    expect(bumpConversationActivity).toHaveBeenCalledWith(THREAD_ID, '2025-11-12T00:00:00.000Z')
    expect(overlayClientRef.current.publishMessage).toHaveBeenCalledTimes(1)
    expect(result).toEqual(
      expect.objectContaining({
        id: 'stored-1',
        text: 'hello',
        delivery: 'sent',
      }),
    )
  })
})
