import { useEffect } from 'react'

import { safetyNumber, compareSafetyNumbers } from '@/lib/identity/safetyNumber.js'

/**
 * Core detection routine (pure) so it can be unit-tested without React.
 */
export async function detectSafetyNumberChanges({
  contacts,
  conversations,
  messagesByThread,
  sendMessage,
  upsertContact,
}) {
  if (!contacts || !conversations || conversations.length === 0) return

  const entries = Object.entries(contacts)
  if (!entries.length) return

  for (const [pubkey, contact] of entries) {
    if (!contact || !contact.verified || !contact.verifiedSafetyNumber) continue

    let currentSafety
    try {
      currentSafety = safetyNumber(pubkey)
    } catch (error) {
      console.warn('[useSafetyNumberChangeWarnings] Failed to compute safety number for contact', {
        pubkey: pubkey.slice(0, 16) + '...',
        error: error?.message,
      })
      continue
    }

    const expectedSafety = contact.verifiedSafetyNumber
    if (compareSafetyNumbers(currentSafety, expectedSafety)) {
      continue
    }

    // Safety number changed for a previously verified contact on this device.
    // De-verify locally and emit a SAFETY_CHANGED system message per affected thread.
    try {
      await upsertContact(pubkey, {
        verified: false,
        verifiedSafetyNumber: null,
        lastVerifiedSafetyNumber: expectedSafety,
      })
    } catch (error) {
      console.warn('[useSafetyNumberChangeWarnings] Failed to update contact after safety-number change', error)
    }

    const affectedConversations = conversations.filter((conversation) => {
      if (!conversation?.peerPublicKey) return false
      try {
        return conversation.peerPublicKey.toLowerCase() === pubkey.toLowerCase()
      } catch {
        return false
      }
    })

    for (const conversation of affectedConversations) {
      const threadId = conversation.id
      if (!threadId) continue

      const existingMessages = messagesByThread[threadId] || []
      const alreadyHasWarning = existingMessages.some(
        (message) =>
          typeof message?.text === 'string' &&
          message.text.startsWith('[SAFETY_CHANGED]'),
      )
      if (alreadyHasWarning) continue

      const authorKey = conversation.selfPublicKey || 'self'

      try {
        await sendMessage(threadId, { author: authorKey, text: '[SAFETY_CHANGED]' })
      } catch (error) {
        console.warn('[useSafetyNumberChangeWarnings] Failed to post safety-changed system message', error)
      }
    }
  }
}

/**
 * useSafetyNumberChangeWarnings
 *
 * Detects safety-number changes for verified contacts on this device and posts
 * loud [SAFETY_CHANGED] system messages into affected threads.
 */
export function useSafetyNumberChangeWarnings(args) {
  useEffect(() => {
    detectSafetyNumberChanges(args)
  }, [
    args.contacts,
    args.conversations,
    args.messagesByThread,
    args.sendMessage,
    args.upsertContact,
  ])
}
