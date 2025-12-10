import React, { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { listOverlayTelemetry, clearOverlayTelemetry } from '@/lib/messaging/storage'
import { subscribeTelemetry } from '@/lib/messaging/remoteTelemetry'

export default function OverlayTelemetryPanel({ onClose }) {
  const [events, setEvents] = useState([])
  const [stats, setStats] = useState({ totalEvents: 0, avgRtt: null, reconnects: 0 })

  const loadEvents = async () => {
    try {
      const entries = await listOverlayTelemetry(50)
      setEvents(entries)
      computeStats(entries)
    } catch (error) {
      console.error('[OverlayTelemetryPanel] Failed to load events', error)
    }
  }

  const computeStats = (entries) => {
    const heartbeats = entries.filter((e) => e.kind === 'heartbeat' && typeof e.rttMs === 'number')
    const avgRtt = heartbeats.length > 0
      ? Math.round(heartbeats.reduce((sum, e) => sum + e.rttMs, 0) / heartbeats.length)
      : null
    const reconnects = entries.filter((e) => e.kind === 'reconnect').length

    setStats({ totalEvents: entries.length, avgRtt, reconnects })
  }

  const handleClear = async () => {
    try {
      await clearOverlayTelemetry()
      setEvents([])
      setStats({ totalEvents: 0, avgRtt: null, reconnects: 0 })
    } catch (error) {
      console.error('[OverlayTelemetryPanel] Failed to clear telemetry', error)
    }
  }

  useEffect(() => {
    loadEvents()
    const unsubscribe = subscribeTelemetry(() => {
      loadEvents()
    })
    return unsubscribe
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative w-full max-w-3xl max-h-[80vh] overflow-hidden rounded-lg border border-border bg-background shadow-lg">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-lg font-semibold">Overlay Telemetry</h2>
          <Button size="icon" variant="ghost" onClick={onClose} aria-label="Close diagnostics">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="rounded border border-border bg-muted/50 p-3">
              <div className="text-xs text-muted-foreground">Total Events</div>
              <div className="text-xl font-semibold">{stats.totalEvents}</div>
            </div>
            <div className="rounded border border-border bg-muted/50 p-3">
              <div className="text-xs text-muted-foreground">Avg RTT</div>
              <div className="text-xl font-semibold">{stats.avgRtt !== null ? `${stats.avgRtt}ms` : '—'}</div>
            </div>
            <div className="rounded border border-border bg-muted/50 p-3">
              <div className="text-xs text-muted-foreground">Reconnects</div>
              <div className="text-xl font-semibold">{stats.reconnects}</div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Recent Events (last 50)</h3>
            <Button size="sm" variant="outline" onClick={handleClear}>
              Clear Log
            </Button>
          </div>

          <div className="max-h-96 overflow-y-auto rounded border border-border bg-muted/20 p-2 text-xs font-mono">
            {events.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">No telemetry events recorded yet.</div>
            ) : (
              <table className="w-full">
                <thead className="sticky top-0 bg-background border-b border-border">
                  <tr className="text-left">
                    <th className="px-2 py-1">Timestamp</th>
                    <th className="px-2 py-1">Kind</th>
                    <th className="px-2 py-1">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {events.slice().reverse().map((event, idx) => (
                    <tr key={idx} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="px-2 py-1 text-muted-foreground">
                        {new Date(event.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="px-2 py-1">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${getKindBadge(event.kind)}`}>
                          {event.kind}
                        </span>
                      </td>
                      <td className="px-2 py-1 text-muted-foreground">
                        {formatEventDetails(event)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function getKindBadge(kind) {
  switch (kind) {
    case 'status':
      return 'bg-blue-500/20 text-blue-300'
    case 'reconnect':
      return 'bg-yellow-500/20 text-yellow-300'
    case 'error':
      return 'bg-red-500/20 text-red-300'
    case 'heartbeat':
      return 'bg-green-500/20 text-green-300'
    case 'ping':
      return 'bg-purple-500/20 text-purple-300'
    default:
      return 'bg-muted text-muted-foreground'
  }
}

function formatEventDetails(event) {
  const parts = []
  if (event.status) parts.push(`status=${event.status}`)
  if (event.rttMs !== undefined) parts.push(`rtt=${event.rttMs}ms`)
  if (event.attempts !== undefined) parts.push(`attempts=${event.attempts}`)
  if (event.delay !== undefined) parts.push(`delay=${event.delay}ms`)
  if (event.code !== undefined) parts.push(`code=${event.code}`)
  if (event.reason) parts.push(`reason="${event.reason}"`)
  if (event.message) parts.push(`msg="${event.message}"`)
  if (event.phase) parts.push(`phase=${event.phase}`)
  if (event.readyState !== null && event.readyState !== undefined) parts.push(`readyState=${event.readyState}`)
  return parts.length > 0 ? parts.join(', ') : '—'
}
