import { useCallback, useMemo, useState } from 'react'
import { createCTPayload, validateCTPayload } from '../../lib/token/ct.js'
import { mintControlToken, burnControlToken } from '../../lib/wallet/actions.js'

export default function useControlTokenManager({
  addNotification,
  encryptionState,
  storageUrl,
  wrapSupported,
  uploadedFile,
  onMint,
  onBurn
}) {
  const [ctHintURL, setCtHintURL] = useState('')
  const [ctEncKeyWrapped, setCtEncKeyWrapped] = useState('')
  const [ctBlobHash, setCtBlobHash] = useState('')
  const [ctPreview, setCtPreview] = useState('')
  const [ctErrors, setCtErrors] = useState([])
  const [ctMinting, setCtMinting] = useState(false)
  const [ctMintResult, setCtMintResult] = useState(null)
  const [ctArtifacts, setCtArtifacts] = useState(null)
  const [ctBroadcast, setCtBroadcast] = useState(null)
  const [ctOutpoint, setCtOutpoint] = useState(null)

  const canMintCT = useMemo(() => (
    wrapSupported &&
    encryptionState.status === 'wrapped' &&
    !!ctBlobHash &&
    !!ctEncKeyWrapped &&
    storageUrl.trim().length > 0
  ), [wrapSupported, encryptionState.status, ctBlobHash, ctEncKeyWrapped, storageUrl])

  const buildCtPreview = useCallback(() => {
    try {
      if (!ctBlobHash) {
        addNotification({ message: 'Generate the encrypted blob first to obtain its hash.', type: 'error', duration: 4000 })
        return
      }
      if (!ctEncKeyWrapped) {
        addNotification({ message: 'Wrap the encryption key before building the CT payload.', type: 'error', duration: 4000 })
        return
      }
      const payload = createCTPayload({
        blobHash: ctBlobHash,
        hintURL: ctHintURL ? ctHintURL.trim() : '',
        encKeyWrap: ctEncKeyWrapped,
        meta: { name: uploadedFile?.file?.name || uploadedFile?.name || '' }
      })
      const validation = validateCTPayload(payload)
      setCtErrors(validation.ok ? [] : validation.errors)
      setCtPreview(JSON.stringify(payload, null, 2))
      addNotification({
        message: validation.ok ? 'CT payload looks valid' : 'CT payload has issues; see below',
        type: validation.ok ? 'success' : 'error',
        duration: validation.ok ? 2500 : 4000
      })
    } catch (err) {
      setCtErrors([String(err?.message || err)])
      setCtPreview('')
    }
  }, [addNotification, ctBlobHash, ctEncKeyWrapped, ctHintURL, uploadedFile])

  const handleMintControlToken = useCallback(async () => {
    console.log('[handleMintControlToken] Called, canMintCT:', canMintCT)
    if (!canMintCT) {
      addNotification({ message: 'Complete encryption, storage URL, and wallet connection before minting.', type: 'warning', duration: 4000 })
      return
    }

    console.log('[handleMintControlToken] Starting CT mint process...')
    try {
      console.log('[handleMintControlToken] Creating payload with:', { ctBlobHash, ctHintURL, ctEncKeyWrapped })
      const payload = createCTPayload({
        blobHash: ctBlobHash,
        hintURL: ctHintURL ? ctHintURL.trim() : '',
        encKeyWrap: ctEncKeyWrapped,
        meta: { name: uploadedFile?.file?.name || uploadedFile?.name || '' }
      })
      console.log('[handleMintControlToken] Payload created, validating...')
      const validation = validateCTPayload(payload)
      console.log('[handleMintControlToken] Validation result:', validation)
      if (!validation.ok) {
        setCtErrors(validation.errors)
        addNotification({ message: `CT payload invalid: ${validation.errors.join(', ')}`, type: 'error', duration: 5000 })
        return
      }

      setCtErrors([])
      setCtMinting(true)
      addNotification({ message: 'Requesting wallet to mint Control Token…', type: 'info', duration: 4000 })

      console.log('[handleMintControlToken] Calling mintControlToken...')
      const result = await mintControlToken({
        blobHash: ctBlobHash,
        encKeyWrap: ctEncKeyWrapped,
        hintURL: ctHintURL ? ctHintURL.trim() : '',
        description: 'Mint Nullify Control Token'
      })

      if (!result?.txid) {
        throw new Error('Wallet did not return a transaction id')
      }

      const nextOutpoint = result.ctOutpoint || { txid: result.txid, vout: 0 }
      const artifacts = result.artifacts || null
      const broadcast = result.broadcast || (result.response?.outputs?.[0]?.lockingScript
        ? {
            txid: result.txid || null,
            lockingScriptHex: result.response.outputs[0].lockingScript,
            satoshis: result.response.outputs[0].satoshis || 0,
            vout: nextOutpoint?.vout ?? 0
          }
        : null)
      setCtMintResult({
        txid: result.txid,
        rawtx: result.response?.rawtx || result.response?.rawTx || null,
        outputs: Array.isArray(result.response?.outputs) ? result.response.outputs : null,
        artifacts,
        broadcast
      })
      setCtArtifacts(artifacts)
      setCtBroadcast(broadcast)
      setCtOutpoint(nextOutpoint)
      addNotification({ message: `Control Token minted: ${result.txid.slice(0, 8)}…`, type: 'success', duration: 5000 })
      onMint?.({ txid: result.txid, outpoint: nextOutpoint, result })
    } catch (err) {
      console.error('[handleMintControlToken] Error:', err)
      addNotification({ message: `CT mint failed: ${err.message}`, type: 'error', duration: 6000 })
    } finally {
      console.log('[handleMintControlToken] Finished, setting ctMinting to false')
      setCtMinting(false)
    }
  }, [addNotification, canMintCT, ctBlobHash, ctEncKeyWrapped, ctHintURL, onMint, uploadedFile])

  const handleBurnControlToken = useCallback(async () => {
    if (!ctOutpoint?.txid) {
      addNotification({ message: 'No Control Token to burn', type: 'warning', duration: 4000 })
      return
    }

    if (typeof window !== 'undefined') {
      const confirmed = window.confirm('⚠️ PERMANENT: Burning the Control Token will revoke ALL Data Tokens forever. Continue?')
      if (!confirmed) return
    }

    try {
      addNotification({ message: 'Burning Control Token...', type: 'info', duration: 3000 })
      const result = await burnControlToken({
        ctTxid: ctOutpoint.txid,
        ctVout: ctOutpoint.vout || 0,
        broadcast: ctBroadcast || ctMintResult?.broadcast || null,
        artifacts: ctArtifacts || ctMintResult?.artifacts || null
      })

      if (!result?.burnTxid) {
        throw new Error('Burn transaction failed')
      }

      setCtMintResult(null)
      setCtArtifacts(null)
      setCtBroadcast(null)
      setCtOutpoint(null)
      addNotification({ message: `Control Token burned! Txid: ${result.burnTxid.slice(0, 8)}...`, type: 'success', duration: 5000 })
      onBurn?.()
    } catch (err) {
      addNotification({ message: `Burn failed: ${err.message}`, type: 'error', duration: 6000 })
    }
  }, [addNotification, ctOutpoint, onBurn])

  const resetControlTokenState = useCallback(() => {
    setCtHintURL('')
    setCtEncKeyWrapped('')
    setCtBlobHash('')
    setCtPreview('')
    setCtErrors([])
    setCtMintResult(null)
    setCtArtifacts(null)
    setCtBroadcast(null)
    setCtOutpoint(null)
  }, [])

  return {
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
    setCtArtifacts,
    setCtMintResult,
    ctOutpoint,
    setCtOutpoint,
    canMintCT,
    buildCtPreview,
    handleMintControlToken,
    handleBurnControlToken,
    resetControlTokenState
  }
}
