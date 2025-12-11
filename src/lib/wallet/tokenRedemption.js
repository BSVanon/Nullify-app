/**
 * Token redemption utilities (CT verification + DT decryption)
 */

import { NullifyEncryption } from '../encryption.js'
import { unwrapKeyWithECIES } from '../crypto/keyWrapping.js'

const BURNED_FLAGS = ['spent', 'spentTxId', 'spentTxid', 'spentTransactionId']
let sdkModulePromise = null

async function fetchJson(url) {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`)
  }
  return res.json()
}

async function fetchJsonWithRetry(url, { attempts = 6, delayMs = 1500 } = {}) {
  let lastErr = null
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fetchJson(url)
    } catch (err) {
      lastErr = err
      if (i < attempts - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs))
      }
    }
  }
  throw lastErr || new Error('Unknown fetch error')
}

function loadSdkModule() {
  if (!sdkModulePromise) {
    sdkModulePromise = import('/node_modules/@bsv/sdk/dist/esm/mod.js')
  }
  return sdkModulePromise
}

function decodePushDropFieldsOnly(lockingScript, OP) {
  const fields = []
  for (let i = 2; i < lockingScript.chunks.length; i += 1) {
    const nextOpcode = lockingScript.chunks[i + 1]?.op
    let chunk = lockingScript.chunks[i].data ?? []

    if (chunk.length === 0) {
      const op = lockingScript.chunks[i].op
      if (op >= 80 && op <= 95) {
        chunk = [op - 80]
      } else if (op === 0) {
        chunk = [0]
      } else if (op === 0x4f) {
        chunk = [0x81]
      }
    }

    fields.push(chunk)

    if (nextOpcode === OP.OP_DROP || nextOpcode === OP.OP_2DROP) {
      break
    }
  }
  return fields
}

function safeDecodePushDrop(lockingScript, { PushDrop, OP }) {
  try {
    return PushDrop.decode(lockingScript)
  } catch (err) {
    if (err?.message === 'must have value') {
      const fields = decodePushDropFieldsOnly(lockingScript, OP)
      return { lockingPublicKey: undefined, fields }
    }
    throw err
  }
}

function hasBeenSpent(output = {}) {
  return BURNED_FLAGS.some(flag => {
    const value = output?.[flag]
    if (value === true) return true
    if (typeof value === 'string' && value.trim() !== '') return true
    if (typeof value === 'number' && Number.isFinite(value)) return true
    return false
  })
}

function parseHexTransaction(hex) {
  if (!hex || typeof hex !== 'string') return null
  try {
    const clean = hex.trim()
    if (!clean) return null
    return loadSdkModule().then(({ Transaction }) => {
      const tx = Transaction.fromHex(clean)
      const vout = tx?.outputs?.map(output => {
        const scriptHex = output?.lockingScript?.toHex?.()
        return {
          script: scriptHex,
          scriptPubKey: scriptHex ? { hex: scriptHex } : {}
        }
      }) || []
      return {
        tx: { vout },
        parsed: tx,
        provider: 'cache:hex'
      }
    })
  } catch (err) {
    console.warn('[parseHexTransaction] Failed', err)
    return null
  }
}

function parseBeefTransaction(beefBase64) {
  if (!beefBase64 || typeof beefBase64 !== 'string') return null
  try {
    const clean = beefBase64.trim()
    if (!clean) return null
    return loadSdkModule().then(({ Transaction }) => {
      const beefBytes = Uint8Array.from(atob(clean), c => c.charCodeAt(0))
      const tx = Transaction.fromBEEF(beefBytes)
      const vout = tx?.outputs?.map(output => {
        const scriptHex = output?.lockingScript?.toHex?.()
        return {
          script: scriptHex,
          scriptPubKey: scriptHex ? { hex: scriptHex } : {}
        }
      }) || []
      return {
        tx: { vout },
        parsed: tx,
        provider: 'cache:beef'
      }
    })
  } catch (err) {
    console.warn('[parseBeefTransaction] Failed', err)
    return null
  }
}

async function loadTransactionFromCache(txid, artifacts) {
  if (!artifacts) return null

  const { transactionHex, transactionBeefBase64 } = artifacts
  if (transactionHex) {
    const parsed = await parseHexTransaction(transactionHex)
    if (parsed) return parsed
  }
  if (transactionBeefBase64) {
    const parsed = await parseBeefTransaction(transactionBeefBase64)
    if (parsed) return parsed
  }
  return null
}

async function loadTransaction(txid, artifacts) {
  const cached = await loadTransactionFromCache(txid, artifacts)
  if (cached) return cached

  const data = await fetchJsonWithRetry(`/api/tx?txid=${encodeURIComponent(txid)}`)
  const tx = data?.tx
  if (!tx || !Array.isArray(tx.vout)) {
    throw new Error('Transaction data unavailable')
  }
  return { tx, provider: data?.provider }
}

async function loadRawTransaction(txid, artifacts) {
  if (artifacts?.transactionHex) {
    return { hex: artifacts.transactionHex, provider: 'cache:hex' }
  }
  const data = await fetchJsonWithRetry(`/api/tx/raw?txid=${encodeURIComponent(txid)}`)
  const hex = typeof data?.hex === 'string' ? data.hex.trim()
    : typeof data?.rawtx === 'string' ? data.rawtx.trim()
    : typeof data?.txhex === 'string' ? data.txhex.trim()
    : ''
  if (!hex) {
    throw new Error('Raw transaction hex unavailable')
  }
  return { hex, provider: data?.provider }
}

function outputFromBroadcast(txid, vout, broadcast) {
  if (!broadcast) return null
  const match = Array.isArray(broadcast?.outputs)
    ? broadcast.outputs.find(out => out.vout === vout)
    : null
  if (!match && broadcast?.vout === vout) {
    return {
      script: broadcast.lockingScriptHex,
      scriptPubKey: { hex: broadcast.lockingScriptHex },
      value: (broadcast.satoshis ?? 0) / 1e8,
      satoshis: broadcast.satoshis ?? 0,
      txid
    }
  }
  if (match) {
    return {
      script: match.lockingScriptHex,
      scriptPubKey: { hex: match.lockingScriptHex },
      value: (match.satoshis ?? 0) / 1e8,
      satoshis: match.satoshis ?? 0,
      txid
    }
  }
  return null
}

async function ensureOutput(txid, vout, artifacts, broadcast) {
  const broadcastOutput = outputFromBroadcast(txid, vout, broadcast)
  if (broadcastOutput) {
    return broadcastOutput
  }

  const { tx } = await loadTransaction(txid, artifacts)
  let output = tx.vout?.[vout]
  if (!output) {
    throw new Error(`Tx outpoint not found: ${txid}:${vout}`)
  }

  if (!output.scriptPubKey?.hex && !output.script) {
    try {
      const { hex } = await loadRawTransaction(txid, artifacts)
      const { Transaction } = await loadSdkModule()
      const parsed = Transaction.fromHex(hex)
      const lockingScript = parsed?.outputs?.[vout]?.lockingScript
      if (lockingScript) {
        const scriptHex = lockingScript.toHex()
        output = {
          ...output,
          script: scriptHex,
          scriptPubKey: {
            ...(output.scriptPubKey || {}),
            hex: scriptHex
          }
        }
      }
    } catch (err) {
      console.warn('[ensureOutput] Failed to augment output with raw tx', err)
    }
  }

  if (!output.scriptPubKey?.hex && !output.script) {
    throw new Error('Tx outpoint missing lockingScript')
  }

  return output
}

function decodePushDropJson(scriptHex) {
  if (!scriptHex || typeof scriptHex !== 'string') {
    throw new Error('PushDrop script missing')
  }
  return loadSdkModule().then(({ PushDrop, LockingScript, OP }) => {
    const locking = LockingScript.fromHex(scriptHex)
    const decoded = safeDecodePushDrop(locking, { PushDrop, OP })
    const fields = decoded?.fields || []
    if (!fields.length) throw new Error('PushDrop payload empty')
    const json = String.fromCharCode(...fields[0])
    try {
      return JSON.parse(json)
    } catch (err) {
      throw new Error(`Invalid PushDrop JSON: ${err.message}`)
    }
  })
}

async function downloadBytes(url) {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Download failed: HTTP ${res.status}`)
  }
  const buffer = await res.arrayBuffer()
  return new Uint8Array(buffer)
}

export async function redeemDataToken({
  ctTxid,
  ctVout = 0,
  dtTxid,
  dtVout = 0,
  identityPrivateKey,
  storageUrlOverride,
  fileName = 'nullify.bin',
  artifacts = null,
  broadcast = null
}) {
  if (!/^[0-9a-fA-F]{64}$/.test(ctTxid || '')) throw new Error('ctTxid must be 64-hex')
  if (!/^[0-9a-fA-F]{64}$/.test(dtTxid || '')) throw new Error('dtTxid must be 64-hex')
  if (!Number.isInteger(ctVout) || ctVout < 0) throw new Error('ctVout must be non-negative integer')
  if (!Number.isInteger(dtVout) || dtVout < 0) throw new Error('dtVout must be non-negative integer')
  if (!identityPrivateKey || typeof identityPrivateKey !== 'string') {
    throw new Error('Wallet private key (WIF or hex) required to unwrap data key')
  }

  const ctOutput = await ensureOutput(ctTxid, ctVout, artifacts?.ct, broadcast?.ct)
  if (hasBeenSpent(ctOutput)) {
    throw new Error('Control Token has been burned (output spent)')
  }

  const ctScript = ctOutput.scriptPubKey?.hex || ctOutput.script
  const ctPayload = await decodePushDropJson(ctScript)
  if (!ctPayload?.k) {
    throw new Error('Control Token payload missing encKeyWrap')
  }

  const dtArtifacts = artifacts?.dt || artifacts
  const dtBroadcast = broadcast?.dt || broadcast
  const dtOutput = await ensureOutput(dtTxid, dtVout, dtArtifacts, dtBroadcast)
  const dtScript = dtOutput.scriptPubKey?.hex || dtOutput.script
  const dtPayload = await decodePushDropJson(dtScript)

  if (dtPayload?.txid && dtPayload.txid !== ctTxid) {
    throw new Error('Data Token does not reference provided Control Token')
  }
  if (Number.isInteger(dtPayload?.vout) && dtPayload.vout !== ctVout) {
    throw new Error('Data Token references different CT output index')
  }

  const wrappedKey = dtPayload?.k || ctPayload.k
  if (!wrappedKey) {
    throw new Error('No wrapped key found in DT or CT payload')
  }

  const rawKey = await unwrapKeyWithECIES(wrappedKey, identityPrivateKey)

  const encryption = new NullifyEncryption()
  const cryptoKey = await encryption.importKey(rawKey)

  const encryptedUrl = storageUrlOverride || ctPayload.u || ctPayload.hintURL
  if (!encryptedUrl) {
    throw new Error('Control Token missing storage hint URL')
  }

  const encryptedBytes = await downloadBytes(encryptedUrl)
  const decryptedBytes = await encryption.decryptFile(encryptedBytes, cryptoKey)
  const blob = new Blob([decryptedBytes], { type: 'application/octet-stream' })
  const objectUrl = URL.createObjectURL(blob)

  return {
    decryptedUrl: objectUrl,
    fileName,
    ctPayload,
    dtPayload
  }
}

export async function verifyControlToken({ ctTxid, ctVout = 0 }) {
  if (!/^[0-9a-fA-F]{64}$/.test(ctTxid || '')) throw new Error('ctTxid must be 64-hex')
  if (!Number.isInteger(ctVout) || ctVout < 0) throw new Error('ctVout must be non-negative integer')

  const ctOutput = await ensureOutput(ctTxid, ctVout)
  const status = hasBeenSpent(ctOutput) ? 'burned' : 'active'

  let payload = null
  try {
    const scriptHex = ctOutput.scriptPubKey?.hex || ctOutput.script
    payload = scriptHex ? await decodePushDropJson(scriptHex) : null
  } catch (err) {
    console.warn('[verifyControlToken] Failed to decode CT payload', err)
  }

  return {
    status,
    output: ctOutput,
    payload
  }
}
