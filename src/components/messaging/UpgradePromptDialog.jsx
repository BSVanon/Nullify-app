import React from 'react'

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

export default function UpgradePromptDialog({ open, onOpenChange, onConfirm, onCancel, connecting = false }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upgrade unavailable</DialogTitle>
          <DialogDescription>
            Your wallet is not connected. Connect it to upgrade this thread from guest mode.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={connecting}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={connecting}>
            {connecting ? 'Connecting…' : 'Connect wallet'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
