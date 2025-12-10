import { CONFIG } from '@/lib/config'
import { overlayClient as stubOverlayClient } from '@/lib/messaging/overlayClientStub'
import { appendOverlayTelemetry } from '@/lib/messaging/storage'
import { emitTelemetry } from '@/lib/messaging/remoteTelemetry'
import { isEnvelopeTrusted } from '@/lib/messaging/overlaySignature'
import { DEFAULT_RETRY_DELAYS, HEARTBEAT_INTERVAL_MS, notify } from '@/lib/messaging/overlayClientShared'

export function createOverlayClient({ endpoint, WebSocketImpl, onStatus, retryDelays, logger } = {}) {
  const target = endpoint ?? CONFIG.OVERLAY_ENDPOINT
  const WS = WebSocketImpl ?? (typeof WebSocket !== 'undefined' ? WebSocket : null)
  const delays = retryDelays ?? DEFAULT_RETRY_DELAYS
  const log = logger ?? console

  let socket = null
  let reconnects = 0

  const recordTelemetry = (kind, data = {}) => {
    const payload = {
      kind,
      timestamp: new Date().toISOString(),
      endpoint: target,
      reconnects,
      readyState: socket?.readyState ?? null,
      ...data,
    }
    try {
      emitTelemetry(payload)
    } catch (err) {
      log.warn?.('[overlay] telemetry emit failed', err)
    }
    appendOverlayTelemetry(payload).catch((error) => {
      log.warn?.('[overlay] telemetry persist failed', error)
    })
    return payload
  }

  if (!target || !WS) {
    const isDev = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV

    if (isDev) {
      // Dev-only: allow in-memory stub transport so local development can proceed
      notify(onStatus, 'stub')
      recordTelemetry('status', { status: 'stub', mode: 'stub' })
      return { ...stubOverlayClient, mode: 'stub', close: () => {}, getStatus: () => 'stub' }
    }

    // Non-dev (MVP/production): do NOT silently simulate delivery.
    // Expose an explicit offline client that no-ops sends and reports an error status.
    const status = 'offline-no-endpoint'
    notify(onStatus, status)
    recordTelemetry('status', { status, mode: 'offline' })

    const offlineClient = {
      mode: 'offline',
      subscribe() {
        // No-op subscription when overlay is unavailable
        return () => {}
      },
      publishMessage(threadId, payload) {
        log.warn?.('[overlay] offline client: dropped message', { threadId, payload })
      },
      publishAck(threadId, payload) {
        log.warn?.('[overlay] offline client: dropped ack', { threadId, payload })
      },
      publishControl(threadId, payload) {
        log.warn?.('[overlay] offline client: dropped control', { threadId, payload })
      },
      publishTyping(threadId, payload) {
        log.warn?.('[overlay] offline client: dropped typing event', { threadId, payload })
      },
      close() {
        // Nothing to close in offline mode
      },
      getStatus() {
        return status
      },
    }

    return offlineClient
  }

  let closed = false
  let reconnecting = false
  let connecting = false
  let currentStatus = 'connecting'
  const subscribers = new Map()
  const queue = []
  let heartbeatTimer = null
  let lastPingAt = null

  const dispatch = (threadId, event) => {
    // Normalize threadId to handle any encoding differences
    const normalizedThreadId = String(threadId || '').trim()
    
    const handlers = subscribers.get(normalizedThreadId)
    if (!handlers || handlers.size === 0) {
      return
    }
    
    handlers.forEach((handler) => {
      try {
        handler(event)
      } catch (error) {
        log.error('[overlay] listener error', error)
      }
    })
  }

  const sendQueued = () => {
    if (!socket || socket.readyState !== WS.OPEN) return
    while (queue.length) {
      const payload = queue.shift()
      try {
        socket.send(JSON.stringify(payload))
      } catch (error) {
        log.error('[overlay] send failed', error)
        queue.unshift(payload)
        socket.close()
        break
      }
    }
  }

  const handleMessage = async (raw) => {
    try {
      const envelope = typeof raw === 'string' ? JSON.parse(raw) : raw
      if (!envelope || typeof envelope !== 'object') return
      
      log.info?.('[overlay] received:', envelope.type || 'unknown', envelope)
      
      // Handle relay control messages (no signature required for relay-originated messages)
      if (envelope.type === 'subscribed') {
        log.info?.(`[overlay] subscribed confirmed for thread ${envelope.threadId}`)
        return
      }
      
      if (envelope.type === 'unsubscribed') {
        log.info?.(`[overlay] unsubscribed confirmed for thread ${envelope.threadId}`)
        return
      }
      
      if (envelope.type === 'delivery') {
        log.info?.(`[overlay] delivery confirmed: ${envelope.subscribers} subscribers`)
        if (envelope.threadId) {
          // Forward only the inner payload (messageId/status/timestamp) to the subscription handler
          // so handleDeliveryEvent can correctly resolve the target message.
          dispatch(envelope.threadId, {
            type: 'delivery',
            payload: envelope.payload || {},
          })
        }
        return
      }
      
      if (envelope.type === 'pong') {
        log.info?.('[overlay] pong received')
        const rttMs = typeof lastPingAt === 'number' ? Date.now() - lastPingAt : null
        recordTelemetry('heartbeat', { rttMs })
        lastPingAt = null
        return
      }
      
      // Handle echo responses from v1 relay (backward compat)
      if (envelope.type === 'echo') {
        log.info?.('[overlay] echo received (v1 relay)')
        return
      }
      
      // SECURITY: Verify signature for user-originated messages
      // Types that require signature verification: message, ack, typing, control
      const requiresVerification = ['message', 'ack', 'typing', 'control'].includes(envelope.type)
      if (requiresVerification && envelope.threadId) {
        const trustResult = await isEnvelopeTrusted(envelope, { requireSignature: false })
        if (!trustResult.trusted) {
          log.warn?.('[overlay] Rejecting untrusted message:', {
            type: envelope.type,
            threadId: envelope.threadId,
            reason: trustResult.reason,
          })
          recordTelemetry('signature_rejected', {
            type: envelope.type,
            threadId: envelope.threadId,
            reason: trustResult.reason,
          })
          return
        }
        
        // Log verification status for debugging
        if (trustResult.reason !== 'NO_SIGNATURE') {
          log.info?.('[overlay] Message signature verified:', trustResult.reason)
        }
      }
      
      // Dispatch message/ack/typing/control to thread subscribers
      if (envelope.threadId) {
        dispatch(envelope.threadId, { type: envelope.type, payload: envelope.payload })
      }
    } catch (error) {
      log.error('[overlay] bad message', error)
    }
  }

  const attemptReconnect = () => {
    if (closed || reconnecting) {
      if (closed) {
        currentStatus = 'closed'
        notify(onStatus, 'closed')
      }
      return
    }
    reconnecting = true
    reconnects += 1
    const delay = delays[Math.min(reconnects - 1, delays.length - 1)]
    currentStatus = 'reconnecting'
    notify(onStatus, 'reconnecting', { attempts: reconnects, delay })
    recordTelemetry('reconnect', { attempts: reconnects, delay })
    setTimeout(() => {
      reconnecting = false
      if (!closed) connect()
    }, delay)
  }

  const connect = () => {
    if (connecting || (socket && socket.readyState === WS.CONNECTING)) {
      log.warn?.('[overlay] connect already in progress, skipping')
      return
    }
    connecting = true
    currentStatus = 'connecting'
    notify(onStatus, 'connecting')
    recordTelemetry('status', { status: 'connecting' })
    log.info?.(`[overlay] connecting to ${target}`)
    try {
      socket = new WS(target)
    } catch (error) {
      log.error('[overlay] connect failed', error)
      connecting = false
      recordTelemetry('error', { phase: 'connect', message: error?.message })
      attemptReconnect()
      return
    }

    const clearHeartbeat = () => {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer)
        heartbeatTimer = null
      }
    }

    socket.addEventListener('open', () => {
      if (closed) return
      connecting = false
      reconnects = 0
      log.info?.('[overlay] connection established')
      currentStatus = 'online'
      notify(onStatus, 'online')
      recordTelemetry('status', { status: 'online' })

      // Send a test ping to keep connection alive
      if (socket && socket.readyState === WS.OPEN) {
        try {
          lastPingAt = Date.now()
          socket.send(JSON.stringify({ type: 'ping', timestamp: lastPingAt }))
          recordTelemetry('ping')
          log.info?.('[overlay] ping sent')
        } catch (error) {
          log.warn?.('[overlay] failed to send ping', error)
        }
      }

      // Resubscribe to all active threads after reconnect
      subscribers.forEach((handlers, threadId) => {
        if (!handlers || handlers.size === 0) return
        try {
          socket?.send?.(JSON.stringify({ type: 'subscribe', threadId }))
          log.info?.(`[overlay] resubscribed to thread ${threadId}`)
        } catch (error) {
          log.warn?.('[overlay] resubscribe failed, queueing', { threadId, error })
          enqueue({ type: 'subscribe', threadId })
        }
      })

      sendQueued()

      clearHeartbeat()
      heartbeatTimer = setInterval(() => {
        if (!socket || socket.readyState !== WS.OPEN) return
        try {
          lastPingAt = Date.now()
          socket.send(JSON.stringify({ type: 'ping', timestamp: lastPingAt }))
          recordTelemetry('ping')
        } catch (error) {
          log.warn?.('[overlay] heartbeat ping failed', error)
          socket.close()
        }
      }, HEARTBEAT_INTERVAL_MS)
    })

    socket.addEventListener('message', (event) => handleMessage(event.data))
    socket.addEventListener('error', (event) => {
      log.error('[overlay] socket error', event)
      log.error('[overlay] readyState:', socket?.readyState, 'endpoint:', target)
      recordTelemetry('error', { phase: 'runtime', event: event?.message || event?.type || 'socket-error' })
    })
    socket.addEventListener('close', (event) => {
      connecting = false
      clearHeartbeat()
      log.warn?.('[overlay] connection closed', { code: event.code, reason: event.reason, wasClean: event.wasClean })
      if (closed) {
        currentStatus = 'closed'
        notify(onStatus, 'closed')
        recordTelemetry('status', { status: 'closed', code: event.code, reason: event.reason, wasClean: event.wasClean })
      } else {
        currentStatus = 'disconnected'
        recordTelemetry('status', { status: 'disconnected', code: event.code, reason: event.reason, wasClean: event.wasClean })
        attemptReconnect()
      }
    })
  }

  const enqueue = (envelope) => {
    if (!envelope) return
    if (socket && socket.readyState === WS.OPEN) {
      try {
        socket.send(JSON.stringify(envelope))
        return
      } catch (error) {
        log.error('[overlay] send failed, queueing', error)
      }
    }
    queue.push(envelope)
  }

  connect()

  return {
    mode: 'websocket',
    subscribe(threadId, handler) {
      if (!threadId || typeof handler !== 'function') return () => {}
      
      // Normalize threadId to match dispatch normalization
      const normalizedThreadId = String(threadId).trim()
      
      const isFirstSubscriber = !subscribers.has(normalizedThreadId) || subscribers.get(normalizedThreadId).size === 0
      
      if (!subscribers.has(normalizedThreadId)) subscribers.set(normalizedThreadId, new Set())
      const set = subscribers.get(normalizedThreadId)
      set.add(handler)
      
      // Send subscribe message to relay on first subscriber
      if (isFirstSubscriber) {
        enqueue({ type: 'subscribe', threadId: normalizedThreadId })
        log.info?.(`[overlay] subscribing to thread ${normalizedThreadId}`)
      }
      
      return () => {
        set.delete(handler)
        // Send unsubscribe if no more handlers
        if (set.size === 0) {
          enqueue({ type: 'unsubscribe', threadId: normalizedThreadId })
          log.info?.(`[overlay] unsubscribing from thread ${normalizedThreadId}`)
        }
      }
    },
    publishMessage(threadId, payload) {
      enqueue({ type: 'message', threadId, payload })
    },
    publishAck(threadId, payload) {
      enqueue({ type: 'ack', threadId, payload })
    },
    publishControl(threadId, payload) {
      enqueue({ type: 'control', threadId, payload })
    },
    publishTyping(threadId, payload) {
      enqueue({ type: 'typing', threadId, payload })
    },
    close() {
      closed = true
      queue.length = 0
      subscribers.clear()
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer)
        heartbeatTimer = null
      }
      if (socket && socket.readyState === WS.OPEN) socket.close()
      socket = null
      currentStatus = 'closed'
      notify(onStatus, 'closed')
      recordTelemetry('status', { status: 'closed' })
    },
    getStatus() {
      return currentStatus
    }
  }
}
