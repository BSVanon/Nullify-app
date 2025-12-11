/**
 * Contacts Store
 * 
 * Local storage for contact information (certificates, ProfileCards, nicknames, verification status).
 * Persisted to LocalForage.
 */

import localforage from 'localforage'
import { safetyNumber } from './safetyNumber.js'

const CONTACTS_KEY = 'nullify:contacts'

// In-memory cache
let contactsCache = null

// Event listeners for contact changes
const contactChangeListeners = new Set()

/**
 * Load contacts from storage
 * @returns {Promise<Object>} ContactsIndex (pubkey -> Contact)
 */
async function loadContacts() {
  if (contactsCache) {
    return contactsCache
  }

  try {
    const stored = await localforage.getItem(CONTACTS_KEY)
    contactsCache = stored || {}
    console.log('[contactsStore] Loaded', Object.keys(contactsCache).length, 'contacts')
    return contactsCache
  } catch (error) {
    console.error('[contactsStore] Failed to load contacts:', error)
    contactsCache = {}
    return contactsCache
  }
}

/**
 * Save contacts to storage
 * @param {Object} contacts - ContactsIndex
 * @returns {Promise<void>}
 */
async function saveContacts(contacts) {
  try {
    await localforage.setItem(CONTACTS_KEY, contacts)
    contactsCache = contacts
    console.log('[contactsStore] Saved', Object.keys(contacts).length, 'contacts')
  } catch (error) {
    console.error('[contactsStore] Failed to save contacts:', error)
    throw error
  }
}

/**
 * Get a contact by public key
 * @param {string} pubkey - Hex-encoded public key
 * @returns {Promise<Object|null>} Contact or null
 */
export async function getContact(pubkey) {
  if (!pubkey) return null
  const contacts = await loadContacts()
  return contacts[pubkey.toLowerCase()] || null
}

/**
 * Upsert a contact (create or update)
 * 
 * Contacts are keyed by public key, which naturally deduplicates:
 * - Wallet holders have a single identity key across all threads
 * - Guests have ephemeral keys per thread (so each guest thread = separate contact)
 * 
 * @param {string} pubkey - Hex-encoded public key
 * @param {Object} patch - Partial contact data to merge
 * @returns {Promise<Object>} Updated contact
 */
export async function upsertContact(pubkey, patch) {
  if (!pubkey) {
    throw new Error('pubkey is required')
  }

  // Normalize pubkey to lowercase to prevent case-sensitivity duplicates
  const normalizedPubkey = pubkey.toLowerCase()

  const contacts = await loadContacts()
  const existing = contacts[normalizedPubkey] || {
    kind: 'guest',
    verified: false,
    safetyNumber: safetyNumber(normalizedPubkey),
    verifiedSafetyNumber: null,
    verifiedAt: null
  }

  const updated = {
    ...existing,
    ...patch,
    lastSeen: new Date().toISOString()
  }

  contacts[normalizedPubkey] = updated
  await saveContacts(contacts)
  
  // Notify listeners of contact change
  contactChangeListeners.forEach(listener => listener(pubkey))

  console.log('[contactsStore] Upserted contact:', {
    pubkey: pubkey.slice(0, 16) + '...',
    kind: updated.kind,
    verified: updated.verified,
    nickname: updated.nickname,
    displayName: updated.displayName,
    source: updated.source,
    hasCard: !!updated.card,
    hasCert: !!updated.certificate
  })

  return updated
}

/**
 * Subscribe to contact changes
 * @param {Function} listener - Callback(pubkey)
 * @returns {Function} Unsubscribe function
 */
export function onContactChange(listener) {
  contactChangeListeners.add(listener)
  return () => contactChangeListeners.delete(listener)
}

/**
 * Delete a contact
 * @param {string} pubkey - Hex-encoded public key
 * @returns {Promise<void>}
 */
export async function deleteContact(pubkey) {
  if (!pubkey) return
  const normalizedPubkey = pubkey.toLowerCase()
  const contacts = await loadContacts()
  delete contacts[normalizedPubkey]
  await saveContacts(contacts)
  console.log('[contactsStore] Deleted contact:', normalizedPubkey.slice(0, 16) + '...')
}

/**
 * Get all contacts
 * @returns {Promise<Object>} ContactsIndex
 */
export async function getAllContacts() {
  return await loadContacts()
}

/**
 * Clear contacts cache (for testing)
 */
export function clearContactsCache() {
  contactsCache = null
}
