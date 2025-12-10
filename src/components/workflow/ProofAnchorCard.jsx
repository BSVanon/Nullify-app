import React from 'react'
import { Anchor } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

function ProofAnchorCard({
  uploadedFile,
  isConnected,
  handleAnchorProof,
  lastTxid,
  anchorChecking,
  anchorStatus,
  checkTxStatus,
  jwtToken
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Anchor proof to chain</CardTitle>
        <CardDescription>Record the encrypted file hash on-chain for independent verification.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <span className="text-sm text-muted-foreground">File</span>
            <div className="font-mono text-sm text-foreground/80 break-all">{uploadedFile?.name || '—'}</div>
          </div>
          <div className="space-y-1">
            <span className="text-sm text-muted-foreground">Hash (sha256)</span>
            <div className="font-mono text-xs text-primary break-all">{uploadedFile?.hash || '—'}</div>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button onClick={handleAnchorProof} disabled={!isConnected} className="sm:w-auto">
            <Anchor className="mr-2 h-4 w-4" /> Anchor proof
          </Button>
          {!isConnected && <span className="text-sm text-amber-600">Connect a wallet to anchor</span>}
          {jwtToken && (
            <span className="sm:ml-auto rounded-md border border-emerald-400 bg-emerald-100 px-2 py-1 text-xs text-emerald-700 dark:border-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-200">
              Payment verified
            </span>
          )}
        </div>
        {lastTxid && (
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Transaction</div>
            <div className="font-mono text-xs break-all text-foreground/80">{lastTxid}</div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <a
                href={`/proof.html?txid=${encodeURIComponent(lastTxid)}`}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-primary underline-offset-2 hover:underline"
              >
                View proof
              </a>
              <Button
                variant="outline"
                size="sm"
                onClick={() => checkTxStatus(lastTxid)}
                disabled={anchorChecking}
                className="sm:w-auto"
              >
                {anchorChecking ? 'Checking…' : 'Check status'}
              </Button>
              {anchorStatus && (
                <span className="text-xs text-muted-foreground">{anchorStatus}</span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default ProofAnchorCard
