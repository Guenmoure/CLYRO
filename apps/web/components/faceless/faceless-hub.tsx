'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Video, Mic2, ChevronRight, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { startFacelessGeneration, getVoices } from '@/lib/api'
import { useVideoStatus } from '@/hooks/use-video-status'
import { toast } from '@/components/ui/toast'
import type { FacelessStyle } from '@clyro/shared'

// ── Data ───────────────────────────────────────────────────────────────────────

const STYLES: Array<{
  id: FacelessStyle
  emoji: string
  label: string
  desc: string
  color: string
}> = [
  { id: 'animation-2d', emoji: '🎨', label: 'Animation 2D',  desc: 'Cartoon & illustration animée',     color: 'bg-purple-50 border-purple-200' },
  { id: 'stock-vo',     emoji: '🎬', label: 'Stock + VO',    desc: 'Vidéos stock avec voix off pro',     color: 'bg-blue-50 border-blue-200'   },
  { id: 'minimaliste',  emoji: '⬜', label: 'Minimaliste',   desc: 'Texte animé sur fond épuré',         color: 'bg-gray-50 border-gray-200'   },
  { id: 'infographie',  emoji: '📊', label: 'Infographie',   desc: 'Données et stats visuelles',         color: 'bg-green-50 border-green-200' },
  { id: 'whiteboard',   emoji: '✏️', label: 'Whiteboard',    desc: 'Dessin tableau blanc animé',         color: 'bg-yellow-50 border-yellow-200' },
  { id: 'cinematique',  emoji: '🎥', label: 'Cinématique',   desc: 'Ambiance cinéma dramatique',         color: 'bg-red-50 border-red-200'    },
]

interface VideoSession {
  id: string
  title: string | null
  status: string
  created_at: string
}

interface VoiceItem {
  id: string
  name: string
  gender?: string
  accent?: string
}

// ── Status badge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    done:       'bg-[#eafaf1] text-[#27ae60]',
    processing: 'bg-brand-primary-light text-brand-primary',
    pending:    'bg-brand-bg text-brand-muted',
    error:      'bg-red-50 text-red-500',
  }
  return (
    <span className={cn('font-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full', map[status] ?? map.pending)}>
      {status}
    </span>
  )
}

// ── Generating view ────────────────────────────────────────────────────────────

const PIPELINE = [
  { key: 'storyboard', label: 'Storyboard IA',      pct: 25 },
  { key: 'visuals',    label: 'Génération visuels',  pct: 60 },
  { key: 'audio',      label: 'Voix off',            pct: 75 },
  { key: 'assembly',   label: 'Assemblage vidéo',    pct: 90 },
  { key: 'done',       label: 'Vidéo prête !',       pct: 100 },
]

function GeneratingView({
  videoId,
  onReset,
  onDone,
}: {
  videoId: string
  onReset: () => void
  onDone: (id: string, outputUrl: string | null) => void
}) {
  const router = useRouter()
  const { status, progress, outputUrl, errorMessage, isDone, isError } = useVideoStatus(videoId)
  const notifiedRef = useRef(false)

  useEffect(() => {
    if (isDone && !notifiedRef.current) {
      notifiedRef.current = true
      onDone(videoId, outputUrl)
      const t = setTimeout(() => router.refresh(), 2500)
      return () => clearTimeout(t)
    }
  }, [isDone, videoId, outputUrl, onDone, router])

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 px-8 max-w-lg mx-auto">
      <div className="w-full">
        <h2 className="font-display text-xl font-bold text-brand-text mb-1 text-center">
          {isError ? 'Erreur de génération' : isDone ? 'Vidéo prête !' : 'Génération en cours…'}
        </h2>
        <p className="text-brand-muted text-sm text-center mb-6">
          {!isDone && !isError && 'Environ 2–5 minutes. Tu peux fermer cet onglet.'}
        </p>

        {/* Progress bar */}
        <div className="h-1.5 bg-brand-bg rounded-full mb-6 overflow-hidden">
          <div
            className="h-full bg-grad-primary rounded-full transition-all duration-700"
            style={{ width: `${Math.max(progress, 5)}%` }}
          />
        </div>

        {/* Steps */}
        <div className="space-y-3">
          {PIPELINE.map((p) => {
            const done   = progress >= p.pct
            const active = status === p.key && !done
            return (
              <div key={p.key} className="flex items-center gap-3">
                <div className={cn(
                  'w-5 h-5 rounded-full border text-xs font-mono flex items-center justify-center transition-all',
                  done   ? 'bg-brand-primary border-brand-primary text-white'
                  : active ? 'border-brand-primary text-brand-primary'
                  : 'border-brand-border text-brand-muted'
                )}>
                  {done ? '✓' : '·'}
                </div>
                <span className={cn('font-body text-sm', done ? 'text-brand-text' : 'text-brand-muted')}>
                  {p.label}
                </span>
                {active && (
                  <Loader2 size={12} className="text-brand-primary animate-spin" />
                )}
              </div>
            )
          })}
        </div>

        {isError && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4 text-red-600 text-sm">
            {errorMessage ?? 'Une erreur est survenue.'}
          </div>
        )}

        {isDone && outputUrl && (
          <a
            href={outputUrl}
            download
            className="mt-5 inline-flex items-center gap-2 bg-brand-primary text-white font-display font-semibold px-5 py-2.5 rounded-xl hover:bg-brand-primary-dark text-sm transition-colors"
          >
            ↓ Télécharger la vidéo
          </a>
        )}

        {(isError) && (
          <button
            onClick={onReset}
            className="mt-4 text-sm text-brand-primary font-medium hover:underline"
          >
            Recommencer
          </button>
        )}
      </div>
    </div>
  )
}

// ── Creation form ──────────────────────────────────────────────────────────────

function CreationForm({ onGenerated }: { onGenerated: (id: string) => void }) {
  const [style,     setStyle]     = useState<FacelessStyle | null>(null)
  const [voiceId,   setVoiceId]   = useState('')
  const [title,     setTitle]     = useState('')
  const [script,    setScript]    = useState('')
  const [voices,    setVoices]    = useState<VoiceItem[]>([])
  const [launching, setLaunching] = useState(false)

  useEffect(() => {
    getVoices()
      .then(({ public: pub }) => setVoices(pub as VoiceItem[]))
      .catch(() => {})
  }, [])

  const canSubmit = !!style && title.trim().length > 0 && script.trim().length >= 20

  async function handleGenerate() {
    if (!style) return
    setLaunching(true)
    try {
      const { video_id } = await startFacelessGeneration({
        title,
        style,
        input_type: 'script',
        script,
        voice_id: voiceId || undefined,
      })
      onGenerated(video_id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors du lancement')
    } finally {
      setLaunching(false)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Heading */}
      <div className="px-8 pt-8 pb-6 border-b border-brand-border">
        <h1 className="font-display text-2xl font-bold text-brand-text">
          Generate a faceless video
        </h1>
        <p className="text-brand-muted text-sm mt-1">
          Choose a style, pick a voice, write your script — we handle the rest.
        </p>
      </div>

      <div className="flex-1 px-8 py-6 space-y-6">

        {/* Row 1 — Audio + Style selectors */}
        <div className="flex gap-3">
          {/* Audio / Voice selector */}
          <div className="flex-1">
            <label className="font-mono text-[11px] uppercase tracking-widest text-brand-muted mb-2 block">
              Audio
            </label>
            <div className="relative">
              <Mic2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted pointer-events-none" />
              <select
                value={voiceId}
                onChange={(e) => setVoiceId(e.target.value)}
                className="w-full bg-brand-bg border border-brand-border rounded-xl pl-9 pr-4 py-3 text-brand-text font-body text-sm focus:outline-none focus:border-brand-primary appearance-none"
              >
                <option value="">Auto (no voice)</option>
                {voices.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}{v.gender ? ` · ${v.gender}` : ''}{v.accent ? ` · ${v.accent}` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Style quick-select */}
          <div className="flex-1">
            <label className="font-mono text-[11px] uppercase tracking-widest text-brand-muted mb-2 block">
              Style
            </label>
            <div className="relative">
              <Video size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted pointer-events-none" />
              <select
                value={style ?? ''}
                onChange={(e) => setStyle(e.target.value as FacelessStyle || null)}
                className="w-full bg-brand-bg border border-brand-border rounded-xl pl-9 pr-4 py-3 text-brand-text font-body text-sm focus:outline-none focus:border-brand-primary appearance-none"
              >
                <option value="">Choose a style…</option>
                {STYLES.map((s) => (
                  <option key={s.id} value={s.id}>{s.emoji} {s.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Title */}
        <div>
          <label className="font-mono text-[11px] uppercase tracking-widest text-brand-muted mb-2 block">
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. How to learn to code in 30 days"
            maxLength={200}
            className="w-full bg-brand-bg border border-brand-border rounded-xl px-4 py-3 text-brand-text font-body text-sm placeholder:text-brand-muted focus:outline-none focus:border-brand-primary"
          />
        </div>

        {/* Script textarea + Generate button */}
        <div>
          <label className="font-mono text-[11px] uppercase tracking-widest text-brand-muted mb-2 block">
            Script
          </label>
          <div className="relative border border-brand-border rounded-2xl bg-brand-bg focus-within:border-brand-primary transition-colors">
            <textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              placeholder="Describe your video idea or paste your full script…"
              maxLength={5000}
              rows={6}
              className="w-full bg-transparent px-4 pt-4 pb-14 text-brand-text font-body text-sm placeholder:text-brand-muted focus:outline-none resize-none rounded-2xl"
            />
            {/* Bottom bar */}
            <div className="absolute bottom-3 left-4 right-3 flex items-center justify-between">
              <span className="font-mono text-[11px] text-brand-muted">
                {script.length}/5000
              </span>
              <button
                onClick={handleGenerate}
                disabled={!canSubmit || launching}
                className="flex items-center gap-2 bg-brand-text text-white font-display font-semibold text-sm px-5 py-2 rounded-xl disabled:opacity-40 hover:opacity-80 transition-opacity"
              >
                {launching ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <ChevronRight size={14} />
                )}
                Generate
              </button>
            </div>
          </div>
        </div>

        {/* Style cards — templates */}
        <div>
          <p className="font-mono text-[11px] uppercase tracking-widest text-brand-muted mb-3">
            Styles disponibles
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {STYLES.map((s) => (
              <button
                key={s.id}
                onClick={() => setStyle(s.id)}
                className={cn(
                  'border rounded-xl p-4 text-left transition-all',
                  s.color,
                  style === s.id
                    ? 'ring-2 ring-brand-primary ring-offset-1'
                    : 'hover:shadow-brand-sm'
                )}
              >
                <span className="text-xl mb-2 block">{s.emoji}</span>
                <p className="font-display font-semibold text-brand-text text-sm">{s.label}</p>
                <p className="font-body text-xs text-brand-muted mt-0.5">{s.desc}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Hub ───────────────────────────────────────────────────────────────────

export function FacelessHub({ initialVideos }: { initialVideos: VideoSession[] }) {
  const [sessions, setSessions]   = useState<VideoSession[]>(initialVideos)
  const [generatingId, setGeneratingId] = useState<string | null>(null)
  const [activeId, setActiveId]   = useState<string | null>(null)

  function handleGenerated(videoId: string) {
    setGeneratingId(videoId)
    setActiveId(videoId)
    setSessions((prev) => [
      { id: videoId, title: 'Nouvelle vidéo', status: 'processing', created_at: new Date().toISOString() },
      ...prev,
    ])
  }

  function handleDone(videoId: string, _outputUrl: string | null) {
    setSessions((prev) =>
      prev.map((s) => s.id === videoId ? { ...s, status: 'done' } : s)
    )
  }

  function handleReset() {
    setGeneratingId(null)
    setActiveId(null)
  }

  return (
    <div className="flex flex-1 h-full overflow-hidden">

      {/* ── Left panel — sessions ───────────────────────────────────────────── */}
      <aside className="w-[72px] bg-brand-surface border-r border-brand-border flex flex-col items-center shrink-0 py-3 gap-2">

        {/* New video button */}
        <button
          type="button"
          onClick={handleReset}
          title="New video"
          className="w-12 h-12 rounded-xl border-2 border-dashed border-brand-border hover:border-brand-primary hover:bg-brand-primary-light flex items-center justify-center transition-all group"
        >
          <Plus size={18} className="text-brand-muted group-hover:text-brand-primary transition-colors" />
        </button>

        {/* Divider */}
        {sessions.length > 0 && (
          <div className="w-8 h-px bg-brand-border" />
        )}

        {/* Sessions grid — icon cards */}
        <div className="flex-1 overflow-y-auto w-full flex flex-col items-center gap-2 px-2">
          {sessions.map((s) => {
            const isActive = activeId === s.id || generatingId === s.id
            const statusDot: Record<string, string> = {
              done:       'bg-emerald-400',
              processing: 'bg-brand-primary animate-pulse',
              pending:    'bg-brand-muted',
              error:      'bg-red-400',
            }
            return (
              <button
                type="button"
                key={s.id}
                onClick={() => setActiveId(s.id)}
                title={s.title ?? 'Sans titre'}
                className={cn(
                  'relative w-12 h-12 rounded-xl flex items-center justify-center transition-all shrink-0',
                  isActive
                    ? 'bg-brand-primary-light ring-2 ring-brand-primary ring-offset-1'
                    : 'bg-brand-bg hover:bg-brand-primary-light border border-brand-border'
                )}
              >
                <Video size={18} className={isActive ? 'text-brand-primary' : 'text-brand-muted'} />
                {/* Status dot */}
                <span className={cn(
                  'absolute bottom-0.5 right-0.5 w-2 h-2 rounded-full border border-white',
                  statusDot[s.status] ?? statusDot.pending
                )} />
              </button>
            )
          })}
        </div>
      </aside>

      {/* ── Right panel — creation / generation ─────────────────────────────── */}
      <div className="flex-1 overflow-hidden">
        {generatingId ? (
          <GeneratingView videoId={generatingId} onReset={handleReset} onDone={handleDone} />
        ) : (
          <CreationForm onGenerated={handleGenerated} />
        )}
      </div>

    </div>
  )
}
