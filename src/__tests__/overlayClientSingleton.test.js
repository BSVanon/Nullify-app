import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/messaging/createOverlayClient', () => {
  return {
    createOverlayClient: vi.fn(() => ({
      mode: 'websocket',
      close: vi.fn()
    }))
  }
})

vi.mock('@/lib/messaging/messageBoxOverlayClient', () => {
  return {
    createMessageBoxOverlayClient: vi.fn(() => ({
      mode: 'messagebox',
      close: vi.fn()
    }))
  }
})

import { getOverlayClient, closeOverlayClient } from '@/lib/messaging/overlayClientSingleton'
import { createOverlayClient } from '@/lib/messaging/createOverlayClient'
import { createMessageBoxOverlayClient } from '@/lib/messaging/messageBoxOverlayClient'

describe('overlayClientSingleton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset singleton between tests
    closeOverlayClient()
  })

  it('returns the same client for repeated calls with the same config', () => {
    const first = getOverlayClient({
      mode: 'websocket',
      messageBoxHost: null,
      walletClient: null,
      identityKey: null,
      onStatus: vi.fn(),
      logger: console
    })

    const second = getOverlayClient({
      mode: 'websocket',
      messageBoxHost: null,
      walletClient: null,
      identityKey: null,
      onStatus: vi.fn(),
      logger: console
    })

    expect(createOverlayClient).toHaveBeenCalledTimes(1)
    expect(first).toBe(second)
  })

  it('closes the previous client and creates a new one when config changes to messagebox mode', () => {
    const first = getOverlayClient({
      mode: 'websocket',
      messageBoxHost: null,
      walletClient: null,
      identityKey: null,
      onStatus: vi.fn(),
      logger: console
    })

    const closeSpy = first.close

    const second = getOverlayClient({
      mode: 'messagebox',
      messageBoxHost: 'wss://example.test',
      walletClient: {},
      identityKey: 'pubkey-123',
      onStatus: vi.fn(),
      logger: console
    })

    expect(closeSpy).toHaveBeenCalledTimes(1)
    expect(createMessageBoxOverlayClient).toHaveBeenCalledTimes(1)
    expect(second.mode).toBe('messagebox')
  })
})
