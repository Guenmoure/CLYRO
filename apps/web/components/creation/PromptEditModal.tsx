'use client'

import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/lib/i18n'

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
  title,
}: PromptEditModalProps) {
  const { t } = useLanguage()
  const resolvedTitle = title ?? t('pe_editPrompt')
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
      setImproveError(t('pe_improveError'))
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
      title={resolvedTitle}
      size="lg"
      closeOnOverlayClick={!improving}
    >
      <div onFocus={handleOpen} className="space-y-5">

        {/* Editable prompt */}
        <div className="space-y-1.5">
          <label
            htmlFor="prompt-edit-textarea"
            className="font-mono text-xs text-[--text-muted] uppercase tracking-wider"
          >
            {t('pe_promptLabel')}
          </label>
          <textarea
            id="prompt-edit-textarea"
            name="prompt"
            autoComplete="off"
            value={editedPrompt}
            onChange={e => setEditedPrompt(e.target.value)}
            rows={6}
            className="w-full bg-muted border border-border rounded-xl px-4 py-3 font-body text-sm text-foreground placeholder-[--text-muted] resize-none focus:outline-none focus:border-primary transition-colors"
            placeholder={t('pe_placeholder')}
          />
          <p className="font-mono text-[11px] text-[--text-muted] text-right">
            {t('pe_characters').replace('{n}', String(editedPrompt.length))}
          </p>
        </div>

        {/* AI improvement feedback */}
        {onImprove && (
          <div className="space-y-2">
            <label
              htmlFor="prompt-edit-feedback"
              className="font-mono text-xs text-[--text-muted] uppercase tracking-wider"
            >
              {t('pe_improveLabel')}
            </label>
            <p className="font-body text-xs text-[--text-muted]">
              {t('pe_improveHelp')}
            </p>
            <div className="flex gap-2">
              <input
                id="prompt-edit-feedback"
                name="prompt-feedback"
                type="text"
                autoComplete="off"
                value={feedback}
                onChange={e => setFeedback(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && feedback.trim() && handleImprove()}
                placeholder={t('pe_improvePlaceholder')}
                className="flex-1 bg-muted border border-border rounded-xl px-4 py-2 font-body text-sm text-foreground placeholder-[--text-muted] focus:outline-none focus:border-primary transition-colors"
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
                {t('pe_improveBtn')}
              </Button>
            </div>
            {improveError && (
              <p className="font-mono text-xs text-error">{improveError}</p>
            )}
          </div>
        )}

      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-3 pt-5 mt-5 border-t border-border/50">
        <Button variant="ghost" onClick={onClose} disabled={improving}>
          {t('pe_cancel')}
        </Button>
        <Button variant="primary" onClick={handleApply} disabled={!editedPrompt.trim() || improving}>
          {t('pe_apply')}
        </Button>
      </div>
    </Modal>
  )
}
