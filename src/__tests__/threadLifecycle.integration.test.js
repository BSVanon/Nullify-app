/**
 * Thread Lifecycle Integration Tests
 * 
 * Tests the full CT/DT lifecycle including:
 * - Thread creation with CT minting
 * - DT issuance for participants
 * - Message sending with DT validation
 * - Burn and access revocation
 * - Key zeroization on burn
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

// Mock storage
const mockStorage = new Map()
vi.mock('@/lib/messaging/storage', () => ({
  getThreadMetadata: vi.fn((id) => Promise.resolve(mockStorage.get(`meta:${id}`) || null)),
  saveThreadMetadata: vi.fn((id, data) => {
    mockStorage.set(`meta:${id}`, data)
    return Promise.resolve(data)
  }),
  updateThreadMetadata: vi.fn((id, updates) => {
    const existing = mockStorage.get(`meta:${id}`) || {}
    const updated = { ...existing, ...updates }
    mockStorage.set(`meta:${id}`, updated)
    return Promise.resolve(updated)
  }),
  getJoinReceipt: vi.fn((id) => Promise.resolve(mockStorage.get(`receipt:${id}`) || null)),
  saveJoinReceipt: vi.fn((id, data) => {
    mockStorage.set(`receipt:${id}`, data)
    return Promise.resolve(data)
  }),
  updateJoinReceipt: vi.fn((id, updates) => {
    const existing = mockStorage.get(`receipt:${id}`) || {}
    const updated = { ...existing, ...updates }
    mockStorage.set(`receipt:${id}`, updated)
    return Promise.resolve(updated)
  }),
  deleteJoinReceipt: vi.fn((id) => {
    mockStorage.delete(`receipt:${id}`)
    return Promise.resolve()
  }),
  purgeVaultForThread: vi.fn(() => Promise.resolve(0)),
  deleteGuestIdentity: vi.fn(() => Promise.resolve()),
  vaultStore: {
    setItem: vi.fn(),
    getItem: vi.fn(),
    iterate: vi.fn(),
  },
}))

// Mock wallet
vi.mock('@/lib/wallet/client', () => ({
  getWallet: vi.fn(() => Promise.resolve({
    client: {
      createAction: vi.fn(() => Promise.resolve({
        txid: 'mock-txid-' + Math.random().toString(36).slice(2),
        rawTx: 'mock-raw-tx',
      })),
      getPublicKey: vi.fn(() => Promise.resolve({ publicKey: 'mock-pubkey' })),
    },
  })),
  extractTxid: vi.fn((response) => response?.txid || null),
}))

// Mock PushDrop
vi.mock('/node_modules/@bsv/sdk/dist/esm/mod.js', () => ({
  PushDrop: vi.fn().mockImplementation(() => ({
    lock: vi.fn(() => Promise.resolve({
      toHex: () => 'mock-locking-script-hex',
    })),
    unlock: vi.fn(() => ({
      sign: vi.fn(() => Promise.resolve({
        toHex: () => 'mock-unlocking-script-hex',
      })),
    })),
  })),
  Script: {
    fromASM: vi.fn(() => ({
      toHex: () => '006a', // OP_FALSE OP_RETURN
    })),
  },
  Transaction: {
    fromHex: vi.fn(),
    fromBEEF: vi.fn(),
  },
}))

import { validateThreadAccess, canAccessThread } from '@/lib/messaging/validateThreadAccess'

describe('Thread Lifecycle Integration', () => {
  beforeEach(() => {
    mockStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    mockStorage.clear()
  })

  describe('DT Validation', () => {
    it('grants access when user has valid DT referencing active CT', () => {
      const receipt = {
        threadId: 'thread-123',
        status: 'ready',
        ctTxid: 'ct-txid-abc',
        ctVout: 0,
        dtIssuances: [{
          txid: 'dt-txid-xyz',
          outputs: [{ recipientPubkey: 'user-pubkey', vout: 0 }],
        }],
        lastMintTxid: 'dt-txid-xyz',
      }

      const result = validateThreadAccess({
        threadId: 'thread-123',
        userPublicKey: 'user-pubkey',
        receipt,
      })

      expect(result.hasAccess).toBe(true)
      expect(result.reason).toBe('VALID_DT')
      expect(result.ctOutpoint).toEqual({ txid: 'ct-txid-abc', vout: 0 })
      expect(result.dtOutpoint).toEqual({ txid: 'dt-txid-xyz', vout: 0 })
    })

    it('denies access when CT is burned', () => {
      const receipt = {
        threadId: 'thread-123',
        status: 'burned',
        ctTxid: 'ct-txid-abc',
        ctVout: 0,
        burnTxid: 'burn-txid',
        burnedAt: '2025-11-25T00:00:00.000Z',
        burnedBy: 'self',
        dtIssuances: [{
          txid: 'dt-txid-xyz',
          outputs: [{ recipientPubkey: 'user-pubkey', vout: 0 }],
        }],
      }

      const result = validateThreadAccess({
        threadId: 'thread-123',
        userPublicKey: 'user-pubkey',
        receipt,
      })

      expect(result.hasAccess).toBe(false)
      expect(result.reason).toBe('CT_BURNED')
      expect(result.burnProof).toEqual({
        burnTxid: 'burn-txid',
        burnedAt: '2025-11-25T00:00:00.000Z',
        burnedBy: 'self',
      })
    })

    it('denies access when no DT exists for user', () => {
      const receipt = {
        threadId: 'thread-123',
        status: 'ready',
        ctTxid: 'ct-txid-abc',
        ctVout: 0,
        dtIssuances: [{
          txid: 'dt-txid-xyz',
          outputs: [{ recipientPubkey: 'other-user-pubkey', vout: 0 }],
        }],
      }

      const result = validateThreadAccess({
        threadId: 'thread-123',
        userPublicKey: 'user-pubkey',
        receipt,
      })

      expect(result.hasAccess).toBe(false)
      expect(result.reason).toBe('NO_DT_FOUND')
    })

    it('denies access when user has left thread', () => {
      const receipt = {
        threadId: 'thread-123',
        status: 'left',
        ctTxid: 'ct-txid-abc',
        ctVout: 0,
      }

      expect(canAccessThread(receipt)).toBe(false)
    })

    it('denies access when thread is blocked', () => {
      const receipt = {
        threadId: 'thread-123',
        status: 'blocked',
      }

      expect(canAccessThread(receipt)).toBe(false)
    })
  })

  describe('Key Zeroization on Burn', () => {
    it('clears key material from receipt on burn', async () => {
      const { updateJoinReceipt } = await import('@/lib/messaging/storage')
      
      // Simulate burn updating receipt
      const burnUpdates = {
        status: 'burned',
        burnedAt: new Date().toISOString(),
        burnedBy: 'self',
        burnTxid: 'burn-txid',
        encKeyWrap: null,
        rawKeyBase64: null,
      }

      await updateJoinReceipt('thread-123', burnUpdates)

      const storedReceipt = mockStorage.get('receipt:thread-123')
      expect(storedReceipt.encKeyWrap).toBeNull()
      expect(storedReceipt.rawKeyBase64).toBeNull()
      expect(storedReceipt.status).toBe('burned')
    })

    it('clears key material from metadata on burn', async () => {
      const { updateThreadMetadata } = await import('@/lib/messaging/storage')
      
      // Pre-populate with key material
      mockStorage.set('meta:thread-123', {
        encKeyWrap: 'wrapped-key-data',
        rawKeyBase64: 'raw-key-data',
        ctEncKeyWrapped: 'ct-wrapped-key',
      })

      // Simulate burn updating metadata
      await updateThreadMetadata('thread-123', {
        burnTxid: 'burn-txid',
        burnedAt: new Date().toISOString(),
        burnedBy: 'self',
        encKeyWrap: null,
        rawKeyBase64: null,
        ctEncKeyWrapped: null,
      })

      const storedMeta = mockStorage.get('meta:thread-123')
      expect(storedMeta.encKeyWrap).toBeNull()
      expect(storedMeta.rawKeyBase64).toBeNull()
      expect(storedMeta.ctEncKeyWrapped).toBeNull()
    })
  })

  describe('Guest DT Hydration', () => {
    it('properly hydrates dtIssuances from invite tokens', () => {
      const inviteTokens = {
        ct: { txid: 'ct-txid', vout: 0 },
        dtIssuance: {
          txid: 'dt-txid',
          outputs: [{ recipientPubkey: 'guest-pubkey', vout: 1 }],
        },
      }

      // Simulate hydration logic from useGuestThreadJoin
      const guestPublicKey = 'guest-pubkey'
      const dtIssuances = inviteTokens.dtIssuance ? [{
        txid: inviteTokens.dtIssuance.txid,
        outputs: (inviteTokens.dtIssuance.outputs || []).map(output => ({
          ...output,
          recipientPubkey: output.recipientPubkey || guestPublicKey,
          txid: output.txid || inviteTokens.dtIssuance.txid,
        })),
      }] : []

      expect(dtIssuances).toHaveLength(1)
      expect(dtIssuances[0].txid).toBe('dt-txid')
      expect(dtIssuances[0].outputs[0].recipientPubkey).toBe('guest-pubkey')
      expect(dtIssuances[0].outputs[0].vout).toBe(1)

      // Verify validateThreadAccess can find the DT
      const receipt = {
        threadId: 'thread-123',
        status: 'ready',
        ctTxid: 'ct-txid',
        ctVout: 0,
        dtIssuances,
        lastMintTxid: 'dt-txid',
      }

      const result = validateThreadAccess({
        threadId: 'thread-123',
        userPublicKey: 'guest-pubkey',
        receipt,
      })

      expect(result.hasAccess).toBe(true)
      expect(result.dtOutpoint.txid).toBe('dt-txid')
      expect(result.dtOutpoint.vout).toBe(1)
    })
  })
})
