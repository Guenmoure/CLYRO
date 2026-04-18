'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Wand2, Loader2, ChevronRight, ImageIcon, Music, Upload, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { startMotionGeneration, getPublicVoices, getVideo, uploadBrandLogo } from '@/lib/api'
import { createBrowserClient } from '@/lib/supabase'
import { useVideoStatus } from '@/hooks/use-video-status'
import { toast } from '@/components/ui/toast'
import { VideoPlayer } from '@/components/ui/video-player'
import { ProgressBar } from '@/components/ui/progress-bar'
import type { MotionStyle, VideoFormat, VideoDuration, Scene } from '@clyro/shared'

// ── Scene type definitions ──────────────────────────────────────────────────────

type SceneType = 'text_hero' | 'split_text_image' | 'product_showcase' | 'stats_counter' | 'cta_end' | 'image_full'

const SCENE_TYPE_OPTIONS: Array<{ value: SceneType; label: string; desc: string }> = [
  { value: 'text_hero',        label: 'Text Hero',        desc: 'Fullscreen typography' },
  { value: 'split_text_image', label: 'Split Text/Image', desc: 'Texte gauche, image droite' },
  { value: 'product_showcase', label: 'Product Showcase', desc: 'Centered product image' },
  { value: 'stats_counter',    label: 'Stats Counter',    desc: 'Animated number' },
  { value: 'cta_end',          label: 'CTA Final',        desc: 'Call to action - \'action' },
  { value: 'image_full',       label: 'Image Full',       desc: 'Image plein cadre' },
]

const SCENE_TYPE_COLORS: Record<SceneType, string> = {
  text_hero:        'bg-purple-100 text-purple-700',
  split_text_image: 'bg-blue-100 text-blue-700',
  product_showcase: 'bg-amber-100 text-amber-700',
  stats_counter:    'bg-green-100 text-green-700',
  cta_end:          'bg-red-100 text-red-700',
  image_full:       'bg-slate-100 text-slate-700',
}

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
    desc: 'Professional and clean',
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
    desc: 'Premium and elegant',
    gradient: 'from-[#1a1208] to-[#2d1f0a]',
    textColor: 'text-[#C9A227]',
    accentColor: 'bg-[#C9A227]',
  },
  {
    id: 'fun',
    emoji: '🎉',
    label: 'Fun',
    desc: 'Colorful and engaging',
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
  { id: 'auto', label: 'Auto (script)' },
  { id: '6s',   label: '6s'   },
  { id: '15s',  label: '15s'  },
  { id: '30s',  label: '30s'  },
  { id: '60s',  label: '60s'  },
  { id: '120s', label: '2 min' },
  { id: '180s', label: '3 min' },
  { id: '300s', label: '5 min' },
]

const MUSIC_TRACKS: Array<{ id: string; label: string; mood: string }> = [
  { id: 'ambient-calm',    label: 'Ambient Calm',    mood: 'calm · educational' },
  { id: 'upbeat-corporate',label: 'Corporate Upbeat', mood: 'motivant · pro'   },
  { id: 'epic-cinematic',  label: 'Epic Cinematic',  mood: 'dramatique · film' },
  { id: 'playful-fun',     label: 'Playful & Fun',   mood: 'jovial · fun'     },
  { id: 'lofi-chill',      label: 'Lo-Fi Chill',     mood: 'relaxed · study'  },
]

const PIPELINE = [
  { key: 'storyboard', label: 'Analyse du brief',  pct: 20  },
  { key: 'visuals',    label: 'Generating visuals', pct: 55  },
  { key: 'audio',      label: 'Voix off',           pct: 72  },
  { key: 'assembly',   label: 'Assemblage Motion',  pct: 90  },
  { key: 'done',       label: 'Video ready!',      pct: 100 },
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
    done:       'bg-success/10 text-success',
    processing: 'bg-blue-500/10 text-blue-400',
    storyboard: 'bg-blue-500/10 text-blue-400',
    visuals:    'bg-blue-500/10 text-blue-400',
    audio:      'bg-blue-500/10 text-blue-400',
    assembly:   'bg-blue-500/10 text-blue-400',
    pending:    'bg-card text-[--text-muted]',
    error:      'bg-error/10 text-error',
  }
  const label: Record<string, string> = {
    done: 'Ready', processing: 'En cours', storyboard: 'Storyboard',
    visuals: 'Visuels', audio: 'Audio', assembly: 'Assemblage',
    pending: 'Pending', error: 'Erreur',
  }
  return (
    <span className={cn('font-mono text-[11px] uppercase tracking-wider px-1.5 py-0.5 rounded-full', map[status] ?? map.pending)}>
      {label[status] ?? status}
    </span>
  )
}

// ── Scene type badge ───────────────────────────────────────────────────────────

function SceneTypeBadge({ sceneType }: { sceneType?: string }) {
  if (!sceneType) return null
  const colorClass = SCENE_TYPE_COLORS[sceneType as SceneType] ?? 'bg-slate-100 text-slate-700'
  const option = SCENE_TYPE_OPTIONS.find((o) => o.value === sceneType)
  return (
    <span className={cn('font-mono text-[11px] uppercase tracking-wider px-1.5 py-0.5 rounded-full', colorClass)}>
      {option?.label ?? sceneType}
    </span>
  )
}

// ── Storyboard scene cards ──────────────────────────────────────────────────────

interface StoryboardScene extends Scene {
  scene_type?: SceneType
}

function StoryboardPanel({ scenes, onScenesChange }: {
  scenes: StoryboardScene[]
  onScenesChange: (scenes: StoryboardScene[]) => void
}) {
  function handleTypeChange(idx: number, value: SceneType) {
    const updated = scenes.map((s, i) =>
      i === idx ? { ...s, scene_type: value } : s
    )
    onScenesChange(updated)
  }

  return (
    <div className="mt-6">
      <p className="font-mono text-[11px] uppercase tracking-widest text-[--text-muted] mb-3">
        Storyboard — {scenes.length} scène{scenes.length > 1 ? 's' : ''}
      </p>
      <div className="space-y-2">
        {scenes.map((scene, idx) => (
          <div
            key={scene.id}
            className="bg-card border border-border rounded-xl p-3 flex flex-col gap-2"
          >
            {/* Header row */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-[11px] text-[--text-muted] shrink-0">#{idx + 1}</span>
              <SceneTypeBadge sceneType={scene.scene_type} />
              <span className="font-mono text-[11px] text-[--text-muted] ml-auto shrink-0">
                {scene.duree_estimee}s
              </span>
            </div>

            {/* display_text */}
            {scene.display_text && (
              <p className="font-display text-sm font-semibold text-foreground leading-tight truncate">
                {scene.display_text}
              </p>
            )}

            {/* texte_voix */}
            {scene.texte_voix && (
              <p className="font-body text-xs text-[--text-muted] leading-snug line-clamp-2">
                {scene.texte_voix}
              </p>
            )}

            {/* scene_type selector */}
            <div className="flex items-center gap-2">
              <label
                htmlFor={`scene-type-${idx}`}
                className="font-mono text-[11px] uppercase tracking-wider text-[--text-muted] shrink-0"
              >
                Type
              </label>
              <select
                id={`scene-type-${idx}`}
                value={scene.scene_type ?? ''}
                onChange={(e) => handleTypeChange(idx, e.target.value as SceneType)}
                aria-label={`Type de scène ${idx + 1}`}
                className="flex-1 bg-muted border border-border rounded-lg px-2 py-1 text-foreground font-body text-xs focus:outline-none focus:border-blue-500 appearance-none cursor-pointer"
              >
                <option value="">— Choisir —</option>
                {SCENE_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label} · {opt.desc}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Generating view ────────────────────────────────────────────────────────────

function GeneratingView({ videoId, title, onReset, onDone, onStatusChange }: {
  videoId: string
  title: string
  onReset: () => void
  onDone: (id: string, url: string | null) => void
  onStatusChange?: (status: string) => void
}) {
  const router = useRouter()
  const { status, progress, outputUrl, errorMessage, isDone, isError } = useVideoStatus(videoId)
  const prevStatusRef = useRef<string>('')
  const [storyboardScenes, setStoryboardScenes] = useState<StoryboardScene[]>([])

  useEffect(() => {
    if (status && status !== prevStatusRef.current) {
      prevStatusRef.current = status
      onStatusChange?.(status)

      // Fetch storyboard scenes once they're available (after 'storyboard' step)
      const SCENE_STATUSES = new Set(['visuals', 'audio', 'assembly', 'done'])
      if (SCENE_STATUSES.has(status) && storyboardScenes.length === 0) {
        getVideo(videoId)
          .then((res) => {
            const video = res.data as { metadata?: { scenes?: StoryboardScene[] } }
            const scenes = video?.metadata?.scenes
            if (Array.isArray(scenes) && scenes.length > 0) {
              setStoryboardScenes(scenes)
            }
          })
          .catch(() => { /* non-critical */ })
      }
    }
  }, [status, onStatusChange, videoId, storyboardScenes.length])

  useEffect(() => {
    if (isDone) {
      onDone(videoId, outputUrl)
      const t = setTimeout(() => router.refresh(), 2500)
      return () => clearTimeout(t)
    }
  }, [isDone, videoId, outputUrl, onDone, router])

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 px-8 max-w-lg mx-auto overflow-y-auto py-8">
      <div className="w-full">
        <h2 className="font-display text-xl font-bold text-foreground mb-1 text-center">
          {isError ? 'Generation error' : isDone ? 'Ad ready!' : 'Generating…'}
        </h2>
        <p className="text-[--text-muted] text-sm text-center mb-6">
          {!isDone && !isError && 'Environ 2–5 minutes. Tu peux fermer cet onglet.'}
        </p>

        <ProgressBar value={progress} className="mb-6" />

        <div className="space-y-3 mb-6">
          {PIPELINE.map((p) => {
            const done   = progress >= p.pct
            const active = status === p.key && !done
            return (
              <div key={p.key} className="flex items-center gap-3">
                <div className={cn('w-5 h-5 rounded-full border text-xs font-mono flex items-center justify-center transition-all',
                  done   ? 'bg-purple-500 border-purple-500 text-white'
                  : active ? 'border-purple-500 text-purple-500'
                  : 'border-border text-[--text-muted]'
                )}>
                  {done ? '✓' : '·'}
                </div>
                <span className={cn('font-body text-sm', done ? 'text-foreground' : 'text-[--text-muted]')}>{p.label}</span>
                {active && <Loader2 size={12} className="text-purple-500 animate-spin" />}
              </div>
            )
          })}
        </div>

        {/* Storyboard scene cards (shown once scenes are available) */}
        {storyboardScenes.length > 0 && (
          <StoryboardPanel
            scenes={storyboardScenes}
            onScenesChange={setStoryboardScenes}
          />
        )}

        {isError && (
          <div className="bg-error/10 border border-error/30 rounded-xl p-4 text-error text-sm mb-4">
            {errorMessage ?? 'Une erreur est survenue.'}
          </div>
        )}

        {isDone && outputUrl && (
          <VideoPlayer url={outputUrl} title={title} />
        )}

        {isError && (
          <button type="button" onClick={onReset} className="mt-4 text-sm text-blue-500 font-medium hover:underline">
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
          <h2 className="font-display text-lg font-bold text-foreground">{session.title ?? 'Advertisement'}</h2>
          <button type="button" onClick={onNew} className="text-xs font-mono text-blue-500 hover:underline">+ Nouvelle vidéo</button>
        </div>
        {session.output_url ? (
          <VideoPlayer url={session.output_url} title={session.title ?? undefined} />
        ) : (
          <div className="flex items-center justify-center h-40 rounded-2xl bg-card border border-border text-[--text-muted] text-sm">
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
  const [duration, setDuration] = useState<VideoDuration>('auto')
  const [voiceId,  setVoiceId]  = useState('')
  const [title,    setTitle]    = useState('')
  const [brief,    setBrief]    = useState('')
  const [color,        setColor]        = useState('#667eea')
  const [logoUrl,      setLogoUrl]      = useState('')
  const [logoUploading, setLogoUploading] = useState(false)
  const [musicTrackId, setMusicTrackId] = useState('')
  const [voices,       setVoices]       = useState<VoiceItem[]>([])
  const [launching,    setLaunching]    = useState(false)
  const logoFileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getPublicVoices().then(({ voices }) => setVoices(voices as VoiceItem[])).catch(() => {})
  }, [])

  const canSubmit = !!style && title.trim().length > 0 && brief.trim().length >= 20

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoUploading(true)
    try {
      const supabase = createBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Session expired')
      const url = await uploadBrandLogo(file, session.user.id)
      setLogoUrl(url)
      toast.success('Imported logo')
    } catch {
      toast.error('Error during \'import du logo')
    } finally {
      setLogoUploading(false)
      if (logoFileRef.current) logoFileRef.current.value = ''
    }
  }

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
        voice_id:       voiceId || undefined,
        music_track_id: musicTrackId || undefined,
      })
      onGenerated(video_id, title)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Launch error')
    } finally {
      setLaunching(false)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">

      {/* Header */}
      <div className="px-8 pt-8 pb-6 border-b border-border">
        <h1 className="font-display text-2xl font-bold text-foreground">Nouvelle publicité Motion</h1>
        <p className="text-[--text-muted] text-sm mt-1">Brief créatif → visuels animés → voix off → rendu final.</p>
      </div>

      <div className="flex-1 px-8 py-6 space-y-7">

        {/* SECTION 1 — Style (le plus important, en premier) */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <p className="font-mono text-[11px] uppercase tracking-widest text-[--text-muted]">Style visuel</p>
            {!style && <span className="font-mono text-[11px] text-red-400 uppercase tracking-wider">· Requis</span>}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {MOTION_STYLES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStyle(s.id)}
                className={cn(
                  'relative overflow-hidden rounded-xl border-2 transition-all text-left',
                  style === s.id ? 'border-purple-500 ring-2 ring-purple-500/20' : 'border-transparent hover:border-border'
                )}
              >
                {/* Gradient preview */}
                <div className={cn('h-16 w-full bg-gradient-to-br', s.gradient, 'flex items-end p-2')}>
                  <div className={cn('h-1 w-8 rounded-full', s.accentColor)} />
                </div>
                {/* Label */}
                <div className="p-2.5">
                  <p className="font-display font-semibold text-foreground text-sm">{s.emoji} {s.label}</p>
                  <p className="font-body text-xs text-[--text-muted] mt-0.5">{s.desc}</p>
                </div>
                {style === s.id && (
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center">
                    <span className="text-white text-[11px]">✓</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* SECTION 2 — Format + Durée + Voix */}
        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-36">
            <label className="font-mono text-[11px] uppercase tracking-widest text-[--text-muted] mb-2 block">Format</label>
            <div className="flex gap-2">
              {FORMATS.map((f) => (
                <button key={f.id} type="button" onClick={() => setFormat(f.id)}
                  title={f.desc}
                  className={cn('flex-1 py-2.5 rounded-xl border text-xs font-display font-semibold transition-all',
                    format === f.id ? 'bg-blue-500/10 border-blue-500 text-blue-500' : 'bg-card border-border text-[--text-muted] hover:border-blue-500/40'
                  )}>
                  {f.label}
                  <p className="font-body font-normal text-[11px] mt-0.5 opacity-70">{f.desc}</p>
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 min-w-36">
            <label className="font-mono text-[11px] uppercase tracking-widest text-[--text-muted] mb-2 block">Duration</label>
            <div className="flex gap-2">
              {DURATIONS.map((d) => (
                <button key={d.id} type="button" onClick={() => setDuration(d.id)}
                  className={cn('flex-1 py-2.5 rounded-xl border text-xs font-display font-semibold transition-all',
                    duration === d.id ? 'bg-blue-500/10 border-blue-500 text-blue-500' : 'bg-card border-border text-[--text-muted] hover:border-blue-500/40'
                  )}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 min-w-36">
            <label htmlFor="voice-select" className="font-mono text-[11px] uppercase tracking-widest text-[--text-muted] mb-2 block">Voix off</label>
            <select id="voice-select" value={voiceId} onChange={(e) => setVoiceId(e.target.value)}
              aria-label="Select a voiceover"
              className="w-full bg-card border border-border rounded-xl px-3 py-2.5 text-foreground font-body text-sm focus:outline-none focus:border-blue-500 appearance-none">
              <option value="">Aucune voix</option>
              {voices.map((v) => <option key={v.id} value={v.id}>{v.name}{v.gender ? ` · ${v.gender}` : ''}</option>)}
            </select>
          </div>
        </div>

        {/* SECTION 2b — Musique de fond */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Music size={12} className="text-[--text-muted]" />
            <p className="font-mono text-[11px] uppercase tracking-widest text-[--text-muted]">Musique de fond</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setMusicTrackId('')}
              className={cn(
                'px-3 py-2 rounded-xl border text-xs font-body transition-all',
                musicTrackId === '' ? 'bg-blue-500/10 border-blue-500 text-blue-500' : 'bg-card border-border text-[--text-muted] hover:border-blue-500/40'
              )}
            >
              Aucune
            </button>
            {MUSIC_TRACKS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setMusicTrackId(t.id)}
                className={cn(
                  'px-3 py-2 rounded-xl border text-left transition-all',
                  musicTrackId === t.id ? 'bg-blue-500/10 border-blue-500' : 'bg-card border-border hover:border-blue-500/40'
                )}
              >
                <p className={cn('text-xs font-display font-semibold', musicTrackId === t.id ? 'text-blue-500' : 'text-foreground')}>{t.label}</p>
                <p className="text-[11px] font-body text-[--text-muted] mt-0.5">{t.mood}</p>
              </button>
            ))}
          </div>
        </div>

        {/* SECTION 3 — Identité de marque */}
        <div>
          <p className="font-mono text-[11px] uppercase tracking-widest text-[--text-muted] mb-3">Identité de marque</p>
          <div className="flex gap-3 flex-wrap">
            {/* Couleur principale */}
            <div>
              <label htmlFor="brand-color" className="font-mono text-[11px] text-[--text-muted] mb-1.5 block">Couleur principale</label>
              <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2">
                <input id="brand-color" type="color" value={color} onChange={(e) => setColor(e.target.value)}
                  title="Couleur principale de la marque"
                  aria-label="Couleur principale de la marque"
                  className="w-7 h-7 rounded-lg border-0 cursor-pointer bg-transparent" />
                <span className="font-mono text-xs text-[--text-muted]">{color.toUpperCase()}</span>
              </div>
            </div>
            {/* Logo upload */}
            <div>
              <label className="font-mono text-[11px] text-[--text-muted] mb-1.5 block">Logo (optionnel)</label>
              <div className="flex items-center gap-2">
                {logoUrl ? (
                  <div className="relative w-10 h-10 rounded-xl border border-border bg-card overflow-hidden flex items-center justify-center shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logoUrl} alt="Logo" className="max-w-full max-h-full object-contain p-1" />
                    <button
                      type="button"
                      onClick={() => setLogoUrl('')}
                      className="absolute top-0 right-0 w-4 h-4 bg-black/60 rounded-bl-lg flex items-center justify-center"
                      title="Supprimer le logo"
                    >
                      <X size={8} className="text-white" />
                    </button>
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-xl border-2 border-dashed border-border bg-card flex items-center justify-center shrink-0">
                    <ImageIcon size={14} className="text-[--text-muted]" />
                  </div>
                )}
                <input
                  ref={logoFileRef}
                  type="file"
                  accept="image/png,image/svg+xml,image/jpeg,image/webp"
                  onChange={handleLogoUpload}
                  className="hidden"
                  aria-label="Importer un logo"
                />
                <button
                  type="button"
                  onClick={() => logoFileRef.current?.click()}
                  disabled={logoUploading}
                  className="flex items-center gap-1.5 bg-card border border-border rounded-xl px-3 py-2 text-xs text-[--text-muted] hover:text-foreground hover:border-blue-500 transition-colors disabled:opacity-40"
                >
                  {logoUploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                  {logoUploading ? 'Uploading…' : logoUrl ? 'Change' : 'Upload'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 4 — Titre + Brief */}
        <div className="space-y-3">
          <div>
            <label className="font-mono text-[11px] uppercase tracking-widest text-[--text-muted] mb-2 block">Ad title</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="ex: Lancement produit — Janvier 2026" maxLength={200}
              className="w-full bg-card border border-border rounded-xl px-4 py-3 text-foreground font-body text-sm placeholder:text-[--text-muted] focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="font-mono text-[11px] uppercase tracking-widest text-[--text-muted] mb-2 block">Brief créatif</label>
            <div className="relative border border-border rounded-2xl bg-card focus-within:border-blue-500 transition-colors">
              <textarea value={brief} onChange={(e) => setBrief(e.target.value)}
                placeholder="Product, key message, target audience, tone, call-to-action…Produit, message clé, public cible, ton, call-to-action…&#10;&#10;ex : Application SaaS de gestion de projet pour PME. Message : gagnez 2h par jour. CTA : Essayez gratuitement.#10;Produit, message clé, public cible, ton, call-to-action…&#10;&#10;ex : Application SaaS de gestion de projet pour PME. Message : gagnez 2h par jour. CTA : Essayez gratuitement.#10;e.g.: Project management SaaS for SMBs. Message: save 2 hours daily. CTA: Try free." maxLength={2000} rows={5}
                className="w-full bg-transparent px-4 pt-4 pb-14 text-foreground font-body text-sm placeholder:text-[--text-muted] focus:outline-none resize-none rounded-2xl" />
              <div className="absolute bottom-3 left-4 right-3 flex items-center justify-between">
                <span className={cn('font-mono text-[11px]', brief.length < 20 ? 'text-red-400' : 'text-[--text-muted]')}>
                  {brief.length}/2000{brief.length < 20 ? ` · encore ${20 - brief.length} caractères` : ''}
                </span>
                <button type="button" onClick={handleGenerate} disabled={!canSubmit || launching}
                  className="flex items-center gap-2 bg-foreground text-white font-display font-semibold text-sm px-5 py-2 rounded-xl disabled:opacity-40 hover:opacity-80 transition-opacity">
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

// Statuts "actifs"
const ACTIVE_STATUSES = new Set(['pending', 'processing', 'storyboard', 'visuals', 'audio', 'assembly'])
function isActive(status: string) { return ACTIVE_STATUSES.has(status) }

// ── Main Hub ───────────────────────────────────────────────────────────────────

export function MotionHub({ initialVideos }: { initialVideos: VideoSession[] }) {
  const [sessions, setSessions] = useState<VideoSession[]>(initialVideos)
  const [viewId,   setViewId]   = useState<string | null>(() =>
    initialVideos.find((v) => isActive(v.status))?.id ?? null
  )

  const viewSession      = sessions.find((s) => s.id === viewId) ?? null
  const isViewGenerating = viewSession ? isActive(viewSession.status) : false

  const updateSessionStatus = useCallback((videoId: string, status: string, outputUrl?: string | null) => {
    setSessions((prev) =>
      prev.map((s) => s.id === videoId
        ? { ...s, status, ...(outputUrl !== undefined ? { output_url: outputUrl ?? undefined } : {}) }
        : s
      )
    )
  }, [])

  function handleGenerated(videoId: string, title: string) {
    setSessions((prev) => [
      { id: videoId, title, status: 'pending', created_at: new Date().toISOString() },
      ...prev,
    ])
    setViewId(videoId)
  }

  function handleDone(videoId: string, outputUrl: string | null) {
    updateSessionStatus(videoId, 'done', outputUrl)
  }

  function handleReset() { setViewId(null) }

  function handleSessionClick(session: VideoSession) { setViewId(session.id) }

  return (
    <div className="flex flex-1 h-full overflow-hidden">

      {/* Sidebar */}
      <aside className="glass glass-border-r w-52 m-3 mr-0 rounded-2xl flex flex-col shrink-0 overflow-hidden">
        <div className="p-4 glass-border-b">
          <h2 className="font-display text-sm font-semibold text-foreground">Motion Design</h2>
        </div>
        <div className="p-3 glass-border-b">
          <button type="button" onClick={handleReset}
            className="flex items-center gap-2 w-full bg-white/40 dark:bg-white/5 border border-white/20 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm font-body text-foreground hover:bg-purple-500/10 hover:border-purple-500/40 transition-all">
            <Plus size={16} className="text-purple-500" />
            Nouvelle vidéo
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4 py-8 gap-3">
              <div className="relative">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-purple-500/15 to-pink-500/15 blur-xl" />
                <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-border flex items-center justify-center">
                  <Wand2 size={22} className="text-purple-500" />
                </div>
              </div>
              <p className="font-display text-sm font-semibold text-foreground">Aucune session</p>
              <p className="text-[--text-secondary] font-body text-xs max-w-[180px]">
                Create your first Motion ad pour la voir ici.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {sessions.map((s) => {
                const isCurrent   = viewId === s.id
                const inProgress  = isActive(s.status)
                return (
                  <button key={s.id}
                    type="button"
                    onClick={() => handleSessionClick(s)}
                    className={cn('w-full text-left px-3 py-2.5 rounded-xl transition-all',
                      isCurrent ? 'bg-purple-50' : 'hover:bg-card'
                    )}>
                    <div className="flex items-center gap-1.5">
                      {inProgress && <Loader2 size={10} className="shrink-0 text-purple-500 animate-spin" />}
                      <p className="font-body text-sm text-foreground truncate">{s.title ?? 'Sans titre'}</p>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <StatusBadge status={s.status} />
                      <span className="font-mono text-[11px] text-[--text-muted]">
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
        {viewId && isViewGenerating
          ? <GeneratingView
              key={viewId}
              videoId={viewId}
              title={viewSession?.title ?? ''}
              onReset={handleReset}
              onDone={handleDone}
              onStatusChange={(status) => updateSessionStatus(viewId, status)}
            />
          : viewId && viewSession?.status === 'done'
            ? <DoneView session={viewSession} onNew={handleReset} />
            : <CreationForm onGenerated={handleGenerated} />
        }
      </div>
    </div>
  )
}
