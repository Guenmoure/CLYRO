'use client'

import { useState, useEffect } from 'react'
import { RotateCcw, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DraftRestoreBannerProps {
  wasRestored: boolean
}

export function DraftRestoreBanner({ wasRestored }: DraftRestoreBannerProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (wasRestored) {
      const t = setTimeout(() => setVisible(true), 80)
      return () => clearTimeout(t)
    }
  }, [wasRestored])

  if (!wasRestored) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex items-center gap-3 mx-6 mt-4 px-4 py-3 rounded-2xl',
        'bg-warning/8 border border-warning/20',
        'transition-all duration-500 ease-out',
        visible
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 -translate-y-2 pointer-events-none',
      )}
    >
      <div className="w-7 h-7 rounded-xl bg-warning/15 flex items-center justify-center shrink-0">
        <RotateCcw size={13} className="text-warning" strokeWidth={2} />
      </div>

      <p className="flex-1 font-body text-sm text-foreground leading-snug">
        Brouillon restauré —{' '}
        <span className="text-[--text-muted]">
          tu peux reprendre là où tu t&apos;es arrêté.
        </span>
      </p>

      <button
        type="button"
        onClick={() => setVisible(false)}
        aria-label="Fermer"
        className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 text-[--text-muted] hover:text-foreground hover:bg-warning/10 transition-colors"
      >
        <X size={13} />
      </button>
    </div>
  )
}
