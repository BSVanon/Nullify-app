import { ensureRemoteMessagingClient } from '@/lib/messaging/remoteClient'
import { isRemoteMessagingAllowed } from '@/lib/messaging/remotePreferences'
import { saveVaultMessage } from '@/lib/messaging/storage'
import { emitTelemetry } from '@/lib/messaging/remoteTelemetry'
import { messageFromVault } from './converters'

export const parseRevisionNumber = (value) => {
  if (value === undefined || value === null) return null
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null
}

export const toChronoValue = (value) => {
  if (!value) return 0
  const time = Date.parse(value)
  return Number.isNaN(time) ? 0 : time
}

function updateEntriesCollection(vaultEntriesByThread, threadId, savedEntry) {
  if (!vaultEntriesByThread[threadId]) {
    vaultEntriesByThread[threadId] = []
  }

  const entries = vaultEntriesByThread[threadId]
  const existingIndex = entries.findIndex((entry) => entry.id === savedEntry.id)
  if (existingIndex >= 0) {
    entries[existingIndex] = savedEntry
  } else {
    entries.push(savedEntry)
  }

  return entries
}

export async function syncRemoteThreads({
  metadataByThread,
  vaultEntriesByThread,
  messageRevisionByThread,
  applyHydratedState,
  getReceipt,
  setMessagesByThread,
  bumpConversationActivity,
  setRemoteApiAvailable,
}) {
  if (!isRemoteMessagingAllowed()) return

  const client = await ensureRemoteMessagingClient()
  if (!client) return

  let summary
  try {
    summary = await client.listThreads()
    // API responded successfully
    if (setRemoteApiAvailable) setRemoteApiAvailable(true)
  } catch (error) {
    console.warn('[guestThreads] remote metadata sync failed', error)
    // Check if it's a 404 (API not deployed)
    const is404 = error?.message?.includes('404') || error?.status === 404
    if (setRemoteApiAvailable) setRemoteApiAvailable(!is404 ? null : false)
    emitTelemetry({
      component: 'remoteSync',
      type: 'list-threads-failed',
      error: error?.message || String(error),
    })
    return
  }

  const threads = Array.isArray(summary?.threads) ? summary.threads : []
  if (!threads.length) return

  emitTelemetry({
    component: 'remoteSync',
    type: 'list-threads-success',
    threads: threads.length,
  })

  const metadataMap = { ...metadataByThread }
  let metadataChanged = false

  await Promise.all(
    threads.map(async (thread) => {
      const threadId = thread?.threadId
      if (!threadId) return

      const remoteRevision = parseRevisionNumber(
        thread.metadataRevision ?? thread.revision ?? thread.remoteRevision,
      )

      const existing = metadataMap[threadId]
      const localRevision = parseRevisionNumber(existing?.remoteRevision ?? existing?.revision)

      if (remoteRevision !== null && localRevision !== null && remoteRevision <= localRevision) {
        return
      }

      try {
        const remoteMetadata = await client.fetchMetadata(threadId, {
          revisionSince: localRevision ?? undefined,
        })

        if (!remoteMetadata || typeof remoteMetadata !== 'object') {
          return
        }

        const normalizedRemote = {
          ...(existing || {}),
          ...remoteMetadata,
          threadId,
        }

        const updatedRevision =
          parseRevisionNumber(remoteMetadata.revision ?? remoteMetadata.remoteRevision) ?? remoteRevision

        if (updatedRevision !== null) {
          normalizedRemote.remoteRevision = updatedRevision
        }

        metadataMap[threadId] = normalizedRemote
        metadataByThread[threadId] = normalizedRemote
        metadataChanged = true
        emitTelemetry({
          component: 'remoteSync',
          type: 'metadata-updated',
          threadId,
          revision: normalizedRemote.remoteRevision ?? null,
        })
      } catch (error) {
        console.warn('[guestThreads] failed to fetch remote metadata for thread', threadId, error)
        emitTelemetry({
          component: 'remoteSync',
          type: 'metadata-failed',
          threadId,
          error: error?.message || String(error),
        })
      }
    }),
  )

  if (metadataChanged) {
    applyHydratedState(metadataMap)
  }

  await Promise.all(
    threads.map(async (thread) => {
      const threadId = thread?.threadId
      if (!threadId) return

      const remoteMessageRevision = parseRevisionNumber(
        thread.messageRevision ?? thread.messagesRevision ?? thread.remoteMessageRevision,
      )

      if (remoteMessageRevision === null) return

      const localMessageRevision = parseRevisionNumber(messageRevisionByThread[threadId])
      if (localMessageRevision !== null && remoteMessageRevision <= localMessageRevision) {
        return
      }

      const receipt = getReceipt(threadId)
      if (!receipt) return

      let response
      try {
        response = await client.fetchMessages(threadId, {
          sinceRevision: localMessageRevision ?? undefined,
        })
      } catch (error) {
        console.warn('[guestThreads] remote message sync failed', threadId, error)
        emitTelemetry({
          component: 'remoteSync',
          type: 'messages-failed',
          threadId,
          error: error?.message || String(error),
        })
        return
      }

      const remoteMessages = Array.isArray(response?.messages) ? response.messages : []
      if (!remoteMessages.length) return

      let latestTimestamp = null
      let changed = false

      for (const remoteMessage of remoteMessages) {
        const messageId = remoteMessage?.messageId
        if (!messageId || !remoteMessage.ciphertext) continue

        const messageRevision = parseRevisionNumber(remoteMessage.revision ?? remoteMessage.remoteRevision)

        if (
          messageRevision !== null &&
          localMessageRevision !== null &&
          messageRevision <= localMessageRevision
        ) {
          continue
        }

        try {
          const saved = await saveVaultMessage(
            threadId,
            {
              id: messageId,
              ciphertext: remoteMessage.ciphertext,
              author: remoteMessage.author ?? null,
              delivery: remoteMessage.delivery ?? 'delivered',
              timestamp: remoteMessage.timestamp ?? remoteMessage.createdAt ?? null,
              helperCache: remoteMessage.helperCache ?? null,
              remoteRevision: messageRevision ?? remoteMessageRevision,
            },
            { skipRemoteSync: true },
          )

          if (!saved) continue

          updateEntriesCollection(vaultEntriesByThread, threadId, saved)

          if (messageRevision !== null) {
            messageRevisionByThread[threadId] = messageRevisionByThread[threadId] !== undefined
              ? Math.max(messageRevisionByThread[threadId], messageRevision)
              : messageRevision
          }

          const candidateTimestamp = saved.timestamp || saved.createdAt || null
          if (candidateTimestamp) {
            if (!latestTimestamp || toChronoValue(candidateTimestamp) > toChronoValue(latestTimestamp)) {
              latestTimestamp = candidateTimestamp
            }
          }

          changed = true
          emitTelemetry({
            component: 'remoteSync',
            type: 'message-updated',
            threadId,
            messageId,
            revision: messageRevision ?? remoteMessageRevision ?? null,
          })
        } catch (error) {
          console.warn('[guestThreads] failed to persist remote message', threadId, messageId, error)
          emitTelemetry({
            component: 'remoteSync',
            type: 'message-persist-failed',
            threadId,
            messageId,
            error: error?.message || String(error),
          })
        }
      }

      if (!changed) return

      const entries = vaultEntriesByThread[threadId] || []
      const sortedEntries = entries
        .slice()
        .sort((a, b) => toChronoValue(a.timestamp || a.createdAt) - toChronoValue(b.timestamp || b.createdAt))

      vaultEntriesByThread[threadId] = sortedEntries

      const nextMessages = sortedEntries.map((entry) => messageFromVault(entry, receipt))

      setMessagesByThread((prev) => ({
        ...prev,
        [threadId]: nextMessages,
      }))

      if (latestTimestamp) {
        bumpConversationActivity(threadId, latestTimestamp)
      }
    }),
  )
}
