// Configuration constants for Nullify
// Canonical palette: Tailwind only — do not introduce ad-hoc hex codes in app logic.

// Vite exposes env vars via import.meta.env (prefixed with VITE_)
// Fallback to process.env for SSR/Node contexts
const getEnv = (key) => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env[key]
  }
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key]
  }
  return undefined
}

export const CONFIG = {
  // BSV Network Configuration (env-driven; mainnet by default per policy)
  BSV_NETWORK: getEnv('VITE_BSV_NETWORK') || getEnv('BSV_NETWORK') || 'main',
  EXPLORER_URL: getEnv('VITE_EXPLORER_PRIMARY_URL') || getEnv('NEXT_PUBLIC_EXPLORER_PRIMARY_URL') || 'https://api.whatsonchain.com',

  // Wallet Configuration (dual substrate supported; runtime detection elsewhere)
  // 'auto' tries JSON-API (3321) → BRC-7 → BRC-6 (xdm://parent)
  // ✅ JSON-API working with Metanet Desktop v0.6.42 on localhost:3321
  // new WalletClient() with no args connects to JSON-API by default
  // BRC-6 XDM remains as fallback for other BRC-100 wallets
  WALLET_SUBSTRATE: getEnv('VITE_WALLET_SUBSTRATE') || getEnv('WALLET_SUBSTRATE') || 'auto',

  METANET_DESKTOP_ORIGIN: getEnv('VITE_DESKTOP_ORIGIN') || 'http://localhost:3321',

  OVERLAY_ENDPOINT: getEnv('VITE_OVERLAY_ENDPOINT') || '',

  HELPER_CACHE_ENDPOINT: getEnv('VITE_HELPER_CACHE_ENDPOINT') || '',

  MESSAGE_BOX_WS_URL: getEnv('VITE_MESSAGE_BOX_WS_URL') || '',

  MESSAGE_BOX_APP_ID: getEnv('VITE_MESSAGE_BOX_APP_ID') || '',

  MESSAGE_BOX_APP_SECRET: getEnv('VITE_MESSAGE_BOX_APP_SECRET') || '',

  REMOTE_MESSAGING_API_URL: getEnv('VITE_REMOTE_MESSAGING_API_URL') || '',

  REMOTE_MESSAGING_ENABLED: (() => {
    const raw = getEnv('VITE_REMOTE_MESSAGING_ENABLED') ?? ''
    if (typeof raw === 'string' && raw.trim() !== '') {
      return !['false', '0', 'no', 'off'].includes(raw.trim().toLowerCase())
    }
    return false
  })(),

  DONATION_IDENTITY_KEY: getEnv('VITE_DONATION_IDENTITY_KEY') || '',

  // Debug Configuration
  // Set VITE_DEBUG_VERBOSE=true to enable verbose logging for wallet, overlay, and payment flows
  DEBUG_VERBOSE: (() => {
    const raw = getEnv('VITE_DEBUG_VERBOSE') ?? ''
    if (typeof raw === 'string' && raw.trim() !== '') {
      return ['true', '1', 'yes', 'on'].includes(raw.trim().toLowerCase())
    }
    // Default to true in dev mode, false in production
    return typeof import.meta !== 'undefined' && import.meta.env?.DEV === true
  })(),

  // Storage Configuration
  STORAGE_PROVIDER: 'ipfs',

  // Encryption Configuration
  ENCRYPTION_ALGORITHM: 'AES-256-GCM',

  // App Configuration
  APP_NAME: 'Nullify',
  APP_VERSION: '1.0.0',
  APP_DESCRIPTION: 'Nullify: self-destructing access tokens on the BSV blockchain',

  // UI Configuration (semantic tokens; map to Tailwind classes at component level)
  THEME: {
    buttons: {
      primary: 'bg-yellow-300 text-gray-800 dark:bg-yellow-200 dark:text-gray-900',
      danger: 'bg-red-500 text-white',
      outline: 'border-2 border-gray-300 text-gray-700'
    },
    input: 'border-2 border-gray-300 dark:border-gray-700 focus:ring-cyan-500 focus:border-cyan-500',
    card: 'bg-gray-100 dark:bg-gray-900 border-2 border-black'
  }
}

// Environment validation
export const validateConfig = () => {
  const required = ['BSV_NETWORK', 'EXPLORER_URL', 'WALLET_SUBSTRATE']
  const missing = required.filter(key => !CONFIG[key])

  if (missing.length > 0) {
    throw new Error(`Missing required configuration: ${missing.join(', ')}`)
  }

  // Validate wallet substrate
  const validSubstrates = ['brc7', 'brc6', 'json-api', 'auto']
  if (!validSubstrates.includes(CONFIG.WALLET_SUBSTRATE)) {
    throw new Error(`Invalid WALLET_SUBSTRATE: ${CONFIG.WALLET_SUBSTRATE}. Must be one of: ${validSubstrates.join(', ')}`)
  }

  return true
}

// Debug helper: expose config to browser console for troubleshooting
if (typeof window !== 'undefined' && import.meta?.env?.DEV) {
  window.__NULLIFY_CONFIG_DEBUG__ = {
    OVERLAY_ENDPOINT: CONFIG.OVERLAY_ENDPOINT,
    HELPER_CACHE_ENDPOINT: CONFIG.HELPER_CACHE_ENDPOINT,
    REMOTE_MESSAGING_API_URL: CONFIG.REMOTE_MESSAGING_API_URL,
    REMOTE_MESSAGING_ENABLED: CONFIG.REMOTE_MESSAGING_ENABLED,
    BSV_NETWORK: CONFIG.BSV_NETWORK,
    WALLET_SUBSTRATE: CONFIG.WALLET_SUBSTRATE
  }
}
