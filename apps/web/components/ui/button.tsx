'use client'

import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// ── Spinner inline (taille xs, pas de dépendance externe) ─────────────────────

function ButtonSpinner() {
  return (
    <svg
      className="animate-spin h-3.5 w-3.5 shrink-0"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path
        className="opacity-80"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  )
}

// ── Variants ───────────────────────────────────────────────────────────────────

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl',
    'transition-all duration-200 select-none',
    'focus-visible:outline-none focus-visible:ring-2',
    'focus-visible:ring-blue-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    'disabled:opacity-40 disabled:pointer-events-none',
    'active:scale-[0.97]',
  ].join(' '),
  {
    variants: {
      variant: {
        /** CTA principal — gradient bleu→violet, glow bleu */
        primary: [
          'bg-grad-primary text-white font-display font-semibold',
          'shadow-glow-blue hover:brightness-110 hover:shadow-[0_0_28px_rgba(59,142,240,0.5)]',
        ].join(' '),
        /** Surface sombre, bordure subtile */
        secondary: [
          'bg-muted border border-border text-foreground font-display',
          'hover:bg-border hover:border-blue-500/50',
        ].join(' '),
        /** Discret, sans fond */
        ghost: [
          'bg-transparent text-[--text-secondary] font-display',
          'hover:bg-muted hover:text-[--text-primary]',
        ].join(' '),
        /** Destructif — rouge erreur */
        danger: [
          'bg-error/10 border border-error/30 text-error font-display',
          'hover:bg-error/20',
        ].join(' '),
        /** Effet néon cyan→bleu→violet */
        electric: [
          'bg-grad-electric text-gray-950 font-display font-bold',
          'hover:brightness-110',
        ].join(' '),
      },
      size: {
        sm:  'h-7  px-3   text-xs  font-mono uppercase tracking-wider',
        md:  'h-9  px-4   text-sm',
        lg:  'h-11 px-6   text-base',
        icon:'h-9  w-9',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size:    'md',
    },
  }
)

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Remplace le bouton par un composant enfant (ex : <Link>) */
  asChild?: boolean
  /** Affiche un spinner et désactive le bouton */
  loading?: boolean
  /** Icône à gauche du texte */
  leftIcon?: React.ReactNode
  /** Icône à droite du texte */
  rightIcon?: React.ReactNode
  /** Étire le bouton sur toute la largeur disponible */
  fullWidth?: boolean
}

// ── Composant ──────────────────────────────────────────────────────────────────

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      disabled,
      leftIcon,
      rightIcon,
      fullWidth = false,
      children,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : 'button'

    return (
      <Comp
        ref={ref}
        className={cn(
          buttonVariants({ variant, size }),
          fullWidth && 'w-full',
          loading && 'opacity-70',
          className
        )}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? (
          <>
            <ButtonSpinner />
            {children}
          </>
        ) : (
          <>
            {leftIcon && <span aria-hidden="true">{leftIcon}</span>}
            {children}
            {rightIcon && <span aria-hidden="true">{rightIcon}</span>}
          </>
        )}
      </Comp>
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
