import { createHolderThread } from "@/lib/messaging/createHolderThread";
import { walletBootstrap } from "@/lib/walletBootstrap";
import {
  burnThreadAction,
  leaveThreadAction,
  mintThreadCT,
} from "../threadLifecycle";
import { conversationFromReceipt } from "../converters";

export async function leaveThreadImpl({
  threadId,
  receiptsByThread,
  overlayClientRef,
  removeThreadLocally,
}) {
  const receipt = receiptsByThread[threadId];
  await leaveThreadAction(threadId, receipt, removeThreadLocally, overlayClientRef);
}

export async function burnThreadImpl({
  threadId,
  receiptsByThread,
  applyConversationUpdate,
  setReceiptsByThread,
  overlayClientRef,
}) {
  const receipt = receiptsByThread[threadId];
  return await burnThreadAction(
    threadId,
    receipt,
    applyConversationUpdate,
    setReceiptsByThread,
    overlayClientRef,
  );
}

export async function createNewThreadImpl({
  setReceiptsByThread,
  applyConversationUpdate,
  overlayClientRef,
  receiptsRef,
}) {
  const result = await createHolderThread({ walletBootstrap });

  // mintThreadCT updates the receipt internally and returns the updated metadata
  const threadMetadata = await mintThreadCT(
    result.receipt.threadId,
    result.receipt,
    setReceiptsByThread,
    applyConversationUpdate,
    overlayClientRef,
    receiptsRef,
    { rawThreadKeyBase64: result.rawKeyBase64 },
  );

  // Construct the updated receipt to return immediately (state updates are async)
  const updatedReceipt = threadMetadata
    ? {
        ...result.receipt,
        ctTxid: threadMetadata.ctTxid,
        ctVout: threadMetadata.ctVout,
        mintedAt: threadMetadata.mintedAt,
        lastMintTxid: threadMetadata.lastMintTxid,
        threadMetadata,
        dtIssuances: threadMetadata.dtIssuances || [],
        helperCache: threadMetadata.helperCache || null,
        rawThreadKeyBase64: result.rawKeyBase64,
      }
    : result.receipt;

  return updatedReceipt;
}
