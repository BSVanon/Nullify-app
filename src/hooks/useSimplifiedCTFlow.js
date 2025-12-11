import { useState, useCallback } from 'react'
import { useWallet } from '../contexts/WalletContext'
import { useNotification } from '../contexts/NotificationContext'
import { mintControlToken, mintDataTokens, wrapEncryptionKey } from '../lib/wallet/actions'
import { validateRecipients } from '../lib/validation'

/**
 * Hook for simplified CT/DT creation flow
 * Handles all the complex operations behind a simple UI
 */
export function useSimplifiedCTFlow() {
  const { isConnected, capabilities } = useWallet()
  const { addNotification } = useNotification()
  
  const [isProcessing, setIsProcessing] = useState(false)
  const [flowState, setFlowState] = useState({
    file: null,
    fileHash: '',
    encryptedBlob: null,
    wrappedKey: '',
    storageUrl: '',
    ctTxid: '',
    ctVout: 0,
    recipients: ['']
  })

  // Handle file encryption with wallet key wrapping
  const processFile = useCallback(async (file) => {
    try {
      setIsProcessing(true)
      
      // 1. Read and hash file
      const arrayBuffer = await file.arrayBuffer()
      const bytes = new Uint8Array(arrayBuffer)
      const hashBuffer = await crypto.subtle.digest('SHA-256', bytes)
      const hashHex = Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0')).join('')
      
      // 2. Generate AES key
      const aesKey = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      )
      
      // 3. Encrypt file
      const iv = crypto.getRandomValues(new Uint8Array(12))
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        aesKey,
        bytes
      )
      
      // 4. Export key for wrapping
      const rawKey = await crypto.subtle.exportKey('raw', aesKey)
      const keyBytes = new Uint8Array(rawKey)
      const keyHex = Array.from(keyBytes)
        .map(b => b.toString(16).padStart(2, '0')).join('')
      
      // 5. Wrap key with wallet (if supported)
      let wrappedKey = keyHex // Default to raw if no wallet wrapping
      if (isConnected && (capabilities?.wrapDataKey || capabilities?.supported)) {
        try {
          const wrapResult = await wrapEncryptionKey(keyBytes)
          if (wrapResult?.wrappedKey) {
            wrappedKey = wrapResult.wrappedKey
          }
        } catch (wrapErr) {
          console.warn('Key wrapping failed, falling back to raw key', wrapErr)
        }
      }
      
      // 6. Combine IV + encrypted data
      const encryptedWithIV = new Uint8Array(iv.length + encrypted.byteLength)
      encryptedWithIV.set(iv)
      encryptedWithIV.set(new Uint8Array(encrypted), iv.length)
      
      // 7. Create downloadable blob
      const blob = new Blob([encryptedWithIV], { 
        type: 'application/octet-stream' 
      })
      
      setFlowState(prev => ({
        ...prev,
        file,
        fileHash: hashHex,
        encryptedBlob: blob,
        wrappedKey
      }))
      
      addNotification({
        message: '✅ File encrypted and key secured!',
        type: 'success',
        duration: 3000
      })
      
      return { success: true, hash: hashHex, blob }
      
    } catch (error) {
      addNotification({
        message: `Encryption failed: ${error.message}`,
        type: 'error',
        duration: 5000
      })
      return { success: false, error: error.message }
    } finally {
      setIsProcessing(false)
    }
  }, [isConnected, capabilities, addNotification])

  // Create Control Token with auto-populated fields
  const createControlToken = useCallback(async () => {
    const { fileHash, wrappedKey, storageUrl } = flowState
    
    if (!fileHash || !wrappedKey || !storageUrl) {
      addNotification({
        message: 'Missing required information to create a new Nullify Thread',
        type: 'error'
      })
      return { success: false }
    }
    
    try {
      setIsProcessing(true)
      
      const result = await mintControlToken({
        blobHash: fileHash,
        encKeyWrap: wrappedKey,
        hintURL: storageUrl,
        description: `Create a new Nullify Thread for ${flowState.file?.name || 'file'}`
      })
      
      if (result?.txid) {
        setFlowState(prev => ({
          ...prev,
          ctTxid: result.txid,
          ctVout: result.ctOutpoint?.vout || 0
        }))
        
        addNotification({
          message: `✅ New Nullify Thread created: ${result.txid}`,
          type: 'success',
          duration: 5000
        })
        
        return { success: true, txid: result.txid }
      }
      
      throw new Error('No transaction ID returned')
      
    } catch (error) {
      addNotification({
        message: `Nullify Thread creation failed: ${error.message}`,
        type: 'error',
        duration: 5000
      })
      return { success: false, error: error.message }
    } finally {
      setIsProcessing(false)
    }
  }, [flowState, addNotification])

  // Create Data Tokens with validation
  const createDataTokens = useCallback(async (recipientList) => {
    const { ctTxid, ctVout } = flowState
    
    if (!ctTxid) {
      addNotification({
        message: 'Create a new Nullify Thread first',
        type: 'warning'
      })
      return { success: false }
    }
    
    // Validate all recipients
    const validation = validateRecipients(recipientList.join(','))
    if (!validation.valid) {
      validation.errors.forEach(err => 
        addNotification({ message: err, type: 'error' })
      )
      return { success: false }
    }
    
    try {
      setIsProcessing(true)
      
      const result = await mintDataTokens({
        ctTxid,
        ctVout,
        recipients: validation.recipients.map(r => r.value),
        permissions: 'read-only',
        description: `Authorize Nullify Thread access for ${flowState.file?.name || 'file'}`
      })
      
      if (result?.txid) {
        addNotification({
          message: `✅ Access tokens created for ${validation.recipients.length} recipients`,
          type: 'success',
          duration: 5000
        })
        
        return { 
          success: true, 
          txid: result.txid,
          count: validation.recipients.length 
        }
      }
      
      throw new Error('No transaction ID returned')
      
    } catch (error) {
      addNotification({
        message: `Thread access authorization failed: ${error.message}`,
        type: 'error',
        duration: 5000
      })
      return { success: false, error: error.message }
    } finally {
      setIsProcessing(false)
    }
  }, [flowState, addNotification])

  // Download encrypted blob
  const downloadEncryptedFile = useCallback(() => {
    if (!flowState.encryptedBlob || !flowState.file) return
    
    const url = URL.createObjectURL(flowState.encryptedBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = `encrypted_${flowState.file.name}.dat`
    a.click()
    URL.revokeObjectURL(url)
    
    addNotification({
      message: '📥 Encrypted file downloaded',
      type: 'info',
      duration: 2000
    })
  }, [flowState, addNotification])

  // Update storage URL
  const setStorageUrl = useCallback((url) => {
    setFlowState(prev => ({ ...prev, storageUrl: url }))
  }, [])

  // Reset flow
  const resetFlow = useCallback(() => {
    setFlowState({
      file: null,
      fileHash: '',
      encryptedBlob: null,
      wrappedKey: '',
      storageUrl: '',
      ctTxid: '',
      ctVout: 0,
      recipients: ['']
    })
    setIsProcessing(false)
  }, [])

  return {
    // State
    flowState,
    isProcessing,
    isConnected,
    hasWrapSupport: capabilities?.wrapDataKey || capabilities?.supported,
    
    // Actions
    processFile,
    createControlToken,
    createDataTokens,
    downloadEncryptedFile,
    setStorageUrl,
    resetFlow
  }
}

export default useSimplifiedCTFlow
