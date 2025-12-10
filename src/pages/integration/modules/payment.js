export function initPaymentVerification({ deriveLocked }) {
  window.verifyPaymentUI = async () => {
    const out = document.getElementById('verify-result')
    if (!out) return

    const address = (document.getElementById('vp-address').value || '').trim()
    const amount = parseInt(document.getElementById('vp-amount').value, 10)
    const minConf = parseInt(document.getElementById('vp-minconf').value || '0', 10)
    const txid = (document.getElementById('vp-txid').value || '').trim()

    if (!address || !Number.isFinite(amount) || amount <= 0) {
      out.textContent = 'Provide address and a positive amount (satoshis).'
      return
    }

    out.textContent = 'Verifying on-chain payment...'
    try {
      const response = await fetch('/api/verify-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          amountSatoshis: amount,
          minConf: Number.isFinite(minConf) ? minConf : undefined,
          txid: txid || undefined
        })
      })
      const text = await response.text()
      let json
      try {
        json = JSON.parse(text)
      } catch (parseErr) {
        json = { response: text, error: parseErr?.message || String(parseErr) }
      }
      out.textContent = JSON.stringify(json, null, 2)
      out.style.background = response.ok ? '#dcfce7' : '#fef2f2'
      out.style.color = response.ok ? '#166534' : '#ef4444'
    } catch (err) {
      out.textContent = `Error: ${err.message}`
      out.style.background = '#fef2f2'
      out.style.color = '#ef4444'
    }
  }

  window.loadHistory = async () => {
    const out = document.getElementById('hist-result')
    if (!out) return
    try {
      const count = Math.max(1, Math.min(10, parseInt(document.getElementById('hist-count')?.value || '5', 10)))
      const items = []
      for (let i = 0; i < count; i += 1) {
        try {
          const deriv = await deriveLocked(i)
          const addr = deriv.address
          let utxoRes = null
          try {
            const r = await fetch(`/api/address-utxos?address=${encodeURIComponent(addr)}`)
            utxoRes = await r.json()
          } catch (histErr) {
            console.warn('History dashboard failed to load UTXOs', histErr)
            utxoRes = { provider: '(error)', utxos: [] }
          }
          const total = Array.isArray(utxoRes.utxos)
            ? utxoRes.utxos.reduce((sum, u) => sum + (u.satoshis || u.value || 0), 0)
            : 0
          items.push({
            index: i,
            address: addr,
            provider: utxoRes.provider || '(unknown)',
            utxoCount: Array.isArray(utxoRes.utxos) ? utxoRes.utxos.length : 0,
            totalSatoshis: total
          })
        } catch (err) {
          items.push({ index: i, error: err.message })
        }
      }
      const health = await fetch('/api/health').then((r) => r.json()).catch(() => ({}))
      out.textContent = JSON.stringify({ network: health.network || '(unknown)', items }, null, 2)
    } catch (err) {
      out.textContent = `Error: ${err.message}`
    }
  }

  return {}
}
