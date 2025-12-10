export async function handleBlock({
  event,
  threadId,
  receiptsRef,
  setReceiptsByThread,
  setConversations,
  updateJoinReceipt,
  conversationFromReceipt,
}) {
  const blockedAt = event.payload?.blockedAt || new Date().toISOString();
  const actor = event.payload?.actor || "peer";
  let updatedReceipt = null;

  if (typeof updateJoinReceipt === "function") {
    try {
      updatedReceipt = await updateJoinReceipt(threadId, {
        status: "blocked",
        blockedAt,
        blockedBy: actor,
      });
    } catch (error) {
      console.error("[guestThreads] failed to persist block state", error);
    }
  }

  if (!updatedReceipt) {
    const existing = receiptsRef.current[threadId];
    if (existing) {
      updatedReceipt = {
        ...existing,
        status: "blocked",
        blockedAt,
        blockedBy: actor,
      };
    }
  }

  if (updatedReceipt) {
    receiptsRef.current[threadId] = updatedReceipt;
    setReceiptsByThread((prev) => ({ ...prev, [threadId]: updatedReceipt }));
    setConversations((prev) =>
      prev.map((conversation) =>
        conversation.id === threadId
          ? conversationFromReceipt(updatedReceipt, { blocked: true })
          : conversation,
      ),
    );
  }
}
