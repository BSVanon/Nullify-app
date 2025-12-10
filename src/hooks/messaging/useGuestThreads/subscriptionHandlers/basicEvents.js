import { saveVaultMessage, updateVaultMessage, updateJoinReceipt } from "@/lib/messaging/storage";
import { messageFromVault } from "../converters";
import { normalizeInboundAuthor, resolveLocalPublicKey } from "../identity";

export async function handleMessageEvent({
  event,
  threadId,
  receiptsRef,
  setMessagesByThread,
  overlayClientRef,
  bumpConversationActivity,
  setReceiptsByThread,
  setConversations,
  conversationFromReceipt,
}) {
  const receipt = receiptsRef.current[threadId];
  const ourPublicKey = resolveLocalPublicKey(receipt);
  const shouldLog = typeof window !== 'undefined';

  // Skip own messages to prevent echo
  if (ourPublicKey && event.payload?.author === ourPublicKey) {
    return;
  }

  // If we're a holder and don't have the guest's public key yet, store it from the message author
  if (receipt?.identityKind === 'holder' && !receipt.guestPublicKey && event.payload?.author) {
    const guestPublicKey = event.payload.author
    console.log('[handleMessageEvent] Storing guest public key:', guestPublicKey.slice(0, 16) + '...')
    await updateJoinReceipt(threadId, { guestPublicKey })
    const updatedReceipt = { ...receipt, guestPublicKey }
    receiptsRef.current[threadId] = updatedReceipt
    if (setReceiptsByThread) {
      setReceiptsByThread(prev => ({ ...prev, [threadId]: updatedReceipt }))
    }
    // Update the conversation object so ThreadView gets the new peerPublicKey
    if (setConversations && conversationFromReceipt) {
      setConversations(prev => 
        prev.map(conv => 
          conv.id === threadId ? conversationFromReceipt(updatedReceipt, { blocked: conv.blocked }) : conv
        )
      )
    }
  }

  if (shouldLog && import.meta?.env?.DEV) {
    const text = typeof event.payload?.text === 'string' ? event.payload.text : ''
    console.info('[guestThreads] handleMessageEvent received', {
      threadId,
      author: event.payload?.author,
      textPreview: text ? `${text.slice(0, 120)}${text.length > 120 ? '…' : ''}` : null,
    })
  }

  const messageId = event.payload?.id;
  const stored = await saveVaultMessage(threadId, {
    id: messageId,
    author: normalizeInboundAuthor(event.payload.author, receipt) || "peer",
    text: event.payload.text,
    delivery: event.payload.delivery || "delivered",
  });

  const incomingId = messageId || stored.id;
  setMessagesByThread((prev) => {
    const existing = prev[threadId] || [];
    if (incomingId && existing.some((msg) => msg.id === incomingId)) return prev;
    return {
      ...prev,
      [threadId]: [...existing, messageFromVault(stored, receipt)],
    };
  });

  // Message stored successfully

  if (typeof bumpConversationActivity === "function") {
    bumpConversationActivity(threadId, event.payload?.timestamp);
  }

  // Send ACK back to sender
  if (event.payload?.id) {
    overlayClientRef.current?.publishAck(threadId, {
      messageId: event.payload.id,
      delivery: "delivered",
      ackedAt: new Date().toISOString(),
    });
  }
}

export function handleTypingEvent({
  event,
  threadId,
  receiptsRef,
  setTypingByThread,
  typingTimersRef,
  clearTyping,
}) {
  const receipt = receiptsRef.current[threadId];
  const ourPublicKey = resolveLocalPublicKey(receipt);
  
  // Skip own typing events to prevent echo
  if (event.payload?.author === "self" || (ourPublicKey && event.payload?.author === ourPublicKey)) {
    return;
  }

  setTypingByThread((prev) => ({ ...prev, [threadId]: true }));
  const existingTimer = typingTimersRef.current[threadId];
  if (existingTimer) clearTimeout(existingTimer);
  typingTimersRef.current[threadId] = setTimeout(() => {
    clearTyping(threadId);
  }, 2000);
}

export async function handleAckEvent({
  event,
  threadId,
  setMessagesByThread,
  bumpConversationActivity,
}) {
  const { messageId, id, delivery } = event.payload || {};
  const targetId = messageId || id;
  if (!targetId) return;

  const normalizedDelivery =
    delivery === "acknowledged" || !delivery ? "delivered" : delivery;

  await updateVaultMessage(targetId, { delivery: normalizedDelivery });
  setMessagesByThread((prev) => {
    const existing = prev[threadId] || [];
    return {
      ...prev,
      [threadId]: existing.map((msg) =>
        msg.id === targetId ? { ...msg, delivery: normalizedDelivery } : msg,
      ),
    };
  });

  if (typeof bumpConversationActivity === "function") {
    bumpConversationActivity(threadId, event.payload?.ackedAt);
  }
}

export async function handleDeliveryEvent({
  event,
  threadId,
  setMessagesByThread,
  bumpConversationActivity,
}) {
  const { messageId, id, status, timestamp } = event.payload || {};
  const targetId = messageId || id;
  if (!targetId) return;

  const normalizedDelivery =
    status === "failed"
      ? "failed"
      : status === "relayed" || status === "acknowledged" || !status
        ? "delivered"
        : status;

  await updateVaultMessage(targetId, { delivery: normalizedDelivery });
  setMessagesByThread((prev) => {
    const existing = prev[threadId] || [];
    return {
      ...prev,
      [threadId]: existing.map((msg) =>
        msg.id === targetId ? { ...msg, delivery: normalizedDelivery } : msg,
      ),
    };
  });

  if (typeof bumpConversationActivity === "function") {
    bumpConversationActivity(threadId, timestamp);
  }
}
