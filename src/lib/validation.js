/**
 * Validation utilities for Nullify inputs
 */

/**
 * Validate BSV address format
 * @param {string} address - The address to validate
 * @returns {boolean} - True if valid BSV address
 */
export function isValidBSVAddress(address) {
  if (!address || typeof address !== 'string') return false;
  
  // Basic BSV address patterns
  // Mainnet: starts with 1
  // Testnet: starts with m or n
  const mainnetPattern = /^1[a-km-zA-HJ-NP-Z1-9]{25,34}$/;
  const testnetPattern = /^[mn][a-km-zA-HJ-NP-Z1-9]{25,34}$/;
  
  return mainnetPattern.test(address) || testnetPattern.test(address);
}

/**
 * Validate public key format (compressed or uncompressed)
 * @param {string} pubkey - The public key to validate
 * @returns {boolean} - True if valid public key
 */
export function isValidPublicKey(pubkey) {
  if (!pubkey || typeof pubkey !== 'string') return false;
  
  // Remove any 0x prefix if present
  const cleaned = pubkey.replace(/^0x/i, '');
  
  // Compressed pubkey: 33 bytes (66 hex chars), starts with 02 or 03
  const compressedPattern = /^0[23][0-9a-fA-F]{64}$/;
  
  // Uncompressed pubkey: 65 bytes (130 hex chars), starts with 04
  const uncompressedPattern = /^04[0-9a-fA-F]{128}$/;
  
  return compressedPattern.test(cleaned) || uncompressedPattern.test(cleaned);
}

/**
 * Validate transaction ID format
 * @param {string} txid - The transaction ID to validate
 * @returns {boolean} - True if valid txid
 */
export function isValidTxid(txid) {
  if (!txid || typeof txid !== 'string') return false;
  
  // Transaction ID should be 64 hex characters
  return /^[0-9a-fA-F]{64}$/.test(txid);
}

/**
 * Validate recipient input (address or pubkey)
 * @param {string} recipient - The recipient identifier
 * @returns {{valid: boolean, type: string|null, error: string|null}}
 */
export function validateRecipient(recipient) {
  if (!recipient || typeof recipient !== 'string') {
    return { valid: false, type: null, error: 'Recipient is required' };
  }
  
  const trimmed = recipient.trim();
  
  if (isValidBSVAddress(trimmed)) {
    return { valid: true, type: 'address', error: null };
  }
  
  if (isValidPublicKey(trimmed)) {
    return { valid: true, type: 'pubkey', error: null };
  }
  
  return { 
    valid: false, 
    type: null, 
    error: 'Invalid recipient: must be a BSV address or public key' 
  };
}

/**
 * Validate multiple recipients (comma-separated)
 * @param {string} recipientsString - Comma-separated recipients
 * @returns {{valid: boolean, recipients: array, errors: array}}
 */
export function validateRecipients(recipientsString) {
  if (!recipientsString || typeof recipientsString !== 'string') {
    return { valid: false, recipients: [], errors: ['No recipients provided'] };
  }
  
  const recipients = recipientsString
    .split(',')
    .map(r => r.trim())
    .filter(r => r.length > 0);
    
  if (recipients.length === 0) {
    return { valid: false, recipients: [], errors: ['No valid recipients found'] };
  }
  
  const validated = [];
  const errors = [];
  
  for (let i = 0; i < recipients.length; i++) {
    const result = validateRecipient(recipients[i]);
    if (result.valid) {
      validated.push({
        value: recipients[i],
        type: result.type
      });
    } else {
      errors.push(`Recipient ${i + 1}: ${result.error}`);
    }
  }
  
  return {
    valid: errors.length === 0,
    recipients: validated,
    errors
  };
}

/**
 * Validate blob hash format
 * @param {string} hash - The blob hash to validate
 * @returns {boolean} - True if valid SHA-256 hash
 */
export function isValidBlobHash(hash) {
  if (!hash || typeof hash !== 'string') return false;
  
  // SHA-256 hash should be 64 hex characters
  return /^[0-9a-fA-F]{64}$/.test(hash);
}

/**
 * Validate URL format
 * @param {string} url - The URL to validate
 * @returns {boolean} - True if valid URL
 */
export function isValidUrl(url) {
  if (!url || typeof url !== 'string') return false;
  
  try {
    const parsed = new URL(url);
    // Allow http, https, ipfs, arweave protocols
    return ['http:', 'https:', 'ipfs:', 'ar:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

export default {
  isValidBSVAddress,
  isValidPublicKey,
  isValidTxid,
  validateRecipient,
  validateRecipients,
  isValidBlobHash,
  isValidUrl
};
