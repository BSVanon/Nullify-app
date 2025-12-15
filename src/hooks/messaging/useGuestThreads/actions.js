import { useCallback } from "react";

import { blockInviterImpl } from "./impl/blockInviter";
import {
  sendMessageImpl,
  notifyTypingImpl,
  removeThreadLocallyImpl,
} from "./impl/messaging";
import { upgradeThreadToHolderImpl } from "./impl/upgrade";
import {
  leaveThreadImpl,
  burnThreadImpl,
  createNewThreadImpl,
} from "./impl/threads";
import { generateThreadInviteImpl } from "./impl/invites";
import { updateThreadLabelImpl } from "./impl/threadLabel";

export function useThreadActions({
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
}) {
  const blockInviter = useCallback(
    async (inviterId, metadata = {}) => {
      await blockInviterImpl({
        inviterId,
        metadata,
        receiptsRef,
        setBlockedInviters,
        setReceiptsByThread,
        setMessagesByThread,
        clearTyping,
        overlayClientRef,
        applyConversationUpdate,
      });
    },
    [
      applyConversationUpdate,
      clearTyping,
      overlayClientRef,
      receiptsRef,
      setBlockedInviters,
      setMessagesByThread,
      setReceiptsByThread,
    ],
  );

  const sendMessage = useCallback(
    async (threadId, { author, text }) => {
      // DT Validation (Patent-Critical): Verify access token before allowing message
      return sendMessageImpl({
        threadId,
        author,
        text,
        receiptsByThread,
        setMessagesByThread,
        bumpConversationActivity,
        overlayClientRef,
      });
    },
    [bumpConversationActivity, overlayClientRef, receiptsByThread, setMessagesByThread],
  );

  const notifyTyping = useCallback(
    (threadId) => {
      return notifyTypingImpl({
        threadId,
        receiptsByThread,
        typingEnabledRef,
        overlayClientRef,
      });
    },
    [overlayClientRef, receiptsByThread, typingEnabledRef],
  );

  const removeThreadLocally = useCallback(
    (threadId) => {
      removeThreadLocallyImpl({
        threadId,
        setReceiptsByThread,
        applyConversationUpdate,
        setMessagesByThread,
        clearTyping,
      });
    },
    [applyConversationUpdate, clearTyping, setMessagesByThread, setReceiptsByThread],
  );

  const upgradeThreadToHolder = useCallback(
    async (threadId) => {
      return upgradeThreadToHolderImpl({
        threadId,
        receiptsByThread,
        setReceiptsByThread,
        applyConversationUpdate,
        overlayClientRef,
        receiptsRef,
        setMessagesByThread,
        bumpConversationActivity,
      });
    },
    [
      applyConversationUpdate,
      bumpConversationActivity,
      overlayClientRef,
      receiptsByThread,
      receiptsRef,
      setMessagesByThread,
      setReceiptsByThread,
    ],
  );

  const leaveThread = useCallback(
    async (threadId) => {
      await leaveThreadImpl({
        threadId,
        receiptsByThread,
        overlayClientRef,
        removeThreadLocally,
      });
    },
    [overlayClientRef, receiptsByThread, removeThreadLocally],
  );

  const burnThread = useCallback(
    async (threadId) => {
      return burnThreadImpl({
        threadId,
        receiptsByThread,
        applyConversationUpdate,
        setReceiptsByThread,
        overlayClientRef,
      });
    },
    [applyConversationUpdate, overlayClientRef, receiptsByThread, setReceiptsByThread],
  );

  const createNewThread = useCallback(
    async () => {
      // Mint CT immediately after thread creation
      return createNewThreadImpl({
        setReceiptsByThread,
        applyConversationUpdate,
        overlayClientRef,
        receiptsRef,
      });
    },
    [applyConversationUpdate, overlayClientRef, receiptsRef, setReceiptsByThread],
  );

  const generateThreadInvite = useCallback(
    async (threadId) => {
      return generateThreadInviteImpl({
        threadId,
        receiptsByThread,
        receiptsRef,
        setReceiptsByThread,
        applyConversationUpdate,
        overlayClientRef,
      });
    },
    [
      applyConversationUpdate,
      overlayClientRef,
      receiptsByThread,
      receiptsRef,
      setReceiptsByThread,
    ],
  );

  const updateThreadLabel = useCallback(
    async (threadId, label) => {
      return updateThreadLabelImpl({
        threadId,
        label,
        receiptsByThread,
        setReceiptsByThread,
        applyConversationUpdate,
      });
    },
    [applyConversationUpdate, receiptsByThread, setReceiptsByThread],
  );

  // Broadcast profile update to all active threads
  const broadcastProfileUpdate = useCallback(
    async ({ displayName, avatarHash }) => {
      const threadIds = Object.keys(receiptsByThread);
      if (threadIds.length === 0) return;

      const publicKey = Object.values(receiptsByThread)[0]?.holderPublicKey ||
                        Object.values(receiptsByThread)[0]?.guestPublicKey;
      if (!publicKey) return;

      const payload = {
        action: 'profile-update',
        publicKey,
        displayName,
        avatarHash: avatarHash || null,
        updatedAt: new Date().toISOString(),
      };

      console.log('[broadcastProfileUpdate] Broadcasting to', threadIds.length, 'threads:', payload);

      // Broadcast to all active threads
      threadIds.forEach((threadId) => {
        overlayClientRef.current?.publishControl(threadId, payload);
      });
    },
    [receiptsByThread, overlayClientRef],
  );

  return {
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
  };
}
