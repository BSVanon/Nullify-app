import React from 'react'

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { cn, truncateMiddle } from '@/lib/utils'
import { Avatar as IdentityAvatar } from '@/components/identity/Avatar.jsx'
import { useIdentity } from '@/hooks/identity/useIdentity.js'
import { useThreadLabel } from '@/hooks/identity/useThreadLabel.js'
import { colorSeedFromPubKey } from '@/lib/identity/fallbackName.js'
import { VerifiedBadge } from '@/components/identity/IdentityBadge.jsx'
import { useTheme } from '@/contexts/ThemeContext.jsx'

function MessagePreview({ conversation, isActive, onOpen }) {
  const { id, title, preview, lastActivity, status, ctOutpoint, unreadCount, peerPublicKey, peerKind, guestMode } = conversation

  const { identity, loading: identityLoading } = useIdentity(peerPublicKey, peerKind || 'guest')
  const { label: customLabel } = useThreadLabel(id)

  const { textScale = 'md' } = useTheme()

  const nameTextSizeClass =
    textScale === 'sm' ? 'text-sm' : textScale === 'lg' ? 'text-base' : 'text-sm'
  const previewTextSizeClass =
    textScale === 'sm' ? 'text-[11px]' : textScale === 'lg' ? 'text-sm' : 'text-xs'

  // Use nickname/identity name, NOT thread title
  const displayName = identity?.name || `Guest ${peerPublicKey?.slice(0, 8) || 'Unknown'}`
  const colorSeed = identity?.colorSeed ?? (peerPublicKey ? colorSeedFromPubKey(peerPublicKey) : 0)
  const avatarHash = identity?.avatar || null

  const hasUnread = Number(unreadCount) > 0

  let statusChip = null
  if (status === 'pending') {
    statusChip = <Badge variant="outline">Invite</Badge>
  } else if (status === 'muted') {
    statusChip = <Badge variant="secondary">Muted</Badge>
  } else if (status === 'burned') {
    statusChip = <Badge variant="destructive">Burned</Badge>
  } else if (status === 'left') {
    statusChip = <Badge variant="secondary">Left</Badge>
  } else if (status === 'blocked') {
    statusChip = <Badge variant="destructive">Blocked</Badge>
  }

  return (
    <Card
      className={cn(
        'overflow-hidden transition-colors',
        isActive
          ? 'border-primary bg-primary/5 shadow-sm'
          : 'border-border hover:border-primary/40',
        status === 'pending' && 'border-dashed border-primary/60',
        status === 'muted' && 'opacity-80'
      )}
    >
      <button
        type="button"
        className="flex w-full items-center justify-between gap-4 py-4 text-left"
        onClick={() => onOpen?.(conversation)}
      >
        <div className="flex items-center gap-3 px-4">
          <IdentityAvatar name={displayName || title} colorSeed={colorSeed} avatarHash={avatarHash} pubkey={peerPublicKey} size={40} />
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={cn('leading-none', nameTextSizeClass, hasUnread ? 'font-semibold' : 'font-medium')}>
                {displayName}
              </span>
              {statusChip}
              <VerifiedBadge verified={identity?.verified} />
            </div>
            <p className={cn('text-muted-foreground line-clamp-1', previewTextSizeClass)}>
              {identityLoading ? 'Resolving identity…' : preview}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 pr-4">
          <div className="text-right text-xs text-muted-foreground">
            <div>{lastActivity}</div>
          </div>
          <div className="flex items-center gap-2">
            {Number(unreadCount) > 0 && (
              <Badge variant="secondary" className="h-6 w-6 items-center justify-center rounded-full p-0 text-[11px]">
                {unreadCount}
              </Badge>
            )}
          </div>
        </div>
      </button>
    </Card>
  )
}

export default function MessagePreviewList({ conversations = [], activeId, onOpenConversation }) {
  if (!conversations.length) {
    return (
      <div className="rounded-md border border-dashed border-muted-foreground/40 bg-muted/10 p-6 text-sm text-muted-foreground">
        No messages yet. Invitations and active sessions will appear once overlay helpers connect to your wallet identity.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {conversations.map((conversation) => (
        <MessagePreview
          key={`${conversation.id}-${conversation.status || 'normal'}`}
          conversation={conversation}
          isActive={conversation.id === activeId}
          onOpen={onOpenConversation}
        />
      ))}
    </div>
  )
}
