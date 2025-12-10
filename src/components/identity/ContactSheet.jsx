/**
 * ContactSheet Component
 * 
 * Side panel for viewing and managing contact details.
 */

import React, { useState, useEffect } from 'react'
import { Trash2, Edit3 } from 'lucide-react'
import { Avatar } from './Avatar.jsx'
import { safetyNumber } from '../../lib/identity/safetyNumber.js'
import { upsertContact } from '../../lib/identity/contactsStore.js'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export default function ContactSheet({ pubkey, identity: initialIdentity, onClose, onVerify, onBlock, onUnblock, onDelete, isBlocked = false, open = false }) {
  const [isEditingNickname, setIsEditingNickname] = useState(false)
  const [nickname, setNickname] = useState('')
  const [identity, setIdentity] = useState(initialIdentity)

  // Update identity when prop changes
  useEffect(() => {
    setIdentity(initialIdentity)
  }, [initialIdentity])

  // Don't render if closed
  if (!open) {
    return null
  }

  // Show error state if missing required data
  if (!pubkey || !identity) {
    return (
      <>
        <div 
          className="fixed inset-0 z-[999] bg-black/50" 
          onClick={onClose}
          aria-hidden="true"
        />
        <div className="fixed right-0 top-0 bottom-0 z-[1000] flex w-full max-w-[400px] flex-col bg-background shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-4 py-4">
            <h2 className="text-lg font-semibold">Contact Details</h2>
            <button 
              onClick={onClose} 
              className="text-2xl leading-none hover:opacity-70 transition-opacity"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="rounded-lg border border-muted-foreground/20 bg-muted/10 p-6 text-center">
              <p className="text-sm text-muted-foreground">
                Contact information not available for this thread.
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                This may be an older thread created before identity tracking was implemented.
              </p>
            </div>
          </div>
        </div>
      </>
    )
  }

  const isVerified = identity.verified
  const source = identity.source

  const handleSetNickname = async () => {
    try {
      const newNickname = nickname.trim() || null
      await upsertContact(pubkey, { nickname: newNickname })
      
      // Update local identity state immediately
      setIdentity({
        ...identity,
        name: newNickname || identity.name,
        source: newNickname ? 'nickname' : identity.source
      })
      
      setIsEditingNickname(false)
      setNickname('')
    } catch (error) {
      console.error('[ContactSheet] Failed to set nickname:', error)
      alert('Failed to set nickname')
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-[999] bg-black/50" 
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Sheet */}
      <div className="fixed right-0 top-0 bottom-0 z-[1000] flex w-full max-w-[400px] flex-col bg-background shadow-lg">
        <div className="flex items-center justify-between border-b border-border px-4 py-4">
          <h2 className="text-lg font-semibold">Contact Details</h2>
          <button 
            onClick={onClose} 
            className="text-2xl leading-none hover:opacity-70 transition-opacity"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {/* Avatar and Name */}
          <div className="mb-6 flex flex-col items-center">
          <Avatar 
            name={identity.name}
            colorSeed={identity.colorSeed}
            avatarHash={identity.avatar}
            pubkey={pubkey}
            size={80}
          />
          <h3 className="mt-3 mb-2 text-xl font-semibold">{identity.name}</h3>
          <div className="flex flex-wrap justify-center gap-2">
            {isVerified && (
              <span className="flex items-center gap-1 rounded-full bg-green-500 px-3 py-1 text-xs font-medium text-white">
                <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Verified
              </span>
            )}
            {source === 'certificate' && (
              <span className="flex items-center gap-1 rounded-full bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 border border-blue-500/20">
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                BRC-100 Certificate
              </span>
            )}
            {source === 'profileCard' && (
              <span className="flex items-center gap-1 rounded-full bg-purple-500/10 px-3 py-1 text-xs font-medium text-purple-600 dark:text-purple-400 border border-purple-500/20">
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                </svg>
                Guest ProfileCard
              </span>
            )}
            {source === 'nickname' && (
              <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-600 dark:text-amber-400 border border-amber-500/20">
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                Custom Nickname
              </span>
            )}
            {source === 'fallback' && (
              <span className="flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground border border-muted-foreground/20">
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Generated Name
              </span>
            )}
          </div>
        </div>

          {/* Identity Source Info */}
          {source === 'certificate' && (
          <div className="mb-6 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
            <p className="text-xs text-muted-foreground">
              <strong className="text-blue-600 dark:text-blue-400">BRC-100 Certificate:</strong> This identity is stored in the holder's wallet and cryptographically verifiable. Other wallet holders can discover this name automatically.
            </p>
          </div>
        )}
        {source === 'profileCard' && (
          <div className="mb-6 rounded-lg border border-purple-500/20 bg-purple-500/5 p-3">
            <p className="text-xs text-muted-foreground">
              <strong className="text-purple-600 dark:text-purple-400">Guest ProfileCard:</strong> This identity was signed by the guest's ephemeral key. It's not backed by a wallet but is cryptographically signed.
            </p>
          </div>
        )}
        {source === 'fallback' && (
          <div className="mb-6 rounded-lg border border-muted-foreground/20 bg-muted/5 p-3">
            <p className="text-xs text-muted-foreground">
              <strong>Generated name:</strong> This contact hasn't chosen a name yet. We've given them a stable placeholder so you can recognize them. You can set a nickname anytime.
            </p>
          </div>
          )}

          {/* Verify Identity */}
          <div className="mb-6">
          <h4 className="mb-2 text-sm font-semibold text-muted-foreground">Verify Identity</h4>
          <p className="mb-3 text-xs text-muted-foreground">
            Use safety numbers to confirm this contact really is who they say they are.
            Your device will show <span className="font-semibold">your</span> safety number; ask {identity.name} to send you
            the number they see on their own device (for example by screenshot or secure message) and make sure they match.
          </p>
          <button 
            onClick={onVerify}
            className="w-full rounded border border-border bg-background px-4 py-2 text-sm hover:bg-muted transition-colors"
          >
            {isVerified ? 'Re-verify' : 'Verify Identity'}
          </button>
          </div>

          {/* Nickname */}
          <div className="mb-6">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-muted-foreground">Nickname</h4>
            {identity?.source === 'nickname' && !isEditingNickname && (
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  try {
                    await upsertContact(pubkey, { nickname: null })
                    
                    // Update local identity state immediately
                    setIdentity({
                      ...identity,
                      source: 'fallback'
                    })
                  } catch (error) {
                    console.error('[ContactSheet] Failed to clear nickname:', error)
                  }
                }}
                className="h-7 text-xs text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="mr-1 h-3 w-3" />
                Clear
              </Button>
            )}
          </div>
          {isEditingNickname ? (
            <div className="flex flex-col gap-2">
              <Input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Enter nickname"
                maxLength={30}
                autoFocus
              />
              <div className="flex gap-2">
                <Button
                  onClick={handleSetNickname}
                  className="flex-1"
                >
                  Save
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEditingNickname(false)
                    setNickname('')
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              onClick={() => setIsEditingNickname(true)}
              className="w-full justify-start"
            >
              <Edit3 className="mr-2 h-4 w-4" />
              {identity?.source === 'nickname' ? 'Edit Nickname' : 'Set Nickname'}
            </Button>
          )}
        </div>
      </div>

      {/* Contact Type Info */}
      {identity?.kind && (
        <div className="border-t border-border px-4 py-3">
          {identity.kind === 'holder' ? (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
              <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-1">
                Wallet Contact
              </p>
              <p className="text-xs text-muted-foreground">
                This contact has a linked wallet. You can send them thread invites directly via MessageBox, and they can reconnect with you across threads.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
              <p className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-1">
                Guest Contact
              </p>
              <p className="text-xs text-muted-foreground">
                This is a guest identity (ephemeral key). Guest contacts cannot receive direct invites and may not be reachable after the thread ends. Consider encouraging them to link a wallet.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Actions footer */}
      <div className="border-t border-border px-4 py-3 space-y-2">
        {isBlocked ? (
          <Button
            variant="outline"
            size="sm"
            onClick={onUnblock}
            className="w-full"
          >
            Unblock contact
          </Button>
        ) : (
          <Button
            variant="destructive"
            size="sm"
            onClick={onBlock}
            className="w-full"
            disabled={!onBlock}
          >
            Block Contact
          </Button>
        )}
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (window.confirm(`Delete ${identity?.name || 'this contact'} from your contacts? This cannot be undone.`)) {
              onDelete?.()
            }
          }}
          className="w-full text-muted-foreground hover:text-destructive"
          disabled={!onDelete}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete Contact
        </Button>
      </div>
    </div>
    </>
  )
}
