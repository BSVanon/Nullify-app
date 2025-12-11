import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { walletBootstrap } from '../lib/walletBootstrap'
import { startPeerPayAutoAccept } from '../lib/wallet/sendSats.js'
import { getWallet } from '../lib/wallet/client.js'
import { useNotification } from './NotificationContext.jsx'

const WalletContext = createContext()

// Persistence key for auto-reconnect
const WALLET_TYPE_KEY = 'nullify:wallet-type'

export function WalletProvider({ children }) {
  const [isConnected, setIsConnected] = useState(false)
  const [walletType, setWalletType] = useState(null)
  const [address, setAddress] = useState('')
  const [identityKey, setIdentityKey] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [capabilities, setCapabilities] = useState(null)
  const [network, setNetwork] = useState(null)
  const [version, setVersion] = useState(null)
  const peerPayStartedRef = useRef(false)
  const [peerPayActive, setPeerPayActive] = useState(false)
  const autoConnectAttemptedRef = useRef(false)

  const { addNotification } = useNotification()

  const checkCapabilities = useCallback(async () => {
    try {
      const caps = await walletBootstrap.checkCapabilities()
      setCapabilities(caps)
      return caps
    } catch (error) {
      console.error('Capability check failed:', error)
      setCapabilities({ supported: false, features: [], error: error.message })
    }
  }, [])

  // Check for existing wallet connection on mount, or auto-reconnect if we have a stored wallet type
  useEffect(() => {
    const status = walletBootstrap.getStatus()
    if (status.isConnected) {
      setIsConnected(true)
      setWalletType(status.walletType)
      setIdentityKey(status.identityKey)
      setNetwork(status.network || null)
      setVersion(status.version || null)
      checkCapabilities()
      return
    }

    // Auto-reconnect: if we previously connected successfully, try to reconnect silently
    if (autoConnectAttemptedRef.current) return
    autoConnectAttemptedRef.current = true

    const storedWalletType = localStorage.getItem(WALLET_TYPE_KEY)
    if (storedWalletType) {
      console.log('[WalletContext] Auto-reconnecting to', storedWalletType, 'wallet...')
      // Don't set isLoading - this is a silent background reconnect
      // BRC-73 permissions already granted from previous session - no new popups needed
      walletBootstrap.initialize(storedWalletType)
        .then(async (result) => {
          // Wallet already verified during bootstrap (waitForAuthentication + getPublicKey)
          // No additional probe needed - permissions persist across sessions
          setIsConnected(true)
          setWalletType(result.walletType)
          setIdentityKey(result.identityKey)
          setNetwork(result.network || null)
          setVersion(result.version || null)
          checkCapabilities()

          // Warm up wallet silently (UTXO cache only, no permission popups)
          getWallet({ autoConnect: false }).catch(() => {})

          console.log('[WalletContext] Auto-reconnect successful')
        })
        .catch((error) => {
          console.warn('[WalletContext] Auto-reconnect failed (will require manual connect):', error.message)
          // Don't clear stored type - user might just need to start their wallet
        })
    }
  }, [checkCapabilities])

  const connectWallet = useCallback(async (type = 'auto') => {
    console.log('[WalletContext] connectWallet called with type:', type)
    setIsLoading(true)
    try {
      console.log('[WalletContext] calling walletBootstrap.initialize...')
      const result = await walletBootstrap.initialize(type)
      console.log('[WalletContext] wallet initialized:', result)

      // Wallet already verified during bootstrap (waitForAuthentication + getPublicKey)
      // No need for additional probe - permissions already granted via BRC-73 grouped request
      console.log('✅ Wallet connected and authenticated:', result.identityKey)

      setIsConnected(true)
      setWalletType(result.walletType)
      setIdentityKey(result.identityKey)
      setNetwork(result.network || null)
      setVersion(result.version || null)

      // Persist wallet type for auto-reconnect on page refresh
      try {
        localStorage.setItem(WALLET_TYPE_KEY, result.walletType)
      } catch (e) {
        console.warn('[WalletContext] Failed to persist wallet type:', e.message)
      }

      // Get wallet address if available
      try {
        const walletInfo = await result.wallet.getWalletInfo?.()
        if (walletInfo?.address) {
          setAddress(walletInfo.address)
        }
      } catch (error) {
        console.warn('Could not get wallet address:', error.message)
      }

      await checkCapabilities()
      
      // Force wallet warmup (UTXO cache refresh) before returning
      // This prevents "txid must be valid transaction on chain" errors on first createAction
      console.log('[WalletContext] Warming up wallet UTXO cache...')
      try {
        await getWallet({ autoConnect: false })
        console.log('[WalletContext] Wallet warmup complete')
      } catch (warmupErr) {
        console.warn('[WalletContext] Wallet warmup failed (non-fatal):', warmupErr.message)
      }
      
      console.log('[WalletContext] wallet connection complete')

      return result
    } catch (error) {
      console.error('[WalletContext] Wallet connection failed:', error)
      console.error('[WalletContext] Error stack:', error.stack)
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [checkCapabilities])

  const disconnectWallet = useCallback(async () => {
    try {
      // Stop PeerPay polling if active
      if (typeof window !== 'undefined' && window.__NUKENOTE_PEERPAY_POLL_INTERVAL__) {
        clearInterval(window.__NUKENOTE_PEERPAY_POLL_INTERVAL__)
        window.__NUKENOTE_PEERPAY_POLL_INTERVAL__ = null
        console.log('[WalletContext] Stopped PeerPay polling')
      }

      await walletBootstrap.disconnect()
      setIsConnected(false)
      setWalletType(null)
      setAddress('')
      setIdentityKey('')
      setCapabilities(null)
      setNetwork(null)
      setVersion(null)
      peerPayStartedRef.current = false
      setPeerPayActive(false)

      // Clear stored wallet type so we don't auto-reconnect
      try {
        localStorage.removeItem(WALLET_TYPE_KEY)
      } catch (e) {
        console.warn('[WalletContext] Failed to clear stored wallet type:', e.message)
      }
    } catch (error) {
      console.error('Wallet disconnect failed:', error)
    }
  }, [])

  // Get wallet client for CT/DT operations
  const getWalletClient = useCallback(() => {
    return walletBootstrap.wallet
  }, [])

  // Start PeerPay auto-accept when a wallet is connected. This will sweep any
  // pending incoming payments and listen for new ones, auto-accepting them and
  // surfacing a toast for the user.
  useEffect(() => {
    if (!isConnected) return
    if (peerPayStartedRef.current) return

    peerPayStartedRef.current = true

    const startListener = async () => {
      try {
        await startPeerPayAutoAccept({
          onPaymentAccepted: ({ amount }) => {
            if (typeof amount === 'number' && Number.isFinite(amount) && amount > 0) {
              addNotification({
                type: 'success',
                message: `Received ${amount} sats into your wallet.`,
                duration: 7000,
              })
            } else {
              addNotification({
                type: 'success',
                message: 'Incoming sats payment accepted into your wallet.',
                duration: 7000,
              })
            }
          },
        })
        setPeerPayActive(true)
      } catch (error) {
        console.error('[WalletContext] Failed to start PeerPay auto-accept listener', error)
        setPeerPayActive(false)
      }
    }

    startListener()
  }, [isConnected, addNotification])

  const value = {
    isConnected,
    walletType,
    address,
    identityKey,
    isLoading,
    capabilities,
    network,
    version,
    peerPayActive,
    connectWallet,
    disconnectWallet,
    getWalletClient,
    checkCapabilities
  }

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet() {
  const context = useContext(WalletContext)
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider')
  }
  return context
}
