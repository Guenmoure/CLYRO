import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// ── Variants ───────────────────────────────────────────────────────────────────

const cardVariants = cva(
  'relative rounded-2xl text-foreground transition-all duration-200',
  {
    variants: {
      variant: {
        /** Carte standard — fond card, bordure subtile */
        default: 'bg-card border border-border/50 shadow-card',
        /** Glassmorphism — overlays de génération en cours */
        glass:   'glass',
        /** Card de scènes et assets — fond muted plus élevé */
        elevated:'bg-muted border border-border shadow-card-hover',
        /** Plans tarifaires & feature highlights — gradient border */
        gradient:[
          'bg-card border border-transparent',
          'before:absolute before:inset-0 before:rounded-2xl before:-z-10 before:p-px',
          'before:bg-gradient-to-br before:from-blue-500/20 before:to-purple-500/20',
        ].join(' '),
        /** Carte entièrement cliquable — navigation cards */
        interactive: [
          'bg-card border border-border/50 shadow-card cursor-pointer',
          'hover:border-border hover:shadow-card-hover hover:-translate-y-0.5',
          'active:scale-[0.99] active:shadow-card',
        ].join(' '),
        /** Carte mise en avant — plan Pro, direction recommandée */
        highlight: [
          'bg-card border-2 border-[--primary]/50',
          'shadow-[0_0_30px_rgba(59,142,240,0.12)]',
        ].join(' '),
      },
      padding: {
        none: '',
        sm:   'p-4',
        md:   'p-6',
        lg:   'p-8',
        xl:   'p-10',
      },
      hoverable: {
        true:  'cursor-pointer hover:shadow-card-hover hover:border-border',
        false: '',
      },
    },
    defaultVariants: {
      variant:  'default',
      padding:  'md',
      hoverable: false,
    },
  }
)

// ── Types ──────────────────────────────────────────────────────────────────────

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

// ── Composant principal ────────────────────────────────────────────────────────

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, padding, hoverable, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardVariants({ variant, padding, hoverable }), className)}
      {...props}
    />
  )
)
Card.displayName = 'Card'

// ── Sous-composants ────────────────────────────────────────────────────────────

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('px-6 pt-6 pb-4', className)}
      {...props}
    />
  )
)
CardHeader.displayName = 'CardHeader'

const CardBody = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('px-6 pb-6', className)}
      {...props}
    />
  )
)
CardBody.displayName = 'CardBody'

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('px-6 pb-6 border-t border-border/50 pt-4 flex items-center justify-between', className)}
      {...props}
    />
  )
)
CardFooter.displayName = 'CardFooter'

// Héritage shadcn (compat composants existants)
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
      className={cn('font-body text-sm text-[--text-secondary] leading-body', className)}
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

export {
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
  cardVariants,
}
