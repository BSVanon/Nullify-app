import React, { useState, useEffect, useMemo } from 'react'

import ThreadHeader from '@/components/messages/ThreadHeader.jsx'
import ThreadMessageList from '@/components/messages/ThreadMessageList.jsx'
import ThreadComposer from '@/components/messages/ThreadComposer.jsx'
import { Button } from '@/components/ui/button'
import ThreadInfoSheet from '@/components/messages/ThreadInfoSheet.jsx'
import ContactSheet from '@/components/identity/ContactSheet.jsx'
import { VerifyDialog } from '@/components/identity/VerifyDialog.jsx'
import { useIdentity } from '@/hooks/identity/useIdentity.js'
import { useContacts } from '@/hooks/identity/useContacts.js'
import { useNotification } from '@/contexts/NotificationContext.jsx'
import { sendPeerPaySatsToIdentityKey } from '@/lib/wallet/sendSats.js'
import { formatErrorForNotification } from '@/lib/errors/userFriendlyErrors.js'

export default function ThreadView({
  thread,
  messages,
  participantPubKey,
  onSendMessage,
  onShowDetails,
  onUpgrade,
  onAction,
  onTyping,
  onGenerateInvite,
  isTyping = false,
  upgradePending = false,
  sendOnEnter = false,
  onSatsSent,
}) {
  const guestMode = thread?.guestMode || false
  const status = thread?.status || 'ready'
  const blocked = status === 'blocked' || thread?.blocked
  const burned = status === 'burned'
  const pending = status === 'pending'
  const peerLeft = thread?.peerLeft === true
  const disabled = !thread || pending || burned || blocked || peerLeft
  const [infoOpen, setInfoOpen] = useState(false)
  const [contactOpen, setContactOpen] = useState(false)
  const [verifyOpen, setVerifyOpen] = useState(false)
  const [isSendingSats, setIsSendingSats] = useState(false)

  const ctOutpoint = (() => {
    if (!thread) return null
    const txid = thread.ctTxid || thread?.ctOutpoint?.txid || null
    if (!txid) return null
    const vout = Number.isInteger(thread.ctVout)
      ? thread.ctVout
      : Number.isInteger(thread?.ctOutpoint?.vout)
        ? thread.ctOutpoint.vout
        : 0
    return { txid, vout }
  })()

  const ctOutpointLabel = ctOutpoint ? `${ctOutpoint.txid}:${ctOutpoint.vout}` : null
  const mintedAtLabel = thread?.mintedAt ? new Date(thread.mintedAt).toLocaleString() : null

  const peerKind = thread?.peerKind || (guestMode ? 'holder' : 'guest')
  const peerPublicKey = thread?.peerPublicKey || null
  const { identity, loading: identityLoading } = useIdentity(peerPublicKey, peerKind)

  const { upsert } = useContacts()
  const { addNotification } = useNotification()

  const peerDisplayName = identity?.name || 'Guest'

  const hasJoinMessage = useMemo(() => {
    if (!Array.isArray(messages)) return false
    return messages.some((message) =>
      typeof message?.text === 'string' && message.text.startsWith('[JOINED]')
    )
  }, [messages])

  useEffect(() => {
    if (!thread) return
    if (!guestMode) return
    if (!thread.id) return
    if (hasJoinMessage) return

    try {
      const authorKey = thread.selfPublicKey || participantPubKey || 'self'
      onSendMessage?.('[JOINED]')
    } catch (error) {
      console.warn('[ThreadView] Failed to post join system message', error)
    }
  }, [thread, guestMode, hasJoinMessage, participantPubKey, onSendMessage])

  const handleCopyOutpoint = () => {
    if (!ctOutpointLabel) return
    navigator?.clipboard?.writeText(ctOutpointLabel).catch(() => {})
  }

  const handleSendSats = async (amount) => {
    const identityKey = thread?.peerWalletPublicKey || null

    if (!identityKey) {
      addNotification({
        type: 'error',
        message: 'This contact has not linked a wallet yet.',
        duration: 6000,
      })
      return
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      addNotification({
        type: 'error',
        message: 'Invalid amount.',
        duration: 5000,
      })
      return
    }

    setIsSendingSats(true)
    try {
      addNotification({
        type: 'success',
        message: 'Bitcoin payment created. Your wallet will ask for confirmation.',
        duration: 8000,
      })
      await sendPeerPaySatsToIdentityKey({
        identityKey,
        amountSats: amount,
      })
      if (typeof onSatsSent === 'function') {
        onSatsSent(amount)
      }
    } catch (error) {
      console.error('[ThreadView] Failed to send sats', error)
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
    <section className="flex h-full flex-1 flex-col">
      <ThreadHeader
        thread={thread}
        identity={identity}
        identityLoading={identityLoading}
        onShowDetails={() => setInfoOpen(true)}
        onAction={onAction}
        onUpgrade={onUpgrade}
        onOpenContact={() => setContactOpen(true)}
      />
      {pending && (
        <div className="border-b border-muted-foreground/10 bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
          Invite pending. Messages will appear after both parties accept.
        </div>
      )}
      <ThreadMessageList
        messages={messages}
        participantPubKey={participantPubKey}
        dimmed={burned}
        showTypingIndicator={!burned && !pending && !peerLeft && isTyping}
        onOpenSatsSupport={() => setInfoOpen(true)}
        onSendSats={handleSendSats}
        peerName={peerDisplayName}
        isSendingSats={isSendingSats}
      />
      {peerLeft && (
        <div className="border-t border-muted-foreground/10 bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{peerDisplayName}</span>{' '}
          deleted local data and left the chat.
        </div>
      )}
      {/* CT outpoint removed - available in Thread Info sheet if needed */}
      {burned ? (
        <div className="border-t border-border bg-background/95 px-4 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1 text-xs text-muted-foreground">
              <p className="text-sm font-semibold text-foreground">Conversation burned.</p>
              <p>
                This conversation's on-chain access token was destroyed and the data tied to it was permanently deleted.
              </p>
              <p>
                Burned by <span className="font-medium text-foreground">{thread?.burnedBy || 'peer'}</span> on
                {" "}
                <span className="font-medium text-foreground">
                  {thread?.burnedAt ? new Date(thread.burnedAt).toLocaleString() : 'unknown time'}
                </span>
              </p>
              {ctOutpointLabel && (
                <p className="flex flex-wrap items-center gap-2">
                  <span>Burned thread access token:</span>
                  <code className="rounded bg-muted/60 px-1 font-mono text-[11px]">{ctOutpointLabel}</code>
                  <Button size="xs" variant="ghost" onClick={handleCopyOutpoint}>
                    Copy
                  </Button>
                </p>
              )}
              {thread?.burnTxid && (
                <p>
                  Burn transaction:{" "}
                  <code className="rounded bg-muted/60 px-1 font-mono text-[11px]">
                    {thread.burnTxid}
                  </code>
                </p>
              )}
            </div>
            <Button size="sm" variant="outline" onClick={() => onAction?.('leave')}>
              Dismiss stub
            </Button>
          </div>
        </div>
      ) : blocked ? (
        <div className="border-t border-border bg-background/95 px-4 py-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Thread blocked.</p>
              <p className="text-xs text-muted-foreground">Messaging is disabled until the inviter unblocks this session.</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => onAction?.('leave')}>
              Leave thread
            </Button>
          </div>
        </div>
      ) : pending ? (
        <div className="border-t border-border bg-background/95 px-4 py-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Waiting for acceptance…</p>
              <p className="text-xs text-muted-foreground">You can leave this thread anytime while it’s pending.</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => onAction?.('leave')}>
              Leave thread
            </Button>
          </div>
        </div>
      ) : (
        <ThreadComposer
          disabled={disabled}
          guestMode={guestMode}
          onSend={onSendMessage}
          onUpgrade={onUpgrade}
          onTyping={onTyping}
          upgradePending={upgradePending}
          sendOnEnter={sendOnEnter}
        />
      )}
      <ThreadInfoSheet 
        open={infoOpen} 
        onOpenChange={setInfoOpen} 
        thread={thread} 
        onGenerateInvite={onGenerateInvite}
        onSatsSent={onSatsSent}
      />

      <ContactSheet
        pubkey={peerPublicKey}
        identity={identity}
        onClose={() => setContactOpen(false)}
        onVerify={() => {
          setContactOpen(false)
          setVerifyOpen(true)
        }}
        onBlock={() => onAction?.('block')}
        open={contactOpen}
      />

      <VerifyDialog
        pubkey={peerPublicKey}
        name={identity?.name || 'Contact'}
        ownPubkey={participantPubKey}
        ownName="You"
        onClose={() => setVerifyOpen(false)}
        open={verifyOpen}
        inviteProfile={thread?.inviterProfile || null}
      />
    </section>
  )
}
