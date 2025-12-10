import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  isHelperCacheConfigured,
  getHelperCacheStatus,
  getHelperCacheQuota,
  pruneHelperCache
} from '@/lib/messaging/helperCacheClient'

const DEFAULT_REFRESH_INTERVAL_MS = 60_000

function normalizeQuota(quota) {
  if (!quota || typeof quota !== 'object') return null
  const {
    limitBytes,
    usedBytes,
    ttlSeconds,
    entryLimit,
    entryCount,
    oldestEntryIso,
    newestEntryIso
  } = quota

  return {
    limitBytes: Number.isFinite(limitBytes) ? limitBytes : null,
    usedBytes: Number.isFinite(usedBytes) ? usedBytes : null,
    ttlSeconds: Number.isFinite(ttlSeconds) ? ttlSeconds : null,
    entryLimit: Number.isFinite(entryLimit) ? entryLimit : null,
    entryCount: Number.isFinite(entryCount) ? entryCount : null,
    oldestEntryIso: oldestEntryIso || null,
    newestEntryIso: newestEntryIso || null
  }
}

export function useHelperCacheStatus({ autoRefresh = true } = {}) {
  const [supported, setSupported] = useState(() => isHelperCacheConfigured())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [status, setStatus] = useState(null)
  const [quota, setQuota] = useState(null)
  const [pruning, setPruning] = useState(false)

  const fetchStatus = useCallback(async () => {
    if (!supported) return
    setLoading(true)
    setError(null)
    try {
      const [statusResponse, quotaResponse] = await Promise.all([
        getHelperCacheStatus({ retryDelays: [0, 250, 1000] }).catch((err) => {
          setError((prev) => prev || err.message || 'Failed to load helper cache status')
          return null
        }),
        getHelperCacheQuota({ retryDelays: [0, 500] }).catch((err) => {
          setError((prev) => prev || err.message || 'Failed to load helper cache quota')
          return null
        })
      ])

      setStatus(statusResponse)
      setQuota(normalizeQuota(quotaResponse))
    } catch (err) {
      setError(err.message || 'Failed to load helper cache status')
    } finally {
      setLoading(false)
    }
  }, [supported])

  useEffect(() => {
    if (!supported) return
    fetchStatus()
  }, [supported, fetchStatus])

  useEffect(() => {
    if (!supported || !autoRefresh) return undefined
    const timer = setInterval(fetchStatus, DEFAULT_REFRESH_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [supported, autoRefresh, fetchStatus])

  const prune = useCallback(async () => {
    if (!supported) return null
    setPruning(true)
    setError(null)
    try {
      const result = await pruneHelperCache({ retryDelays: [0, 500, 1000] })
      await fetchStatus()
      return result
    } catch (err) {
      setError(err.message || 'Failed to prune helper cache')
      throw err
    } finally {
      setPruning(false)
    }
  }, [supported, fetchStatus])

  const usage = useMemo(() => {
    if (!quota) return null
    const { limitBytes, usedBytes, entryLimit, entryCount } = quota
    return {
      bytes: {
        used: usedBytes ?? null,
        limit: limitBytes ?? null,
        percent: limitBytes && usedBytes ? Math.min(100, Math.round((usedBytes / limitBytes) * 100)) : null
      },
      entries: {
        count: entryCount ?? null,
        limit: entryLimit ?? null,
        percent:
          entryLimit && Number.isFinite(entryLimit) && entryCount !== null
            ? Math.min(100, Math.round((entryCount / entryLimit) * 100))
            : null
      }
    }
  }, [quota])

  return {
    supported,
    loading,
    error,
    status,
    quota,
    usage,
    pruning,
    refresh: fetchStatus,
    prune
  }
}
