import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// ── Variants ──────────────────────────────────────────────────────────────────

const buttonVariants = cva(
  // Base — commun à tous les variants
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-display font-semibold ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        // primary (alias: default) — CTA principal, dégradé bleu→violet
        primary:     'bg-grad-primary text-white hover:opacity-90 active:scale-[0.98]',
        default:     'bg-grad-primary text-white hover:opacity-90 active:scale-[0.98]',
        // secondary — surface navy, bordure subtile
        secondary:   'bg-navy-800 text-foreground border border-border hover:bg-navy-700 active:scale-[0.98]',
        // outline — contour bleu CLYRO
        outline:     'border border-clyro-blue text-clyro-blue hover:bg-clyro-blue/10 active:scale-[0.98]',
        // ghost — discret, sans fond
        ghost:       'text-muted-foreground hover:text-foreground hover:bg-navy-800 active:scale-[0.98]',
        // danger — rouge, pour actions destructives (rename de destructive)
        danger:      'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 active:scale-[0.98]',
        destructive: 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 active:scale-[0.98]',
        // electric — effet néon cyan→bleu→violet
        electric:    'bg-grad-electric text-navy-950 hover:opacity-90 font-bold active:scale-[0.98]',
      },
      size: {
        sm:      'h-9  px-4 text-xs',
        md:      'h-11 px-6 text-sm',
        default: 'h-11 px-6 text-sm',
        lg:      'h-13 px-8 text-base',
        icon:    'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size:    'default',
    },
  }
)

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Remplace le bouton par un composant enfant (ex : <a>, <Link>) */
  asChild?: boolean
  /** Affiche un spinner et désactive le bouton pendant un chargement */
  loading?: boolean
  /** Texte affiché pendant le chargement (remplace le contenu) */
  loadingText?: string
}

// ── Spinner inline ────────────────────────────────────────────────────────────

function ButtonSpinner() {
  return (
    <svg
      className="animate-spin h-4 w-4 shrink-0"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12" cy="12" r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  )
}

// ── Composant ─────────────────────────────────────────────────────────────────

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      loadingText,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : 'button'

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading}
        {...props}
      >
        {loading ? (
          <>
            <ButtonSpinner />
            {loadingText ?? children}
          </>
        ) : (
          children
        )}
      </Comp>
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
