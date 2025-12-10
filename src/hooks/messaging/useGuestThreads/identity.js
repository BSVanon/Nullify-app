export const resolveLocalPublicKey = (receipt) => {
  if (!receipt) return null;
  if (receipt.identityKind === "holder") {
    return receipt.holderPublicKey || null;
  }
  if (receipt.identityKind === "guest") {
    return receipt.guestPublicKey || null;
  }
  return receipt.guestPublicKey || receipt.holderPublicKey || null;
};

export const resolvePeerPublicKey = (receipt) => {
  if (!receipt) return null;
  if (receipt.identityKind === "holder") {
    return receipt.guestPublicKey || null;
  }
  if (receipt.identityKind === "guest") {
    return receipt.holderPublicKey || null;
  }
  return receipt.holderPublicKey || receipt.guestPublicKey || null;
};

export const normalizeLocalAuthor = (author, receipt) => {
  if (!receipt) return author;
  const localKey = resolveLocalPublicKey(receipt);
  if (!author || author === "self" || author === "unknown") {
    return localKey || author || null;
  }
  if (author === "peer" && localKey) {
    return localKey;
  }
  return author;
};

export const normalizeInboundAuthor = (author, receipt) => {
  if (!receipt) return author;
  const peerKey = resolvePeerPublicKey(receipt);
  if (!author || author === "peer" || author === "unknown") {
    return peerKey || author || null;
  }
  if (author === "self" && peerKey) {
    return peerKey;
  }
  return author;
};

export const normalizeStoredAuthor = (author, receipt) => {
  if (!receipt) return author;
  if (author === "self" || author === "unknown") {
    return normalizeLocalAuthor(author, receipt) || author;
  }
  if (author === "peer") {
    return normalizeInboundAuthor(author, receipt) || author;
  }
  return author;
};
