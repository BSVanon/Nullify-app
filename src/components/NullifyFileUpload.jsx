import React, { useRef, useState } from 'react'

import { cn } from '@/lib/utils'

const DEFAULT_TOOLTIP =
  'Upload a file to create a self-destructing access token. The file will be encrypted and stored off-chain, with access controlled by blockchain tokens.'

export default function NullifyFileUpload({
  onFileProcessed,
  tooltip = DEFAULT_TOOLTIP,
  disabled = false,
  maxBytes = 5 * 1024 * 1024 // 5 MB
}) {
  const [dragActive, setDragActive] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [fileInfo, setFileInfo] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const inputRef = useRef(null)

  const processFile = async (file) => {
    setProcessing(true)
    try {
      setErrorMsg('')
      if (typeof maxBytes === 'number' && file.size > maxBytes) {
        setErrorMsg(`File too large. Max allowed is ${(maxBytes / 1024 / 1024).toFixed(1)} MB.`)
        return
      }

      const arrayBuffer = await file.arrayBuffer()
      const digest = await crypto.subtle.digest('SHA-256', arrayBuffer)
      const hashBytes = new Uint8Array(digest)
      const hashHex = Array.from(hashBytes)
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('')

      const fileData = {
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified,
        hash: hashHex
      }

      setFileInfo(fileData)
      onFileProcessed?.(file, fileData)
    } catch (error) {
      console.error('Error processing file:', error)
      setErrorMsg('Unable to process file. Please try again.')
    } finally {
      setProcessing(false)
    }
  }

  const handleDrop = async (event) => {
    event.preventDefault()
    setDragActive(false)
    if (disabled || processing) return

    const file = event.dataTransfer.files?.[0]
    if (file) await processFile(file)
  }

  const handleChange = async (event) => {
    const file = event.target.files?.[0]
    if (file && !disabled && !processing) await processFile(file)
  }

  const resetUpload = () => {
    setFileInfo(null)
    setProcessing(false)
    setErrorMsg('')
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="w-full rounded-xl border border-dashed border-border/60 bg-card/40 p-6 shadow-sm">
      <div className="mb-4 flex items-start gap-3 text-sm text-muted-foreground" role="tooltip" aria-live="polite">
        <svg
          className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground/70"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-4m0-4h.01" />
        </svg>
        <span>{tooltip}</span>
      </div>

      <div
        role="button"
        tabIndex={disabled || processing ? -1 : 0}
        aria-label="File upload area. Drag and drop or click to select a file."
        onDragOver={(event) => {
          event.preventDefault()
          if (!disabled && !processing) setDragActive(true)
        }}
        onDragLeave={(event) => {
          event.preventDefault()
          setDragActive(false)
        }}
        onDrop={handleDrop}
        onClick={() => !disabled && !processing && inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !disabled && !processing) inputRef.current?.click()
        }}
        className={cn(
          'flex min-h-[180px] flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed px-8 py-10 text-center transition-colors',
          disabled || processing
            ? 'cursor-not-allowed border-muted bg-muted/30'
            : dragActive
            ? 'border-primary bg-primary/5'
            : 'cursor-pointer border-muted-foreground/40 hover:border-primary hover:bg-primary/5'
        )}
      >
        <input
          ref={inputRef}
          id="nullifyFileUpload"
          type="file"
          className="hidden"
          onChange={handleChange}
          accept="*/*"
          disabled={disabled || processing}
        />

        {processing ? (
          <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
            <span className="font-medium text-foreground">Processing file…</span>
            <span>Encrypting and preparing access token</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
            <svg
              className="h-12 w-12 text-primary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6H16a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-sm font-medium text-foreground">
              {disabled ? 'Upload disabled' : 'Drag files here or click to upload'}
            </p>
            <p className="text-xs">Create self-destructing access tokens</p>
          </div>
        )}
      </div>

      {fileInfo && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span className="font-medium text-foreground">File information</span>
            <button type="button" onClick={resetUpload} className="text-xs text-primary hover:underline">
              Change file
            </button>
          </div>
          <div className="space-y-2 rounded-md border border-border bg-muted/40 p-3 text-xs">
            <div className="flex justify-between">
              <span>Name:</span>
              <span className="ml-2 max-w-[180px] truncate font-mono text-foreground/80">{fileInfo.name}</span>
            </div>
            <div className="flex justify-between">
              <span>Size:</span>
              <span>{(fileInfo.size / 1024).toFixed(1)} KB</span>
            </div>
            <div className="flex justify-between">
              <span>Type:</span>
              <span>{fileInfo.type || 'Unknown'}</span>
            </div>
            <div className="flex justify-between">
              <span>Hash:</span>
              <span className="ml-2 break-all font-mono text-primary/80">{fileInfo.hash}</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Your file will be encrypted and stored securely. Only recipients with valid access tokens can decrypt it.
          </p>
        </div>
      )}

      {errorMsg && (
        <div className="mt-3 text-xs text-destructive" role="alert">
          {errorMsg}
        </div>
      )}
    </div>
  )
}
