import { getWallet, extractTxid } from '../client.js';
import { buildDonationOutput, clearInvoiceCache } from '../donationFee.js';

export async function mintAtomicCTandDTs({
  blobHash,
  encKeyWrap,
  hintURL = '',
  recipients,
  permissions = 'read-only',
  description = 'Create a new Nullify Thread and authorize access',
  fundingUtxos = []
}) {
  if (!/^[0-9a-fA-F]{64}$/.test(blobHash || '')) throw new Error('blobHash must be 64-hex');
  if (!encKeyWrap || typeof encKeyWrap !== 'string') throw new Error('encKeyWrap required');
  if (!Array.isArray(recipients) || recipients.length === 0) throw new Error('recipients array required');

  const { client } = await getWallet();
  const { PushDrop } = await import('/node_modules/@bsv/sdk/dist/esm/mod.js');

  const outputs = [];

  // First output: Control Token
  const ctPayload = {
    t: 'CT',
    h: blobHash,
    k: encKeyWrap,
    u: hintURL || undefined,
    m: { created: new Date().toISOString() },
    ts: Date.now()
  };

  const ctBuffer = new TextEncoder().encode(JSON.stringify(ctPayload));
  const ctScript = PushDrop.lock(ctBuffer);

  outputs.push({
    satoshis: 1,
    lockingScript: ctScript.toHex(),
    outputDescription: 'File sharing control (Nullify)'
  });

  // CT vout depends on whether donation output is present (donation at 0, CT at 1)
  // We'll determine the actual vout after building outputs
  const ctVoutInDtPayload = 1; // Assume donation output will be present at index 0

  // Subsequent outputs: Data Tokens
  for (const recipient of recipients) {
    const dtPayload = {
      t: 'DT',
      mode: 'same-tx',
      vout: ctVoutInDtPayload,
      to: recipient,
      p: permissions,
      m: { created: new Date().toISOString() },
      ts: Date.now()
    };

    const dtBuffer = new TextEncoder().encode(JSON.stringify(dtPayload));
    const dtScript = PushDrop.lock(dtBuffer);

    outputs.push({
      satoshis: 1,
      lockingScript: dtScript.toHex(),
      outputDescription: `Authorize Nullify Thread access for ${recipient.slice(0, 8)}...`
    });
  }

  // Donation output at index 0 - pays to static merchant address
  const donationOutput = buildDonationOutput(50);
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
      console.debug('Unable to assign txid on atomic mint response', assignErr);
    }
  }

  // Return outpoints for both CT and DTs
  // When donation output is present, it's at index 0, CT at index 1, DTs start at index 2
  const ctVout = donationOutput ? 1 : 0;
  const dtStartVout = donationOutput ? 2 : 1;
  const ctOutpoint = { txid, vout: ctVout };
  const dtOutpoints = recipients.map((recipient, index) => ({
    txid,
    vout: dtStartVout + index,
    recipient
  }));

  // Clear invoice cache so next transaction gets a fresh address
  clearInvoiceCache();

  return {
    response,
    txid,
    ctOutpoint,
    dtOutpoints,
    isAtomic: true
  };
}
