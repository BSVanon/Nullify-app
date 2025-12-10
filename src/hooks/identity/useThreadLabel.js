/**
 * useThreadLabel Hook
 * 
 * React hook for managing custom thread labels (user-set names like "Mom", "Work", etc.)
 * Now uses the receipt's label field instead of separate localforage storage.
 */

import { useState, useEffect, useCallback } from 'react'
import useGuestThreads from '../messaging/useGuestThreads.js'

/**
 * Get and set custom label for a thread
 * @param {string} threadId - Thread ID
 * @returns {Object} { label, setLabel, loading }
 */
export function useThreadLabel(threadId) {
  const { getConversation, updateThreadLabel } = useGuestThreads()
  const [label, setLabelState] = useState(null)
  const [loading, setLoading] = useState(true)

  // Load label from conversation
  useEffect(() => {
    if (!threadId) {
      setLoading(false)
      return
    }

    const conversation = getConversation(threadId)
    // Extract custom label from title if it's not the default format
    const title = conversation?.title || null
    const isDefaultTitle = title?.startsWith('Thread ') || title === 'New Thread'
    setLabelState(isDefaultTitle ? null : title)
    setLoading(false)
  }, [threadId, getConversation])

  // Set label and persist to receipt
  const setLabel = useCallback(async (newLabel) => {
    if (!threadId) {
      throw new Error('threadId is required')
    }

    try {
      await updateThreadLabel(threadId, newLabel)
      setLabelState(newLabel || null)
      
      console.log('[useThreadLabel] Updated label:', { threadId, newLabel })
    } catch (error) {
      console.error('[useThreadLabel] Failed to set label:', error)
      throw error
    }
  }, [threadId, updateThreadLabel])

  return {
    label,
    setLabel,
    loading
  }
}
