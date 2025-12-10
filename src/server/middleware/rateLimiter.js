function createRateLimiter({ windowMs, max }) {
  const buckets = new Map()

  return function isRateLimited(key = 'global') {
    const now = Date.now()
    const record = buckets.get(key) || { start: now, count: 0 }
    if (now - record.start > windowMs) {
      buckets.set(key, { start: now, count: 1 })
      return false
    }
    record.count += 1
    buckets.set(key, record)
    return record.count > max
  }
}

module.exports = { createRateLimiter }
