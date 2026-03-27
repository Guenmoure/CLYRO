import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// ── Variants ──────────────────────────────────────────────────────────────────

const spinnerVariants = cva(
  // Base — cercle SVG animé, couleur héritée du parent
  'animate-spin shrink-0',
  {
    variants: {
      size: {
        sm: 'h-4 w-4',   // 16px — inline dans les boutons
        md: 'h-6 w-6',   // 24px — loaders de sections
        lg: 'h-10 w-10', // 40px — page entière ou modals
      },
      color: {
        /** Bleu CLYRO — par défaut */
        blue:   'text-clyro-blue',
        /** Violet — module Motion */
        purple: 'text-clyro-purple',
        /** Cyan — effets électriques */
        cyan:   'text-clyro-cyan',
        /** Blanc — sur fonds sombres colorés */
        white:  'text-white',
        /** Hérité du parent — s'adapte au contexte */
        current: 'text-current',
      },
    },
    defaultVariants: {
      size:  'md',
      color: 'blue',
    },
  }
)

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SpinnerProps
  extends Omit<React.SVGAttributes<SVGSVGElement>, 'color'>,
    VariantProps<typeof spinnerVariants> {
  /** Texte pour les lecteurs d'écran */
  label?: string
}

// ── Composant ─────────────────────────────────────────────────────────────────

function Spinner({ className, size, color, label = 'Chargement...', ...props }: SpinnerProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      role="status"
      aria-label={label}
      className={cn(spinnerVariants({ size, color, className }))}
      {...props}
    >
      {/* Piste de fond */}
      <circle
        className="opacity-20"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
      />
      {/* Arc animé */}
      <path
        className="opacity-80"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )
}

// ── Wrapper centré — utile pour les loaders de page ──────────────────────────

interface SpinnerOverlayProps extends SpinnerProps {
  /** Texte affiché sous le spinner */
  text?: string
}

function SpinnerOverlay({ text, size = 'lg', ...spinnerProps }: SpinnerOverlayProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12">
      <Spinner size={size} {...spinnerProps} />
      {text && (
        <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest animate-pulse">
          {text}
        </p>
      )}
    </div>
  )
}

export { Spinner, SpinnerOverlay, spinnerVariants }
