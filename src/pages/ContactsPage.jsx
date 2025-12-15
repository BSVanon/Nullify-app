import React, { useCallback, useContext, useMemo, useState } from 'react'
import { MessageSquare, Shield, ShieldCheck, User, Wallet, Filter } from 'lucide-react'

import { useContacts } from '@/hooks/identity/useContacts.js'
import { fallbackNameFromPubKey, colorSeedFromPubKey } from '@/lib/identity/fallbackName.js'
import { Avatar } from '@/components/identity/Avatar.jsx'
import ContactSheet from '@/components/identity/ContactSheet.jsx'
import { useIdentity } from '@/hooks/identity/useIdentity.js'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { VerifyDialog } from '@/components/identity/VerifyDialog.jsx'
import useGuestThreads from '@/hooks/messaging/useGuestThreads'
import { useWallet } from '@/contexts/WalletContext.jsx'
import { useNotification } from '@/contexts/NotificationContext.jsx'
import { useNavigate } from 'react-router-dom'
import { RailContext } from '@/contexts/RailContext'
import { cn } from '@/lib/utils'
import ContactRow from '@/components/identity/ContactRow.jsx'

export default function ContactsPage() {
  const { contacts, loading, refresh, remove } = useContacts()
  const [selectedPubKey, setSelectedPubKey] = useState(null)
  const [search, setSearch] = useState('')
  const [verifyOpen, setVerifyOpen] = useState(false)
  const [startingThreadFor, setStartingThreadFor] = useState(null)
  const [showGuests, setShowGuests] = useState(false) // Hide guests by default

  const { blockInviter, unblockInviter, conversations, isInviterBlocked, createNewThread, generateThreadInvite } = useGuestThreads()
  const { isConnected: walletConnected, connectWallet } = useWallet()
  const { addNotification } = useNotification()
  const { railCollapsed } = useContext(RailContext)
  const navigate = useNavigate()

  // Handler to start a new thread with a contact
  const handleStartThread = useCallback(async (contactPubkey) => {
    if (!contactPubkey || startingThreadFor) return

    setStartingThreadFor(contactPubkey)
    try {
      // Ensure wallet is connected (required to create threads)
      if (!walletConnected) {
        await connectWallet()
      }

      // Create a new thread
      const newReceipt = await createNewThread()
      
      // Generate an invite link
      const inviteUrl = await generateThreadInvite(newReceipt.threadId)
      
      // Copy the invite link to clipboard
      if (inviteUrl) {
        await navigator.clipboard.writeText(inviteUrl)
        const contactName = contacts[contactPubkey]?.nickname || 
                          contacts[contactPubkey]?.displayName || 
                          fallbackNameFromPubKey(contactPubkey)
        addNotification({
          type: 'success',
          message: `Thread created! Invite link copied. Share it with ${contactName} to connect.`,
          duration: 6000,
        })
      }

      // Navigate to the new thread
      navigate(`/messages?thread=${encodeURIComponent(newReceipt.threadId)}`)
    } catch (error) {
      console.error('[ContactsPage] Failed to start thread', error)
      addNotification({
        type: 'error',
        message: error.message || 'Failed to create thread',
        duration: 5000,
      })
    } finally {
      setStartingThreadFor(null)
    }
  }, [startingThreadFor, walletConnected, connectWallet, createNewThread, generateThreadInvite, contacts, addNotification, navigate])

  // Handler to open an existing thread
  const handleOpenThread = useCallback((contactPubkey) => {
    const existing = conversations.find((conv) => conv?.peerPublicKey === contactPubkey)
    if (existing?.id) {
      navigate(`/messages?thread=${encodeURIComponent(existing.id)}`)
    } else {
      navigate('/messages')
    }
  }, [conversations, navigate])

  const entries = useMemo(() => {
    const list = Object.entries(contacts || {})

    const getGroupRank = (contact, pubkey) => {
      const kind = contact?.kind || 'guest'
      const verified = Boolean(contact?.verified)
      const hasProfile = Boolean(contact?.certificate || contact?.card || contact?.nickname)

      if (kind === 'holder' && verified) return 0 // verified holders
      if (kind === 'holder') return 1 // other holders
      if (kind === 'guest' && verified) return 2 // verified guests
      if (kind === 'guest' && hasProfile) return 3 // other guests with some profile info
      return 4 // pure fallback / unknown
    }

    const getDisplayName = (contact, pubkey) =>
      contact?.nickname ||
      contact?.displayName ||
      contact?.card?.displayName ||
      fallbackNameFromPubKey(pubkey)

    return list.sort(([pubkeyA, contactA], [pubkeyB, contactB]) => {
      const groupA = getGroupRank(contactA, pubkeyA)
      const groupB = getGroupRank(contactB, pubkeyB)
      if (groupA !== groupB) return groupA - groupB

      const nameA = getDisplayName(contactA, pubkeyA).toLowerCase()
      const nameB = getDisplayName(contactB, pubkeyB).toLowerCase()
      if (nameA !== nameB) return nameA.localeCompare(nameB)

      return pubkeyA.localeCompare(pubkeyB)
    })
  }, [contacts])

  // Count wallet vs guest contacts
  const contactCounts = useMemo(() => {
    let wallets = 0
    let guests = 0
    for (const [, contact] of entries) {
      if (contact?.kind === 'holder') wallets++
      else guests++
    }
    return { wallets, guests }
  }, [entries])

  // Build a set of pubkeys that have active conversations
  const activeConversationPubkeys = useMemo(() => {
    const set = new Set()
    for (const conv of conversations) {
      if (conv?.peerPublicKey) {
        set.add(conv.peerPublicKey.toLowerCase())
      }
    }
    return set
  }, [conversations])

  const filtered = useMemo(() => {
    let result = entries

    // Filter by contact type - but always show contacts with active conversations
    if (!showGuests) {
      result = result.filter(([pubkey, contact]) => {
        // Always show wallet holders
        if (contact?.kind === 'holder') return true
        // Always show contacts with active conversations (even if guest)
        if (activeConversationPubkeys.has(pubkey.toLowerCase())) return true
        // Hide other guests
        return false
      })
    }

    // Filter by search term
    const term = search.trim().toLowerCase()
    if (term) {
      result = result.filter(([pubkey, contact]) => {
        const name = (
          contact?.nickname ||
          contact?.displayName ||
          contact?.card?.displayName ||
          fallbackNameFromPubKey(pubkey)
        ).toLowerCase()
        const keyLower = pubkey.toLowerCase()
        const safety = contact?.safetyNumber?.toLowerCase() || ''
        return name.includes(term) || keyLower.includes(term) || safety.includes(term)
      })
    }

    return result
  }, [entries, search, showGuests, activeConversationPubkeys])

  const selectedContact = selectedPubKey ? contacts[selectedPubKey] || null : null
  const { identity: selectedIdentity } = useIdentity(selectedPubKey, selectedContact?.kind || 'guest')
  const verifyName = selectedIdentity?.name || (selectedPubKey ? fallbackNameFromPubKey(selectedPubKey) : 'Contact')

  return (
    <div className="flex h-full min-h-[640px] flex-1 overflow-hidden bg-background">
      <div className="flex flex-1 flex-col overflow-hidden">
        <header
          className={cn(
            'border-b border-border/60 bg-background px-6 py-5 transition-all',
            railCollapsed ? 'md:pl-16 md:pr-6' : 'md:px-6'
          )}
        >
          <h2 className="text-lg font-semibold leading-tight">Contacts</h2>
          <p className="text-xs text-muted-foreground">
            Local address book for peers you have chatted with. Nicknames and verification live only on this device.
          </p>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="flex w-full max-w-3xl flex-col gap-6">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 max-w-md">
                  <Input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search contacts"
                    className="h-9 bg-background/60"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    refresh().catch((error) => {
                      console.error('[ContactsPage] Refresh failed', error)
                    })
                  }}
                  disabled={loading}
                >
                  Refresh
                </Button>
              </div>

              {/* Filter and stats row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Wallet className="h-3 w-3" />
                    {contactCounts.wallets} wallet{contactCounts.wallets !== 1 ? 's' : ''}
                  </span>
                  {contactCounts.guests > 0 && (
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {contactCounts.guests} guest{contactCounts.guests !== 1 ? 's' : ''}
                      {!showGuests && (() => {
                        // Count how many guests are actually hidden (not in active conversations)
                        const hiddenCount = entries.filter(([pubkey, contact]) => 
                          contact?.kind !== 'holder' && !activeConversationPubkeys.has(pubkey.toLowerCase())
                        ).length
                        return hiddenCount > 0 ? ` (${hiddenCount} hidden)` : ''
                      })()}
                    </span>
                  )}
                </div>
                {contactCounts.guests > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowGuests(!showGuests)}
                    className="h-7 text-xs gap-1.5"
                  >
                    <Filter className="h-3 w-3" />
                    {showGuests ? 'Hide inactive guests' : 'Show all guests'}
                  </Button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-auto">
              {loading && entries.length === 0 ? (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                  Loading contacts...
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground py-12">
                  <User className="h-12 w-12 text-muted-foreground/30" />
                  {entries.length === 0 ? (
                    <>
                      <p className="font-medium">No contacts yet</p>
                      <p className="max-w-sm text-xs text-muted-foreground">
                        Contacts are created automatically when you exchange messages with someone or verify their safety number. Start a new
                        thread from Messages to populate this list.
                      </p>
                    </>
                  ) : !showGuests && contactCounts.wallets === 0 && activeConversationPubkeys.size === 0 ? (
                    <>
                      <p className="font-medium">No wallet contacts</p>
                      <p className="max-w-sm text-xs text-muted-foreground">
                        You have {contactCounts.guests} guest contact{contactCounts.guests !== 1 ? 's' : ''} without active chats.
                        These are hidden by default since they use ephemeral keys.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowGuests(true)}
                        className="mt-2"
                      >
                        Show all contacts
                      </Button>
                    </>
                  ) : (
                    <>
                      <p className="font-medium">No matching contacts</p>
                      <p className="max-w-sm text-xs text-muted-foreground">
                        Try a different search term.
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  {filtered.map(([pubkey, contact]) => (
                    <ContactRow
                      key={pubkey}
                      pubkey={pubkey}
                      contact={contact}
                      onOpen={setSelectedPubKey}
                      onOpenThread={handleOpenThread}
                      onStartThread={handleStartThread}
                      hasThread={conversations.some((conv) => conv?.peerPublicKey === pubkey)}
                      isBlocked={isInviterBlocked?.(pubkey)}
                      isStartingThread={startingThreadFor === pubkey}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <ContactSheet
          pubkey={selectedPubKey}
          identity={selectedIdentity ? {
            ...selectedIdentity,
            kind: selectedContact?.kind || 'guest',
          } : null}
          open={Boolean(selectedPubKey)}
          onClose={() => setSelectedPubKey(null)}
          onVerify={() => {
            setVerifyOpen(true)
          }}
          isBlocked={selectedPubKey ? isInviterBlocked?.(selectedPubKey) : false}
          onBlock={async () => {
            if (!selectedPubKey) return
            try {
              await blockInviter(selectedPubKey, { source: 'contacts_page' })
            } catch (error) {
              console.error('[ContactsPage] Block failed', error)
            } finally {
              setSelectedPubKey(null)
            }
          }}
          onUnblock={async () => {
            if (!selectedPubKey) return
            try {
              await unblockInviter(selectedPubKey)
            } catch (error) {
              console.error('[ContactsPage] Unblock failed', error)
            } finally {
              setSelectedPubKey(null)
            }
          }}
          onDelete={async () => {
            if (!selectedPubKey) return
            try {
              await remove(selectedPubKey)
              addNotification({
                type: 'success',
                message: 'Contact deleted',
                duration: 3000,
              })
            } catch (error) {
              console.error('[ContactsPage] Delete failed', error)
              addNotification({
                type: 'error',
                message: 'Failed to delete contact',
                duration: 5000,
              })
            } finally {
              setSelectedPubKey(null)
            }
          }}
        />
        <VerifyDialog
          pubkey={selectedPubKey}
          name={verifyName}
          ownPubkey={null}
          ownName="You"
          open={verifyOpen && Boolean(selectedPubKey)}
          onClose={() => setVerifyOpen(false)}
        />
      </div>
    </div>
  )
}
