'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createBrowserClient } from '@/lib/supabase'

const AUTOSAVE_MS = 30_000   // 30 s interval

export interface DraftSaveOptions {
  module:       'faceless' | 'motion' | 'brand' | 'studio'
  title:        string
  style:        string
  currentStep:  number
  totalSteps:   number
  stepLabel:    string
  state:        Record<string, unknown>
  /** Pass a video ID to resume an existing draft (e.g. from ?draft= URL param) */
  initialDraftId?: string | null
}

export interface DraftSaveResult {
  draftId:     string | null
  wasRestored: boolean
  lastSaved:   Date | null
  isSaving:    boolean
  clearDraft:  () => Promise<void>
}

export function useDraftSave({
  module,
  title,
  style,
  currentStep,
  totalSteps,
  stepLabel,
  state,
  initialDraftId,
}: DraftSaveOptions): DraftSaveResult {
  const [draftId,    setDraftId]    = useState<string | null>(initialDraftId ?? null)
  const [lastSaved,  setLastSaved]  = useState<Date | null>(null)
  const [isSaving,   setIsSaving]   = useState(false)
  const [wasRestored] = useState(!!initialDraftId)

  // Keep a ref so the beforeunload handler always has fresh values
  const latestRef = useRef({ module, title, style, currentStep, totalSteps, stepLabel, state, draftId })
  latestRef.current = { module, title, style, currentStep, totalSteps, stepLabel, state, draftId }

  // ── Core save function ──────────────────────────────────────
  const save = useCallback(async () => {
    const supabase = createBrowserClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    setIsSaving(true)
    try {
      const { module: mod, title: t, style: s, currentStep: step, state: st } = latestRef.current

      // Determine expiry: Pro users get no expiry, others get 7 days
      const { data: profile } = await (supabase
        .from('profiles')
        .select('plan')
        .eq('id', session.user.id)
        .single() as Promise<any>)
      const isPro = profile?.plan === 'pro' || profile?.plan === 'business'
      const expiresAt = isPro
        ? null
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

      const payload = {
        user_id:            session.user.id,
        module:             mod,
        style:              s || 'draft',
        title:              t || 'Sans titre',
        status:             'draft' as const,
        wizard_step:        step + 1,
        wizard_state:       st,
        draft_expires_at:   expiresAt,
        updated_at:         new Date().toISOString(),
      }

      if (latestRef.current.draftId) {
        await supabase
          .from('videos')
          .update(payload)
          .eq('id', latestRef.current.draftId)
          .eq('user_id', session.user.id)
      } else {
        const { data, error } = await supabase
          .from('videos')
          .insert(payload)
          .select('id')
          .single()
        if (!error && data) {
          setDraftId(data.id)
          latestRef.current.draftId = data.id
        }
      }
      setLastSaved(new Date())
    } catch {
      // silent — don't surface draft save errors to the user
    } finally {
      setIsSaving(false)
    }
  }, []) // stable — uses latestRef for all values

  // ── Save on step change ─────────────────────────────────────
  const stepRef = useRef<number | null>(null)
  useEffect(() => {
    if (stepRef.current === null) {
      stepRef.current = currentStep
      return
    }
    if (stepRef.current !== currentStep) {
      stepRef.current = currentStep
      save()
    }
  }, [currentStep, save])

  // ── Auto-save every 30s ─────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(save, AUTOSAVE_MS)
    return () => clearInterval(interval)
  }, [save])

  // ── sendBeacon on tab close ─────────────────────────────────
  useEffect(() => {
    function onBeforeUnload() {
      const { draftId: id, module: mod, title: t, style: s, currentStep: step, state: st } = latestRef.current
      if (!id) return
      const body = JSON.stringify({ draftId: id, module: mod, title: t, style: s, currentStep: step, state: st })
      navigator.sendBeacon('/api/draft-save', body)
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  // ── Clear (delete) the draft ────────────────────────────────
  const clearDraft = useCallback(async () => {
    const id = latestRef.current.draftId
    if (!id) return
    const supabase = createBrowserClient()
    await supabase.from('videos').delete().eq('id', id)
    setDraftId(null)
    latestRef.current.draftId = null
  }, [])

  return { draftId, wasRestored, lastSaved, isSaving, clearDraft }
}
