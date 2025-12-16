import { getWallet, extractTxid, forceUtxoRefresh } from '../client.js';
import {
  collectTransactionArtifacts,
  persistTransactionArtifactsToStorage
} from '../artifacts.js';
import { base64ToUint8 } from '../keyManagement.js';
import walletBootstrap from '../../walletBootstrap.js';
import { buildDonationOutput, clearInvoiceCache } from '../donationFee.js';

export async function burnControlToken({
  ctTxid,
  ctVout = 0,
  description = 'Permanently destroy the Nullify Thread',
  fundingUtxos = [],
  broadcast = null,
  artifacts: artifactsOverride = null
}) {
  if (!/^[0-9a-fA-F]{64}$/.test(ctTxid || '')) throw new Error('ctTxid must be 64-hex');
  console.log('[burnControlToken] Called with:', { ctTxid, ctVout });

  // Force UTXO cache refresh before burn - the CT we're burning may have just been minted
  // and the wallet's cache might not include it yet
  await forceUtxoRefresh();

  const { client } = await getWallet();
  const { Script, PushDrop, Transaction } = await import('/node_modules/@bsv/sdk/dist/esm/mod.js');

  const walletStatus = walletBootstrap.getStatus?.() || {};
  const isJsonApi = walletStatus.walletType === 'json-api';

  // Create burn script: OP_FALSE OP_RETURN
  const burnScript = Script.fromASM('OP_FALSE OP_RETURN');

  console.log('[burnControlToken] Creating PushDrop instance for unlock template...');
  const pushdrop = new PushDrop(client);
  const protocolID = [2, 'Nullify Thread CT']; // Must match CT minting
  const keyID = 'thread-ct'; // Must match CT minting
  const counterparty = 'self';

  const lockingScriptHex = broadcast?.lockingScriptHex || null;
  const satoshis = typeof broadcast?.satoshis === 'number' ? broadcast.satoshis : null;

  if (isJsonApi && (!lockingScriptHex || satoshis === null)) {
    throw new Error('Missing Control Token broadcast metadata for this thread. JSON-API wallet cannot burn this CT.');
  }

  let inputBEEF = null;
  if (artifactsOverride?.transactionBeefBase64) {
    try {
      inputBEEF = base64ToUint8(artifactsOverride.transactionBeefBase64);
    } catch (err) {
      console.warn('[burnControlToken] Failed to decode transactionBeefBase64', err);
    }
  }
  if (!inputBEEF && artifactsOverride?.transactionHex) {
    try {
      const tx = Transaction.fromHex(artifactsOverride.transactionHex);
      inputBEEF = tx.toBEEF();
    } catch (err) {
      console.warn('[burnControlToken] Failed to convert transactionHex to BEEF', err);
    }
  }
  if (!inputBEEF) {
    console.warn('[burnControlToken] No transaction artifacts available for CT burn input');
  }

  const unlockingScriptTemplate = pushdrop.unlock(
    protocolID,
    keyID,
    counterparty,
    'all',
    false
  );

  // The CT UTXO to burn
  const ctInput = {
    txid: ctTxid,
    vout: ctVout,
    inputDescription: 'Control Token to burn',
    unlockingScriptTemplate,
    outpoint: `${ctTxid}.${ctVout}`
  };

  if (lockingScriptHex) {
    ctInput.lockingScript = lockingScriptHex;
    ctInput.lockingScriptHex = lockingScriptHex;
  }

  if (satoshis !== null) {
    ctInput.satoshis = satoshis;
    ctInput.sourceSatoshis = satoshis;
  }

  const estimatedUnlockLength = 220; // conservative estimate for PushDrop unlocking script size

  if (isJsonApi || walletStatus.walletType === 'brc6') {
    // Wallet APIs expect serialized template metadata instead of JS functions
    ctInput.unlockingScriptTemplate = {
      type: 'pushdrop',
      params: {
        protocol_id: protocolID,
        key_id: keyID,
        counterparty,
        permission: 'all',
        for_self: false
      }
    };
    ctInput.unlockingScriptLength = estimatedUnlockLength;
  }

  // Burn output (provably unspendable)
  // Donation output at index 0 - HD-invoice with static fallback
  const donationOutput = await buildDonationOutput(50);
  const outputs = donationOutput ? [
    donationOutput,
    {
      satoshis: 0,
      lockingScript: burnScript.toHex(),
      outputDescription: 'CT burn (provable erasure)'
    }
  ] : [
    {
      satoshis: 0,
      lockingScript: burnScript.toHex(),
      outputDescription: 'CT burn (provable erasure)'
    }
  ];

  console.log('[burnControlToken] Calling wallet.createAction with burn output...');
  const actionPayload = {
    description,
    inputs: [ctInput],
    outputs,
    fundingUtxos,
    options: { randomizeOutputs: false }  // Preserve output order for BRC-29 payment tracking
  };

  if (inputBEEF) {
    actionPayload.inputBEEF = Array.from(inputBEEF);
  }

  const response = await client.createAction(actionPayload);
  console.log('[burnControlToken] createAction response:', response);

  let burnTxid = extractTxid(response);
  let signResult = null;
  try {
    if (response?.signableTransaction) {
      console.log('[burnControlToken] signableTransaction returned, performing manual signature...');
      const { reference, tx: signableTx } = response.signableTransaction;
      if (!reference || !signableTx) {
        throw new Error('Wallet returned malformed signableTransaction payload');
      }

      const partialTx = Transaction.fromBEEF(signableTx);
      const unlockingScript = await unlockingScriptTemplate.sign(partialTx, 0);
      const unlockingScriptHex = unlockingScript.toHex();
      const unlockingScriptLength = unlockingScriptHex.length / 2;

      signResult = await client.signAction({
        reference,
        spends: {
          0: {
            unlockingScript: unlockingScriptHex,
            unlockingScriptLength
          }
        }
      });
      console.log('[burnControlToken] signAction response:', signResult);

      burnTxid = extractTxid(signResult) || burnTxid;
    }
  } catch (error) {
    const msg = String(error?.message || '');
    if (msg.includes('unlockScript parameter must be valid') || msg.includes('Script evaluation error')) {
      throw new Error(
        'This wallet does not control the Control Token for this thread. Only the wallet that minted the Control Token can burn it.',
      );
    }
    throw error;
  }

  if (burnTxid && !response.txid) {
    try {
      response.txid = burnTxid;
    } catch (assignErr) {
      console.debug('Unable to assign txid on burn response', assignErr);
    }
  }

  const artifactSource = signResult || response;
  let artifacts = null;
  try {
    artifacts = await collectTransactionArtifacts(artifactSource);
  } catch (err) {
    console.warn('[burnControlToken] Failed to collect burn transaction artifacts', err);
  }

  if (burnTxid && artifacts?.hasArtifacts) {
    persistTransactionArtifactsToStorage(burnTxid, artifacts);
  }

  // Clear invoice cache so next transaction gets a fresh address
  clearInvoiceCache();

  return { response, burnTxid, signResult, artifacts };
}
