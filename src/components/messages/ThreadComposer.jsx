import React, { useRef, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

const MAX_LENGTH = 2000

export default function ThreadComposer({
  disabled,
  guestMode,
  onSend,
  onUpgrade,
  upgradePending = false,
  placeholder = 'Type a secure message…',
  onTyping,
  sendOnEnter = false
}) {
  const [draft, setDraft] = useState('')
  const lastTypingRef = useRef(0)

  const handleSubmit = (event) => {
    event.preventDefault()
    if (disabled) return
    const message = draft.trim()
    if (!message) return
    onSend?.(message)
    setDraft('')
  }

  const handleInputChange = (event) => {
    const value = event.target.value.slice(0, MAX_LENGTH)
    setDraft(value)

    if (disabled || !onTyping) return
    const now = Date.now()
    if (now - lastTypingRef.current > 1200) {
      lastTypingRef.current = now
      onTyping()
    }
  }

  const handleKeyDown = (event) => {
    if (disabled) return
    if (!sendOnEnter) return
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      const message = draft.trim()
      if (!message) return
      onSend?.(message)
      setDraft('')
    }
  }

  return (
    <div className="bg-background/95 px-4 py-3">
      <form onSubmit={handleSubmit} className="space-y-3">
        {guestMode && (
          <div className="flex items-center justify-between gap-3 rounded-md border border-muted-foreground/30 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Guest</Badge>
              <span>No wallet linked. Link once to unlock burns.</span>
            </div>
            <Button size="xs" variant="outline" onClick={onUpgrade} type="button" disabled={upgradePending}>
              {upgradePending ? 'Linking…' : 'Link wallet'}
            </Button>
          </div>
        )}

        <div className="flex items-end gap-3">
          <Textarea
            value={draft}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={disabled ? 'Activate the thread to start messaging…' : placeholder}
            disabled={disabled}
            className="min-h-[72px] flex-1 resize-none border-border"
          />

          <Button type="submit" size="sm" disabled={disabled || draft.trim().length === 0}>
            Send
          </Button>
        </div>
      </form>
    </div>
  )
}
