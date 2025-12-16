import { Transaction } from '@bsv/sdk'

function base64ToBytes(value) {
  if (typeof value !== 'string') return null

  try {
    if (typeof atob === 'function') {
      const bin = atob(value)
      const bytes = new Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      return bytes
    }
  } catch {
    // fall through
  }

  try {
    if (
      typeof globalThis !== 'undefined' &&
      globalThis.Buffer &&
      typeof globalThis.Buffer.from === 'function'
    ) {
      return Array.from(globalThis.Buffer.from(value, 'base64'))
    }
  } catch {
    // fall through
  }

  return null
}

function hexToBytes(value) {
  if (typeof value !== 'string') return null
  const clean = value.trim()
  if (!clean) return null
  if (!/^[0-9a-fA-F]+$/.test(clean) || clean.length % 2 !== 0) return null

  const bytes = new Array(clean.length / 2)
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.slice(i, i + 2), 16)
  }
  return bytes
}

export function extractAtomicBeef(res) {
  if (!res || typeof res !== 'object') return null
  return (
    res.tx ||
    res?.signableTransaction?.tx ||
    res?.result?.tx ||
    res?.result?.signableTransaction?.tx ||
    null
  )
}

export function atomicBeefToRawTxHex(atomicBeef) {
  if (!atomicBeef) return null

  let bytes = null
  if (atomicBeef instanceof Uint8Array) {
    bytes = Array.from(atomicBeef)
  } else if (Array.isArray(atomicBeef)) {
    bytes = atomicBeef
  } else if (typeof atomicBeef === 'string') {
    bytes = hexToBytes(atomicBeef) || base64ToBytes(atomicBeef)
  } else if (typeof atomicBeef === 'object') {
    const nested = atomicBeef?.data || atomicBeef?.raw || atomicBeef?.beef || atomicBeef?.tx || null
    if (nested instanceof Uint8Array) {
      bytes = Array.from(nested)
    } else if (Array.isArray(nested)) {
      bytes = nested
    } else if (typeof nested === 'string') {
      bytes = hexToBytes(nested) || base64ToBytes(nested)
    }
  }

  if (!bytes) return null

  try {
    const tx = Transaction.fromBEEF(bytes)
    return tx.toHex()
  } catch (err) {
    try {
      const tx = Transaction.fromAtomicBEEF(bytes)
      return tx.toHex()
    } catch {
      const tx = Transaction.fromBinary(bytes)
      return tx.toHex()
    }
  }
}
