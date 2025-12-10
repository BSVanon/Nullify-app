import React from 'react'

import WalletConnectionCard from '@/components/workflow/WalletConnectionCard.jsx'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

function ConnectWalletStep({
  isConnected,
  walletType,
  network,
  version,
  capabilities,
  isLoading,
  onConnect,
  onDisconnect,
  onContinue
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 1: Connect Wallet</CardTitle>
        <CardDescription>Connect your BSV wallet to create and manage access tokens.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant={isConnected ? 'outline' : 'default'} className="w-full">
              {isConnected ? 'Manage wallet connection' : 'Connect wallet'}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>Connect your wallet</DialogTitle>
              <DialogDescription>Choose a supported wallet substrate to start the mint workflow.</DialogDescription>
            </DialogHeader>
            <WalletConnectionCard
              isConnected={isConnected}
              walletType={walletType}
              network={network}
              version={version}
              capabilities={capabilities}
              isLoading={isLoading}
              onConnect={onConnect}
              onDisconnect={onDisconnect}
            />
            <DialogFooter>
              <Button variant="outline" onClick={onDisconnect} disabled={!isConnected}>
                Disconnect
              </Button>
              <Button onClick={onConnect} disabled={isConnected || isLoading}>
                {isLoading ? 'Connecting…' : 'Connect'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {isConnected && (
          <Button onClick={onContinue} className="w-full">
            Continue →
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

export default ConnectWalletStep
