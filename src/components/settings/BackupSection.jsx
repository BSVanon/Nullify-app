import React from 'react'

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useBackupSection } from '@/hooks/settings/useBackupSection'

export default function BackupSection() {
  const {
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
  } = useBackupSection()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Backup & Recovery</CardTitle>
        <CardDescription>
          Download an encrypted backup file you can keep anywhere, and optionally use a temporary cloud bridge to move
          between devices.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isConnected ? (
          <p className="text-sm text-amber-500">
            Connect your wallet to enable backup and restore.
          </p>
        ) : (
          <>
            {/* Local backup file controls (primary path) */}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                onClick={handleDownloadLocalBackup}
                disabled={isBackingUp || isRestoring || isDeleting}
                className="flex-1"
              >
                {isBackingUp ? 'Preparing backup…' : 'Download backup file'}
              </Button>
              <Button
                onClick={handleRestoreFromFileClick}
                disabled={isBackingUp || isRestoring || isDeleting}
                variant="outline"
                className="flex-1"
              >
                Restore from file
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={handleRestoreFromFileSelected}
              />
            </div>

            {/* Optional cloud bridge (helper-cache) */}
            {helperCacheAvailable && (
              <div className="space-y-2 border-t pt-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    Need to move data between devices without copying a file? Use a temporary cloud bridge.
                  </p>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={isBackingUp || isRestoring || isDeleting}
                    onClick={toggleCloudBridge}
                  >
                    {showCloudBridge ? 'Hide cloud bridge' : 'Use cloud bridge'}
                  </Button>
                </div>

                {showCloudBridge && (
                  <div className="space-y-3 rounded-md border border-dashed border-muted-foreground/40 bg-muted/30 p-3">
                    {isChecking ? (
                      <p className="text-sm text-muted-foreground">Checking cloud bridge status...</p>
                    ) : backupInfo?.exists ? (
                      <div className="rounded-md bg-muted/60 p-3 text-sm">
                        <p className="font-medium text-foreground">Cloud bridge backup available</p>
                        <p className="text-xs text-muted-foreground">
                          Last bridge backup: {new Date(backupInfo.createdAt).toLocaleString()}
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-md bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
                        <p className="font-medium">No cloud bridge backup</p>
                        <p className="text-xs">
                          Create a temporary encrypted backup on the helper server, then restore it on another device
                          and delete it when you are done.
                        </p>
                      </div>
                    )}

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button
                        onClick={handleBackup}
                        disabled={isBackingUp || isRestoring || isDeleting}
                        className="flex-1"
                      >
                        {isBackingUp
                          ? 'Saving to cloud bridge…'
                          : backupInfo?.exists
                            ? 'Update cloud bridge backup'
                            : 'Create cloud bridge backup'}
                      </Button>

                      {backupInfo?.exists && (
                        <Button
                          onClick={handleRestore}
                          disabled={isBackingUp || isRestoring || isDeleting}
                          variant="outline"
                          className="flex-1"
                        >
                          {isRestoring ? 'Restoring from cloud…' : 'Restore from cloud bridge'}
                        </Button>
                      )}
                    </div>

                    {backupInfo?.exists && (
                      <div className="border-t pt-3">
                        <Button
                          onClick={handleDelete}
                          disabled={isBackingUp || isRestoring || isDeleting}
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                        >
                          {isDeleting ? 'Removing cloud backup…' : 'Delete cloud bridge backup'}
                        </Button>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Removes the encrypted bridge copy from the helper server. Your local data will not be
                          affected.
                        </p>
                      </div>
                    )}

                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Cloud bridge backups are provided as a convenience only and may be removed at any time. Do not
                      rely on the server as your only backup; always keep a local backup file for important data.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Info */}
            <div className="space-y-2 text-xs text-muted-foreground">
              <p>
                <strong>What's backed up:</strong> Thread access, guest identities, profile, contacts,
                blocked users, and app preferences.
              </p>
              <p>
                <strong>What's NOT backed up:</strong> Message history (stored locally only) and
                burned threads (permanently deleted).
              </p>
              <p>
                <strong>Security:</strong> Your backup is encrypted with a key derived from your wallet.
                Only this wallet can decrypt it.
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
