import { blockedInviterStore } from './storage'

function isoTimestamp(value) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

function compareIsoDates(a, b) {
  const timeA = a ? new Date(a).getTime() : -Infinity
  const timeB = b ? new Date(b).getTime() : -Infinity
  if (timeA === timeB) return 0
  return timeA > timeB ? 1 : -1
}

export async function listBlockedInviters() {
  const entries = []
  await blockedInviterStore.iterate((value, key) => {
    if (!value && !key) return
    if (value) {
      entries.push({ id: key, ...value })
    } else if (key) {
      entries.push({ id: key })
    }
  })
  return entries
}

export async function saveBlockedInviter(inviterId, metadata = {}) {
  if (!inviterId) throw new Error('inviterId required to block inviter')
  const existing = await blockedInviterStore.getItem(inviterId)

  const incomingUpdatedAt = isoTimestamp(metadata.updatedAt)
  const existingUpdatedAt = isoTimestamp(existing?.updatedAt)

  if (existing && incomingUpdatedAt && existingUpdatedAt && compareIsoDates(incomingUpdatedAt, existingUpdatedAt) <= 0) {
    return { id: inviterId, ...existing }
  }

  const nowIso = new Date().toISOString()
  const blockedAt = isoTimestamp(metadata.blockedAt) || existing?.blockedAt || nowIso
  const updatedAt = incomingUpdatedAt || existingUpdatedAt || nowIso
  const entry = {
    ...existing,
    ...metadata,
    blockedAt,
    updatedAt,
    source: metadata.source || existing?.source || 'local'
  }

  await blockedInviterStore.setItem(inviterId, entry)
  return { id: inviterId, ...entry }
}

export async function removeBlockedInviter(inviterId, metadata = {}) {
  if (!inviterId) return false
  const existing = await blockedInviterStore.getItem(inviterId)
  if (!existing) return false

  const incomingUpdatedAt = isoTimestamp(metadata.updatedAt)
  const existingUpdatedAt = isoTimestamp(existing?.updatedAt)

  if (incomingUpdatedAt && existingUpdatedAt && compareIsoDates(incomingUpdatedAt, existingUpdatedAt) <= 0) {
    return false
  }

  await blockedInviterStore.removeItem(inviterId)
  return true
}

export async function isInviterBlocked(inviterId) {
  if (!inviterId) return false
  const entry = await blockedInviterStore.getItem(inviterId)
  return Boolean(entry)
}
