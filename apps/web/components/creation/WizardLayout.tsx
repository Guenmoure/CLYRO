'use client'

import { ArrowLeft, Save } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { StepSidebar, type WizardStep } from './StepSidebar'

// ── Types ──────────────────────────────────────────────────────────────────────

interface WizardLayoutProps {
  /** Feature title shown in the top bar (e.g. "Faceless Videos") */
  featureTitle: string
  steps: WizardStep[]
  currentStep: number
  projectName: string
  onProjectNameChange: (name: string) => void
  contextualHelp?: string
  lastSaved?: Date | null
  onStepClick?: (index: number) => void
  /** Called when the user clicks "Retour" in the top bar */
  onBack?: () => void
  /** Called when the user clicks "Sauvegarder" in the top bar */
  onSave?: () => void | Promise<void>
  isSaving?: boolean
  /** Bottom bar props */
  canPrev?: boolean
  canNext?: boolean
  onPrev?: () => void
  onNext?: () => void
  nextLabel?: string
  isNextLoading?: boolean
  /** Main content */
  children: React.ReactNode
}

// ── WizardTopBar ───────────────────────────────────────────────────────────────

function WizardTopBar({
  featureTitle,
  onBack,
  onSave,
  isSaving,
}: {
  featureTitle: string
  onBack?: () => void
  onSave?: () => void | Promise<void>
  isSaving?: boolean
}) {
  const router = useRouter()

  function handleBack() {
    if (onBack) {
      onBack()
    } else {
      router.back()
    }
  }

  return (
    <header className="h-14 shrink-0 flex items-center justify-between px-4 border-b border-navy-700/50 bg-navy-900">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleBack}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-[--text-muted] hover:text-foreground hover:bg-navy-800 transition-colors"
          aria-label="Retour"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="h-4 w-px bg-navy-700" />
        <p className="font-display text-sm text-foreground">{featureTitle}</p>
      </div>

      {onSave && (
        <Button
          variant="secondary"
          size="sm"
          loading={isSaving}
          onClick={() => onSave()}
          leftIcon={<Save size={12} />}
        >
          Sauvegarder
        </Button>
      )}
    </header>
  )
}

// ── WizardBottomBar ────────────────────────────────────────────────────────────

function WizardBottomBar({
  canPrev,
  canNext,
  onPrev,
  onNext,
  nextLabel = 'Suivant',
  isNextLoading,
  currentStep,
  totalSteps,
}: {
  canPrev?: boolean
  canNext?: boolean
  onPrev?: () => void
  onNext?: () => void
  nextLabel?: string
  isNextLoading?: boolean
  currentStep: number
  totalSteps: number
}) {
  const isLast = currentStep >= totalSteps - 1

  return (
    <footer className="h-16 shrink-0 flex items-center justify-between px-6 border-t border-navy-700/50 bg-navy-900">
      <Button
        variant="ghost"
        size="md"
        disabled={!canPrev}
        onClick={onPrev}
      >
        Précédent
      </Button>

      {/* Step dots */}
      <div className="flex items-center gap-1.5">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'rounded-full transition-all duration-200',
              i === currentStep
                ? 'w-4 h-1.5 bg-blue-500'
                : i < currentStep
                  ? 'w-1.5 h-1.5 bg-success/60'
                  : 'w-1.5 h-1.5 bg-navy-700',
            )}
          />
        ))}
      </div>

      <Button
        variant={isLast ? 'primary' : 'secondary'}
        size="md"
        disabled={!canNext}
        loading={isNextLoading}
        onClick={onNext}
      >
        {nextLabel}
      </Button>
    </footer>
  )
}

// ── WizardLayout ───────────────────────────────────────────────────────────────

export function WizardLayout({
  featureTitle,
  steps,
  currentStep,
  projectName,
  onProjectNameChange,
  contextualHelp,
  lastSaved,
  onStepClick,
  onBack,
  onSave,
  isSaving,
  canPrev,
  canNext,
  onPrev,
  onNext,
  nextLabel,
  isNextLoading,
  children,
}: WizardLayoutProps) {
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Step sidebar */}
      <StepSidebar
        steps={steps}
        currentStep={currentStep}
        projectName={projectName}
        onProjectNameChange={onProjectNameChange}
        contextualHelp={contextualHelp}
        lastSaved={lastSaved}
        onStepClick={onStepClick}
      />

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <WizardTopBar
          featureTitle={featureTitle}
          onBack={onBack}
          onSave={onSave}
          isSaving={isSaving}
        />

        {/* Content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          {children}
        </main>

        <WizardBottomBar
          canPrev={canPrev}
          canNext={canNext}
          onPrev={onPrev}
          onNext={onNext}
          nextLabel={nextLabel}
          isNextLoading={isNextLoading}
          currentStep={currentStep}
          totalSteps={steps.length}
        />
      </div>
    </div>
  )
}
