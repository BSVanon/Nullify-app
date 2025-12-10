import { useCallback, useEffect, useRef } from "react";
import { createSubscriptionHandler, manageSubscriptions } from "./useGuestThreads/subscriptionManager";
import {
  deleteGuestIdentity,
  deleteJoinReceipt,
  updateJoinReceipt,
  updateThreadMetadata,
} from "@/lib/messaging/storage";
import { conversationFromReceipt } from "./useGuestThreads/converters";

/**
 * Manages overlay subscriptions for active threads
 * 
 * Responsibilities:
 * - Creates subscription handlers for each thread
 * - Subscribes/unsubscribes as threads are added/removed
 * - Cleans up subscriptions on unmount
 * - Handles StrictMode double-invocation gracefully
 * 
 * @param {object} params
 * @param {object} params.client - Overlay client instance
 * @param {string} params.threadIdsKey - Stable key representing current thread IDs
 * @param {object} params.receiptsByThread - Current receipts by thread ID
 * @param {object} params.receiptsRef - Ref to receipts for handlers
 * @param {object} params.typingTimersRef - Ref to typing timers
 * @param {function} params.setMessagesByThread - State setter for messages
 * @param {function} params.setTypingByThread - State setter for typing indicators
 * @param {function} params.setReceiptsByThread - State setter for receipts
 * @param {function} params.setConversations - State setter for conversations
 * @param {function} params.clearTyping - Function to clear typing indicator
 * @param {function} params.removeThreadLocally - Function to remove thread
 * @param {function} params.bumpConversationActivity - Function to update conversation activity
 * @param {object} params.overlayClientRef - Ref to overlay client
 * @param {object} params.typingEnabledRef - Ref to typing enabled preference
 * @param {string} params.overlayStatus - Current overlay connection status
 * 
 * @returns {{ ensureThreadSubscribed: function }}
 */
export function useThreadSubscriptions({
  client,
  threadIdsKey,
  receiptsByThread,
  receiptsRef,
  typingTimersRef,
  setMessagesByThread,
  setTypingByThread,
  setReceiptsByThread,
  setConversations,
  clearTyping,
  removeThreadLocally,
  bumpConversationActivity,
  overlayClientRef,
  typingEnabledRef,
  overlayStatus,
}) {
  const subscriptionsRef = useRef(new Map());

  const createHandler = useCallback(
    (threadId) =>
      createSubscriptionHandler({
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
      }),
    [
      receiptsRef,
      setMessagesByThread,
      setTypingByThread,
      setReceiptsByThread,
      setConversations,
      typingTimersRef,
      clearTyping,
      removeThreadLocally,
      overlayClientRef,
      typingEnabledRef,
      bumpConversationActivity,
    ],
  );

  const ensureThreadSubscribed = useCallback(
    (threadId) => {
      if (!threadId) return;

      if (!client) {
        if (typeof window !== "undefined") {
          console.info("[useThreadSubscriptions] ensureThreadSubscribed: no overlay client", {
            threadId,
            overlayStatus,
          });
        }
        return;
      }

      const activeSubscriptions = subscriptionsRef.current;
      if (activeSubscriptions.has(threadId)) return;

      if (typeof window !== "undefined") {
        console.info("[useThreadSubscriptions] ensureThreadSubscribed: subscribing thread", {
          threadId,
        });
      }

      const handler = createHandler(threadId);
      const unsubscribe = client.subscribe(threadId, handler);
      activeSubscriptions.set(threadId, unsubscribe);
    },
    [client, createHandler, overlayStatus],
  );

  // Manage subscriptions based on active threads
  useEffect(() => {
    const shouldLog = typeof window !== 'undefined' && import.meta?.env?.DEV;

    if (!client) {
      if (shouldLog) {
        console.info('[useThreadSubscriptions] subscriptions skipped: no overlay client', {
          threadIds: Object.keys(receiptsByThread || {}),
          overlayStatus,
        });
      }
      return undefined;
    }

    if (shouldLog) {
      console.info('[useThreadSubscriptions] managing subscriptions', {
        threadIds: Object.keys(receiptsByThread || {}),
        activeCount: subscriptionsRef.current?.size ?? 0,
        overlayStatus,
      });
    }

    const receiptsSnapshot = receiptsByThread;
    const activeSubscriptions = subscriptionsRef.current;

    subscriptionsRef.current = manageSubscriptions({
      client,
      receiptsSnapshot,
      activeSubscriptions,
      createHandler,
    });

    // No per-run cleanup here; we rely on manageSubscriptions and the unmount cleanup
    return undefined;
  }, [client, threadIdsKey, receiptsByThread, createHandler, overlayStatus]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clean up subscriptions and timers on unmount
      subscriptionsRef.current.forEach((unsubscribe) => unsubscribe?.());
      subscriptionsRef.current = new Map();
      Object.values(typingTimersRef.current).forEach((timer) => clearTimeout(timer));
      typingTimersRef.current = {};
    };
  }, [typingTimersRef]);

  return {
    ensureThreadSubscribed,
  };
}
