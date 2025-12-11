import React from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import NukeNoteFileUpload from '@/components/NukeNoteFileUpload'
import WalletConnectionCard from './WalletConnectionCard'

function UploadStep({
  isConnected,
  walletType,
  network,
  version,
  capabilities,
  isLoading,
  onConnect,
  onDisconnect,
  uploadedFile,
  onFileProcessed,
  onContinue,
  jwtToken
}) {
  return (
    <Card>
      <CardHeader className="space-y-3 text-center">
        <CardTitle className="text-3xl">Create self-destructing access token</CardTitle>
        <CardDescription className="mx-auto max-w-2xl text-base leading-relaxed">
          Upload a file to create a self-destructing access token that lets recipients decrypt your content until you burn the control
          token.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!isConnected && (
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
        )}

        {isConnected && <NukeNoteFileUpload onFileProcessed={onFileProcessed} />}

        {uploadedFile && (
          <div className="flex justify-center">
            <Button onClick={onContinue}>Continue</Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default UploadStep
