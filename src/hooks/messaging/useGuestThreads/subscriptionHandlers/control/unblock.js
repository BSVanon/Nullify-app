export async function handleUnblock({
  event,
  threadId,
  receiptsRef,
  setReceiptsByThread,
  setConversations,
  updateJoinReceipt,
  conversationFromReceipt,
}) {
  const actor = event.payload?.actor || "peer";
  let updatedReceipt = null;

  if (typeof updateJoinReceipt === "function") {
    try {
      updatedReceipt = await updateJoinReceipt(threadId, {
        status: "ready",
        blockedAt: null,
        blockedBy: actor === "peer" ? undefined : actor,
      });
    } catch (error) {
      console.error("[guestThreads] failed to persist unblock state", error);
    }
  }

  if (!updatedReceipt) {
    const existing = receiptsRef.current[threadId];
    if (existing) {
      updatedReceipt = {
        ...existing,
        status: existing.status === "blocked" ? "ready" : existing.status,
        blockedAt: null,
        blockedBy: actor === "peer" ? existing.blockedBy : actor,
      };
    }
  }

  if (updatedReceipt) {
    receiptsRef.current[threadId] = updatedReceipt;
    setReceiptsByThread((prev) => ({ ...prev, [threadId]: updatedReceipt }));
    setConversations((prev) =>
      prev.map((conversation) =>
        conversation.id === threadId
          ? conversationFromReceipt(updatedReceipt, { blocked: false })
          : conversation,
      ),
    );
  }
}
