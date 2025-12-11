import React from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { truncateMiddle } from '@/lib/utils'

function MintDataTokenStep({
  dtRecipient,
  setDtRecipient,
  dtPermissions,
  setDtPermissions,
  buildDtPreview,
  dtPreview,
  handleMintDataTokens,
  dtMinting,
  dtMintResult,
  dtArtifacts,
  dtBroadcast,
  ctOutpoint,
  ctArtifacts,
  ctBroadcast,
  handleBurnControlToken,
  handleRedeemDataToken,
  uploadedFile,
  redeemKeyInput,
  setRedeemKeyInput,
  redeemUrlInput,
  setRedeemUrlInput,
  dtRedeemResult,
  dtRedeeming,
  handleVerifyControlToken,
  ctStatus,
  resetWorkflow,
  onBack
}) {
  const handleCopyOutpoint = () => {
    if (!ctOutpoint?.txid) return
    const target = `${ctOutpoint.txid}:${ctOutpoint.vout ?? 0}`
    navigator?.clipboard?.writeText(target).catch(() => {})
  }

  const renderPreview = () => {
    if (!dtPreview) {
      return 'Preview payload will appear here after you build it.'
    }
    if (typeof dtPreview === 'string') {
      return dtPreview
    }
    try {
      return JSON.stringify(dtPreview, null, 2)
    } catch (err) {
      return String(dtPreview)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 5: Grant participant access</CardTitle>
        <CardDescription>Create a participant access token that grants access until you burn the thread access token.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3 rounded-md border border-muted-foreground/30 bg-muted/15 p-4 text-sm">
          <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
            <span>Access token link</span>
            <Badge variant="outline" className="text-[10px]">outpoint</Badge>
          </div>
          {ctOutpoint?.txid ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-mono text-foreground/80">
                  {truncateMiddle(ctOutpoint.txid, 18)}:{ctOutpoint.vout ?? 0}
                </span>
                <Button size="xs" variant="outline" onClick={handleCopyOutpoint}>
                  Copy
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Access grants will reference this thread access token when created. Adjustments happen automatically after the
                access token is minted.
              </p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Create a thread access token first to populate the txid and vout used when issuing access grants.
            </p>
          )}
        </div>

        {!dtMintResult ? (
          <>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="dt-recipient">Recipient identity key</Label>
                <Input
                  id="dt-recipient"
                  value={dtRecipient}
                  onChange={(event) => setDtRecipient(event.target.value)}
                  placeholder="Enter recipient's public key"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dt-permissions">Permissions</Label>
                <Input
                  id="dt-permissions"
                  value={dtPermissions}
                  onChange={(event) => setDtPermissions(event.target.value)}
                  placeholder="read,download"
                />
              </div>
            </div>
            {!dtPreview ? (
              <div className="space-y-2">
                <Button onClick={buildDtPreview} disabled={!dtRecipient} className="w-full">
                  Preview access grant
                </Button>
                <Button onClick={onBack} variant="outline" className="w-full">
                  ← Back
                </Button>
              </div>
            ) : (
              <>
                <div className="max-h-64 overflow-auto rounded-md border border-border bg-muted/30 p-4">
                  <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap">
                    {renderPreview()}
                  </pre>
                </div>
              </>
            )}
          </>
        ) : (
          <div className="space-y-3">
            <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-200">
              <p className="font-medium">Participant access token minted successfully!</p>
              {dtMintResult.txid && (
                <p className="mt-1 break-all font-mono text-xs opacity-80">TXID: {dtMintResult.txid}</p>
              )}
            </div>
            <div className="space-y-2">
              <Button onClick={resetWorkflow} className="w-full">
                Create another secure link
              </Button>
              {ctOutpoint && (
                <Button
                  onClick={handleBurnControlToken}
                  variant="destructive"
                  className="w-full"
                >
                  🔥 Burn thread access token (revoke access)
                </Button>
              )}
            </div>
            <div className="rounded-lg border border-border bg-card/30 p-4 space-y-3">
              <div className="text-sm font-semibold">Redeem access grant</div>
              <Input
                value={redeemKeyInput}
                onChange={(event) => setRedeemKeyInput(event.target.value)}
                placeholder="Enter your private key (WIF or hex)"
              />
              <Input
                value={redeemUrlInput}
                onChange={(event) => setRedeemUrlInput(event.target.value)}
                placeholder="Override storage URL (optional)"
              />
              <Button
                onClick={() => handleRedeemDataToken({
                  identityPrivateKey: redeemKeyInput,
                  storageUrlOverride: redeemUrlInput || undefined,
                  fileName: `${uploadedFile?.name || 'nullify'}.decoded`,
                  ctArtifacts,
                  dtArtifactsOverride: dtArtifacts,
                  ctBroadcast,
                  dtBroadcastOverride: dtBroadcast
                })}
                disabled={dtRedeeming}
                className="w-full"
              >
                {dtRedeeming ? 'Redeeming…' : '🔓 Redeem & Download'}
              </Button>
              {dtRedeemResult?.decryptedUrl && (
                <Button
                  onClick={() => {
                    const anchor = document.createElement('a')
                    anchor.href = dtRedeemResult.decryptedUrl
                    anchor.download = dtRedeemResult.fileName || 'nullify.bin'
                    document.body.appendChild(anchor)
                    anchor.click()
                    document.body.removeChild(anchor)
                  }}
                  variant="outline"
                  className="w-full"
                >
                  📥 Download decrypted file
                </Button>
              )}
              <Button onClick={handleVerifyControlToken} variant="outline" className="w-full">
                🔍 Check access-token status
              </Button>
              {ctStatus && (
                <div className={`text-xs font-mono ${ctStatus.status === 'active' ? 'text-emerald-600' : 'text-destructive'}`}>
                  Status: {ctStatus.status}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-col gap-2 sm:flex-row">
        {!dtMintResult ? (
          dtPreview ? (
            <>
              <Button onClick={onBack} variant="outline" className="sm:flex-1">
                ← Back
              </Button>
              <Button onClick={handleMintDataTokens} disabled={dtMinting} className="sm:flex-1">
                {dtMinting ? 'Minting…' : '⚡ Mint DT'}
              </Button>
            </>
          ) : null
        ) : null}
      </CardFooter>
    </Card>
  )
}

export default MintDataTokenStep
