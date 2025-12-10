/**
 * Thread Access Validation (Patent-Critical)
 * 
 * This module implements the core CT/DT validation primitive that demonstrates:
 * 1. Tokenized access rights (DT ownership required)
 * 2. Relational mapping (DT → CT → Thread Key)
 * 3. Provable revocation (CT burn invalidates all DTs)
 * 
 * Patent Claims:
 * - Method for validating on-chain access tokens before granting decryption rights
 * - System for provable access revocation via Control Token burning
 * - Relational erasure: destroying semantic link between DT and encrypted content
 */

/**
 * Validate that a user has a valid DT for thread access
 * 
 * @param {Object} params
 * @param {string} params.threadId - Thread identifier
 * @param {string} params.userPublicKey - User's public key
 * @param {Object} params.receipt - Thread join receipt containing DT/CT info
 * @returns {Object} Validation result with access decision
 */
export function validateThreadAccess({ threadId, userPublicKey, receipt }) {
  const validation = {
    hasAccess: false,
    reason: null,
    dtOutpoint: null,
    ctOutpoint: null,
    validationTimestamp: new Date().toISOString(),
  };

  // 1. Check if receipt exists (represents DT ownership)
  if (!receipt) {
    validation.reason = 'NO_DT_FOUND';
    validation.details = 'No Data Token found for this user. Access denied.';
    return validation;
  }

  // 2. Verify thread ID matches
  if (receipt.threadId !== threadId) {
    validation.reason = 'THREAD_MISMATCH';
    validation.details = 'Data Token does not match requested thread.';
    return validation;
  }

  // 3. Check if thread has been burned (CT destroyed)
  if (receipt.status === 'burned') {
    validation.reason = 'CT_BURNED';
    validation.details = 'Control Token has been burned. All access revoked.';
    validation.ctOutpoint = receipt.ctTxid && receipt.ctVout !== undefined
      ? { txid: receipt.ctTxid, vout: receipt.ctVout }
      : null;
    validation.burnProof = {
      burnTxid: receipt.burnTxid,
      burnedAt: receipt.burnedAt,
      burnedBy: receipt.burnedBy,
    };
    return validation;
  }

  // 4. Check if user has left the thread
  if (receipt.status === 'left') {
    validation.reason = 'USER_LEFT';
    validation.details = 'User has voluntarily left this thread.';
    return validation;
  }

  // 5. Verify CT exists (required for DT to be meaningful)
  const hasCT = receipt.ctTxid && Number.isInteger(receipt.ctVout);
  if (!hasCT) {
    validation.reason = 'NO_CT_REFERENCE';
    validation.details = 'Data Token does not reference a valid Control Token.';
    return validation;
  }

  // 6. REQUIRE DT exists (PATENT-CRITICAL: DT ownership is mandatory for access)
  const dtIssuances = receipt.dtIssuances || receipt.threadMetadata?.dtIssuances || [];
  const userDT = dtIssuances
    .flatMap(issuance => issuance.outputs || [])
    .find(output => output.recipientPubkey === userPublicKey);

  if (!userDT || !Number.isInteger(userDT.vout)) {
    validation.reason = 'NO_DT_FOUND';
    validation.details = 'No valid Data Token found for this user. DT ownership is required for thread access.';
    return validation;
  }

  validation.dtOutpoint = {
    txid: userDT.txid || receipt.lastMintTxid,
    vout: userDT.vout,
  };

  // 7. All checks passed - grant access
  validation.hasAccess = true;
  validation.reason = 'VALID_DT';
  validation.details = 'Valid Data Token found. Control Token is active. Access granted.';
  validation.ctOutpoint = {
    txid: receipt.ctTxid,
    vout: receipt.ctVout,
  };

  return validation;
}

/**
 * Check if a thread can be accessed (simplified check)
 * 
 * @param {Object} receipt - Thread join receipt
 * @returns {boolean} True if thread is accessible
 */
export function canAccessThread(receipt) {
  if (!receipt) return false;
  if (receipt.status === 'burned') return false;
  if (receipt.status === 'left') return false;
  if (receipt.status === 'blocked') return false;
  return true;
}

/**
 * Get human-readable access status
 * 
 * @param {Object} receipt - Thread join receipt
 * @returns {string} Status message
 */
export function getAccessStatusMessage(receipt) {
  if (!receipt) return 'No access token found';
  
  switch (receipt.status) {
    case 'burned':
      return '🔥 Thread burned - Access permanently revoked';
    case 'left':
      return '👋 You left this thread';
    case 'blocked':
      return '🚫 Thread blocked';
    case 'active':
    case 'ready':
      return '✅ Active - Access granted';
    default:
      return `Status: ${receipt.status}`;
  }
}

/**
 * Generate blockchain verification URLs for CT/DT
 * 
 * @param {Object} outpoint - { txid, vout }
 * @param {string} network - 'main' or 'test'
 * @returns {string} WhatsOnChain URL
 */
export function getBlockchainExplorerUrl(outpoint, network = 'main') {
  if (!outpoint?.txid) return null;
  
  const baseUrl = network === 'test' 
    ? 'https://test.whatsonchain.com'
    : 'https://whatsonchain.com';
  
  return `${baseUrl}/tx/${outpoint.txid}`;
}

/**
 * Format outpoint for display
 * 
 * @param {Object} outpoint - { txid, vout }
 * @returns {string} Formatted string
 */
export function formatOutpoint(outpoint) {
  if (!outpoint?.txid) return 'N/A';
  return `${outpoint.txid.slice(0, 8)}...${outpoint.txid.slice(-8)}:${outpoint.vout}`;
}
