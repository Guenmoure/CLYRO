'use client'

import { useState } from 'react'
import { CheckCircle, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SpinnerAI } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface GenerationStage {
  main: string
  sub: string
}

interface GenerationOverlayProps {
  visible: boolean
  progress: number           // 0-100
  stages: GenerationStage[]
  currentStage: number       // 0-indexed
  completedSteps: string[]   // labels of completed steps for the log
  onCancel: () => Promise<void> | void
  className?: string
}

// ── Overlay ────────────────────────────────────────────────────────────────────

export function GenerationOverlay({
  visible,
  progress,
  stages,
  currentStage,
  completedSteps,
  onCancel,
}: GenerationOverlayProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [cancelling,  setCancelling]  = useState(false)

  if (!visible) return null

  const stage = stages[Math.min(currentStage, stages.length - 1)] ?? { main: 'Génération…', sub: '' }
  const pct = Math.min(100, Math.max(0, Math.round(progress)))

  async function handleConfirmCancel() {
    setCancelling(true)
    try {
      await onCancel()
    } finally {
      setCancelling(false)
      setConfirmOpen(false)
    }
  }

  const last3 = completedSteps.slice(-3)

  return (
    <>
      {/* Full-screen overlay */}
      <div
        className={cn(
          'fixed inset-0 z-50 bg-background/95 backdrop-blur-sm',
          'flex flex-col items-center justify-center gap-8 px-6',
          'animate-fade-up',
        )}
        role="status"
        aria-live="polite"
        aria-label={stage.main}
      >
        {/* Spinner */}
        <SpinnerAI size="xl" label={stage.main} />

        {/* Messages */}
        <div className="text-center">
          <p className="font-display text-2xl text-foreground">{stage.main}</p>
          {stage.sub && (
            <p className="font-mono text-sm text-[--text-muted] mt-2">{stage.sub}</p>
          )}
        </div>

        {/* Progress bar */}
        <div className="w-80">
          <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-grad-primary rounded-full transition-all duration-500 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="font-mono text-xs text-[--text-muted] mt-2 text-right">{pct}%</p>
        </div>

        {/* Completed steps log */}
        {last3.length > 0 && (
          <div className="max-w-sm w-full space-y-2">
            {last3.map((step, i) => (
              <div
                key={step}
                className="flex items-center gap-2 animate-fade-up"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <CheckCircle size={12} className="text-success shrink-0" />
                <span className="font-mono text-xs text-[--text-muted]">{step}</span>
              </div>
            ))}
          </div>
        )}

        {/* Cancel button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setConfirmOpen(true)}
          className="mt-4 text-[--text-muted] hover:text-foreground"
        >
          Annuler la génération
        </Button>
      </div>

      {/* Confirmation modal */}
      <Modal
        isOpen={confirmOpen}
        onClose={() => !cancelling && setConfirmOpen(false)}
        title="Annuler la génération ?"
        size="sm"
      >
        <Modal.Body>
          <p className="font-body text-sm text-[--text-secondary]">
            La progression sera perdue. Tu pourras relancer la génération depuis le début.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={cancelling}>
            Continuer
          </Button>
          <Button variant="danger" loading={cancelling} onClick={handleConfirmCancel}>
            Annuler quand même
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  )
}
