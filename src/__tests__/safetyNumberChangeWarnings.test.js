import { describe, expect, it, vi } from 'vitest'

import { detectSafetyNumberChanges } from '@/hooks/messaging/useSafetyNumberChangeWarnings.js'

vi.mock('@/lib/identity/safetyNumber.js', () => ({
  safetyNumber: vi.fn((pubkey) => `safety-${pubkey}`),
  compareSafetyNumbers: vi.fn((a, b) => a === b),
}))

const { safetyNumber, compareSafetyNumbers } = await import('@/lib/identity/safetyNumber.js')

describe('detectSafetyNumberChanges', () => {
  it('de-verifies contact and posts SAFETY_CHANGED when safety number changes', async () => {
    const pubkey = 'abcd'
    const contacts = {
      [pubkey]: {
        verified: true,
        verifiedSafetyNumber: 'old-safety',
      },
    }

    // Force a mismatch: safetyNumber(pubkey) !== verifiedSafetyNumber
    safetyNumber.mockImplementationOnce(() => 'new-safety')
    compareSafetyNumbers.mockImplementationOnce(() => false)

    const conversations = [
      {
        id: 'thread-1',
        peerPublicKey: pubkey,
        selfPublicKey: 'self-pub',
      },
    ]

    const messagesByThread = {
      'thread-1': [],
    }

    const sendMessageCalls = []
    const upsertCalls = []

    const sendMessage = vi.fn(async (threadId, payload) => {
      sendMessageCalls.push({ threadId, payload })
    })

    const upsertContact = vi.fn(async (key, patch) => {
      upsertCalls.push({ key, patch })
    })

    await detectSafetyNumberChanges({
      contacts,
      conversations,
      messagesByThread,
      sendMessage,
      upsertContact,
    })

    expect(upsertContact).toHaveBeenCalledTimes(1)
    expect(upsertCalls[0]).toEqual({
      key: pubkey,
      patch: expect.objectContaining({
        verified: false,
        verifiedSafetyNumber: null,
        lastVerifiedSafetyNumber: 'old-safety',
      }),
    })

    expect(sendMessage).toHaveBeenCalledTimes(1)
    expect(sendMessageCalls[0]).toEqual({
      threadId: 'thread-1',
      payload: {
        author: 'self-pub',
        text: '[SAFETY_CHANGED]',
      },
    })
  })

  it('does not post duplicate SAFETY_CHANGED messages for a thread', async () => {
    const pubkey = 'abcd'
    const contacts = {
      [pubkey]: {
        verified: true,
        verifiedSafetyNumber: 'old-safety',
      },
    }

    safetyNumber.mockImplementationOnce(() => 'new-safety')
    compareSafetyNumbers.mockImplementationOnce(() => false)

    const conversations = [
      {
        id: 'thread-1',
        peerPublicKey: pubkey,
        selfPublicKey: 'self-pub',
      },
    ]

    const messagesByThread = {
      'thread-1': [
        { id: 'system-1', text: '[SAFETY_CHANGED]' },
      ],
    }

    const sendMessage = vi.fn()
    const upsertContact = vi.fn()

    await detectSafetyNumberChanges({
      contacts,
      conversations,
      messagesByThread,
      sendMessage,
      upsertContact,
    })

    expect(upsertContact).toHaveBeenCalledTimes(1)
    expect(sendMessage).not.toHaveBeenCalled()
  })
})
