import React, { useRef, useState } from 'react'

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useNotification } from '@/contexts/NotificationContext.jsx'
import { buildLocalBackupPayload, applyLocalBackupPayload } from '@/lib/settings/localBackup.js'
import useGuestThreads from '@/hooks/messaging/useGuestThreads.js'

export default function LocalBackupSection() {
  const { addNotification } = useNotification()
  const { conversations, sendMessage } = useGuestThreads()
  const fileInputRef = useRef(null)
  const [busy, setBusy] = useState(false)

  const handleExport = async () => {
    if (busy) return
    setBusy(true)
    try {
      const payload = await buildLocalBackupPayload()
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const filename = `nukenote-local-backup-${timestamp}.json`

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      addNotification({
        type: 'success',
        message: 'Local settings backup downloaded.',
        duration: 4000,
      })
    } catch (error) {
      console.error('[LocalBackupSection] Export failed', error)
      addNotification({
        type: 'error',
        message: error?.message || 'Failed to export local data.',
        duration: 6000,
      })
    } finally {
      setBusy(false)
    }
  }

  const postSafetyResetMessages = (lostVerifiedPubkeys) => {
    if (!Array.isArray(lostVerifiedPubkeys) || lostVerifiedPubkeys.length === 0) return
    const lostSet = new Set(lostVerifiedPubkeys)
    const affected = conversations.filter((c) => c.peerPublicKey && lostSet.has(c.peerPublicKey))
    if (!affected.length) return

    affected.forEach((conversation) => {
      try {
        const authorKey = conversation.selfPublicKey || 'self'
        sendMessage(conversation.id, { author: authorKey, text: '[SAFETY_CHANGED]' })
      } catch (error) {
        console.warn('[LocalBackupSection] Failed to post safety-changed system message', error)
      }
    })
  }

  const handleImportFileChange = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setBusy(true)
    try {
      const text = await file.text()
      let payload
      try {
        payload = JSON.parse(text)
      } catch (parseError) {
        throw new Error('Selected file is not valid JSON.')
      }

      const result = await applyLocalBackupPayload(payload)
      postSafetyResetMessages(result?.lostVerifiedPubkeys || [])

      addNotification({
        type: 'success',
        message: 'Local settings restored. Some changes may require reloading this tab.',
        duration: 6000,
      })
    } catch (error) {
      console.error('[LocalBackupSection] Import failed', error)
      addNotification({
        type: 'error',
        message: error?.message || 'Failed to import backup. Make sure the file is a valid NukeNote backup.',
        duration: 8000,
      })
    } finally {
      setBusy(false)
    }
  }

  const handleImportClick = () => {
    if (busy) return
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Local backup (this device)</CardTitle>
        <CardDescription>
          Export or restore your profile, contacts, and UI preferences without including any messages.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-muted-foreground">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button onClick={handleExport} disabled={busy} className="sm:w-40">
            Export to file
          </Button>
          <Button
            variant="outline"
            onClick={handleImportClick}
            disabled={busy}
            className="sm:w-40"
          >
            Import from file
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={handleImportFileChange}
          />
        </div>
        <p className="text-xs text-muted-foreground/80">
          This backup only includes local metadata like profile names, contacts, blocked inviters, and
          appearance/settings on this device. It never exports messages, on-chain tokens, or private keys.
          When you restore from a backup, all safety-number verifications are reset and will need to be
          re-verified.
        </p>
      </CardContent>
    </Card>
  )
}
