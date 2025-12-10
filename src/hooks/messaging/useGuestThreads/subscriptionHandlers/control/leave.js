export async function handleLeave({
  event,
  threadId,
  receiptsRef,
  setReceiptsByThread,
  setConversations,
  clearTyping,
  updateJoinReceipt,
  conversationFromReceipt,
}) {
  const receiptSnapshot = receiptsRef.current[threadId];
  if (!receiptSnapshot) return;

  const leftAt = event.payload?.occurredAt || new Date().toISOString();

  let updatedReceipt = null;
  if (typeof updateJoinReceipt === "function") {
    try {
      updatedReceipt = await updateJoinReceipt(threadId, {
        peerLeft: true,
        peerLeftAt: leftAt,
      });
    } catch (error) {
      console.error("[guestThreads] failed to persist peer left state", error);
    }
  }

  if (!updatedReceipt) {
    updatedReceipt = {
      ...receiptSnapshot,
      peerLeft: true,
      peerLeftAt: leftAt,
    };
  }

  setReceiptsByThread((prev) => ({ ...prev, [threadId]: updatedReceipt }));
  setConversations((prev) =>
    prev.map((conversation) =>
      conversation.id === threadId
        ? conversationFromReceipt(updatedReceipt)
        : conversation,
    ),
  );

  clearTyping(threadId);
}
