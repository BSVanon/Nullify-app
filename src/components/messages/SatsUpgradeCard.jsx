import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sparkles, X } from 'lucide-react'

const PRESET_AMOUNTS = [
  { value: 10000, label: '10K', description: 'Small tip' },
  { value: 50000, label: '50K', description: 'Nice gesture' },
  { value: 100000, label: '100K', description: 'Generous!' },
]

export default function SatsUpgradeCard({ 
  peerName = 'This contact',
  onSendSats,
  onDismiss,
  isSending = false 
}) {
  const [showCustom, setShowCustom] = useState(false)
  const [customAmount, setCustomAmount] = useState('')

  const handlePresetClick = (amount) => {
    onSendSats?.(amount)
  }

  const handleCustomSend = () => {
    const value = Number(customAmount)
    if (Number.isFinite(value) && value > 0) {
      onSendSats?.(value)
      setCustomAmount('')
      setShowCustom(false)
    }
  }

  return (
    <div className="relative mx-auto my-4 max-w-md rounded-xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-background to-primary/5 p-6 shadow-lg">
      {/* Dismiss button */}
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground/60 hover:bg-muted/50 hover:text-foreground"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      {/* Header with celebration icon */}
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Sparkles className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-foreground">
            {peerName} linked a wallet!
          </h3>
          <p className="text-sm text-muted-foreground">
            Help cover messaging fees
          </p>
        </div>
      </div>

      {!showCustom ? (
        <>
          {/* Preset amount buttons */}
          <div className="mb-4 grid grid-cols-3 gap-2">
            {PRESET_AMOUNTS.map((preset) => (
              <Button
                key={preset.value}
                variant="outline"
                onClick={() => handlePresetClick(preset.value)}
                disabled={isSending}
                className="h-auto flex-col gap-1 border-2 py-3 hover:border-primary hover:bg-primary/5"
              >
                <span className="text-base font-bold">{preset.label}</span>
                <span className="text-[10px] text-muted-foreground">
                  {preset.description}
                </span>
              </Button>
            ))}
          </div>

          {/* Custom amount toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowCustom(true)}
            disabled={isSending}
            className="w-full text-xs text-muted-foreground hover:text-foreground"
          >
            Enter custom amount
          </Button>
        </>
      ) : (
        <>
          {/* Custom amount input */}
          <div className="mb-3 space-y-2">
            <label className="text-sm font-medium text-foreground">
              Custom amount (sats)
            </label>
            <div className="flex gap-2">
              <Input
                type="number"
                min={1}
                step={1}
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                placeholder="Enter amount"
                className="flex-1"
                autoFocus
              />
              <Button
                onClick={handleCustomSend}
                disabled={isSending || !customAmount || Number(customAmount) <= 0}
              >
                {isSending ? 'Sending…' : 'Send'}
              </Button>
            </div>
          </div>

          {/* Back to presets */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setShowCustom(false)
              setCustomAmount('')
            }}
            disabled={isSending}
            className="w-full text-xs text-muted-foreground hover:text-foreground"
          >
            ← Back to quick amounts
          </Button>
        </>
      )}

      {/* Helper text */}
      <p className="mt-4 text-center text-[11px] text-muted-foreground/70">
        Your wallet will ask for confirmation before sending
      </p>
    </div>
  )
}
