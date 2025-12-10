import { useCallback, useState } from 'react'
import { useAuthFetch } from '../providers/AuthFetchProvider'

export function usePaymentVerification({ addNotification } = {}) {
  const [jwtToken, setJwtToken] = useState(null)
  const [vpAddress, setVpAddress] = useState('')
  const [vpAmount, setVpAmount] = useState(1000)
  const [vpMinConf, setVpMinConf] = useState(0)
  const [vpTxid, setVpTxid] = useState('')
  const [vpResult, setVpResult] = useState('')
  const { ensureAuth, fetchWithAuth } = useAuthFetch()

  const deriveInvoice = useCallback(async (index = 0) => {
    try {
      const response = await fetch(`/api/derive-address?index=${index}`)
      if (!response.ok) throw new Error(`derive-address HTTP ${response.status}`)
      const data = await response.json()
      setVpAddress(data.address || '')
      addNotification?.({ message: `Derived address (m/0/${index})`, type: 'success', duration: 3000 })
    } catch (err) {
      addNotification?.({ message: `Derive failed: ${err.message}`, type: 'error', duration: 5000 })
    }
  }, [addNotification])

  const verifyPayment = useCallback(async () => {
    try {
      setVpResult('')
      const body = {
        address: vpAddress,
        amountSatoshis: Number(vpAmount),
        minConf: Number(vpMinConf)
      }
      if (vpTxid && vpTxid.trim()) body.txid = vpTxid.trim()

      await ensureAuth()

      const response = await fetchWithAuth('/api/verify-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      const text = await response.text()
      let payload
      try {
        payload = JSON.parse(text)
      } catch (parseErr) {
        payload = { raw: text, error: parseErr?.message || String(parseErr) }
      }

      setVpResult(JSON.stringify(payload, null, 2))
      if (response.ok && payload && payload.ok) {
        if (payload.token) setJwtToken(payload.token)
        addNotification?.({ message: 'Payment verified', type: 'success', duration: 4000 })
      } else {
        addNotification?.({ message: `Verification failed: ${payload?.error || response.status}`, type: 'error', duration: 5000 })
      }
    } catch (err) {
      const message = err?.message || String(err)
      setVpResult(message)
      addNotification?.({ message: `Verify error: ${message}`, type: 'error', duration: 5000 })
    }
  }, [addNotification, ensureAuth, fetchWithAuth, vpAddress, vpAmount, vpMinConf, vpTxid])

  return {
    jwtToken,
    vpAddress,
    setVpAddress,
    vpAmount,
    setVpAmount,
    vpMinConf,
    setVpMinConf,
    vpTxid,
    setVpTxid,
    vpResult,
    deriveInvoice,
    verifyPayment
  }
}

export default usePaymentVerification
