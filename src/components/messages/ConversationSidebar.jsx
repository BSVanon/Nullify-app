import React, { useContext } from 'react'
import { SquarePen } from 'lucide-react'
import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import MessagePreviewList from '@/components/messages/MessagePreviewList.jsx'
import { RailContext } from '@/contexts/RailContext'

export default function ConversationSidebar({
  conversations = [],
  activeId,
  onSelectConversation,
  onNewThread,
  searchValue,
  onSearchChange
}) {
  const { railCollapsed } = useContext(RailContext)
  return (
    <aside className={cn(
      'flex h-full max-h-full w-full flex-col border-border bg-muted/10 transition-all duration-300',
      'md:w-[320px] md:min-w-[320px] md:border-r'
    )}>
      <div className={cn(
        'flex items-center justify-between gap-3 py-4 transition-all duration-300',
        railCollapsed ? 'pl-16 pr-4' : 'px-4'
      )}>
        <div>
          <h2 className="text-lg font-semibold leading-tight">Threads</h2>
          <p className="text-xs text-muted-foreground">Encrypted 1:1 threads</p>
        </div>
        <Button
          size="icon"
          variant="default"
          onClick={onNewThread}
          aria-label="Start new chat"
          className="h-12 w-12 rounded-full shadow-md"
        >
          <SquarePen className="h-7 w-7" />
        </Button>
      </div>

      <div className="px-4 py-3">
        <Input
          value={searchValue}
          onChange={(event) => onSearchChange?.(event.target.value)}
          placeholder="Search threads"
          className="h-9 bg-background/60"
        />
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3">
        <MessagePreviewList conversations={conversations} activeId={activeId} onOpenConversation={onSelectConversation} />
      </div>
    </aside>
  )
}
