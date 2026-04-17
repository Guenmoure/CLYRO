'use client'

import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// ── Variants ──────────────────────────────────────────────────────────────────
// IconButton : bouton icon-only accessible (min 44×44 px touch target WCAG).
// La zone cliquable reste ≥ 44×44 même si l'icône visuelle est plus petite,
// grâce au padding et à la min-width/min-height imposés.

const iconButtonVariants = cva(
  [
    'relative inline-flex items-center justify-center shrink-0',
    'rounded-lg transition-all duration-200 select-none',
    'focus-visible:outline-none focus-visible:ring-2',
    'focus-visible:ring-[--ring] focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    'disabled:opacity-40 disabled:pointer-events-none',
    'active:scale-[0.94]',
  ].join(' '),
  {
    variants: {
      variant: {
        /** Fond neutre — action secondaire sur carte */
        ghost: [
          'bg-transparent text-[--text-secondary]',
          'hover:bg-muted hover:text-[--text-primary]',
        ].join(' '),
        /** Fond subtil — action icon-only en toolbar */
        subtle: [
          'bg-muted/60 border border-border text-[--text-secondary]',
          'hover:bg-muted hover:text-[--text-primary] hover:border-blue-500/40',
        ].join(' '),
        /** Destructif — delete scene etc. */
        danger: [
          'bg-transparent text-error/80',
          'hover:bg-error/10 hover:text-error',
        ].join(' '),
        /** Accentué — action primaire icon-only */
        primary: [
          'bg-grad-primary text-white shadow-glow-blue',
          'hover:brightness-110',
        ].join(' '),
      },
      size: {
        /** Surface tactile minimale recommandée WCAG 2.1 AA (44×44) */
        sm: 'h-11 w-11 min-h-[44px] min-w-[44px] [&>svg]:h-4 [&>svg]:w-4',
        /** Par défaut — même touch target, icône plus grande */
        md: 'h-11 w-11 min-h-[44px] min-w-[44px] [&>svg]:h-5 [&>svg]:w-5',
        /** Pour toolbars denses — icône 20px */
        lg: 'h-12 w-12 min-h-[48px] min-w-[48px] [&>svg]:h-5 [&>svg]:w-5',
      },
    },
    defaultVariants: {
      variant: 'ghost',
      size: 'md',
    },
  },
)

// ── Types ──────────────────────────────────────────────────────────────────────

export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof iconButtonVariants> {
  /**
   * Label accessible obligatoire — lu par les lecteurs d'écran.
   * Décrit l'action (ex : "Supprimer la scène", "Fusionner avec la suivante").
   */
  'aria-label': string
  /** Remplace le bouton par un composant enfant (ex : <Link>) */
  asChild?: boolean
  /** Tooltip affiché au hover (title natif) — défaut : aria-label */
  tooltip?: string
}

// ── Composant ──────────────────────────────────────────────────────────────────

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant, size, asChild = false, tooltip, children, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    const label = props['aria-label']

    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : (props.type ?? 'button')}
        title={tooltip ?? label}
        className={cn(iconButtonVariants({ variant, size }), className)}
        {...props}
      >
        {children}
      </Comp>
    )
  },
)
IconButton.displayName = 'IconButton'

export { IconButton, iconButtonVariants }
