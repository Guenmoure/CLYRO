'use client'

/**
 * PromoBanner — compact ~48px dismissable info strip.
 *
 * Replaces the 300px HeroBanner carousel with a single-line tip.
 * Dismissed state persisted via localStorage (versioned key).
 */

import { useState, useEffect } from 'react'
import { X, Mic, ArrowRight } from 'lucide-react'
import { useRouter } from 'next/navigation'

const STORAGE_KEY = 'clyro_promo_dismissed_v1'

export function PromoBanner() {
  const [visible, setVisible] = useState(false) // hidden until after mount
  const router = useRouter()

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true)
    } catch { /* privacy mode — just hide */ }
  }, [])

  function dismiss() {
    setVisible(false)
    try { localStorage.setItem(STORAGE_KEY, '1') } catch { /* noop */ }
  }

  if (!visible) return null

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2.5 rounded-xl border bg-gradient-to-r from-blue-500/8 to-purple-500/8 border-blue-500/15 dark:from-blue-500/6 dark:to-purple-500/6 dark:border-blue-500/12">
      {/* Icon + text */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="shrink-0 w-7 h-7 rounded-lg bg-purple-500/15 dark:bg-purple-500/20 flex items-center justify-center">
          <Mic size={14} className="text-purple-500 dark:text-purple-400" />
        </div>
        <p className="font-body text-sm text-[--text-secondary] truncate">
          <span className="font-medium text-foreground">New:</span>
          {' '}Clone your voice in 30 seconds and use it in all your videos.
        </p>
      </div>

      {/* CTA + dismiss */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => router.push('/assets')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-500/15 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400 hover:bg-purple-500/25 transition-colors"
        >
          Try it <ArrowRight size={11} />
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="p-1 rounded-md text-[--text-muted] hover:text-foreground hover:bg-muted transition-colors"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
