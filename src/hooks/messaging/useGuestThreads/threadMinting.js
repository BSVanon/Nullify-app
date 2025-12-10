import {
  getThreadMetadata,
  saveThreadMetadata,
  updateJoinReceipt,
} from "@/lib/messaging/storage";
import { mintThreadControlToken } from "@/lib/messaging/threadControlToken";
import { mintThreadDataTokens } from "@/lib/messaging/threadDataToken";
import { conversationFromReceipt } from "./converters";
import { enrollThreadHelperCache } from "@/lib/messaging/helperCacheIntegration";

/**
 * Mint a Control Token for a thread after guest upgrade
 * @param {string} threadId - Thread to mint CT for
 * @param {object} receipt - Current receipt for the thread
 * @param {function} setReceiptsByThread - Callback to update receipts
 * @param {function} applyConversationUpdate - Callback to update conversation list
 * @param {object} overlayClientRef - Ref to overlay client for publishing control messages
 * @param {object} receiptsRef - Ref to receipts for immediate access
 * @returns {object} Updated thread metadata
 */
export async function mintThreadCT(
  threadId,
  receipt,
  setReceiptsByThread,
  applyConversationUpdate,
  overlayClientRef,
  receiptsRef,
  { rawThreadKeyBase64 } = {},
) {
  let threadMetadata = await getThreadMetadata(threadId);
  if (!threadMetadata) {
    console.warn("[threadLifecycle] No thread metadata found for CT minting", threadId);
    return null;
  }

  const { encKeyWrap, blobHash } = threadMetadata;
  const rawKeyBase64 = rawThreadKeyBase64 || threadMetadata.rawKeyBase64 || null;
  if (!encKeyWrap || !blobHash) {
    console.warn("[threadLifecycle] Missing encKeyWrap/blobHash for CT mint", threadId, {
      hasEncKeyWrap: Boolean(encKeyWrap),
      hasBlobHash: Boolean(blobHash),
    });
    return null;
  }
  if (!rawKeyBase64) {
    console.warn("[threadLifecycle] Missing raw thread key for DT issuance", threadId);
  }

  const mintedAt = new Date().toISOString();

  try {
    const ctResult = await mintThreadControlToken({
      threadId,
      encKeyWrap,
      blobHash,
      hintURL: threadMetadata.hintURL || "",
      policy: threadMetadata.policy || receipt.policy || "mutual",
    });

    console.log(`[threadLifecycle] CT minted for thread ${threadId}:`, {
      ctTxid: ctResult.txid,
      ctVout: ctResult.vout,
      ctOutpoint: `${ctResult.txid}:${ctResult.vout}`,
    });

    let dtIssuance = null;
    const existingHelperCache = threadMetadata.helperCache || null;
    let helperCacheInfo = existingHelperCache;
    const existingIssuances = Array.isArray(threadMetadata.dtIssuances)
      ? threadMetadata.dtIssuances
      : [];

    // PATENT-CRITICAL: DT minting is MANDATORY, not optional
    if (!rawKeyBase64 || !receipt?.holderPublicKey) {
      throw new Error(
        `[threadLifecycle] Cannot mint DTs: missing rawKeyBase64 or holderPublicKey for thread ${threadId}`,
      );
    }

    try {
      const recipients = [receipt.holderPublicKey];
      if (receipt.guestPublicKey) {
        recipients.push(receipt.guestPublicKey);
      }
      const dtResult = await mintThreadDataTokens({
        ctTxid: ctResult.txid,
        ctVout: ctResult.vout,
        recipientPubkeys: recipients,
        threadKeyBase64: rawKeyBase64,
      });

      dtIssuance = {
        txid: dtResult.txid,
        outputs: dtResult.outputs,
        broadcast: dtResult.broadcast,
        artifacts: dtResult.artifacts,
        issuedAt: new Date().toISOString(),
      };

      console.log(`[threadLifecycle] DT(s) minted for thread ${threadId}:`, {
        dtTxid: dtResult.txid,
        recipients: recipients.length,
        outputs: dtResult.outputs.map(
          (o) => `${dtResult.txid}:${o.vout}  ${o.recipientPubkey.slice(0, 8)}...`,
        ),
      });

      overlayClientRef.current?.publishControl(threadId, {
        action: "mint-dt",
        issuance: dtIssuance,
      });
    } catch (error) {
      console.error(
        "[threadLifecycle] CRITICAL: Failed to mint DTs - thread will be unusable",
        error,
      );
      throw new Error(`DT minting failed for thread ${threadId}: ${error.message}`);
    }

    if (
      (!helperCacheInfo ||
        helperCacheInfo.cacheId !== `${ctResult.txid}:${ctResult.vout}` ||
        helperCacheInfo.enrolled === false) &&
      threadMetadata.encKeyWrap &&
      threadMetadata.blobHash
    ) {
      const helperCachePayload = {
        encKeyWrap: threadMetadata.encKeyWrap,
        blobHash: threadMetadata.blobHash,
        hintURL: threadMetadata.hintURL || "",
        policy: threadMetadata.policy || receipt.policy || "mutual",
      };

      const enrollResult = await enrollThreadHelperCache({
        threadId,
        ctTxid: ctResult.txid,
        ctVout: ctResult.vout,
        payload: helperCachePayload,
        logger: console,
      });

      if (enrollResult) {
        const attemptTimestamp =
          enrollResult.lastAttemptAt || enrollResult.enrolledAt || new Date().toISOString();
        helperCacheInfo = {
          ...existingHelperCache,
          ...enrollResult,
          lastAttemptAt: attemptTimestamp,
          lastFetchAt: existingHelperCache?.lastFetchAt || null,
          lastFetchSucceeded: existingHelperCache?.lastFetchSucceeded ?? null,
        };
      }
    }

    // Determine peer public key and kind for identity tracking
    const peerPublicKey = receipt.guestPublicKey || receipt.holderPublicKey || null;
    const peerKind = receipt.guestPublicKey ? "guest" : "holder";

    // SECURITY: Do NOT persist rawKeyBase64 after DT minting.
    // The raw thread key should only be recoverable via DT unwrapping.
    // Storing it in plaintext undermines the CT/DT security model.
    const metadataToPersist = {
      ...threadMetadata,
      ctTxid: ctResult.txid,
      ctVout: ctResult.vout,
      encKeyWrap: threadMetadata.encKeyWrap,
      blobHash: threadMetadata.blobHash,
      hintURL: threadMetadata.hintURL || "",
      policy: threadMetadata.policy || receipt.policy || "mutual",
      mintedAt,
      lastMintTxid: ctResult.txid,
      ctBroadcast: ctResult.broadcast || threadMetadata.ctBroadcast || null,
      ctArtifacts: ctResult.artifacts || threadMetadata.ctArtifacts || null,
      // rawKeyBase64 intentionally NOT persisted - security measure
      dtIssuances: dtIssuance ? [...existingIssuances, dtIssuance] : existingIssuances,
      helperCache: helperCacheInfo || existingHelperCache || null,
      peerPublicKey,
      peerKind,
    };
    
    // Clear rawKeyBase64 from any existing metadata to prevent leakage
    delete metadataToPersist.rawKeyBase64;

    threadMetadata = await saveThreadMetadata(threadId, metadataToPersist);

    // SECURITY NOTE: rawThreadKeyBase64 is kept in memory for invite generation
    // but NOT persisted to storage. The persisted receipt omits this field.
    // We use the rawKeyBase64 captured at the start of this function (line 37)
    // since threadMetadata was reassigned after saving (which strips the key).
    const rawKeyForInvites = rawKeyBase64;
    
    const nextReceipt = {
      ...receipt,
      ctTxid: ctResult.txid,
      ctVout: ctResult.vout,
      mintedAt,
      lastMintTxid: ctResult.txid,
      threadMetadata,
      dtIssuances: threadMetadata.dtIssuances || [],
      helperCache: threadMetadata.helperCache || null,
      // Keep raw key in memory for invite generation (holder only)
      rawThreadKeyBase64: rawKeyForInvites,
    };

    // Persist updated receipt to storage - explicitly exclude rawThreadKeyBase64
    const { saveJoinReceipt } = await import('@/lib/messaging/storage');
    const receiptToPersist = { ...nextReceipt };
    delete receiptToPersist.rawThreadKeyBase64;
    await saveJoinReceipt(threadId, receiptToPersist);

    setReceiptsByThread((prev) => ({ ...prev, [threadId]: nextReceipt }));
    
    // Update receiptsRef immediately for synchronous access (e.g., invite generation)
    if (receiptsRef?.current) {
      receiptsRef.current[threadId] = nextReceipt;
    }
    
    applyConversationUpdate((prev) => {
      const exists = prev.some((c) => c.id === threadId);
      if (exists) {
        // Update existing conversation
        return prev.map((conversation) =>
          conversation.id === threadId ? conversationFromReceipt(nextReceipt) : conversation,
        );
      } else {
        // Add new conversation
        return [...prev, conversationFromReceipt(nextReceipt)];
      }
    });

    if (ctResult.broadcast) {
      overlayClientRef.current?.publishControl(threadId, {
        action: "mint-ct",
        txid: ctResult.txid,
        vout: ctResult.vout,
        occurredAt: mintedAt,
      });
    }

    return threadMetadata;
  } catch (error) {
    // CRITICAL: CT minting failure should propagate, not be silently swallowed
    console.error("[threadLifecycle] CRITICAL: Failed to mint thread CT", error);
    throw new Error(`CT minting failed for thread ${threadId}: ${error.message}`);
  }
}

export async function mintGuestDTForThread(
  threadId,
  guestPublicKey,
  setReceiptsByThread,
  applyConversationUpdate,
  overlayClientRef,
  { rawThreadKeyBase64 } = {},
) {
  if (!threadId || !guestPublicKey) {
    throw new Error("[threadLifecycle] mintGuestDTForThread requires threadId and guestPublicKey");
  }

  let threadMetadata = await getThreadMetadata(threadId);
  if (!threadMetadata) {
    throw new Error(`[threadLifecycle] No thread metadata found for guest DT mint: ${threadId}`);
  }

  const ctTxid = threadMetadata.ctTxid || null;
  const ctVoutCandidate = Number.isInteger(threadMetadata.ctVout)
    ? threadMetadata.ctVout
    : 0;
  const ctVout = Number.isInteger(ctVoutCandidate) && ctVoutCandidate >= 0 ? ctVoutCandidate : 0;

  if (!ctTxid) {
    throw new Error(`[threadLifecycle] Cannot mint guest DT without CT reference for thread ${threadId}`);
  }

  const rawKeyBase64 = rawThreadKeyBase64 || threadMetadata.rawKeyBase64 || null;
  if (!rawKeyBase64) {
    throw new Error(
      `[threadLifecycle] Cannot mint guest DT: missing raw thread key for thread ${threadId}`,
    );
  }

  const existingIssuances = Array.isArray(threadMetadata.dtIssuances)
    ? threadMetadata.dtIssuances
    : [];

  const dtResult = await mintThreadDataTokens({
    ctTxid,
    ctVout,
    recipientPubkeys: [guestPublicKey],
    threadKeyBase64: rawKeyBase64,
  });

  const dtIssuance = {
    txid: dtResult.txid,
    outputs: dtResult.outputs,
    broadcast: dtResult.broadcast,
    artifacts: dtResult.artifacts,
    issuedAt: new Date().toISOString(),
  };

  console.log(`[threadLifecycle] Guest DT minted for thread ${threadId}:`, {
    dtTxid: dtResult.txid,
    guest: `${guestPublicKey.slice(0, 8)}...`,
    outputs: dtResult.outputs.map((o) => `${dtResult.txid}:${o.vout}`),
  });

  // SECURITY: Ensure rawKeyBase64 is not persisted
  const metadataToSave = {
    ...threadMetadata,
    dtIssuances: [...existingIssuances, dtIssuance],
  };
  delete metadataToSave.rawKeyBase64;
  
  threadMetadata = await saveThreadMetadata(threadId, metadataToSave);

  const updatedReceipt = await updateJoinReceipt(threadId, {
    threadMetadata,
    dtIssuances: threadMetadata.dtIssuances || [],
  });

  if (updatedReceipt) {
    setReceiptsByThread((prev) => ({ ...prev, [threadId]: updatedReceipt }));
    applyConversationUpdate((prev) =>
      prev.map((conversation) =>
        conversation.id === threadId ? conversationFromReceipt(updatedReceipt) : conversation,
      ),
    );
  }

  overlayClientRef.current?.publishControl(threadId, {
    action: "mint-dt",
    issuance: dtIssuance,
  });

  return {
    ctTxid,
    ctVout,
    dtIssuance,
    threadMetadata,
    receipt: updatedReceipt || null,
  };
}
