'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

const DEBOUNCE_MS = 1_200

export interface WizardDraft {
  version: 1
  type: 'faceless' | 'motion'
  savedAt: string
  currentStep: number
  stepLabel: string
  totalSteps: number
  projectName: string
  payload: Record<string, unknown>
}

interface UseDraftPersistenceOptions {
  key: string
  type: 'faceless' | 'motion'
  steps: { id: string; label: string }[]
  currentStep: number
  projectName: string
  payload: Record<string, unknown>
}

interface DraftResult {
  wasRestored: boolean
  lastSaved: Date | null
  isSaving: boolean
  clearDraft: () => void
}

export function useDraftPersistence({
  key,
  type,
  steps,
  currentStep,
  projectName,
  payload,
}: UseDraftPersistenceOptions): DraftResult {
  const [wasRestored, setWasRestored] = useState(false)
  const [lastSaved, setLastSaved]     = useState<Date | null>(null)
  const [isSaving, setIsSaving]       = useState(false)
  const timerRef       = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isFirstRender  = useRef(true)

  // On mount — detect if a draft exists (restore is done by the wizard page itself)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key)
      if (raw) setWasRestored(true)
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Debounced auto-save on every state change
  const payloadStr = JSON.stringify(payload)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }

    if (timerRef.current) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(() => {
      setIsSaving(true)
      try {
        const draft: WizardDraft = {
          version:    1,
          type,
          savedAt:    new Date().toISOString(),
          currentStep,
          stepLabel:  steps[currentStep]?.label ?? '',
          totalSteps: steps.length,
          projectName,
          payload:    JSON.parse(payloadStr),
        }
        localStorage.setItem(key, JSON.stringify(draft))
        setLastSaved(new Date())
      } catch {
        // localStorage quota exceeded — fail silently
      } finally {
        setIsSaving(false)
      }
    }, DEBOUNCE_MS)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, type, currentStep, projectName, payloadStr])

  const clearDraft = useCallback(() => {
    try { localStorage.removeItem(key) } catch {}
  }, [key])

  return { wasRestored, lastSaved, isSaving, clearDraft }
}
