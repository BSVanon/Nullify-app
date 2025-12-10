import {
  deleteGuestIdentity,
  deleteJoinReceipt,
  getThreadMetadata,
  purgeVaultForThread,
  updateJoinReceipt,
  updateThreadMetadata,
} from "@/lib/messaging/storage";
import { burnThreadControlToken } from "@/lib/messaging/threadControlToken";
import { deleteThreadBackup } from "@/lib/messaging/threadBackup";
import { conversationFromReceipt } from "./converters";

/**
 * Leave a thread and clean up local state
 * @param {string} threadId - Thread to leave
 * @param {object} receipt - Current receipt for the thread
 * @param {function} removeThreadLocally - Callback to remove thread from UI
 * @param {object} overlayClientRef - Ref to overlay client for publishing control messages
 */
export async function leaveThreadAction(threadId, receipt, removeThreadLocally, overlayClientRef) {
  if (!threadId) return;
  
  console.log('[threadLifecycle] leaveThreadAction starting', { threadId, status: receipt?.status });
  
  const identityId = receipt?.guestIdentityId;
  const isBurnedStub = receipt?.status === "burned";
  
  // Publish leave control BEFORE cleaning up local state
  // This ensures the peer gets notified before we lose connection
  if (!isBurnedStub) {
    overlayClientRef.current?.publishControl(threadId, {
      action: "leave",
      occurredAt: new Date().toISOString(),
    });
  }
  
  // Clean up local state
  // SECURITY: Zeroize all key material when leaving thread
  
  // First, mark the receipt as dismissed (fallback in case delete fails)
  // This ensures the thread won't reappear on reload even if delete fails
  const dismissedAt = new Date().toISOString();
  try {
    // For burned stubs, preserve the burned status when marking as dismissed
    const dismissUpdate = isBurnedStub
      ? { dismissedAt, status: 'burned' }
      : { dismissedAt };
    await updateJoinReceipt(threadId, dismissUpdate);
    console.log('[threadLifecycle] Marked receipt as dismissed', { threadId, isBurnedStub });
  } catch (error) {
    console.warn('[threadLifecycle] Failed to mark receipt as dismissed', threadId, error);
  }
  
  // Then delete the receipt
  try {
    console.log('[threadLifecycle] Deleting join receipt for thread', threadId);
    await deleteJoinReceipt(threadId);
    console.log('[threadLifecycle] Join receipt deleted successfully', threadId);
  } catch (error) {
    console.error('[threadLifecycle] Failed to delete join receipt', threadId, error);
  }

  // Build metadata update - preserve burn info for burned stubs so the filter works on reload
  const metadataUpdate = {
    ctTxid: null,
    ctVout: null,
    encKeyWrap: null,
    rawKeyBase64: null,
    ctEncKeyWrapped: null,
    blobHash: null,
    hintURL: null,
    lastMintTxid: null,
    ctBroadcast: null,
    ctArtifacts: null,
    // Also clear helper cache info to prevent re-fetching
    helperCache: null,
    // Mark as dismissed in metadata too
    dismissedAt,
  };
  
  // For burned stubs, preserve burn info in metadata so it doesn't get cleared
  // This ensures the loadState filter can still identify burned+dismissed threads
  if (!isBurnedStub) {
    metadataUpdate.burnTxid = null;
    metadataUpdate.burnedAt = null;
    metadataUpdate.burnedBy = null;
  }

  await Promise.all([
    identityId ? deleteGuestIdentity(identityId).catch((error) => {
      console.warn('[threadLifecycle] Failed to delete guest identity', identityId, error);
    }) : Promise.resolve(),
    updateThreadMetadata(threadId, metadataUpdate).catch((error) => {
      console.warn('[threadLifecycle] Failed to clear thread metadata on leave', threadId, error);
    }),
  ]);
  
  await purgeVaultForThread(threadId);
  removeThreadLocally(threadId);
  
  console.log('[threadLifecycle] leaveThreadAction completed', threadId);
}

/**
 * Burn a thread's Control Token and update state
 * @param {string} threadId - Thread to burn
 * @param {object} receipt - Current receipt for the thread
 * @param {function} applyConversationUpdate - Callback to update conversation list
 * @param {function} setReceiptsByThread - Callback to update receipts
 * @param {object} overlayClientRef - Ref to overlay client for publishing control messages
 * @returns {object} Updated receipt
 */
export async function burnThreadAction(threadId, receipt, applyConversationUpdate, setReceiptsByThread, overlayClientRef) {
  console.log('[burnThreadAction] Starting burn for thread:', threadId)
  console.log('[burnThreadAction] Receipt status:', receipt?.status)
  
  if (!threadId) {
    console.warn('[burnThreadAction] No threadId provided')
    return;
  }
  if (receipt?.status === "burned") {
    console.log('[burnThreadAction] Thread already burned, skipping')
    return receipt;
  }

  console.log('[burnThreadAction] Loading thread metadata...')
  const threadMetadata = await getThreadMetadata(threadId);
  const ctTxid =
    receipt?.ctTxid || threadMetadata?.ctTxid || null;
  const ctVoutCandidate = Number.isInteger(receipt?.ctVout)
    ? receipt.ctVout
    : Number.isInteger(threadMetadata?.ctVout)
      ? threadMetadata.ctVout
      : null;
  const ctVout = Number.isInteger(ctVoutCandidate) && ctVoutCandidate >= 0
    ? ctVoutCandidate
    : 0;

  console.log('[burnThreadAction] CT info:', { ctTxid, ctVout, hasMetadata: !!threadMetadata })

  let burnTxid = null;

  if (ctTxid) {
    console.log('[burnThreadAction] CT found, preparing to burn...')
    // Load CT artifacts and broadcast metadata for burn transaction
    const ctArtifacts = threadMetadata?.ctArtifacts || receipt?.threadMetadata?.ctArtifacts || null;
    const ctBroadcast = threadMetadata?.ctBroadcast || receipt?.threadMetadata?.ctBroadcast || null;
    
    console.log('[burnThreadAction] CT artifacts available:', !!ctArtifacts)
    console.log('[burnThreadAction] CT broadcast available:', !!ctBroadcast)
    console.log('[burnThreadAction] Calling burnThreadControlToken...')
    
    const burnResult = await burnThreadControlToken({
      ctTxid,
      ctVout,
      artifacts: ctArtifacts,
      broadcast: ctBroadcast,
    });
    burnTxid = burnResult?.burnTxid || null;
    
    console.log('[burnThreadAction] Burn result:', burnResult)
    
    console.log(`[threadLifecycle] CT burn transaction for thread ${threadId}:`, {
      ctTxid,
      ctVout,
      burnTxid,
      ctOutpoint: `${ctTxid}:${ctVout}`,
      burnProof: burnTxid ? `Burned in tx: ${burnTxid}` : 'BURN FAILED'
    });
    
    // If we have a CT but failed to burn it, this is a critical error
    if (!burnTxid) {
      throw new Error('Failed to burn Control Token on-chain. Thread not marked as burned.');
    }
  }

  const burnedAt = new Date().toISOString();
  
  // SECURITY: Zeroize key material on burn (per THREAD_CRYPTO_FLOW.md §5)
  // Clear all cryptographic material from storage to ensure irrecoverable erasure
  let updatedReceipt = await updateJoinReceipt(threadId, {
    status: "burned",
    burnedAt,
    burnedBy: "self",
    burnTxid,
    // Zeroize key material in receipt
    encKeyWrap: null,
    rawKeyBase64: null,
  });

  // Fallback if updateJoinReceipt fails
  if (!updatedReceipt) {
    updatedReceipt = {
      ...receipt,
      status: "burned",
      burnedAt,
      burnedBy: "self",
      encKeyWrap: null,
      rawKeyBase64: null,
    };
  }

  // Zeroize key material in thread metadata
  await updateThreadMetadata(threadId, {
    burnTxid,
    burnedAt,
    burnedBy: "self",
    // SECURITY: Clear all key material on burn
    encKeyWrap: null,
    rawKeyBase64: null,
    ctEncKeyWrapped: null,
  });

  setReceiptsByThread((prev) => ({
    ...prev,
    [threadId]: updatedReceipt,
  }));

  applyConversationUpdate((prev) =>
    prev.map((conversation) =>
      conversation.id === threadId
        ? conversationFromReceipt(updatedReceipt)
        : conversation,
    ),
  );

  overlayClientRef.current?.publishControl(threadId, {
    action: "burn",
    actor: "self",
    occurredAt: burnedAt,
    burnTxid,
  });

  // Delete any backup from helper cache to ensure burned threads are unrecoverable
  if (ctTxid) {
    deleteThreadBackup({ ctTxid, ctVout }).catch((error) => {
      console.warn('[threadLifecycle] Failed to delete thread backup on burn', threadId, error);
    });
  }

  return updatedReceipt;
}
export { mintThreadCT, mintGuestDTForThread } from "./threadMinting";
