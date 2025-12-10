const { createAuthMiddleware } = require('@bsv/auth-express-middleware')
const { ProtoWallet, PrivateKey } = require('@bsv/sdk')

function initAuthLayer(authServerWif) {
  let wallet = null
  if (authServerWif && authServerWif.trim()) {
    try {
      const signingKey = PrivateKey.fromWif(authServerWif.trim())
      wallet = new ProtoWallet(signingKey)
    } catch (err) {
      console.error('[auth] Failed to initialise server wallet:', err?.message || err)
    }
  } else {
    console.warn('[auth] AUTH_SERVER_WIF not set; requests will be allowed but marked unauthenticated')
  }

  const middleware = wallet
    ? createAuthMiddleware({ wallet, allowUnauthenticated: true })
    : null

  function attach(req, res, next) {
    if (!wallet) {
      req.auth = { identityKey: 'unknown' }
      return next()
    }
    if (middleware) {
      return middleware(req, res, next)
    }
    return next()
  }

  const getIdentityKey = (req) => req?.auth?.identityKey || 'unknown'

  return { wallet, attach, getIdentityKey }
}

module.exports = { initAuthLayer }
