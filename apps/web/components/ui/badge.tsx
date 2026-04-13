import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// ── Variants ───────────────────────────────────────────────────────────────────

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider rounded-md border px-2 py-0.5 leading-none whitespace-nowrap',
  {
    variants: {
      variant: {
        success: 'bg-success/15 text-success border-success/30',
        warning: 'bg-warning/15 text-warning border-warning/30',
        error:   'bg-error/15   text-error   border-error/30',
        info:    'bg-blue-500/15 text-blue-300 border-blue-500/30',
        purple:  'bg-purple-500/15 text-purple-400 border-purple-500/30',
        neutral: 'bg-navy-700 text-[--text-secondary] border-navy-600',
      },
    },
    defaultVariants: {
      variant: 'info',
    },
  }
)

// ── Types ──────────────────────────────────────────────────────────────────────

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /** Affiche un point animé (pulse) à gauche — utile pour les statuts live */
  dot?: boolean
  /** Icône Lucide ou autre ReactNode à gauche du texte */
  icon?: React.ReactNode
}

// ── Composant ──────────────────────────────────────────────────────────────────

function Badge({ className, variant, dot = false, icon, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && (
        <span
          className="inline-block w-1.5 h-1.5 rounded-full bg-current animate-pulse shrink-0"
          aria-hidden="true"
        />
      )}
      {icon && !dot && (
        <span className="shrink-0 flex items-center" aria-hidden="true">
          {icon}
        </span>
      )}
      {children}
    </span>
  )
}

export { Badge, badgeVariants }
