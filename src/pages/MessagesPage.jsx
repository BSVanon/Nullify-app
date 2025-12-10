import React, { useCallback, useMemo, useState, useEffect } from 'react'

import ConversationSidebar from '@/components/messages/ConversationSidebar.jsx'
import ThreadView from '@/components/messages/ThreadView.jsx'
import NewThreadInviteDialog from '@/components/messages/NewThreadInviteDialog.jsx'
import useGuestThreads from '@/hooks/messaging/useGuestThreads'
import { useContacts } from '@/hooks/identity/useContacts.js'
import { useSafetyNumberChangeWarnings } from '@/hooks/messaging/useSafetyNumberChangeWarnings.js'
import UpgradePromptDialog from '@/components/messaging/UpgradePromptDialog.jsx'
import OverlayTelemetryPanel from '@/components/diagnostics/OverlayTelemetryPanel.jsx'
import { useWallet } from '@/contexts/WalletContext.jsx'
import { useNotification } from '@/contexts/NotificationContext.jsx'
import { formatErrorForNotification } from '@/lib/errors/userFriendlyErrors.js'
import { sendInviteToContact as sendInviteToContactHelper } from '@/lib/messaging/sendInviteToContact.js'

export default function MessagesPage() {
  const {
    conversations,
    messagesByThread,
    sendMessage,
    leaveThread,
    burnThread,
    upgradeThreadToHolder,
    createNewThread,
    generateThreadInvite,
    typingByThread,
    notifyTyping,
    blockInviter,
    sendOnEnter,
    ensureThreadSubscribed,
  } = useGuestThreads()
  const { isConnected: walletConnected, isLoading: walletLoading, connectWallet, identityKey, getWalletClient } = useWallet()
  const walletClient = walletConnected ? getWalletClient?.() : null
  const { addNotification } = useNotification()
  const { contacts, upsert } = useContacts()
  const [activeId, setActiveId] = useState(null)
  const [upgradePending, setUpgradePending] = useState(false)
  const [upgradePromptOpen, setUpgradePromptOpen] = useState(false)
  const [pendingUpgradeThread, setPendingUpgradeThread] = useState(null)
  const [connectingWallet, setConnectingWallet] = useState(false)
  const [showTelemetry, setShowTelemetry] = useState(false)
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [inviteDialogThread, setInviteDialogThread] = useState(null)
  const [inviteLink, setInviteLink] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [sidebarSearch, setSidebarSearch] = useState('')

  useEffect(() => {
    // DEV-ONLY: Telemetry diagnostics panel
    if (import.meta.env.DEV) {
      const params = new URLSearchParams(window.location.search)
      if (params.get('telemetry') === '1') {
        setShowTelemetry(true)
      }
    }
  }, [])

  const filteredConversations = useMemo(() => {
    const term = sidebarSearch.trim().toLowerCase()
    if (!term) return conversations

    return conversations.filter((conversation) => {
      const title = conversation.title?.toLowerCase?.() || ''
      const preview = conversation.preview?.toLowerCase?.() || ''
      const peerKey = conversation.peerPublicKey?.toLowerCase?.() || ''
      return title.includes(term) || preview.includes(term) || peerKey.includes(term)
    })
  }, [conversations, sidebarSearch])

  const fallbackConversation = filteredConversations[0] ?? conversations[0] ?? null
  const currentId = activeId || fallbackConversation?.id || null
  const activeThread = useMemo(() => {
    const thread = conversations.find((c) => c.id === currentId) || null
    return thread
  }, [conversations, currentId])
  const messages = useMemo(() => (currentId ? messagesByThread[currentId] || [] : []), [currentId, messagesByThread])

  useEffect(() => {
    if (activeId) return
    if (typeof window === 'undefined') return

    try {
      const params = new URLSearchParams(window.location.search)
      const targetId = params.get('thread')
      if (!targetId) return

      const exists = conversations.some((conversation) => conversation.id === targetId)
      if (exists) {
        setActiveId(targetId)
      }
    } catch (error) {
      console.warn('[MessagesPage] Failed to read thread from query params', error)
    }
  }, [activeId, conversations])

  useEffect(() => {
    if (!currentId) return
    ensureThreadSubscribed(currentId)
  }, [currentId, ensureThreadSubscribed])

  useSafetyNumberChangeWarnings({
    contacts,
    conversations,
    messagesByThread,
    sendMessage,
    upsertContact: upsert,
  })

  const notifyUser = useCallback(
    (type, message, duration = type === 'error' ? 6000 : 3000) => {
      addNotification({
        type,
        message,
        duration,
      })
    },
    [addNotification],
  )

  const refreshInviteLink = useCallback(
    async (threadId, { silent = false } = {}) => {
      if (!threadId) return null
      setInviteLoading(true)

      try {
        const url = await generateThreadInvite(threadId)
        if (typeof window !== 'undefined' && import.meta?.env?.DEV) {
          console.info('[MessagesPage] Generated invite URL', {
            threadId,
            length: url?.length ?? 0,
            preview:
              typeof url === 'string'
                ? `${url.slice(0, 120)}${url.length > 120 ? '…' : ''}`
                : null,
          })
        }
        setInviteLink(url)
        if (!silent) {
          notifyUser('success', 'Fresh invite link generated')
        }
        return url
      } catch (error) {
        console.error('[MessagesPage] Failed to generate invite link', error)
        const message = error?.message || ''

        if (
          /Thread key not available for invite generation/i.test(message) ||
          /Cannot mint guest DT: missing raw thread key/i.test(message)
        ) {
          notifyUser(
            'error',
            'New invites are not available for this conversation in this browser session because the encryption key is no longer in memory. Start a new thread to invite additional people.',
          )
        } else {
          notifyUser('error', formatErrorForNotification(error, { context: 'generate invite link' }))
        }
        return null
      } finally {
        setInviteLoading(false)
      }
    },
    [generateThreadInvite, notifyUser],
  )

  const handleOpenInviteForThread = useCallback(
    async (threadId) => {
      if (!threadId) return null
      setInviteDialogThread(threadId)
      setInviteDialogOpen(true)
      const url = await refreshInviteLink(threadId, { silent: false })
      return url
    },
    [refreshInviteLink],
  )

  const performUpgrade = useCallback(
    async (threadId) => {
      if (!threadId || upgradePending) return
      try {
        setUpgradePending(true)
        await upgradeThreadToHolder(threadId)
      } catch (error) {
        console.error('Failed to upgrade thread', error)
        notifyUser('error', formatErrorForNotification(error, { context: 'upgrade thread' }))
        throw error
      } finally {
        setUpgradePending(false)
      }
    },
    [notifyUser, upgradePending, upgradeThreadToHolder],
  )

  const handleUpgradeRequest = useCallback(
    async (threadId) => {
      if (!threadId) return
      setPendingUpgradeThread(threadId)

      if (!walletConnected) {
        setUpgradePromptOpen(true)
        return
      }

      try {
        await performUpgrade(threadId)
      } finally {
        setPendingUpgradeThread(null)
      }
    },
    [walletConnected, performUpgrade],
  )

  const handleConfirmConnect = useCallback(async () => {
    if (!pendingUpgradeThread) {
      setUpgradePromptOpen(false)
      return
    }

    try {
      setConnectingWallet(true)
      await connectWallet()
      setUpgradePromptOpen(false)
      await performUpgrade(pendingUpgradeThread)
      setPendingUpgradeThread(null)
    } catch (error) {
      console.error('Wallet connection required for upgrade failed', error)
      notifyUser('error', formatErrorForNotification(error, { context: 'connect wallet' }))
    } finally {
      setConnectingWallet(false)
    }
  }, [connectWallet, notifyUser, pendingUpgradeThread, performUpgrade])

  const handleCancelPrompt = useCallback(() => {
    setUpgradePromptOpen(false)
    if (!upgradePending) {
      setPendingUpgradeThread(null)
    }
  }, [upgradePending])

  const handleNewThread = useCallback(async () => {
    if (!walletConnected) {
      try {
        setConnectingWallet(true)
        await connectWallet()
      } catch (error) {
        console.error('Wallet connection required for new thread', error)
        return
      } finally {
        setConnectingWallet(false)
      }
    }

    try {
      const newReceipt = await createNewThread()
      setActiveId(newReceipt.threadId)
      setInviteDialogThread(newReceipt.threadId)
      setInviteDialogOpen(true)
      setInviteLink('')
      await refreshInviteLink(newReceipt.threadId, { silent: true })
      notifyUser('success', 'New thread created. Invite link is ready to share.')
    } catch (error) {
      console.error('Failed to create new thread', error)
      notifyUser('error', error.message || 'Failed to create new thread')
      setInviteDialogOpen(false)
      setInviteDialogThread(null)
      setInviteLink('')
    }
  }, [walletConnected, connectWallet, createNewThread, refreshInviteLink, notifyUser])

  const handleInviteDialogOpenChange = useCallback((nextOpen) => {
    setInviteDialogOpen(nextOpen)
    if (!nextOpen) {
      setInviteDialogThread(null)
      setInviteLink('')
    }
  }, [])

  const handleSendToContact = useCallback(
    async (contactPubkey, contact) => {
      await sendInviteToContactHelper({
        walletClient,
        inviteDialogThread,
        inviteLink,
        contactPubkey,
        contact,
        notifyUser,
      })
    },
    [inviteDialogThread, inviteLink, notifyUser, walletClient]
  )

  const handleSatsSentSystemMessage = useCallback(
    async (amount) => {
      if (!currentId || !activeThread) return
      const authorKey = activeThread.selfPublicKey || 'self'

      const numericAmount = Number(amount)
      const hasAmount = Number.isFinite(numericAmount) && numericAmount > 0
      const payload = hasAmount ? `amount=${numericAmount}` : ''
      const text = `[SATS_SENT]${payload}`

      try {
        await sendMessage(currentId, { author: authorKey, text })
      } catch (error) {
        console.warn('[MessagesPage] Failed to post sats system message', error)
      }
    },
    [currentId, activeThread, sendMessage],
  )

  return (
    <>
      <div className="flex h-full min-h-[640px] flex-1 overflow-hidden bg-background">
        <ConversationSidebar
          conversations={filteredConversations}
          activeId={currentId}
          onSelectConversation={(conversation) => setActiveId(conversation.id)}
          onNewThread={handleNewThread}
          searchValue={sidebarSearch}
          onSearchChange={setSidebarSearch}
        />

        <div className="flex flex-1 overflow-hidden">
          <ThreadView
            thread={activeThread}
            messages={messages}
            participantPubKey={activeThread?.selfPublicKey || 'self'}
            isTyping={Boolean(currentId && typingByThread[currentId])}
            onSendMessage={async (text) => {
              if (!currentId) return
              ensureThreadSubscribed(currentId)
              const authorKey = activeThread?.selfPublicKey || 'self'
              await sendMessage(currentId, { author: authorKey, text })
            }}
            onShowDetails={() => {}}
            onUpgrade={() => handleUpgradeRequest(currentId)}
            onTyping={() => {
              if (!currentId) return
              ensureThreadSubscribed(currentId)
              notifyTyping(currentId)
            }}
            onGenerateInvite={handleOpenInviteForThread}
            sendOnEnter={sendOnEnter}
            onSatsSent={handleSatsSentSystemMessage}
            onAction={async (action) => {
              if (!currentId) return
              if (action === 'burn') {
                try {
                  await burnThread(currentId)
                  addNotification({
                    type: 'success',
                    message: 'Thread burned successfully',
                    duration: 3000
                  })
                } catch (error) {
                  console.error('[MessagesPage] Burn failed:', error)
                  addNotification({
                    type: 'error',
                    message: formatErrorForNotification(error, { context: 'burn thread' }),
                    duration: 8000
                  })
                }
              } else if (action === 'leave') {
                await leaveThread(currentId)
                setActiveId(null)
              } else if (action === 'block') {
                const inviterId = activeThread?.inviter
                if (!inviterId) return
                await blockInviter(inviterId, { source: 'thread_overflow', threadId: currentId })
                setActiveId(null)
              }
            }}
            upgradePending={upgradePending || walletLoading || connectingWallet}
          />
        </div>
      </div>

      <UpgradePromptDialog
        open={upgradePromptOpen}
        onOpenChange={setUpgradePromptOpen}
        onConfirm={handleConfirmConnect}
        onCancel={handleCancelPrompt}
        connecting={connectingWallet || walletLoading}
      />

      {showTelemetry && <OverlayTelemetryPanel onClose={() => setShowTelemetry(false)} />}

      <NewThreadInviteDialog
        open={inviteDialogOpen}
        onOpenChange={handleInviteDialogOpenChange}
        threadId={inviteDialogThread}
        inviteUrl={inviteLink}
        loading={inviteLoading}
        onRegenerate={(threadId) => refreshInviteLink(threadId)}
        notify={(type, message) => notifyUser(type, message)}
        contacts={contacts}
        onSendToContact={handleSendToContact}
        holderPubKey={identityKey}
      />
    </>
  )
}
