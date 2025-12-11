import { mintDataTokens } from '@/lib/wallet/actions/dataToken';
import { collectTransactionArtifacts, persistTransactionArtifactsToStorage } from '@/lib/wallet/artifacts.js';
import { mapLockingScriptsToIndexes } from '@/lib/wallet/transactionOutputs.js';

/**
 * Mint Data Tokens (DTs) for a messaging thread (PATENT-CRITICAL)
 * 
 * DTs are the access rights tokens in the NukeNote erasure primitive:
 * - Each DT represents one user's permission to access the thread
 * - DTs reference the CT via outpoint (ctTxid:ctVout) - the relational link
 * - DTs contain the thread key wrapped (encrypted) for the recipient
 * - When CT is burned, ALL DTs become semantically meaningless
 * - DTs remain on-chain but can no longer resolve to valid decryption context
 * 
 * Patent Claims:
 * - Method for tokenizing access rights as transferable on-chain assets
 * - System for global revocation via single Control Token burn
 * - Relational unlinkability: DTs lose all meaning when CT is destroyed
 * - Two-transaction issuance (default): CT first, then DTs reference CT outpoint
 *
 * @param {Object} params
 * @param {string} params.ctTxid - Control Token transaction id (64-hex)
 * @param {number} params.ctVout - Control Token vout index
 * @param {Array<string>} params.recipientPubkeys - Array of recipient compressed pubkeys
 * @param {string} params.threadKeyBase64 - Base64 encoded raw thread key
 * @param {string} [params.permissions='read-only'] - Permissions string for Data Tokens
 * @returns {Promise<{ txid: string|null, outputs: Array<{ recipientPubkey: string, vout: number }>, artifacts: any, broadcast: any }>}
 */
export async function mintThreadDataTokens({
  ctTxid,
  ctVout = 0,
  recipientPubkeys,
  threadKeyBase64,
  permissions = 'read-only',
  description,
}) {
  if (!/^[0-9a-fA-F]{64}$/.test(ctTxid || '')) {
    throw new Error('ctTxid must be 64-hex');
  }
  if (!Number.isInteger(ctVout) || ctVout < 0) {
    throw new Error('ctVout must be a non-negative integer');
  }
  if (!Array.isArray(recipientPubkeys) || recipientPubkeys.length === 0) {
    throw new Error('recipientPubkeys array required');
  }
  if (!threadKeyBase64 || typeof threadKeyBase64 !== 'string') {
    throw new Error('threadKeyBase64 required');
  }

  const { txid, dtOutpoints, artifacts, broadcast } = await mintDataTokens({
    ctTxid,
    ctVout,
    recipients: recipientPubkeys,
    permissions,
    rawKeyBase64: threadKeyBase64,
    description,
  });

  const outputs = dtOutpoints.map(({ recipient, vout }) => ({
    recipientPubkey: recipient,
    vout,
  }));

  return {
    txid: txid || null,
    outputs,
    artifacts: artifacts || null,
    broadcast: broadcast || null,
  };
}
