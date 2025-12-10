/**
 * useIdentity Hook
 * 
 * React hook for resolving and caching identity information.
 */

import { useState, useEffect } from 'react'
import { resolveIdentity } from '../../lib/identity/resolution.js'
import { onContactChange } from '../../lib/identity/contactsStore.js'

/**
 * Resolve and cache an identity
 * @param {string} pubkey - Hex-encoded public key
 * @param {'holder'|'guest'} kind - Type of identity
 * @returns {Object} { identity, loading, error }
 */
export function useIdentity(pubkey, kind = 'guest') {
  const [identity, setIdentity] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!pubkey) {
      setIdentity(null)
      setLoading(false)
      return
    }

    let cancelled = false

    async function resolve() {
      try {
        setLoading(true)
        setError(null)
        
        const resolved = await resolveIdentity(pubkey, kind)
        
        if (!cancelled) {
          setIdentity(resolved)
          setLoading(false)
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[useIdentity] Resolution failed:', err)
          setError(err.message)
          setLoading(false)
        }
      }
    }

    resolve()

    return () => {
      cancelled = true
    }
  }, [pubkey, kind])
  
  // Re-resolve when contact changes
  useEffect(() => {
    if (!pubkey) return
    
    const unsubscribe = onContactChange((changedPubkey) => {
      if (changedPubkey === pubkey) {
        // Re-resolve identity when this contact changes
        resolveIdentity(pubkey, kind).then(resolved => {
          setIdentity(resolved)
        }).catch(err => {
          console.error('[useIdentity] Re-resolution failed:', err)
        })
      }
    })
    
    return unsubscribe
  }, [pubkey, kind])

  return { identity, loading, error }
}
