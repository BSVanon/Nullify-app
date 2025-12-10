import React, { useContext } from 'react'
import { cn } from '@/lib/utils'

import { Input } from '@/components/ui/input'
import SettingsSidebarSectionList from '@/components/settings/SettingsSidebarSectionList.jsx'
import { RailContext } from '@/contexts/RailContext'

export default function SettingsSidebar({
  sections = [],
  activeSectionId,
  onSelectSection,
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
          <h2 className="text-lg font-semibold leading-tight">Settings</h2>
          <p className="text-xs text-muted-foreground">Choose a category</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3">
        <SettingsSidebarSectionList sections={sections} activeSectionId={activeSectionId} onSelectSection={onSelectSection} />
      </div>

      <div className="border-t border-border px-4 py-3">
        <Input
          value={searchValue}
          onChange={(event) => onSearchChange?.(event.target.value)}
          placeholder="Search settings"
          className="h-9 bg-background/60"
        />
      </div>
    </aside>
  )
}
