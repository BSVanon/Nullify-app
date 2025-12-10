export async function handleMintCt({
  event,
  threadId,
  receiptsRef,
  setReceiptsByThread,
  setConversations,
  updateThreadMetadata,
  conversationFromReceipt,
}) {
  const txid = event.payload?.txid || event.payload?.ctTxid || null;
  const rawVout = event.payload?.vout ?? event.payload?.ctVout;
  const mintedAt = event.payload?.occurredAt || new Date().toISOString();
  const normalizedVout = Number.isInteger(rawVout) && rawVout >= 0 ? rawVout : null;

  if (typeof updateThreadMetadata === "function") {
    try {
      await updateThreadMetadata(threadId, {
        ctTxid: txid || null,
        ctVout: normalizedVout,
        mintedAt,
        lastMintTxid: txid || null,
      });
    } catch (error) {
      console.warn("[guestThreads] failed to persist thread metadata from mint-ct", error);
    }
  }

  let updatedReceipt = null;
  setReceiptsByThread((prev) => {
    const receipt = prev[threadId];
    if (!receipt) return prev;

    const receiptVout = Number.isInteger(receipt.ctVout) ? receipt.ctVout : null;
    const ctVout = normalizedVout ?? receiptVout;
    updatedReceipt = {
      ...receipt,
      ctTxid: txid || receipt.ctTxid || null,
      ctVout,
      mintedAt: mintedAt || receipt.mintedAt || null,
      lastMintTxid: txid || receipt.lastMintTxid || null,
      threadMetadata: {
        ...(receipt.threadMetadata || {}),
        ctTxid: txid || receipt.threadMetadata?.ctTxid || null,
        ctVout,
        mintedAt: mintedAt || receipt.threadMetadata?.mintedAt || null,
        lastMintTxid: txid || receipt.threadMetadata?.lastMintTxid || null,
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
