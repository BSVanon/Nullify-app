/**
 * Profile Management
 * 
 * Provides helpers for setting and retrieving user profile data.
 * Profiles are stored locally and shared via thread invites.
 */

import { getWallet } from '../wallet/client.js'
import { getProfile, setProfile } from './profileStore.js'

/**
 * Set the holder's profile
 * @param {string} displayName - User's display name
 * @param {Object} [options] - Additional profile options
 * @param {string} [options.about] - Short bio/about text
 * @param {string} [options.avatarHash] - SHA256 hash of avatar
 * @returns {Promise<void>}
 */
export async function setHolderProfile(displayName, options = {}) {
  if (!displayName || typeof displayName !== 'string') {
    throw new Error('displayName is required and must be a string')
  }

  const { about = null, avatarHash = null } = options

  const { client: wallet } = await getWallet()

  // Get our identity key to use as storage key
  const identityKeyResult = await wallet.getPublicKey({ identityKey: true })
  const identityKey = typeof identityKeyResult === 'string'
    ? identityKeyResult
    : identityKeyResult?.publicKey

  if (!identityKey || typeof identityKey !== 'string') {
    throw new Error('Wallet did not return identity public key')
  }

  console.log('[profiles] Setting profile:', { displayName, hasAbout: Boolean(about), avatarHash })

  try {
    await setProfile(identityKey, {
      displayName,
      about,
      avatarHash
    })
    console.log('[profiles] Profile saved successfully')
  } catch (error) {
    console.error('[profiles] Failed to save profile:', error)
    throw new Error(`Failed to set profile: ${error.message}`)
  }
}

/**
 * Get a holder's profile by their identity key
 * @param {string} pubkey - Hex-encoded public key
 * @returns {Promise<Object|null>} Profile object or null if not found
 */
export async function discoverHolderProfile(pubkey) {
  if (!pubkey || typeof pubkey !== 'string') {
    throw new Error('pubkey is required and must be a string')
  }

  try {
    console.log('[profiles] Looking up profile for:', pubkey.slice(0, 16) + '...')
    
    const profile = await getProfile(pubkey)
    
    if (profile) {
      console.log('[profiles] Profile found:', {
        displayName: profile.displayName,
        hasAbout: Boolean(profile.about)
      })
      // Return in certificate-like format for compatibility
      return {
        type: 'Nullify.Profile',
        fields: {
          displayName: profile.displayName,
          about: profile.about,
          avatarHash: profile.avatarHash,
          updatedAt: profile.updatedAt
        },
        certifier: pubkey,
        subject: pubkey
      }
    }
    
    console.log('[profiles] No profile found for pubkey')
    return null
  } catch (error) {
    console.error('[profiles] Failed to lookup profile:', error)
    return null
  }
}

/**
 * Check if a profile is verified (via safety number verification)
 * This is determined by the contact's verified flag, not the profile itself.
 * @param {Object} certificate - Profile object (for compatibility)
 * @returns {boolean}
 */
export function isCertificateVerified(certificate) {
  // Profiles are always self-attested
  // Verification happens via safety number check in contacts store
  return false
}
