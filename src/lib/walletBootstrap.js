import { WalletClient } from '@bsv/sdk'
import { CONFIG } from './config'
import {
  connectJsonApiWallet,
  getCachedJsonApiWallet,
  JSON_API_CAPABILITIES,
  resetJsonApiCache,
  ensureAuthenticated
} from './wallet/jsonApiClient'
import { initHeadlessWallet } from './wallet/brc7-headless.js'
import { resetWalletWarmup } from './wallet/client.js'

class WalletBootstrap {
  constructor() {
    this.wallet = null
    this.identityKey = null
    this.walletType = null
    this.network = null
    this.version = null
  }

  /**
   * Detect and initialize wallet connection
   * @param {string} preferredType - 'json-api', 'brc7', 'brc6', or 'auto'
   * @returns {Promise<{wallet: WalletClient, identityKey: string, walletType: string}>}
   */
  async initialize(preferredType = CONFIG.WALLET_SUBSTRATE) {
    try {
      // Try BRC-7 (Window injection) first if preferred
      if (preferredType === 'brc7') {
        const brc7Result = await this.tryBRC7Wallet()
        if (brc7Result) {
          return brc7Result
        }
      }

      // Try JSON-API (Metanet Desktop) first when requested or auto
      if (preferredType === 'json-api' || preferredType === 'auto') {
        const jsonApiResult = await this.tryJsonApiWallet()
        if (jsonApiResult) {
          return jsonApiResult
        }
      }

      // Try BRC-7 (Window injection) if auto and JSON-API failed
      if (preferredType === 'auto') {
        const brc7Result = await this.tryBRC7Wallet()
        if (brc7Result) {
          return brc7Result
        }
      }

      // Try BRC-6 (XDM) if BRC-7 failed or preferred
      if (preferredType === 'brc6' || preferredType === 'auto') {
        const brc6Result = await this.tryBRC6Wallet()
        if (brc6Result) {
          return brc6Result
        }
      }

      // Try BRC-6 as fallback if BRC-7 was preferred but failed
      if (preferredType === 'brc7') {
        const brc6Fallback = await this.tryBRC6Wallet()
        if (brc6Fallback) {
          return brc6Fallback
        }
      }

      throw new Error('No compatible wallet detected')

    } catch (error) {
      console.error('Wallet bootstrap failed:', error)

      // If we already produced a human-friendly availability message, surface it as-is
      if (error?.message && /No BSV wallet detected|BRC-6 bridge unavailable/i.test(error.message)) {
        throw error
      }

      // Detect common browser blocking scenarios and provide helpful guidance
      const msg = error?.message || ''
      
      // Network/fetch failures often indicate browser shields blocking localhost
      if (/fetch|network|ECONNREFUSED|Failed to fetch|NetworkError|TypeError.*fetch/i.test(msg)) {
        throw new Error(
          'Cannot reach Metanet Desktop. This is often caused by browser privacy settings blocking localhost connections. ' +
          'Try: (1) Disable shields/tracking protection for this site, (2) Allow localhost in browser settings, ' +
          'or (3) Use a different browser. See getmetanet.com for setup help.'
        )
      }
      
      // CORS errors can happen with strict browser policies
      if (/CORS|cross-origin|blocked by|Access-Control/i.test(msg)) {
        throw new Error(
          'Browser blocked the wallet connection (CORS policy). ' +
          'Try disabling strict privacy shields for this site, or use a browser with less restrictive settings.'
        )
      }
      
      // Timeout errors
      if (/timeout|timed out/i.test(msg)) {
        throw new Error(
          'Wallet connection timed out. Make sure Metanet Desktop is running and try again. ' +
          'If the problem persists, check your browser\'s privacy settings.'
        )
      }

      throw new Error(`Wallet initialization failed: ${error.message}`)
    }
  }

  async tryJsonApiWallet() {
    try {
      // Use the configured desktop origin (defaults to localhost:3321)
      const origin = (CONFIG.METANET_DESKTOP_ORIGIN || 'http://localhost:3321').replace(/\/$/, '')
      let parsedHost
      try {
        parsedHost = new URL(origin).host
      } catch (err) {
        parsedHost = origin.replace(/^https?:\/\//, '')
      }
      
      console.log('[walletBootstrap] Attempting JSON-API connection (Metanet Desktop on ' + parsedHost + ')')
      
      // IMPORTANT: Call waitForAuthentication FIRST to trigger BRC-73 grouped permissions
      // This presents all permissions from manifest.json in ONE dialog instead of multiple popups
      console.log('[walletBootstrap] Requesting grouped permissions via waitForAuthentication...')
      await ensureAuthenticated()
      console.log('[walletBootstrap] Grouped permissions granted')
      
      // Create WalletClient with explicit host to avoid SDK default port issues
      const wallet = new WalletClient('json-api', parsedHost)
      
      // Test connection with getPublicKey (should NOT trigger popup - already authorized)
      const result = await wallet.getPublicKey({ identityKey: true })
      const identityKey = result.publicKey || result.identityKey || result
      
      console.log('[walletBootstrap] JSON-API connected successfully:', { identityKey })

      this.wallet = wallet
      this.identityKey = identityKey
      this.walletType = 'json-api'
      this.network = null
      this.version = null

      return {
        wallet,
        identityKey,
        walletType: 'json-api',
        network: null,
        version: null
      }
    } catch (error) {
      console.warn('JSON-API wallet connection failed:', error.message)
      return null
    }
  }

  /**
   * Try to connect via BRC-7 (Window injection)
   */
  async tryBRC7Wallet() {
    try {
      console.log('[walletBootstrap] Attempting BRC-7 connection...')
      console.log('[walletBootstrap] window.CWI exists?', typeof window !== 'undefined' && !!window.CWI)
      
      // Check if CWI (Contract and Wallet Interface) is available
      if (typeof window !== 'undefined' && window.CWI) {
        console.log('[walletBootstrap] Detected BRC-7 window-injected wallet')
        console.log('[walletBootstrap] window.CWI.wrapDataKey exists?', typeof window.CWI.wrapDataKey === 'function')

        const wallet = new WalletClient('window://cwi')
        console.log('[walletBootstrap] WalletClient created, getting public key...')
        
        // Manually add wrapDataKey if CWI has it but WalletClient doesn't proxy it
        if (typeof window.CWI.wrapDataKey === 'function' && typeof wallet.wrapDataKey !== 'function') {
          console.log('[walletBootstrap] Manually adding wrapDataKey to WalletClient')
          wallet.wrapDataKey = (params) => window.CWI.wrapDataKey(params)
        }

        const result = await wallet.getPublicKey({ identityKey: true })
        const identityKey = result.publicKey || result.identityKey || result
        console.log('[walletBootstrap] Got identity key:', identityKey)

        this.wallet = wallet
        this.identityKey = identityKey
        this.walletType = 'brc7'
        this.network = null
        this.version = null

        console.log('[walletBootstrap] BRC-7 connection successful!')
        return {
          wallet,
          identityKey,
          walletType: 'brc7',
          network: null,
          version: null
        }
      }

      // DISABLED: Headless wallet auto-initialization (use index.html script instead)
      // This allows BRC-6/XDM detection for Metanet Desktop
      // Uncomment below to enable headless wallet fallback
      /*
      if (typeof window !== 'undefined' && !window.CWI) {
        console.log('[walletBootstrap] No CWI found, initializing headless wallet...')
        await initHeadlessWallet()
        if (window.CWI) {
          console.log('[walletBootstrap] Headless BRC-7 wallet ready, connecting...')

          const wallet = new WalletClient('window://cwi')
          
          const result = await wallet.getPublicKey({ identityKey: true })
          const identityKey = result.publicKey || result.identityKey || result
          console.log('[walletBootstrap] Headless wallet identity key:', identityKey)

          this.wallet = wallet
          this.identityKey = identityKey
          this.walletType = 'brc7'
          this.network = null
          this.version = null

          console.log('[walletBootstrap] Headless BRC-7 connection successful!')
          return {
            wallet,
            identityKey,
            walletType: 'brc7',
            network: null,
            version: null
          }
        }
      }
      */

      console.log('[walletBootstrap] BRC-7 connection failed - no wallet available')
      return null
    } catch (error) {
      console.error('[walletBootstrap] BRC-7 wallet connection error:', error)
      return null
    }
  }

  /**
   * Try to connect via BRC-6 (XDM cross-document messaging)
   */
  async tryBRC6Wallet() {
    try {
      console.log('[walletBootstrap] Attempting BRC-6 XDM wallet connection')

      const wallet = new WalletClient('xdm://parent')
      const result = await wallet.getPublicKey({ identityKey: true })
      const identityKey = result.publicKey || result.identityKey || result

      this.wallet = wallet
      this.identityKey = identityKey
      this.walletType = 'brc6'
      this.network = null
      this.version = null

      return {
        wallet,
        identityKey,
        walletType: 'brc6',
        network: null,
        version: null
      }
    } catch (error) {
      console.warn('BRC-6 wallet connection failed:', error.message)

      const message = error?.message || ''

      if (/connection refused|ECONNREFUSED|fetch failed/i.test(message)) {
        throw new Error(
          'BRC-6 bridge unavailable. Start Metanet Desktop on this machine and ensure its wallet interface is enabled, or choose a different wallet substrate.',
        )
      }

      if (/No wallet available over any communication substrate/i.test(message)) {
        throw new Error(
          'No BSV wallet detected. Install and run Metanet Desktop (https://getmetanet.com/#desktop), then try connecting again.',
        )
      }

      return null
    }
  }

  /**
   * Get current wallet status
   */
  getStatus() {
    return {
      isConnected: !!this.wallet,
      walletType: this.walletType,
      identityKey: this.identityKey,
      wallet: this.wallet,
      network: this.network,
      version: this.version
    }
  }

  /**
   * Disconnect wallet
   */
  async disconnect() {
    if (this.wallet) {
      try {
        await this.wallet.disconnect?.()
      } catch (error) {
        console.warn('Wallet disconnect warning:', error.message)
      }
    }

    this.wallet = null
    this.identityKey = null
    this.walletType = null
    this.network = null
    this.version = null
    resetJsonApiCache()
    resetWalletWarmup()
  }

  /**
   * Check if wallet supports required features
   * Note: wrapDataKey is no longer required - we use ECIES for key wrapping
   */
  async checkCapabilities() {
    if (!this.wallet) {
      return { supported: false, features: [] }
    }

    try {
      const requiredFeatures = ['createAction', 'getPublicKey']
      const capabilitySet = new Set()

      if (this.walletType === 'json-api') {
        JSON_API_CAPABILITIES.forEach(cap => capabilitySet.add(cap))
      }

      if (typeof this.wallet.getCapabilities === 'function') {
        try {
          const reported = await this.wallet.getCapabilities()
          if (Array.isArray(reported)) {
            reported.forEach(cap => capabilitySet.add(cap))
          }
        } catch (err) {
          console.warn('wallet.getCapabilities call failed', err?.message || err)
        }
      }

      requiredFeatures.forEach(feature => {
        const hasMethod = typeof this.wallet[feature] === 'function'
        console.log(`[walletBootstrap] Checking ${feature}: ${hasMethod ? 'FOUND' : 'MISSING'}`)
        if (hasMethod) {
          capabilitySet.add(feature)
        }
      })

      const missing = requiredFeatures.filter(f => !capabilitySet.has(f))
      console.log('[walletBootstrap] Capability check complete:', { 
        supported: missing.length === 0, 
        features: Array.from(capabilitySet), 
        missing 
      })

      return {
        supported: missing.length === 0,
        features: Array.from(capabilitySet),
        missing,
        wrapDataKey: capabilitySet.has('wrapDataKey')
      }
    } catch (error) {
      console.warn('Capability check failed:', error.message)
      return { supported: false, features: [], error: error.message }
    }
  }
}

// Singleton instance
export const walletBootstrap = new WalletBootstrap()

// Convenience functions
export const initializeWallet = (type) => walletBootstrap.initialize(type)
export const getWalletStatus = () => walletBootstrap.getStatus()
export const disconnectWallet = () => walletBootstrap.disconnect()
export const checkWalletCapabilities = () => walletBootstrap.checkCapabilities()

export default walletBootstrap
