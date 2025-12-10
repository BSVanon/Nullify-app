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

import {
  deleteThreadBackup,
  hasThreadBackup,
} from '@/lib/messaging/threadBackup'
import {
  getHelperCacheItem,
  deleteHelperCacheItem,
} from '@/lib/messaging/helperCacheClient'

describe('threadBackup (legacy passphrase-based)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('deleteThreadBackup', () => {
    it('deletes a backup successfully', async () => {
      deleteHelperCacheItem.mockResolvedValue({ deleted: true })

      const result = await deleteThreadBackup({
        ctTxid: 'ct-txid-abc',
        ctVout: 0,
      })

      expect(result.success).toBe(true)
      expect(deleteHelperCacheItem).toHaveBeenCalledWith('backup:ct-txid-abc:0')
    })

    it('handles missing backup gracefully', async () => {
      deleteHelperCacheItem.mockRejectedValue({ status: 404 })

      const result = await deleteThreadBackup({
        ctTxid: 'ct-txid-abc',
        ctVout: 0,
      })

      // Should not throw, just return failure
      expect(result.success).toBe(false)
    })
  })

  describe('hasThreadBackup', () => {
    it('returns true when backup exists', async () => {
      getHelperCacheItem.mockResolvedValue({ encrypted: 'some-data' })

      const result = await hasThreadBackup({
        ctTxid: 'ct-txid-abc',
        ctVout: 0,
      })

      expect(result).toBe(true)
    })

    it('returns false when no backup exists', async () => {
      getHelperCacheItem.mockResolvedValue(null)

      const result = await hasThreadBackup({
        ctTxid: 'ct-txid-abc',
        ctVout: 0,
      })

      expect(result).toBe(false)
    })
  })
})
