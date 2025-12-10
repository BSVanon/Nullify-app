import React, { useState, useCallback } from 'react'
import { AlertCircle, Check, Database, Share2, Shield, Upload } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * Simplified thread access-token creation flow for non-technical users
 * Handles encryption, key wrapping, and token creation in guided steps
 */
function SimplifiedCTFlow({ 
  isConnected,
  onComplete,
  useNotification 
}) {
  const [currentStep, setCurrentStep] = useState(1)
  const [file, setFile] = useState(null)
  const [fileHash, setFileHash] = useState('')
  const [encryptedBlob, setEncryptedBlob] = useState(null)
  const [wrappedKey, setWrappedKey] = useState('')
  const [storageUrl, setStorageUrl] = useState('')
  const [ctTxid, setCtTxid] = useState('')
  const [recipients, setRecipients] = useState([''])
  const [isProcessing, setIsProcessing] = useState(false)
  
  const { addNotification } = useNotification || {}

  // Step 1: File upload and automatic encryption
  const handleFileUpload = useCallback(async (event) => {
    const uploadedFile = event.target.files[0]
    if (!uploadedFile) return

    setIsProcessing(true)
    try {
      // 1. Read file
      const arrayBuffer = await uploadedFile.arrayBuffer()
      const bytes = new Uint8Array(arrayBuffer)
      
      // 2. Hash file
      const hashBuffer = await crypto.subtle.digest('SHA-256', bytes)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
      
      // 3. Generate AES key
      const aesKey = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      )
      
      // 4. Encrypt file
      const iv = crypto.getRandomValues(new Uint8Array(12))
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        aesKey,
        bytes
      )
      
      // 5. Combine IV + encrypted data
      const encryptedWithIV = new Uint8Array(iv.length + encrypted.byteLength)
      encryptedWithIV.set(iv)
      encryptedWithIV.set(new Uint8Array(encrypted), iv.length)
      
      // 6. Export and wrap key (simplified for demo - needs wallet integration)
      const rawKey = await crypto.subtle.exportKey('raw', aesKey)
      const keyHex = Array.from(new Uint8Array(rawKey))
        .map(b => b.toString(16).padStart(2, '0')).join('')
      
      // For demo: simple "wrapping" - in production use wallet.wrapDataKey()
      const wrapped = btoa(keyHex) // Base64 encode for demo
      
      // 7. Create blob for download
      const blob = new Blob([encryptedWithIV], { type: 'application/octet-stream' })
      
      // Update state
      setFile(uploadedFile)
      setFileHash(hashHex)
      setEncryptedBlob(blob)
      setWrappedKey(wrapped)
      setCurrentStep(2)
      
      addNotification?.({
        message: '✅ File encrypted successfully!',
        type: 'success'
      })
    } catch (error) {
      addNotification?.({
        message: `Encryption failed: ${error.message}`,
        type: 'error'
      })
    } finally {
      setIsProcessing(false)
    }
  }, [addNotification])

  // Step 2: Handle storage URL input
  const handleStorageUrl = useCallback((url) => {
    setStorageUrl(url)
    if (url && url.startsWith('http')) {
      setCurrentStep(3)
    }
  }, [])

  // Step 3: Create Control Token
  const handleCreateCT = useCallback(async () => {
    if (!isConnected) {
      addNotification?.({
        message: 'Please connect wallet first',
        type: 'warning'
      })
      return
    }

    setIsProcessing(true)
    try {
      // In production, call mintControlToken from wallet/actions.js
      // For demo, simulate success
      const mockTxid = 'ct_' + Math.random().toString(36).substr(2, 9)
      
      setCtTxid(mockTxid)
      setCurrentStep(4)
      
      addNotification?.({
        message: `✅ Thread access token created: ${mockTxid}`,
        type: 'success'
      })
    } catch (error) {
      addNotification?.({
        message: `CT creation failed: ${error.message}`,
        type: 'error'
      })
    } finally {
      setIsProcessing(false)
    }
  }, [isConnected, fileHash, wrappedKey, storageUrl, addNotification])

  // Step 4: Create Data Tokens
  const handleCreateDTs = useCallback(async () => {
    const validRecipients = recipients.filter(r => r.trim())
    if (validRecipients.length === 0) {
      addNotification?.({
        message: 'Please add at least one recipient',
        type: 'warning'
      })
      return
    }

    setIsProcessing(true)
    try {
      // In production, call mintDataTokens from wallet/actions.js
      // For demo, simulate success
      const mockDtTxid = 'dt_' + Math.random().toString(36).substr(2, 9)
      
      addNotification?.({
        message: `✅ Access tokens created for ${validRecipients.length} recipients: ${mockDtTxid}`,
        type: 'success'
      })
      
      // Complete the flow
      onComplete?.({
        ctTxid,
        dtTxid: mockDtTxid,
        fileHash,
        storageUrl,
        recipients: validRecipients
      })
    } catch (error) {
      addNotification?.({
        message: `DT creation failed: ${error.message}`,
        type: 'error'
      })
    } finally {
      setIsProcessing(false)
    }
  }, [ctTxid, recipients, addNotification, onComplete])

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        {[1, 2, 3, 4].map((step) => (
          <div key={step} className="flex items-center">
            <div
              className={
                'flex h-10 w-10 items-center justify-center rounded-full border text-sm font-semibold transition-colors ' +
                (currentStep >= step ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground')
              }
            >
              {currentStep > step ? <Check className="h-4 w-4" /> : step}
            </div>
            {step < 4 && <div className={`h-px w-16 ${currentStep > step ? 'bg-primary' : 'bg-border'}`} />}
          </div>
        ))}
      </div>

      <Card className={currentStep !== 1 ? 'opacity-60' : ''}>
        <CardHeader className="flex flex-row items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Step 1: Secure your file</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!file ? (
            <label
              htmlFor="simplified-upload"
              className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground transition hover:border-primary"
            >
              <Upload className="h-10 w-10 text-muted-foreground" />
              <span>Click to upload or drag and drop</span>
              <span className="text-xs text-muted-foreground/80">Your file stays local and is encrypted in the browser.</span>
              <input
                id="simplified-upload"
                type="file"
                className="hidden"
                onChange={handleFileUpload}
                disabled={isProcessing}
              />
            </label>
          ) : (
            <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-200">
              <Check className="mr-2 inline h-4 w-4" /> {file.name} encrypted successfully.
              <div className="mt-2 text-xs text-muted-foreground">Hash: {fileHash.substring(0, 16)}…</div>
            </div>
          )}
        </CardContent>
      </Card>

      {currentStep >= 2 && (
        <Card className={currentStep !== 2 ? 'opacity-60' : ''}>
          <CardHeader className="flex flex-row items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Step 2: Store encrypted file</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {encryptedBlob && (
              <div className="rounded-lg border border-primary/40 bg-primary/5 p-4 text-sm text-primary-foreground">
                <p className="font-medium">Your encrypted file is ready:</p>
                <Button
                  className="mt-3"
                  size="sm"
                  onClick={() => {
                    const url = URL.createObjectURL(encryptedBlob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `encrypted_${file.name}.dat`
                    a.click()
                    URL.revokeObjectURL(url)
                  }}
                >
                  📥 Download encrypted file
                </Button>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Upload the encrypted blob to your preferred storage (IPFS, Arweave, S3, etc.) and paste the URL here.
              </p>
              <Label htmlFor="simplified-storage" className="sr-only">
                Storage URL
              </Label>
              <Input
                id="simplified-storage"
                type="url"
                placeholder="https://storage.example.com/your-encrypted-file"
                value={storageUrl}
                onChange={(e) => handleStorageUrl(e.target.value)}
              />
            </div>

            {storageUrl && (
              <Button onClick={() => setCurrentStep(3)} className="w-full">
                Continue to create token →
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {currentStep >= 3 && (
        <Card className={currentStep !== 3 ? 'opacity-60' : ''}>
          <CardHeader className="flex flex-row items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Step 3: Create thread access token</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm">
              <p className="mb-2 text-muted-foreground">Everything is ready. The thread access token will include:</p>
              <ul className="space-y-1 text-muted-foreground">
                <li>✅ File hash: {fileHash.substring(0, 20)}…</li>
                <li>✅ Wrapped key: {wrappedKey.substring(0, 20)}…</li>
                <li>✅ Storage URL: {storageUrl.substring(0, 40)}…</li>
              </ul>
            </div>

            <Button onClick={handleCreateCT} disabled={!isConnected || isProcessing} className="w-full">
              {isProcessing ? 'Creating…' : 'Create control token'}
            </Button>

            {!isConnected && (
              <p className="flex items-center gap-2 text-sm text-amber-600">
                <AlertCircle className="h-4 w-4" /> Connect your wallet to continue
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {currentStep >= 4 && (
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Share2 className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Step 4: Grant access</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-200">
              <Check className="mr-2 inline h-4 w-4" /> Thread access token created: <code className="font-mono text-xs">{ctTxid}</code>
            </div>

            <p className="text-sm text-muted-foreground">Who should have access to this file?</p>

            {recipients.map((recipient, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Recipient address or public key"
                  value={recipient}
                  onChange={(e) => {
                    const next = [...recipients]
                    next[index] = e.target.value
                    setRecipients(next)
                  }}
                />
                {index === recipients.length - 1 && (
                  <Button type="button" variant="outline" size="icon" onClick={() => setRecipients([...recipients, ''])}>
                    +
                  </Button>
                )}
              </div>
            ))}

            <Button onClick={handleCreateDTs} disabled={isProcessing} className="w-full">
              {isProcessing ? 'Creating access tokens…' : 'Create access tokens'}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default SimplifiedCTFlow
