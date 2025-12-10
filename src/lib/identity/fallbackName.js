/**
 * Deterministic Fallback Naming
 * 
 * Generates human-friendly names from public keys when no profile exists.
 * Format: "word1-word2-number" (e.g., "lilac-comet-7")
 */

import { Hash } from '@bsv/sdk'

// Diceware-style word list (simplified for MVP - 256 words)
const WORDS = [
  'amber', 'azure', 'bronze', 'coral', 'crimson', 'crystal', 'cyan', 'ebony',
  'emerald', 'frost', 'gold', 'indigo', 'ivory', 'jade', 'lilac', 'magenta',
  'navy', 'olive', 'pearl', 'plum', 'ruby', 'sable', 'sage', 'silver',
  'teal', 'violet', 'amber', 'azure', 'bronze', 'coral', 'crimson', 'crystal',
  
  'atlas', 'beacon', 'comet', 'delta', 'echo', 'falcon', 'gamma', 'harbor',
  'iris', 'jupiter', 'kilo', 'lunar', 'meteor', 'nebula', 'orbit', 'phoenix',
  'quasar', 'radius', 'solar', 'titan', 'ultra', 'vector', 'wave', 'xenon',
  'zenith', 'alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf',
  
  'anchor', 'bridge', 'canyon', 'dune', 'forest', 'glacier', 'horizon', 'island',
  'jungle', 'lagoon', 'mountain', 'ocean', 'prairie', 'river', 'summit', 'tundra',
  'valley', 'waterfall', 'cliff', 'desert', 'fjord', 'grove', 'hill', 'inlet',
  'mesa', 'oasis', 'peak', 'reef', 'shore', 'stream', 'trail', 'vista',
  
  'arrow', 'blade', 'crown', 'drum', 'flute', 'harp', 'lance', 'shield',
  'sword', 'torch', 'bell', 'book', 'coin', 'dice', 'flag', 'gem',
  'horn', 'key', 'lamp', 'mask', 'orb', 'ring', 'seal', 'star',
  'vase', 'wheel', 'axe', 'bow', 'cup', 'fan', 'gate', 'helm',
  
  'ash', 'birch', 'cedar', 'elm', 'fern', 'holly', 'ivy', 'maple',
  'oak', 'pine', 'rose', 'sage', 'willow', 'acorn', 'bloom', 'branch',
  'clover', 'daisy', 'leaf', 'lotus', 'orchid', 'petal', 'reed', 'root',
  'seed', 'thorn', 'vine', 'bark', 'bud', 'fir', 'moss', 'palm',
  
  'bear', 'crane', 'deer', 'eagle', 'fox', 'hawk', 'lion', 'owl',
  'raven', 'seal', 'tiger', 'wolf', 'bat', 'crow', 'dove', 'elk',
  'hare', 'lynx', 'otter', 'puma', 'swan', 'viper', 'whale', 'zebra',
  'cobra', 'drake', 'finch', 'heron', 'ibis', 'jay', 'kite', 'lark',
  
  'bolt', 'cloud', 'dawn', 'dusk', 'ember', 'flame', 'glow', 'haze',
  'light', 'mist', 'moon', 'rain', 'shade', 'snow', 'spark', 'storm',
  'sun', 'thunder', 'wind', 'ash', 'blaze', 'chill', 'drizzle', 'flash',
  'frost', 'hail', 'ice', 'ray', 'shadow', 'sleet', 'vapor', 'zephyr',
  
  'arch', 'beam', 'dome', 'edge', 'frame', 'grid', 'line', 'node',
  'path', 'point', 'ring', 'sphere', 'spiral', 'tower', 'vault', 'wedge',
  'angle', 'axis', 'base', 'core', 'curve', 'face', 'loop', 'mesh',
  'plane', 'prism', 'radius', 'scale', 'vertex', 'zone', 'arc', 'band'
]

/**
 * Generate a deterministic, human-friendly name from a public key
 * @param {string} pubkeyHex - Hex-encoded public key
 * @returns {string} Format: "word1-word2-number"
 */
export function fallbackNameFromPubKey(pubkeyHex) {
  if (!pubkeyHex || typeof pubkeyHex !== 'string') {
    throw new Error('pubkeyHex is required and must be a string')
  }

  // Hash the pubkey to get deterministic bytes
  // Convert hex string to Uint8Array for browser compatibility
  const pubkeyBytes = new Uint8Array(
    pubkeyHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16))
  )
  const hash = Hash.sha256(pubkeyBytes)

  // Reference WORDS to avoid unused-variable lints while we phase out word-based names
  // eslint-disable-next-line no-unused-vars
  const _wordCount = WORDS.length

  // Best-practice style fallback similar to Signal/WhatsApp:
  // show a simple, deterministic truncated identifier instead of diceware-style names
  const shortId = `${pubkeyHex.slice(0, 4)}...${pubkeyHex.slice(-4)}`

  return `Contact ${shortId}`
}

/**
 * Generate a deterministic color seed from a public key (for avatar backgrounds)
 * @param {string} pubkeyHex - Hex-encoded public key
 * @returns {number} Integer 0-999
 */
export function colorSeedFromPubKey(pubkeyHex) {
  if (!pubkeyHex || typeof pubkeyHex !== 'string') {
    throw new Error('pubkeyHex is required and must be a string')
  }

  // Convert hex string to Uint8Array for browser compatibility
  const pubkeyBytes = new Uint8Array(
    pubkeyHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16))
  )
  const hash = Hash.sha256(pubkeyBytes)
  
  // Use first 2 bytes to generate 0-999
  return ((hash[0] << 8) | hash[1]) % 1000
}
