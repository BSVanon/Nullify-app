import { useCallback, useEffect, useMemo, useState } from 'react'

import { useWallet } from '../contexts/WalletContext'
import { useNotification } from '../contexts/NotificationContext'
import useClipboard from './useClipboard'
import useEncryptionWorkflow from './useEncryptionWorkflow'
import usePaymentVerification from './usePaymentVerification'
import useHistoryLoader from './useHistoryLoader'
import { useAuthFetch } from '../providers/AuthFetchProvider'
import { mintAtomicCTandDTs } from '../lib/wallet/actions.js'
import useControlTokenManager from './workflow/useControlTokenManager.js'
import useDataTokenManager from './workflow/useDataTokenManager.js'
import { useWorkflowDraftPersistence } from './workflow/useWorkflowDraftPersistence.js'
import { useWorkflowWalletOrchestration } from './workflow/useWorkflowWalletOrchestration.js'

const debugLog = (...args) => {
  if (import.meta?.env?.MODE === 'development') {
    const stamp = new Date().toISOString()
    console.log(`[workflow][${stamp}]`, ...args)
  }
}

function useNukeNoteWorkflow() {
  const {
    isConnected,
    walletType,
    network,
    version,
    connectWallet,
    disconnectWallet,
    isLoading,
    capabilities
  } = useWallet()
  const { addNotification } = useNotification()

  const [currentStep, setCurrentStep] = useState('upload')
  const [encryptedPayloadBase64State, setEncryptedPayloadBase64] = useState('')
  // CT/DT field management
  const [encryptedBlob, setEncryptedBlob] = useState(null)
  const {
    dtMode,
    setDtMode,
    dtCtTxid,
    setDtCtTxid,
    dtCtVout,
    setDtCtVout,
    dtRecipient,
    setDtRecipient,
    dtPermissions,
    setDtPermissions,
    dtPreview,
    dtErrors,
    dtMinting,
    dtMintResult,
    dtArtifacts,
    dtBroadcast,
    dtRedeeming,
    dtRedeemResult,
    ctStatus,
    dtRawKeyBase64,
    setDtRawKeyBase64,
    setDtMintResult,
    buildDtPreview,
    handleMintDataTokens,
    handleRedeemDataToken,
    handleVerifyControlToken,
    resetDtState
  } = useDataTokenManager({ addNotification })

  const copyToClipboard = useClipboard(addNotification)

  const {
    jwtToken,
    vpAddress,
    setVpAddress,
    vpAmount,
    setVpAmount,
    vpMinConf,
    setVpMinConf,
    vpTxid,
    setVpTxid,
    vpResult,
    deriveInvoice,
    verifyPayment
  } = usePaymentVerification({ addNotification })

  const {
    histCount,
    setHistCount,
    histLoading,
    histResult,
    loadHistory
  } = useHistoryLoader()

  const wrapSupported = useMemo(() => {
    if (!capabilities) return false
    if (capabilities.wrapDataKey) return true
    if (capabilities?.missing?.includes?.('wrapDataKey')) return false
    if (capabilities.supported) return true
    return capabilities.features?.includes?.('wrapDataKey')
  }, [capabilities])

  const {
    uploadedFile,
    encryptionState,
    encryptedDownloadUrl,
    storageUrl,
    setStorageUrl,
    encryptedPayloadBase64,
    handleFileProcessed,
    handleEncryptAndWrap
  } = useEncryptionWorkflow({
    addNotification,
    isConnected,
    wrapSupported,
    advanceToEncrypt: () => setCurrentStep('encrypt'),
    onReset: () => {
      resetControlTokenState()
      resetDtState()
    },
    onEncryptionData: ({ blobHash, encKeyWrap, rawKeyBase64, encryptedBase64 }) => {
      if (blobHash) setCtBlobHash(blobHash)
      if (encKeyWrap) setCtEncKeyWrapped(encKeyWrap)
      if (rawKeyBase64) {
        setDtRawKeyBase64(rawKeyBase64)
      } else {
        setDtRawKeyBase64('')
      }
      if (encryptedBase64) {
        setEncryptedPayloadBase64(encryptedBase64)
      }
    }
  })

  const {
    ctHintURL,
    setCtHintURL,
    ctEncKeyWrapped,
    setCtEncKeyWrapped,
    ctBlobHash,
    setCtBlobHash,
    ctPreview,
    ctErrors,
    ctMinting,
    ctMintResult,
    ctArtifacts,
    ctBroadcast,
    setCtMintResult,
    setCtArtifacts,
    ctOutpoint,
    setCtOutpoint,
    canMintCT,
    buildCtPreview,
    handleMintControlToken,
    handleBurnControlToken,
    resetControlTokenState
  } = useControlTokenManager({
    addNotification,
    encryptionState,
    storageUrl,
    wrapSupported,
    uploadedFile,
    onMint: ({ outpoint, txid }) => {
      setDtMode('outpoint')
      setDtCtTxid(outpoint?.txid || txid)
      setDtCtVout(outpoint?.vout || 0)
    },
    onBurn: () => {
      resetDtState()
    }
  })

  const { ensureAuth, fetchWithAuth } = useAuthFetch()

  useWorkflowDraftPersistence({
    draftState: {
      storageUrl,
      ctHintURL,
      ctEncKeyWrapped,
      ctBlobHash,
      encryptedPayloadBase64: encryptedPayloadBase64State,
      dtMode,
      dtCtTxid,
      dtCtVout,
      dtRecipient,
      dtPermissions,
      ctMintResult,
      ctArtifacts,
      ctOutpoint,
      ctBroadcast,
      ctMinting,
      dtMintResult,
      dtArtifacts,
      dtBroadcast
    },
    restoreHandlers: {
      onRestore: (draft) => {
        debugLog('Restored draft from localStorage', draft)
        if (draft.storageUrl) setStorageUrl(draft.storageUrl)
        if (draft.ctHintURL) setCtHintURL(draft.ctHintURL)
        if (draft.ctEncKeyWrapped) setCtEncKeyWrapped(draft.ctEncKeyWrapped)
        if (draft.ctBlobHash) setCtBlobHash(draft.ctBlobHash)
        if (draft.encryptedPayloadBase64) setEncryptedPayloadBase64(draft.encryptedPayloadBase64)
        if (draft.dtMode) setDtMode(draft.dtMode)
        if (draft.dtCtTxid) setDtCtTxid(draft.dtCtTxid)
        if (Number.isInteger(draft.dtCtVout)) setDtCtVout(draft.dtCtVout)
        if (draft.dtRecipient) setDtRecipient(draft.dtRecipient)
        if (draft.dtPermissions) setDtPermissions(draft.dtPermissions)
        if (draft.ctMintResult) setCtMintResult(draft.ctMintResult)
        if (draft.ctArtifacts) setCtArtifacts(draft.ctArtifacts)
        if (draft.ctOutpoint) setCtOutpoint(draft.ctOutpoint)
        if (draft.ctBroadcast) setCtBroadcast(draft.ctBroadcast)
        if (draft.dtMintResult) setDtMintResult(draft.dtMintResult)
        if (draft.dtArtifacts) setDtArtifacts(draft.dtArtifacts)
        if (draft.dtBroadcast) setDtBroadcast(draft.dtBroadcast)
      }
    }
  })

  const {
    lastTxid,
    anchorStatus,
    anchorChecking,
    handleWalletConnect,
    handleWalletDisconnect,
    handleAnchorProof,
    checkTxStatus
  } = useWorkflowWalletOrchestration({
    addNotification,
    connectWallet,
    disconnectWallet,
    ensureAuth,
    fetchWithAuth,
    isConnected,
    uploadedFile,
    debugLog
  })

  useEffect(() => {
    if (storageUrl !== undefined) {
      setCtHintURL(storageUrl)
    }
  }, [storageUrl, setCtHintURL])

  const loadHistoryForUi = useCallback(() => loadHistory(jwtToken), [jwtToken, loadHistory])

  // Helper to download encrypted blob
  const downloadEncryptedBlob = useCallback(() => {
    debugLog('downloadEncryptedBlob requested', { hasBlob: !!encryptedBlob, fileName: uploadedFile?.name })
    if (!encryptedBlob || !uploadedFile) {
      addNotification({ 
        message: 'No encrypted file available', 
        type: 'warning' 
      })
      return
    }
    
    const url = URL.createObjectURL(encryptedBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = `encrypted_${uploadedFile.name}.dat`
    a.click()
    URL.revokeObjectURL(url)
    
    addNotification({
      message: '📥 Encrypted file downloaded',
      type: 'info',
      duration: 2000
    })
  }, [encryptedBlob, uploadedFile, addNotification])

  return {
    currentStep,
    setCurrentStep,
    isConnected,
    walletType,
    network,
    version,
    isLoading,
    capabilities,
    wrapSupported,
    handleWalletConnect,
    handleWalletDisconnect,
    uploadedFile,
    handleFileProcessed,
    encryptionState,
    handleEncryptAndWrap,
    encryptedDownloadUrl,
    encryptedBlob,
    downloadEncryptedBlob,
    storageUrl,
    setStorageUrl,
    encryptedPayloadBase64: encryptedPayloadBase64State,
    copyToClipboard,
    ctHintURL,
    setCtHintURL,
    ctEncKeyWrapped,
    setCtEncKeyWrapped,
    ctBlobHash,
    ctPreview,
    ctErrors,
    buildCtPreview,
    handleMintControlToken,
    canMintCT,
    ctMinting,
    ctMintResult,
    ctArtifacts,
    ctOutpoint,
    ctBroadcast,
    dtMode,
    setDtMode,
    dtCtTxid,
    setDtCtTxid,
    dtCtVout,
    setDtCtVout,
    dtRecipient,
    setDtRecipient,
    dtPermissions,
    setDtPermissions,
    buildDtPreview,
    dtErrors,
    dtPreview,
    dtMinting,
    dtMintResult,
    dtRedeeming,
    dtRedeemResult,
    ctStatus,
    dtRawKeyBase64,
    handleMintDataTokens,
    handleRedeemDataToken,
    handleVerifyControlToken,
    handleBurnControlToken,
    lastTxid,
    anchorStatus,
    anchorChecking,
    handleAnchorProof,
    checkTxStatus,
    jwtToken,
    vpAddress,
    setVpAddress,
    vpAmount,
    setVpAmount,
    vpMinConf,
    setVpMinConf,
    vpTxid,
    setVpTxid,
    vpResult,
    verifyPayment,
    deriveInvoice,
    histCount,
    setHistCount,
    loadHistory: loadHistoryForUi,
    histLoading,
    histResult
  }
}

export default useNukeNoteWorkflow
