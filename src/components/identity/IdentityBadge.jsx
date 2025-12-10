import React from 'react'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

/**
 * Identity Badge Component
 * 
 * Displays a badge indicating the source of an identity (certificate, profileCard, nickname, fallback)
 * with appropriate styling and icons.
 */
export function IdentityBadge({ source, verified, compact = false }) {
  if (!source) return null

  const badges = {
    certificate: {
      label: compact ? 'Cert' : 'Certificate',
      className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
      icon: (
        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      )
    },
    profileCard: {
      label: compact ? 'Guest' : 'ProfileCard',
      className: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
      icon: (
        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
        </svg>
      )
    },
    nickname: {
      label: compact ? 'Nick' : 'Nickname',
      className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
      icon: (
        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
      )
    },
    fallback: {
      label: compact ? 'Gen' : 'Generated',
      className: 'bg-muted text-muted-foreground border-muted-foreground/20',
      icon: (
        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    }
  }

  const config = badges[source]
  if (!config) return null

  return (
    <Badge variant="outline" className={`flex items-center gap-1 ${config.className}`}>
      {config.icon}
      {config.label}
    </Badge>
  )
}

/**
 * Verified Badge Component
 * 
 * Shows a green checkmark badge when identity is verified
 */
export function VerifiedBadge({ verified }) {
  if (!verified) return null

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/90 text-white">
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          Verified
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
