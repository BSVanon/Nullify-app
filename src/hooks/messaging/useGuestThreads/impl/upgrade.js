import { performGuestUpgrade } from "@/lib/messaging/guestUpgrade";
import {
  deleteGuestIdentity,
  getGuestIdentity,
  updateJoinReceipt,
} from "@/lib/messaging/storage";
import { walletBootstrap } from "@/lib/walletBootstrap";
import { mintThreadCT } from "../threadLifecycle";
import { conversationFromReceipt } from "../converters";
import { sendMessageImpl } from "./messaging";

async function postUpgradeSatsHint({
  threadId,
  receiptsByThread,
  setMessagesByThread,
  bumpConversationActivity,
  overlayClientRef,
  walletPublicKey,
}) {
  if (!threadId || !walletPublicKey) return;
  const text =
    "🎉 I just linked a Bitcoin wallet! You can now send sats to help cover messaging fees.\n\nWallet: " +
    walletPublicKey;
  try {
    console.info("[guestThreads] postUpgradeSatsHint sending sats hint", {
      threadId,
      walletPublicKey,
    });
    await sendMessageImpl({
      threadId,
      author: "self",
      text,
      receiptsByThread,
      setMessagesByThread,
      bumpConversationActivity,
      overlayClientRef,
    });
  } catch (error) {
    console.warn("[guestThreads] failed to send upgrade sats hint message", error);
  }
}

export async function upgradeThreadToHolderImpl({
  threadId,
  receiptsByThread,
  setReceiptsByThread,
  applyConversationUpdate,
  overlayClientRef,
  receiptsRef,
  setMessagesByThread,
  bumpConversationActivity,
}) {
  const receipt = receiptsByThread[threadId];
  if (!receipt) throw new Error("Join receipt not found");
  if (receipt.identityKind === "holder") return receipt;

  const result = await performGuestUpgrade({
    threadId,
    receipt,
    getGuestIdentity,
    updateJoinReceipt,
    deleteGuestIdentity,
    walletBootstrap,
  });

  const threadMetadata = await mintThreadCT(
    threadId,
    result.receipt,
    setReceiptsByThread,
    applyConversationUpdate,
    overlayClientRef,
    receiptsRef,
    { rawThreadKeyBase64: result.rawThreadKeyBase64 },
  );

  const nextReceipt = threadMetadata
    ? {
        ...result.receipt,
        ctTxid: threadMetadata.ctTxid,
        ctVout: threadMetadata.ctVout,
        mintedAt: threadMetadata.mintedAt,
        lastMintTxid: threadMetadata.lastMintTxid,
        threadMetadata,
      }
    : result.receipt;

  setReceiptsByThread((prev) => ({ ...prev, [threadId]: nextReceipt }));
  applyConversationUpdate((prev) =>
    prev.map((conversation) =>
      conversation.id === threadId
        ? conversationFromReceipt(nextReceipt)
        : conversation,
    ),
  );

  if (result.controlPayload) {
    overlayClientRef.current?.publishControl(threadId, result.controlPayload);
  }

  const walletPublicKey =
    result.controlPayload?.walletPublicKey || nextReceipt.holderPublicKey;
  if (walletPublicKey && setMessagesByThread && bumpConversationActivity) {
    const receiptsWithUpgrade = {
      ...receiptsByThread,
      [threadId]: nextReceipt,
    };
    await postUpgradeSatsHint({
      threadId,
      receiptsByThread: receiptsWithUpgrade,
      setMessagesByThread,
      bumpConversationActivity,
      overlayClientRef,
      walletPublicKey,
    });
  }

  return result.receipt;
}
