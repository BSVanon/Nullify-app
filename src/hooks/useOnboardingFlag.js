import { useCallback, useEffect, useMemo, useState } from 'react'

import { isOnboardingComplete, setOnboardingComplete } from '@/lib/messaging/storage.js'

export function useOnboardingFlag() {
  const [loading, setLoading] = useState(true)
  const [completed, setCompleted] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let isMounted = true

    isOnboardingComplete()
      .then((value) => {
        if (!isMounted) return
        setCompleted(Boolean(value))
        setLoading(false)
      })
      .catch((err) => {
        console.warn('[onboarding] failed to determine onboarding state', err)
        if (!isMounted) return
        setError(err)
        setCompleted(false)
        setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  const markComplete = useCallback(async () => {
    await setOnboardingComplete(true)
    setCompleted(true)
  }, [])

  const reset = useCallback(async () => {
    await setOnboardingComplete(false)
    setCompleted(false)
  }, [])

  return useMemo(
    () => ({ loading, completed, error, markComplete, reset }),
    [completed, error, loading, markComplete, reset]
  )
}

export default useOnboardingFlag
