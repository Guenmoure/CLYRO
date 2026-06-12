'use client'

import { useState } from 'react'
import { CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SpinnerAI } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/lib/i18n'

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
  /**
   * "Continue in background" handler — leaves the overlay WITHOUT
   * stopping the job. The generation keeps running and the dashboard
   * card tracks progress via Realtime.
   */
  onCancel: () => Promise<void> | void
  /**
   * REAL cancellation handler — calls POST /api/v1/videos/:id/cancel,
   * which stops the job (queue removal or pipeline cooperation) and
   * refunds the full credit cost. Optional: when omitted, only the
   * "continue in background" action is shown (legacy behaviour).
   */
  onCancelGeneration?: () => Promise<void> | void
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
  onCancelGeneration,
}: GenerationOverlayProps) {
  const { t } = useLanguage()
  const [leaving, setLeaving] = useState(false)
  // Inline mini-confirmation state for the destructive cancel action.
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  if (!visible) return null

  const stage = stages[Math.min(currentStage, stages.length - 1)] ?? { main: t('go_generating'), sub: '' }
  const pct = Math.min(100, Math.max(0, Math.round(progress)))

  async function handleContinueInBackground() {
    setLeaving(true)
    try {
      await onCancel()
    } finally {
      setLeaving(false)
    }
  }

  async function handleConfirmCancel() {
    if (!onCancelGeneration) return
    setCancelling(true)
    try {
      await onCancelGeneration()
    } finally {
      setCancelling(false)
      setConfirmingCancel(false)
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

        {/* Continue in background — the job itself keeps running server-side */}
        <div className="mt-4 flex flex-col items-center gap-2">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              loading={leaving}
              onClick={handleContinueInBackground}
              className="text-[--text-muted] hover:text-foreground"
            >
              {t('go_background_btn')}
            </Button>
            {/* Real cancellation — stops the job + full refund */}
            {onCancelGeneration && !confirmingCancel && (
              <Button
                variant="ghost"
                size="sm"
                disabled={cancelling}
                onClick={() => setConfirmingCancel(true)}
                className="text-red-400/80 hover:text-red-400 hover:bg-red-500/10"
              >
                {t('go_cancel_btn')}
              </Button>
            )}
          </div>

          {/* Inline mini-confirmation for the destructive cancel */}
          {onCancelGeneration && confirmingCancel ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
              <p className="font-body text-xs text-[--text-secondary] text-center">
                {t('go_cancel_note')}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="danger"
                  size="sm"
                  loading={cancelling}
                  onClick={handleConfirmCancel}
                >
                  {t('go_cancel_confirm')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={cancelling}
                  onClick={() => setConfirmingCancel(false)}
                  className="text-[--text-muted] hover:text-foreground"
                >
                  {t('go_cancel_keep')}
                </Button>
              </div>
            </div>
          ) : (
            <p className="font-body text-xs text-[--text-muted] max-w-xs text-center">
              {t('go_background_note')}
            </p>
          )}
        </div>
      </div>
    </>
  )
}
