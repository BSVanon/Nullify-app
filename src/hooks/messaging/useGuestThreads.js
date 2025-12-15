import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { resolveLocalPublicKey } from "./useGuestThreads/identity";
import {
  getRemoteMessagingPreference,
  setRemoteMessagingPreference,
  subscribeRemoteMessagingPreference,
} from "@/lib/messaging/remotePreferences";
import { walletBootstrap } from "@/lib/walletBootstrap";

import { useOverlayClient } from "./useOverlayClient";
import { useThreadSubscriptions } from "./useThreadSubscriptions";
import { useThreadActions } from "./useGuestThreads/actions";
import { useThreadState, useTypingPreference } from "./useGuestThreads/state";
import { useSendPreference } from "./useGuestThreads/sendPreferences";

export default function useGuestThreads() {
  // Remote API availability tracking (must be declared before useThreadState)
  const [remoteApiAvailable, setRemoteApiAvailable] = useState(null);
  
  const {
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
    receiptsRef,
    typingTimersRef,
    applyConversationUpdate,
    bumpConversationActivity,
    clearTyping,
    load,
    refresh,
    conversationMap,
    unblockInviter,
    isInviterBlocked,
  } = useThreadState(setRemoteApiAvailable);
  const {
    typingIndicatorEnabled,
    setTypingIndicatorEnabled,
    typingEnabledRef,
    setTypingIdentityKey,
  } = useTypingPreference();
  const { sendOnEnter, setSendOnEnter } = useSendPreference();
  const [remoteSyncPreference, setRemoteSyncPreference] = useState(() =>
    getRemoteMessagingPreference(),
  );

  // Overlay client management
  const { client: overlayClient, status: overlayStatus, clientRef: overlayClientRef } = useOverlayClient();

  useEffect(() => {
    const unsubscribe = subscribeRemoteMessagingPreference((next) => {
      setRemoteSyncPreference(next);
    });

    return () => {
      try {
        unsubscribe?.();
      } catch (error) {
        console.warn("[useGuestThreads] failed to unsubscribe remote preference", error);
      }
    };
  }, []);

  const holdersOnly = useMemo(() => {
    const receipts = Object.values(receiptsByThread);
    return (
      receipts.length > 0 &&
      receipts.every((receipt) => receipt?.identityKind === "holder")
    );
  }, [receiptsByThread]);

  const threadIdsKey = useMemo(
    () => Object.keys(receiptsByThread).sort().join("|"),
    [receiptsByThread],
  );

  const remoteSyncStatus = useMemo(() => {
    if (!remoteSyncPreference.configEnabled) {
      return "Multi-device sync not configured";
    }
    if (remoteApiAvailable === false) {
      return "Multi-device sync unavailable (API not deployed)";
    }
    if (!remoteSyncPreference.effective) {
      return "Multi-device sync paused";
    }
    return remoteApiAvailable === true
      ? "Multi-device sync active"
      : "Multi-device sync checking...";
  }, [remoteSyncPreference, remoteApiAvailable]);

  const setRemoteSyncEnabled = useCallback((enabled) => {
    setRemoteMessagingPreference(enabled);
  }, []);

  // Load initial data once on mount
  // Using ref pattern to avoid infinite loop if load dependencies change
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  useEffect(() => {
    loadRef.current();
  }, []); // Empty deps - only run once on mount

  useEffect(() => {
    const receipts = Object.values(receiptsByThread);
    let identityKey = null;

    for (const receipt of receipts) {
      const localKey = resolveLocalPublicKey(receipt);
      if (localKey) {
        identityKey = localKey;
        break;
      }
    }

    if (!identityKey) {
      const walletStatus = walletBootstrap.getStatus?.();
      if (walletStatus?.identityKey) {
        identityKey = walletStatus.identityKey;
      }
    }

    setTypingIdentityKey(identityKey);
  }, [receiptsByThread, setTypingIdentityKey]);

  const {
    blockInviter,
    sendMessage,
    notifyTyping,
    removeThreadLocally,
    upgradeThreadToHolder,
    leaveThread,
    burnThread,
    createNewThread,
    generateThreadInvite,
    updateThreadLabel,
    broadcastProfileUpdate,
  } = useThreadActions({
    receiptsByThread,
    setReceiptsByThread,
    setConversations,
    setMessagesByThread,
    setBlockedInviters,
    receiptsRef,
    applyConversationUpdate,
    bumpConversationActivity,
    clearTyping,
    typingEnabledRef,
    overlayClientRef,
  });

  // Thread subscriptions management (needs removeThreadLocally from actions)
  const { ensureThreadSubscribed } = useThreadSubscriptions({
    client: overlayClient,
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
  });

  return {
    loading,
    conversations,
    messagesByThread,
    typingByThread,
    blockedInviters,
    getConversation: (id) => conversationMap.get(id) || null,
    refresh,
    overlayStatus,
    ensureThreadSubscribed,
    blockInviter,
    unblockInviter,
    isInviterBlocked,
    sendMessage,
    notifyTyping,
    upgradeThreadToHolder,
    leaveThread,
    burnThread,
    createNewThread,
    generateThreadInvite,
    updateThreadLabel,
    broadcastProfileUpdate,
    typingIndicatorEnabled,
    setTypingIndicatorEnabled,
    sendOnEnter,
    setSendOnEnter,
    remoteSyncPreference,
    remoteSyncStatus,
    setRemoteSyncEnabled,
  };
}
