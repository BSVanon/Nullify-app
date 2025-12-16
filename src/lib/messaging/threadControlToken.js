import { getWallet, extractTxid } from '@/lib/wallet/client'
import { collectTransactionArtifacts, persistTransactionArtifactsToStorage } from '@/lib/wallet/artifacts.js'
import { mapLockingScriptsToIndexes } from '@/lib/wallet/transactionOutputs.js'
import { wrapCTForPushDrop, createCTPayload } from '@/lib/token/ct.js'
import { burnControlToken } from '@/lib/wallet/actions.js'
import { buildDonationOutput, clearInvoiceCache } from '@/lib/wallet/donationFee.js'

/**
 * Mint a Control Token (CT) for a messaging thread (PATENT-CRITICAL)
 * 
 * The CT is the cornerstone of the Nullify erasure primitive:
 * - Acts as the "Rosetta Stone" that gives meaning to Data Tokens (DTs)
 * - Contains encrypted thread key + metadata (blobHash, policy, etc.)
 * - Burning the CT destroys the relational mapping: DT → CT → Thread Key
 * - Creates provable, on-chain evidence of access revocation
 * 
 * Patent Claims:
 * - Method for on-chain control of off-chain encrypted content access
 * - System for provable deletion via token burning (not just key loss)
 * - Relational erasure: destroying semantic link between access tokens and content
 *
 * @param {Object} params
 * @param {string} params.blobHash - SHA-256 hash of ciphertext (hex)
 * @param {string} params.encKeyWrap - Wrapped symmetric thread key (base64)
 * @param {string} [params.hintURL] - Optional locator/label
 * @param {string} [params.policy] - Thread burn policy (`mutual` | `initiator`)
 * @param {Object} [params.meta] - Additional metadata to persist with the CT
 * @returns {Promise<{ txid: string, vout: number, wrapPayload: any, ctOutpoint: { txid: string, vout: number }, artifacts: any, broadcast: any }>}
 */
export async function mintThreadControlToken({
  blobHash,
  encKeyWrap,
  hintURL = '',
  policy = 'mutual',
  meta = {},
}) {
  if (!/^[0-9a-fA-F]{64}$/.test(blobHash || '')) {
    throw new Error('blobHash must be 64-hex');
  }
  if (!encKeyWrap || typeof encKeyWrap !== 'string') {
    throw new Error('encKeyWrap required');
  }

  const payload = createCTPayload({
    blobHash,
    hintURL,
    encKeyWrap,
    meta: {
      policy,
      ...meta,
    },
  });

  const compact = wrapCTForPushDrop(payload);
  const payloadString = JSON.stringify(compact);
  const payloadBuffer = new TextEncoder().encode(payloadString);

  const { client } = await getWallet();
  const { PushDrop } = await import('/node_modules/@bsv/sdk/dist/esm/mod.js');

  const pushdrop = new PushDrop(client);
  const protocolID = [2, 'Nullify Thread CT'];
  const keyID = 'thread-ct';
  const counterparty = 'self';

  const lockingScript = await pushdrop.lock(
    [Array.from(payloadBuffer)],
    protocolID,
    keyID,
    counterparty,
    false,
    false,
  );

  const lockingScriptHex = lockingScript.toHex();
  const outputs = [
    {
      satoshis: 1,
      lockingScript: lockingScriptHex,
      outputDescription: 'Conversation control (Nullify)',
    },
  ];

  // Donation output at index 0 - pays to static merchant address
  const donationOutput = buildDonationOutput(50);
  const actionOutputs = donationOutput ? [donationOutput, ...outputs] : outputs;

  const response = await client.createAction({
    description: 'Create a new Nullify Thread',
    outputs: actionOutputs,
    options: { randomizeOutputs: false }  // Preserve output order for BRC-29 payment tracking
  });

  const txid = extractTxid(response);
  // CT is at index 1 when donation output is present (donation is at index 0)
  let vout = donationOutput ? 1 : 0;
  try {
    const [index] = await mapLockingScriptsToIndexes(response, [lockingScriptHex]);
    if (typeof index === 'number' && index >= 0) {
      vout = index;
    }
  } catch (error) {
    console.warn('[mintThreadControlToken] unable to map locking script index', error);
  }

  let artifacts = null;
  try {
    artifacts = await collectTransactionArtifacts(response);
    if (txid && artifacts?.hasArtifacts) {
      persistTransactionArtifactsToStorage(txid, artifacts);
    }
  } catch (error) {
    console.warn('[mintThreadControlToken] failed collecting artifacts', error);
  }

  const broadcast = {
    txid: txid || null,
    lockingScriptHex,
    satoshis: outputs[0]?.satoshis ?? 1,
    vout,
  };

  // Clear invoice cache so next transaction gets a fresh address
  clearInvoiceCache();

  return {
    txid,
    vout,
    wrapPayload: compact,
    ctOutpoint: txid ? { txid, vout } : null,
    artifacts,
    broadcast,
  };
}

export async function burnThreadControlToken({
  ctTxid,
  ctVout = 0,
  broadcast = null,
  artifacts = null,
}) {
  if (!/^[0-9a-fA-F]{64}$/.test(ctTxid || '')) {
    throw new Error('ctTxid must be 64-hex');
  }

  const result = await burnControlToken({
    ctTxid,
    ctVout,
    broadcast,
    artifacts,
    description: 'Permanently destroy the Nullify Thread',
  });

  return {
    burnTxid: result?.burnTxid || null,
    artifacts: result?.artifacts || null,
    response: result?.response || null,
    signResult: result?.signResult || null,
  };
}
