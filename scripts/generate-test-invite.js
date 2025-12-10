#!/usr/bin/env node
/**
 * Generate a test invite link for local development
 * Usage: node scripts/generate-test-invite.js
 */

import { randomBytes } from 'crypto'

function base64UrlEncode(data) {
  const base64 = Buffer.from(data).toString('base64')
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function generateTestInvite() {
  const threadId = randomBytes(16).toString('hex')
  const inviterId = randomBytes(16).toString('hex')
  
  const payload = {
    proto: 'NukeNote.Invite',
    v: 1,
    t: 'invite',
    threadId,
    inviter: inviterId,
    inviterName: 'Test User',
    policy: 'mutual',
    wrap: base64UrlEncode(randomBytes(32)),
    sig: base64UrlEncode(randomBytes(64)),
    exp: Math.floor(Date.now() / 1000) + 86400 // 24h from now
  }
  
  const blob = base64UrlEncode(JSON.stringify(payload))
  const url = `http://localhost:5173/invite/${blob}`
  
  console.log('\n✅ Test invite generated!\n')
  console.log('Thread ID:', threadId)
  console.log('Inviter:', inviterId)
  console.log('\nInvite URL:')
  console.log(url)
  console.log('\nOpen this URL in your browser to accept the invite.\n')
  
  return { payload, blob, url }
}

generateTestInvite()
