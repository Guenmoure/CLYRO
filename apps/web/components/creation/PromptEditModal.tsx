'use client'

import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'

// ── Types ──────────────────────────────────────────────────────────────────────

interface PromptEditModalProps {
  isOpen: boolean
  onClose: () => void
  /** Current AI-generated prompt */
  prompt: string
  /** Called when user confirms the (possibly edited) prompt */
  onApply: (newPrompt: string) => void
  /** Called to trigger AI improvement — returns an improved prompt string */
  onImprove?: (prompt: string, feedback: string) => Promise<string>
  /** Title shown in the modal header */
  title?: string
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PromptEditModal({
  isOpen,
  onClose,
  prompt,
  onApply,
  onImprove,
  title = 'Modifier le prompt',
}: PromptEditModalProps) {
  const [editedPrompt,  setEditedPrompt]  = useState(prompt)
  const [feedback,      setFeedback]      = useState('')
  const [improving,     setImproving]     = useState(false)
  const [improveError,  setImproveError]  = useState<string | null>(null)

  // Sync if parent prompt changes while modal is closed
  function handleOpen() {
    setEditedPrompt(prompt)
    setFeedback('')
    setImproveError(null)
  }

  async function handleImprove() {
    if (!onImprove) return
    setImproving(true)
    setImproveError(null)
    try {
      const improved = await onImprove(editedPrompt, feedback)
      setEditedPrompt(improved)
      setFeedback('')
    } catch {
      setImproveError('Impossible d\'améliorer le prompt. Réessaie.')
    } finally {
      setImproving(false)
    }
  }

  function handleApply() {
    onApply(editedPrompt)
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="lg"
      closeOnOverlayClick={!improving}
    >
      <div onFocus={handleOpen} className="space-y-5">

        {/* Editable prompt */}
        <div className="space-y-1.5">
          <label className="font-mono text-xs text-[--text-muted] uppercase tracking-wider">
            Prompt
          </label>
          <textarea
            value={editedPrompt}
            onChange={e => setEditedPrompt(e.target.value)}
            rows={6}
            className="w-full bg-navy-800 border border-navy-600 rounded-xl px-4 py-3 font-body text-sm text-foreground placeholder-[--text-muted] resize-none focus:outline-none focus:border-blue-500/60 transition-colors"
            placeholder="Décris ce que tu veux générer…"
          />
          <p className="font-mono text-[10px] text-[--text-muted] text-right">
            {editedPrompt.length} caractères
          </p>
        </div>

        {/* AI improvement feedback */}
        {onImprove && (
          <div className="space-y-2">
            <label className="font-mono text-xs text-[--text-muted] uppercase tracking-wider">
              Améliorer via IA
            </label>
            <p className="font-body text-xs text-[--text-muted]">
              Indique ce que tu voudrais changer et l'IA mettra à jour le prompt.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={feedback}
                onChange={e => setFeedback(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && feedback.trim() && handleImprove()}
                placeholder="Ex : rends-le plus dramatique, ajoute une voix féminine…"
                className="flex-1 bg-navy-800 border border-navy-600 rounded-xl px-4 py-2 font-body text-sm text-foreground placeholder-[--text-muted] focus:outline-none focus:border-blue-500/60 transition-colors"
                disabled={improving}
              />
              <Button
                variant="secondary"
                size="md"
                onClick={handleImprove}
                disabled={!feedback.trim() || improving}
                loading={improving}
                leftIcon={<Sparkles size={14} />}
              >
                Améliorer
              </Button>
            </div>
            {improveError && (
              <p className="font-mono text-xs text-error">{improveError}</p>
            )}
          </div>
        )}

      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-3 pt-5 mt-5 border-t border-navy-700/50">
        <Button variant="ghost" onClick={onClose} disabled={improving}>
          Annuler
        </Button>
        <Button variant="primary" onClick={handleApply} disabled={!editedPrompt.trim() || improving}>
          Appliquer
        </Button>
      </div>
    </Modal>
  )
}
