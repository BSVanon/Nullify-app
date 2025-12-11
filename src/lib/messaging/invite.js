import { v4 as uuid } from 'uuid'
import { sha256 } from '@noble/hashes/sha256'
import { base64UrlDecode } from '@/lib/utils'
import { isInviterBlocked } from '@/lib/messaging/storage'

const INVITE_VERSION = 1

const INVITE_TYPE = 'invite'
const SUPPORTED_POLICIES = new Set(['mutual', 'initiator'])

function encodeBase64Url(value) {
  if (typeof value !== 'string') {
    throw new TypeError('Base64Url encoder expects a string value')
  }

  let base64
  if (typeof globalThis.Buffer !== 'undefined') {
    base64 = globalThis.Buffer.from(value, 'utf8').toString('base64')
  } else if (typeof btoa === 'function') {
    base64 = btoa(unescape(encodeURIComponent(value)))
  } else {
    throw new Error('No base64 encoder available in this environment')
  }

  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function decodeBase64Url(encoded) {
  if (typeof encoded !== 'string') {
    throw new TypeError('Base64Url decoder expects a string value')
  }

  const padded = encoded.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(encoded.length / 4) * 4, '=')

  let decoded
  if (typeof globalThis.Buffer !== 'undefined') {
    decoded = globalThis.Buffer.from(padded, 'base64').toString('utf8')
  } else if (typeof atob === 'function') {
    decoded = decodeURIComponent(escape(atob(padded)))
  } else {
    throw new Error('No base64 decoder available in this environment')
  }

  return decoded
}

function toHex(uint8) {
  return Array.from(uint8)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export function createInvitePayload({
  threadId = uuid(),
  policy = 'mutual',
  inviter,
  wrap,
  expiresAt,
  metadata
}) {
  if (!SUPPORTED_POLICIES.has(policy)) {
    throw new Error(`Unsupported policy: ${policy}`)
  }
  if (!inviter) {
    throw new Error('Inviter public key is required')
  }
  if (!wrap) {
    throw new Error('Per-recipient wrapped key is required')
  }

  const exp = typeof expiresAt === 'number' ? expiresAt : Math.floor(Date.now() / 1000) + 86400

  return {
    proto: 'Nullify.Invite',
    v: INVITE_VERSION,
    t: INVITE_TYPE,
    threadId,
    inviter,
    policy,
    wrap,
    exp,
    meta: metadata || {}
  }
}

export function encodeInvitePayload(payload) {
  return encodeBase64Url(JSON.stringify(payload))
}

export function createInviteBlob(options) {
  const payload = createInvitePayload(options)
  const blob = encodeInvitePayload(payload)
  return { payload, blob }
}

export async function isInviteBlocked(invite) {
  if (!invite?.payload?.inviter) return false
  return isInviterBlocked(invite.payload.inviter)
}

export function parseInviteBlob(blob) {
  if (!blob) throw new Error('Invite blob required')
  try {
    const decoded = base64UrlDecode(blob)
    const payload = JSON.parse(decoded)
    const validation = validateInvitePayload(payload)

    if (!validation.valid) {
      const reasons = validation.errors.join(', ')
      throw new Error(`Invalid invite payload: ${reasons}`)
    }

    const hash = toHex(sha256(decoded))

    return {
      blob,
      payload,
      hash
    }
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('Invite blob is not valid JSON')
    }
    throw error
  }
}

export function validateInvitePayload(payload) {
  const errors = []
  if (!payload || typeof payload !== 'object') {
    return { valid: false, errors: ['Payload must be an object'] }
  }

  if (payload.t !== INVITE_TYPE) errors.push(`Unexpected payload type ${payload.t ?? '(missing)'}`)
  if (payload.v !== INVITE_VERSION) errors.push(`Unsupported invite version ${payload.v ?? '(missing)'}`)
  if (!payload.threadId) errors.push('threadId missing')
  if (!payload.inviter) errors.push('inviter missing')
  if (!payload.wrap) errors.push('wrap missing')
  if (!SUPPORTED_POLICIES.has(payload.policy)) errors.push(`policy must be one of ${Array.from(SUPPORTED_POLICIES).join(', ')}`)

  const exp = Number(payload.exp)
  if (!Number.isFinite(exp)) {
    errors.push('exp (expiry) must be numeric (unix seconds)')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}
