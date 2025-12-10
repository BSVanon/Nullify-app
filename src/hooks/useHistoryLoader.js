import { useCallback, useState } from 'react'
import { useAuthFetch } from '../providers/AuthFetchProvider'

export function useHistoryLoader() {
  const [histCount, setHistCount] = useState(5)
  const [histLoading, setHistLoading] = useState(false)
  const [histResult, setHistResult] = useState('')
  const { ensureAuth, fetchWithAuth } = useAuthFetch()

  const loadHistory = useCallback(async (jwtToken) => {
    try {
      setHistLoading(true)
      setHistResult('')
      const cap = jwtToken ? 10 : 5
      const n = Math.max(1, Math.min(cap, Number(histCount) || 5))
      const items = []

      await ensureAuth()

      for (let i = 0; i < n; i++) {
        const derive = await fetchWithAuth(`/api/derive-address?index=${i}`)
        if (!derive.ok) throw new Error(`derive-address[${i}] HTTP ${derive.status}`)
        const deriveJson = await derive.json()
        const address = deriveJson.address
        let utxos = []
        try {
          const utxoResponse = await fetchWithAuth(`/api/address-utxos?address=${encodeURIComponent(address)}`)
          if (utxoResponse.ok) {
            const utxoJson = await utxoResponse.json()
            utxos = utxoJson.utxos || []
          }
        } catch (err) {
          console.warn('Failed to fetch address UTXOs', address, err)
        }
        const satoshis = utxos.reduce((acc, u) => acc + (u.satoshis || u.value || 0), 0)
        items.push({ index: i, address, utxoCount: utxos.length, satoshis })
      }
      setHistResult(JSON.stringify({ items }, null, 2))
    } catch (err) {
      setHistResult(String(err?.message || err))
    } finally {
      setHistLoading(false)
    }
  }, [ensureAuth, fetchWithAuth, histCount])

  return {
    histCount,
    setHistCount,
    histLoading,
    histResult,
    loadHistory
  }
}

export default useHistoryLoader
