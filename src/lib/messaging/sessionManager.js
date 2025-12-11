/**
 * Session manager for guest mode
 * Ensures each browser tab/window gets a unique session ID
 * so multiple guests can join the same thread without identity conflicts
 */

const SESSION_KEY = 'nullify-session-id'

/**
 * Get or create a session ID for this tab/window
 * Session ID persists in sessionStorage (cleared when tab closes)
 */
export function getSessionId() {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    // Fallback for non-browser environments
    return 'default-session'
  }
  
  let sessionId = window.sessionStorage.getItem(SESSION_KEY)
  
  if (!sessionId) {
    // Generate a new session ID
    sessionId = `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    window.sessionStorage.setItem(SESSION_KEY, sessionId)
  }
  
  return sessionId
}

/**
 * Clear the current session ID (useful for testing)
 */
export function clearSessionId() {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    window.sessionStorage.removeItem(SESSION_KEY)
  }
}
