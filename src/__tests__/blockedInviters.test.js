import { afterEach, describe, expect, it, vi } from 'vitest'
import localforage from 'localforage'

// Use an in-memory implementation for localforage under Vitest's Node environment
vi.mock('localforage', () => {
  const createStore = () => {
    const data = new Map()
    return {
      async setItem(key, value) {
        data.set(key, value)
      },
      async getItem(key) {
        return data.has(key) ? data.get(key) : null
      },
      async removeItem(key) {
        data.delete(key)
      },
      async clear() {
        data.clear()
      },
      async iterate(callback) {
        for (const [key, value] of data.entries()) {
          // localforage iterate callback signature: (value, key)
          await callback(value, key)
        }
      },
      driver() {
        return 'memory'
      },
    }
  }

  const defaultInstance = createStore()

  return {
    __esModule: true,
    default: {
      createInstance: () => createStore(),
      // Provide clear/iterate on default export in case any code uses it
      clear: defaultInstance.clear,
      iterate: defaultInstance.iterate,
    },
  }
})

import {
  blockedInviterStore,
  listBlockedInviters,
  saveBlockedInviter,
  removeBlockedInviter
} from '@/lib/messaging/storage'

// Vitest runs in Node; use in-memory driver for LocalForage
blockedInviterStore.driver() // ensure instance created

const resetStore = async () => {
  await blockedInviterStore.clear()
}

describe('blocked inviter storage helpers', () => {
  afterEach(async () => {
    await resetStore()
  })

  it('saves and lists blocked inviters', async () => {
    const inviterId = 'inviter-123'
    await saveBlockedInviter(inviterId, { reason: 'test', blockedAt: '2025-11-03T17:00:00.000Z' })

    const entries = await listBlockedInviters()
    expect(entries).toHaveLength(1)
    expect(entries[0]).toEqual(
      expect.objectContaining({
        id: inviterId,
        reason: 'test',
        blockedAt: '2025-11-03T17:00:00.000Z',
        updatedAt: expect.any(String)
      })
    )
  })

  it('deduplicates and preserves earliest blockedAt timestamp', async () => {
    const inviterId = 'inviter-123'
    const first = await saveBlockedInviter(inviterId, { reason: 'first' })
    const second = await saveBlockedInviter(inviterId, { reason: 'second' })

    expect(new Date(first.blockedAt).getTime()).toBeLessThanOrEqual(new Date(second.blockedAt).getTime())

    const entries = await listBlockedInviters()
    expect(entries).toHaveLength(1)
    expect(entries[0]).toEqual(
      expect.objectContaining({
        id: inviterId,
        reason: 'second',
        blockedAt: first.blockedAt
      })
    )
    expect(new Date(entries[0].updatedAt)).toBeInstanceOf(Date)
  })

  it('removes blocked inviters', async () => {
    const inviterId = 'inviter-123'
    await saveBlockedInviter(inviterId, { updatedAt: '2025-11-04T12:00:00.000Z' })
    const removed = await removeBlockedInviter(inviterId, { updatedAt: '2025-11-05T12:00:00.000Z' })

    expect(removed).toBe(true)

    const entries = await listBlockedInviters()
    expect(entries).toHaveLength(0)
  })

  it('ignores stale remote update', async () => {
    const inviterId = 'inviter-123'
    const latest = await saveBlockedInviter(inviterId, { updatedAt: '2025-11-05T12:00:00.000Z', source: 'local' })
    const stale = await saveBlockedInviter(inviterId, {
      reason: 'remote',
      updatedAt: '2025-11-04T12:00:00.000Z',
      source: 'remote'
    })

    expect(stale.updatedAt).toEqual(latest.updatedAt)

    const entries = await listBlockedInviters()
    expect(entries[0]).toEqual(expect.objectContaining({ source: 'local' }))
  })

  it('accepts newer remote unblock and ignores stale ones', async () => {
    const inviterId = 'inviter-456'
    await saveBlockedInviter(inviterId, { updatedAt: '2025-11-04T12:00:00.000Z' })

    const staleRemove = await removeBlockedInviter(inviterId, { updatedAt: '2025-11-03T10:00:00.000Z' })
    expect(staleRemove).toBe(false)
    expect(await isBlocked(inviterId)).toBe(true)

    const freshRemove = await removeBlockedInviter(inviterId, { updatedAt: '2025-11-06T10:00:00.000Z' })
    expect(freshRemove).toBe(true)
    expect(await isBlocked(inviterId)).toBe(false)
  })
})

async function isBlocked(inviterId) {
  const entries = await listBlockedInviters()
  return entries.some((entry) => entry.id === inviterId)
}
