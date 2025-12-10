#!/usr/bin/env node
/**
 * Generate two invites for the same thread (simulating Alice inviting Bob)
 * Usage: node scripts/generate-two-party-test.js
 */

import { randomBytes } from 'crypto'

function base64UrlEncode(data) {
  const base64 = Buffer.from(data).toString('base64')
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function generateTwoPartyTest() {
  // Shared thread ID
  const threadId = randomBytes(16).toString('hex')
  
  // Alice (initiator)
  const aliceId = randomBytes(16).toString('hex')
  const alicePayload = {
    proto: 'NukeNote.Invite',
    v: 1,
    t: 'invite',
    threadId,
    inviter: aliceId,
    inviterName: 'Alice',
    policy: 'mutual',
    wrap: base64UrlEncode(randomBytes(32)),
    sig: base64UrlEncode(randomBytes(64)),
    exp: Math.floor(Date.now() / 1000) + 86400
  }
  
  // Bob (invitee)
  const bobId = randomBytes(16).toString('hex')
  const bobPayload = {
    proto: 'NukeNote.Invite',
    v: 1,
    t: 'invite',
    threadId, // Same thread!
    inviter: aliceId, // Alice is the inviter
    inviterName: 'Alice',
    policy: 'mutual',
    wrap: base64UrlEncode(randomBytes(32)),
    sig: base64UrlEncode(randomBytes(64)),
    exp: Math.floor(Date.now() / 1000) + 86400
  }
  
  const aliceBlob = base64UrlEncode(JSON.stringify(alicePayload))
  const bobBlob = base64UrlEncode(JSON.stringify(bobPayload))
  
  const aliceUrl = `http://localhost:5173/invite/${aliceBlob}`
  const bobUrl = `http://localhost:5173/invite/${bobBlob}`
  
  console.log('\n✅ Two-party test invites generated!\n')
  console.log('Thread ID:', threadId)
  console.log('\n📝 ALICE (Tab 1) - Open this URL first:')
  console.log(aliceUrl)
  console.log('\n📝 BOB (Tab 2) - Open this URL second:')
  console.log(bobUrl)
  console.log('\nBoth will join the same thread but with different identities.')
  console.log('Messages sent from one tab should appear in the other!\n')
}

generateTwoPartyTest()
