import { parseTransactionFromResponse } from './artifacts.js'

export async function mapLockingScriptsToIndexes(response, lockingScriptHexes = []) {
  if (!Array.isArray(lockingScriptHexes) || lockingScriptHexes.length === 0) {
    return []
  }

  const tx = await parseTransactionFromResponse(response)
  if (!tx) {
    console.warn('[mapLockingScriptsToIndexes] Transaction unavailable in wallet response')
    return lockingScriptHexes.map(() => null)
  }

  const remaining = lockingScriptHexes.map(hex => (typeof hex === 'string' ? hex.toLowerCase() : ''))
  const outputs = tx.outputs || []
  const outHexes = outputs.map(out => {
    try {
      return out.lockingScript?.toHex()?.toLowerCase() || ''
    } catch (err) {
      return ''
    }
  })

  return remaining.map((target) => {
    if (!target) return null
    const matchIndex = outHexes.indexOf(target)
    if (matchIndex >= 0) {
      outHexes[matchIndex] = null
      return matchIndex
    }
    console.warn('[mapLockingScriptsToIndexes] Unable to locate lockingScript in transaction outputs', { target })
    return null
  })
}
