import React from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

function EncryptAndWrapCard({
  isConnected,
  wrapSupported,
  capabilities,
  encryptionState,
  encryptedDownloadUrl,
  encryptedBlob,
  downloadEncryptedBlob,
  uploadedFile,
  storageUrl,
  onStorageUrlChange,
  onEncryptAndWrap,
  copyToClipboard,
  ctBlobHash,
  ctEncKeyWrapped
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 2: Encrypt &amp; save file</CardTitle>
        <CardDescription>
          Encrypt in-browser with AES-256 and let your wallet wrap the key for safe storage.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {ctBlobHash && !ctEncKeyWrapped && (
          <div className="rounded-lg border border-sky-300 bg-sky-50 p-3 text-sm text-sky-900 dark:border-sky-700 dark:bg-sky-900/20 dark:text-sky-100">
            ✓ File hash ready: {ctBlobHash.substring(0, 16)}…
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {!ctEncKeyWrapped ? (
            <Button
              onClick={onEncryptAndWrap}
              disabled={!isConnected || !wrapSupported || encryptionState.status === 'processing'}
              className="sm:w-auto"
            >
              {encryptionState.status === 'processing' ? 'Encrypting…' : '🔐 Encrypt file'}
            </Button>
          ) : (
            <>
              <div className="flex-1 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-200">
                ✓ File encrypted! Key wrapped and ready.
              </div>
              {encryptedBlob && (
                <Button onClick={downloadEncryptedBlob} className="sm:w-auto">
                  📥 Download encrypted file
                </Button>
              )}
            </>
          )}
        </div>

        {!isConnected && (
          <div className="text-xs text-amber-500">
            Connect a BRC-100 wallet (Metanet Desktop or WUI) to encrypt and wrap the file key.
          </div>
        )}
        {isConnected && capabilities && !wrapSupported && (
          <div className="text-xs text-destructive">
            Connected wallet does not advertise wrap support. Switch to a compliant wallet (Metanet Desktop or WUI + wallet-infra).
          </div>
        )}
        {encryptionState.error && <div className="text-xs text-destructive">{encryptionState.error}</div>}

        {ctEncKeyWrapped && (
          <div className="space-y-3 border-t pt-4">
            <h4 className="text-sm font-medium">Step 3: Upload &amp; store</h4>
            <p className="text-xs text-muted-foreground">
              Upload the encrypted file to your storage provider (IPFS, Arweave, S3, etc.) and paste the URL here.
            </p>
            <Input
              type="url"
              placeholder="https://ipfs.io/ipfs/..."
              value={storageUrl || ''}
              onChange={onStorageUrlChange}
            />
            {storageUrl && (
              <div className="text-xs text-emerald-600 dark:text-emerald-300">
                ✓ Storage URL saved. Access-token fields are ready.
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default EncryptAndWrapCard
