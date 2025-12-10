import React, { useCallback, useMemo, useRef, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Avatar as IdentityAvatar } from '@/components/identity/Avatar.jsx'
import { useIdentity } from '@/hooks/identity/useIdentity.js'
import { fallbackNameFromPubKey, colorSeedFromPubKey } from '@/lib/identity/fallbackName.js'

export default function NewThreadInviteDialog({
  open,
  onOpenChange,
  threadId,
  inviteUrl,
  loading,
  onRegenerate,
  notify,
  holderPubKey,
  holderKind = 'holder',
  contacts = {},
  onSendToContact,
}) {
  const [selectedContactPubkey, setSelectedContactPubkey] = useState('')
  const qrRef = useRef(null)

  const truncatedThreadId = useMemo(() => {
    if (!threadId) return ''
    return threadId.length > 16 ? `${threadId.slice(0, 8)}…${threadId.slice(-6)}` : threadId
  }, [threadId])

  const qrSize = useMemo(() => {
    if (!inviteUrl) return 192
    if (inviteUrl.length > 1400) return 320
    if (inviteUrl.length > 1000) return 256
    return 192
  }, [inviteUrl])

  const qrValue = useMemo(() => {
    if (!inviteUrl) return ''
    // qrcode.react throws when data is too long for the configured QR version.
    // For now, avoid rendering QR for very long invite URLs.
    const MAX_QR_LENGTH = 2000
    const eligible = inviteUrl.length <= MAX_QR_LENGTH
    if (typeof window !== 'undefined' && import.meta?.env?.DEV) {
      console.info('[NewThreadInviteDialog] QR evaluation', {
        length: inviteUrl.length,
        maxLength: MAX_QR_LENGTH,
        eligible,
      })
    }
    return eligible ? inviteUrl : ''
  }, [inviteUrl])

  const { identity, loading: identityLoading } = useIdentity(holderPubKey, holderKind)

  // Filter contacts to only show those with wallet pubkeys (holders who can receive direct invites)
  const eligibleContacts = useMemo(() => {
    return Object.entries(contacts)
      .filter(([pubkey, contact]) => {
        // Contact must have a wallet pubkey to receive a direct invite
        const hasWalletKey = contact?.kind === 'holder' || contact?.walletPubkey
        return hasWalletKey && pubkey
      })
      .map(([pubkey, contact]) => ({
        pubkey,
        name: contact?.nickname || contact?.displayName || contact?.card?.displayName || fallbackNameFromPubKey(pubkey),
        colorSeed: contact?.card?.colorSeed || colorSeedFromPubKey(pubkey),
        avatarHash: contact?.avatarHash || contact?.card?.avatarHash || null,
        kind: contact?.kind || 'guest',
        verified: Boolean(contact?.verified),
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [contacts])

  const selectedContact = useMemo(() => {
    return eligibleContacts.find(c => c.pubkey === selectedContactPubkey) || null
  }, [eligibleContacts, selectedContactPubkey])

  const handleSendToContact = useCallback(() => {
    if (!selectedContactPubkey || !onSendToContact) return
    onSendToContact(selectedContactPubkey, selectedContact)
    setSelectedContactPubkey('')
  }, [selectedContactPubkey, selectedContact, onSendToContact])

  const handleCopyLink = useCallback(async () => {
    if (!inviteUrl) return
    try {
      await navigator.clipboard.writeText(inviteUrl)
      notify?.('success', 'Invite link copied to clipboard')
    } catch (error) {
      console.error('[NewThreadInviteDialog] Failed to copy invite link', error)
      notify?.('error', 'Unable to copy invite link')
    }
  }, [inviteUrl, notify])

  const handleCopyQr = useCallback(async () => {
    const canvas = qrRef.current
    if (!canvas || !inviteUrl) return

    try {
      if (canvas.toBlob && window.ClipboardItem) {
        const blob = await new Promise((resolve) => canvas.toBlob(resolve))
        if (blob) {
          await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blob })])
          notify?.('success', 'QR image copied to clipboard')
          return
        }
      }
    } catch (error) {
      console.warn('[NewThreadInviteDialog] ClipboardItem copy failed, falling back', error)
    }

    try {
      const dataUrl = canvas.toDataURL('image/png')
      await navigator.clipboard.writeText(dataUrl)
      notify?.('success', 'QR image data URL copied to clipboard')
    } catch (error) {
      console.error('[NewThreadInviteDialog] Failed to copy QR data URL', error)
      notify?.('error', 'Unable to copy QR image')
    }
  }, [inviteUrl, notify])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[calc(100vh-4rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Invite someone to this thread</DialogTitle>
          <DialogDescription>
            Share this link or QR code with a guest. Thread ID: {truncatedThreadId || '—'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex items-center gap-3 rounded-md border border-muted-foreground/20 bg-muted/10 p-4">
            <IdentityAvatar
              name={identity?.name || 'Your profile'}
              colorSeed={identity?.colorSeed || 0}
              avatarHash={identity?.avatar || null}
              pubkey={holderPubKey}
              size={48}
            />
            <div>
              <p className="text-sm font-medium text-foreground/90">
                {identityLoading ? 'Resolving your wallet profile…' : identity?.name || 'Wallet holder'}
              </p>
              <p className="text-xs text-muted-foreground">
                Invite will appear as coming from your wallet identity once certificates are integrated.
              </p>
            </div>
          </div>

          <div className="space-y-3 rounded-md border border-muted-foreground/20 bg-muted/5 p-4">
            <Label className="text-sm font-medium">Send to a saved contact</Label>
            {eligibleContacts.length > 0 ? (
              <>
                <div className="flex gap-2">
                  <Select
                    value={selectedContactPubkey}
                    onValueChange={setSelectedContactPubkey}
                    disabled={loading}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select a contact…" />
                    </SelectTrigger>
                    <SelectContent>
                      {eligibleContacts.map((contact) => (
                        <SelectItem key={contact.pubkey} value={contact.pubkey}>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{contact.name}</span>
                            {contact.verified && (
                              <span className="text-[10px] text-emerald-500">✓</span>
                            )}
                            <span className="text-[10px] text-muted-foreground">
                              {contact.kind === 'holder' ? 'Wallet' : 'Guest'}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    disabled={!selectedContactPubkey || loading || !onSendToContact}
                    onClick={handleSendToContact}
                  >
                    Send invite
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Select a contact with a linked wallet to send them a direct invite. They&apos;ll receive a DT minted specifically for their identity.
                </p>
              </>
            ) : (
              <div className="rounded-md bg-muted/30 px-3 py-2">
                <p className="text-xs text-muted-foreground">
                  No contacts with linked wallets yet. Share the guest invite link below, or wait for contacts to link their wallets.
                </p>
              </div>
            )}
          </div>

          <Separator />

          <div className="grid gap-4 sm:grid-cols-[minmax(0,1.2fr)_minmax(260px,360px)] sm:items-start">
            <div className="space-y-3">
              <Label htmlFor="invite-link" className="text-sm font-medium">
                Guest invite link
              </Label>
              <Input id="invite-link" value={inviteUrl || ''} readOnly disabled={loading} className="font-mono" />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={!inviteUrl || loading} onClick={handleCopyLink}>
                  Copy link
                </Button>
                <Button size="sm" variant="outline" disabled={loading} onClick={() => onRegenerate?.(threadId)}>
                  Refresh link
                </Button>
              </div>
              {loading && <p className="text-xs text-muted-foreground">Generating invite…</p>}
            </div>

            <div className="flex flex-col items-center gap-2 rounded-md border border-muted-foreground/20 bg-muted/10 p-4">
              {qrValue ? (
                <QRCodeCanvas
                  value={qrValue}
                  size={qrSize}
                  includeMargin
                  level="L"
                  ref={(node) => {
                    if (node) {
                      qrRef.current = node
                    }
                  }}
                />
              ) : (
                <div
                  className="flex items-center justify-center rounded-md bg-muted/40 text-xs text-muted-foreground"
                  style={{ width: qrSize, height: qrSize }}
                >
                  {loading ? 'Generating QR…' : 'Invite link unavailable'}
                </div>
              )}
              <Button size="sm" variant="secondary" disabled={!qrValue || loading} onClick={handleCopyQr}>
                Copy QR image
              </Button>
              <p className="text-[11px] text-muted-foreground text-center">
                Guests can scan this QR code from another device to join the thread.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => onOpenChange?.(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
