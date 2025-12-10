import { useCallback, useEffect, useMemo, useState } from 'react'
import * as secp from 'noble-secp256k1'

import {
  deleteGuestIdentity,
  getGuestIdentity,
  getJoinReceipt,
  saveGuestIdentity,
  saveJoinReceipt,
  removeBlockedInviter
} from '@/lib/messaging/storage'
import { getSessionId } from '@/lib/messaging/sessionManager'
import { setProfile } from '@/lib/identity/profileStore'

import { isInviteBlocked, parseInviteBlob } from '@/lib/messaging/invite'

const STATUS = {
  IDLE: 'idle',
  LOADING: 'loading',
  READY: 'ready',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  ERROR: 'error',
  EXPIRED: 'expired',
  BLOCKED: 'blocked'
}

const toHex = (uint8) => Array.from(uint8).map((byte) => byte.toString(16).padStart(2, '0')).join('')

const PRIVATE_KEY_PREFIX = 'guest-private-key:'

function makeIdentityId(threadId) {
  const sessionId = getSessionId()
  return `${PRIVATE_KEY_PREFIX}${sessionId}:${threadId}`
}

export default function useGuestThreadJoin(inviteBlob) {
  const [status, setStatus] = useState(STATUS.IDLE)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [invite, setInvite] = useState(null)
  const [guestIdentity, setGuestIdentity] = useState(null)
  const [joinReceipt, setJoinReceipt] = useState(null)
  const [blockedInviter, setBlockedInviter] = useState(null)

  const threadId = invite?.payload?.threadId

  const isExpired = useMemo(() => {
    if (!invite?.payload?.exp) return false
    const expMs = Number(invite.payload.exp) * 1000
    return Number.isFinite(expMs) && expMs < Date.now()
  }, [invite])

  const loadInviteData = useCallback(async () => {
    if (!inviteBlob) return null

    const parsed = parseInviteBlob(inviteBlob)
    const inviterId = parsed.payload?.inviter ?? null
    const blocked = inviterId ? await isInviteBlocked(parsed) : false
    let existingReceipt = null
    let existingIdentity = null

    if (!blocked) {
      existingReceipt = await getJoinReceipt(parsed.payload.threadId)
      existingIdentity = await getGuestIdentity(makeIdentityId(parsed.payload.threadId))
    }

    return {
      parsed,
      inviterId,
      blocked,
      existingReceipt,
      existingIdentity
    }
  }, [inviteBlob])

  const hydrateFromData = useCallback((data) => {
    if (!data) {
      setInvite(null)
      setBlockedInviter(null)
      setGuestIdentity(null)
      setJoinReceipt(null)
      setStatus(STATUS.IDLE)
      return
    }

    const { parsed, inviterId, blocked, existingReceipt, existingIdentity } = data

    setInvite(parsed)

    if (blocked) {
      setBlockedInviter(inviterId)
      setGuestIdentity(null)
      setJoinReceipt(null)
      setStatus(STATUS.BLOCKED)
      return
    }

    setBlockedInviter(null)

    if (existingReceipt?.identityKind === 'holder') {
      setJoinReceipt(existingReceipt)
      setGuestIdentity(null)
      setStatus(STATUS.ACCEPTED)
      return
    }

    if (existingReceipt && existingIdentity) {
      setJoinReceipt(existingReceipt)
      setGuestIdentity(existingIdentity)
      setStatus(STATUS.ACCEPTED)
    } else {
      setJoinReceipt(null)
      setGuestIdentity(null)
      setStatus(STATUS.READY)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function run() {
      try {
        const data = await loadInviteData()
        if (cancelled) return
        setError(null)
        hydrateFromData(data)
      } catch (err) {
        if (cancelled) return
        setInvite(null)
        setGuestIdentity(null)
        setJoinReceipt(null)
        setBlockedInviter(null)
        setError(err.message || 'Failed to parse invite')
        setStatus(STATUS.ERROR)
      }
    }

    run()

    return () => {
      cancelled = true
    }
  }, [loadInviteData, hydrateFromData])

  const acceptAsGuest = useCallback(async () => {
    if (!invite) return
    if (status === STATUS.BLOCKED) {
      setError('This inviter is blocked. Unblock to accept the invite.')
      return
    }
    setLoading(true)
    setError(null)

    try {
      const thread = invite.payload.threadId

      const existing = await getJoinReceipt(thread)
      if (existing?.identityKind === 'holder') {
        setError('This device is already the thread creator for this thread.')
        setStatus(STATUS.ERROR)
        return
      }

      // Prefer guest identity embedded in invite; fall back to a fresh random guest key
      let privateKey
      let publicKeyHex

      const inviteGuest = invite.payload?.guest
      const inviteKeyDerivation = inviteGuest?.keyDerivation

      if (inviteKeyDerivation?.privateKeyHex && inviteGuest?.publicKey) {
        privateKey = inviteKeyDerivation.privateKeyHex
        publicKeyHex = inviteGuest.publicKey

        try {
          const derivedPubKey = secp.getPublicKey(privateKey, true)
          const derivedPubKeyHex =
            typeof derivedPubKey === 'string' ? derivedPubKey : toHex(derivedPubKey)
          if (derivedPubKeyHex !== publicKeyHex) {
            console.warn(
              '[useGuestThreadJoin] Guest key mismatch between seed and publicKey; using invite publicKey',
            )
          }
        } catch (err) {
          console.warn(
            '[useGuestThreadJoin] Failed to derive guest public key from invite seed',
            err,
          )
        }
      } else {
        const randomPrivateKey = secp.utils.randomPrivateKey()
        privateKey = toHex(randomPrivateKey)
        const publicKey = secp.getPublicKey(privateKey, true)
        publicKeyHex = typeof publicKey === 'string' ? publicKey : toHex(publicKey)
      }

      const identityId = makeIdentityId(thread)
      const identity = {
        id: identityId,
        kind: 'guest',
        threadId: thread,
        privateKey,
        publicKey: publicKeyHex,
        createdAt: new Date().toISOString(),
        sessionId: getSessionId()
      }

      const ctTokens = invite.payload.tokens?.ct || null
      const dtIssuance = invite.payload.tokens?.dtIssuance || null
      const ctVout =
        typeof ctTokens?.vout === 'number' && Number.isInteger(ctTokens.vout) && ctTokens.vout >= 0
          ? ctTokens.vout
          : null
      
      // PATENT-CRITICAL: Properly hydrate dtIssuances for validateThreadAccess
      // The validation looks for outputs with recipientPubkey matching the user's public key
      const dtIssuances = dtIssuance ? [{
        txid: dtIssuance.txid,
        outputs: (dtIssuance.outputs || []).map(output => ({
          ...output,
          // Ensure recipientPubkey is set for validation matching
          recipientPubkey: output.recipientPubkey || publicKeyHex,
          txid: output.txid || dtIssuance.txid, // Include txid in output for dtOutpoint resolution
        })),
      }] : []

      // Validate that we have a valid DT for this guest
      if (!ctTokens?.txid || dtIssuances.length === 0 || dtIssuances[0].outputs.length === 0) {
        console.warn('[useGuestThreadJoin] Invite missing CT/DT tokens - guest may not be able to send messages')
      }

      const receipt = {
        threadId: thread,
        inviter: invite.payload.inviter,
        holderPublicKey: invite.payload.inviter, // Store holder's pubkey for identity resolution
        peerWalletPublicKey: invite.payload.inviter,
        policy: invite.payload.policy,
        wrap: invite.payload.wrap,
        inviteHash: invite.hash,
        acceptedAt: new Date().toISOString(),
        guestPublicKey: publicKeyHex,
        guestIdentityId: identityId,
        identityKind: 'guest',
        status: 'ready',
        supportsLeave: true, // Guests can leave threads
        ctTxid: ctTokens?.txid || null,
        ctVout,
        dtIssuances,
        // Store last mint txid for DT outpoint resolution in validateThreadAccess
        lastMintTxid: dtIssuance?.txid || null,
        inviterProfile: invite.payload.meta?.inviterProfile || null, // Store for verification auto-populate
      }

      await saveGuestIdentity(identityId, identity)
      await saveJoinReceipt(thread, receipt)

      // Save inviter's profile to local store immediately (for display name resolution)
      const inviterProfile = invite.payload.meta?.inviterProfile
      if (inviterProfile && inviterProfile.displayName && invite.payload.inviter) {
        try {
          await setProfile(invite.payload.inviter, {
            displayName: inviterProfile.displayName,
            avatarHash: inviterProfile.avatarHash || null
          })
          console.log('[useGuestThreadJoin] Saved inviter profile to store:', {
            inviter: invite.payload.inviter.slice(0, 16) + '...',
            displayName: inviterProfile.displayName
          })
        } catch (profileErr) {
          console.warn('[useGuestThreadJoin] Failed to save inviter profile:', profileErr)
        }
      }

      setGuestIdentity(identity)
      setJoinReceipt(receipt)
      setStatus(STATUS.ACCEPTED)
    } catch (err) {
      setError(err.message || 'Failed to accept invite')
      setStatus(STATUS.ERROR)
    } finally {
      setLoading(false)
    }
  }, [invite, status])

  const declineInvite = useCallback(() => {
    setStatus(STATUS.DECLINED)
  }, [])

  const reset = useCallback(() => {
    setStatus(STATUS.READY)
    setError(null)
    setGuestIdentity(null)
    setJoinReceipt(null)
  }, [])

  const unblockInviter = useCallback(async () => {
    if (!blockedInviter) return
    setLoading(true)
    setError(null)
    try {
      await removeBlockedInviter(blockedInviter)
      const data = await loadInviteData()
      hydrateFromData(data)
    } catch (err) {
      setError(err.message || 'Failed to unblock inviter')
      setStatus(STATUS.ERROR)
    } finally {
      setLoading(false)
    }
  }, [blockedInviter, hydrateFromData, loadInviteData])

  return {
    status,
    STATUS,
    blockedInviter,
    isExpired,
    invite,
    threadId,
    error,
    loading,
    guestIdentity,
    joinReceipt,
    acceptAsGuest,
    declineInvite,
    reset,
    unblockInviter
  }
}
