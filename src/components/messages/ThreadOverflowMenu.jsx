import React from 'react'

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

export default function ThreadOverflowMenu({ 
  children, 
  onAction, 
  allowLeave = false, 
  canBlock = true,
  guestMode = false,
  onUpgrade
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {guestMode ? (
          <>
            <DropdownMenuItem onSelect={() => onAction?.('leave')}>
              Leave thread
            </DropdownMenuItem>
            <DropdownMenuItem 
              onSelect={() => onUpgrade?.()}
              className="text-muted-foreground"
            >
              Link wallet to burn
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuItem onSelect={() => onAction?.('burn')}>
              Burn thread
            </DropdownMenuItem>
            {allowLeave && (
              <DropdownMenuItem onSelect={() => onAction?.('leave')}>
                Leave thread
              </DropdownMenuItem>
            )}
          </>
        )}
        {canBlock && (
          <DropdownMenuItem onSelect={() => onAction?.('block')}>
            Block inviter
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
