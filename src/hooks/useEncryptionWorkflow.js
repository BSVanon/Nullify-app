import { useCallback, useEffect, useRef, useState } from 'react'
import { NullifyEncryption } from '../lib/encryption.js'
import { wrapEncryptionKey } from '../lib/wallet/actions.js'

function toBase64(bytesLike) {
  if (!bytesLike) return ''
  const bytes = bytesLike instanceof Uint8Array ? bytesLike : new Uint8Array(bytesLike)
  if (typeof btoa === 'function') {
    let binary = ''
    const chunk = 0x8000
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk))
    }
    return btoa(binary)
  }
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64')
  }
  throw new Error('Base64 encoding unavailable in this environment')
}

export function useEncryptionWorkflow({
  addNotification,
  isConnected,
  wrapSupported,
  advanceToEncrypt,
  onReset,
  onEncryptionData
} = {}) {
  const encryptionHelperRef = useRef(null)
  const [uploadedFile, setUploadedFile] = useState(null)
  const [encryptionState, setEncryptionState] = useState({
    status: 'idle',
    error: null,
    blobHash: '',
    encKeyWrap: '',
    rawKeyBase64: ''
  })
  const [encryptedDownloadUrl, setEncryptedDownloadUrl] = useState('')
  const [storageUrl, setStorageUrl] = useState('')
  const [encryptedPayloadBase64, setEncryptedPayloadBase64] = useState('')

  useEffect(() => {
    if (!encryptionHelperRef.current) {
      encryptionHelperRef.current = new NullifyEncryption()
    }
  }, [])

  useEffect(() => {
    if (!encryptedDownloadUrl) return
    return () => {
      URL.revokeObjectURL(encryptedDownloadUrl)
    }
  }, [encryptedDownloadUrl])

  const resetEncryptionState = useCallback(() => {
    setEncryptionState({ status: 'idle', error: null, blobHash: '', encKeyWrap: '', rawKeyBase64: '' })
    setEncryptedDownloadUrl('')
    setStorageUrl('')
    setEncryptedPayloadBase64('')
  }, [])

  const handleFileProcessed = useCallback((file, fileData) => {
    setUploadedFile({ file, ...fileData })
    if (encryptedDownloadUrl) {
      URL.revokeObjectURL(encryptedDownloadUrl)
    }
    resetEncryptionState()
    if (typeof onReset === 'function') onReset()
    addNotification?.({ message: 'File processed successfully!', type: 'success', duration: 3000 })
    if (typeof onEncryptionData === 'function' && fileData?.hash) {
      onEncryptionData({ blobHash: fileData.hash })
    }
    advanceToEncrypt?.()
  }, [addNotification, advanceToEncrypt, encryptedDownloadUrl, onEncryptionData, onReset, resetEncryptionState])

  const handleEncryptAndWrap = useCallback(async () => {
    if (!uploadedFile?.file) {
      addNotification?.({ message: 'Upload a file first', type: 'warning', duration: 4000 })
      return
    }
    if (!isConnected) {
      addNotification?.({ message: 'Connect a BRC-100 wallet to wrap the key.', type: 'warning', duration: 4000 })
      return
    }
    if (!wrapSupported) {
      addNotification?.({ message: 'Connected wallet cannot wrap keys. Use Metanet Desktop or WUI configured for BRC-100.', type: 'error', duration: 6000 })
      return
    }

    const helper = encryptionHelperRef.current || new NullifyEncryption()
    encryptionHelperRef.current = helper

    setEncryptionState(prev => ({ ...prev, status: 'processing', error: null }))
    addNotification?.({ message: 'Encrypting file and preparing key wrap…', type: 'info', duration: 2500 })

    try {
      const key = await helper.generateKey()
      const encryptedBytes = await helper.encryptFile(uploadedFile.file, key)
      const exportedKey = await helper.exportKey(key)
      const blobHash = await helper.calculateHash(encryptedBytes)

      const wrapResult = await wrapEncryptionKey(new Uint8Array(exportedKey))
      const rawKeyBase64 = toBase64(new Uint8Array(exportedKey))
      const encryptedBase64 = toBase64(encryptedBytes)

      if (encryptedDownloadUrl) {
        URL.revokeObjectURL(encryptedDownloadUrl)
      }
      const downloadUrl = URL.createObjectURL(new Blob([encryptedBytes], { type: 'application/octet-stream' }))
      setEncryptedDownloadUrl(downloadUrl)
      setEncryptedPayloadBase64(encryptedBase64)

      const nextState = {
        status: 'wrapped',
        error: null,
        blobHash,
        encKeyWrap: wrapResult.wrappedKey,
        rawKeyBase64
      }
      setEncryptionState(nextState)
      if (typeof onEncryptionData === 'function') {
        onEncryptionData({ blobHash, encKeyWrap: wrapResult.wrappedKey, rawKeyBase64, encryptedBase64 })
      }

      addNotification?.({ message: 'Encryption and key wrap complete.', type: 'success', duration: 4000 })
    } catch (err) {
      setEncryptionState({ status: 'error', error: err.message, blobHash: '', encKeyWrap: '', rawKeyBase64: '' })
      addNotification?.({ message: `Encryption failed: ${err.message}`, type: 'error', duration: 6000 })
    }
  }, [addNotification, encryptedDownloadUrl, isConnected, onEncryptionData, uploadedFile, wrapSupported])

  return {
    uploadedFile,
    encryptionState,
    encryptedDownloadUrl,
    storageUrl,
    setStorageUrl,
    encryptedPayloadBase64,
    handleFileProcessed,
    handleEncryptAndWrap,
    resetEncryptionState
  }
}

export default useEncryptionWorkflow
