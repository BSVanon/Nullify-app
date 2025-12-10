import { fetchHelperCachePayload } from '@/lib/messaging/helperCacheIntegration'
import { deleteHelperCacheItem } from '@/lib/messaging/helperCacheClient'
import { saveVaultMessage, vaultStore } from '@/lib/messaging/storage'
import { normalizeInboundAuthor } from './identity'
import { messageFromVault } from './converters'

/**
 * Load any offline messages from helper-cache for threads with a cacheId.
 *
 * This mirrors the inline logic previously in `loadState.js`, but is
 * extracted for readability and easier testing. It does not change
 * behavior: it appends new messages into the in-memory state and
 * vault, bumps conversation activity, and deletes helper-cache entries
 * after successful import.
 */
export async function loadHelperCacheMessages({
  receiptMap,
  vaultEntriesByThread,
  setMessagesByThread,
  bumpConversationActivity,
}) {
  if (!receiptMap || !vaultEntriesByThread) return

  await Promise.all(
    Object.entries(receiptMap).map(async ([threadId, receipt]) => {
      const cacheInfo = receipt?.helperCache
      if (!cacheInfo?.cacheId) return

      // Skip helper cache fetch for burned threads
      if (receipt?.status === 'burned' || receipt?.burnedAt) {
        return
      }

      try {
        const payload = await fetchHelperCachePayload(cacheInfo.cacheId, { logger: console })
        if (!payload || typeof payload !== 'object') return

        const nowIso = new Date().toISOString()

        // New schema: payload may contain an array of messages.
        const payloadMessages = Array.isArray(payload.messages) ? payload.messages : []

        // Backwards-compatible fallback: if there is no messages[] array,
        // treat the payload itself as a single-message shape when it
        // obviously looks like a message.
        const singleLooksLikeMessage =
          typeof payload.text === 'string' ||
          typeof payload.ciphertext === 'string' ||
          payload.delivery ||
          payload.id

        const candidates =
          payloadMessages.length > 0
            ? payloadMessages
            : singleLooksLikeMessage
              ? [payload]
              : []

        if (candidates.length === 0) {
          // Nothing message-like to import for this thread; metadata-only
          // entries were already handled earlier.
          return
        }

        // Sort candidates by timestamp to ensure correct ordering
        const sortedCandidates = candidates
          .filter((raw) => raw && typeof raw === 'object')
          .sort((a, b) => {
            const tsA = a.timestamp || nowIso
            const tsB = b.timestamp || nowIso
            return tsA.localeCompare(tsB)
          })

        let latestTimestamp = null
        const importedMessages = []

        for (const raw of sortedCandidates) {
          const looksLikeMessage =
            typeof raw.text === 'string' ||
            typeof raw.ciphertext === 'string' ||
            raw.delivery ||
            raw.id

          if (!looksLikeMessage) continue

          // Skip if already in vault (avoid re-importing real-time delivered messages)
          if (raw.id) {
            const existingInVault = await vaultStore.getItem(raw.id)
            if (existingInVault) {
              console.log('[guestThreads] skipping already-imported message', raw.id)
              continue
            }
          }

          const ts = raw.timestamp || nowIso
          const stored = await saveVaultMessage(
            threadId,
            {
              id: raw.id,
              author: normalizeInboundAuthor(raw.author, receipt) || 'peer',
              text: raw.text ?? null,
              ciphertext: raw.ciphertext ?? null,
              delivery: raw.delivery || 'delivered',
              timestamp: ts,
              helperCache: {
                ...(raw.helperCache || payload.helperCache || null),
                cacheId: cacheInfo.cacheId,
                importedAt: nowIso,
              },
            },
            { skipRemoteSync: true },
          )

          if (!latestTimestamp || (stored.timestamp && stored.timestamp > latestTimestamp)) {
            latestTimestamp = stored.timestamp
          }

          importedMessages.push(messageFromVault(stored, receipt))
        }

        // Single batched state update to avoid race conditions
        if (importedMessages.length > 0) {
          setMessagesByThread((prev) => {
            const existing = prev[threadId] || []
            const existingIds = new Set(existing.map((m) => m.id).filter(Boolean))
            const newMessages = importedMessages.filter((m) => !existingIds.has(m.id))

            if (newMessages.length === 0) return prev

            return {
              ...prev,
              [threadId]: [...existing, ...newMessages],
            }
          })
        }

        if (latestTimestamp && typeof bumpConversationActivity === 'function') {
          bumpConversationActivity(threadId, latestTimestamp)
        }

        try {
          await deleteHelperCacheItem(cacheInfo.cacheId)
        } catch (error) {
          console.warn('[guestThreads] failed to delete helper cache entry', {
            threadId,
            cacheId: cacheInfo.cacheId,
            error: error?.message || String(error),
          })
        }
      } catch (error) {
        console.warn('[guestThreads] offline helper cache fetch failed', {
          threadId,
          cacheId: cacheInfo.cacheId,
          error: error?.message || String(error),
        })
      }
    }),
  )
}
