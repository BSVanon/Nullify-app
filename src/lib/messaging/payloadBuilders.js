export function buildMetadataPayload(threadId, metadata) {
  if (!threadId || !metadata) return null
  return {
    threadId,
    ctTxid: metadata.ctTxid ?? null,
    ctVout: Number.isInteger(metadata.ctVout) ? metadata.ctVout : null,
    mintedAt: metadata.mintedAt ?? null,
    lastMintTxid: metadata.lastMintTxid ?? null,
    burnTxid: metadata.burnTxid ?? null,
    burnedAt: metadata.burnedAt ?? null,
    burnedBy: metadata.burnedBy ?? null,
    encKeyWrap: metadata.encKeyWrap ?? null,
    blobHash: metadata.blobHash ?? null,
    hintURL: metadata.hintURL ?? null,
    policy: metadata.policy ?? null,
    helperCache: metadata.helperCache ?? null,
    revision: metadata.remoteRevision ?? metadata.revision ?? null,
  }
}

export function buildMessagePayload(entry) {
  if (!entry) return null
  if (!entry.ciphertext) return null
  return {
    threadId: entry.threadId,
    messageId: entry.id,
    ciphertext: entry.ciphertext,
    author: entry.author ?? null,
    delivery: entry.delivery ?? 'sent',
    timestamp: entry.timestamp ?? entry.createdAt ?? new Date().toISOString(),
    helperCache: entry.helperCache ?? null,
    revision: entry.remoteRevision ?? entry.revision ?? null,
  }
}
