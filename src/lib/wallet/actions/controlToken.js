import { getWallet, extractTxid } from '../client.js';
import {
  collectTransactionArtifacts,
  persistTransactionArtifactsToStorage
} from '../artifacts.js';
import { mapLockingScriptsToIndexes } from '../transactionOutputs.js';
import { buildDonationOutput, clearInvoiceCache } from '../donationFee.js';

export async function mintControlToken({ blobHash, encKeyWrap, hintURL, description = 'Create a new Nullify Thread', fundingUtxos = [] }) {
  if (!/^[0-9a-fA-F]{64}$/.test(blobHash || '')) throw new Error('blobHash must be 64-hex');
  if (!encKeyWrap || typeof encKeyWrap !== 'string') throw new Error('encKeyWrap required');

  const { client } = await getWallet();
  const { PushDrop } = await import('/node_modules/@bsv/sdk/dist/esm/mod.js');

  // CT payload for PushDrop (BRC-48)
  const ctPayload = {
    t: 'CT',  // type
    h: blobHash,  // hash
    k: encKeyWrap,  // key
    u: hintURL || undefined,  // URL (optional)
    m: { created: new Date().toISOString() },  // metadata
    ts: Date.now()  // timestamp
  };

  // Create PushDrop script (BRC-48 compliant)
  const payloadString = JSON.stringify(ctPayload);
  const payloadBuffer = new TextEncoder().encode(payloadString);
  const fields = [Array.from(payloadBuffer)]; // Convert to number[][]
  
  // Instantiate PushDrop with wallet
  const pushdrop = new PushDrop(client);
  
  // Lock with proper parameters
  const protocolID = [2, 'Nullify CT']; // SecurityLevel 2, protocol ID (no hyphens per BSV Desktop)
  const keyID = '1'; // Key derivation ID
  const counterparty = 'self'; // Self-signed
  
  const lockingScript = await pushdrop.lock(
    fields,
    protocolID,
    keyID,
    counterparty,
    false, // forSelf
    false  // includeSignature - skip signature for now
  );

  const lockingScriptHex = lockingScript.toHex();
  const outputs = [
    { satoshis: 1, lockingScript: lockingScriptHex, outputDescription: 'File sharing control (Nullify)' }
  ];

  // Donation output at index 0 - HD-invoice with static fallback
  const donationOutput = await buildDonationOutput(50);
  const actionOutputs = donationOutput ? [donationOutput, ...outputs] : outputs;

  const response = await client.createAction({
    description,
    outputs: actionOutputs,
    fundingUtxos,
    options: { randomizeOutputs: false }  // Preserve output order for BRC-29 payment tracking
  });

  const txid = extractTxid(response);
  if (txid && !response.txid) {
    try {
      response.txid = txid;
    } catch (assignErr) {
      console.debug('Unable to assign txid on control token response', assignErr);
    }
  }

  // CT is at index 1 when donation output is present (donation is at index 0)
  let ctVout = donationOutput ? 1 : 0;
  try {
    const [actualIndex] = await mapLockingScriptsToIndexes(response, [lockingScriptHex]);
    if (typeof actualIndex === 'number' && actualIndex >= 0) {
      ctVout = actualIndex;
    }
  } catch (err) {
    console.warn('[mintControlToken] Failed to determine CT vout index', err);
  }

  let artifacts = null;
  try {
    artifacts = await collectTransactionArtifacts(response);
  } catch (err) {
    console.warn('[mintControlToken] Failed to collect transaction artifacts', err);
  }

  if (txid && artifacts?.hasArtifacts) {
    persistTransactionArtifactsToStorage(txid, artifacts);
  }

  const ctOutpoint = txid ? { txid, vout: ctVout } : null;
  const broadcast = {
    txid: txid || null,
    lockingScriptHex: lockingScriptHex,
    satoshis: outputs[0]?.satoshis ?? 0,
    vout: ctVout
  };

  // Clear invoice cache so next transaction gets a fresh address
  clearInvoiceCache();

  return { response, txid, ctOutpoint, artifacts, broadcast };
}
