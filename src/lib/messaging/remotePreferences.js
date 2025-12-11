import { CONFIG } from '@/lib/config'

const STORAGE_KEY = 'nullify:remote-sync-enabled'
let memoryOverride = null
const listeners = new Set()

const hasWindow = typeof window !== 'undefined'

function readStoredPreference() {
  if (!hasWindow || !window?.localStorage) {
    return memoryOverride
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === null || raw === '') {
      return memoryOverride
    }
    return raw === 'true'
  } catch (error) {
    console.warn('[remotePreferences] failed to read stored preference', error)
    return memoryOverride
  }
}

function persistPreference(value) {
  memoryOverride = value

  if (!hasWindow || !window?.localStorage) {
    return
  }

  try {
    if (value === null) {
      window.localStorage.removeItem(STORAGE_KEY)
    } else {
      window.localStorage.setItem(STORAGE_KEY, value ? 'true' : 'false')
    }
  } catch (error) {
    console.warn('[remotePreferences] failed to persist preference', error)
  }
}

function computePreference() {
  const configEnabled = Boolean(CONFIG.REMOTE_MESSAGING_ENABLED && CONFIG.REMOTE_MESSAGING_API_URL)
  const userOverride = readStoredPreference()
  const userEnabled = userOverride === null ? true : Boolean(userOverride)
  const effective = configEnabled && userEnabled

  return {
    configEnabled,
    userOverride,
    userEnabled,
    effective
  }
}

function notifyListeners() {
  const preference = computePreference()
  listeners.forEach((listener) => {
    try {
      listener(preference)
    } catch (error) {
      console.warn('[remotePreferences] listener threw error', error)
    }
  })
}

export function getRemoteMessagingPreference() {
  return computePreference()
}

export function isRemoteMessagingAllowed() {
  return computePreference().effective
}

export function setRemoteMessagingPreference(enabled) {
  if (enabled === undefined || enabled === null) {
    persistPreference(null)
  } else {
    persistPreference(Boolean(enabled))
  }
  notifyListeners()
}

export function subscribeRemoteMessagingPreference(listener) {
  if (typeof listener !== 'function') return () => {}

  listeners.add(listener)

  try {
    listener(computePreference())
  } catch (error) {
    console.warn('[remotePreferences] listener threw error during subscribe', error)
  }

  return () => {
    listeners.delete(listener)
  }
}
