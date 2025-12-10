import React from 'react'
import { Loader2, Wallet, WifiOff } from 'lucide-react'

import { useWallet } from '@/contexts/WalletContext.jsx'
import { cn } from '@/lib/utils'

const STATUS_STYLES = {
  disconnected: 'border-destructive/30 bg-destructive/10 text-destructive',
  loading: 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500 dark:bg-amber-900/20 dark:text-amber-200',
  connected: 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-200'
}

export default function WalletStatusCard() {
  const { isConnected, walletType, identityKey, network, isLoading } = useWallet()

  let statusKey = 'disconnected'
  let label = 'Disconnected'

  if (isLoading) {
    statusKey = 'loading'
    label = 'Connecting…'
  } else if (isConnected) {
    statusKey = 'connected'
    label = `Connected${walletType ? ` · ${walletType}` : ''}`
  }

  const Icon = isLoading ? Loader2 : isConnected ? Wallet : WifiOff

  return (
    <div
      className={cn(
        'inline-flex min-w-[220px] items-center gap-3 rounded-lg border px-3 py-2 text-sm shadow-sm transition-colors',
        STATUS_STYLES[statusKey]
      )}
    >
      <Icon className={cn('h-4 w-4', isLoading && 'animate-spin')} />
      <div className="flex flex-col">
        <span className="font-medium leading-tight text-foreground">{label}</span>
        <span className="text-xs text-muted-foreground">
          {identityKey ? `${identityKey.slice(0, 8)}···${identityKey.slice(-6)}` : 'Wallet approval required'}
        </span>
        {network && (
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground/70">{network}</span>
        )}
      </div>
    </div>
  )
}
