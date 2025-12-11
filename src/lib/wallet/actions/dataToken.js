import { getWallet, extractTxid } from '../client.js';
import {
  collectTransactionArtifacts,
  persistTransactionArtifactsToStorage
} from '../artifacts.js';
import { mapLockingScriptsToIndexes } from '../transactionOutputs.js';
import { base64ToUint8 } from '../keyManagement.js';
import { wrapKeyWithECIES } from '../../crypto/keyWrapping.js';
import { buildDonationOutput, clearInvoiceCache } from '../donationFee.js';

export async function mintDataTokens({
  ctTxid,
  ctVout = 0,
  recipients,
  permissions = 'read-only',
  description = 'Authorize access to the new Nullify Thread',
  fundingUtxos = [],
  rawKeyBase64
}) {
  console.log('[mintDataTokens] Called with:', { ctTxid, ctVout, recipients, permissions });

  if (!/^[0-9a-fA-F]{64}$/.test(ctTxid || '')) throw new Error('ctTxid must be 64-hex');
  if (!Array.isArray(recipients) || recipients.length === 0) throw new Error('recipients array required');
  if (!rawKeyBase64 || typeof rawKeyBase64 !== 'string') throw new Error('rawKeyBase64 required');

  console.log('[mintDataTokens] Getting wallet...');
  const { client } = await getWallet();
  console.log('[mintDataTokens] Wallet obtained, importing PushDrop...');
  const { PushDrop } = await import('/node_modules/@bsv/sdk/dist/esm/mod.js');

  console.log('[mintDataTokens] Creating PushDrop instance...');
  const pushdrop = new PushDrop(client);

  console.log('[mintDataTokens] Building outputs...');
  const outputs = [];
  const rawKeyBytes = base64ToUint8(rawKeyBase64);
  const lockingScriptHexes = [];
  const broadcastOutputs = [];

  for (const recipient of recipients) {
    const wrappedKeyForRecipient = await wrapKeyWithECIES(rawKeyBytes, recipient);
    // DT payload for PushDrop (BRC-48) - two-TX mode
    const dtPayload = {
      t: 'DT',
      mode: 'outpoint',
      txid: ctTxid,
      vout: ctVout,
      to: recipient,
      p: permissions,
      k: wrappedKeyForRecipient,
      m: { created: new Date().toISOString() },
      ts: Date.now()
    };

    console.log('[mintDataTokens] DT payload:', dtPayload);
    const payloadBuffer = new TextEncoder().encode(JSON.stringify(dtPayload));
    const fields = [Array.from(payloadBuffer)];

    console.log('[mintDataTokens] Calling pushdrop.lock (instance method)...');
    // Use simple lock without protocol/signature for DTs
    const lockingScript = await pushdrop.lock(
      fields,
      [2, 'NukeNote DT'],
      '1',
      'self',
      false,
      false
    );
    console.log('[mintDataTokens] pushdrop.lock completed');

    const lockingScriptHex = lockingScript.toHex();
    const lockingScriptHexNormalized = lockingScriptHex.toLowerCase();
    const candidateVout = outputs.length;

    outputs.push({
      satoshis: 1,
      lockingScript: lockingScriptHex,
      outputDescription: `Authorize Nullify Thread access for ${recipient.slice(0, 8)}...`
    });
    lockingScriptHexes.push(lockingScriptHexNormalized);
    broadcastOutputs.push({
      lockingScriptHex: lockingScriptHexNormalized,
      satoshis: 1,
      vout: candidateVout
    });
  }

  console.log('[mintDataTokens] Outputs built, calling wallet.createAction...');
  // Donation output at index 0 - server monitors HD-derived address for payment
  const donationOutput = await buildDonationOutput(50);
  const actionOutputs = donationOutput ? [donationOutput, ...outputs] : outputs;

  const response = await client.createAction({
    description,
    outputs: actionOutputs,
    fundingUtxos,
    options: { randomizeOutputs: false }  // Preserve output order for BRC-29 payment tracking
  });
  console.log('[mintDataTokens] createAction response:', response);

  const txid = extractTxid(response);
  if (txid && !response.txid) {
    try {
      response.txid = txid;
    } catch (assignErr) {
      console.debug('Unable to assign txid on data token response', assignErr);
    }
  }

  // Return DT outpoints for each recipient
  // When donation output is present, DTs start at index 1 (donation is at index 0)
  const dtStartVout = donationOutput ? 1 : 0;
  const dtOutpoints = outputs.map((_, index) => ({ txid: txid || null, vout: dtStartVout + index, recipient: recipients[index] }));
  try {
    const mappedIndexes = await mapLockingScriptsToIndexes(response, lockingScriptHexes);
    mappedIndexes.forEach((maybeIndex, idx) => {
      if (typeof maybeIndex === 'number' && maybeIndex >= 0) {
        dtOutpoints[idx].vout = maybeIndex;
        broadcastOutputs[idx].vout = maybeIndex;
      }
    });
  } catch (err) {
    console.warn('[mintDataTokens] Failed to map DT outputs to actual vout indexes', err);
  }

  let artifacts = null;
  try {
    artifacts = await collectTransactionArtifacts(response);
  } catch (err) {
    console.warn('[mintDataTokens] Failed to collect transaction artifacts', err);
  }

  if (txid && artifacts?.hasArtifacts) {
    persistTransactionArtifactsToStorage(txid, artifacts);
  }

  const broadcast = {
    txid: txid || null,
    outputs: broadcastOutputs
  };

  // Clear invoice cache so next transaction gets a fresh address
  clearInvoiceCache();

  return { response, txid, dtOutpoints, artifacts, broadcast };
}
