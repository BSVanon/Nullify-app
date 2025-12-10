import { useEffect, useMemo } from 'react'

const DRAFT_STORAGE_KEY = 'nukenote.draft'

export function useWorkflowDraftPersistence({
  draftState,
  restoreHandlers,
  dependencies
}) {
  const persistableState = useMemo(
    () => ({
      storageUrl: draftState.storageUrl,
      ctHintURL: draftState.ctHintURL,
      ctEncKeyWrapped: draftState.ctEncKeyWrapped,
      ctBlobHash: draftState.ctBlobHash,
      encryptedPayloadBase64: draftState.encryptedPayloadBase64,
      dtMode: draftState.dtMode,
      dtCtTxid: draftState.dtCtTxid,
      dtCtVout: draftState.dtCtVout,
      dtRecipient: draftState.dtRecipient,
      dtPermissions: draftState.dtPermissions,
      ctMintResult: draftState.ctMintResult,
      ctArtifacts: draftState.ctArtifacts,
      ctOutpoint: draftState.ctOutpoint,
      ctBroadcast: draftState.ctBroadcast,
      ctMinting: draftState.ctMinting,
      dtMintResult: draftState.dtMintResult,
      dtArtifacts: draftState.dtArtifacts,
      dtBroadcast: draftState.dtBroadcast
    }),
    [
      draftState.storageUrl,
      draftState.ctHintURL,
      draftState.ctEncKeyWrapped,
      draftState.ctBlobHash,
      draftState.encryptedPayloadBase64,
      draftState.dtMode,
      draftState.dtCtTxid,
      draftState.dtCtVout,
      draftState.dtRecipient,
      draftState.dtPermissions,
      draftState.ctMintResult,
      draftState.ctArtifacts,
      draftState.ctOutpoint,
      draftState.ctBroadcast,
      draftState.ctMinting,
      draftState.dtMintResult,
      draftState.dtArtifacts,
      draftState.dtBroadcast
    ]
  )

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      restoreHandlers.onRestore(parsed)
    } catch (error) {
      console.warn('Failed to restore draft state', error)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(persistableState))
    } catch (error) {
      console.warn('Failed to persist draft state', error)
    }
  }, [persistableState, ...(dependencies || [])])
}
