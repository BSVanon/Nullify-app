const listenersByThread = new Map()

function ensureThread(threadId) {
  if (!listenersByThread.has(threadId)) {
    listenersByThread.set(threadId, new Set())
  }
  return listenersByThread.get(threadId)
}

function dispatch(threadId, event) {
  const listeners = listenersByThread.get(threadId)
  if (!listeners) return
  listeners.forEach((handler) => {
    try {
      handler(event)
    } catch (error) {
      console.error('[overlayStub] listener error', error)
    }
  })
}

export function createOverlayClientStub() {
  return {
    mode: 'stub',
    subscribe(threadId, handler) {
      if (!threadId || typeof handler !== 'function') return () => {}
      const set = ensureThread(threadId)
      set.add(handler)
      return () => set.delete(handler)
    },
    publishMessage(threadId, payload) {
      if (!threadId) return
      dispatch(threadId, { type: 'message', payload })
      const messageId = payload?.id
      if (messageId) {
        setTimeout(() => {
          dispatch(threadId, {
            type: 'ack',
            payload: {
              messageId,
              delivery: payload?.delivery === 'failed' ? 'failed' : 'delivered',
              ackedAt: new Date().toISOString()
            }
          })
        }, 50)
      }
    },
    publishAck(threadId, payload) {
      if (!threadId) return
      dispatch(threadId, { type: 'ack', payload })
    },
    publishControl(threadId, payload) {
      if (!threadId) return
      dispatch(threadId, { type: 'control', payload })
    },
    publishTyping(threadId, payload) {
      if (!threadId) return
      dispatch(threadId, { type: 'typing', payload })
    },
    close() {
      listenersByThread.clear()
    }
  }
}

export const overlayClient = createOverlayClientStub()
