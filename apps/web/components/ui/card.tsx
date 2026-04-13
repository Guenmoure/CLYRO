import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// ── Variants ───────────────────────────────────────────────────────────────────

const cardVariants = cva(
  'relative rounded-2xl text-foreground transition-all duration-200',
  {
    variants: {
      variant: {
        /** Carte standard — fond navy-900, bordure subtile */
        default: 'bg-navy-900 border border-navy-700/50 shadow-card',
        /** Glassmorphism — overlays de génération en cours */
        glass:   'glass',
        /** Card de scènes et assets — fond navy-800 plus élevé */
        elevated:'bg-navy-800 border border-navy-600 shadow-card-hover',
        /** Plans tarifaires & feature highlights — gradient border */
        gradient:[
          'bg-navy-900 border border-transparent',
          'before:absolute before:inset-0 before:rounded-2xl before:-z-10 before:p-px',
          'before:bg-gradient-to-br before:from-blue-500/20 before:to-purple-500/20',
        ].join(' '),
      },
      padding: {
        none: '',
        sm:   'p-4',
        md:   'p-6',
        lg:   'p-8',
      },
      hoverable: {
        true:  'cursor-pointer hover:shadow-card-hover hover:border-navy-600',
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
      className={cn('px-6 pb-6 border-t border-navy-700/50 pt-4 flex items-center justify-between', className)}
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
