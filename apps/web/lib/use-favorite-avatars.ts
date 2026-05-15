'use client'

import { useEffect, useState, useCallback } from 'react'

/**
 * Persistent favorites for the avatar catalog. Keyed by `avatar_id` so a
 * favorite survives when HeyGen renames a persona or shuffles its looks.
 *
 * Storage : localStorage `clyro:favorite-avatars` = JSON array of ids.
 * Falls back to in-memory state when localStorage is unavailable (private
 * tabs, quota exceeded) — favorites then live for the current tab only.
 *
 * Why not a Supabase table : favorites are a personal UI preference, not
 * shared team state. A round-trip to the server for every heart-tap is
 * overkill. If we later want sync-across-devices we promote this to a
 * `user_favorites` table without changing the component-level API.
 */
const STORAGE_KEY = 'clyro:favorite-avatars'

export function useFavoriteAvatars() {
  // Start empty — reading localStorage at the useState initialiser breaks
  // Next.js SSR/hydration. Real state is hydrated in the effect below.
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set())
  const [hydrated, setHydrated] = useState(false)

  // Hydrate from localStorage once on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const arr = JSON.parse(raw) as unknown
        if (Array.isArray(arr) && arr.every((x) => typeof x === 'string')) {
          setFavorites(new Set(arr))
        }
      }
    } catch {
      // Parse/access error — keep the empty set, fail open.
    }
    setHydrated(true)
  }, [])

  // Persist on change. Gate on `hydrated` so the empty default doesn't
  // overwrite real stored favorites before the hydrate effect has run.
  useEffect(() => {
    if (!hydrated) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(favorites)))
    } catch {
      // Quota exceeded / privacy mode — ignore, in-memory state still works.
    }
  }, [favorites, hydrated])

  const isFavorite = useCallback(
    (id: string) => favorites.has(id),
    [favorites],
  )

  const toggle = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  return {
    favorites,
    isFavorite,
    toggle,
    count: favorites.size,
    hydrated,
  }
}
