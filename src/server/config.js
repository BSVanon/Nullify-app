const path = require('path')
const fs = require('fs')
const dotenv = require('dotenv')

function resolveEnvPath(filename) {
  return path.resolve(__dirname, '..', '..', filename)
}

function loadEnvironment() {
  const localPath = resolveEnvPath('.env.local')
  if (fs.existsSync(localPath)) {
    dotenv.config({ path: localPath })
    return
  }

  const defaultPath = resolveEnvPath('.env')
  if (fs.existsSync(defaultPath)) {
    dotenv.config({ path: defaultPath })
    return
  }

  dotenv.config()
}

function buildConfig() {
  return {
    port: parseInt(process.env.HTTP_PORT || '3001', 10),
    paymentMinConf: parseInt(process.env.PAYMENT_MIN_CONF || '0', 10),
    primaryExplorer: process.env.NEXT_PUBLIC_EXPLORER_PRIMARY_URL || 'https://api.whatsonchain.com',
    fallbackExplorer: process.env.NEXT_PUBLIC_EXPLORER_FALLBACK_URL || 'https://api.gorillapool.io',
    merchantXpub: process.env.MERCHANT_XPUB || '',
    network: process.env.BSV_NETWORK || 'main',
    jwtSecret: process.env.JWT_SECRET,
    authServerWif: process.env.AUTH_SERVER_WIF || '',
    https: {
      enabled: String(process.env.HTTPS_ENABLE || '0') === '1',
      keyPath: process.env.SSL_KEY_PATH,
      certPath: process.env.SSL_CERT_PATH,
      port: parseInt(process.env.HTTPS_PORT || '443', 10)
    }
  }
}

module.exports = { loadEnvironment, buildConfig }
