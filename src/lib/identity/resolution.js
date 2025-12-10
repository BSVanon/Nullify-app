/**
 * Identity Resolution
 * 
 * Core logic for resolving identities from certificates, ProfileCards, or fallback names.
 * Handles both wallet holders and guests.
 */

import { discoverHolderProfile, isCertificateVerified } from './certificates.js'
import { fallbackNameFromPubKey, colorSeedFromPubKey } from './fallbackName.js'
import { getContact } from './contactsStore.js'

/**
 * Resolve an identity from all available sources
 * @param {string} pubkey - Hex-encoded public key
 * @param {'holder'|'guest'} kind - Type of identity
 * @returns {Promise<Object>} Identity object
 */
export async function resolveIdentity(pubkey, kind) {
  if (!pubkey) {
    throw new Error('pubkey is required')
  }

  console.log('[resolution] Resolving identity:', { pubkey: pubkey.slice(0, 16) + '...', kind })

  // 1. Check local contact first
  const contact = await getContact(pubkey)
  console.log('[resolution] Contact data:', { 
    pubkey: pubkey.slice(0, 16) + '...', 
    verified: contact?.verified, 
    nickname: contact?.nickname,
    displayName: contact?.displayName,
    hasCard: !!contact?.card 
  })
  
  // 2. Nickname override (HIGHEST priority - overrides everything)
  if (contact?.nickname) {
    const identity = {
      name: contact.nickname,
      avatar: contact.card?.avatarHash || null,
      verified: contact.verified || false,
      colorSeed: contact.card?.colorSeed || colorSeedFromPubKey(pubkey),
      source: 'nickname'
    }
    console.log('[resolution] Resolved from nickname:', identity)
    return identity
  }
  
  // 3. Try certificate/profile (holders only)
  if (kind === 'holder') {
    try {
      const cert = await discoverHolderProfile(pubkey)
      if (cert && cert.fields) {
        const identity = {
          name: cert.fields.displayName || fallbackNameFromPubKey(pubkey),
          avatar: cert.fields.avatarHash || null,
          verified: contact?.verified || false,
          colorSeed: colorSeedFromPubKey(pubkey),
          source: 'certificate'
        }
        console.log('[resolution] Resolved from profile store:', identity)
        return identity
      }
    } catch (error) {
      console.warn('[resolution] Certificate discovery failed:', error.message)
    }
  }

  // 4. Check for ProfileCard (guests)

  // ProfileCard (guests)
  if (contact?.card) {
    return {
      name: contact.card.displayName,
      avatar: contact.card.avatarHash || null,
      verified: contact.verified || false,
      colorSeed: contact.card.colorSeed || colorSeedFromPubKey(pubkey),
      source: 'profileCard'
    }
  }

  // 3. Fallback: deterministic name
  //    Respect contact.verified so safety-number verification shows up even
  //    when there is no nickname or profile card.
  return {
    name: fallbackNameFromPubKey(pubkey),
    avatar: null,
    verified: Boolean(contact?.verified),
    colorSeed: colorSeedFromPubKey(pubkey),
    source: 'fallback'
  }
}

/**
 * Get display name for a thread (custom label or peer identity)
 * @param {Object} thread - Thread metadata
 * @param {string} myPubKey - Current user's public key
 * @returns {Promise<string>} Display name
 */
export async function getThreadDisplayName(thread, myPubKey) {
  if (!thread) {
    return 'New Thread'
  }

  // 1. Custom label (highest priority)
  if (thread.customLabel) {
    return thread.customLabel
  }

  // 2. Peer identity
  const peer = thread.participants?.find(p => p !== myPubKey)
  if (peer) {
    const identity = await resolveIdentity(peer, thread.peerKind || 'guest')
    return identity.name
  }

  // 3. Generic fallback
  return 'New Thread'
}
