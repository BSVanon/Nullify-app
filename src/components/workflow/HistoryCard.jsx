import React from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

function HistoryCard({ histCount, setHistCount, loadHistory, histLoading, histResult, jwtToken }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>History dashboard (xpub-derived)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium" htmlFor="history-count">
              Count
            </label>
            <Input
              id="history-count"
              type="number"
              min={1}
              max={10}
              value={histCount}
              onChange={(e) => setHistCount(e.target.value)}
              className="w-28"
            />
          </div>
          <Button onClick={loadHistory} disabled={histLoading}>
            {histLoading ? 'Loading…' : 'Load history'}
          </Button>
          {!jwtToken && (
            <span className="text-xs text-muted-foreground">Limit 5 without payment verification</span>
          )}
        </div>
        <pre className="min-h-[120px] rounded-md border border-border bg-muted/40 p-3 text-xs font-mono text-muted-foreground whitespace-pre-wrap">
          {histResult}
        </pre>
      </CardContent>
    </Card>
  )
}

export default HistoryCard
