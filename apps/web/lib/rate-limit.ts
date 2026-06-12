import { NextResponse } from 'next/server'

/**
 * In-memory limiter: per-instance only on Vercel serverless. Mitigation
 * temporaire — la règle security.md prévoit Upstash ou un déplacement vers
 * apps/api pour une limite globale.
 *
 * Sliding-window per user: each (userId, route) key keeps the timestamps of
 * its recent requests; a request is allowed if fewer than `limit` timestamps
 * fall inside the window. On Vercel, each lambda instance has its own Map, so
 * the effective ceiling is `limit × concurrent instances` — still enough to
 * stop a single-origin curl loop from draining FAL_KEY credits.
 */

const WINDOW_MS = 60 * 60 * 1000 // 1 hour sliding window

// key = `${route}:${userId}` → timestamps (ms) of requests inside the window
const buckets = new Map<string, number[]>()

export interface RateLimitResult {
  allowed: boolean
  /** Seconds until the oldest request leaves the window (only when blocked). */
  retryAfterSeconds: number
}

/**
 * Records a hit for `userId` on `route` and tells whether it is allowed.
 *
 * @param route  Stable route identifier (e.g. 'stream-image').
 * @param userId Authenticated Supabase user id — call AFTER auth.
 * @param limit  Max requests per user per sliding hour.
 */
export function checkRateLimit(route: string, userId: string, limit: number): RateLimitResult {
  const now = Date.now()
  const key = `${route}:${userId}`

  const timestamps = (buckets.get(key) ?? []).filter((t) => now - t < WINDOW_MS)

  if (timestamps.length >= limit) {
    const oldest = timestamps[0]
    buckets.set(key, timestamps)
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((oldest + WINDOW_MS - now) / 1000)),
    }
  }

  timestamps.push(now)
  buckets.set(key, timestamps)

  // Opportunistic GC: drop stale keys so the Map doesn't grow unbounded on
  // long-lived instances (local dev, warm lambdas).
  if (buckets.size > 1000) {
    Array.from(buckets.entries()).forEach(([k, ts]) => {
      if (ts.every((t) => now - t >= WINDOW_MS)) buckets.delete(k)
    })
  }

  return { allowed: true, retryAfterSeconds: 0 }
}

/** Standard 429 envelope ({ error, code }) shared by every limited route. */
export function rateLimitResponse(result: RateLimitResult): NextResponse {
  return NextResponse.json(
    { error: 'Rate limit exceeded', code: 'RATE_LIMITED' },
    { status: 429, headers: { 'Retry-After': String(result.retryAfterSeconds) } },
  )
}
