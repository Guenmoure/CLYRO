import * as React from 'react'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Label affiché au-dessus du champ */
  label?: string
  /** Message d'erreur — active la validation visuelle (bordure rouge) */
  error?: string
  /** Texte d'aide affiché sous le champ (remplacé par error si présent) */
  hint?: string
  /** Icône à gauche du champ (ex : composant Lucide) */
  leftIcon?: React.ReactNode
  /** Icône à droite du champ (ex : bouton show/hide password) */
  rightIcon?: React.ReactNode
}

// ── Composant ─────────────────────────────────────────────────────────────────

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      label,
      error,
      hint,
      leftIcon,
      rightIcon,
      id,
      type = 'text',
      ...props
    },
    ref
  ) => {
    // Génère un id stable si non fourni (pour lier label ↔ input)
    const inputId = id ?? React.useId()
    const hasError = Boolean(error)

    return (
      <div className="flex flex-col gap-1.5 w-full">

        {/* Label */}
        {label && (
          <label
            htmlFor={inputId}
            className="font-mono text-xs uppercase tracking-widest text-muted-foreground"
          >
            {label}
          </label>
        )}

        {/* Wrapper pour icônes */}
        <div className="relative">
          {leftIcon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
              {leftIcon}
            </span>
          )}

          <input
            id={inputId}
            type={type}
            ref={ref}
            aria-invalid={hasError}
            aria-describedby={
              hasError ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined
            }
            className={cn(
              // Base
              'w-full bg-navy-800 border rounded-xl text-foreground font-body text-sm',
              'placeholder:text-muted-foreground',
              'transition-colors duration-150',
              'focus:outline-none focus:ring-1',
              // Padding (adapté si icônes présentes)
              leftIcon  ? 'pl-10 pr-4 py-3' : 'px-4 py-3',
              rightIcon ? 'pr-10' : '',
              // État normal
              !hasError && 'border-border focus:border-clyro-blue focus:ring-clyro-blue',
              // État erreur
              hasError  && 'border-red-500/70 focus:border-red-500 focus:ring-red-500/50',
              // Disabled
              'disabled:opacity-50 disabled:cursor-not-allowed',
              className
            )}
            {...props}
          />

          {rightIcon && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {rightIcon}
            </span>
          )}
        </div>

        {/* Message d'erreur (prioritaire) ou hint */}
        {hasError ? (
          <p
            id={`${inputId}-error`}
            role="alert"
            className="font-body text-xs text-red-400 flex items-center gap-1"
          >
            <span aria-hidden="true">✕</span>
            {error}
          </p>
        ) : hint ? (
          <p
            id={`${inputId}-hint`}
            className="font-body text-xs text-muted-foreground"
          >
            {hint}
          </p>
        ) : null}
      </div>
    )
  }
)
Input.displayName = 'Input'

export { Input }
