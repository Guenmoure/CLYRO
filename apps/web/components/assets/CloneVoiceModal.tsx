'use client'

/**
 * CloneVoiceModal — upload an audio sample and clone a voice via ElevenLabs.
 *
 * Extracted from /voices/page.tsx so it can be reused from:
 *   • /assets/voices ("Create voice" CTA)
 *   • VoicePickerModal empty state (when a user has no cloned voices yet)
 *   • any future surface that wants to offer cloning
 *
 * Plan gating mirrors the server-side check in /api/v1/voices/clone:
 *   free    → blocked, shown upgrade message
 *   starter → max 2
 *   pro+    → unlimited (subject to ElevenLabs account limits)
 *
 * Upload flow:
 *   1. User picks an mp3 / wav / m4a ≤25 MB
 *   2. File uploaded to Supabase voice-samples bucket
 *   3. public URL POSTed to /voices/clone
 *   4. onCloned() fires so callers can refetch their voice lists
 */

import { useEffect, useState } from 'react'
import { Mic2, Upload, AlertTriangle, Lock } from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase'
import { cloneVoice } from '@/lib/api'
import { toast } from '@/components/ui/toast'

// Match the server-side enforcement (apps/api/src/routes/voices.ts EDGE-002).
// Failing fast on the client avoids a wasted upload round-trip.
const VOICE_SAMPLE_MAX_BYTES = 25 * 1024 * 1024
const VOICE_SAMPLE_MAX_LABEL = `${VOICE_SAMPLE_MAX_BYTES / 1024 / 1024} MB`

// ElevenLabs recommends at least ~30 s and no more than ~5 min of clean audio.
// We approximate duration via the Audio API after pick.
const RECOMMENDED_MIN_SECONDS = 30
const RECOMMENDED_MAX_SECONDS = 5 * 60

export type UserPlan = 'free' | 'starter' | 'pro' | 'creator' | 'studio'

interface CloneVoiceModalProps {
  isOpen: boolean
  onClose: () => void
  onCloned?: () => void
  userPlan?: UserPlan
  existingClonedCount?: number
}

export function CloneVoiceModal({
  isOpen,
  onClose,
  onCloned,
  userPlan = 'free',
  existingClonedCount = 0,
}: CloneVoiceModalProps) {
  const [name, setName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null)
  const [uploading, setUploading] = useState(false)

  // Reset on close so next open starts fresh.
  useEffect(() => {
    if (!isOpen) {
      setName('')
      setFile(null)
      setDurationSeconds(null)
      setUploading(false)
    }
  }, [isOpen])

  // Escape to close.
  useEffect(() => {
    if (!isOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !uploading) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, uploading, onClose])

  const planBlocked = userPlan === 'free'
  const starterLimitReached = userPlan === 'starter' && existingClonedCount >= 2
  const planMessage = planBlocked
    ? 'Voice cloning is available on Starter and higher plans.'
    : starterLimitReached
      ? 'Your Starter plan allows up to 2 cloned voices. Upgrade to Pro for unlimited cloning.'
      : null

  function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0] ?? null
    if (!picked) { setFile(null); setDurationSeconds(null); return }
    if (picked.size > VOICE_SAMPLE_MAX_BYTES) {
      toast.error(`File is too large (${(picked.size / 1024 / 1024).toFixed(1)} MB). Max ${VOICE_SAMPLE_MAX_LABEL}.`)
      e.target.value = ''
      setFile(null)
      setDurationSeconds(null)
      return
    }
    setFile(picked)
    // Probe duration (best-effort; not all browsers will resolve for all codecs).
    try {
      const audio = document.createElement('audio')
      audio.preload = 'metadata'
      audio.src = URL.createObjectURL(picked)
      audio.onloadedmetadata = () => {
        setDurationSeconds(Number.isFinite(audio.duration) ? Math.round(audio.duration) : null)
        URL.revokeObjectURL(audio.src)
      }
    } catch {
      setDurationSeconds(null)
    }
  }

  async function handleSubmit() {
    if (!name.trim() || !file || planBlocked || starterLimitReached) return
    if (file.size > VOICE_SAMPLE_MAX_BYTES) {
      toast.error(`File is too large. Max ${VOICE_SAMPLE_MAX_LABEL}.`)
      return
    }
    setUploading(true)
    try {
      const supabase = createBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated.')
      const ext = (file.name.split('.').pop() ?? 'mp3').toLowerCase()
      const path = `${user.id}/${Date.now()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('voice-samples')
        .upload(path, file, { contentType: file.type || 'audio/mpeg' })
      if (uploadError) throw new Error(uploadError.message)

      const { data: urlData } = supabase.storage.from('voice-samples').getPublicUrl(path)
      await cloneVoice({ name: name.trim(), sample_url: urlData.publicUrl })

      toast.success(`Voice "${name.trim()}" cloned successfully.`)
      onCloned?.()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to clone voice.')
    } finally {
      setUploading(false)
    }
  }

  if (!isOpen) return null

  const durationWarning =
    durationSeconds !== null &&
    (durationSeconds < RECOMMENDED_MIN_SECONDS || durationSeconds > RECOMMENDED_MAX_SECONDS)
      ? `For best results, use a clean sample between ${RECOMMENDED_MIN_SECONDS}s and ${RECOMMENDED_MAX_SECONDS / 60} min.`
      : null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="clone-voice-title"
      onClick={(e) => { if (e.target === e.currentTarget && !uploading) onClose() }}
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-xl overflow-hidden">
        <div className="flex items-start gap-3 px-6 pt-6 pb-4">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
            <Mic2 size={18} className="text-blue-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 id="clone-voice-title" className="font-display text-base font-semibold text-foreground">
              Clone your voice
            </h3>
            <p className="font-body text-sm text-[--text-muted] mt-0.5">
              Upload a clean audio sample of your voice — we'll create a custom AI voice you can use in your videos.
            </p>
          </div>
        </div>

        {planMessage ? (
          <div className="mx-6 mb-4 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
            <Lock size={16} className="text-amber-400 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-body text-sm text-foreground">{planMessage}</p>
              <a
                href="/settings/billing"
                className="inline-block mt-2 font-display text-xs font-medium text-amber-400 hover:text-amber-300 underline underline-offset-2"
              >
                See plans →
              </a>
            </div>
          </div>
        ) : null}

        <div className="px-6 pb-2 space-y-4">
          <div>
            <label htmlFor="clone-voice-name" className="block font-body text-xs font-medium text-foreground mb-1.5">
              Voice name
            </label>
            <input
              id="clone-voice-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: My main voice"
              maxLength={100}
              disabled={uploading || planBlocked || starterLimitReached}
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 font-body text-sm text-foreground placeholder-[--text-muted] focus:outline-none focus:border-blue-500/60 transition-colors disabled:opacity-50"
            />
          </div>

          <div>
            <label htmlFor="clone-voice-file" className="block font-body text-xs font-medium text-foreground mb-1.5">
              Audio sample
            </label>
            <div className="relative">
              <input
                id="clone-voice-file"
                type="file"
                accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/m4a,audio/mp4,audio/*"
                onChange={handleFilePick}
                disabled={uploading || planBlocked || starterLimitReached}
                className="sr-only peer"
              />
              <label
                htmlFor="clone-voice-file"
                className="flex items-center gap-3 w-full rounded-xl border border-dashed border-border bg-muted/40 px-3 py-3 cursor-pointer hover:border-blue-500/40 hover:bg-muted/70 transition-colors peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"
              >
                <Upload size={16} className="text-[--text-muted] shrink-0" />
                <span className="flex-1 min-w-0 truncate font-body text-sm text-foreground">
                  {file ? file.name : 'Choose an mp3, wav or m4a file'}
                </span>
                {file && (
                  <span className="font-mono text-[11px] text-[--text-muted]">
                    {(file.size / 1024 / 1024).toFixed(1)} MB
                    {durationSeconds !== null ? ` · ${durationSeconds}s` : ''}
                  </span>
                )}
              </label>
            </div>
            <p className="mt-1.5 font-mono text-[11px] text-[--text-muted]">
              Max {VOICE_SAMPLE_MAX_LABEL}. Ideal: 30 s to 5 min of clean, single-speaker audio.
            </p>
            {durationWarning && (
              <p className="mt-1 flex items-start gap-1.5 font-body text-[11px] text-amber-400">
                <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                <span>{durationWarning}</span>
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-3 px-6 pt-4 pb-6">
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="flex-1 border border-border bg-card text-foreground font-body font-medium py-2.5 rounded-xl text-sm hover:bg-muted transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!name.trim() || !file || uploading || planBlocked || starterLimitReached}
            className="flex-1 bg-blue-500 text-white font-body font-medium py-2.5 rounded-xl text-sm hover:bg-blue-600 disabled:opacity-50 transition-colors"
          >
            {uploading ? 'Uploading…' : 'Clone voice'}
          </button>
        </div>
      </div>
    </div>
  )
}
