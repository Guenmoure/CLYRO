import * as React from 'react'
import { cn } from '@/lib/utils'
import { SpinnerAI } from './spinner'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface GenerationOverlayProps {
  /** Texte principal — ex: "Génération des images en cours..." */
  message: string
  /** Détail technique — ex: "Scène 3 / 6 — fal.ai flux/schnell" */
  subMessage?: string
  /** 0–100. Si absent → mode indéterminé (pas de barre de progression) */
  progress?: number
  /** Contrôle la visibilité avec animation fade */
  visible: boolean
  className?: string
}

// ── Composant ──────────────────────────────────────────────────────────────────

function GenerationOverlay({
  message,
  subMessage,
  progress,
  visible,
  className,
}: GenerationOverlayProps) {
  if (!visible) return null

  const hasProgress = typeof progress === 'number'

  return (
    <div
      className={cn(
        'glass rounded-2xl p-8 flex flex-col items-center gap-5 animate-fade-up',
        className
      )}
      role="status"
      aria-live="polite"
      aria-label={message}
    >
      <SpinnerAI size="xl" label={message} />

      <div className="flex flex-col items-center gap-1.5 text-center">
        <p className="font-display text-foreground text-base">
          {message}
        </p>
        {subMessage && (
          <p className="font-mono text-[--text-secondary] text-xs">
            {subMessage}
          </p>
        )}
      </div>

      {hasProgress && (
        <div className="w-full max-w-xs">
          {/* Track */}
          <div className="h-0.5 w-full rounded-full bg-border overflow-hidden">
            {/* Fill */}
            <div
              className="h-full rounded-full bg-grad-primary transition-all duration-300 ease-out"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
          <p className="font-mono text-[--text-muted] text-xs text-right mt-1">
            {Math.round(progress)}%
          </p>
        </div>
      )}
    </div>
  )
}

export { GenerationOverlay }
