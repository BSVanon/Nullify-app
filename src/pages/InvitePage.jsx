import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import useGuestThreadJoin from '@/hooks/messaging/useGuestThreadJoin'
import useOnboardingFlag from '@/hooks/useOnboardingFlag'
import { saveBlockedInviter } from '@/lib/messaging/storage'
import { truncateMiddle } from '@/lib/utils'

export default function InvitePage() {
  const navigate = useNavigate()
  const { blob } = useParams()
  const { loading: onboardingLoading, completed: onboardingCompleted, markComplete } = useOnboardingFlag()

  const {
    status,
    STATUS,
    invite,
    isExpired,
    error,
    loading,
    acceptAsGuest,
    declineInvite,
    blockedInviter,
    unblockInviter
  } = useGuestThreadJoin(blob)

  const payload = invite?.payload

  const inviterName = useMemo(() => {
    if (!payload) return 'Unknown inviter'
    return payload.inviterName || payload.inviterLabel || payload.inviter || 'Unknown inviter'
  }, [payload])

  const displayInviterName = useMemo(() => {
    if (!inviterName || inviterName === 'Unknown inviter' || inviterName === 'New Thread') {
      return 'Alice'
    }
    return inviterName
  }, [inviterName])

  const [blockProcessing, setBlockProcessing] = useState(false)

  const handleDeclineAndBlock = useMemo(() => {
    return async () => {
      if (blockProcessing) return
      if (!invite?.payload?.inviter) {
        declineInvite()
        return
      }

      try {
        setBlockProcessing(true)
        await saveBlockedInviter(invite.payload.inviter, {
          reason: 'invite_decline',
          blockedVia: 'invite_page',
          inviteHash: invite.hash || null
        })
      } catch (err) {
        console.error('Failed to block inviter during decline', err)
      } finally {
        setBlockProcessing(false)
        declineInvite()
      }
    }
  }, [blockProcessing, declineInvite, invite])

  useEffect(() => {
    if (!blob) {
      navigate('/messages', { replace: true })
    }
  }, [blob, navigate])

  useEffect(() => {
    if (status === STATUS.ACCEPTED) {
      navigate('/messages', { replace: true })
    }
  }, [navigate, status, STATUS])

  const showBlocked = status === STATUS.BLOCKED
  const showAcceptActions = status === STATUS.READY && !isExpired && !showBlocked
  const showDeclined = status === STATUS.DECLINED
  const showError = status === STATUS.ERROR || (isExpired && !showBlocked)
  
  // Show welcome content for first-time visitors
  const isFirstTimeVisitor = !onboardingLoading && !onboardingCompleted

  // Handle accept and mark onboarding complete
  const handleAcceptInvite = useCallback(async () => {
    // Mark onboarding complete when accepting invite
    if (isFirstTimeVisitor) {
      try {
        await markComplete()
      } catch (err) {
        console.warn('[InvitePage] Failed to mark onboarding complete', err)
      }
    }
    acceptAsGuest()
  }, [acceptAsGuest, isFirstTimeVisitor, markComplete])

  if (onboardingLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading…
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      {/* Welcome header for first-time visitors */}
      {isFirstTimeVisitor && (
        <div className="mb-8 w-full max-w-2xl space-y-3 text-center">
          <Badge variant="outline" className="px-3 py-1 text-sm">
            Welcome to Nullify
          </Badge>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Secure P2P Messaging with Verifiable Deletion
          </h1>
          <p className="text-sm text-muted-foreground">
            You&apos;ve been invited to a private conversation. Accept below to start chatting securely.
          </p>
        </div>
      )}

      {/* Invite Card */}
      <Card className="w-full max-w-md shadow-lg">
        <CardContent className="space-y-6 p-6">
          {showError && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {isExpired ? 'This invite has expired.' : error || 'Unable to load invite. Please check the link.'}
            </div>
          )}

          {showBlocked && (
            <div className="space-y-3 rounded-md border border-muted-foreground/20 bg-muted/20 px-3 py-3">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">Inviter blocked</p>
                <p className="text-xs text-muted-foreground">
                  This inviter is on your block list. To review the invite or message them again, unblock first.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{truncateMiddle(blockedInviter, 28)}</Badge>
                <Button size="sm" onClick={unblockInviter} disabled={loading}>
                  {loading ? 'Unblocking…' : 'Unblock inviter'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate('/messages')}
                  className="ml-auto">
                  Back to messages
                </Button>
              </div>
            </div>
          )}

          {payload && (
            <div className="space-y-3">
              <div className="space-y-1">
                <p className="text-base font-semibold text-foreground">
                  {displayInviterName} has invited you to an Encrypted P2P Chat
                </p>
                <p className="text-sm leading-5 text-muted-foreground">
                  All data is end-to-end encrypted on {displayInviterName}&apos;s device and yours. Your data is erased when you leave the
                  chat.
                </p>
              </div>

              {isExpired && (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[11px] text-destructive">
                  This invite has expired.
                </div>
              )}
            </div>
          )}

          {loading && <div className="text-xs text-muted-foreground">Preparing guest identity…</div>}

          {showAcceptActions && (
            <div className="space-y-2">
              <Button onClick={handleAcceptInvite} disabled={loading || blockProcessing} size="sm" className="w-full">
                {loading ? 'Joining…' : 'Join Chat'}
              </Button>
              <Button
                onClick={handleDeclineAndBlock}
                disabled={loading || blockProcessing}
                size="sm"
                variant="outline"
                className="w-full">
                {blockProcessing ? 'Blocking…' : 'Decline & block'}
              </Button>
              <p className="text-[11px] text-muted-foreground">
                Accepting creates a local guest session. You can connect a wallet later for more features.
              </p>
            </div>
          )}

          {showDeclined && (
            <div className="rounded-md border border-muted/30 bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
              Invite declined. You can close this window.
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  )
}
