import type { NextRequest } from 'next/server'

type RateLimitBucket = {
  count: number
  resetAt: number
}

type RateLimitResult = {
  allowed: boolean
  retryAfterSeconds: number
}

const AUTH_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000

const globalBuckets = globalThis as typeof globalThis & {
  __authRateLimitBuckets?: Map<string, RateLimitBucket>
}

const buckets = globalBuckets.__authRateLimitBuckets ?? new Map<string, RateLimitBucket>()

if (!globalBuckets.__authRateLimitBuckets) {
  globalBuckets.__authRateLimitBuckets = buckets
}

function getClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const realIp = request.headers.get('x-real-ip')?.trim()
  return forwardedFor || realIp || 'unknown'
}

function cleanupExpiredBuckets(now: number) {
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key)
    }
  }
}

export function buildAuthRateLimitKey(request: NextRequest, scope: 'login' | 'register', email: string) {
  const normalizedEmail = email.trim().toLowerCase() || 'anonymous'
  return `${scope}:${getClientIp(request)}:${normalizedEmail}`
}

export function consumeAuthRateLimit(key: string, limit: number): RateLimitResult {
  const now = Date.now()
  cleanupExpiredBuckets(now)

  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, {
      count: 1,
      resetAt: now + AUTH_RATE_LIMIT_WINDOW_MS,
    })

    return {
      allowed: true,
      retryAfterSeconds: 0,
    }
  }

  if (bucket.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    }
  }

  bucket.count += 1
  buckets.set(key, bucket)

  return {
    allowed: true,
    retryAfterSeconds: 0,
  }
}

export function resetAuthRateLimit(key: string) {
  buckets.delete(key)
}
