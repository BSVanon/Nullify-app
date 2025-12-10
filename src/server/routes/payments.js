const express = require('express')

module.exports = ({ config, rateLimiter, getIdentityKey }) => {
  const router = express.Router()
  const networkLower = (config.network || 'main').toLowerCase()
  const netPath = networkLower === 'mainnet' || networkLower === 'main' ? 'main' : 'test'
  const MIN_CONF_DEFAULT = config.paymentMinConf ?? 0

  const explorerPrimary = config.primaryExplorer
  const explorerFallback = config.fallbackExplorer.includes('http')
    ? config.fallbackExplorer
    : `https://${config.fallbackExplorer}`

  router.post('/verify-payment', async (req, res) => {
    try {
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown'
      if (rateLimiter(String(ip))) {
        return res.status(429).json({ error: 'Rate limit exceeded' })
      }

      const { address, amountSatoshis, minConf, txid } = req.body || {}
      const required = Number.isInteger(amountSatoshis) ? amountSatoshis : NaN
      const confirmations = Number.isInteger(minConf) ? minConf : MIN_CONF_DEFAULT

      if (!address || !Number.isInteger(required) || required <= 0) {
        return res.status(400).json({ error: 'Invalid request: address and positive amountSatoshis required' })
      }

      async function fetchSumWOC() {
        const url = `${explorerPrimary}/v1/bsv/${netPath}/address/${encodeURIComponent(address)}/unspent`
        const r = await fetch(url, { method: 'GET' })
        if (!r.ok) throw new Error(`WOC HTTP ${r.status}`)
        const utxos = await r.json()
        let sum = 0
        for (const u of utxos) {
          const conf = typeof u.confirmations === 'number' ? u.confirmations : 0
          if (conf >= confirmations) sum += (u.value || u.satoshis || 0)
        }
        return sum
      }

      async function fetchSumGorilla() {
        const base = explorerFallback.includes('gorillapool.io') ? explorerFallback : 'https://api.gorillapool.io'
        const url = `${base}/api/bsv/${netPath}/address/${encodeURIComponent(address)}/utxo`
        const r = await fetch(url, { method: 'GET' })
        if (!r.ok) throw new Error(`Gorilla HTTP ${r.status}`)
        const utxos = await r.json()
        let sum = 0
        for (const u of utxos) {
          const conf = typeof u.confirmations === 'number' ? u.confirmations : 0
          if (conf >= confirmations) sum += (u.satoshis || u.value || 0)
        }
        return sum
      }

      async function fetchConfirmedBalanceWOC() {
        const url = `${explorerPrimary}/v1/bsv/${netPath}/address/${encodeURIComponent(address)}/balance`
        const r = await fetch(url, { method: 'GET' })
        if (!r.ok) throw new Error(`WOC BAL HTTP ${r.status}`)
        const b = await r.json()
        return typeof b.confirmed === 'number' ? b.confirmed : 0
      }

      async function fetchConfirmedBalanceGorilla() {
        const base = explorerFallback.includes('gorillapool.io') ? explorerFallback : 'https://api.gorillapool.io'
        const url = `${base}/api/bsv/${netPath}/address/${encodeURIComponent(address)}/balance`
        const r = await fetch(url, { method: 'GET' })
        if (!r.ok) throw new Error(`Gorilla BAL HTTP ${r.status}`)
        const b = await r.json()
        return typeof b.confirmed === 'number' ? b.confirmed : 0
      }

      async function verifyByTxidWOC() {
        const url = `${explorerPrimary}/v1/bsv/${netPath}/tx/hash/${encodeURIComponent(txid)}`
        const r = await fetch(url, { method: 'GET' })
        if (!r.ok) throw new Error(`WOC TX HTTP ${r.status}`)
        const tx = await r.json()
        let toAddressSum = 0
        const vouts = tx.vout || []
        for (const o of vouts) {
          const spk = o.scriptPubKey || {}
          const addrs = spk.addresses || (spk.address ? [spk.address] : [])
          const valueSats = Math.round((o.value || 0) * 1e8)
          if (addrs.includes(address)) toAddressSum += valueSats
        }
        const conf = typeof tx.confirmations === 'number' ? tx.confirmations : 0
        return { toAddressSum, conf }
      }

      async function verifyByTxidGorilla() {
        const base = explorerFallback.includes('gorillapool.io') ? explorerFallback : 'https://api.gorillapool.io'
        const url = `${base}/api/bsv/${netPath}/tx/${encodeURIComponent(txid)}`
        const r = await fetch(url, { method: 'GET' })
        if (!r.ok) throw new Error(`Gorilla TX HTTP ${r.status}`)
        const tx = await r.json()
        let toAddressSum = 0
        const vouts = tx.vout || tx.outputs || []
        for (const o of vouts) {
          const valueSats = o.satoshis || Math.round((o.value || 0) * 1e8) || 0
          const addr = o.address || (o.scriptPubKey && (o.scriptPubKey.address || (o.scriptPubKey.addresses && o.scriptPubKey.addresses[0])))
          if (addr === address) toAddressSum += valueSats
        }
        const conf = typeof tx.confirmations === 'number' ? tx.confirmations : (tx.status && tx.status.confirmations) || 0
        return { toAddressSum, conf }
      }

      let ok = false
      let paid = 0
      let mode = 'utxo'
      let provider = null
      let debug = {}

      if (txid) {
        mode = 'txid'
        try {
          const { toAddressSum, conf } = await verifyByTxidWOC()
          paid = toAddressSum
          ok = toAddressSum >= required && conf >= confirmations
          provider = 'woc'
          debug = { conf }
        } catch (_e) {
          const { toAddressSum, conf } = await verifyByTxidGorilla()
          paid = toAddressSum
          ok = toAddressSum >= required && conf >= confirmations
          provider = 'gorilla'
          debug = { conf }
        }
      } else {
        if (confirmations >= 1) {
          try {
            const val = await fetchConfirmedBalanceWOC()
            paid = val
            provider = 'woc'
            mode = 'balance'
            debug = { confirmed: val }
          } catch (_e) {
            const val = await fetchConfirmedBalanceGorilla()
            paid = val
            provider = 'gorilla'
            mode = 'balance'
            debug = { confirmed: val }
          }
        } else {
          try {
            paid = await fetchSumWOC()
            provider = 'woc'
            mode = 'utxo'
          } catch (_e) {
            paid = await fetchSumGorilla()
            provider = 'gorilla'
            mode = 'utxo'
          }
        }
        ok = paid >= required
      }

      if (!ok) {
        return res.status(402).json({
          ok: false,
          reason: txid ? 'Tx does not pay required amount or lacks confirmations' : 'Insufficient payment',
          required,
          paid,
          confirmations,
          mode,
          provider,
          debug,
          identityKey: getIdentityKey(req)
        })
      }

      const { jwtSecret } = config
      if (!jwtSecret) {
        return res.json({ ok: true, paid, confirmations, token: null, note: 'JWT_SECRET not set', mode, provider, debug, identityKey: getIdentityKey(req) })
      }

      let jwt
      try {
        jwt = require('jsonwebtoken')
      } catch (_e) {
        return res.json({ ok: true, paid, confirmations, token: null, note: 'jsonwebtoken not installed' })
      }

      const payload = { sub: 'payment', address, amountSatoshis: required, iat: Math.floor(Date.now() / 1000) }
      const token = jwt.sign(payload, jwtSecret, { expiresIn: '5m' })
      return res.json({ ok: true, paid, confirmations, token, mode, provider, debug, identityKey: getIdentityKey(req) })
    } catch (err) {
      console.warn('verify-payment error:', err?.message || err)
      return res.status(500).json({ error: 'Internal error' })
    }
  })

  return router
}
