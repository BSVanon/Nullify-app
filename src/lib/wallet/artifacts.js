let sdkModulePromise = null

function loadSdkModule() {
  if (!sdkModulePromise) {
    sdkModulePromise = import('/node_modules/@bsv/sdk/dist/esm/mod.js')
  }
  return sdkModulePromise
}

function uint8ArrayFromMaybe(input) {
  if (!input) return null
  if (input instanceof Uint8Array) return input
  if (Array.isArray(input)) return Uint8Array.from(input)
  if (typeof input === 'string') {
    try {
      const clean = input.trim()
      if (/^[0-9a-fA-F]+$/.test(clean) && clean.length % 2 === 0) {
        const bytes = new Uint8Array(clean.length / 2)
        for (let i = 0; i < clean.length; i += 2) {
          bytes[i / 2] = parseInt(clean.slice(i, i + 2), 16)
        }
        return bytes
      }
    } catch (err) {
      console.warn('[uint8ArrayFromMaybe] Failed to parse string as bytes')
    }
  }
  return null
}

function base64FromUint8(input) {
  if (!input) return null

  const uint8 = input instanceof Uint8Array
    ? input
    : Array.isArray(input)
      ? Uint8Array.from(input)
      : uint8ArrayFromMaybe(input)

  if (!uint8) return null

  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < uint8.length; i += chunk) {
    binary += String.fromCharCode.apply(null, uint8.subarray(i, i + chunk))
  }
  return btoa(binary)
}

export async function parseTransactionFromResponse(response) {
  if (!response || typeof response !== 'object') return null
  const { Transaction } = await loadSdkModule()

  const beefCandidate = response.tx || response.transaction || response.btx
  const hexCandidate = response.rawTx || response.txHex || response.hex || response.rawtx

  if (typeof hexCandidate === 'string' && hexCandidate.trim()) {
    try {
      return Transaction.fromHex(hexCandidate.trim())
    } catch (err) {
      console.warn('[parseTransactionFromResponse] Failed to parse hex tx', err)
    }
  }

  if (Array.isArray(beefCandidate) && beefCandidate.length) {
    try {
      const beefBytes = beefCandidate instanceof Uint8Array
        ? beefCandidate
        : Uint8Array.from(beefCandidate)
      return Transaction.fromBEEF(beefBytes)
    } catch (err) {
      console.warn('[parseTransactionFromResponse] Failed to parse BEEF tx', err)
    }
  }

  if (beefCandidate && typeof beefCandidate === 'object') {
    const beefArray = beefCandidate.beef || beefCandidate.raw || beefCandidate.tx
    if (Array.isArray(beefArray)) {
      try {
        const beefBytes = Uint8Array.from(beefArray)
        return Transaction.fromBEEF(beefBytes)
      } catch (err) {
        console.warn('[parseTransactionFromResponse] Failed to parse nested BEEF tx', err)
      }
    }
    const beefHex = beefCandidate.hex || beefCandidate.rawTx
    if (typeof beefHex === 'string' && beefHex.trim()) {
      try {
        return Transaction.fromHex(beefHex.trim())
      } catch (err) {
        console.warn('[parseTransactionFromResponse] Failed to parse nested hex tx', err)
      }
    }
  }

  return null
}

export async function collectTransactionArtifacts(response) {
  const { Transaction } = await loadSdkModule()

  let tx = await parseTransactionFromResponse(response)
  let beefBytes = null
  let hex = null

  if (tx) {
    try {
      beefBytes = tx.toBEEF()
    } catch (err) {
      console.warn('[collectTransactionArtifacts] Failed to convert tx to BEEF', err)
    }
    try {
      hex = tx.toHex()
    } catch (err) {
      console.warn('[collectTransactionArtifacts] Failed to convert tx to hex', err)
    }
  } else {
    const beefCandidate = response?.tx || response?.transaction || response?.btx
    beefBytes = uint8ArrayFromMaybe(beefCandidate)
    const hexCandidate = response?.rawTx || response?.txHex || response?.hex || response?.rawtx
    if (typeof hexCandidate === 'string' && hexCandidate.trim()) {
      hex = hexCandidate.trim()
    }
    if (!tx) {
      try {
        if (beefBytes) {
          tx = Transaction.fromBEEF(beefBytes)
        } else if (hex) {
          tx = Transaction.fromHex(hex)
        }
      } catch (err) {
        console.warn('[collectTransactionArtifacts] Unable to reconstruct transaction from response', err)
      }
    }
  }

  if (!hex && tx) {
    try {
      hex = tx.toHex()
    } catch (err) {
      console.warn('[collectTransactionArtifacts] Failed to derive hex from transaction', err)
    }
  }

  if ((!beefBytes || beefBytes.length === 0) && tx) {
    try {
      beefBytes = tx.toBEEF()
    } catch (err) {
      console.warn('[collectTransactionArtifacts] Failed to derive BEEF from transaction', err)
    }
  }

  const beefBase64 = beefBytes ? base64FromUint8(beefBytes) : null

  return {
    transactionHex: typeof hex === 'string' && hex.length ? hex : null,
    transactionBeefBase64: beefBase64,
    hasArtifacts: Boolean((hex && hex.length) || (beefBase64 && beefBase64.length))
  }
}

const TX_STORAGE_PREFIX = 'nukenote.tx.'

export function persistTransactionArtifactsToStorage(txid, artifacts) {
  if (!txid || !artifacts || typeof window === 'undefined') return
  const payload = {
    hex: artifacts.transactionHex || null,
    beefBase64: artifacts.transactionBeefBase64 || null,
    storedAt: Date.now()
  }
  try {
    window.localStorage.setItem(`${TX_STORAGE_PREFIX}${txid}`, JSON.stringify(payload))
  } catch (err) {
    console.warn('[persistTransactionArtifactsToStorage] Failed to persist artifacts', err)
  }
}
