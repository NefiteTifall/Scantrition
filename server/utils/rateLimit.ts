interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// Cleanup expired entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) store.delete(key)
  }
}, 5 * 60 * 1000)

/**
 * In-memory rate limiter. Throws 429 if limit is exceeded.
 * @param key    Unique key (e.g. "login:1.2.3.4")
 * @param limit  Max requests allowed in the window
 * @param windowMs  Window duration in milliseconds
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): void {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || entry.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return
  }

  entry.count++
  if (entry.count > limit) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
    throw createError({
      statusCode: 429,
      message: `Too many requests — please wait ${retryAfter}s before retrying`
    })
  }
}

export function getClientIp(event: Parameters<typeof getHeader>[0]): string {
  return (
    getHeader(event, 'x-forwarded-for')?.split(',')[0]?.trim()
    ?? getHeader(event, 'x-real-ip')
    ?? 'unknown'
  )
}
