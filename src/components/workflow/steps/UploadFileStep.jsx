import React from 'react'

import NukeNoteFileUpload from '@/components/NukeNoteFileUpload'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

function UploadFileStep({
  uploadedFile,
  ctBlobHash,
  onBack,
  onContinue,
  onFileProcessed
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 2: Upload File</CardTitle>
        <CardDescription>Upload a file to create a NukeNote. Files never leave the browser until encrypted.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <NukeNoteFileUpload onFileProcessed={onFileProcessed} />
        {uploadedFile && ctBlobHash && (
          <div className="space-y-3">
            <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-200">
              <p className="font-medium">File ready: {uploadedFile.name}</p>
              <p className="font-mono text-xs opacity-80">Hash: {ctBlobHash.substring(0, 32)}…</p>
            </div>
          </div>
        )}
      </CardContent>
      {uploadedFile && ctBlobHash && (
        <CardFooter className="flex gap-2">
          <Button onClick={onBack} variant="outline" className="flex-1">
            ← Back
          </Button>
          <Button onClick={onContinue} className="flex-1">
            Continue →
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}

export default UploadFileStep
