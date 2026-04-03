'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Wand2, Loader2, ChevronRight, ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { startMotionGeneration, getVoices } from '@/lib/api'
import { useVideoStatus } from '@/hooks/use-video-status'
import { toast } from '@/components/ui/toast'
import { VideoPlayer } from '@/components/ui/video-player'
import type { MotionStyle, VideoFormat, VideoDuration } from '@clyro/shared'

// ── Data ───────────────────────────────────────────────────────────────────────

const MOTION_STYLES: Array<{
  id: MotionStyle
  emoji: string
  label: string
  desc: string
  gradient: string
  textColor: string
  accentColor: string
}> = [
  {
    id: 'corporate',
    emoji: '🏢',
    label: 'Corporate',
    desc: 'Professionnel et épuré',
    gradient: 'from-[#1A237E] to-[#283593]',
    textColor: 'text-white',
    accentColor: 'bg-[#90CAF9]',
  },
  {
    id: 'dynamique',
    emoji: '⚡',
    label: 'Dynamique',
    desc: 'Énergique et impactant',
    gradient: 'from-[#0D0D1A] to-[#1a0533]',
    textColor: 'text-white',
    accentColor: 'bg-[#00FFAA]',
  },
  {
    id: 'luxe',
    emoji: '✨',
    label: 'Luxe',
    desc: 'Premium et élégant',
    gradient: 'from-[#1a1208] to-[#2d1f0a]',
    textColor: 'text-[#C9A227]',
    accentColor: 'bg-[#C9A227]',
  },
  {
    id: 'fun',
    emoji: '🎉',
    label: 'Fun',
    desc: 'Coloré et engageant',
    gradient: 'from-[#FF6B9D] to-[#C44DFF]',
    textColor: 'text-white',
    accentColor: 'bg-[#FFE66D]',
  },
]

const FORMATS: Array<{ id: VideoFormat; label: string; desc: string; aspect: string }> = [
  { id: '9:16', label: '9:16', desc: 'Stories / TikTok', aspect: 'aspect-[9/16]' },
  { id: '1:1',  label: '1:1',  desc: 'Instagram',        aspect: 'aspect-square' },
  { id: '16:9', label: '16:9', desc: 'YouTube',          aspect: 'aspect-video'  },
]

const DURATIONS: Array<{ id: VideoDuration; label: string }> = [
  { id: '6s',  label: '6s'  },
  { id: '15s', label: '15s' },
  { id: '30s', label: '30s' },
  { id: '60s', label: '60s' },
]

const PIPELINE = [
  { key: 'storyboard', label: 'Analyse du brief',  pct: 20  },
  { key: 'visuals',    label: 'Génération visuels', pct: 55  },
  { key: 'audio',      label: 'Voix off',           pct: 72  },
  { key: 'assembly',   label: 'Assemblage Motion',  pct: 90  },
  { key: 'done',       label: 'Vidéo prête !',      pct: 100 },
]

interface VideoSession {
  id: string
  title: string | null
  status: string
  output_url?: string | null
  created_at: string
}

interface VoiceItem { id: string; name: string; gender?: string }

// ── Status badge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    done:       'bg-[#eafaf1] text-[#27ae60]',
    processing: 'bg-brand-primary-light text-brand-primary',
    storyboard: 'bg-brand-primary-light text-brand-primary',
    visuals:    'bg-brand-primary-light text-brand-primary',
    audio:      'bg-brand-primary-light text-brand-primary',
    assembly:   'bg-brand-primary-light text-brand-primary',
    pending:    'bg-brand-bg text-brand-muted',
    error:      'bg-red-50 text-red-500',
  }
  const label: Record<string, string> = {
    done: 'Prête', processing: 'En cours', storyboard: 'Storyboard',
    visuals: 'Visuels', audio: 'Audio', assembly: 'Assemblage',
    pending: 'En attente', error: 'Erreur',
  }
  return (
    <span className={cn('font-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full', map[status] ?? map.pending)}>
      {label[status] ?? status}
    </span>
  )
}

// ── Generating view ────────────────────────────────────────────────────────────

function GeneratingView({ videoId, title, onReset, onDone }: {
  videoId: string
  title: string
  onReset: () => void
  onDone: (id: string, url: string | null) => void
}) {
  const router = useRouter()
  const { status, progress, outputUrl, errorMessage, isDone, isError } = useVideoStatus(videoId)

  useEffect(() => {
    if (isDone) {
      onDone(videoId, outputUrl)
      const t = setTimeout(() => router.refresh(), 2500)
      return () => clearTimeout(t)
    }
  }, [isDone, videoId, outputUrl, onDone, router])

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 px-8 max-w-lg mx-auto">
      <div className="w-full">
        <h2 className="font-display text-xl font-bold text-brand-text mb-1 text-center">
          {isError ? 'Erreur de génération' : isDone ? 'Publicité prête !' : 'Génération en cours…'}
        </h2>
        <p className="text-brand-muted text-sm text-center mb-6">
          {!isDone && !isError && 'Environ 2–5 minutes. Tu peux fermer cet onglet.'}
        </p>

        <div className="h-1.5 bg-brand-bg rounded-full mb-6 overflow-hidden">
          <div
            className="h-full bg-grad-primary rounded-full transition-all duration-700 progress-bar"
            style={{ '--progress-width': `${Math.max(progress, 5)}%` } as React.CSSProperties}
          />
        </div>

        <div className="space-y-3 mb-6">
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
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600 text-sm mb-4">
            {errorMessage ?? 'Une erreur est survenue.'}
          </div>
        )}

        {isDone && outputUrl && (
          <VideoPlayer url={outputUrl} title={title} />
        )}

        {isError && (
          <button type="button" onClick={onReset} className="mt-4 text-sm text-brand-primary font-medium hover:underline">
            Recommencer
          </button>
        )}
      </div>
    </div>
  )
}

// ── Done view (session existante terminée) ─────────────────────────────────────

function DoneView({ session, onNew }: { session: VideoSession; onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-8 max-w-lg mx-auto gap-4">
      <div className="w-full">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-bold text-brand-text">{session.title ?? 'Publicité'}</h2>
          <button type="button" onClick={onNew} className="text-xs font-mono text-brand-primary hover:underline">+ Nouvelle vidéo</button>
        </div>
        {session.output_url ? (
          <VideoPlayer url={session.output_url} title={session.title ?? undefined} />
        ) : (
          <div className="flex items-center justify-center h-40 rounded-2xl bg-brand-bg border border-brand-border text-brand-muted text-sm">
            Vidéo non disponible
          </div>
        )}
      </div>
    </div>
  )
}

// ── Creation form ──────────────────────────────────────────────────────────────

function CreationForm({ onGenerated }: { onGenerated: (id: string, title: string) => void }) {
  const [style,    setStyle]    = useState<MotionStyle | null>(null)
  const [format,   setFormat]   = useState<VideoFormat>('16:9')
  const [duration, setDuration] = useState<VideoDuration>('30s')
  const [voiceId,  setVoiceId]  = useState('')
  const [title,    setTitle]    = useState('')
  const [brief,    setBrief]    = useState('')
  const [color,    setColor]    = useState('#667eea')
  const [logoUrl,  setLogoUrl]  = useState('')
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
        brand_config: {
          primary_color: color,
          style,
          ...(logoUrl.trim() ? { logo_url: logoUrl.trim() } : {}),
        },
        voice_id: voiceId || undefined,
      })
      onGenerated(video_id, title)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors du lancement')
    } finally {
      setLaunching(false)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">

      {/* Header */}
      <div className="px-8 pt-8 pb-6 border-b border-brand-border">
        <h1 className="font-display text-2xl font-bold text-brand-text">Nouvelle publicité Motion</h1>
        <p className="text-brand-muted text-sm mt-1">Brief créatif → visuels animés → voix off → rendu final.</p>
      </div>

      <div className="flex-1 px-8 py-6 space-y-7">

        {/* SECTION 1 — Style (le plus important, en premier) */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <p className="font-mono text-[11px] uppercase tracking-widest text-brand-muted">Style visuel</p>
            {!style && <span className="font-mono text-[10px] text-red-400 uppercase tracking-wider">· Requis</span>}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {MOTION_STYLES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStyle(s.id)}
                className={cn(
                  'relative overflow-hidden rounded-xl border-2 transition-all text-left',
                  style === s.id ? 'border-brand-secondary ring-2 ring-brand-secondary/20' : 'border-transparent hover:border-brand-border'
                )}
              >
                {/* Gradient preview */}
                <div className={cn('h-16 w-full bg-gradient-to-br', s.gradient, 'flex items-end p-2')}>
                  <div className={cn('h-1 w-8 rounded-full', s.accentColor)} />
                </div>
                {/* Label */}
                <div className="p-2.5">
                  <p className="font-display font-semibold text-brand-text text-sm">{s.emoji} {s.label}</p>
                  <p className="font-body text-xs text-brand-muted mt-0.5">{s.desc}</p>
                </div>
                {style === s.id && (
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-brand-secondary flex items-center justify-center">
                    <span className="text-white text-[10px]">✓</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* SECTION 2 — Format + Durée + Voix */}
        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-36">
            <label className="font-mono text-[11px] uppercase tracking-widest text-brand-muted mb-2 block">Format</label>
            <div className="flex gap-2">
              {FORMATS.map((f) => (
                <button key={f.id} type="button" onClick={() => setFormat(f.id)}
                  title={f.desc}
                  className={cn('flex-1 py-2.5 rounded-xl border text-xs font-display font-semibold transition-all',
                    format === f.id ? 'bg-brand-primary-light border-brand-primary text-brand-primary' : 'bg-brand-bg border-brand-border text-brand-muted hover:border-brand-primary/40'
                  )}>
                  {f.label}
                  <p className="font-body font-normal text-[10px] mt-0.5 opacity-70">{f.desc}</p>
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 min-w-36">
            <label className="font-mono text-[11px] uppercase tracking-widest text-brand-muted mb-2 block">Durée</label>
            <div className="flex gap-2">
              {DURATIONS.map((d) => (
                <button key={d.id} type="button" onClick={() => setDuration(d.id)}
                  className={cn('flex-1 py-2.5 rounded-xl border text-xs font-display font-semibold transition-all',
                    duration === d.id ? 'bg-brand-primary-light border-brand-primary text-brand-primary' : 'bg-brand-bg border-brand-border text-brand-muted hover:border-brand-primary/40'
                  )}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 min-w-36">
            <label htmlFor="voice-select" className="font-mono text-[11px] uppercase tracking-widest text-brand-muted mb-2 block">Voix off</label>
            <select id="voice-select" value={voiceId} onChange={(e) => setVoiceId(e.target.value)}
              aria-label="Sélectionner une voix off"
              className="w-full bg-brand-bg border border-brand-border rounded-xl px-3 py-2.5 text-brand-text font-body text-sm focus:outline-none focus:border-brand-primary appearance-none">
              <option value="">Aucune voix</option>
              {voices.map((v) => <option key={v.id} value={v.id}>{v.name}{v.gender ? ` · ${v.gender}` : ''}</option>)}
            </select>
          </div>
        </div>

        {/* SECTION 3 — Identité de marque */}
        <div>
          <p className="font-mono text-[11px] uppercase tracking-widest text-brand-muted mb-3">Identité de marque</p>
          <div className="flex gap-3 flex-wrap">
            {/* Couleur principale */}
            <div>
              <label htmlFor="brand-color" className="font-mono text-[11px] text-brand-muted mb-1.5 block">Couleur principale</label>
              <div className="flex items-center gap-2 bg-brand-bg border border-brand-border rounded-xl px-3 py-2">
                <input id="brand-color" type="color" value={color} onChange={(e) => setColor(e.target.value)}
                  title="Couleur principale de la marque"
                  aria-label="Couleur principale de la marque"
                  className="w-7 h-7 rounded-lg border-0 cursor-pointer bg-transparent" />
                <span className="font-mono text-xs text-brand-muted">{color.toUpperCase()}</span>
              </div>
            </div>
            {/* Logo URL */}
            <div className="flex-1 min-w-48">
              <label className="font-mono text-[11px] text-brand-muted mb-1.5 block">URL du logo (optionnel)</label>
              <div className="flex items-center gap-2 bg-brand-bg border border-brand-border rounded-xl px-3 py-2 focus-within:border-brand-primary transition-colors">
                <ImageIcon size={14} className="text-brand-muted shrink-0" />
                <input
                  type="url"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://exemple.com/logo.png"
                  className="flex-1 bg-transparent text-brand-text font-body text-sm placeholder:text-brand-muted focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 4 — Titre + Brief */}
        <div className="space-y-3">
          <div>
            <label className="font-mono text-[11px] uppercase tracking-widest text-brand-muted mb-2 block">Titre de la publicité</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="ex: Lancement produit — Janvier 2026" maxLength={200}
              className="w-full bg-brand-bg border border-brand-border rounded-xl px-4 py-3 text-brand-text font-body text-sm placeholder:text-brand-muted focus:outline-none focus:border-brand-primary" />
          </div>
          <div>
            <label className="font-mono text-[11px] uppercase tracking-widest text-brand-muted mb-2 block">Brief créatif</label>
            <div className="relative border border-brand-border rounded-2xl bg-brand-bg focus-within:border-brand-primary transition-colors">
              <textarea value={brief} onChange={(e) => setBrief(e.target.value)}
                placeholder="Produit, message clé, public cible, ton, call-to-action…&#10;&#10;ex : Application SaaS de gestion de projet pour PME. Message : gagnez 2h par jour. CTA : Essayez gratuitement." maxLength={2000} rows={5}
                className="w-full bg-transparent px-4 pt-4 pb-14 text-brand-text font-body text-sm placeholder:text-brand-muted focus:outline-none resize-none rounded-2xl" />
              <div className="absolute bottom-3 left-4 right-3 flex items-center justify-between">
                <span className={cn('font-mono text-[11px]', brief.length < 20 ? 'text-red-400' : 'text-brand-muted')}>
                  {brief.length}/2000{brief.length < 20 ? ` · encore ${20 - brief.length} caractères` : ''}
                </span>
                <button type="button" onClick={handleGenerate} disabled={!canSubmit || launching}
                  className="flex items-center gap-2 bg-brand-text text-white font-display font-semibold text-sm px-5 py-2 rounded-xl disabled:opacity-40 hover:opacity-80 transition-opacity">
                  {launching ? <Loader2 size={14} className="animate-spin" /> : <ChevronRight size={14} />}
                  Générer
                </button>
              </div>
            </div>
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
  const [generatingTitle, setGeneratingTitle] = useState('')
  const [activeSession, setActiveSession] = useState<VideoSession | null>(null)

  function handleGenerated(videoId: string, title: string) {
    setGeneratingId(videoId)
    setGeneratingTitle(title)
    setActiveSession(null)
    const newSession: VideoSession = {
      id: videoId,
      title,
      status: 'processing',
      created_at: new Date().toISOString(),
    }
    setSessions((prev) => [newSession, ...prev])
  }

  function handleDone(videoId: string, outputUrl: string | null) {
    setSessions((prev) =>
      prev.map((s) => s.id === videoId ? { ...s, status: 'done', output_url: outputUrl ?? undefined } : s)
    )
  }

  function handleReset() {
    setGeneratingId(null)
    setGeneratingTitle('')
    setActiveSession(null)
  }

  function handleSessionClick(session: VideoSession) {
    if (generatingId === session.id) return // déjà en vue generating
    setActiveSession(session)
    setGeneratingId(null)
  }

  return (
    <div className="flex flex-1 h-full overflow-hidden">

      {/* Sidebar */}
      <aside className="w-64 bg-brand-surface border-r border-brand-border flex flex-col shrink-0">
        <div className="p-4 border-b border-brand-border">
          <h2 className="font-display text-sm font-semibold text-brand-text">Motion Design</h2>
        </div>
        <div className="p-3 border-b border-brand-border">
          <button type="button" onClick={handleReset}
            className="flex items-center gap-2 w-full bg-brand-bg border border-brand-border rounded-xl px-3 py-2.5 text-sm font-body text-brand-text hover:border-brand-secondary/40 hover:bg-purple-50 transition-all">
            <Plus size={16} className="text-brand-secondary" />
            Nouvelle vidéo
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4 py-8">
              <Wand2 size={28} className="text-brand-border mb-2" />
              <p className="text-brand-muted font-body text-xs">Aucune session. Créez votre première publicité !</p>
            </div>
          ) : (
            <div className="space-y-1">
              {sessions.map((s) => {
                const isActive = activeSession?.id === s.id || generatingId === s.id
                return (
                  <button key={s.id}
                    type="button"
                    onClick={() => handleSessionClick(s)}
                    className={cn('w-full text-left px-3 py-2.5 rounded-xl transition-all group',
                      isActive ? 'bg-purple-50' : 'hover:bg-brand-bg'
                    )}>
                    <p className="font-body text-sm text-brand-text truncate">{s.title ?? 'Sans titre'}</p>
                    <div className="flex items-center justify-between mt-0.5">
                      <StatusBadge status={s.status} />
                      <span className="font-mono text-[10px] text-brand-muted">
                        {new Date(s.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </aside>

      {/* Panel principal */}
      <div className="flex-1 overflow-hidden">
        {generatingId
          ? <GeneratingView videoId={generatingId} title={generatingTitle} onReset={handleReset} onDone={handleDone} />
          : activeSession?.status === 'done'
            ? <DoneView session={activeSession} onNew={handleReset} />
            : <CreationForm onGenerated={handleGenerated} />
        }
      </div>
    </div>
  )
}
