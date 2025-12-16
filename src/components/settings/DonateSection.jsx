import React, { useState } from 'react'

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useNotification } from '@/contexts/NotificationContext.jsx'
import { sendDonation } from '@/lib/wallet/sendSats.js'
import { formatErrorForNotification } from '@/lib/errors/userFriendlyErrors.js'

export default function DonateSection({ walletConnected }) {
  const { addNotification } = useNotification()
  const [amount, setAmount] = useState('1,000,000')
  const [isSending, setIsSending] = useState(false)

  const PRESET_AMOUNTS = [
    { value: 10000, label: '10K sats' },
    { value: 50000, label: '50K sats' },
    { value: 100000, label: '100K sats' },
  ]

  const handleSend = async (overrideAmount = null) => {
    if (!walletConnected) {
      addNotification({
        type: 'error',
        message: 'Connect a BRC-100 compatible wallet to send a donation.',
        duration: 6000,
      })
      return
    }

    const value = (() => {
      if (overrideAmount !== null) return overrideAmount
      const normalized = typeof amount === 'string' ? amount.replace(/,/g, '').trim() : amount
      const numeric = Number(normalized)
      return numeric
    })()
    if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
      addNotification({
        type: 'error',
        message: 'Amount must be a positive whole number of sats.',
        duration: 5000,
      })
      return
    }

    setIsSending(true)
    try {
      addNotification({
        type: 'info',
        message: 'Preparing donation… Your wallet will ask for confirmation.',
        duration: 8000,
      })

      const result = await sendDonation({
        amountSats: value,
        description: `Nullify donation (${value.toLocaleString()} sats)`,
      })

      const paymailStatus = result?.response?.paymail

      let message
      let type = 'success'
      if (result.txid) {
        if (paymailStatus === 'submitted') {
          message = `Donation sent! Transaction: ${result.txid.slice(0, 12)}... (paymail notified)`
        } else if (paymailStatus === 'submit_failed') {
          type = 'warning'
          message = `Donation sent! Transaction: ${result.txid.slice(0, 12)}... (paymail notify failed)`
        } else {
          message = `Donation sent! Transaction: ${result.txid.slice(0, 12)}...`
        }
      } else {
        if (paymailStatus === 'submitted') {
          message = 'Donation sent! (paymail notified)'
        } else if (paymailStatus === 'submit_failed') {
          type = 'warning'
          message = 'Donation sent, but paymail notify failed. The transaction may still confirm on-chain.'
        } else {
          message = 'Donation sent! The merchant wallet will receive it shortly.'
        }
      }
      
      addNotification({
        type,
        message,
        duration: 8000,
      })
    } catch (error) {
      console.error('[DonateSection] Failed to send donation', error)
      addNotification({
        type: 'error',
        message: formatErrorForNotification(error, { context: 'send donation' }),
        duration: 8000,
      })
    } finally {
      setIsSending(false)
    }
  }


  return (
    <Card>
      <CardHeader>
        <CardTitle>Support Nullify</CardTitle>
        <CardDescription>
          Send a Bitcoin donation to help cover development and infrastructure costs.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-muted-foreground">
        <p>
          Donations go directly to the Nullify developer wallet using the same secure payment flow as sending sats to any contact.
        </p>

        <div className="space-y-2">
          <p className="text-xs text-muted-foreground/80">Quick amounts</p>
          <div className="grid grid-cols-3 gap-2">
            {PRESET_AMOUNTS.map((preset) => (
              <Button
                key={preset.value}
                size="sm"
                variant="outline"
                onClick={() => handleSend(preset.value)}
                disabled={isSending}
                className="h-auto flex-col gap-0.5 py-2"
              >
                <span className="text-xs font-semibold">{preset.label}</span>
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-muted-foreground/80">Or enter a custom amount:</p>
          <div className="flex items-center gap-2">
            <Input
              type="text"
              value={amount}
              onChange={(event) => {
                const raw = event.target.value.replace(/,/g, '')
                if (raw === '') {
                  setAmount('')
                  return
                }
                const numeric = Number(raw)
                if (!Number.isFinite(numeric) || numeric < 0) {
                  return
                }
                setAmount(numeric.toLocaleString('en-US'))
              }}
              onFocus={(event) => event.target.select()}
              className="w-32"
              placeholder="1,000,000"
              disabled={isSending}
            />
            <span className="text-xs text-muted-foreground/80">sats</span>
            <Button size="sm" onClick={() => handleSend()} disabled={isSending}>
              {isSending ? 'Sending…' : 'Send donation'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
