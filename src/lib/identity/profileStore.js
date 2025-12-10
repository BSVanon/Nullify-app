/**
 * Profile Storage
 * 
 * Manages user profile data (display names, avatars) in localforage.
 * Profiles are keyed by identity public key and persist across sessions.
 */

import localforage from 'localforage'

const PROFILES_KEY = 'nukenote:profiles'
const AVATARS_KEY = 'nukenote:avatars'

// Initialize localforage instance for profiles
const profileStore = localforage.createInstance({
  name: 'NukeNote',
  storeName: 'profiles',
  description: 'User profile data (display names, about, avatars)'
})

// Separate store for avatar binary data (base64)
const avatarStore = localforage.createInstance({
  name: 'NukeNote',
  storeName: 'avatars',
  description: 'Avatar image data'
})

/**
 * Load all profiles from storage
 * @returns {Promise<Object>} Map of pubkey -> profile
 */
async function loadProfiles() {
  try {
    const profiles = await profileStore.getItem(PROFILES_KEY)
    return profiles || {}
  } catch (error) {
    console.error('[profileStore] Failed to load profiles:', error)
    return {}
  }
}

/**
 * Save all profiles to storage
 * @param {Object} profiles - Map of pubkey -> profile
 * @returns {Promise<void>}
 */
async function saveProfiles(profiles) {
  try {
    await profileStore.setItem(PROFILES_KEY, profiles)
  } catch (error) {
    console.error('[profileStore] Failed to save profiles:', error)
    throw error
  }
}

/**
 * Get profile for a specific public key
 * @param {string} pubkey - Hex-encoded public key
 * @returns {Promise<Object|null>} Profile object or null
 */
export async function getProfile(pubkey) {
  if (!pubkey || typeof pubkey !== 'string') {
    throw new Error('pubkey is required and must be a string')
  }

  const profiles = await loadProfiles()
  return profiles[pubkey] || null
}

/**
 * Set profile for a specific public key
 * @param {string} pubkey - Hex-encoded public key
 * @param {Object} profile - Profile data
 * @param {string} profile.displayName - User's display name
 * @param {string} [profile.about] - Short bio/about text (optional)
 * @param {string} [profile.avatarHash] - SHA256 hash of avatar (optional)
 * @returns {Promise<Object>} Updated profile
 */
export async function setProfile(pubkey, profile) {
  if (!pubkey || typeof pubkey !== 'string') {
    throw new Error('pubkey is required and must be a string')
  }
  if (!profile || typeof profile !== 'object') {
    throw new Error('profile is required and must be an object')
  }
  if (!profile.displayName || typeof profile.displayName !== 'string') {
    throw new Error('profile.displayName is required and must be a string')
  }

  const profiles = await loadProfiles()
  
  const updated = {
    displayName: profile.displayName.trim(),
    about: profile.about?.trim() || null,
    avatarHash: profile.avatarHash || null,
    updatedAt: new Date().toISOString()
  }

  profiles[pubkey] = updated
  await saveProfiles(profiles)

  console.log('[profileStore] Profile saved:', {
    pubkey: pubkey.slice(0, 16) + '...',
    displayName: updated.displayName,
    hasAbout: Boolean(updated.about),
    hasAvatar: Boolean(updated.avatarHash)
  })

  return updated
}

/**
 * Delete profile for a specific public key
 * @param {string} pubkey - Hex-encoded public key
 * @returns {Promise<boolean>} True if deleted, false if not found
 */
export async function deleteProfile(pubkey) {
  if (!pubkey || typeof pubkey !== 'string') {
    throw new Error('pubkey is required and must be a string')
  }

  const profiles = await loadProfiles()
  
  if (!profiles[pubkey]) {
    return false
  }

  delete profiles[pubkey]
  await saveProfiles(profiles)

  console.log('[profileStore] Profile deleted:', pubkey.slice(0, 16) + '...')
  return true
}

/**
 * Get all profiles
 * @returns {Promise<Object>} Map of pubkey -> profile
 */
export async function getAllProfiles() {
  return loadProfiles()
}

/**
 * Export all profiles as JSON (for backup)
 * @returns {Promise<string>} JSON string of all profiles
 */
export async function exportProfiles() {
  const profiles = await loadProfiles()
  return JSON.stringify(profiles, null, 2)
}

/**
 * Import profiles from JSON (for restore)
 * @param {string} json - JSON string of profiles
 * @param {boolean} merge - If true, merge with existing. If false, replace all.
 * @returns {Promise<number>} Number of profiles imported
 */
export async function importProfiles(json, merge = true) {
  if (!json || typeof json !== 'string') {
    throw new Error('json is required and must be a string')
  }

  let imported
  try {
    imported = JSON.parse(json)
  } catch (error) {
    throw new Error('Invalid JSON: ' + error.message)
  }

  if (!imported || typeof imported !== 'object') {
    throw new Error('Imported data must be an object')
  }

  const profiles = merge ? await loadProfiles() : {}
  let count = 0

  for (const [pubkey, profile] of Object.entries(imported)) {
    if (profile && typeof profile === 'object' && profile.displayName) {
      profiles[pubkey] = {
        displayName: profile.displayName,
        about: profile.about || null,
        avatarHash: profile.avatarHash || null,
        updatedAt: profile.updatedAt || new Date().toISOString()
      }
      count++
    }
  }

  await saveProfiles(profiles)
  console.log(`[profileStore] Imported ${count} profiles (merge: ${merge})`)
  
  return count
}

/**
 * Clear all profiles (use with caution!)
 * @returns {Promise<void>}
 */
export async function clearAllProfiles() {
  await saveProfiles({})
  console.log('[profileStore] All profiles cleared')
}

// ============================================================================
// Avatar Storage Functions
// ============================================================================

/**
 * Save avatar image data for a public key
 * @param {string} pubkey - Hex-encoded public key
 * @param {string} dataUrl - Base64 data URL of the image
 * @returns {Promise<string>} SHA256 hash of the avatar
 */
export async function saveAvatar(pubkey, dataUrl) {
  if (!pubkey || typeof pubkey !== 'string') {
    throw new Error('pubkey is required')
  }
  if (!dataUrl || typeof dataUrl !== 'string') {
    throw new Error('dataUrl is required')
  }

  // Compute hash for the avatar
  const encoder = new TextEncoder()
  const data = encoder.encode(dataUrl)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = new Uint8Array(hashBuffer)
  const hash = Array.from(hashArray)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  await avatarStore.setItem(pubkey, {
    dataUrl,
    hash,
    updatedAt: new Date().toISOString()
  })

  console.log('[profileStore] Avatar saved:', {
    pubkey: pubkey.slice(0, 16) + '...',
    hash: hash.slice(0, 16) + '...'
  })

  return hash
}

/**
 * Get avatar image data for a public key
 * @param {string} pubkey - Hex-encoded public key
 * @returns {Promise<{dataUrl: string, hash: string}|null>}
 */
export async function getAvatar(pubkey) {
  if (!pubkey || typeof pubkey !== 'string') {
    return null
  }

  try {
    return await avatarStore.getItem(pubkey)
  } catch {
    return null
  }
}

/**
 * Delete avatar for a public key
 * @param {string} pubkey - Hex-encoded public key
 * @returns {Promise<void>}
 */
export async function deleteAvatar(pubkey) {
  if (!pubkey || typeof pubkey !== 'string') {
    return
  }

  try {
    await avatarStore.removeItem(pubkey)
    console.log('[profileStore] Avatar deleted:', pubkey.slice(0, 16) + '...')
  } catch {
    // ignore
  }
}

/**
 * Get all avatars (for backup)
 * @returns {Promise<Object>} Map of pubkey -> avatar data
 */
export async function getAllAvatars() {
  const avatars = {}
  try {
    await avatarStore.iterate((value, key) => {
      if (value && key) {
        avatars[key] = value
      }
    })
  } catch {
    // ignore
  }
  return avatars
}

/**
 * Import avatars from backup
 * @param {Object} avatars - Map of pubkey -> avatar data
 * @returns {Promise<number>} Number of avatars imported
 */
export async function importAvatars(avatars) {
  if (!avatars || typeof avatars !== 'object') {
    return 0
  }

  let count = 0
  for (const [pubkey, data] of Object.entries(avatars)) {
    if (data && typeof data === 'object' && data.dataUrl) {
      try {
        await avatarStore.setItem(pubkey, data)
        count++
      } catch {
        // ignore individual failures
      }
    }
  }

  console.log(`[profileStore] Imported ${count} avatars`)
  return count
}
