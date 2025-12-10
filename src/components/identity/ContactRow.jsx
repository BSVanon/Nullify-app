import React from 'react'
import { MessageSquare, ShieldCheck, User, Wallet } from 'lucide-react'

import { Avatar } from '@/components/identity/Avatar.jsx'
import { Button } from '@/components/ui/button'
import { fallbackNameFromPubKey, colorSeedFromPubKey } from '@/lib/identity/fallbackName.js'
import { cn } from '@/lib/utils'

function ContactRow({ pubkey, contact, onOpen, onOpenThread, onStartThread, hasThread, isBlocked, isStartingThread }) {
  const name =
    contact?.nickname ||
    contact?.displayName ||
    contact?.card?.displayName ||
    fallbackNameFromPubKey(pubkey)
  const kind = contact?.kind || 'guest'
  const colorSeed = contact?.card?.colorSeed || colorSeedFromPubKey(pubkey)
  const verified = Boolean(contact?.verified)
  const avatarHash = contact?.avatarHash || contact?.card?.avatarHash || null
  const truncatedPubkey = pubkey.length > 20 ? `${pubkey.slice(0, 10)}…${pubkey.slice(-8)}` : pubkey

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(pubkey)}
      onKeyDown={(e) => e.key === 'Enter' && onOpen(pubkey)}
      className="group flex w-full items-center gap-4 rounded-lg border border-transparent px-4 py-3 text-left transition-all hover:border-border/50 hover:bg-muted/30 cursor-pointer"
    >
      <Avatar
        name={name}
        colorSeed={colorSeed}
        avatarHash={avatarHash}
        pubkey={pubkey}
        size={44}
      />
      <div className="flex flex-1 flex-col min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground truncate">{name}</span>
          {verified && (
            <ShieldCheck className="h-4 w-4 flex-shrink-0 text-emerald-500" />
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-muted-foreground font-mono truncate">{truncatedPubkey}</span>
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            {kind === 'holder' ? (
              <>
                <Wallet className="h-3 w-3" />
                <span>Wallet</span>
              </>
            ) : (
              <>
                <User className="h-3 w-3" />
                <span>Guest</span>
              </>
            )}
          </span>
        </div>
      </div>
      <div className={cn('flex items-center gap-2', isBlocked && 'opacity-60')}>
        {isBlocked ? (
          <span className="rounded-full bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive">
            Blocked
          </span>
        ) : hasThread ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="gap-1.5"
            onClick={(event) => {
              event.stopPropagation()
              onOpenThread?.(pubkey)
            }}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Open chat
          </Button>
        ) : (
          <Button
            type="button"
            variant="default"
            size="sm"
            className="gap-1.5"
            onClick={(event) => {
              event.stopPropagation()
              onStartThread?.(pubkey)
            }}
            disabled={isStartingThread}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            {isStartingThread ? 'Creating…' : 'New chat'}
          </Button>
        )}
      </div>
    </div>
  )
}

export default ContactRow
