import React from 'react'
import { CheckCircle2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function VerifyPaymentCard({
  vpAddress,
  setVpAddress,
  vpAmount,
  setVpAmount,
  vpMinConf,
  setVpMinConf,
  vpTxid,
  setVpTxid,
  verifyPayment,
  vpResult,
  deriveInvoice,
  jwtToken
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Verify payment (server)</CardTitle>
        <CardDescription>Hit the JSON-API helper to confirm a payment and mint a JWT.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="vp-index">Invoice index</Label>
            <Input
              id="vp-index"
              type="number"
              min={0}
              max={19}
              defaultValue={0}
              onChange={(e) => deriveInvoice(Number(e.target.value) || 0)}
              className="w-28"
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => deriveInvoice(0)}>
            Derive m/0/0
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="vp-address">Address</Label>
            <Input
              id="vp-address"
              value={vpAddress}
              onChange={(e) => setVpAddress(e.target.value)}
              placeholder="1..."
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="vp-amount">Satoshis</Label>
              <Input id="vp-amount" type="number" value={vpAmount} onChange={(e) => setVpAmount(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="vp-conf">Min conf</Label>
              <Input id="vp-conf" type="number" value={vpMinConf} onChange={(e) => setVpMinConf(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="vp-txid">TXID (optional)</Label>
              <Input id="vp-txid" value={vpTxid} onChange={(e) => setVpTxid(e.target.value)} placeholder="txid" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={verifyPayment}>
            <CheckCircle2 className="mr-2 h-4 w-4" /> Verify payment
          </Button>
          {jwtToken && <span className="text-xs text-emerald-500">JWT issued</span>}
        </div>

        <pre className="min-h-[100px] rounded-md border border-border bg-muted/40 p-3 text-xs font-mono text-muted-foreground whitespace-pre-wrap">
          {vpResult}
        </pre>
      </CardContent>
    </Card>
  )
}

export default VerifyPaymentCard
