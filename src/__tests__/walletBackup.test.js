import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the helper cache client
vi.mock('@/lib/messaging/helperCacheClient', () => ({
  isHelperCacheConfigured: vi.fn(() => true),
  putHelperCacheItem: vi.fn(),
  getHelperCacheItem: vi.fn(),
  deleteHelperCacheItem: vi.fn(),
}))

// Mock the storage modules
vi.mock('@/lib/messaging/storage', () => ({
  joinReceiptStore: {
    setItem: vi.fn(),
    getItem: vi.fn(),
    iterate: vi.fn((callback) => Promise.resolve()),
  },
  guestIdentityStore: {
    setItem: vi.fn(),
    getItem: vi.fn(),
    iterate: vi.fn((callback) => Promise.resolve()),
  },
}))

// Mock the local backup module
vi.mock('@/lib/settings/localBackup.js', () => ({
  buildLocalBackupPayload: vi.fn(() => Promise.resolve({
    version: 1,
    profiles: {},
    contacts: {},
    blockedInviters: [],
    ui: {},
    preferences: {},
  })),
  applyLocalBackupPayload: vi.fn(() => Promise.resolve({ lostVerifiedPubkeys: [] })),
}))

// Mock the wallet client
vi.mock('@/lib/wallet/client.js', () => ({
  getWallet: vi.fn(),
}))

import {
  checkWalletBackup,
  deleteWalletBackup,
} from '@/lib/messaging/walletBackup'
import {
  getHelperCacheItem,
  deleteHelperCacheItem,
} from '@/lib/messaging/helperCacheClient'

describe('walletBackup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('checkWalletBackup', () => {
    it('returns exists: true when backup is found', async () => {
      getHelperCacheItem.mockResolvedValue({
        encrypted: 'some-encrypted-data',
        createdAt: '2025-01-01T00:00:00Z',
        version: 2,
      })

      const result = await checkWalletBackup('test-identity-key')

      expect(result.exists).toBe(true)
      expect(result.createdAt).toBe('2025-01-01T00:00:00Z')
      expect(result.version).toBe(2)
    })

    it('returns exists: false when no backup found', async () => {
      getHelperCacheItem.mockResolvedValue(null)

      const result = await checkWalletBackup('test-identity-key')

      expect(result.exists).toBe(false)
    })

    it('returns exists: false when identity key is missing', async () => {
      const result = await checkWalletBackup('')

      expect(result.exists).toBe(false)
      expect(getHelperCacheItem).not.toHaveBeenCalled()
    })

    it('handles errors gracefully', async () => {
      getHelperCacheItem.mockRejectedValue(new Error('Network error'))

      const result = await checkWalletBackup('test-identity-key')

      expect(result.exists).toBe(false)
    })
  })

  describe('deleteWalletBackup', () => {
    it('deletes backup successfully', async () => {
      deleteHelperCacheItem.mockResolvedValue({ deleted: true })

      const result = await deleteWalletBackup('test-identity-key')

      expect(result.success).toBe(true)
      expect(deleteHelperCacheItem).toHaveBeenCalled()
    })

    it('returns false when identity key is missing', async () => {
      const result = await deleteWalletBackup('')

      expect(result.success).toBe(false)
      expect(deleteHelperCacheItem).not.toHaveBeenCalled()
    })

    it('handles errors gracefully', async () => {
      deleteHelperCacheItem.mockRejectedValue(new Error('Network error'))

      const result = await deleteWalletBackup('test-identity-key')

      expect(result.success).toBe(false)
    })
  })

  // Note: createWalletBackup and restoreWalletBackup require wallet signature
  // which is difficult to mock properly. These would be better tested as
  // integration tests with a mock wallet.
})
