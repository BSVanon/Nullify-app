/**
 * VerifyDialog Component
 * 
 * Modal for manual safety number verification (compare via QR or manual entry).
 */

import React, { useState, useEffect } from 'react'
import QRCode from 'qrcode'
import { X, Copy, Check, CheckCircle2 } from 'lucide-react'
import { safetyNumber, compareSafetyNumbers } from '../../lib/identity/safetyNumber.js'
import { useContacts } from '../../hooks/identity/useContacts.js'
import { setProfile } from '../../lib/identity/profileStore.js'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

export function VerifyDialog({ pubkey, name, onClose, open = true, ownPubkey, ownName = 'You', inviteProfile = null }) {
  const { upsert } = useContacts()
  const [manualInput, setManualInput] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [copiedOwn, setCopiedOwn] = useState(false)
  const [qrDataUrlOwn, setQrDataUrlOwn] = useState(null)

  // Debug: Log inviteProfile when dialog opens
  useEffect(() => {
    if (open && inviteProfile) {
      console.log('[VerifyDialog] Opened with inviteProfile:', inviteProfile)
    } else if (open) {
      console.log('[VerifyDialog] Opened without inviteProfile')
    }
  }, [open, inviteProfile])

  // Generate safety numbers
  const safetyTheirs = pubkey ? safetyNumber(pubkey) : null
  const safetyOwn = ownPubkey ? safetyNumber(ownPubkey) : null

  // Generate QR code for the local safety number
  useEffect(() => {
    async function generateQR() {
      try {
        if (safetyOwn) {
          const dataUrlOwn = await QRCode.toDataURL(safetyOwn, {
            width: 180,
            margin: 2,
            color: { dark: '#000000', light: '#FFFFFF' }
          })
          setQrDataUrlOwn(dataUrlOwn)
        } else {
          setQrDataUrlOwn(null)
        }
      } catch (err) {
        console.error('[VerifyDialog] Failed to generate QR code:', err)
      }
    }
    generateQR()
  }, [safetyOwn])

  if (!pubkey || !open) {
    return null
  }

  const handleCopyOwn = async () => {
    try {
      await navigator.clipboard.writeText(safetyOwn)
      setCopiedOwn(true)
      setTimeout(() => setCopiedOwn(false), 2000)
    } catch (err) {
      console.error('[VerifyDialog] Failed to copy own:', err)
    }
  }

  const handleVerify = async () => {
    // Normalize for comparison: remove all whitespace
    const normalizedInput = manualInput.replace(/\s+/g, '')
    const normalizedTheirs = safetyTheirs?.replace(/\s+/g, '') || ''
    
    console.log('[VerifyDialog] VERIFY BUTTON CLICKED', {
      pubkey: pubkey?.slice(0, 16) + '...',
      manualInputRaw: manualInput,
      manualInputNormalized: normalizedInput,
      safetyTheirsRaw: safetyTheirs,
      safetyTheirsNormalized: normalizedTheirs,
      lengthInput: normalizedInput.length,
      lengthTheirs: normalizedTheirs.length,
      areEqual: normalizedInput === normalizedTheirs,
    })
    
    if (!manualInput.trim()) {
      setError('Please enter the safety number from ' + name + ' to verify')
      return
    }

    setVerifying(true)
    setError(null)

    try {
      const matches = compareSafetyNumbers(safetyTheirs, manualInput)
      
      console.log('[VerifyDialog] Safety numbers match:', matches, {
        safetyTheirs,
        manualInput,
      })
      
      if (matches) {
        // Mark contact as verified and persist the verified safety number snapshot
        const contactUpdate = {
          verified: true,
          verifiedSafetyNumber: safetyTheirs,
          verifiedAt: new Date().toISOString()
        }
        
        console.log('[VerifyDialog] Marking contact as verified, inviteProfile:', inviteProfile)
        
        // Auto-populate profile from invite if provided
        if (inviteProfile && inviteProfile.displayName) {
          contactUpdate.displayName = inviteProfile.displayName
          contactUpdate.avatarHash = inviteProfile.avatarHash || null
          contactUpdate.source = 'verified-profile'
          
          console.log('[VerifyDialog] Adding profile to contact update:', contactUpdate)
          
          // Also store in profile store for future lookups
          try {
            await setProfile(pubkey, {
              displayName: inviteProfile.displayName,
              avatarHash: inviteProfile.avatarHash
            })
            console.log('[VerifyDialog] Auto-populated profile from invite:', inviteProfile.displayName)
          } catch (profileErr) {
            console.warn('[VerifyDialog] Failed to store profile:', profileErr)
          }
        }
        
        console.log('[VerifyDialog] Upserting contact with:', contactUpdate)
        await upsert(pubkey, contactUpdate)
        console.log('[VerifyDialog] Contact upserted successfully')
        setSuccess(true)
        setTimeout(() => {
          onClose()
        }, 1500)
      } else {
        // De-verify: safety numbers don't match
        console.log('[VerifyDialog] Safety numbers DO NOT match - marking as unverified')
        await upsert(pubkey, { verified: false })
        setError('Safety numbers do not match. Contact marked as unverified.')
      }
    } catch (err) {
      setError('Verification failed: ' + err.message)
    } finally {
      setVerifying(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-[2000] bg-black/50" 
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Dialog */}
      <div className="fixed left-1/2 top-1/2 z-[2001] flex w-full max-w-[900px] -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg bg-background shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-4">
          <h2 className="text-lg font-semibold">Verify Identity</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="max-h-[75vh] overflow-y-auto p-6">
          <p className="mb-6 text-sm text-muted-foreground">
            Exchange your safety numbers with <strong>{name}</strong> by sending them through a trusted channel (such as secure messaging
            or a screenshot) instead of this app for added security. Your safety number is listed below, and <strong>{name}</strong> has a
            different one. Share numbers and enter <strong>{name}</strong>'s safety number in the confirmation box below. If anything about
            their identity changes, their safety number will change and you should verify again. If this safety number ever changes on this
            device, you'll see a security warning in this chat and should verify again.
          </p>

          {/* Your Safety Number */}
          <div className="mb-6 rounded-lg border border-border p-4">
            <h3 className="mb-3 text-base font-semibold text-foreground">Your Safety Number</h3>

            {/* Your Number */}
            <div className="relative mb-4 rounded-lg bg-muted p-3">
              <div className="break-all font-mono text-[11px] leading-relaxed">
                {safetyOwn || 'Not available'}
              </div>
              {safetyOwn && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyOwn}
                  className="absolute right-2 top-2 h-7 w-7 p-0"
                  title="Copy your safety number"
                >
                  {copiedOwn ? (
                    <Check className="h-3 w-3 text-green-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              )}
            </div>

            {/* Your QR Code */}
            <div className="flex justify-center rounded-lg border border-border bg-white p-3">
              {qrDataUrlOwn ? (
                <img src={qrDataUrlOwn} alt="Your Safety Number QR" className="h-[180px] w-[180px]" />
              ) : (
                <div className="flex h-[180px] w-[180px] items-center justify-center text-xs text-muted-foreground">
                  {safetyOwn ? 'Generating...' : 'Not available'}
                </div>
              )}
            </div>
            <p className="mt-2 text-xs text-muted-foreground text-center">
              Show this QR to {name} so they can scan and confirm.
            </p>
          </div>

          {/* Manual Verification Input */}
          <div className="mt-6">
            <h3 className="mb-2 text-sm font-semibold">Confirm Verification</h3>
            <p className="mb-2 text-sm text-muted-foreground">
              After comparing numbers, enter what {name} told you to confirm:
            </p>
            <Textarea
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder={`Paste or type ${name}'s safety number here`}
              rows={3}
              className="font-mono text-xs"
            />
            {error && (
              <div className="mt-2 rounded-lg border border-destructive bg-destructive/10 p-3">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}
            {success && (
              <div className="mt-2 rounded-lg border border-green-500 bg-green-500/10 p-3">
                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Safety number verified! Identity confirmed.</span>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              onClick={handleVerify}
              disabled={verifying || !manualInput.trim() || success}
              className="flex-1"
            >
              {verifying ? 'Verifying...' : success ? 'Verified!' : 'Verify'}
            </Button>
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              {success ? 'Done' : 'Skip for Now'}
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
