export async function handleMintDt({
  event,
  threadId,
  receiptsRef,
  setReceiptsByThread,
  setConversations,
  updateThreadMetadata,
  conversationFromReceipt,
}) {
  const issuance = event.payload?.issuance;
  if (!issuance) return;

  const receiptSnapshot = receiptsRef.current[threadId];
  const existingIssuances = Array.isArray(receiptSnapshot?.dtIssuances)
    ? receiptSnapshot.dtIssuances
    : Array.isArray(receiptSnapshot?.threadMetadata?.dtIssuances)
      ? receiptSnapshot.threadMetadata.dtIssuances
      : [];

  const alreadyPresent = existingIssuances.some((entry) => entry?.txid && entry.txid === issuance.txid);
  const nextIssuances = alreadyPresent ? existingIssuances : [...existingIssuances, issuance];

  if (!alreadyPresent && typeof updateThreadMetadata === "function") {
    try {
      await updateThreadMetadata(threadId, { dtIssuances: nextIssuances });
    } catch (error) {
      console.warn("[guestThreads] failed to persist thread metadata from mint-dt", error);
    }
  }

  let updatedReceipt = null;
  setReceiptsByThread((prev) => {
    const receipt = prev[threadId];
    if (!receipt) return prev;

    const receiptIssuances = Array.isArray(receipt.dtIssuances) ? receipt.dtIssuances : [];
    if (receiptIssuances.some((entry) => entry?.txid === issuance.txid)) {
      return prev;
    }

    const mergedIssuances = [...receiptIssuances, issuance];
    updatedReceipt = {
      ...receipt,
      dtIssuances: mergedIssuances,
      threadMetadata: {
        ...(receipt.threadMetadata || {}),
        dtIssuances: mergedIssuances,
      },
    };
    receiptsRef.current[threadId] = updatedReceipt;
    return { ...prev, [threadId]: updatedReceipt };
  });

  if (updatedReceipt) {
    setConversations((prev) =>
      prev.map((conversation) =>
        conversation.id === threadId
          ? conversationFromReceipt(updatedReceipt, { blocked: conversation.blocked })
          : conversation,
      ),
    );
  }
}
