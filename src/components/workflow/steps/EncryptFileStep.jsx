import React from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function EncryptFileStep({
  uploadedFile,
  ctEncKeyWrapped,
  wrapSupported,
  encryptionState,
  handleEncryptAndWrap,
  encryptedDownloadUrl,
  storageUrl,
  setStorageUrl,
  onBack,
  onContinue
}) {
  const isProcessing = encryptionState.status === 'processing'
  const storageUrlFilled = !!storageUrl?.trim()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 3: Encrypt File</CardTitle>
        <CardDescription>Encrypt with AES-256-GCM and let your wallet wrap the key.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!ctEncKeyWrapped ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-sky-300 bg-sky-50 p-4 text-sm text-sky-900 dark:border-sky-700 dark:bg-sky-900/20 dark:text-sky-100">
              <p className="font-medium">Ready to encrypt: {uploadedFile?.name || 'Selected file'}</p>
              {!wrapSupported && (
                <p className="mt-2 text-xs text-amber-600">
                  Wallet did not advertise wrap support. You can still try encryption but it may fail.
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-200">
              <p className="font-medium">File encrypted and key wrapped!</p>
            </div>
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200">
              <p className="font-semibold">Next steps</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs">
                <li>Download the encrypted file.</li>
                <li>Upload it to your storage provider (IPFS, S3, etc.).</li>
                <li>Copy the hosted URL.</li>
                <li>Paste the URL below.</li>
              </ol>
            </div>
            <Button
              onClick={() => {
                if (encryptedDownloadUrl) {
                  const anchor = document.createElement('a')
                  anchor.href = encryptedDownloadUrl
                  anchor.download = `${uploadedFile?.name || 'file'}.encrypted`
                  document.body.appendChild(anchor)
                  anchor.click()
                  document.body.removeChild(anchor)
                }
              }}
              disabled={!encryptedDownloadUrl}
              className="w-full"
            >
              📥 Download encrypted file
            </Button>
            <div className="space-y-2">
              <Label htmlFor="storage-url">Storage URL</Label>
              <Input
                id="storage-url"
                value={storageUrl}
                onChange={(event) => setStorageUrl(event.target.value)}
                placeholder="https://... or ipfs://..."
              />
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-col gap-2 sm:flex-row">
        <Button onClick={onBack} variant="outline" className="sm:flex-1">
          ← Back
        </Button>
        {ctEncKeyWrapped ? (
          <Button onClick={onContinue} disabled={!storageUrlFilled} className="sm:flex-1">
            Continue →
          </Button>
        ) : (
          <Button
            onClick={handleEncryptAndWrap}
            disabled={!wrapSupported || isProcessing}
            className="sm:flex-1"
          >
            {isProcessing ? '🔐 Encrypting…' : '🔐 Encrypt'}
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}

export default EncryptFileStep
