import * as React from 'react'
import { cn } from '@/lib/utils'

type Accent = 'blue' | 'emerald' | 'amber' | 'neutral'
type Size   = 'sm' | 'md' | 'lg'

interface EmptyStateProps {
  /** Lucide icon component */
  icon: React.ElementType
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
  /** Accent colour for the icon circle */
  accent?: Accent
  /** Vertical padding / circle size preset */
  size?: Size
  className?: string
}

const ACCENT: Record<Accent, string> = {
  blue:    'from-blue-500/15 to-purple-500/15 text-blue-500 border-border',
  emerald: 'from-emerald-500/15 to-blue-500/15 text-emerald-500 border-border',
  amber:   'from-amber-500/15 to-orange-500/15 text-amber-500 border-border',
  neutral: 'from-muted/50 to-muted/30 text-[--text-muted] border-border',
}

const SIZE: Record<Size, { wrapper: string; circle: string; icon: number; title: string; desc: string }> = {
  sm: { wrapper: 'py-10 px-6', circle: 'w-14 h-14', icon: 22, title: 'text-base', desc: 'max-w-xs' },
  md: { wrapper: 'py-16 px-8', circle: 'w-16 h-16', icon: 26, title: 'text-lg',  desc: 'max-w-sm' },
  lg: { wrapper: 'py-20 px-8', circle: 'w-20 h-20', icon: 32, title: 'text-xl',  desc: 'max-w-md' },
}

/**
 * Unified empty-state component. Accessible (role="status", aria-live="polite").
 * Backwards-compatible with the previous API; new props (accent, size) are optional.
 *
 * @example
 *   <EmptyState icon={Mic2} title="No voices" description="..." accent="emerald" />
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  accent = 'neutral',
  size = 'md',
  className,
}: EmptyStateProps) {
  const s = SIZE[size]
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex flex-col items-center justify-center text-center',
        'bg-muted/50 border border-dashed border-border rounded-2xl',
        s.wrapper,
        className,
      )}
    >
      <div
        className={cn(
          'rounded-2xl border flex items-center justify-center mb-4 bg-gradient-to-br',
          s.circle,
          ACCENT[accent],
        )}
      >
        <Icon size={s.icon} aria-hidden="true" />
      </div>
      <p className={cn('font-display font-semibold text-foreground', s.title)}>{title}</p>
      {description && (
        <p className={cn('text-sm text-[--text-muted] mt-2', s.desc)}>{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
