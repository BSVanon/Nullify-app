export function createMessageBoxOverlayClient({ host, walletClient, identity, onStatus, logger }) {
  const log = logger ?? console
  const notify = typeof onStatus === 'function' ? onStatus : () => {}

  if (!host) {
    log.warn('[messagebox] Host not configured; skipping MessageBox overlay')
    notify({ status: 'unavailable', reason: 'missing-host' })
    return null
  }

  if (!walletClient) {
    log.warn('[messagebox] Wallet client unavailable; skipping MessageBox overlay')
    notify({ status: 'unavailable', reason: 'missing-wallet' })
    return null
  }

  if (!identity?.publicKey) {
    log.warn('[messagebox] Identity public key missing; skipping MessageBox overlay')
    notify({ status: 'unavailable', reason: 'missing-identity' })
    return null
  }

  log.info('[messagebox] Overlay integration pending – falling back to websocket transport')
  notify({ status: 'unavailable', reason: 'not-implemented' })

  return null
}
