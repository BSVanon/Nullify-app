import { updateJoinReceipt } from "@/lib/messaging/storage";
import { conversationFromReceipt } from "../converters";

export async function updateThreadLabelImpl({
  threadId,
  label,
  receiptsByThread,
  setReceiptsByThread,
  applyConversationUpdate,
}) {
  const receipt = receiptsByThread[threadId];
  if (!receipt) {
    throw new Error("Thread not found");
  }

  const updatedReceipt = await updateJoinReceipt(threadId, {
    label: label || null,
  });

  if (updatedReceipt) {
    setReceiptsByThread((prev) => ({
      ...prev,
      [threadId]: updatedReceipt,
    }));

    const updatedConversation = conversationFromReceipt(updatedReceipt);
    applyConversationUpdate((prev) =>
      prev.map((c) => (c.id === threadId ? updatedConversation : c)),
    );
  }

  return updatedReceipt;
}
