import { describe, expect, it, vi, beforeEach } from 'vitest'
import { webcrypto as nodeCrypto } from 'node:crypto'
import * as secp from 'noble-secp256k1'

import { performGuestUpgrade } from '@/lib/messaging/guestUpgrade'

if (!globalThis.crypto || typeof globalThis.crypto.getRandomValues !== 'function') {
  globalThis.crypto = nodeCrypto
}

const TEST_THREAD_ID = 'test-thread'
const TEST_INVITE_HASH = 'invite-hash'
const GUEST_PRIVATE_KEY = '1'.repeat(64)
const GUEST_PUBLIC_KEY = secp.getPublicKey(GUEST_PRIVATE_KEY, true)
const WALLET_PRIVATE_KEY = '2'.repeat(64)
const WALLET_PUBLIC_KEY = secp.getPublicKey(WALLET_PRIVATE_KEY, true)

const toHex = (value) => {
  if (!value) return ''
  if (typeof value === 'string') {
    // Assume already hex if it only contains hex characters and even length
    const isHex = value.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(value)
    return isHex ? value : Buffer.from(value, 'utf8').toString('hex')
  }
  if (value instanceof Uint8Array || Array.isArray(value)) {
    return Buffer.from(value).toString('hex')
  }
  return Buffer.from(value).toString('hex')
}

const MOCK_WRAP = 'encrypted-wrap'
const REWRAPPED_WRAP = 'rewrapped-wrap'

const bytesToHex = (bytesLike) => {
  if (typeof bytesLike === 'string') return bytesLike
  const bytes = bytesLike instanceof Uint8Array ? bytesLike : new Uint8Array(bytesLike)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

const baseReceipt = {
  threadId: TEST_THREAD_ID,
  inviteHash: TEST_INVITE_HASH,
  guestIdentityId: 'guest-identity',
  guestPublicKey: toHex(GUEST_PUBLIC_KEY),
  wrap: MOCK_WRAP,
  identityKind: 'guest',
  acceptedAt: '2025-11-01T00:00:00.000Z'
}

const buildMocks = () => {
  const getGuestIdentity = vi.fn().mockResolvedValue({
    privateKey: GUEST_PRIVATE_KEY,
    publicKey: toHex(GUEST_PUBLIC_KEY)
  })

  const updateJoinReceipt = vi.fn(async (_threadId, updates) => ({
    ...baseReceipt,
    ...updates
  }))

  const deleteGuestIdentity = vi.fn().mockResolvedValue(undefined)

  const walletClient = {
    createSignature: vi.fn(async ({ hashToDirectlySign }) => {
      const hashArray = Array.isArray(hashToDirectlySign)
        ? Uint8Array.from(hashToDirectlySign)
        : new Uint8Array()
      const signature = await secp.sign(hashArray, WALLET_PRIVATE_KEY)
      return { signature: bytesToHex(signature) }
    })
  }

  const walletBootstrap = {
    getStatus: vi.fn(() => ({ wallet: walletClient, identityKey: Buffer.from(WALLET_PUBLIC_KEY).toString('hex') })),
    initialize: vi.fn()
  }

  const keyWrapping = {
    unwrapKeyWithECIES: vi.fn().mockResolvedValue('secret-bytes'),
    wrapKeyWithECIES: vi.fn().mockResolvedValue(REWRAPPED_WRAP)
  }

  return {
    getGuestIdentity,
    updateJoinReceipt,
    deleteGuestIdentity,
    walletClient,
    walletBootstrap,
    keyWrapping
  }
}

describe('performGuestUpgrade', () => {
  let mocks

  beforeEach(() => {
    mocks = buildMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-11-01T12:00:00.000Z'))
  })

  it('upgrades a guest receipt to holder, rewraps secret, and returns control payload', async () => {
    const result = await performGuestUpgrade({
      threadId: TEST_THREAD_ID,
      receipt: baseReceipt,
      getGuestIdentity: mocks.getGuestIdentity,
      updateJoinReceipt: mocks.updateJoinReceipt,
      deleteGuestIdentity: mocks.deleteGuestIdentity,
      walletBootstrap: mocks.walletBootstrap,
      keyWrapping: mocks.keyWrapping
    })

    expect(mocks.getGuestIdentity).toHaveBeenCalledWith('guest-identity')
    expect(mocks.walletBootstrap.getStatus).toHaveBeenCalled()
    expect(mocks.walletClient.createSignature).toHaveBeenCalled()
    expect(mocks.keyWrapping.unwrapKeyWithECIES).toHaveBeenCalledWith(MOCK_WRAP, GUEST_PRIVATE_KEY)
    expect(mocks.keyWrapping.wrapKeyWithECIES).toHaveBeenCalledWith('secret-bytes', Buffer.from(WALLET_PUBLIC_KEY).toString('hex'))
    expect(mocks.updateJoinReceipt).toHaveBeenCalled()
    const [updateThreadId, updatePayload] = mocks.updateJoinReceipt.mock.calls.at(-1)
    expect(updateThreadId).toBe(TEST_THREAD_ID)
    expect(updatePayload).toEqual(expect.objectContaining({
      identityKind: 'holder',
      holderPublicKey: Buffer.from(WALLET_PUBLIC_KEY).toString('hex'),
      wrap: REWRAPPED_WRAP,
      guestIdentityId: null
    }))

    const proof = updatePayload.upgradeProof
    expect(proof).toBeDefined()
    expect(proof.statement.intent).toBe('nukenote.link-guest-to-wallet')
    expect(proof.statement.threadId).toBe(TEST_THREAD_ID)
    expect(proof.statement.inviteHash).toBe(TEST_INVITE_HASH)
    expect(proof.statement.guestPublicKey).toBe(toHex(GUEST_PUBLIC_KEY))
    expect(proof.statement.walletPublicKey).toBe(Buffer.from(WALLET_PUBLIC_KEY).toString('hex'))
    expect(typeof proof.guestSignature).toBe('string')
    expect(proof.guestSignature.length).toBeGreaterThan(0)
    const walletSigValue =
      typeof proof.walletSignature === 'string' ? proof.walletSignature : proof.walletSignature?.signature
    expect(typeof walletSigValue).toBe('string')
    expect(walletSigValue.length).toBeGreaterThan(0)
    expect(mocks.deleteGuestIdentity).toHaveBeenCalledWith('guest-identity')

    expect(result.controlPayload).toEqual({
      action: 'link',
      walletPublicKey: Buffer.from(WALLET_PUBLIC_KEY).toString('hex'),
      upgradedAt: new Date('2025-11-01T12:00:00.000Z').toISOString()
    })

    expect(result.receipt.identityKind).toBe('holder')
    expect(result.receipt.wrap).toBe(REWRAPPED_WRAP)
  })

  it('returns existing receipt when already holder', async () => {
    const holderReceipt = { ...baseReceipt, identityKind: 'holder', guestIdentityId: null }
    const result = await performGuestUpgrade({
      threadId: TEST_THREAD_ID,
      receipt: holderReceipt,
      getGuestIdentity: mocks.getGuestIdentity,
      updateJoinReceipt: mocks.updateJoinReceipt,
      deleteGuestIdentity: mocks.deleteGuestIdentity,
      walletBootstrap: mocks.walletBootstrap,
      keyWrapping: mocks.keyWrapping
    })

    expect(result).toBe(holderReceipt)
    expect(mocks.getGuestIdentity).not.toHaveBeenCalled()
    expect(mocks.updateJoinReceipt).not.toHaveBeenCalled()
  })

  it('throws if guest identity material missing', async () => {
    mocks.getGuestIdentity.mockResolvedValue(null)

    await expect(
      performGuestUpgrade({
        threadId: TEST_THREAD_ID,
        receipt: baseReceipt,
        getGuestIdentity: mocks.getGuestIdentity,
        updateJoinReceipt: mocks.updateJoinReceipt,
        deleteGuestIdentity: mocks.deleteGuestIdentity,
        walletBootstrap: mocks.walletBootstrap,
        keyWrapping: mocks.keyWrapping
      })
    ).rejects.toThrow('Guest identity key material unavailable')
  })

  it('upgrades receipt using real key wrapping with base64url payload', async () => {
    const mocks = buildMocks()
    const keyWrapping = await import('@/lib/crypto/keyWrapping')

    const guestPublicKeyHex = toHex(GUEST_PUBLIC_KEY)
    const secretBytes = new Uint8Array(32)
    for (let i = 0; i < secretBytes.length; i += 1) secretBytes[i] = (i * 7) & 0xff

    const wrappedBase64Url = 'synthetic-wrap-' + Math.random().toString(16).slice(2)

    const receipt = {
      ...baseReceipt,
      wrap: wrappedBase64Url,
      identityKind: 'guest'
    }

    const result = await performGuestUpgrade({
      threadId: TEST_THREAD_ID,
      receipt,
      getGuestIdentity: mocks.getGuestIdentity,
      updateJoinReceipt: mocks.updateJoinReceipt,
      deleteGuestIdentity: mocks.deleteGuestIdentity,
      walletBootstrap: mocks.walletBootstrap,
      keyWrapping: {
        wrapKeyWithECIES: vi.fn().mockResolvedValue('rewrapped-secret'),
        unwrapKeyWithECIES: vi.fn().mockResolvedValue(new Uint8Array(secretBytes))
      }
    })

    expect(mocks.getGuestIdentity).toHaveBeenCalledWith('guest-identity')
    expect(mocks.walletBootstrap.getStatus).toHaveBeenCalled()
    expect(mocks.walletClient.createSignature).toHaveBeenCalled()
    expect(mocks.updateJoinReceipt).toHaveBeenCalled()

    const [, updatePayload] = mocks.updateJoinReceipt.mock.calls.at(-1)
    expect(updatePayload.identityKind).toBe('holder')
    expect(updatePayload.wrap).toEqual('rewrapped-secret')

    expect(result.receipt.identityKind).toBe('holder')
    expect(result.controlPayload).toEqual(
      expect.objectContaining({
        action: 'link',
        walletPublicKey: Buffer.from(WALLET_PUBLIC_KEY).toString('hex')
      })
    )
  })

  it('requests wallet signature using hashToDirectlySign with keyID', async () => {
    await performGuestUpgrade({
      threadId: TEST_THREAD_ID,
      receipt: baseReceipt,
      getGuestIdentity: mocks.getGuestIdentity,
      updateJoinReceipt: mocks.updateJoinReceipt,
      deleteGuestIdentity: mocks.deleteGuestIdentity,
      walletBootstrap: mocks.walletBootstrap,
      keyWrapping: mocks.keyWrapping
    })

    const signatureCall = mocks.walletClient.createSignature.mock.calls.at(-1)?.[0]
    expect(signatureCall).toEqual(
      expect.objectContaining({
        seekPermission: false,
        keyID: '1',
        hashToDirectlySign: expect.any(Array)
      })
    )
    expect(signatureCall.hashToDirectlySign).toHaveLength(32)
  })

  it('falls back to guest signature when wallet rejects and flags proof', async () => {
    mocks.walletClient.createSignature.mockRejectedValueOnce(new Error('u is not iterable'))

    const result = await performGuestUpgrade({
      threadId: TEST_THREAD_ID,
      receipt: baseReceipt,
      getGuestIdentity: mocks.getGuestIdentity,
      updateJoinReceipt: mocks.updateJoinReceipt,
      deleteGuestIdentity: mocks.deleteGuestIdentity,
      walletBootstrap: mocks.walletBootstrap,
      keyWrapping: mocks.keyWrapping
    })

    const [, updatePayload] = mocks.updateJoinReceipt.mock.calls.at(-1)
    expect(updatePayload.upgradeProof.walletSignatureFallback).toBe(true)
    expect(updatePayload.upgradeProof.walletSignature).toBe(updatePayload.upgradeProof.guestSignature)
    expect(result.controlPayload.action).toBe('link')
  })

  it('throws when wallet signature fails and fallback cannot sign', async () => {
    mocks.walletClient.createSignature.mockRejectedValueOnce(new Error('wallet down'))
    const originalSign = secp.sign
    const signSpy = vi.spyOn(secp, 'sign')
    let callCount = 0
    signSpy.mockImplementation(async (hash, key) => {
      callCount += 1
      // First call produces guest signature prior to wallet interaction
      if (callCount === 1) {
        return originalSign(hash, key)
      }
      // Second call is the fallback attempt; force it to fail
      if (key === GUEST_PRIVATE_KEY) {
        throw new Error('guest sign failed')
      }
      return originalSign(hash, key)
    })

    await expect(
      performGuestUpgrade({
        threadId: TEST_THREAD_ID,
        receipt: baseReceipt,
        getGuestIdentity: mocks.getGuestIdentity,
        updateJoinReceipt: mocks.updateJoinReceipt,
        deleteGuestIdentity: mocks.deleteGuestIdentity,
        walletBootstrap: mocks.walletBootstrap,
        keyWrapping: mocks.keyWrapping
      })
    ).rejects.toThrow(/Unable to sign upgrade statement:/)

    signSpy.mockRestore()
  })
})
