/**
 * useContacts Hook
 * 
 * React hook for managing the contacts store.
 */

import { useState, useEffect, useCallback } from 'react'
import { getAllContacts, upsertContact, deleteContact } from '../../lib/identity/contactsStore.js'

/**
 * Access and manage contacts
 * @returns {Object} { contacts, loading, upsert, remove, refresh }
 */
export function useContacts() {
  const [contacts, setContacts] = useState({})
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      const all = await getAllContacts()
      setContacts(all)
    } catch (error) {
      console.error('[useContacts] Failed to load contacts:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const upsert = useCallback(async (pubkey, patch) => {
    try {
      await upsertContact(pubkey, patch)
      await refresh()
    } catch (error) {
      console.error('[useContacts] Failed to upsert contact:', error)
      throw error
    }
  }, [refresh])

  const remove = useCallback(async (pubkey) => {
    try {
      // Optimistically update local state immediately
      const normalizedKey = pubkey?.toLowerCase()
      if (normalizedKey) {
        setContacts(prev => {
          const next = { ...prev }
          delete next[normalizedKey]
          // Also try original key in case of case mismatch
          delete next[pubkey]
          return next
        })
      }
      
      await deleteContact(pubkey)
      // Refresh to ensure consistency with storage
      await refresh()
    } catch (error) {
      console.error('[useContacts] Failed to delete contact:', error)
      // Refresh to restore state on error
      await refresh()
      throw error
    }
  }, [refresh])

  return {
    contacts,
    loading,
    upsert,
    remove,
    refresh
  }
}
