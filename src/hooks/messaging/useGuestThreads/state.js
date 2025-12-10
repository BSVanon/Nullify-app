import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  conversationFromReceipt,
  messageFromVault,
} from "./converters";
import {
  listBlockedInviters,
  listJoinReceipts,
  listThreadMetadata,
  listVaultMessages,
  removeBlockedInviter,
  updateThreadMetadata,
} from "@/lib/messaging/storage";
import { CONFIG } from "@/lib/config";
import {
  isRemoteMessagingAllowed,
  subscribeRemoteMessagingPreference,
} from "@/lib/messaging/remotePreferences";
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
import { useLoadState } from "./loadState";
import { useRemoteSyncState } from "./remoteSyncState";
import { useBlockingState } from "./blockingState";

export { useTypingPreference } from "./typingPreferences";

export function useThreadState(setRemoteApiAvailable) {
  const [receiptsByThread, setReceiptsByThread] = useState({});
  const [conversations, setConversations] = useState([]);
  const [messagesByThread, setMessagesByThread] = useState({});
  const [typingByThread, setTypingByThread] = useState({});
  const [blockedInviters, setBlockedInviters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [remoteAllowed, setRemoteAllowed] = useState(() => isRemoteMessagingAllowed());

  const receiptsRef = useRef({});
  const typingTimersRef = useRef({});
  const loadInFlightRef = useRef(0);

  const applyConversationUpdate = useCallback(
    (updater) =>
      setConversations((prev) => {
        const next = updater(prev);
        if (next === prev) return prev;
        return sortConversationsByActivity(next);
      }),
    [],
  );

  const bumpConversationActivity = useCallback(
    (threadId, iso) => {
      if (!threadId) return;
      const timestamp = iso || new Date().toISOString();
      applyConversationUpdate((prev) => {
        let touched = false;
        const next = prev.map((conversation) => {
          if (conversation.id !== threadId) return conversation;
          touched = true;
          
          // Update preview with last message text
          const threadMessages = messagesByThread[threadId] || [];
          const receipt = receiptsByThread[threadId];
          let preview = conversation.preview;
          if (threadMessages.length > 0 && receipt) {
            const lastMsg = threadMessages[threadMessages.length - 1];
            const msgText = lastMsg.text || 'No messages yet';
            // Get local pubkey to identify own messages (author is normalized to pubkey)
            const localPubkey = receipt.guestPublicKey || receipt.holderPublicKey;
            const isOwnMessage = lastMsg.author === localPubkey || lastMsg.author === 'self';
            preview = isOwnMessage ? `You: ${msgText}` : msgText;
          }
          
          return {
            ...conversation,
            lastActivityIso: timestamp,
            lastActivity: formatActivityTime(timestamp),
            preview,
          };
        });
        return touched ? next : prev;
      });
    },
    [applyConversationUpdate, messagesByThread, receiptsByThread],
  );

  const clearTyping = useCallback((threadId) => {
    if (!threadId) return;
    setTypingByThread((prev) => {
      if (!prev[threadId]) return prev;
      const next = { ...prev };
      delete next[threadId];
      return next;
    });
    const existing = typingTimersRef.current[threadId];
    if (existing) {
      clearTimeout(existing);
      delete typingTimersRef.current[threadId];
    }
  }, []);

  const { load } = useLoadState({
    setReceiptsByThread,
    setConversations,
    setMessagesByThread,
    setBlockedInviters,
    setLoading,
    loadInFlightRef,
    applyConversationUpdate,
    bumpConversationActivity,
    setRemoteApiAvailable,
  });

  const { unblockInviter, isInviterBlocked } = useBlockingState({ blockedInviters, load });

  useEffect(() => {
    receiptsRef.current = receiptsByThread;
  }, [receiptsByThread]);

  const refresh = useCallback(() => load(), [load]);

  const conversationMap = useMemo(
    () => new Map(conversations.map((conv) => [conv.id, conv])),
    [conversations],
  );

  useEffect(() => {
    const unsubscribe = subscribeRemoteMessagingPreference((preference) => {
      setRemoteAllowed(preference.effective);
    });

    return () => {
      try {
        unsubscribe?.();
      } catch (error) {
        console.warn("[guestThreads] failed to unsubscribe remote preference in state", error);
      }
    };
  }, []);

  useRemoteSyncState({ remoteAllowed, load });

  return {
    // state
    receiptsByThread,
    setReceiptsByThread,
    conversations,
    setConversations,
    messagesByThread,
    setMessagesByThread,
    typingByThread,
    setTypingByThread,
    blockedInviters,
    setBlockedInviters,
    loading,
    setLoading,
    receiptsRef,
    typingTimersRef,
    // helpers
    applyConversationUpdate,
    bumpConversationActivity,
    clearTyping,
    load,
    refresh,
    conversationMap,
    unblockInviter,
    isInviterBlocked,
  };
}
