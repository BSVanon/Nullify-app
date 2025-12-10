import { useCallback, useState } from 'react'
import { createDTPayload, validateDTPayload } from '../../lib/token/dt.js'
import { validateRecipients } from '../../lib/validation.js'
import { mintDataTokens } from '../../lib/wallet/actions.js'
import { redeemDataToken, verifyControlToken } from '../../lib/wallet/tokenRedemption.js'

export default function useDataTokenManager({ addNotification }) {
  const [dtMode, setDtMode] = useState('outpoint')
  const [dtCtTxid, setDtCtTxid] = useState('')
  const [dtCtVout, setDtCtVout] = useState(0)
  const [dtRecipient, setDtRecipient] = useState('')
  const [dtPermissions, setDtPermissions] = useState('read-only')
  const [dtPreview, setDtPreview] = useState('')
  const [dtErrors, setDtErrors] = useState([])
  const [dtMinting, setDtMinting] = useState(false)
  const [dtMintResult, setDtMintResult] = useState(null)
  const [dtArtifacts, setDtArtifacts] = useState(null)
  const [dtBroadcast, setDtBroadcast] = useState(null)
  const [dtRedeeming, setDtRedeeming] = useState(false)
  const [dtRedeemResult, setDtRedeemResult] = useState(null)
  const [ctStatus, setCtStatus] = useState(null)
  const [dtRawKeyBase64, setDtRawKeyBase64] = useState('')

  const buildDtPreview = useCallback(() => {
    try {
      const payload = createDTPayload({
        mode: dtMode,
        ctTxid: dtMode === 'outpoint' ? dtCtTxid : '',
        ctVout: Number(dtCtVout),
        recipient: dtRecipient,
        permissions: dtPermissions,
        meta: {},
        wrappedKey: '<wrapped per recipient on mint>'
      })
      const validation = validateDTPayload(payload)
      setDtErrors(validation.ok ? [] : validation.errors)
      setDtPreview(JSON.stringify(payload, null, 2))
      addNotification({
        message: validation.ok ? 'DT payload looks valid' : 'DT payload has issues; see below',
        type: validation.ok ? 'success' : 'error',
        duration: validation.ok ? 2500 : 4000
      })
    } catch (err) {
      setDtErrors([String(err?.message || err)])
      setDtPreview('')
    }
  }, [addNotification, dtCtTxid, dtCtVout, dtMode, dtPermissions, dtRecipient])

  const resetDtState = useCallback(() => {
    setDtMode('outpoint')
    setDtCtTxid('')
    setDtCtVout(0)
    setDtRecipient('')
    setDtPermissions('read-only')
    setDtPreview('')
    setDtErrors([])
    setDtMintResult(null)
    setDtArtifacts(null)
    setDtBroadcast(null)
    setDtRedeeming(false)
    setDtRedeemResult(null)
    setCtStatus(null)
    setDtRawKeyBase64('')
  }, [])

  const handleMintDataTokens = useCallback(async () => {
    console.log('[handleMintDataTokens] Called')
    console.log('[handleMintDataTokens] dtCtTxid:', dtCtTxid)
    console.log('[handleMintDataTokens] dtRecipient:', dtRecipient)
    
    if (!dtCtTxid) {
      console.log('[handleMintDataTokens] No CT txid, aborting')
      addNotification({ message: 'Mint Control Token first to get txid', type: 'warning', duration: 4000 })
      return
    }
    if (!dtRecipient) {
      console.log('[handleMintDataTokens] No recipient, aborting')
      addNotification({ message: 'Enter recipient address or public key', type: 'warning', duration: 4000 })
      return
    }

    console.log('[handleMintDataTokens] Validating recipient...')
    const validation = validateRecipients(dtRecipient)
    console.log('[handleMintDataTokens] Validation result:', validation)
    
    if (!validation.valid) {
      console.log('[handleMintDataTokens] Validation failed')
      validation.errors.forEach(err => addNotification({ message: err, type: 'error', duration: 4000 }))
      return
    }

    const nonPubkey = validation.recipients.filter(r => r.type !== 'pubkey')
    if (nonPubkey.length > 0) {
      addNotification({ message: 'Only identity public keys are supported for DT recipients. Convert addresses to pubkeys first.', type: 'error', duration: 6000 })
      return
    }

    if (!dtRawKeyBase64) {
      addNotification({ message: 'Encryption key not available. Re-run encryption step.', type: 'error', duration: 5000 })
      return
    }

    try {
      console.log('[handleMintDataTokens] Starting DT mint...')
      setDtMinting(true)
      addNotification({ message: 'Minting Data Tokens...', type: 'info', duration: 3000 })

      const recipients = validation.recipients.map(r => r.value)
      const result = await mintDataTokens({
        ctTxid: dtCtTxid,
        ctVout: Number(dtCtVout),
        recipients,
        permissions: dtPermissions,
        rawKeyBase64: dtRawKeyBase64
      })

      if (!result?.txid) {
        throw new Error('No transaction ID returned')
      }

      setDtMintResult(result)
      setDtArtifacts(result.artifacts || null)
      setDtBroadcast(result.broadcast || null)
      setDtRecipient('')
      addNotification({ message: `Data Tokens minted: ${result.txid.slice(0, 8)}...`, type: 'success', duration: 5000 })
    } catch (err) {
      addNotification({ message: `DT mint failed: ${err.message}`, type: 'error', duration: 6000 })
    } finally {
      setDtMinting(false)
    }
  }, [addNotification, dtCtTxid, dtCtVout, dtPermissions, dtRecipient, dtRawKeyBase64])

  const handleRedeemDataToken = useCallback(async ({
    identityPrivateKey,
    storageUrlOverride,
    fileName,
    ctArtifacts,
    dtArtifactsOverride,
    ctBroadcast,
    dtBroadcastOverride
  }) => {
    if (!dtMintResult?.txid) {
      addNotification({ message: 'Mint a Data Token first', type: 'warning', duration: 4000 })
      return
    }
    if (!identityPrivateKey) {
      addNotification({ message: 'Provide wallet private key (WIF or hex) to decrypt', type: 'error', duration: 6000 })
      return
    }

    try {
      setDtRedeeming(true)
      addNotification({ message: 'Redeeming Data Token...', type: 'info', duration: 3000 })

      const outpoint = Array.isArray(dtMintResult?.dtOutpoints) ? dtMintResult.dtOutpoints[0] : null
      const resolvedVout = typeof outpoint?.vout === 'number' ? outpoint.vout : 0

      const nextDtArtifacts = dtArtifactsOverride || dtArtifacts || dtMintResult?.artifacts || null
      const combinedArtifacts = (ctArtifacts || nextDtArtifacts)
        ? {
            ct: ctArtifacts || null,
            dt: nextDtArtifacts
          }
        : null

      const nextDtBroadcast = dtBroadcastOverride || dtBroadcast || dtMintResult?.broadcast || null
      const nextCtBroadcast = ctBroadcast || null
      const combinedBroadcast = (nextCtBroadcast || nextDtBroadcast)
        ? {
            ct: nextCtBroadcast,
            dt: nextDtBroadcast
          }
        : null

      const redeem = await redeemDataToken({
        ctTxid: dtCtTxid,
        ctVout: Number(dtCtVout),
        dtTxid: dtMintResult.txid,
        dtVout: resolvedVout,
        identityPrivateKey,
        storageUrlOverride,
        fileName,
        artifacts: combinedArtifacts,
        broadcast: combinedBroadcast
      })

      setDtRedeemResult(redeem)
      addNotification({ message: 'Data Token redeemed. Download ready.', type: 'success', duration: 4000 })
    } catch (err) {
      console.error('[handleRedeemDataToken] Failed', err)
      addNotification({ message: `Redeem failed: ${err.message}`, type: 'error', duration: 6000 })
    } finally {
      setDtRedeeming(false)
    }
  }, [addNotification, dtCtTxid, dtCtVout, dtMintResult])

  const handleVerifyControlToken = useCallback(async () => {
    if (!dtCtTxid) {
      addNotification({ message: 'Provide CT txid to verify', type: 'warning', duration: 4000 })
      return
    }
    try {
      setCtStatus(null)
      const result = await verifyControlToken({ ctTxid: dtCtTxid, ctVout: Number(dtCtVout) })
      setCtStatus(result)
      addNotification({ message: `CT status: ${result.status}`, type: result.status === 'active' ? 'success' : 'warning', duration: 4000 })
    } catch (err) {
      addNotification({ message: `CT verification failed: ${err.message}`, type: 'error', duration: 6000 })
    }
  }, [addNotification, dtCtTxid, dtCtVout])

  return {
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
    setDtArtifacts,
    setDtBroadcast,
    setDtMintResult,
    dtRedeeming,
    dtRedeemResult,
    ctStatus,
    dtRawKeyBase64,
    setDtRawKeyBase64,
    buildDtPreview,
    handleMintDataTokens,
    handleRedeemDataToken,
    handleVerifyControlToken,
    resetDtState
  }
}
