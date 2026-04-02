'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Wand2, Loader2, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { startMotionGeneration, getVoices } from '@/lib/api'
import { useVideoStatus } from '@/hooks/use-video-status'
import { toast } from '@/components/ui/toast'
import type { MotionStyle, VideoFormat, VideoDuration } from '@clyro/shared'

// ── Data ───────────────────────────────────────────────────────────────────────

const MOTION_STYLES: Array<{ id: MotionStyle; emoji: string; label: string; desc: string; color: string }> = [
  { id: 'corporate', emoji: '🏢', label: 'Corporate',  desc: 'Professionnel et épuré',    color: 'bg-blue-50 border-blue-200'   },
  { id: 'dynamique', emoji: '⚡', label: 'Dynamique',  desc: 'Énergique et impactant',    color: 'bg-yellow-50 border-yellow-200' },
  { id: 'luxe',      emoji: '✨', label: 'Luxe',       desc: 'Premium et élégant',        color: 'bg-purple-50 border-purple-200' },
  { id: 'fun',       emoji: '🎉', label: 'Fun',        desc: 'Coloré et engageant',       color: 'bg-pink-50 border-pink-200'   },
]

const FORMATS: Array<{ id: VideoFormat; label: string; desc: string }> = [
  { id: '9:16', label: '9:16', desc: 'Stories / TikTok' },
  { id: '1:1',  label: '1:1',  desc: 'Instagram' },
  { id: '16:9', label: '16:9', desc: 'YouTube' },
]

const DURATIONS: Array<{ id: VideoDuration; label: string }> = [
  { id: '6s',  label: '6s'  },
  { id: '15s', label: '15s' },
  { id: '30s', label: '30s' },
  { id: '60s', label: '60s' },
]

const PIPELINE = [
  { key: 'storyboard', label: 'Analyse du brief',   pct: 20  },
  { key: 'visuals',    label: 'Génération visuels',  pct: 55  },
  { key: 'audio',      label: 'Voix off',            pct: 72  },
  { key: 'assembly',   label: 'Assemblage Motion',   pct: 90  },
  { key: 'done',       label: 'Vidéo prête !',       pct: 100 },
]

interface VideoSession {
  id: string
  title: string | null
  status: string
  created_at: string
}

interface VoiceItem { id: string; name: string; gender?: string; accent?: string }

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

function GeneratingView({ videoId, onReset }: { videoId: string; onReset: () => void }) {
  const router = useRouter()
  const { status, progress, outputUrl, errorMessage, isDone, isError } = useVideoStatus(videoId)

  useEffect(() => {
    if (isDone) {
      const t = setTimeout(() => router.refresh(), 2500)
      return () => clearTimeout(t)
    }
  }, [isDone, router])

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 px-8 max-w-lg mx-auto">
      <div className="w-full">
        <h2 className="font-display text-xl font-bold text-brand-text mb-1 text-center">
          {isError ? 'Erreur de génération' : isDone ? 'Publicité prête !' : 'Génération en cours…'}
        </h2>
        <p className="text-brand-muted text-sm text-center mb-6">
          {!isDone && !isError && 'Environ 2–5 minutes.'}
        </p>
        <div className="h-1.5 bg-brand-bg rounded-full mb-6 overflow-hidden">
          <div className="h-full bg-grad-primary rounded-full transition-all duration-700" style={{ width: `${Math.max(progress, 5)}%` }} />
        </div>
        <div className="space-y-3">
          {PIPELINE.map((p) => {
            const done   = progress >= p.pct
            const active = status === p.key && !done
            return (
              <div key={p.key} className="flex items-center gap-3">
                <div className={cn('w-5 h-5 rounded-full border text-xs font-mono flex items-center justify-center transition-all',
                  done   ? 'bg-brand-secondary border-brand-secondary text-white'
                  : active ? 'border-brand-secondary text-brand-secondary'
                  : 'border-brand-border text-brand-muted'
                )}>
                  {done ? '✓' : '·'}
                </div>
                <span className={cn('font-body text-sm', done ? 'text-brand-text' : 'text-brand-muted')}>{p.label}</span>
                {active && <Loader2 size={12} className="text-brand-secondary animate-spin" />}
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
          <a href={outputUrl} download className="mt-5 inline-flex items-center gap-2 bg-brand-secondary text-white font-display font-semibold px-5 py-2.5 rounded-xl text-sm hover:opacity-90 transition-opacity">
            ↓ Télécharger la publicité
          </a>
        )}
        {isError && (
          <button onClick={onReset} className="mt-4 text-sm text-brand-primary font-medium hover:underline">
            Recommencer
          </button>
        )}
      </div>
    </div>
  )
}

// ── Creation form ──────────────────────────────────────────────────────────────

function CreationForm({ onGenerated }: { onGenerated: (id: string) => void }) {
  const [style,    setStyle]    = useState<MotionStyle | null>(null)
  const [format,   setFormat]   = useState<VideoFormat>('16:9')
  const [duration, setDuration] = useState<VideoDuration>('30s')
  const [voiceId,  setVoiceId]  = useState('')
  const [title,    setTitle]    = useState('')
  const [brief,    setBrief]    = useState('')
  const [color,    setColor]    = useState('#667eea')
  const [voices,   setVoices]   = useState<VoiceItem[]>([])
  const [launching, setLaunching] = useState(false)

  useEffect(() => {
    getVoices().then(({ public: pub }) => setVoices(pub as VoiceItem[])).catch(() => {})
  }, [])

  const canSubmit = !!style && title.trim().length > 0 && brief.trim().length >= 20

  async function handleGenerate() {
    if (!style) return
    setLaunching(true)
    try {
      const { video_id } = await startMotionGeneration({
        title,
        brief,
        format,
        duration,
        style,
        brand_config: { primary_color: color, style },
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
        <h1 className="font-display text-2xl font-bold text-brand-text">Generate a motion video</h1>
        <p className="text-brand-muted text-sm mt-1">Brief créatif → visuels animés → voix off → rendu final.</p>
      </div>

      <div className="flex-1 px-8 py-6 space-y-6">

        {/* Row — Voice + Format + Duration */}
        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-36">
            <label className="font-mono text-[11px] uppercase tracking-widest text-brand-muted mb-2 block">Audio</label>
            <select value={voiceId} onChange={(e) => setVoiceId(e.target.value)}
              className="w-full bg-brand-bg border border-brand-border rounded-xl px-3 py-3 text-brand-text font-body text-sm focus:outline-none focus:border-brand-primary appearance-none">
              <option value="">Auto (no voice)</option>
              {voices.map((v) => <option key={v.id} value={v.id}>{v.name}{v.gender ? ` · ${v.gender}` : ''}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-36">
            <label className="font-mono text-[11px] uppercase tracking-widest text-brand-muted mb-2 block">Format</label>
            <div className="flex gap-2">
              {FORMATS.map((f) => (
                <button key={f.id} onClick={() => setFormat(f.id)}
                  className={cn('flex-1 py-3 rounded-xl border text-xs font-display font-semibold transition-all',
                    format === f.id ? 'bg-brand-primary-light border-brand-primary text-brand-primary' : 'bg-brand-bg border-brand-border text-brand-muted hover:border-brand-primary/40'
                  )}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 min-w-36">
            <label className="font-mono text-[11px] uppercase tracking-widest text-brand-muted mb-2 block">Durée</label>
            <div className="flex gap-2">
              {DURATIONS.map((d) => (
                <button key={d.id} onClick={() => setDuration(d.id)}
                  className={cn('flex-1 py-3 rounded-xl border text-xs font-display font-semibold transition-all',
                    duration === d.id ? 'bg-brand-primary-light border-brand-primary text-brand-primary' : 'bg-brand-bg border-brand-border text-brand-muted hover:border-brand-primary/40'
                  )}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Brand color + Title */}
        <div className="flex gap-3">
          <div>
            <label className="font-mono text-[11px] uppercase tracking-widest text-brand-muted mb-2 block">Couleur marque</label>
            <div className="flex items-center gap-2 bg-brand-bg border border-brand-border rounded-xl px-3 py-2.5">
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-7 h-7 rounded-lg border-0 cursor-pointer bg-transparent" />
              <span className="font-mono text-xs text-brand-muted">{color}</span>
            </div>
          </div>
          <div className="flex-1">
            <label className="font-mono text-[11px] uppercase tracking-widest text-brand-muted mb-2 block">Titre</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Lancement produit — Janvier 2026" maxLength={200}
              className="w-full bg-brand-bg border border-brand-border rounded-xl px-4 py-3 text-brand-text font-body text-sm placeholder:text-brand-muted focus:outline-none focus:border-brand-primary" />
          </div>
        </div>

        {/* Brief + Generate */}
        <div>
          <label className="font-mono text-[11px] uppercase tracking-widest text-brand-muted mb-2 block">Brief créatif</label>
          <div className="relative border border-brand-border rounded-2xl bg-brand-bg focus-within:border-brand-primary transition-colors">
            <textarea value={brief} onChange={(e) => setBrief(e.target.value)}
              placeholder="Produit, message clé, public cible, ton, call-to-action…" maxLength={2000} rows={6}
              className="w-full bg-transparent px-4 pt-4 pb-14 text-brand-text font-body text-sm placeholder:text-brand-muted focus:outline-none resize-none rounded-2xl" />
            <div className="absolute bottom-3 left-4 right-3 flex items-center justify-between">
              <span className="font-mono text-[11px] text-brand-muted">{brief.length}/2000</span>
              <button onClick={handleGenerate} disabled={!canSubmit || launching}
                className="flex items-center gap-2 bg-brand-text text-white font-display font-semibold text-sm px-5 py-2 rounded-xl disabled:opacity-40 hover:opacity-80 transition-opacity">
                {launching ? <Loader2 size={14} className="animate-spin" /> : <ChevronRight size={14} />}
                Generate
              </button>
            </div>
          </div>
        </div>

        {/* Style cards */}
        <div>
          <p className="font-mono text-[11px] uppercase tracking-widest text-brand-muted mb-3">Styles disponibles</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {MOTION_STYLES.map((s) => (
              <button key={s.id} onClick={() => setStyle(s.id)}
                className={cn('border rounded-xl p-4 text-left transition-all', s.color,
                  style === s.id ? 'ring-2 ring-brand-secondary ring-offset-1' : 'hover:shadow-brand-sm'
                )}>
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

export function MotionHub({ initialVideos }: { initialVideos: VideoSession[] }) {
  const [sessions, setSessions]         = useState<VideoSession[]>(initialVideos)
  const [generatingId, setGeneratingId] = useState<string | null>(null)
  const [activeId, setActiveId]         = useState<string | null>(null)

  function handleGenerated(videoId: string) {
    setGeneratingId(videoId)
    setSessions((prev) => [
      { id: videoId, title: 'Nouvelle publicité', status: 'processing', created_at: new Date().toISOString() },
      ...prev,
    ])
  }

  function handleReset() {
    setGeneratingId(null)
    setActiveId(null)
  }

  return (
    <div className="flex flex-1 h-full overflow-hidden">

      {/* Left panel */}
      <aside className="w-64 bg-brand-surface border-r border-brand-border flex flex-col shrink-0">
        <div className="p-4 border-b border-brand-border">
          <h2 className="font-display text-sm font-semibold text-brand-text">Motion Design</h2>
        </div>
        <div className="p-3 border-b border-brand-border">
          <button onClick={handleReset}
            className="flex items-center gap-2 w-full bg-brand-bg border border-brand-border rounded-xl px-3 py-2.5 text-sm font-body text-brand-text hover:border-brand-secondary/40 hover:bg-purple-50 transition-all">
            <Plus size={16} className="text-brand-secondary" />
            New video
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4 py-8">
              <Wand2 size={28} className="text-brand-border mb-2" />
              <p className="text-brand-muted font-body text-xs">No sessions yet. Create your first motion video!</p>
            </div>
          ) : (
            <div className="space-y-1">
              {sessions.map((s) => (
                <button key={s.id} onClick={() => setActiveId(s.id)}
                  className={cn('w-full text-left px-3 py-2.5 rounded-xl transition-all',
                    activeId === s.id ? 'bg-purple-50' : 'hover:bg-brand-bg'
                  )}>
                  <p className="font-body text-sm text-brand-text truncate">{s.title ?? 'Sans titre'}</p>
                  <div className="flex items-center justify-between mt-0.5">
                    <StatusBadge status={s.status} />
                    <span className="font-mono text-[10px] text-brand-muted">
                      {new Date(s.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* Right panel */}
      <div className="flex-1 overflow-hidden">
        {generatingId
          ? <GeneratingView videoId={generatingId} onReset={handleReset} />
          : <CreationForm onGenerated={handleGenerated} />
        }
      </div>
    </div>
  )
}
