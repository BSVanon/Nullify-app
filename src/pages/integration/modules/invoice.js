import { hashFile } from '/src/lib/hash.js'
import { anchorViaWallet, getWalletBalance } from '/src/lib/wallet/actions.js'

let lastDerived = null

async function fetchMerchantXpub() {
  const response = await fetch('/api/merchant-xpub')
  return response.json()
}

async function deriveClient(index) {
  const xpubInfo = await fetchMerchantXpub()
  if (!xpubInfo.xpub) throw new Error('MERCHANT_XPUB not configured')
  const net = (xpubInfo.network || 'test').toLowerCase()
  const prefix = net === 'mainnet' || net === 'main' ? 'main' : 'test'
  const sdk = await import('/node_modules/@bsv/sdk/dist/esm/mod.js')
  const hd = sdk.HD.fromString(xpubInfo.xpub)
  const child = hd.deriveChild(0).deriveChild(index)
  const address = child.pubKey.toAddress(prefix)
  return { address, index, pattern: 'account', network: prefix, source: 'client' }
}

async function deriveLocked(index) {
  try {
    const response = await fetch(`/api/derive-address?index=${encodeURIComponent(index)}`)
    const text = await response.text()
    try {
      return JSON.parse(text)
    } catch (err) {
      console.debug('Server derive-address response not JSON, falling back to client derive', err)
      return deriveClient(index)
    }
  } catch (err) {
    return deriveClient(index)
  }
}

export function initInvoiceTools() {
  const xpubEl = document.getElementById('xpub-info')
  fetchMerchantXpub()
    .then((j) => {
      if (xpubEl) {
        xpubEl.textContent = `xpub: ${j.xpub ? j.xpub : '(not set)'} | network: ${j.network}`
      }
    })
    .catch((err) => {
      if (xpubEl) xpubEl.textContent = `Failed to load xpub: ${err.message}`
    })

  window.deriveInvoice = async () => {
    const out = document.getElementById('inv-result')
    const idx = parseInt(document.getElementById('inv-index').value, 10)
    out.textContent = 'Deriving...'
    try {
      const derived = await deriveLocked(idx)
      lastDerived = derived
      out.textContent = JSON.stringify(derived, null, 2)
    } catch (err) {
      out.textContent = `Error: ${err.message}`
    }
  }

  window.useForVerification = () => {
    if (!lastDerived || !lastDerived.address) return
    const addrEl = document.getElementById('vp-address')
    addrEl.value = lastDerived.address
    document.getElementById('verify-result').scrollIntoView({ behavior: 'smooth' })
  }

  window.hashSelectedFile = async () => {
    const out = document.getElementById('proof-hash')
    const inp = document.getElementById('proof-file')
    const file = inp.files && inp.files[0]
    if (!file) {
      out.textContent = 'Please choose a file first.'
      return
    }
    out.textContent = 'Hashing...'
    try {
      const hex = await hashFile(file)
      out.textContent = `sha256: ${hex}`
      const anchorInput = document.getElementById('ap-hash')
      if (anchorInput) anchorInput.value = hex
    } catch (err) {
      out.textContent = `Error: ${err.message}`
    }
  }

  window.openProofViewer = () => {
    const txid = (document.getElementById('pv-txid').value || '').trim()
    if (!txid) return
    window.open(`/proof.html?txid=${encodeURIComponent(txid)}`, '_blank')
  }

  window.showRawAttempts = async () => {
    const out = document.getElementById('raw-attempts-result')
    if (!out) return
    const txid = (document.getElementById('pv-txid').value || '').trim()
    if (!/^[0-9a-fA-F]{64}$/.test(txid)) {
      out.textContent = 'Enter a valid txid in the proof viewer box first.'
      return
    }
    out.textContent = 'Querying explorer raw endpoints...'
    try {
      const response = await fetch(`/api/tx/raw?txid=${encodeURIComponent(txid)}&prefer=woc&txobj=1`)
      const text = await response.text()
      let json
      try {
        json = JSON.parse(text)
      } catch (err) {
        json = { response: text, error: err?.message || String(err) }
      }
      out.textContent = JSON.stringify(json, null, 2)
    } catch (err) {
      out.textContent = `Error: ${err.message}`
    }
  }

  window.anchorViaWallet = async () => {
    const out = document.getElementById('aw-result')
    const hashHex = (document.getElementById('aw-hash').value || '').trim() || (document.getElementById('ap-hash')?.value || '').trim()
    if (!/^[0-9a-fA-F]{64}$/.test(hashHex)) {
      out.textContent = 'Provide a valid 64-hex sha256.'
      return
    }
    try {
      out.textContent = 'Connecting wallet...'
      const response = await anchorViaWallet(hashHex)
      out.textContent = JSON.stringify(response, null, 2)
      if (response?.txid) {
        const pv = document.getElementById('pv-txid')
        if (pv) pv.value = response.txid
        window.open(`/proof.html?txid=${encodeURIComponent(response.txid)}`, '_blank')
      }
    } catch (err) {
      out.textContent = `Error: ${err.message}`
    }
  }

  window.getWalletBalance = async () => {
    const out = document.getElementById('aw-result')
    out.textContent = 'Fetching wallet balance...'
    try {
      const bal = await getWalletBalance()
      out.textContent = JSON.stringify(bal, null, 2)
    } catch (err) {
      out.textContent = `Error: ${err.message}`
    }
  }

  return { deriveLocked }
}
