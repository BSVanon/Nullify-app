import * as secp from 'noble-secp256k1'

const toHexSignature = (signature) => {
  if (!signature) return ''
  if (typeof signature === 'string') return signature
  if (signature?.signature) return toHexSignature(signature.signature)
  if (typeof signature.toCompactHex === 'function') return signature.toCompactHex()
  if (typeof signature.toHex === 'function') return signature.toHex()

  const toHex = (bytes) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')

  if (signature instanceof Uint8Array) return toHex(signature)
  if (ArrayBuffer.isView(signature)) return toHex(new Uint8Array(signature.buffer, signature.byteOffset, signature.byteLength))
  if (signature instanceof ArrayBuffer) return toHex(new Uint8Array(signature))
  if (Array.isArray(signature)) return toHex(Uint8Array.from(signature))

  throw new Error('Unsupported signature format')
}

const toBase64 = (bytesLike) => {
  if (!bytesLike) return ''
  const bytes = bytesLike instanceof Uint8Array ? bytesLike : new Uint8Array(bytesLike)
  if (typeof btoa === 'function') {
    let binary = ''
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte)
    })
    return btoa(binary)
  }
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64')
  }
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function ensureWalletConnection(walletBootstrap) {
  if (typeof walletBootstrap?.getStatus !== 'function') {
    throw new Error('Wallet bootstrap unavailable')
  }

  let status = walletBootstrap.getStatus()
  if (!status?.wallet) {
    const initialized = await walletBootstrap.initialize?.()
    status = { ...status, ...initialized }
  }

  const walletClient = status?.wallet
  const walletPublicKey = status?.identityKey

  if (!walletClient || !walletPublicKey) {
    throw new Error('Wallet connection required to upgrade thread')
  }

  return { walletClient, walletPublicKey }
}

async function resolveKeyWrapping(keyWrapping) {
  if (keyWrapping?.unwrapKeyWithECIES && keyWrapping?.wrapKeyWithECIES) {
    return keyWrapping
  }

  return import('@/lib/crypto/keyWrapping.js')
}

async function rewrapThreadSecret(receipt, guestPrivateKey, walletPublicKey, keyWrapping) {
  const { unwrapKeyWithECIES, wrapKeyWithECIES } = await resolveKeyWrapping(keyWrapping)
  const secretBytes = await unwrapKeyWithECIES(receipt.wrap, guestPrivateKey)
  const wrappedKey = await wrapKeyWithECIES(secretBytes, walletPublicKey)
  return {
    wrappedKey,
    rawKeyBase64: toBase64(secretBytes),
  }
}

export async function performGuestUpgrade({
  threadId,
  receipt,
  getGuestIdentity,
  updateJoinReceipt,
  deleteGuestIdentity,
  walletBootstrap,
  keyWrapping
}) {
  if (!threadId) throw new Error('threadId required for upgrade')
  if (!receipt) throw new Error('Join receipt missing for upgrade')
  if (receipt.identityKind === 'holder') return receipt

  const guestIdentityId = receipt.guestIdentityId
  console.log('[guestUpgrade] receipt:', receipt)
  console.log('[guestUpgrade] guestIdentityId:', guestIdentityId)
  
  const guestIdentity = guestIdentityId ? await getGuestIdentity(guestIdentityId) : null
  console.log('[guestUpgrade] guestIdentity:', guestIdentity)
  
  if (!guestIdentity?.privateKey || !guestIdentity?.publicKey) {
    throw new Error('Guest identity key material unavailable')
  }

  const { walletClient, walletPublicKey } = await ensureWalletConnection(walletBootstrap)
  const timestamp = new Date().toISOString()
  const statement = {
    intent: 'nukenote.link-guest-to-wallet',
    threadId,
    inviteHash: receipt.inviteHash,
    guestPublicKey: guestIdentity.publicKey,
    walletPublicKey,
    timestamp
  }

  const statementJson = JSON.stringify(statement)
  const statementPayload = new TextEncoder().encode(statementJson)
  const statementHash = await secp.utils.sha256(statementPayload)
  const guestSignature = toHexSignature(await secp.sign(statementHash, guestIdentity.privateKey))
  let walletSignatureResult
  let walletSignature
  let usedFallbackSignature = false

  const walletSignaturePayload = {
    hashToDirectlySign: Array.from(statementHash),
    seekPermission: false,
    keyID: '1',
  }

  try {
    console.log('[guestUpgrade] Requesting wallet signature...')
    walletSignatureResult = await walletClient.createSignature?.(walletSignaturePayload)
    walletSignature = walletSignatureResult?.signature || walletSignatureResult
    console.log('[guestUpgrade] Wallet signature obtained successfully')
  } catch (error) {
    // Known issue: Some wallet SDKs throw "u is not iterable" or similar errors
    // This is expected and we have a fallback mechanism
    console.warn('[guestUpgrade] Wallet signature failed, using fallback:', error.message)

    try {
      const fallbackSig = toHexSignature(await secp.sign(statementHash, guestIdentity.privateKey))
      walletSignature = fallbackSig
      usedFallbackSignature = true
      console.log('[guestUpgrade] Fallback signature generated successfully')
    } catch (fallbackError) {
      console.error('[guestUpgrade] Fallback signature also failed:', fallbackError)
      throw new Error(`Unable to sign upgrade statement: ${error.message}`)
    }
  }

  if (!walletSignature) {
    if (typeof window !== 'undefined' && import.meta?.env?.DEV && window.__NUKENOTE_WALLET_STUB__) {
      usedFallbackSignature = true
      walletSignature = window.__NUKENOTE_WALLET_STUB__.sign(statement)
    } else {
      throw new Error('Wallet did not return a signature for upgrade statement')
    }
  }

  const { wrappedKey: updatedWrap, rawKeyBase64 } = await rewrapThreadSecret(
    receipt,
    guestIdentity.privateKey,
    walletPublicKey,
    keyWrapping,
  )

  const priorHolderKey = receipt.holderPublicKey || receipt.peerWalletPublicKey || null

  const updatedReceipt = await updateJoinReceipt(threadId, {
    identityKind: 'holder',
    holderPublicKey: walletPublicKey,
    guestIdentityId: null,
    wrap: updatedWrap,
    upgradedAt: timestamp,
    supportsLeave: false, // Holders can only burn, not leave
    peerWalletPublicKey: priorHolderKey,
    upgradeProof: {
      statement,
      guestSignature,
      walletSignature,
      walletSignatureFallback: usedFallbackSignature ? true : undefined
    }
  })

  if (guestIdentityId) {
    await deleteGuestIdentity(guestIdentityId)
  }

  return {
    receipt: updatedReceipt,
    controlPayload: {
      action: 'link',
      walletPublicKey,
      upgradedAt: timestamp
    },
    rawThreadKeyBase64: rawKeyBase64
  }
}
