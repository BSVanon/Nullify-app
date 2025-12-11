import { sendThreadInvite } from '@/lib/messaging/messageBoxService.js'

/**
 * Send a thread invite to a contact, preferring MessageBox delivery
 * and falling back to copying the invite link to the clipboard.
 *
 * This is a pure helper with no React dependencies. All side effects
 * (notifications) are passed in via callbacks.
 */
export async function sendInviteToContact({
  walletClient,
  inviteDialogThread,
  inviteLink,
  contactPubkey,
  contact,
  notifyUser,
}) {
  if (!inviteDialogThread || !contactPubkey) return

  const contactName = contact?.name || 'your contact'

  // Prefer sending via MessageBox when wallet client and link are available
  if (walletClient && inviteLink) {
    try {
      const result = await sendThreadInvite({
        walletClient,
        recipientPubKey: contactPubkey,
        threadId: inviteDialogThread,
        inviteUrl: inviteLink,
        senderName: 'Nullify User', // TODO: use actual profile name
      })

      if (result.success) {
        notifyUser?.(
          'success',
          `Invite sent to ${contactName} via MessageBox! They'll receive it in their wallet.`,
        )
        return
      }

      console.warn('[sendInviteToContact] MessageBox send failed, falling back to clipboard:', result.error)
    } catch (error) {
      console.warn('[sendInviteToContact] MessageBox unavailable, falling back to clipboard:', error)
    }
  }

  // Fallback: copy to clipboard when possible
  try {
    if (inviteLink) {
      await navigator.clipboard.writeText(inviteLink)
      notifyUser?.('success', `Invite link copied! Share it with ${contactName} to connect.`)
    } else {
      notifyUser?.('error', 'No invite link available. Try regenerating.')
    }
  } catch (error) {
    console.error('[sendInviteToContact] Failed to copy invite for contact', error)
    notifyUser?.('error', 'Failed to copy invite link')
  }
}
