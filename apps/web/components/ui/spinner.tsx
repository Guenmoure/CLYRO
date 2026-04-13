import * as React from 'react'
import { cn } from '@/lib/utils'

// ── Size map ───────────────────────────────────────────────────────────────────

const SIZE: Record<string, { wh: string; border: string }> = {
  xs: { wh: 'w-3 h-3',   border: 'border-[1.5px]' },
  sm: { wh: 'w-4 h-4',   border: 'border-2'       },
  md: { wh: 'w-6 h-6',   border: 'border-2'       },
  lg: { wh: 'w-8 h-8',   border: 'border-[3px]'   },
  xl: { wh: 'w-12 h-12', border: 'border-[3px]'   },
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface SpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  /** Classe de couleur Tailwind, ex: 'text-blue-500' (défaut) */
  color?: string
  variant?: 'default' | 'ai'
  /** Texte pour les lecteurs d'écran */
  label?: string
  className?: string
}

// ── Spinner default ────────────────────────────────────────────────────────────

function Spinner({
  size = 'md',
  color = 'text-blue-500',
  variant = 'default',
  label = 'Chargement…',
  className,
}: SpinnerProps) {
  if (variant === 'ai') return <SpinnerAI size={size} label={label} className={className} />

  const { wh, border } = SIZE[size]

  return (
    <span role="status" aria-label={label} className={cn('inline-flex items-center justify-center', className)}>
      <span
        className={cn(
          'rounded-full animate-spin',
          'border-t-current border-r-current border-b-transparent border-l-transparent',
          wh, border, color
        )}
      />
      <span className="sr-only">{label}</span>
    </span>
  )
}

// ── SpinnerAI — trois arcs concentriques ──────────────────────────────────────

function SpinnerAI({
  size = 'md',
  label = 'Génération en cours…',
  className,
}: Pick<SpinnerProps, 'size' | 'label' | 'className'>) {
  const dim = size === 'xs' ? 12 : size === 'sm' ? 16 : size === 'md' ? 24 : size === 'lg' ? 32 : 48
  const stroke = dim <= 16 ? 1.5 : dim <= 24 ? 2 : 3
  const cx = dim / 2
  const r = {
    outer:  cx - stroke,
    middle: cx - stroke * 3.5,
    inner:  cx - stroke * 6,
  }

  return (
    <span role="status" aria-label={label} className={cn('inline-flex items-center justify-center', className)}>
      <svg width={dim} height={dim} viewBox={`0 0 ${dim} ${dim}`} fill="none" aria-hidden="true">
        {/* Arc externe — blue-500, 1s */}
        <circle
          cx={cx} cy={cx} r={r.outer}
          stroke="#3B8EF0"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${r.outer * 1.5} ${r.outer * 5}`}
          className="spin-ai-outer"
        />
        {/* Arc intermédiaire — purple-500, 0.75s */}
        {r.middle > 1 && (
          <circle
            cx={cx} cy={cx} r={r.middle}
            stroke="#9B5CF6"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${r.middle * 1.5} ${r.middle * 5}`}
            className="spin-ai-middle"
          />
        )}
        {/* Arc interne — cyan-400, 0.5s */}
        {r.inner > 1 && (
          <circle
            cx={cx} cy={cx} r={r.inner}
            stroke="#38E8FF"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${r.inner * 1.5} ${r.inner * 5}`}
            className="spin-ai-inner"
          />
        )}
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  )
}

// ── SpinnerOverlay — centré dans son conteneur (héritage) ─────────────────────

interface SpinnerOverlayProps extends SpinnerProps {
  text?: string
}

function SpinnerOverlay({ text, size = 'lg', ...spinnerProps }: SpinnerOverlayProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12">
      <Spinner size={size} {...spinnerProps} />
      {text && (
        <p className="font-mono text-xs text-[--text-muted] uppercase tracking-widest animate-pulse">
          {text}
        </p>
      )}
    </div>
  )
}

export { Spinner, SpinnerAI, SpinnerOverlay }
