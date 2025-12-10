const listeners = new Set()

export function emitTelemetry(event) {
  if (!event || typeof event !== 'object') return
  listeners.forEach((listener) => {
    try {
      listener(event)
    } catch (error) {
      console.warn('[remoteTelemetry] listener error', error)
    }
  })
}

export function subscribeTelemetry(listener) {
  if (typeof listener !== 'function') return () => {}
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
