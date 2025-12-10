export async function retryAsync(fn, { retries = 2, delays = [100, 500, 1000], logger = console } = {}) {
  let attempt = 0
  let lastError

  const totalAttempts = Math.max(retries + 1, delays.length + 1)

  while (attempt < totalAttempts) {
    if (attempt > 0) {
      const delay = delays[Math.min(attempt - 1, delays.length - 1)]
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }

    try {
      return await fn(attempt)
    } catch (error) {
      lastError = error
      if (attempt === totalAttempts - 1) break
      logger?.warn?.('[retry] attempt failed', {
        attempt: attempt + 1,
        error: error?.message || String(error)
      })
    }

    attempt += 1
  }

  throw lastError || new Error('retryAsync exhausted without success')
}
