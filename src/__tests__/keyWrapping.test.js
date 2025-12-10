import { describe, it, expect, vi } from 'vitest'
import * as secp from 'noble-secp256k1'
import { webcrypto as nodeCrypto } from 'node:crypto'

import { wrapKeyWithECIES, unwrapKeyWithECIES } from '@/lib/crypto/keyWrapping'
import { base64UrlEncode } from '@/lib/utils'

if (!globalThis.crypto || typeof globalThis.crypto.getRandomValues !== 'function') {
  globalThis.crypto = nodeCrypto
}

const generateAesKey = () => {
  const bytes = new Uint8Array(32)
  globalThis.crypto.getRandomValues(bytes)
  return bytes
}

describe('keyWrapping ECIES helpers', () => {
  it('unwraps keys that were base64url-encoded', async () => {
    const recipientPrivateBytes = secp.utils.randomPrivateKey()
    const recipientPrivateKey = Buffer.from(recipientPrivateBytes).toString('hex')
    const recipientPublicBytes = secp.getPublicKey(recipientPrivateBytes, true)
    const recipientPublicKey = Buffer.from(recipientPublicBytes).toString('hex')

    const aesKey = generateAesKey()

    const sdk = await import('/node_modules/@bsv/sdk/dist/esm/mod.js')
    const deterministicEphemeral = sdk.PrivateKey.fromString('3'.repeat(64), 'hex')
    const spy = vi.spyOn(sdk.PrivateKey, 'fromRandom').mockReturnValue(deterministicEphemeral)

    try {
      const wrappedBase64 = await wrapKeyWithECIES(aesKey, recipientPublicKey)

      const wrappedBase64Url = wrappedBase64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')

      const unwrapped = await unwrapKeyWithECIES(wrappedBase64Url, recipientPrivateKey)

      expect(unwrapped).toBeInstanceOf(Uint8Array)
      expect(unwrapped.length).toBe(32)
      expect(Array.from(unwrapped)).toEqual(Array.from(aesKey))
    } finally {
      spy.mockRestore()
    }
  })
})
