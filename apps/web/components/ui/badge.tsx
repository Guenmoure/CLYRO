import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// ── Variants ──────────────────────────────────────────────────────────────────

const badgeVariants = cva(
  // Base — pill compact, police mono pour un look technique CLYRO
  'inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider rounded-full border px-2.5 py-1 font-medium leading-none whitespace-nowrap',
  {
    variants: {
      variant: {
        /** success — vert, confirmations & statuts OK */
        success: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
        /** warning — orange, alertes & en attente */
        warning: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
        /** error — rouge, échecs & erreurs */
        error:   'bg-red-500/10   border-red-500/20   text-red-400',
        /** info — bleu CLYRO, informations générales */
        info:    'bg-clyro-blue/10 border-clyro-blue/20 text-clyro-blue',
        /** primary — dégradé bleu→violet, éléments à mettre en valeur */
        primary: 'bg-clyro-blue/10 border-clyro-blue/30 text-clyro-blue',
        /** purple — violet, module Motion */
        purple:  'bg-clyro-purple/10 border-clyro-purple/20 text-clyro-purple',
        /** muted — neutre, statuts secondaires */
        muted:   'bg-navy-800 border-border text-muted-foreground',
      },
      size: {
        sm: 'text-[0.65rem] px-2 py-0.5',
        md: 'text-xs     px-2.5 py-1',
        lg: 'text-sm     px-3 py-1.5',
      },
    },
    defaultVariants: {
      variant: 'info',
      size:    'md',
    },
  }
)

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /** Icône ou point coloré affiché avant le texte */
  dot?: boolean
}

// ── Composant ─────────────────────────────────────────────────────────────────

function Badge({ className, variant, size, dot = false, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(badgeVariants({ variant, size, className }))}
      {...props}
    >
      {dot && (
        <span
          className="inline-block w-1.5 h-1.5 rounded-full bg-current opacity-70 shrink-0"
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  )
}

export { Badge, badgeVariants }
