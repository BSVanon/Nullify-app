const express = require('express')
const { getUtxos, getTx, getRawTx, broadcast } = require('../explorer')

module.exports = ({ config, getIdentityKey }) => {
  const router = express.Router()
  const explorerOpts = {
    primary: config.primaryExplorer,
    fallback: config.fallbackExplorer,
    netPath: (config.network || 'main').toLowerCase().startsWith('main') ? 'main' : 'test'
  }

  router.get('/debug/funding-utxo-raw', async (req, res) => {
    try {
      const address = String(req.query.address || '').trim()
      if (!address) return res.status(400).json({ error: 'address required' })
      const attempts = []
      const { provider, utxos } = await getUtxos(address, explorerOpts)
      const first = Array.isArray(utxos) ? utxos[0] : null
      if (!first) {
        return res.json({ address, provider, utxo: null, attempts, note: 'No UTXOs for address', identityKey: getIdentityKey(req) })
      }
      let raw = null
      try {
        raw = await getRawTx(first.txid, { ...explorerOpts, preferProvider: provider })
        attempts.push({ step: 'getRawTx', ok: true, provider: raw.provider })
      } catch (e) {
        attempts.push({ step: 'getRawTx', ok: false, error: String(e?.message || e) })
      }
      return res.json({
        address,
        provider,
        utxo: first,
        raw: raw ? { ok: true, provider: raw.provider, hexPreview: raw.hex?.slice(0, 64) ?? null } : { ok: false },
        attempts,
        identityKey: getIdentityKey(req)
      })
    } catch (err) {
      console.warn('api/debug/funding-utxo-raw error:', err?.message || err)
      return res.status(500).json({ error: 'Internal error' })
    }
  })

  router.get('/address-utxos', async (req, res) => {
    try {
      const address = String(req.query.address || '').trim()
      if (!address) return res.status(400).json({ error: 'address required' })
      const { provider, utxos } = await getUtxos(address, explorerOpts)
      return res.json({ provider, utxos, identityKey: getIdentityKey(req) })
    } catch (err) {
      console.warn('api/address-utxos error:', err?.message || err)
      return res.status(500).json({ error: 'Internal error' })
    }
  })

  router.post('/broadcast', async (req, res) => {
    try {
      const { rawtx, txhex } = req.body || {}
      const hex = typeof rawtx === 'string' ? rawtx : (typeof txhex === 'string' ? txhex : '')
      if (!hex || !/^[0-9a-fA-F]+$/.test(hex)) {
        return res.status(400).json({ error: 'rawtx (hex) required' })
      }
      const result = await broadcast(hex, explorerOpts)
      return res.json({ ...result, identityKey: getIdentityKey(req) })
    } catch (err) {
      console.warn('api/broadcast error:', err?.message || err)
      return res.status(500).json({ error: 'Internal error' })
    }
  })

  router.get('/tx/raw', async (req, res) => {
    try {
      const txid = String(req.query.txid || '').trim()
      if (!txid) return res.status(400).json({ error: 'txid required' })
      const prefer = typeof req.query.prefer === 'string' ? req.query.prefer : ''
      const result = await getRawTx(txid, { ...explorerOpts, preferProvider: prefer })
      return res.json({ ...result, identityKey: getIdentityKey(req) })
    } catch (err) {
      let detail = String(err?.message || err)
      let attempts = undefined
      const wantTxObj = String(req.query.txobj || '').trim() === '1'
      try {
        const parsed = JSON.parse(detail)
        if (parsed && typeof parsed === 'object') {
          attempts = parsed.attempts
          detail = parsed.error || detail
        }
      } catch (_) {}

      if (wantTxObj) {
        try {
          const tx = await getTx(String(req.query.txid || ''), explorerOpts)
          return res.status(502).json({ error: 'Raw hex unavailable', detail, attempts, tx: tx.tx, provider: tx.provider })
        } catch (_) {}
      }

      console.warn('api/tx/raw error:', detail, attempts ? attempts : '')
      return res.status(500).json({ error: 'Internal error', detail, attempts })
    }
  })

  router.get('/tx', async (req, res) => {
    try {
      const txid = String(req.query.txid || '').trim()
      if (!txid) return res.status(400).json({ error: 'txid required' })
      const result = await getTx(txid, explorerOpts)
      return res.json({ ...result, identityKey: getIdentityKey(req) })
    } catch (err) {
      console.warn('api/tx error:', err?.message || err)
      return res.status(500).json({ error: 'Internal error' })
    }
  })

  return router
}
