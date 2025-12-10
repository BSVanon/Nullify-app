import { useCallback } from "react";

import {
  conversationFromReceipt,
  messageFromVault,
} from "./converters";
import {
  listBlockedInviters,
  listJoinReceipts,
  listThreadMetadata,
  listVaultMessages,
  saveVaultMessage,
  updateThreadMetadata,
  vaultStore,
} from "@/lib/messaging/storage";
import { formatActivityTime, sortConversationsByActivity } from "./activity";
import {
  parseRevisionNumber,
  syncRemoteThreads,
  toChronoValue,
} from "./remoteSync";
import {
  fetchHelperCachePayload,
  isHelperCacheEnabled,
} from "@/lib/messaging/helperCacheIntegration";
import { loadHelperCacheMessages } from "./loadHelperCacheMessages";
import { normalizeInboundAuthor } from "./identity";

export function useLoadState({
  setReceiptsByThread,
  setConversations,
  setMessagesByThread,
  setBlockedInviters,
  setLoading,
  loadInFlightRef,
  applyConversationUpdate,
  bumpConversationActivity,
  setRemoteApiAvailable,
}) {
  const load = useCallback(async (options = {}) => {
    const { background = false } = options;
    loadInFlightRef.current += 1;
    if (!background) setLoading(true);
    try {
      const [receipts, vaultEntries, blockedEntries, metadataEntries] = await Promise.all([
        listJoinReceipts(),
        listVaultMessages(),
        listBlockedInviters(),
        listThreadMetadata(),
      ]);

      const blockedIds = new Set(blockedEntries.map((entry) => entry.id));
      
      // Build a map of metadata for quick lookup during filtering
      const metadataLookup = metadataEntries.reduce((acc, entry) => {
        if (entry?.threadId) acc[entry.threadId] = entry;
        return acc;
      }, {});
      
      const allowedReceipts = receipts.filter((receipt) => {
        const inviterId = receipt?.inviter;
        // Filter out blocked inviters
        if (inviterId && blockedIds.has(inviterId)) return false;
        
        // Filter out dismissed threads (burned or otherwise)
        // Check both receipt and metadata for dismissedAt
        const metadata = metadataLookup[receipt?.threadId];
        const isDismissed = receipt?.dismissedAt || metadata?.dismissedAt;
        
        // A thread is considered burned if status is 'burned' OR burnedAt/burnedBy is set
        const isBurned = receipt?.status === 'burned' || receipt?.burnedAt || receipt?.burnedBy ||
                         metadata?.burnedAt || metadata?.burnedBy;
        
        // Filter out burned+dismissed threads
        if (isBurned && isDismissed) {
          console.log('[loadState] Filtering out burned+dismissed thread', receipt?.threadId);
          return false;
        }
        
        // Also filter out any thread that has been explicitly dismissed (even if not burned)
        // This handles the case where a user dismisses a stub
        if (isDismissed && receipt?.status !== 'active') {
          console.log('[loadState] Filtering out dismissed thread', receipt?.threadId, receipt?.status);
          return false;
        }
        
        return true;
      });

      const metadataByThread = metadataEntries.reduce((acc, entry) => {
        if (entry?.threadId) acc[entry.threadId] = entry;
        return acc;
      }, {});

      if (isHelperCacheEnabled()) {
        await Promise.all(
          Object.entries(metadataByThread).map(async ([metadataThreadId, metadata]) => {
            const cacheInfo = metadata?.helperCache;
            if (!cacheInfo?.cacheId) return;

            // Skip helper cache fetch for burned threads (metadata may still exist after burn)
            if (metadata?.burnedAt || metadata?.burnedBy) {
              return;
            }

            // Avoid hammering helper-cache for entries we already know are missing.
            // If a previous fetch failed (lastFetchSucceeded === false), skip further attempts.
            if (cacheInfo.lastFetchSucceeded === false && cacheInfo.lastFetchAt) {
              return;
            }

            const hasEncKeyWrap = Boolean(metadata?.encKeyWrap);
            const hasBlobHash = Boolean(metadata?.blobHash);

            if (hasEncKeyWrap && hasBlobHash) {
              return;
            }

            const fetchTimestamp = new Date().toISOString();

            let updatedMetadata = metadata;
            try {
              const payload = await fetchHelperCachePayload(cacheInfo.cacheId, { logger: console });

              if (payload && typeof payload === "object") {
                updatedMetadata = {
                  ...metadata,
                  encKeyWrap: metadata.encKeyWrap || payload.encKeyWrap || null,
                  blobHash: metadata.blobHash || payload.blobHash || null,
                  hintURL: metadata.hintURL || payload.hintURL || metadata.hintURL || "",
                  policy: metadata.policy || payload.policy || metadata.policy || "mutual",
                  helperCache: {
                    ...cacheInfo,
                    cacheId: cacheInfo.cacheId,
                    enrolled: cacheInfo.enrolled === false ? false : true,
                    lastFetchAt: fetchTimestamp,
                    lastFetchSucceeded: true,
                  },
                };
              } else {
                updatedMetadata = {
                  ...metadata,
                  helperCache: {
                    ...cacheInfo,
                    cacheId: cacheInfo.cacheId,
                    enrolled: cacheInfo.enrolled === false ? false : true,
                    lastFetchAt: fetchTimestamp,
                    lastFetchSucceeded: false,
                  },
                };
              }
            } catch (error) {
              console.warn("[guestThreads] helper cache fetch failed", {
                threadId: metadataThreadId,
                cacheId: cacheInfo.cacheId,
                error: error?.message || String(error),
              });
              updatedMetadata = {
                ...metadata,
                helperCache: {
                  ...cacheInfo,
                  cacheId: cacheInfo.cacheId,
                  enrolled: cacheInfo.enrolled === false ? false : true,
                  lastFetchAt: fetchTimestamp,
                  lastFetchSucceeded: false,
                },
              };
            }

            metadataByThread[metadataThreadId] = updatedMetadata;

            if (updatedMetadata !== metadata) {
              try {
                await updateThreadMetadata(metadataThreadId, updatedMetadata);
              } catch (error) {
                console.warn("[guestThreads] failed to persist helper cache metadata", metadataThreadId, error);
              }
            }
          })
        );
      }

      const vaultEntriesByThread = vaultEntries.reduce((acc, entry) => {
        if (!entry?.threadId) return acc;
        if (!acc[entry.threadId]) acc[entry.threadId] = [];
        acc[entry.threadId].push(entry);
        return acc;
      }, {});

      const messageRevisionByThread = Object.entries(vaultEntriesByThread).reduce((acc, [threadId, entries]) => {
        entries.forEach((entry) => {
          const revision = parseRevisionNumber(entry?.remoteRevision ?? entry?.revision);
          if (revision !== null) {
            acc[threadId] = acc[threadId] !== undefined ? Math.max(acc[threadId], revision) : revision;
          }
        });
        return acc;
      }, {});

      let receiptMapCache = {};

      const applyHydratedState = (metadataMap) => {
        const normalizedReceipts = allowedReceipts.map((receipt) => {
          const metadata = metadataMap[receipt.threadId];
          if (!metadata) return receipt;
          const ctVoutFromMetadata = Number.isInteger(metadata.ctVout) ? metadata.ctVout : undefined;
          return {
            ...receipt,
            threadMetadata: metadata,
            ctTxid: metadata.ctTxid ?? receipt.ctTxid ?? null,
            ctVout:
              Number.isInteger(receipt.ctVout) && receipt.ctVout >= 0
                ? receipt.ctVout
                : ctVoutFromMetadata ?? null,
            encKeyWrap: metadata.encKeyWrap ?? receipt.encKeyWrap ?? null,
            blobHash: metadata.blobHash ?? receipt.blobHash ?? null,
            hintURL: metadata.hintURL ?? receipt.hintURL ?? null,
            mintedAt: metadata.mintedAt ?? receipt.mintedAt ?? null,
            lastMintTxid: metadata.lastMintTxid ?? receipt.lastMintTxid ?? null,
            ctBroadcast: metadata.ctBroadcast ?? receipt.ctBroadcast ?? null,
            ctArtifacts: metadata.ctArtifacts ?? receipt.ctArtifacts ?? null,
            burnTxid: metadata.burnTxid ?? receipt.burnTxid ?? null,
            burnedAt: metadata.burnedAt ?? receipt.burnedAt ?? null,
            burnedBy: metadata.burnedBy ?? receipt.burnedBy ?? null,
            rawThreadKeyBase64: metadata.rawKeyBase64 ?? receipt.rawThreadKeyBase64 ?? null,
            dtIssuances: Array.isArray(metadata.dtIssuances)
              ? metadata.dtIssuances
              : Array.isArray(receipt.dtIssuances)
                ? receipt.dtIssuances
                : [],
            helperCache: metadata.helperCache ?? receipt.helperCache ?? null,
          };
        });

        const receiptMap = normalizedReceipts.reduce((acc, normalizedReceipt) => {
          acc[normalizedReceipt.threadId] = normalizedReceipt;
          return acc;
        }, {});

        receiptMapCache = receiptMap;

        const groupedMessages = {};
        Object.entries(vaultEntriesByThread).forEach(([threadId, entries]) => {
          const receipt = receiptMap[threadId];
          const sortedEntries = entries
            .slice()
            .sort((a, b) => toChronoValue(a.timestamp || a.createdAt) - toChronoValue(b.timestamp || b.createdAt));
          groupedMessages[threadId] = sortedEntries.map((entry) => messageFromVault(entry, receipt));
        });

        const conversationList = sortConversationsByActivity(
          normalizedReceipts.map((receipt) =>
            conversationFromReceipt(receipt, {
              blocked: blockedIds.has(receipt?.inviter),
              messages: groupedMessages[receipt.threadId] || [],
            }),
          ),
        );

        setReceiptsByThread(receiptMap);
        setConversations(conversationList);
        setMessagesByThread(groupedMessages);
        setBlockedInviters(blockedEntries);
      };

      applyHydratedState(metadataByThread);

      // Fetch any offline messages from helper-cache for threads with a cacheId.
      // This runs after initial state hydration so we can reuse receiptMapCache
      // and append messages into the in-memory state and vault.
      if (isHelperCacheEnabled()) {
        await loadHelperCacheMessages({
          receiptMap: receiptMapCache,
          vaultEntriesByThread,
          setMessagesByThread,
          bumpConversationActivity,
        });
      }

      syncRemoteThreads({
        metadataByThread,
        vaultEntriesByThread,
        messageRevisionByThread,
        applyHydratedState,
        getReceipt: (threadId) => receiptMapCache[threadId],
        setMessagesByThread,
        bumpConversationActivity,
        setRemoteApiAvailable,
      }).catch((error) => {
        console.warn("[guestThreads] remote sync failed", error);
      });
    } finally {
      loadInFlightRef.current = Math.max(0, loadInFlightRef.current - 1);
      if (!background) setLoading(false);
    }
  }, [applyConversationUpdate, bumpConversationActivity, loadInFlightRef, setBlockedInviters, setConversations, setLoading, setMessagesByThread, setReceiptsByThread, setRemoteApiAvailable]);

  return { load };
}
