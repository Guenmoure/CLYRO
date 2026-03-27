import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// ── Variants ──────────────────────────────────────────────────────────────────

const cardVariants = cva(
  // Base
  'rounded-xl border bg-navy-900 text-foreground transition-colors',
  {
    variants: {
      variant: {
        /** Carte standard — fond navy-900, bordure subtile */
        default: 'border-border',
        /** Carte avec halo bleu CLYRO — met en avant un contenu clé */
        glow:    'border-clyro-blue/30 shadow-glow-blue',
        /** Carte avec halo violet — module Motion */
        purple:  'border-clyro-purple/30 shadow-glow-purple',
        /** Carte de succès — feedback positif */
        success: 'border-success/30 bg-success/5',
        /** Carte d'erreur — feedback négatif */
        error:   'border-error/30 bg-error/5',
      },
      padding: {
        none: '',
        sm:   'p-4',
        md:   'p-6',
        lg:   'p-8',
      },
      /** Hover interactif — utile pour les cartes cliquables */
      interactive: {
        true:  'cursor-pointer hover:border-clyro-blue/40 hover:bg-navy-800/50',
        false: '',
      },
    },
    defaultVariants: {
      variant:     'default',
      padding:     'md',
      interactive: false,
    },
  }
)

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

// ── Composants ────────────────────────────────────────────────────────────────

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, padding, interactive, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardVariants({ variant, padding, interactive, className }))}
      {...props}
    />
  )
)
Card.displayName = 'Card'

// Sous-composants pour structurer le contenu d'une carte

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col gap-1.5', className)} {...props} />
  )
)
CardHeader.displayName = 'CardHeader'

const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn('font-display font-semibold text-lg text-foreground leading-heading', className)}
      {...props}
    />
  )
)
CardTitle.displayName = 'CardTitle'

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn('font-body text-sm text-muted-foreground leading-body', className)}
      {...props}
    />
  )
)
CardDescription.displayName = 'CardDescription'

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('pt-4', className)} {...props} />
  )
)
CardContent.displayName = 'CardContent'

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex items-center justify-between pt-4 border-t border-border mt-4', className)}
      {...props}
    />
  )
)
CardFooter.displayName = 'CardFooter'

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, cardVariants }
