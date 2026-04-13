'use client'

import React, { useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

// ── Size map ───────────────────────────────────────────────────────────────────

const SIZE: Record<string, string> = {
  sm:   'max-w-sm',
  md:   'max-w-md',
  lg:   'max-w-lg',
  xl:   'max-w-2xl',
  full: 'max-w-4xl',
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  scrollable?: boolean
  footer?: React.ReactNode
  closeOnOverlayClick?: boolean
  closeOnEscape?: boolean
  children: React.ReactNode
  className?: string
}

// ── Close button icon ──────────────────────────────────────────────────────────

function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

// ── Composant ──────────────────────────────────────────────────────────────────

function Modal({
  isOpen,
  onClose,
  title,
  size = 'md',
  scrollable = false,
  footer,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  children,
  className,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)

  // Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => { if (closeOnEscape && e.key === 'Escape') onClose() },
    [onClose, closeOnEscape]
  )

  useEffect(() => {
    if (!isOpen) return
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    // Focus trap — focus premier élément focusable
    requestAnimationFrame(() => {
      const el = dialogRef.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      el?.focus()
    })
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [isOpen, handleKeyDown])

  if (!isOpen || typeof window === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-navy-950/80 backdrop-blur-sm animate-fade-in"
        aria-hidden="true"
        onClick={closeOnOverlayClick ? onClose : undefined}
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        className={cn(
          'relative w-full bg-navy-900 border border-navy-700/50',
          'rounded-2xl shadow-card-hover animate-fade-up',
          SIZE[size],
          className
        )}
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between p-6 border-b border-navy-700/50">
            <h2 id="modal-title" className="font-display text-lg text-foreground">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer"
              className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                'text-[--text-muted] hover:text-foreground',
                'hover:bg-navy-800 border border-transparent hover:border-navy-600',
                'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50'
              )}
            >
              <XIcon />
            </button>
          </div>
        )}

        {/* Close button (sans titre) */}
        {!title && (
          <button
            onClick={onClose}
            aria-label="Fermer"
            className={cn(
              'absolute top-4 right-4 z-10 w-8 h-8 rounded-lg flex items-center justify-center',
              'text-[--text-muted] hover:text-foreground',
              'hover:bg-navy-800 border border-transparent hover:border-navy-600',
              'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50'
            )}
          >
            <XIcon />
          </button>
        )}

        {/* Body */}
        <div className={cn('p-6', scrollable && 'overflow-y-auto max-h-[70vh]')}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-3 px-6 pb-6 pt-4 border-t border-navy-700/50">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

// ── Sous-composants structurels ────────────────────────────────────────────────

function ModalHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('px-6 pt-6 pb-4 border-b border-navy-700/50', className)} {...props}>
      {children}
    </div>
  )
}

function ModalBody({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('p-6', className)} {...props}>
      {children}
    </div>
  )
}

function ModalFooter({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('px-6 pb-6 pt-4 border-t border-navy-700/50 flex items-center justify-end gap-3', className)} {...props}>
      {children}
    </div>
  )
}

Modal.Header = ModalHeader
Modal.Body   = ModalBody
Modal.Footer = ModalFooter

export { Modal }
