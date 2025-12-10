import React, { useMemo, useState } from 'react'

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { truncateMiddle } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import ThreadTokenInfo from './ThreadTokenInfo'
import { Input } from '@/components/ui/input'
import { useNotification } from '@/contexts/NotificationContext.jsx'
import { sendPeerPaySatsToIdentityKey } from '@/lib/wallet/sendSats.js'
import { formatErrorForNotification } from '@/lib/errors/userFriendlyErrors.js'

const POLICY_LABELS = {
  mutual: 'Burn policy: thread owner only',
  initiator: 'Burn policy: thread owner only'
}

const STATUS_LABELS = {
  pending: 'Invite pending',
  burned: 'Burned',
  left: 'Left',
  ready: 'Active'
}

export default function ThreadInfoSheet({ open, onOpenChange, thread, onGenerateInvite, onSatsSent }) {
  const policyLabel = useMemo(() => {
    if (!thread?.policy) return null
    return POLICY_LABELS[thread.policy] || thread.policy
  }, [thread?.policy])

  const statusLabel = useMemo(() => {
    if (!thread?.status) return null
    return STATUS_LABELS[thread.status] || thread.status
  }, [thread?.status])

  const lastActivity = useMemo(() => {
    if (thread?.lastActivityIso) {
      try {
        return new Date(thread.lastActivityIso).toLocaleString()
      } catch (error) {
        console.warn('Unable to parse lastActivityIso', thread.lastActivityIso, error)
      }
    }
    return thread?.lastActivity || null
  }, [thread?.lastActivityIso, thread?.lastActivity])

  const blocked = thread?.blocked === true

  const isThreadCreator = Boolean(
    thread?.inviter && thread?.selfPublicKey && thread.inviter === thread.selfPublicKey
  )

  const mintedAtLabel = thread?.mintedAt ? new Date(thread.mintedAt).toLocaleString() : null
  const burnAtLabel = thread?.burnedAt ? new Date(thread.burnedAt).toLocaleString() : null

  const dtIssuances = Array.isArray(thread?.dtIssuances) ? thread.dtIssuances : []

  const lastDtIssuance = dtIssuances.length > 0 ? dtIssuances[dtIssuances.length - 1] : null
  const dtIssuedAtLabel = lastDtIssuance?.issuedAt ? new Date(lastDtIssuance.issuedAt).toLocaleString() : null

  const { addNotification } = useNotification()
  const [satsAmount, setSatsAmount] = useState('50000')
  const [isSendingSats, setIsSendingSats] = useState(false)
  
  const PRESET_AMOUNTS = [
    { value: 10000, label: '10K sats' },
    { value: 50000, label: '50K sats' },
    { value: 100000, label: '100K sats' },
  ]

  const handleSendSats = async (amountOverride = null) => {
    const identityKey = thread?.peerWalletPublicKey || null

    if (!identityKey) {
      addNotification({
        type: 'error',
        message: 'This contact has not linked a wallet yet. Try again after they upgrade.',
        duration: 6000,
      })
      return
    }

    const value = amountOverride !== null ? amountOverride : Number(satsAmount)
    if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
      addNotification({
        type: 'error',
        message: 'Amount must be a positive whole number of sats.',
        duration: 5000,
      })
      return
    }

    setIsSendingSats(true)
    try {
      addNotification({
        type: 'success',
        message:
          'Bitcoin payment created. Your wallet will ask for confirmation.',
        duration: 8000,
      })
      await sendPeerPaySatsToIdentityKey({
        identityKey: thread.peerWalletPublicKey,
        amountSats: value,
      })
      if (typeof onSatsSent === 'function') {
        onSatsSent(value)
      }
    } catch (error) {
      console.error('[ThreadInfoSheet] Failed to send sats', error)
      addNotification({
        type: 'error',
        message: formatErrorForNotification(error, { context: 'send payment' }),
        duration: 8000,
      })
    } finally {
      setIsSendingSats(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-sm overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Thread details</SheetTitle>
          <SheetDescription>Status, participants, and advanced access details for this conversation.</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4 text-sm text-muted-foreground">
          <section className="space-y-3">
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-foreground/60">Status</h3>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {statusLabel && <Badge variant="outline">{statusLabel}</Badge>}
              {thread?.guestMode && <Badge variant="secondary">Guest session</Badge>}
              {policyLabel && (
                <Badge variant={thread.policy === 'initiator' ? 'destructive' : 'outline'}>{policyLabel}</Badge>
              )}
              {blocked && <Badge variant="destructive">Inviter blocked</Badge>}
            </div>
            <p className="text-[11px] text-muted-foreground/80">
              Burning this conversation permanently revokes access for everyone and deletes the local data that was tied to it.
            </p>
          </section>

          <Separator className="my-4" />

          <section className="space-y-3">
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-foreground/60">Participants</h3>
            <p>
              <span className="font-medium text-foreground">Thread created by:</span>{' '}
              {thread?.inviterName || 'Unknown'}
            </p>
            {thread?.inviter && (
              <p className="text-xs font-mono text-foreground/70">
                {truncateMiddle(thread.inviter, 34)}
              </p>
            )}
            {isThreadCreator && (
              <p className="text-xs text-muted-foreground/80">You started this thread.</p>
            )}
          </section>

          <Separator className="my-4" />

          {!thread?.guestMode && onGenerateInvite && (
            <section className="space-y-3">
              <h3 className="text-[13px] font-semibold uppercase tracking-wide text-foreground/60">Add another person</h3>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => {
                  // Close this sheet and open the invite dialog
                  onOpenChange?.(false)
                  onGenerateInvite(thread.id)
                }}
                className="w-full"
              >
                Generate invite link
              </Button>
              <p className="text-xs text-muted-foreground/70">
                Create a new invite link to add another participant to this thread. Each person gets their own access token.
              </p>
            </section>
          )}

          {!thread?.guestMode && onGenerateInvite && <Separator className="my-4" />}

          {(thread?.upgradedAt || mintedAtLabel) && (
            <section className="space-y-3">
              <h3 className="text-[13px] font-semibold uppercase tracking-wide text-foreground/60">Upgrade</h3>
              {thread?.upgradedAt && (
                <p>
                  Wallet linked at <span className="text-foreground/80">{thread.upgradedAt}</span>
                </p>
              )}
              {mintedAtLabel && (
                <p>
                  Thread access token minted on <span className="text-foreground/80">{mintedAtLabel}</span>
                </p>
              )}
              {thread?.burnTxid && (
                <div className="space-y-1">
                  <p>
                    Burn tx:
                    {' '}
                    <code className="rounded bg-muted/30 px-1 font-mono text-[11px] text-foreground/80">
                      {truncateMiddle(thread.burnTxid, 28)}
                    </code>
                  </p>
                  {burnAtLabel && <p>Burned on <span className="text-foreground/80">{burnAtLabel}</span></p>}
                </div>
              )}
            </section>
          )}

          {(thread?.upgradedAt || mintedAtLabel) && <Separator className="my-4" />}

          {!thread?.guestMode && thread?.peerWalletPublicKey && (
            <section className="space-y-3">
              <h3 className="text-[13px] font-semibold uppercase tracking-wide text-foreground/60">Send Bitcoin</h3>
              <p className="text-xs text-foreground/70">
                Help cover messaging fees by sending sats to this contact's wallet.
              </p>
              
              {/* Preset amount buttons */}
              <div className="grid grid-cols-3 gap-2">
                {PRESET_AMOUNTS.map((preset) => (
                  <Button
                    key={preset.value}
                    size="sm"
                    variant="outline"
                    onClick={() => handleSendSats(preset.value)}
                    disabled={isSendingSats}
                    className="h-auto flex-col gap-0.5 py-2"
                  >
                    <span className="text-xs font-semibold">{preset.label}</span>
                  </Button>
                ))}
              </div>
              
              {/* Custom amount input */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground/70">Or enter a custom amount:</p>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    value={satsAmount}
                    onChange={(event) => setSatsAmount(event.target.value)}
                    className="flex-1"
                    placeholder="Enter amount"
                  />
                  <Button size="sm" onClick={() => handleSendSats()} disabled={isSendingSats}>
                    {isSendingSats ? 'Sending…' : 'Send'}
                  </Button>
                </div>
              </div>
              
              <details className="text-[11px] text-muted-foreground/60">
                <summary className="cursor-pointer hover:text-muted-foreground">Wallet details</summary>
                <p className="mt-1 font-mono break-all">
                  {thread.peerWalletPublicKey}
                </p>
              </details>
            </section>
          )}

          {!thread?.guestMode && thread?.peerWalletPublicKey && <Separator className="my-4" />}

          {dtIssuances.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-[13px] font-semibold uppercase tracking-wide text-foreground/60">Participant access tokens (advanced)</h3>
              {dtIssuedAtLabel && (
                <p>
                  Last issuance on <span className="text-foreground/80">{dtIssuedAtLabel}</span>
                </p>
              )}
              <div className="space-y-2">
                {dtIssuances.map((issuance, index) => (
                  <details
                    key={`${issuance?.txid || 'issuance'}-${index}`}
                    className="rounded-md border border-muted-foreground/20 bg-muted/10 p-2 text-[11px]"
                  >
                    <summary className="cursor-pointer text-muted-foreground/70">
                      {issuance?.txid ? truncateMiddle(issuance.txid, 32) : `Issuance ${index + 1}`}
                    </summary>
                    <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-[11px] text-foreground/80">
                      {JSON.stringify(issuance, null, 2)}
                    </pre>
                  </details>
                ))}
              </div>
            </section>
          )}

          {dtIssuances.length > 0 && <Separator className="my-4" />}

          {lastActivity && (
            <section className="space-y-3">
              <h3 className="text-[13px] font-semibold uppercase tracking-wide text-foreground/60">Last activity</h3>
              <p>{lastActivity}</p>
            </section>
          )}

          {lastActivity && <Separator className="my-4" />}

          {/* CT/DT token information (advanced on-chain view) */}
          <section className="space-y-2">
            <ThreadTokenInfo thread={thread} />
          </section>
        </div>
      </SheetContent>
    </Sheet>
  )
}
