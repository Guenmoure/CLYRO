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
  /**
   * When false (default), the hook is fully muted — no INSERT, no
   * UPDATE, no beacon, no autosave. The wizard pages flip this to true
   * ONLY once the user has reached the post-Claude step (scenes
   * available). Before that, all state lives in React local state —
   * no DB row is created.
   *
   * This implements the "no row until something to save" rule: a user
   * who opens the wizard and bounces away leaves nothing behind. A user
   * who reaches the scene split gets a `videos` row with status='draft'.
   *
   * The previous unconditional autosave produced one zombie row per
   * abandoned session, polluting the Drafts tab indefinitely.
   */
  armed?:        boolean
  /**
   * When true, trigger the browser's native "Leave site?" confirmation on
   * tab close / refresh so the user has a chance to cancel. When false,
   * leave silently (draft is still saved via sendBeacon).
   * Typical usage: true before the user has committed real work
   * (pre-scene-breakdown), false afterwards so saves are seamless.
   */
  promptOnLeave?: boolean
}

export interface DraftSaveResult {
  draftId:     string | null
  wasRestored: boolean
  lastSaved:   Date | null
  isSaving:    boolean
  /**
   * Delete the draft row and permanently disable the hook (no further
   * auto-saves, beacon, step-change saves, etc.). Use this on a clean
   * "abandon draft" path. For successful submissions where the backend
   * promotes the same row from `draft` → `pending`, prefer `finalize()`
   * which only mutes the hook without deleting (the row is now the real
   * video).
   */
  clearDraft:  () => Promise<void>
  /**
   * Permanently disable all save triggers without touching the row.
   * Call this AFTER the backend has promoted the draft in place — the row
   * is now the actual video, deleting it would destroy the user's output.
   */
  finalize:    () => void
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
  armed = false,
  promptOnLeave = false,
}: DraftSaveOptions): DraftSaveResult {
  const [draftId,    setDraftId]    = useState<string | null>(initialDraftId ?? null)
  const [lastSaved,  setLastSaved]  = useState<Date | null>(null)
  const [isSaving,   setIsSaving]   = useState(false)
  const [wasRestored] = useState(!!initialDraftId)

  // Keep a ref so the beforeunload handler always has fresh values
  const latestRef = useRef({ module, title, style, currentStep, totalSteps, stepLabel, state, draftId })
  latestRef.current = { module, title, style, currentStep, totalSteps, stepLabel, state, draftId }

  // Latest Supabase access_token — refreshed in the background. The
  // beforeunload handler reads from this ref because `sendBeacon` runs
  // synchronously during unload (no async API calls possible).
  const accessTokenRef = useRef<string | null>(null)
  useEffect(() => {
    const supabase = createBrowserClient()
    let cancelled = false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    void (supabase.auth.getSession() as Promise<any>).then(({ data }: any) => {
      if (!cancelled) accessTokenRef.current = data?.session?.access_token ?? null
    })
    // Keep the ref fresh on auth state changes (refresh, sign-out).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: sub } = (supabase.auth.onAuthStateChange as any)(
      (_event: unknown, session: { access_token?: string } | null) => {
        accessTokenRef.current = session?.access_token ?? null
      },
    )
    return () => {
      cancelled = true
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(sub as any)?.subscription?.unsubscribe?.()
    }
  }, [])

  // One-way kill switch flipped by clearDraft() / finalize(). Once true,
  // every save trigger short-circuits — the 30 s autosave interval, the
  // state-change debounce, the step-change effect, AND the beforeunload
  // beacon all read this ref. Previously the hook kept saving after
  // clearDraft (because draftId was just set to null), so the next
  // autosave tick re-INSERTed a fresh draft and you ended up with a
  // zombie draft sitting next to every completed video. A ref (not
  // state) is used so the beforeunload handler reads the latest value
  // without re-binding.
  const finalizedRef = useRef(false)

  // Mirror of the `armed` prop so the beforeunload beacon (which can't
  // re-read closures) sees the live value. The hook stays mute until
  // the wizard flips `armed` true at the post-Claude step.
  const armedRef = useRef(armed)
  armedRef.current = armed

  // ── Core save function ──────────────────────────────────────
  const save = useCallback(async () => {
    // Bail when the wizard hasn't reached the post-Claude step yet.
    // Steps 0-N before scene split keep state in React local memory only.
    if (!armedRef.current) return
    if (finalizedRef.current) return
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
    if (!armedRef.current) return
    if (finalizedRef.current) return
    if (stepRef.current === null) {
      stepRef.current = currentStep
      return
    }
    if (stepRef.current !== currentStep) {
      stepRef.current = currentStep
      save()
    }
  }, [currentStep, save])

  // ── Debounced save on state change (1.5s) ───────────────────
  // Ensures a draft row is created quickly after the user starts
  // working, so tab-close/unload is never catastrophic. Both gates
  // (armed + finalized) must pass for the timer to even arm.
  const lastStateJsonRef = useRef<string>('')
  useEffect(() => {
    if (!armedRef.current) return
    if (finalizedRef.current) return
    const json = JSON.stringify(state)
    if (json === lastStateJsonRef.current) return
    const isFirstObserved = lastStateJsonRef.current === ''
    lastStateJsonRef.current = json
    if (isFirstObserved) return // skip initial mount
    const handle = setTimeout(() => { void save() }, 1500)
    return () => clearTimeout(handle)
  }, [state, save])

  // ── Auto-save every 30s ─────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      if (!armedRef.current) return
      if (finalizedRef.current) return
      save()
    }, AUTOSAVE_MS)
    return () => clearInterval(interval)
  }, [save])

  // ── sendBeacon on tab close ─────────────────────────────────
  // If `promptOnLeave` is true AND we have nothing to lose silently (draft
  // exists but user hasn't passed the "real work" threshold), trigger the
  // native confirmation so the user has a chance to cancel. Either way,
  // when unload proceeds the beacon fires and the draft is persisted —
  // UNLESS the hook has been finalised (user already submitted), in which
  // case there's nothing to preserve.
  const promptOnLeaveRef = useRef(promptOnLeave)
  promptOnLeaveRef.current = promptOnLeave
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!armedRef.current) return undefined
      if (finalizedRef.current) return undefined
      const { draftId: id, module: mod, title: t, style: s, currentStep: step, state: st } = latestRef.current
      const token = accessTokenRef.current
      // Only beacon when we have BOTH the draft id and a session token —
      // the server rejects unauthenticated beacons (see /api/draft-save).
      if (id && token) {
        const body = JSON.stringify({
          draftId: id, accessToken: token,
          module: mod, title: t, style: s, currentStep: step, state: st,
        })
        navigator.sendBeacon('/api/draft-save', body)
      }
      if (promptOnLeaveRef.current) {
        e.preventDefault()
        // Most browsers ignore the string but require returnValue to be set
        e.returnValue = ''
        return ''
      }
      return undefined
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  // ── Permanently mute the hook (no DELETE) ───────────────────
  // Use this when the backend has promoted the draft row in place to a
  // real video (status changed from 'draft' → 'pending'). The row IS the
  // video now — deleting it would destroy the user's output.
  const finalize = useCallback(() => {
    finalizedRef.current = true
  }, [])

  // ── Clear (delete) the draft ────────────────────────────────
  // Sets the finalized flag SYNCHRONOUSLY before the DELETE so any
  // already-pending save (debounced state change, autosave tick) bails
  // out instead of racing the DELETE and re-INSERTing a fresh draft.
  const clearDraft = useCallback(async () => {
    finalizedRef.current = true
    const id = latestRef.current.draftId
    if (!id) return
    const supabase = createBrowserClient()
    try {
      await supabase.from('videos').delete().eq('id', id)
    } catch {
      // Swallow: the row may already be gone, or RLS rejected. Either way
      // the hook is muted now so no zombie will be re-created.
    }
    setDraftId(null)
    latestRef.current.draftId = null
  }, [])

  return { draftId, wasRestored, lastSaved, isSaving, clearDraft, finalize }
}
