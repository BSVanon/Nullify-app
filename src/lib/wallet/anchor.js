import { getWallet } from './client.js'

export async function anchorViaWallet(hashHex) {
  if (!/^[0-9a-fA-F]{64}$/.test(hashHex)) throw new Error('hashHex must be 64-hex')
  const { opReturnTPF1Hex } = await import('/src/lib/tx.js')
  const scriptHex = opReturnTPF1Hex(hashHex, '1', 'TPF1')
  const { client } = await getWallet()

  try {
    const response = await client.createAction({
      description: 'Anchor Nullify proof',
      outputs: [{ satoshis: 0, lockingScript: scriptHex, outputDescription: 'TPF1 anchor' }]
    })
    const txid = response?.txid || response?.result?.txid || response?.transactionId || response?.id || null
    if (txid && !response.txid) {
      try {
        response.txid = txid
      } catch (assignErr) {
        console.debug('Unable to assign txid on wallet response', assignErr)
      }
    }
    return response
  } catch (err) {
    const msg = err?.message || String(err)
    throw new Error(`Wallet action failed: ${msg}`)
  }
}
