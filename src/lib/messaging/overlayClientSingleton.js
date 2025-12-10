import { createOverlayClient } from './createOverlayClient'
import { createMessageBoxOverlayClient } from './messageBoxOverlayClient'

let singletonClient = null
let singletonConfig = null
let currentStatusCallback = null

/**
 * Get or create a singleton overlay client
 * Survives React StrictMode double-mount and component remounts
 */
export function getOverlayClient({ mode, messageBoxHost, walletClient, identityKey, onStatus, logger }) {
  const configKey = mode === 'messagebox' 
    ? `messagebox:${messageBoxHost}:${identityKey}`
    : 'websocket'

  // Reuse existing client if config matches
  if (singletonClient && singletonConfig === configKey) {
    // Update the status callback even when reusing client
    currentStatusCallback = onStatus
    // Notify current status immediately for new subscribers
    if (onStatus && singletonClient.getStatus) {
      const currentStatus = singletonClient.getStatus()
      if (currentStatus) {
        onStatus(currentStatus)
      }
    }
    return singletonClient
  }

  // Close old client if config changed
  if (singletonClient && typeof singletonClient.close === 'function') {
    singletonClient.close()
    singletonClient = null
  }

  // Store the callback
  currentStatusCallback = onStatus
  
  // Wrapper that calls the current callback
  const statusWrapper = (status) => {
    if (currentStatusCallback) {
      currentStatusCallback(status)
    }
  }
  
  // Create new client
  if (mode === 'messagebox' && messageBoxHost && walletClient && identityKey) {
    singletonClient = createMessageBoxOverlayClient({
      host: messageBoxHost,
      walletClient,
      identity: { publicKey: identityKey },
      onStatus: statusWrapper,
      logger,
    })
  } else {
    singletonClient = createOverlayClient({
      onStatus: statusWrapper,
      logger,
    })
  }

  singletonConfig = configKey
  return singletonClient
}

/**
 * Close and clear the singleton client
 * Call this only on true app shutdown
 */
export function closeOverlayClient() {
  if (singletonClient && typeof singletonClient.close === 'function') {
    singletonClient.close()
  }
  singletonClient = null
  singletonConfig = null
}
