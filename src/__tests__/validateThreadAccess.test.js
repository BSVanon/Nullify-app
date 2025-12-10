import { describe, expect, it } from 'vitest'

import { validateThreadAccess } from '@/lib/messaging/validateThreadAccess'

const THREAD_ID = 'thread-123'
const USER_PUBKEY = 'user-pubkey'

const baseReceipt = {
  threadId: THREAD_ID,
  identityKind: 'holder',
  status: 'ready',
  ctTxid: 'ct-txid',
  ctVout: 1,
  dtIssuances: [
    {
      txid: 'dt-txid',
      outputs: [
        { recipientPubkey: USER_PUBKEY, vout: 0 },
      ],
    },
  ],
  lastMintTxid: 'dt-txid',
}

describe('validateThreadAccess', () => {
  it('grants access when user has a DT referencing the CT', () => {
    const result = validateThreadAccess({
      threadId: THREAD_ID,
      userPublicKey: USER_PUBKEY,
      receipt: baseReceipt,
    })

    expect(result.hasAccess).toBe(true)
    expect(result.reason).toBe('VALID_DT')
    expect(result.details).toMatch(/Access granted/i)
    expect(result.ctOutpoint).toEqual({ txid: 'ct-txid', vout: 1 })
    expect(result.dtOutpoint).toEqual({ txid: 'dt-txid', vout: 0 })
  })

  it('denies access when CT has been burned and returns burn proof', () => {
    const burnedReceipt = {
      ...baseReceipt,
      status: 'burned',
      burnTxid: 'burn-txid',
      burnedAt: '2025-11-12T00:00:00.000Z',
      burnedBy: 'self',
    }

    const result = validateThreadAccess({
      threadId: THREAD_ID,
      userPublicKey: USER_PUBKEY,
      receipt: burnedReceipt,
    })

    expect(result.hasAccess).toBe(false)
    expect(result.reason).toBe('CT_BURNED')
    expect(result.details).toMatch(/Control Token has been burned/i)
    expect(result.ctOutpoint).toEqual({ txid: 'ct-txid', vout: 1 })
    expect(result.burnProof).toEqual({
      burnTxid: 'burn-txid',
      burnedAt: '2025-11-12T00:00:00.000Z',
      burnedBy: 'self',
    })
  })

  it('denies access when no DT is found for the user', () => {
    const noDtReceipt = {
      ...baseReceipt,
      dtIssuances: [],
    }

    const result = validateThreadAccess({
      threadId: THREAD_ID,
      userPublicKey: USER_PUBKEY,
      receipt: noDtReceipt,
    })

    expect(result.hasAccess).toBe(false)
    expect(result.reason).toBe('NO_DT_FOUND')
    expect(result.details).toMatch(/Data Token.*required/i)
    expect(result.dtOutpoint).toBeNull()
  })
})
