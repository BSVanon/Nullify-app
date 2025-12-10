const express = require('express')

module.exports = ({ config, hostname, getIdentityKey }) => {
  const router = express.Router()

  router.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      message: 'NukeNote server is running',
      timestamp: new Date().toISOString(),
      network: config.network || 'main',
      hostname,
      minConf: config.paymentMinConf,
      identityKey: getIdentityKey(req)
    })
  })

  router.get('/merchant-xpub', (req, res) => {
    res.json({
      xpub: config.merchantXpub,
      network: config.network || 'main',
      identityKey: getIdentityKey(req)
    })
  })

  router.get('/ping', (_req, res) => res.json({ pong: true }))

  return router
}
