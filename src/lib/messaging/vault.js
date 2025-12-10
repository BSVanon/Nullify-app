import { v4 as uuid } from 'uuid'
import { vaultStore } from './storage'
import { buildMessagePayload } from './payloadBuilders'
import { scheduleRemoteSync } from './remoteSyncHelpers'

export async function listVaultMessages(threadId) {
  const messages = []
  await vaultStore.iterate((value) => {
    if (!value) return
    if (threadId && value.threadId && value.threadId !== threadId) return
    messages.push(value)
  })
  return messages
}

export async function saveVaultMessage(
  threadId,
  { id: providedId, author, text, ciphertext, delivery = 'sent', timestamp, createdAt, helperCache, remoteRevision },
  { skipRemoteSync = false } = {},
) {
  if (!threadId) throw new Error('threadId required to save vault message')

  const id = providedId || uuid()
  const existing = providedId ? await vaultStore.getItem(providedId) : null
  const created = createdAt || existing?.createdAt || new Date().toISOString()
  const messageTimestamp = timestamp || existing?.timestamp || created

  const entry = {
    id,
    threadId,
    author: author ?? existing?.author ?? null,
    text: text ?? existing?.text ?? null,
    ciphertext: ciphertext ?? existing?.ciphertext ?? null,
    delivery: delivery ?? existing?.delivery ?? 'sent',
    timestamp: messageTimestamp,
    createdAt: created,
    helperCache: helperCache ?? existing?.helperCache ?? null,
    remoteRevision: remoteRevision ?? existing?.remoteRevision ?? null,
  }

  await vaultStore.setItem(id, entry)

  if (!skipRemoteSync) {
    scheduleRemoteSync((client) => {
      const payload = buildMessagePayload(entry)
      if (!payload || !payload.threadId) return Promise.resolve()
      return client.uploadMessage(threadId, payload).catch((error) => {
        console.warn('[storage] failed to sync vault message (save)', threadId, error)
      })
    })
  }

  return entry
}

export async function updateVaultMessage(id, updates, { skipRemoteSync = false } = {}) {
  if (!id) throw new Error('message id required for update')
  const existing = await vaultStore.getItem(id)
  if (!existing) return null
  const updated = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
    remoteRevision: updates?.remoteRevision ?? existing.remoteRevision ?? null,
  }
  await vaultStore.setItem(id, updated)

  if (!skipRemoteSync) {
    scheduleRemoteSync((client) => {
      const payload = buildMessagePayload(updated)
      if (!payload || !payload.threadId) return Promise.resolve()
      return client.uploadMessage(payload.threadId, payload).catch((error) => {
        console.warn('[storage] failed to sync vault message (update)', id, error)
      })
    })
  }

  return updated
}

export async function purgeVaultForThread(threadId) {
  if (!threadId) return 0
  const keysToRemove = []
  await vaultStore.iterate((value, key) => {
    if (value?.threadId === threadId) {
      keysToRemove.push(key)
    }
  })
  await Promise.all(keysToRemove.map((key) => vaultStore.removeItem(key)))
  scheduleRemoteSync((client) =>
    client.purgeThread(threadId, {}).catch((error) => {
      console.warn('[storage] failed to sync purge', threadId, error)
    })
  )
  return keysToRemove.length
}
