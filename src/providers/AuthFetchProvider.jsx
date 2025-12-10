import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { AuthFetch, WalletClient } from '@bsv/sdk'
import walletBootstrap from '../lib/walletBootstrap'

const AuthFetchContext = createContext(null)

export function AuthFetchProvider({ children }) {
  const authFetchRef = useRef(null)
  const [identityKey, setIdentityKey] = useState(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(null)

  const resetState = useCallback(() => {
    authFetchRef.current = null
    setIdentityKey(null)
    setReady(false)
  }, [])

  const initAuthFetch = useCallback(async () => {
    setError(null)
    const status = walletBootstrap.getStatus()
    if (!status?.wallet) {
      resetState()
      throw new Error('Wallet not connected')
    }
    if (status.walletType !== 'json-api') {
      resetState()
      throw new Error('AuthFetch requires Metanet Desktop (JSON-API) wallet')
    }

    const walletClient = status.wallet
    if (!walletClient || typeof walletClient.getPublicKey !== 'function') {
      resetState()
      throw new Error('Connected wallet does not expose WalletClient interface')
    }

    if (!authFetchRef.current) {
      authFetchRef.current = new AuthFetch(walletClient)
    }

    const key = status.identityKey || await walletClient.getPublicKey({ identityKey: true })
    setIdentityKey(key)
    setReady(true)

    return { authFetch: authFetchRef.current, identityKey: key }
  }, [resetState])

  const ensureAuth = useCallback(async () => {
    if (ready && authFetchRef.current && identityKey) {
      return { authFetch: authFetchRef.current, identityKey }
    }
    try {
      return await initAuthFetch()
    } catch (err) {
      setError(err)
      throw err
    }
  }, [ready, identityKey, initAuthFetch])

  const fetchWithAuth = useCallback(async (input, init) => {
    const { authFetch } = await ensureAuth()
    return authFetch.fetch(input, init)
  }, [ensureAuth])

  useEffect(() => {
    const status = walletBootstrap.getStatus()
    if (status?.walletType === 'json-api') {
      initAuthFetch().catch(() => {})
    } else {
      resetState()
    }
  }, [initAuthFetch, resetState])

  const value = useMemo(() => ({
    ensureAuth,
    fetchWithAuth,
    identityKey,
    isAuthReady: ready && !!authFetchRef.current,
    error
  }), [ensureAuth, fetchWithAuth, identityKey, ready, error])

  return (
    <AuthFetchContext.Provider value={value}>
      {children}
    </AuthFetchContext.Provider>
  )
}

export function useAuthFetch() {
  const ctx = useContext(AuthFetchContext)
  if (!ctx) throw new Error('useAuthFetch must be used within AuthFetchProvider')
  return ctx
}
