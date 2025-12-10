import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CONFIG } from '@/lib/config'
import {
  __testables,
  deleteHelperCacheItem,
  getHelperCacheItem,
  getHelperCacheBaseUrl,
  helperCacheHealth,
  isHelperCacheConfigured,
  putHelperCacheItem
} from '@/lib/messaging/helperCacheClient.js'

const ORIGINAL_CONFIG = { ...CONFIG }

const MOCK_BASE = 'https://cache.example.com'

describe('helperCacheClient', () => {
  beforeEach(() => {
    CONFIG.HELPER_CACHE_ENDPOINT = MOCK_BASE
    global.fetch = vi.fn()
  })

  afterEach(() => {
    Object.assign(CONFIG, ORIGINAL_CONFIG)
    vi.restoreAllMocks()
  })

  it('normalizes base url without trailing slash', () => {
    CONFIG.HELPER_CACHE_ENDPOINT = `${MOCK_BASE}/`
    expect(getHelperCacheBaseUrl()).toEqual(MOCK_BASE)
  })

  it('detects configuration presence', () => {
    expect(isHelperCacheConfigured()).toBe(true)
    CONFIG.HELPER_CACHE_ENDPOINT = ''
    expect(isHelperCacheConfigured()).toBe(false)
  })

  it('retries on retryable status codes', async () => {
    const fetchSpy = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 502, text: vi.fn().mockResolvedValue('bad gateway') })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ status: 'ok' }), headers: new Map([['content-type', 'application/json']]) })

    global.fetch = fetchSpy

    const result = await helperCacheHealth({ retryDelays: [0, 0, 0], logger: { warn: vi.fn() } })
    expect(result).toEqual({ status: 'ok' })
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('throws after exhausting retries', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: false, status: 500, text: vi.fn().mockResolvedValue('boom') })
    global.fetch = fetchSpy

    await expect(helperCacheHealth({ retryDelays: [0, 0], logger: { warn: vi.fn() } })).rejects.toThrow('Helper cache request failed')
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('throws immediately on fatal status', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: false, status: 404, text: vi.fn().mockResolvedValue('missing') })
    global.fetch = fetchSpy

    await expect(helperCacheHealth({ retryDelays: [0, 0], logger: { warn: vi.fn() } })).rejects.toThrow('Helper cache request failed')
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('stores cache entries', async () => {
    const json = vi.fn().mockResolvedValue({ stored: true })
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json })

    const result = await putHelperCacheItem('demo', { hello: 'world' }, { retryDelays: [0] })
    expect(result).toEqual({ stored: true })
    expect(global.fetch).toHaveBeenCalledWith(
      `${MOCK_BASE}/cache`,
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('retrieves cache entries', async () => {
    const json = vi.fn().mockResolvedValue({ hello: 'world' })
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json, headers: new Map([['content-type', 'application/json']]) })

    const result = await getHelperCacheItem('demo', { retryDelays: [0] })
    expect(result).toEqual({ hello: 'world' })
    expect(global.fetch).toHaveBeenCalledWith(
      `${MOCK_BASE}/cache/demo`,
      expect.objectContaining({ method: 'GET' })
    )
  })

  it('deletes cache entries', async () => {
    const json = vi.fn().mockResolvedValue({ deleted: true })
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json })

    const result = await deleteHelperCacheItem('demo', { retryDelays: [0] })
    expect(result).toEqual({ deleted: true })
    expect(global.fetch).toHaveBeenCalledWith(
      `${MOCK_BASE}/cache/demo`,
      expect.objectContaining({ method: 'DELETE' })
    )
  })

  it('requires id for cache operations', async () => {
    await expect(getHelperCacheItem()).rejects.toThrow('id is required')
    await expect(putHelperCacheItem()).rejects.toThrow('id is required')
    await expect(deleteHelperCacheItem()).rejects.toThrow('id is required')
  })

  it('exposes fetchWithRetry for advanced tests', () => {
    expect(__testables.fetchWithRetry).toBeTypeOf('function')
  })
})
