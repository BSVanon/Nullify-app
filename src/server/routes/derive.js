const express = require('express')
const { HD, PrivateKey } = require('@bsv/sdk')

function deriveFromXpub(xpub, index, network) {
  const hd = HD.fromString(xpub)
  const child = hd.deriveChild(0).deriveChild(index)
  const prefix = network === 'mainnet' || network === 'main' ? 'main' : 'test'
  const address = child.pubKey.toAddress(prefix)
  return { address, index, pattern: 'account', network: prefix }
}

module.exports = ({ config }) => {
  const router = express.Router()
  const networkLower = (config.network || 'main').toLowerCase()

  router.post('/wif-to-address', (req, res) => {
    try {
      const { wif } = req.body || {}
      if (typeof wif !== 'string' || wif.trim() === '') {
        return res.status(400).json({ error: 'wif required' })
      }
      const cleaned = wif.replace(/\s+/g, '').replace(/[^\x20-\x7E]/g, '')
      try {
        const priv = PrivateKey.fromString(cleaned)
        const address = priv.toPublicKey().toAddress(networkLower === 'main' || networkLower === 'mainnet' ? 'main' : 'test')
        return res.json({ address, network: networkLower })
      } catch (_e) {
        return res.status(400).json({ error: 'Invalid WIF: could not decode.' })
      }
    } catch (err) {
      console.warn('api/wif-to-address error:', err?.message || err)
      return res.status(500).json({ error: 'Internal error' })
    }
  })

  router.get('/derive-address', (req, res) => {
    try {
      if (!config.merchantXpub) return res.status(400).json({ error: 'MERCHANT_XPUB not configured' })
      const index = Number.parseInt(String(req.query.index ?? '0'), 10)
      if (!Number.isInteger(index) || index < 0 || index > 19) {
        return res.status(400).json({ error: 'index must be an integer in [0,19]' })
      }
      const result = deriveFromXpub(config.merchantXpub, index, networkLower)
      return res.json(result)
    } catch (err) {
      console.warn('derive-address (GET) error:', err?.message || err)
      return res.status(500).json({ error: 'Internal error' })
    }
  })

  router.post('/derive-address', (req, res) => {
    try {
      if (!config.merchantXpub) return res.status(400).json({ error: 'MERCHANT_XPUB not configured' })
      const { index } = req.body || {}
      if (!Number.isInteger(index) || index < 0 || index > 19) {
        return res.status(400).json({ error: 'index must be an integer in [0,19]' })
      }
      const result = deriveFromXpub(config.merchantXpub, index, networkLower)
      return res.json(result)
    } catch (err) {
      console.warn('derive-address (POST) error:', err?.message || err)
      return res.status(500).json({ error: 'Internal error' })
    }
  })

  return router
}
