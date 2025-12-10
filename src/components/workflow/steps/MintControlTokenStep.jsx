import React from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

function MintControlTokenStep({
  ctPreview,
  ctMintResult,
  ctMinting,
  canMintCT,
  buildCtPreview,
  handleMintControlToken,
  onBack,
  onContinue
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 4: Create thread access token</CardTitle>
        <CardDescription>Create the on-chain access token so you can revoke access at any time.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!ctMintResult ? (
          !ctPreview ? (
            <div className="space-y-2">
              <Button onClick={buildCtPreview} className="w-full">
                Preview access token
              </Button>
              <Button onClick={onBack} variant="outline" className="w-full">
                ← Back
              </Button>
            </div>
          ) : (
            <>
              <div className="max-h-64 overflow-auto rounded-md border border-border bg-muted/30 p-4">
                <pre className="text-xs font-mono text-muted-foreground">
                  {JSON.stringify(ctPreview, null, 2)}
                </pre>
              </div>
            </>
          )
        ) : (
          <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-200">
            <p className="font-medium">Thread access token minted!</p>
            {ctMintResult.txid && (
              <p className="mt-1 break-all font-mono text-xs opacity-80">TXID: {ctMintResult.txid}</p>
            )}
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-col gap-2 sm:flex-row">
        {!ctMintResult ? (
          ctPreview ? (
            <>
              <Button onClick={onBack} variant="outline" className="sm:flex-1">
                ← Back
              </Button>
              <Button
                onClick={handleMintControlToken}
                disabled={!canMintCT || ctMinting}
                className="sm:flex-1"
              >
                {ctMinting ? 'Minting…' : '⚡ Mint CT'}
              </Button>
            </>
          ) : null
        ) : (
          <Button onClick={onContinue} className="sm:flex-1">
            Continue to participant access tokens →
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}

export default MintControlTokenStep
