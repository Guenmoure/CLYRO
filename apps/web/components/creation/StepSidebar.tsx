'use client'

import { useRef, useState } from 'react'
import { CheckCircle, HelpCircle, Check, Cloud } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'

// ── AutoSaveIndicator ──────────────────────────────────────────────────────────

function formatRelativeSave(date: Date): string {
  const diffMin = Math.round((Date.now() - date.getTime()) / 60_000)
  if (diffMin < 1) return "à l'instant"
  if (diffMin === 1) return 'il y a 1 min'
  if (diffMin < 60)  return `il y a ${diffMin} min`
  return `il y a ${Math.round(diffMin / 60)}h`
}

function AutoSaveIndicator({ lastSaved, isSaving }: { lastSaved?: Date | null; isSaving?: boolean }) {
  if (!lastSaved && !isSaving) {
    return <p className="font-mono text-[11px] text-[--text-muted] mt-1">Non sauvegardé</p>
  }
  return (
    <div className="flex items-center gap-1.5 mt-1" aria-live="polite">
      {isSaving ? (
        <>
          <Cloud size={11} className="text-blue-400 animate-pulse" strokeWidth={1.8} />
          <span className="font-mono text-[11px] text-[--text-muted]">Sauvegarde…</span>
        </>
      ) : lastSaved ? (
        <>
          <Check size={11} className="text-success shrink-0" strokeWidth={2.2} />
          <span className="font-mono text-[11px] text-[--text-muted]">
            Brouillon sauvegardé{' '}
            <span className="opacity-60">{formatRelativeSave(lastSaved)}</span>
          </span>
        </>
      ) : null}
    </div>
  )
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface WizardStep {
  id: string
  label: string
}

interface StepSidebarProps {
  steps: WizardStep[]
  currentStep: number
  projectName: string
  onProjectNameChange: (name: string) => void
  contextualHelp?: string
  lastSaved?: Date | null
  isSaving?: boolean
  onStepClick?: (index: number) => void
}

// ── StepIndicator ──────────────────────────────────────────────────────────────

function StepIndicator({ index, status }: { index: number; status: 'done' | 'active' | 'upcoming' }) {
  if (status === 'done') {
    return (
      <span className="w-6 h-6 rounded-full bg-success/20 border border-success/50 flex items-center justify-center shrink-0">
        <CheckCircle size={13} className="text-success" />
      </span>
    )
  }
  if (status === 'active') {
    return (
      <span className="w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500 flex items-center justify-center shrink-0">
        <span className="font-mono text-xs gradient-text font-bold">{index + 1}</span>
      </span>
    )
  }
  return (
    <span className="w-6 h-6 rounded-full bg-muted border border-border flex items-center justify-center shrink-0">
      <span className="font-mono text-xs text-[--text-muted]">{index + 1}</span>
    </span>
  )
}

// ── StepSidebar (Desktop) ──────────────────────────────────────────────────────

function DesktopSidebar({
  steps, currentStep, projectName, onProjectNameChange,
  contextualHelp, lastSaved, isSaving, onStepClick,
}: StepSidebarProps) {
  const [editing, setEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function startEdit() {
    setEditing(true)
    setTimeout(() => inputRef.current?.select(), 10)
  }

  function stopEdit() {
    setEditing(false)
  }

  return (
    <aside className="hidden md:flex w-64 bg-card border-r border-border/50 flex-col h-full py-6 px-4 shrink-0">

      {/* Project name */}
      <div>
        {editing ? (
          <input
            ref={inputRef}
            value={projectName}
            onChange={e => onProjectNameChange(e.target.value)}
            onBlur={stopEdit}
            onKeyDown={e => e.key === 'Enter' && stopEdit()}
            className="w-full bg-muted border border-blue-500 rounded-lg px-2 py-1 font-display text-sm text-foreground focus:outline-none"
            autoFocus
          />
        ) : (
          <button
            type="button"
            onClick={startEdit}
            className="w-full text-left font-display text-sm text-foreground hover:text-blue-400 transition-colors truncate"
          >
            {projectName || 'Nouveau projet'}
          </button>
        )}
        <AutoSaveIndicator lastSaved={lastSaved} isSaving={isSaving} />
      </div>

      {/* Steps list */}
      <nav className="flex-1 mt-8 space-y-0">
        {steps.map((step, i) => {
          const status: 'done' | 'active' | 'upcoming' =
            i < currentStep ? 'done' : i === currentStep ? 'active' : 'upcoming'
          const canClick = i <= currentStep

          return (
            <div key={step.id}>
              <button
                type="button"
                onClick={() => canClick && onStepClick?.(i)}
                disabled={!canClick}
                className={cn(
                  'group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150',
                  status === 'active' && 'bg-muted',
                  canClick && status !== 'active' && 'hover:bg-muted/50 cursor-pointer',
                  !canClick && 'cursor-default',
                )}
              >
                <StepIndicator index={i} status={status} />
                <span className={cn(
                  'font-body text-sm truncate text-left',
                  status === 'done'     && 'text-[--text-secondary] line-through opacity-60',
                  status === 'active'   && 'text-foreground font-display',
                  status === 'upcoming' && 'text-[--text-muted]',
                )}>
                  {step.label}
                </span>
              </button>

              {/* Vertical connector */}
              {i < steps.length - 1 && (
                <div className={cn(
                  'w-px h-4 ml-[22px] my-0',
                  i < currentStep ? 'bg-success/40' : 'bg-border',
                )} />
              )}
            </div>
          )
        })}
      </nav>

      {/* Contextual help */}
      {contextualHelp && (
        <Card variant="glass" className="p-3 rounded-xl mt-4">
          <div className="flex gap-2">
            <HelpCircle size={14} className="text-blue-400 shrink-0 mt-0.5" />
            <p className="font-body text-xs text-[--text-muted] leading-relaxed">
              {contextualHelp}
            </p>
          </div>
        </Card>
      )}
    </aside>
  )
}

// ── Mobile horizontal stepper ──────────────────────────────────────────────────

function MobileStepper({ steps, currentStep, onStepClick }: Pick<StepSidebarProps, 'steps' | 'currentStep' | 'onStepClick'>) {
  return (
    <div className="md:hidden flex items-center overflow-x-auto py-3 px-4 bg-card border-b border-border/50 gap-2 no-scrollbar">
      {steps.map((step, i) => {
        const status: 'done' | 'active' | 'upcoming' =
          i < currentStep ? 'done' : i === currentStep ? 'active' : 'upcoming'
        return (
          <div key={step.id} className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => i <= currentStep && onStepClick?.(i)}
              className="flex items-center gap-1.5"
            >
              <StepIndicator index={i} status={status} />
              {status === 'active' && (
                <span className="font-mono text-xs text-foreground whitespace-nowrap">{step.label}</span>
              )}
            </button>
            {i < steps.length - 1 && (
              <div className={cn('h-px w-4', i < currentStep ? 'bg-success/40' : 'bg-border')} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Export ─────────────────────────────────────────────────────────────────────

export function StepSidebar(props: StepSidebarProps) {
  return (
    <>
      <DesktopSidebar {...props} />
      <MobileStepper
        steps={props.steps}
        currentStep={props.currentStep}
        onStepClick={props.onStepClick}
      />
    </>
  )
}
