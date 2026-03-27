'use client'

import React, { useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ModalProps {
  /** Contrôle la visibilité de la modale */
  isOpen: boolean
  /** Appelé quand l'utilisateur ferme la modale (croix, overlay, Escape) */
  onClose: () => void
  /** Titre affiché dans le header */
  title?: string
  /** Description courte sous le titre */
  description?: string
  /** Contenu principal */
  children: React.ReactNode
  /** Pied de modale — typiquement des boutons d'action */
  footer?: React.ReactNode
  /** Largeur max de la modale */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  /** Empêche la fermeture en cliquant sur l'overlay */
  disableOverlayClose?: boolean
  /** Classes CSS supplémentaires sur le conteneur de la modale */
  className?: string
}

// ── Tailles ───────────────────────────────────────────────────────────────────

const SIZE_CLASSES: Record<NonNullable<ModalProps['size']>, string> = {
  sm:   'max-w-sm',
  md:   'max-w-md',
  lg:   'max-w-lg',
  xl:   'max-w-2xl',
  full: 'max-w-[95vw]',
}

// ── Composant ─────────────────────────────────────────────────────────────────

function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  disableOverlayClose = false,
  className,
}: ModalProps) {

  // Fermeture sur Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose]
  )

  useEffect(() => {
    if (!isOpen) return
    document.addEventListener('keydown', handleKeyDown)
    // Empêche le scroll du body pendant que la modale est ouverte
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [isOpen, handleKeyDown])

  if (!isOpen) return null

  return (
    // Portail — rendu à la racine du DOM via z-index élevé
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      {/* Overlay sombre avec blur */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-hidden="true"
        onClick={disableOverlayClose ? undefined : onClose}
      />

      {/* Fenêtre modale */}
      <div
        className={cn(
          'relative w-full bg-navy-900 border border-border rounded-2xl shadow-xl',
          'animate-fade-in',
          SIZE_CLASSES[size],
          className
        )}
      >
        {/* Header */}
        {(title || description) && (
          <div className="flex items-start justify-between gap-4 p-6 border-b border-border">
            <div className="flex-1 min-w-0">
              {title && (
                <h2
                  id="modal-title"
                  className="font-display font-semibold text-lg text-foreground leading-heading"
                >
                  {title}
                </h2>
              )}
              {description && (
                <p className="font-body text-sm text-muted-foreground mt-1 leading-body">
                  {description}
                </p>
              )}
            </div>

            {/* Bouton fermeture */}
            <button
              onClick={onClose}
              aria-label="Fermer la fenêtre"
              className={cn(
                'shrink-0 w-8 h-8 rounded-lg flex items-center justify-center',
                'text-muted-foreground hover:text-foreground',
                'bg-transparent hover:bg-navy-800',
                'border border-transparent hover:border-border',
                'transition-colors focus-visible:outline-none focus-visible:ring-2',
                'focus-visible:ring-ring focus-visible:ring-offset-2'
              )}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16" height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}

        {/* Si pas de header : bouton fermeture flottant */}
        {!title && !description && (
          <button
            onClick={onClose}
            aria-label="Fermer la fenêtre"
            className={cn(
              'absolute top-4 right-4 z-10',
              'w-8 h-8 rounded-lg flex items-center justify-center',
              'text-muted-foreground hover:text-foreground',
              'hover:bg-navy-800 border border-transparent hover:border-border',
              'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
            )}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16" height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}

        {/* Contenu */}
        <div className="p-6">
          {children}
        </div>

        {/* Footer optionnel */}
        {footer && (
          <div className="flex items-center justify-end gap-3 px-6 pb-6 pt-0 border-t border-border mt-0 pt-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

export { Modal }
