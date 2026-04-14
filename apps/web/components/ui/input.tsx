import * as React from 'react'
import { cn } from '@/lib/utils'

// ── AlertCircle icon (inline — pas de dep Lucide dans le composant de base) ───

function AlertCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      width="12" height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  )
}

// ── Input ──────────────────────────────────────────────────────────────────────

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, leftIcon, rightIcon, id, type = 'text', ...props }, ref) => {
    const inputId  = id ?? React.useId()
    const hasError = Boolean(error)

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="font-mono text-xs uppercase tracking-wider text-[--text-secondary]"
          >
            {label}
          </label>
        )}

        <div className="relative">
          {leftIcon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[--text-muted] pointer-events-none flex items-center">
              {leftIcon}
            </span>
          )}

          <input
            id={inputId}
            ref={ref}
            type={type}
            aria-invalid={hasError ? true : undefined}
            aria-describedby={hasError ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
            className={cn(
              'w-full h-10 rounded-xl font-body text-sm',
              'bg-muted text-foreground placeholder:text-[--text-muted]',
              'border transition-colors duration-200',
              'outline-none ring-0',
              leftIcon  ? 'pl-10 pr-4' : 'px-4',
              rightIcon ? 'pr-10'      : '',
              // États
              !hasError && [
                'border-border',
                'focus:border-blue-500 focus:bg-border',
              ],
              hasError && 'border-error bg-error/5 focus:border-error',
              'disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-card',
              className
            )}
            {...props}
          />

          {rightIcon && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[--text-muted] flex items-center">
              {rightIcon}
            </span>
          )}
        </div>

        {hasError ? (
          <p id={`${inputId}-error`} role="alert" className="flex items-center gap-1 text-xs text-error">
            <AlertCircleIcon />
            {error}
          </p>
        ) : hint ? (
          <p id={`${inputId}-hint`} className="text-xs text-[--text-muted] font-body">
            {hint}
          </p>
        ) : null}
      </div>
    )
  }
)
Input.displayName = 'Input'

// ── Textarea ───────────────────────────────────────────────────────────────────

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  hint?: string
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, hint, id, rows = 4, ...props }, ref) => {
    const textareaId = id ?? React.useId()
    const hasError   = Boolean(error)

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label
            htmlFor={textareaId}
            className="font-mono text-xs uppercase tracking-wider text-[--text-secondary]"
          >
            {label}
          </label>
        )}

        <textarea
          id={textareaId}
          ref={ref}
          rows={rows}
          aria-invalid={hasError ? true : undefined}
          aria-describedby={hasError ? `${textareaId}-error` : hint ? `${textareaId}-hint` : undefined}
          className={cn(
            'w-full rounded-xl px-4 py-2.5 font-body text-sm resize-none',
            'bg-muted text-foreground placeholder:text-[--text-muted]',
            'border transition-colors duration-200 outline-none',
            !hasError && 'border-border focus:border-blue-500 focus:bg-border',
            hasError  && 'border-error bg-error/5 focus:border-error',
            'disabled:opacity-40 disabled:cursor-not-allowed',
            className
          )}
          {...props}
        />

        {hasError ? (
          <p id={`${textareaId}-error`} role="alert" className="flex items-center gap-1 text-xs text-error">
            <AlertCircleIcon />
            {error}
          </p>
        ) : hint ? (
          <p id={`${textareaId}-hint`} className="text-xs text-[--text-muted] font-body">
            {hint}
          </p>
        ) : null}
      </div>
    )
  }
)
Textarea.displayName = 'Textarea'

// ── InputGroup — Input + Button collés ────────────────────────────────────────

export interface InputGroupProps {
  inputProps: InputProps
  action: React.ReactNode
  className?: string
}

function InputGroup({ inputProps, action, className }: InputGroupProps) {
  return (
    <div className={cn('flex items-stretch gap-0 w-full', className)}>
      <div className="flex-1 [&_input]:rounded-r-none [&_input]:border-r-0">
        <Input {...inputProps} />
      </div>
      <div className="shrink-0 [&_button]:rounded-l-none [&_button]:h-10 self-end">
        {action}
      </div>
    </div>
  )
}

export { Input, Textarea, InputGroup }
