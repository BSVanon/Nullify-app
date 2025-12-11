import React from 'react'
import { Wallet } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

function WalletConnectionCard({
  isConnected,
  walletType,
  isLoading,
  onConnect,
  onDisconnect,
  network,
  version,
  capabilities
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Wallet className="h-4 w-4" />
          </span>
          <div>
            <CardTitle>Wallet connection</CardTitle>
            <CardDescription>
              {isConnected
                ? `Connected via ${walletType?.toUpperCase?.() || 'wallet'}`
                : 'Connect your BSV wallet to create Nullify conversations and access tokens.'}
            </CardDescription>
          </div>
        </div>
        {isConnected ? (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            Connected
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {isConnected && (
          <div className="space-y-2 text-sm text-muted-foreground">
            {version && <div>Version: {version}</div>}
            {network && <div>Network: {network}</div>}
            {!!capabilities?.missing?.length && (
              <div className="text-amber-600">
                Missing capabilities: {capabilities.missing.join(', ')}
              </div>
            )}
            {capabilities?.wrapDataKey === false && walletType === 'json-api' && (
              <div className="text-amber-600">
                wrapDataKey not advertised; key wrapping may fail.
              </div>
            )}
          </div>
        )}
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm text-muted-foreground">
            {isConnected ? 'You can disconnect to switch wallets.' : 'Your wallet will open in a new window.'}
          </div>
          {isConnected ? (
            <Button onClick={onDisconnect} variant="outline" size="sm">
              Disconnect
            </Button>
          ) : (
            <Button onClick={onConnect} disabled={isLoading} size="sm">
              {isLoading ? 'Connecting…' : 'Connect wallet'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default WalletConnectionCard
