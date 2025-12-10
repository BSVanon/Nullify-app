import { validateThreadAccess } from "@/lib/messaging/validateThreadAccess";
import { saveVaultMessage } from "@/lib/messaging/storage";
import { messageFromVault } from "../converters";
import { normalizeLocalAuthor, resolveLocalPublicKey } from "../identity";
import { isHelperCacheEnabled, buildHelperCacheId } from "@/lib/messaging/helperCacheIntegration";
import { putHelperCacheItem } from "@/lib/messaging/helperCacheClient";

export async function sendMessageImpl({
  threadId,
  author,
  text,
  receiptsByThread,
  setMessagesByThread,
  bumpConversationActivity,
  overlayClientRef,
}) {
  if (!threadId || !text) return null;

  const receipt = receiptsByThread[threadId];
  if (!receipt || receipt.status === "blocked") {
    return null;
  }

  console.log("[guestThreads] sendMessage - receipt check:", {
    threadId,
    hasReceipt: !!receipt,
    identityKind: receipt?.identityKind,
    ctTxid: receipt?.ctTxid,
    ctVout: receipt?.ctVout,
    dtIssuances: receipt?.dtIssuances?.length || 0,
    threadMetadata: !!receipt?.threadMetadata,
  });

  const validation = validateThreadAccess({
    threadId,
    userPublicKey: receipt?.guestPublicKey || receipt?.holderPublicKey,
    receipt,
  });
  if (!validation.hasAccess) {
    console.warn(
      "[guestThreads] sendMessage blocked - DT validation failed:",
      validation,
    );
    console.warn("[guestThreads] Full receipt at validation:", receipt);
    throw new Error(validation.details || "Access denied");
  }

  const ourPublicKey = resolveLocalPublicKey(receipt) || "unknown";

  console.info("[guestThreads] sendMessage", {
    threadId,
    author,
    resolvedAuthor: ourPublicKey,
    receiptSnapshot: receipt,
  });
  const isJoinedSystemMessage =
    typeof text === "string" && text.startsWith("[JOINED]");

  const stored = await saveVaultMessage(threadId, {
    id: isJoinedSystemMessage ? `system:joined:${threadId}` : undefined,
    author: normalizeLocalAuthor(author, receipt) || ourPublicKey,
    text,
    delivery: "sent",
  });
  setMessagesByThread((prev) => {
    const existing = prev[threadId] || [];

    if (stored.id && existing.some((msg) => msg.id === stored.id)) {
      return prev;
    }

    return {
      ...prev,
      [threadId]: [...existing, messageFromVault(stored, receipt)],
    };
  });

  bumpConversationActivity(threadId, stored.timestamp);

  // Build cacheId from CT outpoint for helper cache storage
  const cacheId = buildHelperCacheId(receipt?.ctTxid, receipt?.ctVout);

  const messagePayload = {
    ...stored,
    author: ourPublicKey,
    text,
    timestamp: stored.timestamp || new Date().toISOString(),
    cacheId, // Include for offline recipient storage
  };

  // Publish to overlay for real-time delivery
  overlayClientRef.current?.publishMessage(threadId, messagePayload);

  // Seed helper cache for offline recipient (fire-and-forget, don't block send)
  if (cacheId && isHelperCacheEnabled()) {
    seedHelperCache(cacheId, threadId, messagePayload).catch((error) => {
      console.warn("[guestThreads] Helper cache seeding failed (non-blocking):", error.message);
    });
  }

  return stored;
}

/**
 * Seed a message to the helper cache for offline recipient retrieval
 * This is a fire-and-forget operation that doesn't block message sending
 */
async function seedHelperCache(cacheId, threadId, messagePayload) {
  try {
    // Store message in helper cache keyed by cacheId (CT outpoint)
    // The helper cache stores an array of pending messages per thread
    const cacheKey = `${cacheId}:messages`;
    
    await putHelperCacheItem(cacheKey, {
      threadId,
      message: {
        id: messagePayload.id,
        author: messagePayload.author,
        text: messagePayload.text,
        timestamp: messagePayload.timestamp,
        cacheId,
      },
      seededAt: new Date().toISOString(),
      ttl: 48 * 60 * 60 * 1000, // 48 hours default TTL
    });

    console.info("[guestThreads] Message seeded to helper cache:", {
      cacheId,
      messageId: messagePayload.id,
    });
  } catch (error) {
    // Log but don't throw - helper cache is best-effort
    console.warn("[guestThreads] Failed to seed helper cache:", error.message);
  }
}

export function notifyTypingImpl({
  threadId,
  receiptsByThread,
  typingEnabledRef,
  overlayClientRef,
}) {
  if (!threadId || !typingEnabledRef.current) return false;
  const receipt = receiptsByThread[threadId];
  if (!receipt || receipt.status === "blocked") return false;
  const ourPublicKey = resolveLocalPublicKey(receipt) || "self";

  console.info("[guestThreads] notifyTyping", {
    threadId,
    enabled: typingEnabledRef.current,
    resolvedAuthor: ourPublicKey,
    receiptSnapshot: receipt,
  });
  overlayClientRef.current?.publishTyping?.(threadId, {
    author: ourPublicKey,
    occurredAt: new Date().toISOString(),
  });
  return true;
}

export function removeThreadLocallyImpl({
  threadId,
  setReceiptsByThread,
  applyConversationUpdate,
  setMessagesByThread,
  clearTyping,
}) {
  if (!threadId) return;

  setReceiptsByThread((prev) => {
    if (!prev[threadId]) return prev;
    const next = { ...prev };
    delete next[threadId];
    return next;
  });
  applyConversationUpdate((prev) =>
    prev.filter((conv) => conv.id !== threadId),
  );
  setMessagesByThread((prev) => {
    if (!prev[threadId]) return prev;
    const next = { ...prev };
    delete next[threadId];
    return next;
  });
  clearTyping(threadId);
}
