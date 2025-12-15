import { upsertContact } from '@/lib/identity/contactsStore.js'
import { setProfile } from '@/lib/identity/profileStore.js'

/**
 * Handle profile update control messages from peers.
 * When a peer updates their profile (display name, avatar, etc.),
 * they broadcast it to all active threads so contacts stay in sync.
 */
export async function handleProfileUpdate({
  event,
  threadId,
  receiptsRef,
}) {
  const { displayName, avatarHash, publicKey, updatedAt } = event.payload || {}
  
  if (!publicKey) {
    console.warn('[handleProfileUpdate] Missing publicKey in profile update')
    return
  }

  console.log('[handleProfileUpdate] Received profile update:', {
    publicKey: publicKey.slice(0, 16) + '...',
    displayName,
    avatarHash: avatarHash?.slice(0, 16) || null,
    threadId,
  })

  try {
    // Update the contact with the new profile info
    await upsertContact(publicKey, {
      displayName,
      avatarHash: avatarHash || null,
      profileUpdatedAt: updatedAt || new Date().toISOString(),
      source: 'peer-broadcast',
    })

    // Also store in profile store for future lookups
    await setProfile(publicKey, {
      displayName,
      avatarHash: avatarHash || null,
      updatedAt: updatedAt || new Date().toISOString(),
    })

    console.log('[handleProfileUpdate] Contact and profile updated for:', publicKey.slice(0, 16) + '...')
  } catch (error) {
    console.warn('[handleProfileUpdate] Failed to update contact/profile:', error)
  }
}
