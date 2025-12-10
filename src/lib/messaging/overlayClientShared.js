export const DEFAULT_RETRY_DELAYS = [2000, 5000, 10000]
export const HEARTBEAT_INTERVAL_MS = 30_000

export function notify(handler, status, extra) {
  if (typeof handler === 'function') handler({ status, ...extra })
}
