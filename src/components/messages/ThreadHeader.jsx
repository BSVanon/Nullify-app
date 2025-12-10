import React from 'react'

import { Info, Flame, LogOut, UserRound } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { truncateMiddle } from '@/lib/utils'
import { ThreadLabelEditor } from '@/components/identity/ThreadLabelEditor.jsx'
import { Avatar as IdentityAvatar } from '@/components/identity/Avatar.jsx'
import { IdentityBadge, VerifiedBadge } from '@/components/identity/IdentityBadge.jsx'
import { colorSeedFromPubKey } from '@/lib/identity/fallbackName.js'

export default function ThreadHeader({
  thread,
  identity,
  identityLoading = false,
  onShowDetails,
  onAction,
  onUpgrade,
  onOpenContact
}) {
  if (!thread) {
    return (
      <div className="flex items-center justify-between border-b border-muted-foreground/20 bg-background/80 px-4 py-3">
        <div>
          <h2 className="text-base font-semibold">No thread selected</h2>
          <p className="text-xs text-muted-foreground">Pick a conversation from the sidebar or create a new invite.</p>
        </div>
      </div>
    )
  }

  const {
    status,
    guestMode,
    blocked,
    lastActivity,
    inviter,
    ctTxid,
    dtRecipientCount,
    dtRecipients,
    peerPublicKey,
    peerKind,
    helperCache
  } = thread
  const hasCt = Boolean(ctTxid)
  const isBurned = status === 'burned'
  const dtCount = Number(dtRecipientCount) || (Array.isArray(dtRecipients) ? dtRecipients.length : 0)
  const primaryDtRecipient = Array.isArray(dtRecipients) && dtRecipients.length > 0 ? dtRecipients[0] : null

  // Use identity name (includes nickname), NOT thread title
  const displayName = identity?.name || `Guest ${peerPublicKey?.slice(0, 8) || 'Unknown'}`
  const peerKeyLabel = peerPublicKey ? truncateMiddle(peerPublicKey, 20) : 'Unknown participant'
  const colorSeed = identity?.colorSeed ?? (peerPublicKey ? colorSeedFromPubKey(peerPublicKey) : 0)
  const avatarHash = identity?.avatar || null
  const identitySource = identity?.source || null

  let statusChip = null
  if (status === 'pending') {
    statusChip = <Badge variant="outline">Pending</Badge>
  } else if (status === 'left') {
    statusChip = <Badge variant="secondary">Left</Badge>
  } else if (blocked) {
    statusChip = <Badge variant="destructive">Blocked</Badge>
  } else if (isBurned) {
    statusChip = <Badge variant="destructive">Burned</Badge>
  }

  let ctStatusChip = null
  if (hasCt && !isBurned) {
    const hasDt = dtCount > 0
    ctStatusChip = (
      <Badge variant="outline">
        {hasDt ? 'Access active' : 'Access token ready'}
      </Badge>
    )
  } else if (hasCt && isBurned) {
    ctStatusChip = (
      <Badge variant="destructive">
        Access revoked
      </Badge>
    )
  }

  const isInitiator = thread?.inviter && thread.inviter === thread.selfPublicKey
  // Only original CT minters can burn (have mintedAt but no upgradedAt)
  const isOriginalMinter = thread?.mintedAt && !thread?.upgradedAt
  const canBurnThread =
    isOriginalMinter && !isBurned && (thread?.policy !== 'initiator' || isInitiator)
  const burnAction = guestMode || !canBurnThread ? 'leave' : 'burn'
  const burnLabel = burnAction === 'burn' ? 'Burn Thread' : 'Leave Thread'
  const BurnIcon = burnAction === 'burn' ? Flame : LogOut

  const handlePrimaryAction = () => {
    if (burnAction === 'burn') {
      try {
        if (typeof window !== 'undefined') {
          const confirmed = window.confirm(
            'Burn this conversation?\n\nThis will permanently destroy access for everyone and erase the conversation data tied to this on-chain access token. This cannot be undone.',
          )
          if (!confirmed) return
        }
      } catch {
        // If confirm is unavailable for any reason, fall through and perform the action.
      }
    } else if (burnAction === 'leave') {
      try {
        if (typeof window !== 'undefined') {
          const confirmed = window.confirm(
            'Leave this conversation?\n\nThis will delete all local copies of messages for this conversation on this device. You can only rejoin if you receive a new invite.',
          )
          if (!confirmed) return
        }
      } catch {
        // If confirm is unavailable for any reason, fall through and perform the action.
      }
    }
    onAction?.(burnAction)
  }

  return (
    <div className="border-b border-muted-foreground/20 bg-background/80 px-4 py-3">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <IdentityAvatar name={displayName} colorSeed={colorSeed} avatarHash={avatarHash} pubkey={peerPublicKey} size={40} />
            <div className="space-y-0.5">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {/* DEFERRED: Thread naming hidden until group chat support (see docs/messaging/DEFERRED_THREAD_NAMING.md) */}
                <span className="font-semibold">{displayName}</span>
                <VerifiedBadge verified={identity?.verified} />
                {lastActivity && (
                  <span className="text-xs text-muted-foreground ml-2">Last activity: {lastActivity}</span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {statusChip}
                {ctStatusChip}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={onOpenContact}
                    aria-label="Contact details"
                    className="h-9 w-9"
                  >
                    <UserRound className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Contact details &amp; verification</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" onClick={onShowDetails} aria-label="Thread info" className="h-9 w-9">
                    <Info className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Thread details</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {guestMode && typeof onUpgrade === 'function' && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={onUpgrade}
                      aria-label="Upgrade this thread with your wallet"
                      className="hidden sm:inline-flex text-xs font-medium"
                    >
                      <span>Upgrade</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Link your wallet to this thread</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={handlePrimaryAction}
                    aria-label={burnLabel}
                    className="h-9 w-9 text-destructive hover:text-destructive"
                  >
                    <BurnIcon className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{burnLabel}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

      </div>
    </div>
  )
}
