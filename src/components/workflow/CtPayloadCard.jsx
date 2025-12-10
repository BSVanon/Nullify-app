import React from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { truncateMiddle } from '@/lib/utils'

function ResultRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
      <span className="font-medium text-foreground/80">{label}</span>
      <span className="font-mono text-foreground/70">{value}</span>
    </div>
  )
}

function ResultPanel({ ctMintResult, ctArtifacts, ctOutpoint }) {
  if (!ctMintResult?.txid) return null
  const artifactCount = Array.isArray(ctArtifacts?.files) ? ctArtifacts.files.length : 0

  return (
    <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs">
      <div className="flex items-center justify-between">
        <div className="font-semibold text-primary">Last mint result</div>
        <Badge variant="outline" className="text-xs">
          {artifactCount} artifact{artifactCount === 1 ? '' : 's'}
        </Badge>
      </div>
      <ResultRow label="TXID" value={truncateMiddle(ctMintResult.txid, 10)} />
      {ctOutpoint?.txid && (
        <ResultRow label="Outpoint" value={`${truncateMiddle(ctOutpoint.txid, 10)}:${ctOutpoint.vout ?? 0}`} />
      )}
      {ctMintResult.broadcast?.lockingScriptHex && (
        <details className="rounded-md border border-primary/20 bg-background/70 p-2">
          <summary className="cursor-pointer text-primary">Broadcast payload</summary>
          <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-[11px] leading-tight">
            {JSON.stringify(ctMintResult.broadcast, null, 2)}
          </pre>
        </details>
      )}
      {artifactCount > 0 && (
        <details className="rounded-md border border-muted/40 bg-muted/20 p-2">
          <summary className="cursor-pointer text-foreground/80">Artifacts metadata</summary>
          <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-[11px] leading-tight">
            {JSON.stringify(ctArtifacts, null, 2)}
          </pre>
        </details>
      )}
    </div>
  )
}

function CtPayloadCard({
  ctHintURL,
  setCtHintURL,
  ctEncKeyWrapped,
  setCtEncKeyWrapped,
  ctBlobHash,
  uploadedFile,
  copyToClipboard,
  buildCtPreview,
  handleMintControlToken,
  canMintCT,
  ctMinting,
  ctErrors,
  ctPreview,
  ctMintResult,
  ctArtifacts,
  ctOutpoint,
  handleBurnControlToken
}) {
  const hasErrors = Array.isArray(ctErrors) && ctErrors.length > 0
  const hasPreview = typeof ctPreview === 'string' && ctPreview.trim().length > 0

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="space-y-1">
          <CardTitle>Thread access-token payload preview</CardTitle>
          <CardDescription>Review and adjust the access-token payload before minting.</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={buildCtPreview} disabled={ctMinting}>
          Build preview
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <span className="text-sm text-muted-foreground">Hint URL (optional)</span>
            <Input
              value={ctHintURL}
              onChange={(event) => setCtHintURL(event.target.value)}
              placeholder="https://..."
            />
          </div>
          <div className="space-y-2">
            <span className="text-sm text-muted-foreground">Wrapped key (required)</span>
            <Input
              value={ctEncKeyWrapped}
              onChange={(event) => setCtEncKeyWrapped(event.target.value)}
              placeholder="wrapped key blob"
            />
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          Blob hash (sha256)
          {ctBlobHash && (
            <Button variant="outline" size="sm" onClick={() => copyToClipboard(ctBlobHash, 'Blob hash')}>
              Copy
            </Button>
          )}
        </div>
        <div className="font-mono text-xs break-all text-primary">{ctBlobHash || '(pending encryption)'}</div>
        {uploadedFile?.hash && (
          <div className="text-xs text-muted-foreground">
            Original file hash:{' '}
            <span className="font-mono break-all text-foreground/70">{uploadedFile.hash}</span>
          </div>
        )}
        {hasErrors && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            <div className="font-semibold">Payload issues detected</div>
            <ul className="list-inside list-disc space-y-1">
              {ctErrors.map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {hasPreview ? (
          <pre className="max-h-64 overflow-auto rounded-md border border-muted bg-muted/40 p-3 text-xs text-foreground/80">
            {ctPreview}
          </pre>
        ) : (
          <div className="rounded-md border border-muted-foreground/40 bg-muted/20 p-4 text-sm text-muted-foreground">
            Build the payload preview to inspect CT contents before minting.
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">
            {ctMintResult?.txid
              ? 'Thread access token minted successfully.'
              : 'Mint after confirming encryption & storage details.'}
          </div>
          <div className="flex gap-2">
            {ctOutpoint && (
              <Button onClick={handleBurnControlToken} variant="destructive" size="sm">
                Burn thread access token
              </Button>
            )}
            <Button onClick={handleMintControlToken} disabled={!canMintCT || ctMinting}>
              {ctMinting ? 'Minting…' : 'Mint access token'}
            </Button>
          </div>
        </div>

        <ResultPanel ctMintResult={ctMintResult} ctArtifacts={ctArtifacts} ctOutpoint={ctOutpoint} />
      </CardContent>
    </Card>
  )
}

export default CtPayloadCard
