import * as secp from "noble-secp256k1";

import { generateInvite } from "@/lib/messaging/generateInvite";
import { updateJoinReceipt } from "@/lib/messaging/storage";
import { mintGuestDTForThread } from "../threadLifecycle";
import { conversationFromReceipt } from "../converters";
import { getProfile } from "@/lib/identity/profileStore";

const toHex = (uint8) =>
  Array.from(uint8).map((byte) => byte.toString(16).padStart(2, "0")).join("");

export async function generateThreadInviteImpl({
  threadId,
  receiptsByThread,
  receiptsRef,
  setReceiptsByThread,
  applyConversationUpdate,
  overlayClientRef,
}) {
  const receipt = receiptsByThread[threadId] || receiptsRef.current?.[threadId];
  if (!receipt) throw new Error("Thread not found");
  if (receipt.identityKind !== "holder") {
    throw new Error("Only holder threads can generate invites");
  }

  const rawKeyBase64 =
    receipt.rawThreadKeyBase64 || receipt.threadMetadata?.rawKeyBase64;
  if (!rawKeyBase64) {
    throw new Error("Thread key not available for invite generation");
  }

  const guestPrivateKeyBytes = secp.utils.randomPrivateKey();
  const guestPrivateKeyHex = toHex(guestPrivateKeyBytes);
  const guestPublicKey = secp.getPublicKey(guestPrivateKeyHex, true);
  const guestPublicKeyHex =
    typeof guestPublicKey === "string" ? guestPublicKey : toHex(guestPublicKey);

  // PATENT-CRITICAL: DT minting is MANDATORY for invites
  // Without a valid DT, the guest cannot access the thread per the CT/DT primitive
  let tokens;
  const guestDt = await mintGuestDTForThread(
    threadId,
    guestPublicKeyHex,
    setReceiptsByThread,
    applyConversationUpdate,
    overlayClientRef,
    { rawThreadKeyBase64: rawKeyBase64 },
  );

  if (!guestDt || !guestDt.dtIssuance) {
    throw new Error("Failed to mint guest Data Token. Invite cannot be generated without valid DT.");
  }

  const outputs = Array.isArray(guestDt.dtIssuance.outputs)
    ? guestDt.dtIssuance.outputs
    : [];
  const guestOutput =
    outputs.find((o) => o.recipientPubkey === guestPublicKeyHex) ||
    outputs[0] ||
    null;

  if (!guestOutput) {
    throw new Error("Guest DT output not found in issuance. Invite cannot be generated.");
  }

  tokens = {
    ct: { txid: guestDt.ctTxid, vout: guestDt.ctVout },
    dtIssuance: {
      txid: guestDt.dtIssuance.txid,
      outputs: [
        {
          recipientPubkey: guestPublicKeyHex,
          vout: guestOutput.vout,
        },
      ],
    },
  };

  // Fetch holder's profile to include in invite
  let inviterProfile = null;
  try {
    const profile = await getProfile(receipt.holderPublicKey);
    if (profile && profile.displayName) {
      inviterProfile = {
        displayName: profile.displayName,
        avatarHash: profile.avatarHash
      };
    }
  } catch (error) {
    console.warn("[guestThreads] Failed to fetch holder profile for invite", error);
  }

  const inviteUrl = await generateInvite({
    threadId,
    holderPublicKey: receipt.holderPublicKey,
    holderName: receipt.label || "Thread Creator",
    threadKeyBase64: rawKeyBase64,
    policy: receipt.policy || "mutual",
    guestPrivateKeyHex,
    guestPublicKey: guestPublicKeyHex,
    tokens,
    inviterProfile,
  });

  try {
    const updatedReceipt = await updateJoinReceipt(threadId, {
      guestPublicKey: guestPublicKeyHex,
    });

    if (updatedReceipt) {
      setReceiptsByThread((prev) => ({
        ...prev,
        [threadId]: updatedReceipt,
      }));
      applyConversationUpdate((prev) =>
        prev.map((conversation) =>
          conversation.id === threadId
            ? conversationFromReceipt(updatedReceipt, {
                blocked: conversation.blocked,
              })
            : conversation,
        ),
      );
    }
  } catch (error) {
    console.warn(
      "[guestThreads] Failed to persist guestPublicKey on holder receipt",
      {
        threadId,
        error,
      },
    );
  }

  return inviteUrl;
}
