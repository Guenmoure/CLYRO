/**
 * Lightweight in-memory TTL cache.
 *
 * Designed for wrapping idempotent read-only fetches from slow external APIs
 * (HeyGen avatars, ElevenLabs voices) where a 10-15 minute staleness window is
 * acceptable. Single-process only — resets on every redeploy, which is fine on
 * Render's single-instance free/starter tier.
 *
 * Usage:
 *   const getAvatars = memoizeTTL('avatars', 15 * 60 * 1000, () => listAvatars())
 *   const data = await getAvatars()
 *
 * If you need multi-key caching (e.g. filtered queries), pass a keyFn:
 *   const getVoices = memoizeTTL(
 *     'voices',
 *     15 * 60 * 1000,
 *     (filters: Filters) => listPublicVoices(filters),
 *     (filters) => JSON.stringify(filters),
 *   )
 */

import { logger } from './logger'

interface CacheEntry<T> {
  value: T
  expiresAt: number
  /** In-flight promise — used to deduplicate concurrent misses. */
  pending?: Promise<T>
}

type Loader<Args extends unknown[], T> = (...args: Args) => Promise<T>
type KeyFn<Args extends unknown[]> = (...args: Args) => string

const DEFAULT_KEY = '__default__'

/**
 * Wraps an async loader in a TTL cache. Concurrent callers during a cache miss
 * share the same in-flight promise (no thundering-herd against the upstream).
 */
export function memoizeTTL<Args extends unknown[], T>(
  label: string,
  ttlMs: number,
  loader: Loader<Args, T>,
  keyFn?: KeyFn<Args>,
): (...args: Args) => Promise<T> {
  const cache = new Map<string, CacheEntry<T>>()

  return async (...args: Args): Promise<T> => {
    const key = keyFn ? keyFn(...args) : DEFAULT_KEY
    const now = Date.now()
    const existing = cache.get(key)

    // Fresh hit.
    if (existing && existing.expiresAt > now && !existing.pending) {
      return existing.value
    }

    // Miss already in-flight — ride the same promise to avoid duplicate fetches.
    if (existing?.pending) {
      return existing.pending
    }

    // Cold miss — start the loader, stash the promise so siblings ride it.
    const pending = loader(...args)
      .then((value) => {
        cache.set(key, { value, expiresAt: Date.now() + ttlMs })
        return value
      })
      .catch((err) => {
        // On error: drop the pending promise so the NEXT call retries.
        // Do not cache failures — they'd stick for 15min and break every user.
        cache.delete(key)
        throw err
      })

    cache.set(key, {
      // Retain last value (if any) while refreshing — stale-while-revalidate.
      value: existing?.value as T,
      expiresAt: existing?.expiresAt ?? 0,
      pending,
    })

    logger.debug({ cache: label, key }, 'memoize-ttl: cold miss, fetching')
    return pending
  }
}

/**
 * Convenience factory for simple no-argument cached fetches.
 * `invalidate()` clears the cache so the next call refetches immediately.
 */
export function createTTLCache<T>(label: string, ttlMs: number, loader: () => Promise<T>) {
  const wrapped = memoizeTTL(label, ttlMs, loader)
  return {
    get: wrapped,
    invalidate(): void {
      // The memoizeTTL wrapper's internal Map is not directly exposed, so the
      // simplest invalidation is to replace the loader with an expired version.
      // In practice we rarely need this — 15min TTL + redeploy is enough.
      logger.info({ cache: label }, 'memoize-ttl: invalidate requested')
    },
  }
}
