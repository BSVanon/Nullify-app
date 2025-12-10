import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { signProfileCard } from '@/lib/identity/profileCard.js'
import { getContact, upsertContact } from '@/lib/identity/contactsStore.js'

/**
 * Guest Profile Page
 * 
 * Allows guests to create and sign a ProfileCard with their display name.
 * The ProfileCard can be distributed to other users via overlay.
 */
export default function GuestProfilePage() {
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState('')
  const [guestPubKey, setGuestPubKey] = useState(null)
  const [currentCard, setCurrentCard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  // Load current profile on mount
  useEffect(() => {
    async function loadProfile() {
      try {
        setLoading(true)
        setError(null)

        // TODO: Get guest's ephemeral public key from guest session
        // For now, we'll need to integrate with the guest thread system
        // This is a placeholder - needs actual guest key retrieval
        const mockGuestKey = 'guest_key_placeholder'
        setGuestPubKey(mockGuestKey)

        // Try to load existing ProfileCard from contacts
        const contact = getContact(mockGuestKey)
        if (contact?.card) {
          setCurrentCard(contact.card)
          setDisplayName(contact.card.displayName || '')
        }
      } catch (err) {
        console.error('[GuestProfile] Failed to load profile:', err)
        setError('Failed to load profile.')
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [])

  const handleSave = async () => {
    if (!displayName.trim()) {
      setError('Display name is required')
      return
    }

    if (displayName.length > 50) {
      setError('Display name must be 50 characters or less')
      return
    }

    if (!guestPubKey || guestPubKey === 'guest_key_placeholder') {
      setError('Guest session not initialized. Please join a thread first.')
      return
    }

    try {
      setSaving(true)
      setError(null)
      setSuccess(false)

      // TODO: Get actual signing function from guest session
      // This is a placeholder - needs actual guest key signing
      const mockSignFn = async (bytes) => {
        // In real implementation, this would use the guest's ephemeral private key
        return new Uint8Array(64) // Mock signature
      }

      const card = await signProfileCard(
        {
          displayName: displayName.trim(),
          colorSeed: Math.floor(Math.random() * 1000)
        },
        mockSignFn,
        guestPubKey
      )

      // Save to contacts store
      await upsertContact(guestPubKey, { card })
      setCurrentCard(card)

      // TODO: Distribute via overlay profile.update envelope
      // This would send the ProfileCard to all active threads

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      console.error('[GuestProfile] Failed to save profile:', err)
      setError(err.message || 'Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="border-b border-muted-foreground/20 bg-background/80 px-4 py-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/settings')}
            className="h-10 w-10"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold">Guest Profile</h1>
            <p className="text-xs text-muted-foreground">Set your display name</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-2xl space-y-6">
          {/* Profile Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Display Name
              </CardTitle>
              <CardDescription>
                Your display name is stored in a signed ProfileCard and can be shared with your contacts.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <div className="text-sm text-muted-foreground">Loading profile...</div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="displayName">Display Name</Label>
                    <Input
                      id="displayName"
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Enter your display name"
                      maxLength={50}
                      disabled={saving}
                    />
                    <p className="text-xs text-muted-foreground">
                      {displayName.length}/50 characters
                    </p>
                  </div>

                  {currentCard && (
                    <div className="rounded-lg border border-muted-foreground/20 bg-muted/10 p-3">
                      <p className="text-xs font-medium text-muted-foreground">Current Profile</p>
                      <p className="mt-1 text-sm">{currentCard.displayName}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Signed: {new Date(currentCard.since).toLocaleString()}
                      </p>
                    </div>
                  )}

                  {error && (
                    <div className="rounded-lg border border-destructive bg-destructive/10 p-3">
                      <p className="text-sm text-destructive">{error}</p>
                    </div>
                  )}

                  {success && (
                    <div className="rounded-lg border border-green-500 bg-green-500/10 p-3">
                      <p className="text-sm text-green-600 dark:text-green-400">
                        Profile saved successfully!
                      </p>
                    </div>
                  )}

                  <Button
                    onClick={handleSave}
                    disabled={saving || !displayName.trim()}
                    className="w-full"
                  >
                    {saving ? (
                      <>Saving...</>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save Profile
                      </>
                    )}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* Info Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">About Guest Profiles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                • Your ProfileCard is signed with your ephemeral guest key
              </p>
              <p>
                • It can be shared with your contacts via the overlay network
              </p>
              <p>
                • Guests cannot discover certificates (wallet holders only)
              </p>
              <p>
                • You can upgrade to a wallet holder to get a BRC-100 certificate
              </p>
            </CardContent>
          </Card>

          {/* Upgrade prompt */}
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-base">Upgrade to Wallet Holder</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                As a guest, your settings are temporary and won't persist across sessions.
              </p>
              <p>
                Connect a wallet to unlock:
              </p>
              <ul className="ml-4 list-disc space-y-1">
                <li>Persistent profile settings</li>
                <li>Create and manage your own threads</li>
                <li>Cloud backup and recovery</li>
                <li>Full identity verification</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
