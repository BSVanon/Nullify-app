import {
  handleMessageEvent,
  handleTypingEvent,
  handleAckEvent,
  handleDeliveryEvent,
} from "./subscriptionHandlers/basicEvents.js";
import { handleControlEvent } from "./subscriptionHandlers/controlEvents.js";

/**
 * Create subscription handler for overlay events
 * Handles message, typing, ack, and control events
 */
export function createSubscriptionHandler({
  threadId,
  receiptsRef,
  setMessagesByThread,
  setTypingByThread,
  setReceiptsByThread,
  setConversations,
  typingTimersRef,
  clearTyping,
  removeThreadLocally,
  conversationFromReceipt,
  overlayClientRef,
  updateJoinReceipt,
  deleteJoinReceipt,
  deleteGuestIdentity,
  updateThreadMetadata,
  typingEnabledRef,
  bumpConversationActivity,
}) {
  return async (event) => {
    if (event.type === "message") {
      await handleMessageEvent({
        event,
        threadId,
        receiptsRef,
        setMessagesByThread,
        overlayClientRef,
        bumpConversationActivity,
        setReceiptsByThread,
        setConversations,
        conversationFromReceipt,
      });
      return;
    }

    if (event.type === "typing") {
      handleTypingEvent({
        event,
        threadId,
        receiptsRef,
        setTypingByThread,
        typingTimersRef,
        clearTyping,
      });
      return;
    }

    if (event.type === "ack") {
      await handleAckEvent({
        event,
        threadId,
        setMessagesByThread,
        bumpConversationActivity,
      });
      return;
    }

    if (event.type === "delivery") {
      await handleDeliveryEvent({
        event,
        threadId,
        setMessagesByThread,
        bumpConversationActivity,
      });
      return;
    }

    if (event.type === "control") {
      await handleControlEvent({
        event,
        threadId,
        receiptsRef,
        setReceiptsByThread,
        setConversations,
        setMessagesByThread,
        setTypingByThread,
        typingTimersRef,
        clearTyping,
        removeThreadLocally,
        overlayClientRef,
        updateJoinReceipt,
        deleteJoinReceipt,
        deleteGuestIdentity,
        updateThreadMetadata,
        typingEnabledRef,
        bumpConversationActivity,
        conversationFromReceipt,
      });
      return;
    }
  };
}

/**
 * Manage overlay subscriptions for active threads
 * Subscribes to new threads and unsubscribes from removed threads
 */
export function manageSubscriptions({
  client,
  receiptsSnapshot,
  activeSubscriptions,
  createHandler,
}) {
  const shouldLog = typeof window !== 'undefined';

  const desiredIds = new Set(Object.keys(receiptsSnapshot));

  // Unsubscribe from threads that are no longer active
  activeSubscriptions.forEach((unsubscribe, threadId) => {
    if (!desiredIds.has(threadId)) {
      if (shouldLog) {
        console.info('[subscriptions] unsubscribing thread', {
          threadId,
        });
      }
      unsubscribe?.();
      activeSubscriptions.delete(threadId);
    }
  });

  // Subscribe to new threads
  desiredIds.forEach((threadId) => {
    if (activeSubscriptions.has(threadId)) return;
    if (shouldLog) {
      console.info('[subscriptions] subscribing thread', {
        threadId,
      });
    }
    const handler = createHandler(threadId);
    const unsubscribe = client.subscribe(threadId, handler);
    activeSubscriptions.set(threadId, unsubscribe);
  });

  return activeSubscriptions;
}
