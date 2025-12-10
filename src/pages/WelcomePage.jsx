
import React, { useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

import useOnboardingFlag from '@/hooks/useOnboardingFlag.js'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

export default function WelcomePage() {
  const navigate = useNavigate()
  const { loading, completed, error, markComplete } = useOnboardingFlag()

  useEffect(() => {
    if (!loading && completed) {
      navigate('/messages', { replace: true })
    }
  }, [completed, loading, navigate])

  const handleContinue = useCallback(async () => {
    try {
      await markComplete()
    } catch (persistError) {
      console.warn('[welcome] unable to persist onboarding flag', persistError)
    }
    navigate('/messages', { replace: true })
  }, [markComplete, navigate])

  const handleHelp = useCallback(() => {
    navigate('/workflow')
  }, [navigate])

  const handleSkip = useCallback(() => {
    navigate('/messages')
  }, [navigate])

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        Loading…
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 py-12">
      <div className="space-y-3 text-center">
        <Badge variant="outline" className="px-3 py-1 text-sm">
          Welcome to NukeNote
        </Badge>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Secure P2P Messaging with Verifiable Deletion</h1>
        <p className="text-muted-foreground">
          Accept an invite, chat as a guest, later link a wallet to send your own chat invites.
        </p>
        {error && <p className="text-sm text-destructive">We couldn&apos;t confirm your onboarding status. You can continue anyway.</p>}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick start</CardTitle>
          <CardDescription>Three steps to your first conversation.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-3">
          <div className="space-y-2 rounded-lg border border-muted-foreground/10 bg-muted/20 p-4 text-sm">
            <h2 className="text-base font-medium">1. Accept an invite</h2>
            <p className="text-muted-foreground">Your messages remain secure as a guest user.</p>
          </div>
          <div className="space-y-2 rounded-lg border border-muted-foreground/10 bg-muted/20 p-4 text-sm">
            <h2 className="text-base font-medium">2. Chat in guest mode</h2>
            <p className="text-muted-foreground">Messages remain P2P and all syncing relays are end-to-end encrypted.</p>
          </div>
          <div className="space-y-2 rounded-lg border border-muted-foreground/10 bg-muted/20 p-4 text-sm">
            <h2 className="text-base font-medium">3. Link your wallet</h2>
            <p className="text-muted-foreground">Ready for full features? Connect your Metanet Desktop wallet to send your own invites and more.</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Button onClick={handleContinue} className="w-full sm:w-auto">
          Go to Messages
        </Button>
        <Button variant="ghost" onClick={handleSkip} className="w-full sm:w-auto">
          Dismiss
        </Button>
      </div>

      <Separator />

      <div className="mx-auto max-w-3xl space-y-4 text-sm text-muted-foreground">
        <h2 className="text-center text-base font-medium text-foreground">What happens behind the scenes?</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Guest receipts, wrapped keys, and messaging history are stored locally using encrypted stores.</li>
          <li>
            Wallet upgrades double-sign a thread linkage statement and rewrap the thread key to your identity key.
          </li>
          <li>
            Messages are delivered over an end-to-end encrypted overlay relay; if it&apos;s temporarily unavailable, they stay in your
            local encrypted store and are retried when the connection comes back.
          </li>
        </ul>
      </div>
    </div>
  )
}
