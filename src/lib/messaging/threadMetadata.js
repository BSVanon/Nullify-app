import { threadMetadataStore } from './storage'
import { buildMetadataPayload } from './payloadBuilders'
import { scheduleRemoteSync } from './remoteSyncHelpers'

export async function getThreadMetadata(threadId) {
  if (!threadId) return null
  return threadMetadataStore.getItem(threadId)
}

export async function saveThreadMetadata(threadId, metadata) {
  if (!threadId) throw new Error('threadId required to save metadata')
  await threadMetadataStore.setItem(threadId, metadata)

  scheduleRemoteSync((client) => {
    const payload = buildMetadataPayload(threadId, metadata)
    if (!payload) return Promise.resolve()
    return client.uploadMetadata(threadId, payload).catch((error) => {
      console.warn('[storage] failed to sync metadata (save)', threadId, error)
    })
  })

  return metadata
}

export async function listThreadMetadata() {
  const metadata = []
  await threadMetadataStore.iterate((value, key) => {
    if (value) metadata.push({ threadId: key, ...value })
  })
  return metadata
}

export async function updateThreadMetadata(threadId, updates) {
  if (!threadId) throw new Error('threadId required to update metadata')
  const existing = await threadMetadataStore.getItem(threadId)
  const next = { ...(existing || {}), ...(updates || {}) }
  await threadMetadataStore.setItem(threadId, next)

  scheduleRemoteSync((client) => {
    const payload = buildMetadataPayload(threadId, next)
    if (!payload) return Promise.resolve()
    return client.uploadMetadata(threadId, payload).catch((error) => {
      console.warn('[storage] failed to sync metadata (update)', threadId, error)
    })
  })

  return next
}

export async function deleteThreadMetadata(threadId) {
  if (!threadId) return
  await threadMetadataStore.removeItem(threadId)
}
