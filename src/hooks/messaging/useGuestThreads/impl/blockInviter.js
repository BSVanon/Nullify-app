import {
  deleteGuestIdentity,
  deleteJoinReceipt,
  purgeVaultForThread,
  saveBlockedInviter,
} from "@/lib/messaging/storage";

export async function blockInviterImpl({
  inviterId,
  metadata = {},
  receiptsRef,
  setBlockedInviters,
  setReceiptsByThread,
  setMessagesByThread,
  clearTyping,
  overlayClientRef,
  applyConversationUpdate,
}) {
  if (!inviterId) return;

  const blockedAt = metadata.blockedAt || new Date().toISOString();
  const entry = await saveBlockedInviter(inviterId, {
    reason: metadata.reason || "user_action",
    blockedVia: metadata.source || "thread_view",
    lastThreadId: metadata.threadId || null,
    blockedAt,
  });
  setBlockedInviters((prev) => {
    const without = prev.filter((item) => item.id !== inviterId);
    return [...without, entry];
  });

  const receiptsSnapshot = receiptsRef.current;
  const threadsToRemove = Object.values(receiptsSnapshot)
    .filter((receipt) => receipt?.inviter === inviterId)
    .map((receipt) => receipt.threadId);

  if (metadata.threadId && !threadsToRemove.includes(metadata.threadId)) {
    threadsToRemove.push(metadata.threadId);
  }

  if (!threadsToRemove.length) return;

  threadsToRemove.forEach((id) => {
    overlayClientRef.current?.publishControl(id, {
      action: "block",
      actor: "self",
      blockedAt,
    });
  });

  const receiptsById = threadsToRemove
    .map((id) => receiptsSnapshot[id])
    .filter(Boolean);

  await Promise.all(
    threadsToRemove.map((id, index) =>
      Promise.all([
        purgeVaultForThread(id),
        deleteJoinReceipt(id),
        receiptsById[index]?.guestIdentityId
          ? deleteGuestIdentity(receiptsById[index].guestIdentityId)
          : Promise.resolve(),
      ]),
    ),
  );

  setReceiptsByThread((prev) => {
    const next = { ...prev };
    threadsToRemove.forEach((id) => delete next[id]);
    return next;
  });

  applyConversationUpdate((prev) =>
    prev.filter((conv) => !threadsToRemove.includes(conv.id)),
  );

  setMessagesByThread((prev) => {
    const next = { ...prev };
    threadsToRemove.forEach((id) => delete next[id]);
    return next;
  });

  threadsToRemove.forEach((id) => clearTyping(id));
}
