import React from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { truncateMiddle } from '@/lib/utils'

function DtPayloadCard({
  dtMode,
  setDtMode,
  dtCtTxid,
  setDtCtTxid,
  dtCtVout,
  setDtCtVout,
  dtRecipient,
  setDtRecipient,
  dtPermissions,
  setDtPermissions,
  buildDtPreview,
  dtErrors,
  dtPreview,
  handleMintDataTokens,
  dtMinting,
  dtMintResult,
  isConnected
}) {
  const renderPreview = () => {
    if (!dtPreview) return 'Build the preview to inspect the access-grant payload.'
    if (typeof dtPreview === 'string') return dtPreview
    try {
      return JSON.stringify(dtPreview, null, 2)
    } catch (err) {
      return String(dtPreview)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Participant access-token payload preview</CardTitle>
        <CardDescription>Configure the participant access-token payload before minting.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border border-muted-foreground/30 bg-muted/15 p-3 text-xs text-muted-foreground">
          <div className="flex items-center justify-between gap-2">
            <span>Access-token link</span>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
              {dtMode === 'same-tx' ? 'atomic' : 'two-tx'}
            </Badge>
          </div>
          <p className="mt-2 font-mono text-foreground/70">
            {dtMode === 'same-tx' ? 'Same transaction / ctVout index' : dtCtTxid ? `${truncateMiddle(dtCtTxid, 18)}:${dtCtVout ?? 0}` : 'Set after CT mint'}
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          <div className="space-y-2">
            <span className="text-sm text-muted-foreground">Reference mode</span>
            <Select value={dtMode} onValueChange={setDtMode}>
              <SelectTrigger>
                <SelectValue placeholder="Select mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="outpoint">Two-TX (default)</SelectItem>
                <SelectItem value="same-tx">Atomic (optional)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <span className="text-sm text-muted-foreground">Access-token txid</span>
            <Input
              value={dtCtTxid}
              onChange={(event) => setDtCtTxid(event.target.value)}
              placeholder="Required for two-TX"
              disabled={dtMode === 'same-tx'}
            />
          </div>
          <div className="space-y-2">
            <span className="text-sm text-muted-foreground">Access-token vout</span>
            <Input
              type="number"
              min="0"
              value={dtCtVout}
              onChange={(event) => setDtCtVout(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <span className="text-sm text-muted-foreground">Recipient</span>
            <Input
              value={dtRecipient}
              onChange={(event) => setDtRecipient(event.target.value)}
              placeholder="Address or pubkey"
            />
          </div>
        </div>
        <div className="space-y-2">
          <span className="text-sm text-muted-foreground">Permissions</span>
          <Input
            value={dtPermissions}
            onChange={(event) => setDtPermissions(event.target.value)}
            placeholder="read-only"
          />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button onClick={buildDtPreview} className="sm:flex-1">
            Build preview
          </Button>
          {isConnected && dtCtTxid && (
            <Button
              onClick={handleMintDataTokens}
              disabled={dtMinting || !dtRecipient}
              className="sm:flex-1"
            >
              {dtMinting ? 'Minting…' : 'Mint participant access tokens'}
            </Button>
          )}
        </div>
        {dtErrors?.length > 0 && <div className="text-xs text-destructive">{dtErrors.join(', ')}</div>}
        {dtMintResult && (
          <div className="space-y-2 rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-200">
            <div className="font-semibold">Participant access tokens minted!</div>
            <div className="font-mono text-xs opacity-80">Txid: {dtMintResult.txid}</div>
            {!!dtMintResult.dtOutpoints?.length && (
              <div className="space-y-1 text-xs text-muted-foreground">
                <div className="font-medium text-foreground/70">Outpoints</div>
                <ul className="space-y-1">
                  {dtMintResult.dtOutpoints.map(({ recipient, txid, vout }, index) => (
                    <li key={`${txid}-${vout}-${index}`} className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="text-[10px] uppercase tracking-wide">recipient</Badge>
                      <span className="font-mono text-foreground/70">
                        {truncateMiddle(txid || dtMintResult.txid, 16)}:{vout ?? index}
                      </span>
                      {recipient && <span className="font-mono text-muted-foreground/80">→ {truncateMiddle(recipient, 14)}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        <div className="rounded-md border border-border bg-muted/40 p-4">
          <pre className="min-h-[80px] whitespace-pre-wrap text-xs font-mono text-muted-foreground">
            {renderPreview()}
          </pre>
        </div>
      </CardContent>
    </Card>
  )
}

export default DtPayloadCard
