/**
 * Headless BRC-7 wallet for React app
 * Stripped of UI dependencies, pure wallet functionality
 */

class BRC7WalletHeadless {
  constructor() {
    this.initialized = false
    this.baseUrl = 'http://localhost:3001' // Server port for API calls
    this.network = 'main'
  }

  async initialize() {
    try {
      const response = await fetch(`${this.baseUrl}/api/health`).catch(() => null)
      
      if (!response || !response.ok) {
        throw new Error('Nullify server not available')
      }
      
      const health = await response.json().catch(() => ({}))
      this.network = (health && health.network) || 'main'
      this.initialized = true
      
      console.log('BRC-7 Headless Wallet: Initialized', { network: this.network })
      return true
    } catch (error) {
      console.error('Wallet initialization failed:', error)
      throw error
    }
  }

  getCWIInterface() {
    return {
      getVersion: () => this.getVersion(),
      isAuthenticated: () => this.isAuthenticated(),
      getNetwork: () => this.getNetwork(),
      getPublicKey: (params = {}) => this.getPublicKey(params),
      createAction: (params) => this.createAction(params),
      getBalance: (params = {}) => this.getBalance(params),
      encrypt: (params) => this.encrypt(params),
      decrypt: (params) => this.decrypt(params),
      createSignature: (params) => this.createSignature(params),
      createHmac: (params) => this.createHmac(params),
      verifyHmac: (params) => this.verifyHmac(params),
      verifySignature: (params) => this.verifySignature(params),
      wrapDataKey: (params) => this.wrapDataKey(params)
    }
  }

  async getVersion() {
    if (!this.initialized) throw new Error('Wallet not initialized')
    return { version: '0.2.0' }
  }

  async getNetwork() {
    if (!this.initialized) throw new Error('Wallet not initialized')
    return { network: this.network }
  }

  async getPublicKey(params = {}) {
    if (!this.initialized) throw new Error('Wallet not initialized')
    const { priv } = await this.ensureKey()
    const sdk = await import('/node_modules/@bsv/sdk/dist/esm/mod.js')
    const pub = priv.toPublicKey()
    const hex = Array.from(pub.encode(true)).map(b => b.toString(16).padStart(2, '0')).join('')
    return { publicKey: hex }
  }

  async isAuthenticated() {
    if (!this.initialized) throw new Error('Wallet not initialized')
    return { authenticated: true }
  }

  async getBalance(params = {}) {
    if (!this.initialized) throw new Error('Wallet not initialized')
    const { address } = await this.ensureKey()
    const resp = await this.fetchUtxos(address)
    const utxos = Array.isArray(resp?.utxos) ? resp.utxos : []
    const satoshis = utxos.reduce((s,u)=> s + (u.satoshis||0), 0)
    return { address, utxoCount: utxos.length, satoshis }
  }

  async createAction(params) {
    if (!this.initialized) throw new Error('Wallet not initialized')
    const { priv, address } = await this.ensureKey()
    const sdk = await import('/node_modules/@bsv/sdk/dist/esm/mod.js')
    
    const outputs = params.outputs || []
    const description = params.description || 'Nullify action'
    
    // Fetch UTXOs for funding
    const utxoResp = await this.fetchUtxos(address)
    const utxos = Array.isArray(utxoResp?.utxos) ? utxoResp.utxos : []
    
    if (utxos.length === 0) {
      throw new Error('No UTXOs available for funding')
    }
    
    // Build transaction
    const tx = new sdk.Transaction()
    
    // Add outputs
    for (const output of outputs) {
      const script = sdk.Script.fromHex(output.lockingScript)
      tx.addOutput({
        satoshis: output.satoshis || 1,
        lockingScript: script
      })
    }
    
    // Add inputs (simple: use first UTXO)
    const utxo = utxos[0]
    const rawHex = await this.fetchRawTx(utxo.txid, utxoResp.provider)
    const sourceTx = sdk.Transaction.fromHex(rawHex)
    
    tx.addInput({
      sourceTXID: utxo.txid,
      sourceOutputIndex: utxo.vout,
      unlockingScriptTemplate: new sdk.P2PKH().unlock(priv),
      sequence: 0xffffffff
    })
    
    // Sign
    await tx.sign()
    await tx.fee()
    
    const txid = tx.id('hex')
    const rawTx = tx.toHex()
    
    // Broadcast
    const broadcastResp = await fetch(`${this.baseUrl}/api/tx/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawtx: rawTx })
    })
    
    if (!broadcastResp.ok) {
      throw new Error(`Broadcast failed: ${broadcastResp.status}`)
    }
    
    return { txid, rawTx }
  }

  async encrypt(params) {
    if (!this.initialized) throw new Error('Wallet not initialized')
    throw new Error('encrypt not implemented in headless wallet')
  }

  async decrypt(params) {
    if (!this.initialized) throw new Error('Wallet not initialized')
    throw new Error('decrypt not implemented in headless wallet')
  }

  async wrapDataKey(params) {
    if (!this.initialized) throw new Error('Wallet not initialized')
    
    // params.key is base64-encoded raw key bytes
    const { key } = params
    if (!key) throw new Error('wrapDataKey requires key parameter')
    
    const { priv } = await this.ensureKey()
    const sdk = await import('/node_modules/@bsv/sdk/dist/esm/mod.js')
    
    // Decode base64 key to bytes
    const keyBytes = Uint8Array.from(atob(key), c => c.charCodeAt(0))
    
    // Encrypt the key with our private key (ECIES-style)
    // For simplicity, we'll use symmetric encryption with a derived key
    // In production, this should use proper ECIES
    const pub = priv.toPublicKey()
    const sharedSecret = priv.deriveSharedSecret(pub)
    
    // XOR the key with shared secret (simple encryption)
    const wrapped = new Uint8Array(keyBytes.length)
    for (let i = 0; i < keyBytes.length; i++) {
      wrapped[i] = keyBytes[i] ^ sharedSecret[i % sharedSecret.length]
    }
    
    // Return base64-encoded wrapped key
    const wrappedBase64 = btoa(String.fromCharCode(...wrapped))
    
    return { wrappedKey: wrappedBase64 }
  }

  async createSignature(params) {
    if (!this.initialized) throw new Error('Wallet not initialized')
    const { priv } = await this.ensureKey()
    const sdk = await import('/node_modules/@bsv/sdk/dist/esm/mod.js')
    const data = params.data || ''
    // Convert string to Uint8Array for browser compatibility
    const dataBytes = new TextEncoder().encode(data)
    const hash = await sdk.Hash.sha256(dataBytes)
    const sig = priv.sign(hash)
    return { signature: sig.toDER('hex') }
  }

  async createHmac(params) {
    throw new Error('createHmac not implemented')
  }

  async verifyHmac(params) {
    throw new Error('verifyHmac not implemented')
  }

  async verifySignature(params) {
    throw new Error('verifySignature not implemented')
  }

  async ensureKey(optionalWif) {
    const sdk = await import('/node_modules/@bsv/sdk/dist/esm/mod.js')
    const wif = (optionalWif || localStorage.getItem('dev_wif') || '').replace(/\s+/g, '')
    
    if (!wif) {
      // Auto-generate if missing
      const priv = sdk.PrivateKey.fromRandom()
      const newWif = priv.toString()
      localStorage.setItem('dev_wif', newWif)
      console.log('Generated new dev WIF')
      return this.ensureKey(newWif)
    }
    
    let priv
    try { 
      priv = sdk.PrivateKey.fromString(wif) 
    } catch { 
      throw new Error('Invalid DEV WIF') 
    }
    
    const net = (this.network || 'main').toLowerCase()
    const path = (net === 'mainnet' || net === 'main') ? 'main' : 'test'
    const address = priv.toPublicKey().toAddress(path)
    
    return { priv, sdk, address, network: path }
  }

  async fetchUtxos(address) {
    const r = await fetch(`${this.baseUrl}/api/address-utxos?address=${encodeURIComponent(address)}`)
    if (!r.ok) throw new Error(`UTXO fetch failed ${r.status}`)
    const j = await r.json()
    const utxos = Array.isArray(j.utxos) ? j.utxos : []
    return { provider: j.provider, utxos }
  }

  async fetchRawTx(txid, preferProvider) {
    const prefer = preferProvider ? `&prefer=${encodeURIComponent(String(preferProvider))}` : ''
    const r = await fetch(`${this.baseUrl}/api/tx/raw?txid=${encodeURIComponent(txid)}${prefer}`)
    const bodyText = await r.text()
    if (!r.ok) {
      throw new Error(`Raw tx fetch failed ${r.status}`)
    }
    let j = {}
    try { j = JSON.parse(bodyText) } catch(_) { j = { hex: (bodyText || '').trim() } }
    const hex = j.hex || j.txhex || j.rawtx || ''
    if (!hex || !/^[0-9a-fA-F]+$/.test(hex)) throw new Error('Invalid raw tx hex')
    return hex
  }
}

// Auto-initialize and expose
let walletInstance = null

export async function initHeadlessWallet() {
  if (walletInstance) return walletInstance
  
  walletInstance = new BRC7WalletHeadless()
  await walletInstance.initialize()
  
  // Expose globally for compatibility
  window.CWI = walletInstance.getCWIInterface()
  
  console.log('BRC-7 Headless Wallet ready, window.CWI exposed')
  
  return walletInstance
}

export default BRC7WalletHeadless
