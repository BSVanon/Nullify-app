import { useState, useCallback, useEffect, useRef } from 'react'

import { useNotification } from '@/contexts/NotificationContext.jsx'
import { useWallet } from '@/contexts/WalletContext.jsx'
import { isHelperCacheEnabled } from '@/lib/messaging/helperCacheIntegration'
import {
  createWalletBackup,
  restoreWalletBackup,
  checkWalletBackup,
  deleteWalletBackup,
  createLocalEncryptedBackup,
  restoreWalletBackupFromEncrypted,
} from '@/lib/messaging/walletBackup'
import { formatErrorForNotification } from '@/lib/errors/userFriendlyErrors.js'

export function useBackupSection() {
  const { addNotification } = useNotification()
  const { identityKey, isConnected } = useWallet()

  const [isBackingUp, setIsBackingUp] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isChecking, setIsChecking] = useState(false)
  const [backupInfo, setBackupInfo] = useState(null)
  const [showCloudBridge, setShowCloudBridge] = useState(false)
  const fileInputRef = useRef(null)

  const helperCacheAvailable = isHelperCacheEnabled()

  // Check for existing backup when wallet connects and helper cache is available
  useEffect(() => {
    if (!isConnected || !identityKey || !helperCacheAvailable) {
      setBackupInfo(null)
      return
    }

    let cancelled = false
    setIsChecking(true)

    checkWalletBackup(identityKey)
      .then((info) => {
        if (!cancelled) {
          setBackupInfo(info)
        }
      })
      .catch((error) => {
        console.warn('[BackupSection] Failed to check backup status:', error)
      })
      .finally(() => {
        if (!cancelled) {
          setIsChecking(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [isConnected, identityKey, helperCacheAvailable])

  const handleBackup = useCallback(async () => {
    if (!identityKey) {
      addNotification({
        type: 'error',
        message: 'Connect your wallet first to create a backup.',
        duration: 5000,
      })
      return
    }

    setIsBackingUp(true)
    try {
      addNotification({
        type: 'info',
        message: 'Your wallet will ask you to sign a message to encrypt the backup.',
        duration: 5000,
      })

      const result = await createWalletBackup({ identityKey })

      if (result.success) {
        addNotification({
          type: 'success',
          message: `Backed up ${result.threadCount} thread${result.threadCount !== 1 ? 's' : ''} and all settings.`,
          duration: 5000,
        })
        const info = await checkWalletBackup(identityKey)
        setBackupInfo(info)
      } else {
        addNotification({
          type: 'error',
          message: result.error || 'Backup failed.',
          duration: 6000,
        })
      }
    } catch (error) {
      console.error('[BackupSection] Backup failed:', error)
      addNotification({
        type: 'error',
        message: formatErrorForNotification(error, { context: 'backup data' }),
        duration: 8000,
      })
    } finally {
      setIsBackingUp(false)
    }
  }, [identityKey, addNotification])

  const handleRestore = useCallback(async () => {
    if (!identityKey) {
      addNotification({
        type: 'error',
        message: 'Connect your wallet first to restore a backup.',
        duration: 5000,
      })
      return
    }

    setIsRestoring(true)
    try {
      addNotification({
        type: 'info',
        message: 'Your wallet will ask you to sign a message to decrypt the backup.',
        duration: 5000,
      })

      const result = await restoreWalletBackup({ identityKey })

      if (result.success) {
        addNotification({
          type: 'success',
          message: `Restored ${result.threadCount} thread${result.threadCount !== 1 ? 's' : ''} and settings. Refreshing page...`,
          duration: 4000,
        })
        setTimeout(() => {
          window.location.reload()
        }, 2000)
      } else {
        addNotification({
          type: 'error',
          message: result.error || 'Restore failed.',
          duration: 6000,
        })
      }
    } catch (error) {
      console.error('[BackupSection] Restore failed:', error)
      addNotification({
        type: 'error',
        message: formatErrorForNotification(error, { context: 'restore backup' }),
        duration: 8000,
      })
    } finally {
      setIsRestoring(false)
    }
  }, [identityKey, addNotification])

  const handleDownloadLocalBackup = useCallback(async () => {
    if (!identityKey) {
      addNotification({
        type: 'error',
        message: 'Connect your wallet first to create a backup.',
        duration: 5000,
      })
      return
    }

    setIsBackingUp(true)
    try {
      const result = await createLocalEncryptedBackup({ identityKey })

      if (!result?.success || !result.encrypted) {
        addNotification({
          type: 'error',
          message: result?.error || 'Backup failed.',
          duration: 6000,
        })
        return
      }

      const payload = {
        version: 2,
        encrypted: result.encrypted,
        createdAt: result.createdAt,
      }

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const timestamp = (result.createdAt || new Date().toISOString()).replace(/[:.]/g, '').replace(/Z$/, '')
      const filename = `nukenote-backup-${timestamp}.json`

      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = filename
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)

      addNotification({
        type: 'success',
        message: `Encrypted backup file downloaded${typeof result.threadCount === 'number' ? ` (${result.threadCount} thread${result.threadCount === 1 ? '' : 's'})` : ''}.`,
        duration: 6000,
      })
    } catch (error) {
      console.error('[BackupSection] Local backup download failed:', error)
      addNotification({
        type: 'error',
        message: formatErrorForNotification(error, { context: 'download backup file' }),
        duration: 8000,
      })
    } finally {
      setIsBackingUp(false)
    }
  }, [identityKey, addNotification])

  const handleRestoreFromFileSelected = useCallback(
    async (event) => {
      const file = event.target.files?.[0]
      if (!file) return

      if (!identityKey) {
        addNotification({
          type: 'error',
          message: 'Connect your wallet first to restore a backup.',
          duration: 5000,
        })
        event.target.value = ''
        return
      }

      setIsRestoring(true)
      try {
        const text = await file.text()
        let data
        try {
          data = JSON.parse(text)
        } catch (parseError) {
          throw new Error('Backup file is not valid JSON.')
        }

        if (!data || typeof data.encrypted !== 'string') {
          throw new Error('Backup file is missing encrypted data.')
        }

        addNotification({
          type: 'info',
          message: 'Your wallet will ask you to sign a message to decrypt the backup.',
          duration: 5000,
        })

        const result = await restoreWalletBackupFromEncrypted({
          identityKey,
          encrypted: data.encrypted,
        })

        if (result?.success) {
          addNotification({
            type: 'success',
            message: `Restored ${result.threadCount ?? 0} thread${result.threadCount === 1 ? '' : 's'} and settings. Refreshing page...`,
            duration: 4000,
          })
          setTimeout(() => {
            window.location.reload()
          }, 2000)
        } else {
          addNotification({
            type: 'error',
            message: result?.error || 'Restore failed.',
            duration: 6000,
          })
        }
      } catch (error) {
        console.error('[BackupSection] Restore from file failed:', error)
        addNotification({
          type: 'error',
          message: formatErrorForNotification(error, { context: 'restore from backup file' }),
          duration: 8000,
        })
      } finally {
        setIsRestoring(false)
        event.target.value = ''
      }
    },
    [identityKey, addNotification],
  )

  const handleRestoreFromFileClick = useCallback(() => {
    if (!identityKey) {
      addNotification({
        type: 'error',
        message: 'Connect your wallet first to restore a backup.',
        duration: 5000,
      })
      return
    }
    fileInputRef.current?.click()
  }, [identityKey, addNotification])

  const handleDelete = useCallback(async () => {
    if (!identityKey) return

    const confirmed = window.confirm(
      'Delete your cloud backup? This cannot be undone. Your local data will not be affected.',
    )
    if (!confirmed) return

    setIsDeleting(true)
    try {
      const result = await deleteWalletBackup(identityKey)

      if (result.success) {
        addNotification({
          type: 'success',
          message: 'Backup deleted.',
          duration: 4000,
        })
        setBackupInfo({ exists: false })
      } else {
        addNotification({
          type: 'error',
          message: 'Failed to delete backup.',
          duration: 5000,
        })
      }
    } catch (error) {
      console.error('[BackupSection] Delete failed:', error)
      addNotification({
        type: 'error',
        message: formatErrorForNotification(error, { context: 'delete backup' }),
        duration: 6000,
      })
    } finally {
      setIsDeleting(false)
    }
  }, [identityKey, addNotification])

  const toggleCloudBridge = useCallback(() => {
    setShowCloudBridge((prev) => !prev)
  }, [])

  return {
    isConnected,
    isBackingUp,
    isRestoring,
    isDeleting,
    isChecking,
    backupInfo,
    showCloudBridge,
    helperCacheAvailable,
    fileInputRef,
    handleDownloadLocalBackup,
    handleRestoreFromFileClick,
    handleRestoreFromFileSelected,
    handleBackup,
    handleRestore,
    handleDelete,
    toggleCloudBridge,
  }
}
