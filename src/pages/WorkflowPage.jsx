import React from 'react'
import { useNavigate } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function WorkflowPage() {
  const navigate = useNavigate()

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 py-10">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">NukeNote Messaging</h1>
        <p className="text-muted-foreground">
          The legacy on-chain access-token stepper has been retired. Threads now start from guest invites and enroll directly into the messaging surface.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Start chatting</CardTitle>
          <CardDescription>Accept an invite or open an existing thread in the messaging console.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border border-muted-foreground/20 bg-muted/10 p-4 text-sm text-muted-foreground">
            <Badge variant="secondary">Guest mode</Badge> Guest users can accept invites, exchange messages, and upgrade to a
            wallet later. Wallet-required mint flows are queued behind the new messaging UX.
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => navigate('/messages')}>Open Messages</Button>
            <Button variant="outline" onClick={() => navigate('/invite/example')}>
              Preview Invite Consent
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Want to work with raw on-chain access tokens manually? The tooling lives in `/legacy/workflow` while we finish
            migrating to the new thread-first experience.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
