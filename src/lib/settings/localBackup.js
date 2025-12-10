import { getAllProfiles, importProfiles, getAllAvatars, importAvatars } from '@/lib/identity/profileStore.js'
import { getAllContacts, upsertContact } from '@/lib/identity/contactsStore.js'
import { listBlockedInviters, saveBlockedInviter } from '@/lib/messaging/blockedInviters.js'
import { isOnboardingComplete, setOnboardingComplete } from '@/lib/messaging/appState.js'
import { getSpendCaps, setSpendCaps } from '@/lib/messaging/spendCaps.js'

const HAS_WINDOW = typeof window !== 'undefined'

function readLocalStorage(key) {
  if (!HAS_WINDOW || !window.localStorage) return null
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeLocalStorage(key, value) {
  if (!HAS_WINDOW || !window.localStorage) return
  try {
    if (value === null || value === undefined) {
      window.localStorage.removeItem(key)
    } else {
      window.localStorage.setItem(key, value)
    }
  } catch {
    // ignore
  }
}

export async function buildLocalBackupPayload() {
  const [profiles, contacts, blockedInviters, onboardingComplete, spendCaps, avatars] = await Promise.all([
    getAllProfiles(),
    getAllContacts(),
    listBlockedInviters(),
    isOnboardingComplete(),
    getSpendCaps(),
    getAllAvatars(),
  ])

  const theme = readLocalStorage('nukenote.theme')
  const textScale = readLocalStorage('nukenote.textScale')
  const sendOnEnter = readLocalStorage('nukenote:send-on-enter')
  const typingPrefs = readLocalStorage('nukenote:typing-indicator-preferences')
  const remoteSyncEnabled = readLocalStorage('nukenote:remote-sync-enabled')

  return {
    version: 1,
    createdAt: new Date().toISOString(),
    profiles,
    avatars,
    contacts,
    blockedInviters,
    ui: {
      theme,
      textScale,
      sendOnEnter,
      typingPrefs,
      remoteSyncEnabled,
    },
    preferences: {
      onboardingComplete: Boolean(onboardingComplete),
      spendCaps,
    },
  }
}

export async function applyLocalBackupPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid backup payload')
  }

  if (payload.version !== 1) {
    throw new Error('Unsupported backup version')
  }

  const existingContacts = await getAllContacts()
  const lostVerifiedPubkeys = new Set()

  if (payload.contacts && typeof payload.contacts === 'object') {
    for (const [pubkey, contact] of Object.entries(payload.contacts)) {
      if (!pubkey || !contact || typeof contact !== 'object') continue
      const previous = existingContacts[pubkey]
      const contactWasVerified = Boolean(contact && contact.verified) || Boolean(previous && previous.verified)
      if (contactWasVerified) {
        lostVerifiedPubkeys.add(pubkey)
      }
      const { verified: _ignoredVerified, ...rest } = contact
      await upsertContact(pubkey, { ...rest, verified: false })
    }
  }

  if (payload.profiles && typeof payload.profiles === 'object') {
    try {
      const json = JSON.stringify(payload.profiles)
      await importProfiles(json, true)
    } catch {
      // ignore profile import errors
    }
  }

  if (payload.avatars && typeof payload.avatars === 'object') {
    try {
      await importAvatars(payload.avatars)
    } catch {
      // ignore avatar import errors
    }
  }

  if (Array.isArray(payload.blockedInviters)) {
    for (const entry of payload.blockedInviters) {
      if (!entry || typeof entry !== 'object' || !entry.id) continue
      await saveBlockedInviter(entry.id, entry)
    }
  }

  if (payload.ui && typeof payload.ui === 'object') {
    const { theme, textScale, sendOnEnter, typingPrefs, remoteSyncEnabled } = payload.ui
    if (theme === 'dark' || theme === 'light' || theme === 'system') {
      writeLocalStorage('nukenote.theme', theme)
    }
    if (textScale === 'sm' || textScale === 'md' || textScale === 'lg') {
      writeLocalStorage('nukenote.textScale', textScale)
    }
    if (sendOnEnter === 'true' || sendOnEnter === 'false' || sendOnEnter === null) {
      if (sendOnEnter === null) {
        writeLocalStorage('nukenote:send-on-enter', null)
      } else {
        writeLocalStorage('nukenote:send-on-enter', sendOnEnter)
      }
    }
    if (typeof typingPrefs === 'string') {
      writeLocalStorage('nukenote:typing-indicator-preferences', typingPrefs)
    }
    if (remoteSyncEnabled === 'true' || remoteSyncEnabled === 'false' || remoteSyncEnabled === null) {
      if (remoteSyncEnabled === null) {
        writeLocalStorage('nukenote:remote-sync-enabled', null)
      } else {
        writeLocalStorage('nukenote:remote-sync-enabled', remoteSyncEnabled)
      }
    }
  }

  if (payload.preferences && typeof payload.preferences === 'object') {
    const { onboardingComplete, spendCaps } = payload.preferences
    try {
      await setOnboardingComplete(Boolean(onboardingComplete))
    } catch {
      // ignore
    }
    if (spendCaps && typeof spendCaps === 'object') {
      try {
        await setSpendCaps(spendCaps)
      } catch {
        // ignore
      }
    }
  }

  return {
    lostVerifiedPubkeys: Array.from(lostVerifiedPubkeys),
  }
}
