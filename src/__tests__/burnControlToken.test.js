/**
 * Burn Control Token Tests
 * 
 * Tests the CT burn functionality including:
 * - Burn transaction creation
 * - Provably unspendable output
 * - Error handling for unauthorized burns
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'

// Mock wallet
const mockClient = {
  createAction: vi.fn(),
  signAction: vi.fn(),
}

vi.mock('../lib/wallet/client.js', () => ({
  getWallet: vi.fn(() => Promise.resolve({ client: mockClient })),
  extractTxid: vi.fn((response) => response?.txid || response?.signResult?.txid || null),
  // Ensure burnControlToken can call forceUtxoRefresh without hitting an undefined mock
  forceUtxoRefresh: vi.fn(async () => true),
}))

// Mock BSV SDK
vi.mock('/node_modules/@bsv/sdk/dist/esm/mod.js', () => ({
  Script: {
    fromASM: vi.fn((asm) => ({
      toHex: () => asm === 'OP_FALSE OP_RETURN' ? '006a' : 'mock-script',
    })),
  },
  PushDrop: vi.fn().mockImplementation(() => ({
    unlock: vi.fn(() => ({
      sign: vi.fn(() => Promise.resolve({
        toHex: () => 'mock-unlocking-script',
      })),
    })),
  })),
  Transaction: {
    fromHex: vi.fn(),
    fromBEEF: vi.fn(),
  },
}))

// Mock wallet bootstrap
vi.mock('../lib/walletBootstrap.js', () => ({
  default: {
    getStatus: vi.fn(() => ({ walletType: 'json-api' })),
  },
}))

// Mock artifacts
vi.mock('../lib/wallet/artifacts.js', () => ({
  collectTransactionArtifacts: vi.fn(() => Promise.resolve({ hasArtifacts: false })),
  persistTransactionArtifactsToStorage: vi.fn(),
}))

// Mock donation fee
vi.mock('../lib/wallet/donationFee.js', () => ({
  buildDonationOutput: vi.fn(() => Promise.resolve(null)),
  clearInvoiceCache: vi.fn(),
}))

// Mock key management
vi.mock('../lib/wallet/keyManagement.js', () => ({
  base64ToUint8: vi.fn((b64) => new Uint8Array(Buffer.from(b64, 'base64'))),
}))

import { burnControlToken } from '../lib/wallet/actions/burn.js'

describe('burnControlToken', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects invalid ctTxid format', async () => {
    await expect(burnControlToken({ ctTxid: 'invalid' }))
      .rejects.toThrow('ctTxid must be 64-hex')
  })

  it('creates burn transaction with OP_FALSE OP_RETURN output', async () => {
    const validTxid = 'a'.repeat(64)
    
    mockClient.createAction.mockResolvedValueOnce({
      txid: 'burn-txid-123',
    })

    const result = await burnControlToken({
      ctTxid: validTxid,
      ctVout: 0,
      broadcast: {
        lockingScriptHex: 'mock-locking-script',
        satoshis: 1,
      },
    })

    expect(mockClient.createAction).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'Burn NukeNote CT',
        inputs: expect.arrayContaining([
          expect.objectContaining({
            txid: validTxid,
            vout: 0,
          }),
        ]),
        outputs: expect.arrayContaining([
          expect.objectContaining({
            satoshis: 0,
            lockingScript: '006a', // OP_FALSE OP_RETURN
            outputDescription: 'CT burn (provable erasure)',
          }),
        ]),
      })
    )

    expect(result.burnTxid).toBe('burn-txid-123')
  })

  it('throws descriptive error when wallet does not control CT', async () => {
    const validTxid = 'b'.repeat(64)
    
    mockClient.createAction.mockResolvedValueOnce({
      signableTransaction: {
        reference: 'ref-123',
        tx: new Uint8Array([1, 2, 3]),
      },
    })

    mockClient.signAction.mockRejectedValueOnce(
      new Error('unlockScript parameter must be valid')
    )

    await expect(burnControlToken({
      ctTxid: validTxid,
      ctVout: 0,
      broadcast: {
        lockingScriptHex: 'mock-locking-script',
        satoshis: 1,
      },
    })).rejects.toThrow('This wallet does not control the Control Token')
  })

  it('requires broadcast metadata for JSON-API wallet', async () => {
    const validTxid = 'c'.repeat(64)

    await expect(burnControlToken({
      ctTxid: validTxid,
      ctVout: 0,
      // Missing broadcast metadata
    })).rejects.toThrow('Missing Control Token broadcast metadata')
  })
})
