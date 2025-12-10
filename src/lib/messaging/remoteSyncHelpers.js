import { CONFIG } from '@/lib/config'
import { ensureRemoteMessagingClient } from '@/lib/messaging/remoteClient'

export function isRemoteSyncEnabled() {
  return Boolean(CONFIG.REMOTE_MESSAGING_ENABLED && CONFIG.REMOTE_MESSAGING_API_URL)
}

export function scheduleRemoteSync(task) {
  if (!isRemoteSyncEnabled()) return
  if (typeof task !== 'function') return

  Promise.resolve()
    .then(async () => {
      const client = await ensureRemoteMessagingClient()
      if (!client) return
      await task(client)
    })
    .catch((error) => {
      console.warn('[storage] remote sync task failed', error)
    })
}
