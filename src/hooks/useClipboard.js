import { useCallback } from 'react'

export function useClipboard(addNotification) {
  return useCallback(async (value, label = 'value') => {
    if (!value) return
    try {
      if (!(navigator && navigator.clipboard)) {
        addNotification({ message: 'Clipboard API unavailable in this context', type: 'error', duration: 4000 })
        return
      }
      await navigator.clipboard.writeText(value)
      addNotification({ message: `${label} copied to clipboard`, type: 'success', duration: 2000 })
    } catch (err) {
      addNotification({ message: `Copy failed: ${err.message}`, type: 'error', duration: 4000 })
    }
  }, [addNotification])
}

export default useClipboard
