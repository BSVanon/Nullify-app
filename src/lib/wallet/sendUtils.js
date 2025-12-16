import { CONFIG } from '../config.js'
import { getWallet, extractTxid } from './client.js'
import { PublicKey, P2PKH } from '@bsv/sdk'

// Minimal helper to send a simple P2PKH payment to a holder's identity key using wallet.createAction.
// identityKey is expected to be a compressed secp256k1 public key hex string.
export async function sendSatsToIdentityKey({ identityKey, amountSats, description }) {
  if (!identityKey || typeof identityKey !== 'string') {
    throw new Error('Recipient identity key is required')
  }

  const amount = Number(amountSats)
  if (!Number.isFinite(amount) || !Number.isInteger(amount) || amount <= 0) {
    throw new Error('Amount must be a positive integer number of sats')
  }

  const { client } = await getWallet()

  let networkPrefix = 'main'
  try {
    const raw = String(CONFIG.BSV_NETWORK || 'main').toLowerCase()
    if (raw === 'test' || raw === 'testnet') {
      networkPrefix = 'test'
    }
  } catch {
    networkPrefix = 'main'
  }

  let address
  try {
    const pub = PublicKey.fromString(identityKey)
    address = pub.toAddress(networkPrefix)
  } catch (error) {
    console.error('[sendSatsToIdentityKey] Failed to derive address from identity key', error)
    throw new Error('Unable to derive payment address from identity key')
  }

  const p2pkh = new P2PKH()
  const lockingScript = p2pkh.lock(address)
  const lockingScriptHex = lockingScript.toHex()

  const outputs = [
    {
      satoshis: amount,
      lockingScript: lockingScriptHex,
      outputDescription: 'Nullify sats support',
    },
  ]

  const actionDescription =
    description || 'Send sats to contact to help cover Nullify messaging fees'

  const response = await client.createAction({
    description: actionDescription,
    outputs,
    labels: ['wallet payment'],
  })

  const txid = extractTxid(response)
  return { response, txid }
}

// Minimal helper to send sats directly to a legacy/base58 address using wallet.createAction.
// This bypasses identity-key derivation and is intended for low-level testing.
export async function sendSatsToAddress({ address, amountSats, description }) {
  if (!address || typeof address !== 'string') {
    throw new Error('Recipient address is required')
  }

  const amount = Number(amountSats)
  if (!Number.isFinite(amount) || !Number.isInteger(amount) || amount <= 0) {
    throw new Error('Amount must be a positive integer number of sats')
  }

  const { client } = await getWallet()

  let lockingScriptHex
  try {
    const p2pkh = new P2PKH()
    const lockingScript = p2pkh.lock(address)
    lockingScriptHex = lockingScript.toHex()
  } catch (error) {
    console.error('[sendSatsToAddress] Failed to build locking script for address', address, error)
    throw new Error('Unable to derive payment script from address')
  }

  const outputs = [
    {
      satoshis: amount,
      lockingScript: lockingScriptHex,
      outputDescription: 'Nullify sats support (address)',
    },
  ]

  const actionDescription = description || 'Send sats (address) via Nullify debug helper'

  const response = await client.createAction({
    description: actionDescription,
    outputs,
    // Use 'wallet payment' protocol so this is covered by manifest grouped permissions
    labels: ['wallet payment'],
  })

  const txid = extractTxid(response)
  return { response, txid }
}
