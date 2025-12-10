import React from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

function formatTimestamp(timestamp) {
  if (!timestamp) return 'Unknown'
  try {
    return new Date(timestamp).toLocaleString()
  } catch (error) {
    console.warn('Unable to format timestamp', timestamp, error)
    return timestamp
  }
}

export default function BlockedInviterList({ blockedInviters = [], onUnblock, syncStatus = 'Local only' }) {
  const hasEntries = blockedInviters.length > 0

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Inviters you have blocked across threads and invites.</p>
          <p className="text-xs text-muted-foreground/80">
            Overlay syncing keeps this list consistent across devices; until then it stays local to this browser.
          </p>
        </div>
        <Badge variant="outline">{syncStatus}</Badge>
      </div>

      {hasEntries ? (
        <div className="overflow-hidden rounded-md border border-muted-foreground/20">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Inviter key</th>
                <th className="px-4 py-2">Blocked at</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {blockedInviters.map((entry) => (
                <tr key={entry.id} className="border-t border-muted-foreground/10">
                  <td className="px-4 py-2 font-mono text-xs text-foreground/80">{entry.id}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{formatTimestamp(entry.blockedAt)}</td>
                  <td className="px-4 py-2 text-right">
                    <Button size="xs" variant="outline" onClick={() => onUnblock?.(entry.id)}>
                      Unblock
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-muted-foreground/30 px-4 py-6 text-center text-sm text-muted-foreground">
          No inviters are currently blocked.
        </div>
      )}
    </div>
  )
}
