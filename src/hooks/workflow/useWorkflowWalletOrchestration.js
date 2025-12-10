import { useCallback, useState } from 'react'

import { anchorViaWallet } from '@/lib/wallet/actions.js'
import walletBootstrap from '@/lib/walletBootstrap.js'
import { CONFIG } from '@/lib/config.js'

export function useWorkflowWalletOrchestration({
  addNotification,
  connectWallet,
  disconnectWallet,
  ensureAuth,
  fetchWithAuth,
  isConnected,
  uploadedFile,
  debugLog
}) {
  const [lastTxid, setLastTxid] = useState(null)
  const [anchorStatus, setAnchorStatus] = useState('')
  const [anchorChecking, setAnchorChecking] = useState(false)

  const checkTxStatus = useCallback(
    async (txid) => {
      debugLog('Checking transaction status', { txid })
      try {
        setAnchorChecking(true)
        setAnchorStatus('')
        await ensureAuth()
        const response = await fetchWithAuth(`/api/tx?txid=${encodeURIComponent(txid)}`)
        if (!response.ok) throw new Error(`tx HTTP ${response.status}`)
        const data = await response.json()
        const conf = data?.tx?.confirmations ?? 0
        setAnchorStatus(conf >= 1 ? `Confirmed (${conf})` : 'Broadcasted (0-conf)')
      } catch (error) {
        setAnchorStatus(`Status unavailable: ${error.message}`)
      } finally {
        setAnchorChecking(false)
      }
    },
    [debugLog, ensureAuth, fetchWithAuth]
  )

  const handleAnchorProof = useCallback(async () => {
    debugLog('handleAnchorProof invoked', { hasFileHash: !!uploadedFile?.hash, isConnected })
    if (!uploadedFile?.hash) {
      addNotification({ message: 'No file hash available. Upload a file first.', type: 'error', duration: 4000 })
      return
    }
    if (!isConnected) {
      addNotification({ message: 'Connect your wallet first.', type: 'error', duration: 4000 })
      return
    }
    try {
      addNotification({ message: 'Requesting wallet to anchor proof…', type: 'info', duration: 3000 })
      const res = await anchorViaWallet(uploadedFile.hash)
      const txid = res?.txid || res?.result?.txid || res?.transactionId || res?.id || null
      if (txid) {
        setLastTxid(txid)
        addNotification({ message: `Anchored: ${txid.slice(0, 8)}…`, type: 'success', duration: 5000 })
        await checkTxStatus(txid)
      } else {
        addNotification({ message: 'Anchor request sent to wallet. Check wallet UI for status.', type: 'info', duration: 5000 })
      }
    } catch (error) {
      addNotification({ message: `Anchor failed: ${error.message}`, type: 'error', duration: 6000 })
    }
  }, [addNotification, checkTxStatus, debugLog, isConnected, uploadedFile])

  const handleWalletConnect = useCallback(async () => {
    debugLog('handleWalletConnect clicked', { substrate: CONFIG?.WALLET_SUBSTRATE })
    try {
      debugLog('Invoking connectWallet')
      await connectWallet(CONFIG?.WALLET_SUBSTRATE || 'auto')
      debugLog('connectWallet succeeded')
      addNotification({ message: 'Wallet connected successfully!', type: 'success', duration: 3000 })
      const status = walletBootstrap.getStatus()
      debugLog('Wallet status after connect', status)
      if (status.network && !/main/i.test(status.network)) {
        addNotification({
          message: `Wallet network: ${status.network}. Switch to mainnet for production issuance.`,
          type: 'warning',
          duration: 6000
        })
      }
    } catch (error) {
      console.error('[handleWalletConnect] Connection failed:', error)
      addNotification({ message: `Wallet connection failed: ${error.message}`, type: 'error', duration: 5000 })
      if (/connection refused|ECONNREFUSED|fetch failed/i.test(error.message)) {
        addNotification({
          message: 'Unable to reach Metanet Desktop. Make sure Metanet Desktop is running locally (JSON API on 3321) or switch to a BRC-7 wallet.',
          type: 'warning',
          duration: 6000
        })
      } else if (/No compatible wallet detected/i.test(error.message)) {
        addNotification({
          message: 'No compatible wallet found. Install Metanet Desktop or enable a BRC-7 browser wallet, then retry.',
          type: 'warning',
          duration: 6000
        })
      }
      debugLog('Wallet connection failure handled', { error: error.message })
    }
  }, [addNotification, connectWallet, debugLog])

  const handleWalletDisconnect = useCallback(async () => {
    debugLog('handleWalletDisconnect triggered')
    try {
      await disconnectWallet()
      addNotification({ message: 'Wallet disconnected', type: 'info', duration: 3000 })
    } catch (error) {
      console.error('Disconnect error:', error)
    }
  }, [addNotification, debugLog, disconnectWallet])

  return {
    lastTxid,
    anchorStatus,
    anchorChecking,
    handleWalletConnect,
    handleWalletDisconnect,
    handleAnchorProof,
    checkTxStatus
  }
}
