import { purgeVaultForThread } from "@/lib/messaging/storage";

export async function handleBurn({
  event,
  threadId,
  receiptsRef,
  setReceiptsByThread,
  setConversations,
  setMessagesByThread,
  clearTyping,
  updateJoinReceipt,
  deleteGuestIdentity,
  conversationFromReceipt,
}) {
  const receiptSnapshot = receiptsRef.current[threadId];
  const burnedAt = event.payload?.occurredAt || new Date().toISOString();
  const actor = event.payload?.actor || "peer";

  await purgeVaultForThread(threadId);

  if (receiptSnapshot?.guestIdentityId && typeof deleteGuestIdentity === "function") {
    try {
      await deleteGuestIdentity(receiptSnapshot.guestIdentityId);
    } catch (error) {
      console.error("[guestThreads] failed to delete guest identity after burn", error);
    }
  }

  let updatedReceipt = null;
  if (typeof updateJoinReceipt === "function") {
    try {
      updatedReceipt = await updateJoinReceipt(threadId, {
        status: "burned",
        burnedAt,
        burnedBy: actor,
      });
    } catch (error) {
      console.error("[guestThreads] failed to persist burn state", error);
    }
  }

  if (!updatedReceipt) {
    const existing = receiptsRef.current[threadId];
    if (existing) {
      updatedReceipt = {
        ...existing,
        status: "burned",
        burnedAt,
        burnedBy: actor,
      };
    }
  }

  if (updatedReceipt) {
    receiptsRef.current[threadId] = updatedReceipt;
    setReceiptsByThread((prev) => ({ ...prev, [threadId]: updatedReceipt }));
    setConversations((prev) =>
      prev.map((conversation) =>
        conversation.id === threadId
          ? conversationFromReceipt(updatedReceipt)
          : conversation,
      ),
    );
  }

  setMessagesByThread((prev) => ({ ...prev, [threadId]: [] }));
  clearTyping(threadId);
}
