import * as React from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface StepperStep {
  id: string
  label: string
  description?: string
}

interface StepperProps {
  steps: StepperStep[]
  currentStep: number
  className?: string
}

export function Stepper({ steps, currentStep, className }: StepperProps) {
  return (
    <div className={cn('flex items-center w-full', className)}>
      {steps.map((step, i) => (
        <React.Fragment key={step.id}>
          {/* Step node */}
          <div className="flex items-center gap-2 shrink-0">
            <div
              className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border transition-colors duration-300',
                currentStep > i
                  ? 'bg-blue-500 border-blue-500 text-white'
                  : currentStep === i
                    ? 'bg-blue-500/15 border-2 border-blue-500 text-blue-500 dark:text-blue-400'
                    : 'bg-muted border-border text-[--text-muted]',
              )}
            >
              {currentStep > i ? <Check size={12} strokeWidth={2.5} /> : <span>{i + 1}</span>}
            </div>
            <span
              className={cn(
                'hidden sm:block font-mono text-xs transition-colors duration-300',
                currentStep >= i ? 'text-foreground' : 'text-[--text-muted]',
              )}
            >
              {step.label}
            </span>
          </div>

          {/* Connector */}
          {i < steps.length - 1 && (
            <div
              className={cn(
                'flex-1 h-px mx-3 transition-colors duration-500',
                currentStep > i ? 'bg-blue-500' : 'bg-border',
              )}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  )
}
