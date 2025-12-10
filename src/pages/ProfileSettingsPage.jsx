import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, User, Camera, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { setHolderProfile, discoverHolderProfile } from '@/lib/identity/certificates.js'
import { getWallet } from '@/lib/wallet/client.js'
import { saveAvatar, getAvatar, deleteAvatar } from '@/lib/identity/profileStore.js'

/**
 * Profile Settings Page for Wallet Holders
 *
 * Allows holders to set their display name in a local profile store.
 * This profile is keyed by the wallet identity key and used when resolving identities.
 */
const MAX_AVATAR_SIZE = 512 * 1024 // 512KB max
const AVATAR_DIMENSION = 256 // Resize to 256x256

export default function ProfileSettingsPage() {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const [displayName, setDisplayName] = useState('')
  const [about, setAbout] = useState('')
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [avatarHash, setAvatarHash] = useState(null)
  const [currentProfile, setCurrentProfile] = useState(null)
  const [myPubKey, setMyPubKey] = useState(null)
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

        // Get wallet and current identity key
        const { client: wallet } = await getWallet()
        const pubKeyResult = await wallet.getPublicKey({ identityKey: true })
        const pubKey = typeof pubKeyResult === 'string'
          ? pubKeyResult
          : pubKeyResult?.publicKey

        if (!pubKey || typeof pubKey !== 'string') {
          throw new Error('Wallet did not return identity public key')
        }

        setMyPubKey(pubKey)

        // Try to discover existing profile
        const profile = await discoverHolderProfile(pubKey)
        if (profile && profile.fields) {
          setCurrentProfile(profile)
          setDisplayName(profile.fields.displayName || '')
          setAbout(profile.fields.about || '')
          setAvatarHash(profile.fields.avatarHash || null)
        }

        // Load avatar if exists
        const avatar = await getAvatar(pubKey)
        if (avatar?.dataUrl) {
          setAvatarUrl(avatar.dataUrl)
        }
      } catch (err) {
        console.error('[ProfileSettings] Failed to load profile:', err)
        setError('Failed to load profile. Make sure your wallet is connected.')
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [])

  // Resize image to target dimensions (center-crop to square)
  const resizeImage = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = canvas.height = AVATAR_DIMENSION
        const ctx = canvas.getContext('2d')
        const size = Math.min(img.width, img.height)
        const x = (img.width - size) / 2, y = (img.height - size) / 2
        ctx.drawImage(img, x, y, size, size, 0, 0, AVATAR_DIMENSION, AVATAR_DIMENSION)
        resolve(canvas.toDataURL('image/jpeg', 0.85))
      }
      img.onerror = reject
      img.src = e.target.result
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

  const handleAvatarSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }

    if (file.size > MAX_AVATAR_SIZE * 4) { // Allow larger before resize
      setError('Image too large. Please select an image under 2MB.')
      return
    }

    try {
      setError(null)
      const resizedDataUrl = await resizeImage(file)
      setAvatarUrl(resizedDataUrl)
      
      // Save avatar and get hash
      if (myPubKey) {
        const hash = await saveAvatar(myPubKey, resizedDataUrl)
        setAvatarHash(hash)
      }
    } catch (err) {
      console.error('[ProfileSettings] Failed to process avatar:', err)
      setError('Failed to process image')
    }
  }

  const handleAvatarRemove = async () => {
    if (myPubKey) {
      await deleteAvatar(myPubKey)
    }
    setAvatarUrl(null)
    setAvatarHash(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleSave = async () => {
    if (!displayName.trim()) {
      setError('Display name is required')
      return
    }

    if (displayName.length > 50) {
      setError('Display name must be 50 characters or less')
      return
    }

    if (about.length > 160) {
      setError('About must be 160 characters or less')
      return
    }

    try {
      setSaving(true)
      setError(null)
      setSuccess(false)

      await setHolderProfile(displayName.trim(), {
        about: about.trim() || null,
        avatarHash: avatarHash || null,
      })

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)

      // Reload profile to confirm
      const profile = await discoverHolderProfile(myPubKey)
      if (profile) {
        setCurrentProfile(profile)
      }
    } catch (err) {
      console.error('[ProfileSettings] Failed to save profile:', err)
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
            <h1 className="text-lg font-semibold">Profile Settings</h1>
            <p className="text-xs text-muted-foreground">Manage your holder identity</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-2xl space-y-6">
          {/* Avatar Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Avatar
              </CardTitle>
              <CardDescription>
                Add a profile picture. It will be stored locally and included in your backups.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-sm text-muted-foreground">Loading...</div>
              ) : (
                <div className="flex items-center gap-4">
                  <div className="relative">
                    {avatarUrl ? (
                      <div className="relative">
                        <img
                          src={avatarUrl}
                          alt="Avatar"
                          className="h-20 w-20 rounded-full object-cover border-2 border-muted"
                        />
                        <button
                          onClick={handleAvatarRemove}
                          className="absolute -top-1 -right-1 rounded-full bg-destructive p-1 text-destructive-foreground hover:bg-destructive/90"
                          title="Remove avatar"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted border-2 border-dashed border-muted-foreground/30">
                        <User className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarSelect}
                      className="hidden"
                      id="avatar-upload"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={saving}
                    >
                      <Camera className="mr-2 h-4 w-4" />
                      {avatarUrl ? 'Change Photo' : 'Upload Photo'}
                    </Button>
                    <p className="mt-1 text-xs text-muted-foreground">
                      JPG, PNG or GIF. Will be resized to 256×256.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Profile Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Display Name
              </CardTitle>
              <CardDescription>
                Your display name is shown to other participants in threads.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <div className="text-sm text-muted-foreground">Loading profile...</div>
              ) : (
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
              )}
            </CardContent>
          </Card>

          {/* About Card */}
          <Card>
            <CardHeader>
              <CardTitle>About</CardTitle>
              <CardDescription>
                A short bio or status message. Keep it brief.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-sm text-muted-foreground">Loading...</div>
              ) : (
                <div className="space-y-2">
                  <Textarea
                    id="about"
                    value={about}
                    onChange={(e) => setAbout(e.target.value)}
                    placeholder="Tell others a bit about yourself..."
                    maxLength={160}
                    disabled={saving}
                    rows={3}
                    className="resize-none"
                  />
                  <p className="text-xs text-muted-foreground">
                    {about.length}/160 characters
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Status Messages */}
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

          {/* Save Button */}
          {!loading && (
            <Button
              onClick={handleSave}
              disabled={saving || !displayName.trim()}
              className="w-full"
              size="lg"
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
          )}

          {/* Current Profile Info */}
          {currentProfile && (
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs font-medium text-muted-foreground">Current Profile</p>
                <p className="mt-1 text-sm">{currentProfile.fields.displayName}</p>
                {currentProfile.fields.about && (
                  <p className="mt-1 text-sm text-muted-foreground">{currentProfile.fields.about}</p>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  Stored locally on this device (keyed by your wallet identity key).
                </p>
                {currentProfile.fields.updatedAt && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Updated: {new Date(currentProfile.fields.updatedAt).toLocaleString()}
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  )
}
