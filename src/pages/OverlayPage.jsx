import React, { useMemo } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

const badgeVariantByTone = {
  ok: 'secondary',
  pending: 'outline',
  danger: 'destructive'
}

export default function OverlayPage() {
  const overlaySnapshot = useMemo(
    () => ({
      summary: [
        {
          id: 'relay-handshake',
          label: 'Relay handshake',
          value: 'Awaiting Desktop overlay helper',
          tone: 'pending'
        },
        {
          id: 'presence-feed',
          label: 'Presence feed',
          value: 'Dormant · no active sockets',
          tone: 'pending'
        },
        {
          id: 'burn-watch',
          label: 'Burn watchdog',
          value: 'Idle · CT heartbeat disabled',
          tone: 'ok'
        }
      ],
      relays: [
        {
          id: 'relay-001',
          name: 'localhost overlay helper',
          transport: 'WebSocket',
          status: 'pending',
          lastSeen: '—',
          pointerDepth: 0
        },
        {
          id: 'relay-002',
          name: 'Metanet Desktop sidecar',
          transport: 'XDM bridge',
          status: 'pending',
          lastSeen: 'Not connected',
          pointerDepth: 0
        }
      ],
      events: [
        {
          id: 'evt-001',
          time: '12:04:11',
          scope: 'overlay',
          message: 'Overlay console initialised. Awaiting relay handshake.'
        },
        {
          id: 'evt-002',
          time: '12:04:13',
          scope: 'presence',
          message: 'No presence sockets registered yet.'
        },
        {
          id: 'evt-003',
          time: '12:05:02',
          scope: 'watchdog',
          message: 'CT burn watchdog paused until overlay helpers connect.'
        }
      ]
    }),
    []
  )

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Overlay Console</h1>
        <p className="text-muted-foreground">
          Monitor pointer, presence, and acknowledgement traffic as the messaging overlay comes online.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>System status</CardTitle>
          <CardDescription>Live relay metrics will appear once a helper service connects to your wallet identity.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {overlaySnapshot.summary.map(({ id, label, value, tone }) => (
            <div key={id} className="rounded-md border border-muted-foreground/20 bg-muted/20 p-4">
              <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
                <span>{label}</span>
                <Badge variant={badgeVariantByTone[tone] ?? 'secondary'} className="text-[10px]">
                  {tone}
                </Badge>
              </div>
              <p className="mt-2 text-sm text-foreground/80">{value}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Relay inventory</CardTitle>
          <CardDescription>Targets the overlay will negotiate with once the helper bridge is active.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          {overlaySnapshot.relays.map(({ id, name, transport, status, lastSeen, pointerDepth }) => (
            <div
              key={id}
              className="flex flex-col gap-1 rounded-md border border-dashed border-muted-foreground/30 bg-muted/10 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium text-foreground/80">{name}</p>
                <p className="text-xs">Transport: {transport}</p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <Badge variant={badgeVariantByTone[status] ?? 'outline'} className="capitalize">
                  {status}
                </Badge>
                <span>Last seen: {lastSeen}</span>
                <span>Pointer depth: {pointerDepth}</span>
              </div>
            </div>
          ))}
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Overlay relays are disabled in the current build. Start the helper bridge to activate this panel.
            </span>
            <Button size="sm" variant="outline" disabled>
              Awaiting helper
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Event log</CardTitle>
          <CardDescription>Once connected, this feed will stream presence, pointer, and burn watchdog activity.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="rounded-md border border-muted-foreground/30 bg-muted/10">
            <ul className="divide-y divide-muted-foreground/20">
              {overlaySnapshot.events.map(({ id, time, scope, message }) => (
                <li key={id} className="flex flex-col gap-1 px-4 py-2 sm:flex-row sm:items-center sm:gap-3">
                  <span className="font-mono text-xs text-muted-foreground">{time}</span>
                  <Badge variant="outline" className="w-fit text-[10px] uppercase tracking-wide">
                    {scope}
                  </Badge>
                  <p className="text-sm text-foreground/80">{message}</p>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-muted-foreground">
            Diagnostic entries persist locally during this session. They will reset once a relay handshake completes.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
