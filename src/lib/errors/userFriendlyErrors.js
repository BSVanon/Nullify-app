/**
 * Translates technical error messages into human-readable notifications.
 * 
 * Nullify has many external dependencies (wallet services, overlay servers, 
 * blockchain APIs) that can fail in ways users can't control. This module
 * provides actionable guidance instead of raw technical errors.
 */

/**
 * Known error patterns and their user-friendly translations.
 * Each pattern includes:
 * - match: regex or string to match against error message
 * - message: human-readable message
 * - action: suggested next step
 * - recoverable: whether the user can retry
 */
const ERROR_PATTERNS = [
  // Wallet UTXO/transaction errors
  {
    match: /must be valid transaction on chain/i,
    message: 'Your wallet has outdated transaction data.',
    action: 'Open your wallet app and refresh, then try again.',
    recoverable: true,
    category: 'wallet',
  },
  {
    match: /insufficient funds|not enough.*satoshis/i,
    message: 'Not enough funds in your wallet.',
    action: 'Add more Bitcoin to your wallet and try again.',
    recoverable: true,
    category: 'wallet',
  },
  {
    match: /u is not iterable/i,
    message: 'Wallet signature request failed.',
    action: 'This is a known wallet compatibility issue. The action may still complete using a fallback method.',
    recoverable: true,
    category: 'wallet',
  },
  {
    match: /no.*wallet.*available|install.*wallet/i,
    message: 'No BSV wallet detected.',
    action: 'Install and run Metanet Desktop (https://getmetanet.com/#desktop), then reconnect.',
    recoverable: true,
    category: 'wallet',
  },
  {
    match: /wallet.*connection.*refused|ERR_CONNECTION_REFUSED.*3321/i,
    message: 'Cannot connect to your wallet.',
    action: 'Make sure your wallet app is running and try again.',
    recoverable: true,
    category: 'wallet',
  },
  {
    match: /wallet.*timeout|wallet.*timed out/i,
    message: 'Wallet took too long to respond.',
    action: 'Check if your wallet is unlocked and responsive, then try again.',
    recoverable: true,
    category: 'wallet',
  },
  {
    match: /access control checks|not allowed to request resource/i,
    message: 'Your browser blocked Nullify from reaching your local wallet.',
    action: 'If you are using a desktop wallet on this machine, try running Nullify from a local address (for example http://localhost) or a desktop-bundled version, then try again.',
    recoverable: true,
    category: 'wallet',
  },

  // Overlay/messaging server errors
  {
    match: /overlay.*connection|websocket.*failed|ws:\/\/.*failed/i,
    message: 'Cannot connect to the messaging server.',
    action: 'Check your internet connection. Messages will sync when connection is restored.',
    recoverable: true,
    category: 'network',
  },
  {
    match: /overlay.*timeout/i,
    message: 'Messaging server is slow to respond.',
    action: 'Your message may still be delivered. Check back in a moment.',
    recoverable: true,
    category: 'network',
  },

  // MessageBox/PeerPay errors
  {
    match: /messagebox.*failed|messagebox.*error/i,
    message: 'Payment messaging service is temporarily unavailable.',
    action: 'Try sending the payment again in a few moments.',
    recoverable: true,
    category: 'network',
  },
  {
    match: /peerpay.*failed|payment.*failed/i,
    message: 'Bitcoin payment could not be completed.',
    action: 'Check your wallet balance and try again.',
    recoverable: true,
    category: 'payment',
  },

  // Thread/token errors
  {
    match: /thread.*not found|receipt.*not found/i,
    message: 'This conversation could not be found.',
    action: 'The thread may have been deleted or you may need to rejoin.',
    recoverable: false,
    category: 'thread',
  },
  {
    match: /CT.*burned|control token.*burned/i,
    message: 'This conversation has been permanently deleted.',
    action: 'The thread creator burned the access token. This cannot be undone.',
    recoverable: false,
    category: 'thread',
  },
  {
    match: /DT.*invalid|data token.*invalid/i,
    message: 'Your access to this conversation is no longer valid.',
    action: 'You may need a new invite to rejoin this thread.',
    recoverable: false,
    category: 'thread',
  },

  // Invite errors
  {
    match: /invite.*expired/i,
    message: 'This invite link has expired.',
    action: 'Ask the sender for a new invite link.',
    recoverable: false,
    category: 'invite',
  },
  {
    match: /invite.*invalid|malformed invite/i,
    message: 'This invite link is invalid.',
    action: 'Make sure you copied the complete invite link.',
    recoverable: true,
    category: 'invite',
  },

  // Network errors
  {
    match: /network.*error|fetch.*failed|net::ERR_/i,
    message: 'Network connection problem.',
    action: 'Check your internet connection and try again.',
    recoverable: true,
    category: 'network',
  },

  // Storage errors
  {
    match: /storage.*quota|quota.*exceeded/i,
    message: 'Browser storage is full.',
    action: 'Clear some browser data or use a different browser.',
    recoverable: false,
    category: 'storage',
  },

  // Encryption errors
  {
    match: /decrypt.*failed|encryption.*error/i,
    message: 'Could not decrypt message.',
    action: 'The message may be corrupted or your keys may have changed.',
    recoverable: false,
    category: 'crypto',
  },
];

/**
 * Extracts the most relevant error message from various error formats.
 */
function extractErrorMessage(error) {
  if (!error) return '';
  
  // Handle Error objects
  if (error instanceof Error) {
    return error.message || String(error);
  }
  
  // Handle string errors
  if (typeof error === 'string') {
    // Try to parse JSON error strings
    try {
      const parsed = JSON.parse(error);
      return parsed.message || parsed.error || error;
    } catch {
      return error;
    }
  }
  
  // Handle objects with message property
  if (typeof error === 'object') {
    // Check for nested message in JSON-API wallet errors
    if (error.message) {
      try {
        const parsed = JSON.parse(error.message);
        return parsed.message || error.message;
      } catch {
        return error.message;
      }
    }
    return JSON.stringify(error);
  }
  
  return String(error);
}

/**
 * Translates a technical error into a user-friendly message.
 * 
 * @param {Error|string|object} error - The error to translate
 * @param {object} options - Optional context
 * @param {string} options.context - What the user was trying to do (e.g., 'send payment', 'join thread')
 * @param {string} options.fallback - Fallback message if no pattern matches
 * @returns {object} { message, action, recoverable, category }
 */
export function translateError(error, options = {}) {
  const { context, fallback } = options;
  const errorMessage = extractErrorMessage(error);
  
  // Try to match against known patterns
  for (const pattern of ERROR_PATTERNS) {
    const matches = typeof pattern.match === 'string'
      ? errorMessage.toLowerCase().includes(pattern.match.toLowerCase())
      : pattern.match.test(errorMessage);
    
    if (matches) {
      return {
        message: pattern.message,
        action: pattern.action,
        recoverable: pattern.recoverable,
        category: pattern.category,
        original: errorMessage,
      };
    }
  }
  
  // No pattern matched - return a generic but helpful message
  const defaultMessage = context
    ? `Something went wrong while trying to ${context}.`
    : 'Something went wrong.';
  
  return {
    message: fallback || defaultMessage,
    action: 'Please try again. If the problem persists, check your wallet and internet connection.',
    recoverable: true,
    category: 'unknown',
    original: errorMessage,
  };
}

/**
 * Formats a translated error for display in a notification.
 * 
 * @param {Error|string|object} error - The error to translate
 * @param {object} options - Optional context
 * @returns {string} Formatted message suitable for a notification
 */
export function formatErrorForNotification(error, options = {}) {
  const translated = translateError(error, options);
  
  // Combine message and action into a single notification string
  if (translated.action && translated.recoverable) {
    return `${translated.message} ${translated.action}`;
  }
  
  return translated.message;
}

/**
 * Checks if an error is likely recoverable (user can retry).
 * 
 * @param {Error|string|object} error - The error to check
 * @returns {boolean}
 */
export function isRecoverableError(error) {
  const translated = translateError(error);
  return translated.recoverable;
}

export default {
  translateError,
  formatErrorForNotification,
  isRecoverableError,
};
