import React from 'react'
import { Navigate } from 'react-router-dom'

import useOnboardingFlag from '@/hooks/useOnboardingFlag'

export default function LandingRouter() {
  const { loading, completed, error } = useOnboardingFlag()

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        Loading…
      </div>
    )
  }

  if (error) {
    console.warn('[landing] onboarding flag error, defaulting to welcome', error)
  }

  return <Navigate to={completed ? '/messages' : '/welcome'} replace />
}
