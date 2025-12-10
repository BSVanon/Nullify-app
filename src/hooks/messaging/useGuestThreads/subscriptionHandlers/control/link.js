export async function handleLink({
  event,
  threadId,
  receiptsRef,
  setReceiptsByThread,
  setConversations,
  conversationFromReceipt,
  updateJoinReceipt,
}) {
  const walletKey = event.payload?.walletPublicKey;
  const upgradedAt = event.payload?.upgradedAt;
  if (!walletKey) return;

  let nextReceipt = null;
  setReceiptsByThread((prev) => {
    const receipt = prev[threadId];
    if (!receipt) return prev;

    // Case 1: local device was guest and is now linking to a wallet (upgrade in place)
    if (receipt.identityKind === "guest") {
      nextReceipt = {
        ...receipt,
        identityKind: "holder",
        holderPublicKey: walletKey,
        upgradedAt,
        // Preserve original holder wallet as peerWalletPublicKey if not already set
        peerWalletPublicKey:
          receipt.peerWalletPublicKey || receipt.holderPublicKey || null,
      };
      receiptsRef.current[threadId] = nextReceipt;
      return { ...prev, [threadId]: nextReceipt };
    }

    // Case 2: local device is already a holder (peer upgraded). Record peer wallet identity.
    if (
      receipt.identityKind === "holder" &&
      walletKey &&
      walletKey !== receipt.holderPublicKey
    ) {
      nextReceipt = {
        ...receipt,
        peerWalletPublicKey: walletKey,
      };
      receiptsRef.current[threadId] = nextReceipt;
      return { ...prev, [threadId]: nextReceipt };
    }

    return prev;
  });

  if (nextReceipt) {
    if (typeof updateJoinReceipt === "function") {
      try {
        updateJoinReceipt(threadId, nextReceipt);
      } catch (error) {
        console.warn("[guestThreads] failed to persist link state", error);
      }
    }

    setConversations((prev) =>
      prev.map((conversation) =>
        conversation.id === threadId
          ? conversationFromReceipt(nextReceipt)
          : conversation,
      ),
    );
  }
}
