'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Video, Mic2, Loader2, Sparkles, Settings2, Send,
  ChevronDown, X, Upload, Check, Wand2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { startFacelessGeneration, getVoices } from '@/lib/api'
import { useVideoStatus } from '@/hooks/use-video-status'
import { toast } from '@/components/ui/toast'
import { VideoPlayer } from '@/components/ui/video-player'
import { ProWizard } from '@/components/faceless/pro-wizard'
import { BrandKitPicker } from '@/components/shared/brand-kit-picker'
import type { FacelessStyle, VideoFormat, VideoDuration } from '@clyro/shared'

// ── Style catalogue ────────────────────────────────────────────────────────────

const STYLES: Array<{
  id: FacelessStyle
  label: string
  desc: string
  gradient: string
  textColor: string
  icon: string
  badge?: string
}> = [
  { id: 'cinematique',     label: 'Cinématique',     desc: 'Lumière dramatique, 8K',          gradient: 'from-slate-900 via-zinc-800 to-slate-900',     textColor: 'text-amber-300',  icon: '🎥' },
  { id: 'stock-vo',        label: 'Stock + VO',       desc: 'Documentaire National Geo',        gradient: 'from-sky-950 via-blue-900 to-sky-950',          textColor: 'text-sky-300',    icon: '🎬' },
  { id: 'whiteboard',      label: 'Whiteboard',       desc: 'Marqueur sur tableau blanc',       gradient: 'from-gray-50 via-white to-gray-100',             textColor: 'text-gray-700',   icon: '✏️' },
  { id: 'stickman',        label: 'Bonshommes',       desc: 'Stickman & formes géo',            gradient: 'from-stone-100 via-white to-stone-50',           textColor: 'text-stone-700',  icon: '🕺', badge: 'New' },
  { id: 'flat-design',     label: 'Flat Design',      desc: 'Illustration plate, couleurs vives', gradient: 'from-emerald-500 via-teal-500 to-emerald-600', textColor: 'text-white',      icon: '🎨', badge: 'New' },
  { id: '3d-pixar',        label: '3D Pixar',         desc: 'Claymation style Pixar',           gradient: 'from-orange-300 via-amber-400 to-yellow-300',    textColor: 'text-orange-900', icon: '🧸', badge: 'New' },
  { id: 'motion-graphics', label: 'Motion Graphics',  desc: 'Formes géo, typo animée',          gradient: 'from-violet-950 via-purple-900 to-indigo-950',  textColor: 'text-violet-300', icon: '⚡' },
  { id: 'animation-2d',    label: 'Animation 2D',     desc: 'Dessin animé vectoriel',           gradient: 'from-pink-500 via-rose-500 to-pink-600',         textColor: 'text-white',      icon: '🖌️' },
]

const FORMATS: Array<{ id: VideoFormat; label: string; desc: string }> = [
  { id: '9:16', label: '9:16', desc: 'TikTok / Reels' },
  { id: '1:1',  label: '1:1',  desc: 'Instagram' },
  { id: '16:9', label: '16:9', desc: 'YouTube' },
]

const DURATIONS: Array<{ id: VideoDuration; label: string }> = [
  { id: '15s', label: '15s' },
  { id: '30s', label: '30s' },
  { id: '60s', label: '60s' },
]

const PIPELINE = [
  { key: 'storyboard', label: 'Storyboard IA',      pct: 25  },
  { key: 'visuals',    label: 'Génération visuels',  pct: 60  },
  { key: 'audio',      label: 'Voix off',            pct: 75  },
  { key: 'assembly',   label: 'Assemblage vidéo',    pct: 90  },
  { key: 'done',       label: 'Vidéo prête !',       pct: 100 },
]

const ACTIVE_STATUSES = new Set(['pending', 'processing', 'storyboard', 'visuals', 'audio', 'assembly'])
function isActive(s: string) { return ACTIVE_STATUSES.has(s) }

interface VideoSession { id: string; title: string | null; status: string; output_url?: string | null; created_at: string }
interface VoiceItem    { id: string; name: string; gender?: string; accent?: string }

// ── Status badge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    done: 'bg-emerald-50 text-emerald-600', error: 'bg-red-50 text-red-500',
    pending: 'bg-gray-100 text-gray-400',
  }
  const label: Record<string, string> = {
    done: 'Prête', error: 'Erreur', pending: 'En attente',
    storyboard: 'Storyboard', visuals: 'Visuels', audio: 'Audio', assembly: 'Assemblage',
  }
  const cls = map[status] ?? 'bg-blue-50 text-brand-primary'
  return (
    <span className={cn('font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full', cls)}>
      {label[status] ?? status}
    </span>
  )
}

// ── Generating view ────────────────────────────────────────────────────────────

function GeneratingView({ videoId, title, onReset, onDone, onStatusChange }: {
  videoId: string; title: string
  onReset: () => void
  onDone: (id: string, url: string | null) => void
  onStatusChange?: (status: string) => void
}) {
  const router = useRouter()
  const { status, progress, outputUrl, errorMessage, isDone, isError } = useVideoStatus(videoId)
  const notifiedRef = useRef(false)
  const prevRef = useRef('')

  useEffect(() => {
    if (status && status !== prevRef.current) { prevRef.current = status; onStatusChange?.(status) }
  }, [status, onStatusChange])

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
          {isError ? 'Erreur de génération' : isDone ? '🎉 Vidéo prête !' : 'Génération en cours…'}
        </h2>
        <p className="text-brand-muted text-sm text-center mb-6">
          {!isDone && !isError && 'Environ 60–90s. Tu peux fermer cet onglet.'}
        </p>
        <div className="h-1.5 bg-brand-bg rounded-full mb-6 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-brand-primary to-purple-500 rounded-full transition-all duration-700"
            style={{ width: `${Math.max(progress, 5)}%` } as React.CSSProperties} />
        </div>
        <div className="space-y-3 mb-6">
          {PIPELINE.map((p) => {
            const done = progress >= p.pct; const active = status === p.key && !done
            return (
              <div key={p.key} className="flex items-center gap-3">
                <div className={cn('w-5 h-5 rounded-full border text-xs font-mono flex items-center justify-center transition-all',
                  done ? 'bg-brand-primary border-brand-primary text-white' : active ? 'border-brand-primary text-brand-primary' : 'border-brand-border text-brand-muted')}>
                  {done ? <Check size={10} /> : '·'}
                </div>
                <span className={cn('font-body text-sm', done ? 'text-brand-text' : 'text-brand-muted')}>{p.label}</span>
                {active && <Loader2 size={12} className="text-brand-primary animate-spin" />}
              </div>
            )
          })}
        </div>
        {isError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600 text-sm mb-4">
            {errorMessage ?? 'Une erreur est survenue.'}
          </div>
        )}
        {isDone && outputUrl && <VideoPlayer url={outputUrl} title={title} />}
        {isError && (
          <button type="button" onClick={onReset} className="mt-4 text-sm text-brand-primary font-medium hover:underline">Recommencer</button>
        )}
      </div>
    </div>
  )
}

// ── Done view ─────────────────────────────────────────────────────────────────

function DoneView({ session, onNew }: { session: VideoSession; onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-8 max-w-lg mx-auto gap-4">
      <div className="w-full">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-bold text-brand-text">{session.title ?? 'Vidéo'}</h2>
          <button type="button" onClick={onNew} className="text-xs font-mono text-brand-primary hover:underline">+ Nouvelle vidéo</button>
        </div>
        {session.output_url
          ? <VideoPlayer url={session.output_url} title={session.title ?? undefined} />
          : <div className="flex items-center justify-center h-40 rounded-2xl bg-brand-bg border border-brand-border text-brand-muted text-sm">Vidéo non disponible</div>
        }
      </div>
    </div>
  )
}

// ── Style picker dropdown ──────────────────────────────────────────────────────

function StylePickerDropdown({ value, onChange, onClose }: {
  value: FacelessStyle | null
  onChange: (s: FacelessStyle) => void
  onClose: () => void
}) {
  return (
    <div className="absolute left-0 top-full mt-2 z-50 w-[480px] bg-white dark:bg-gray-900 border border-brand-border rounded-2xl shadow-xl p-4 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <p className="font-display text-sm font-semibold text-brand-text">Style visuel</p>
        <button type="button" onClick={onClose} aria-label="Fermer" className="text-brand-muted hover:text-brand-text transition-colors">
          <X size={14} />
        </button>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {STYLES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => { onChange(s.id); onClose() }}
            className={cn('relative rounded-xl overflow-hidden transition-all group',
              value === s.id ? 'ring-2 ring-brand-primary ring-offset-1' : 'hover:ring-1 hover:ring-brand-border'
            )}
          >
            {/* Gradient thumbnail */}
            <div className={cn('h-16 w-full bg-gradient-to-br', s.gradient, 'flex items-center justify-center')}>
              <span className="text-xl">{s.icon}</span>
            </div>
            <div className="p-2 bg-brand-surface">
              <p className="font-display font-semibold text-[11px] text-brand-text truncate">{s.label}</p>
            </div>
            {s.badge && (
              <span className="absolute top-1 right-1 font-mono text-[8px] uppercase tracking-wider bg-brand-primary text-white px-1 py-0.5 rounded-full">
                {s.badge}
              </span>
            )}
            {value === s.id && (
              <div className="absolute top-1 left-1 w-4 h-4 rounded-full bg-brand-primary flex items-center justify-center">
                <Check size={8} className="text-white" />
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Voice picker dropdown ──────────────────────────────────────────────────────

function VoicePickerDropdown({ value, voices, onChange, onClose }: {
  value: string
  voices: VoiceItem[]
  onChange: (id: string) => void
  onClose: () => void
}) {
  return (
    <div className="absolute left-0 top-full mt-2 z-50 w-64 bg-white dark:bg-gray-900 border border-brand-border rounded-2xl shadow-xl p-3 animate-fade-in">
      <div className="flex items-center justify-between mb-2">
        <p className="font-display text-sm font-semibold text-brand-text">Voix off</p>
        <button type="button" onClick={onClose} aria-label="Fermer" className="text-brand-muted hover:text-brand-text transition-colors"><X size={14} /></button>
      </div>
      <div className="space-y-1 max-h-56 overflow-y-auto">
        <button type="button" onClick={() => { onChange(''); onClose() }}
          className={cn('w-full text-left px-3 py-2 rounded-xl text-sm font-body transition-colors',
            !value ? 'bg-brand-primary-light text-brand-primary' : 'hover:bg-brand-bg text-brand-muted')}>
          Aucune voix
        </button>
        {voices.map((v) => (
          <button key={v.id} type="button" onClick={() => { onChange(v.id); onClose() }}
            className={cn('w-full text-left px-3 py-2 rounded-xl transition-colors', value === v.id ? 'bg-brand-primary-light text-brand-primary' : 'hover:bg-brand-bg text-brand-text')}>
            <p className="text-sm font-body font-medium">{v.name}</p>
            {(v.gender || v.accent) && (
              <p className="text-[11px] text-brand-muted">{[v.gender, v.accent].filter(Boolean).join(' · ')}</p>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Creation form (HeyGen-like) ────────────────────────────────────────────────

function CreationForm({ onGenerated }: { onGenerated: (id: string, title: string) => void }) {
  const [style,      setStyle]      = useState<FacelessStyle | null>(null)
  const [format,     setFormat]     = useState<VideoFormat>('9:16')
  const [duration,   setDuration]   = useState<VideoDuration>('30s')
  const [voiceId,    setVoiceId]    = useState('')
  const [brandKitId, setBrandKitId] = useState<string | null>(null)
  const [title,      setTitle]      = useState('')
  const [script,     setScript]     = useState('')
  const [audioFile,  setAudioFile]  = useState<File | null>(null)
  const [inputType,  setInputType]  = useState<'script' | 'audio'>('script')
  const [voices,     setVoices]     = useState<VoiceItem[]>([])
  const [launching,  setLaunching]  = useState(false)
  const [showStylePicker, setShowStylePicker] = useState(false)
  const [showVoicePicker, setShowVoicePicker] = useState(false)
  const [showSettings,    setShowSettings]    = useState(false)
  const [showProWizard,   setShowProWizard]   = useState(false)

  const styleRef = useRef<HTMLDivElement>(null)
  const voiceRef = useRef<HTMLDivElement>(null)
  const fileRef  = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getVoices().then(({ public: pub }) => setVoices(pub as VoiceItem[])).catch(() => {})
  }, [])

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (styleRef.current && !styleRef.current.contains(e.target as Node)) setShowStylePicker(false)
      if (voiceRef.current && !voiceRef.current.contains(e.target as Node)) setShowVoicePicker(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selectedStyle = STYLES.find((s) => s.id === style)
  const selectedVoice = voices.find((v) => v.id === voiceId)

  const canSubmit = !!style && (
    inputType === 'script' ? script.trim().length >= 20 : !!audioFile
  )

  async function handleGenerate() {
    if (!style) { toast.error('Sélectionne un style visuel'); return }
    if (inputType === 'script' && script.trim().length < 20) { toast.error('Script trop court (min 20 caractères)'); return }
    setLaunching(true)
    try {
      const videoTitle = title.trim() || script.trim().slice(0, 60) || 'Nouvelle vidéo'
      const { video_id } = await startFacelessGeneration({
        title: videoTitle,
        style,
        input_type: inputType,
        script: inputType === 'script' ? script : undefined,
        voice_id: voiceId || undefined,
        brand_kit_id: brandKitId || undefined,
      })
      onGenerated(video_id, videoTitle)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors du lancement')
    } finally {
      setLaunching(false)
    }
  }

  if (showProWizard) {
    return (
      <ProWizard
        onGenerated={(videoId, t) => { setShowProWizard(false); onGenerated(videoId, t) }}
        onCancel={() => setShowProWizard(false)}
      />
    )
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* ── Centered prompt area ─────────────────────────────────── */}
      <div className="flex flex-col items-center justify-center flex-1 px-6 py-10 min-h-[520px]">
        <div className="w-full max-w-2xl">

          {/* Headline */}
          <div className="text-center mb-8">
            <h1 className="font-display text-2xl font-bold text-brand-text mb-1">
              Transforme tes idées en vidéo
            </h1>
            <p className="font-body text-sm text-brand-muted">
              Choisis un style, une voix, écris ton script — l'IA fait le reste.
            </p>
          </div>

          {/* Selector row: Style + Voice */}
          <div className="flex gap-2 mb-3">

            {/* Style selector */}
            <div ref={styleRef} className="relative">
              <button
                type="button"
                onClick={() => { setShowStylePicker((v) => !v); setShowVoicePicker(false) }}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-body transition-all',
                  style
                    ? 'bg-brand-primary-light border-brand-primary text-brand-primary'
                    : 'bg-brand-bg border-brand-border text-brand-muted hover:border-brand-primary/40 hover:text-brand-text'
                )}
              >
                <span className="text-base leading-none">{selectedStyle?.icon ?? '🎨'}</span>
                <span className="font-medium">{selectedStyle?.label ?? 'Style visuel'}</span>
                <ChevronDown size={13} className={cn('transition-transform', showStylePicker && 'rotate-180')} />
              </button>
              {showStylePicker && (
                <StylePickerDropdown value={style} onChange={setStyle} onClose={() => setShowStylePicker(false)} />
              )}
            </div>

            {/* Voice selector */}
            <div ref={voiceRef} className="relative">
              <button
                type="button"
                onClick={() => { setShowVoicePicker((v) => !v); setShowStylePicker(false) }}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-body transition-all',
                  voiceId
                    ? 'bg-brand-primary-light border-brand-primary text-brand-primary'
                    : 'bg-brand-bg border-brand-border text-brand-muted hover:border-brand-primary/40 hover:text-brand-text'
                )}
              >
                <Mic2 size={14} />
                <span className="font-medium">{selectedVoice?.name ?? 'Voix off'}</span>
                <ChevronDown size={13} className={cn('transition-transform', showVoicePicker && 'rotate-180')} />
              </button>
              {showVoicePicker && (
                <VoicePickerDropdown value={voiceId} voices={voices} onChange={setVoiceId} onClose={() => setShowVoicePicker(false)} />
              )}
            </div>

            {/* Mode toggle: script / audio */}
            <div className="ml-auto flex items-center gap-1 bg-brand-bg border border-brand-border rounded-xl p-1">
              <button type="button" onClick={() => setInputType('script')}
                className={cn('px-3 py-1.5 rounded-lg text-xs font-mono transition-all',
                  inputType === 'script' ? 'bg-white shadow-sm text-brand-text' : 'text-brand-muted hover:text-brand-text')}>
                Script
              </button>
              <button type="button" onClick={() => setInputType('audio')}
                className={cn('px-3 py-1.5 rounded-lg text-xs font-mono transition-all',
                  inputType === 'audio' ? 'bg-white shadow-sm text-brand-text' : 'text-brand-muted hover:text-brand-text')}>
                Audio
              </button>
            </div>
          </div>

          {/* Main prompt card */}
          <div className="rounded-2xl border border-brand-border bg-brand-surface shadow-brand-sm overflow-hidden">
            {inputType === 'script' ? (
              <textarea
                value={script}
                onChange={(e) => setScript(e.target.value)}
                placeholder="Décris ta vidéo... Ajoute un script complet ou simplement ton idée et l'IA générera le contenu."
                maxLength={5000}
                rows={6}
                className="w-full bg-transparent px-5 pt-5 pb-3 text-brand-text font-body text-sm placeholder:text-brand-muted focus:outline-none resize-none"
              />
            ) : (
              <div className="px-5 pt-5 pb-3">
                <label htmlFor="faceless-audio"
                  className={cn('flex flex-col items-center justify-center h-32 rounded-xl border-2 border-dashed cursor-pointer transition-all',
                    audioFile ? 'border-brand-primary bg-brand-primary-light' : 'border-brand-border hover:border-brand-primary/50')}>
                  <Upload size={20} className={cn('mb-2', audioFile ? 'text-brand-primary' : 'text-brand-muted')} />
                  <p className="font-display text-sm font-semibold text-brand-text">
                    {audioFile ? audioFile.name : 'Importer un fichier audio'}
                  </p>
                  <p className="text-xs text-brand-muted mt-0.5">MP3, WAV, M4A — max 50 MB</p>
                  <input ref={fileRef} id="faceless-audio" type="file" accept="audio/mpeg,audio/wav,audio/mp4,audio/m4a" className="hidden"
                    onChange={(e) => setAudioFile(e.target.files?.[0] ?? null)} />
                </label>
              </div>
            )}

            {/* Character count (script mode) */}
            {inputType === 'script' && (
              <div className="px-5 pb-1">
                <span className={cn('font-mono text-[10px]', script.length < 20 ? 'text-red-400' : 'text-brand-muted')}>
                  {script.length}/5000{script.length < 20 && ` · encore ${20 - script.length} car.`}
                </span>
              </div>
            )}

            {/* Toolbar */}
            <div className="flex items-center gap-2 px-4 py-3 border-t border-brand-border/60">

              {/* Settings toggle */}
              <button type="button" onClick={() => setShowSettings((v) => !v)}
                title="Format, durée, Brand Kit"
                className={cn('w-8 h-8 rounded-xl flex items-center justify-center transition-all',
                  showSettings ? 'bg-brand-primary-light text-brand-primary' : 'bg-brand-bg text-brand-muted hover:text-brand-text hover:bg-brand-bg border border-brand-border')}>
                <Settings2 size={14} />
              </button>

              {/* Pro mode */}
              <button type="button" onClick={() => setShowProWizard(true)}
                title="Mode Pro — storyboard avancé"
                className="w-8 h-8 rounded-xl flex items-center justify-center bg-brand-bg border border-brand-border text-brand-muted hover:text-brand-primary hover:border-brand-primary/40 transition-all">
                <Sparkles size={14} />
              </button>

              <div className="flex-1" />

              {/* Title (optional) */}
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="Titre (auto si vide)"
                maxLength={200}
                className="hidden sm:block flex-1 max-w-xs bg-transparent text-brand-text font-body text-sm placeholder:text-brand-muted focus:outline-none border border-brand-border rounded-xl px-3 py-1.5 focus:border-brand-primary transition-colors" />

              {/* Generate button */}
              <button
                type="button"
                onClick={handleGenerate}
                disabled={!canSubmit || launching}
                className={cn(
                  'flex items-center gap-2 px-5 py-2 rounded-xl font-display font-semibold text-sm transition-all',
                  canSubmit && !launching
                    ? 'bg-gray-900 text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100'
                    : 'bg-brand-bg border border-brand-border text-brand-muted cursor-not-allowed'
                )}
              >
                {launching ? <Loader2 size={14} className="animate-spin" /> : <Send size={13} />}
                {launching ? 'Lancement…' : 'Générer'}
              </button>
            </div>

            {/* Settings panel (collapsible) */}
            {showSettings && (
              <div className="px-5 pb-4 pt-1 border-t border-brand-border/60 space-y-4 bg-brand-bg/40">
                {/* Format + Duration */}
                <div className="flex gap-4 flex-wrap pt-2">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-brand-muted mb-2">Format</p>
                    <div className="flex gap-1.5">
                      {FORMATS.map((f) => (
                        <button key={f.id} type="button" onClick={() => setFormat(f.id)}
                          title={f.desc}
                          className={cn('px-3 py-1.5 rounded-lg border text-xs font-display font-semibold transition-all',
                            format === f.id ? 'bg-brand-primary-light border-brand-primary text-brand-primary' : 'bg-brand-bg border-brand-border text-brand-muted hover:border-brand-primary/40')}>
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-brand-muted mb-2">Durée</p>
                    <div className="flex gap-1.5">
                      {DURATIONS.map((d) => (
                        <button key={d.id} type="button" onClick={() => setDuration(d.id)}
                          className={cn('px-3 py-1.5 rounded-lg border text-xs font-display font-semibold transition-all',
                            duration === d.id ? 'bg-brand-primary-light border-brand-primary text-brand-primary' : 'bg-brand-bg border-brand-border text-brand-muted hover:border-brand-primary/40')}>
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                {/* Brand Kit */}
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-brand-muted mb-2">Brand Kit</p>
                  <BrandKitPicker value={brandKitId} onChange={setBrandKitId} />
                </div>
              </div>
            )}
          </div>

          {/* Title input below card (mobile) */}
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="Titre de la vidéo (auto si vide)"
            maxLength={200}
            className="sm:hidden mt-3 w-full bg-brand-surface border border-brand-border rounded-xl px-4 py-2.5 text-brand-text font-body text-sm placeholder:text-brand-muted focus:outline-none focus:border-brand-primary transition-colors" />

        </div>
      </div>

      {/* ── Style gallery ────────────────────────────────────────── */}
      <div className="border-t border-brand-border px-6 py-8 bg-brand-surface/50">
        <div className="max-w-2xl mx-auto">
          <p className="font-mono text-[10px] uppercase tracking-widest text-brand-muted mb-4">Styles disponibles</p>
          <div className="grid grid-cols-4 gap-3">
            {STYLES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStyle(s.id)}
                className={cn(
                  'relative rounded-2xl overflow-hidden transition-all text-left group',
                  style === s.id
                    ? 'ring-2 ring-brand-primary ring-offset-2'
                    : 'hover:scale-[1.02] hover:shadow-brand-md'
                )}
              >
                {/* Gradient preview */}
                <div className={cn('h-20 w-full bg-gradient-to-br', s.gradient, 'flex items-center justify-center')}>
                  <span className="text-2xl drop-shadow">{s.icon}</span>
                </div>
                {/* Info */}
                <div className="p-2.5 bg-brand-surface">
                  <p className="font-display font-bold text-[11px] text-brand-text">{s.label}</p>
                  <p className="font-body text-[10px] text-brand-muted mt-0.5 leading-tight">{s.desc}</p>
                </div>
                {/* Badge */}
                {s.badge && (
                  <span className="absolute top-1.5 right-1.5 font-mono text-[8px] uppercase tracking-wider bg-brand-primary text-white px-1 py-0.5 rounded-full">
                    {s.badge}
                  </span>
                )}
                {/* Selected checkmark */}
                {style === s.id && (
                  <div className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-brand-primary flex items-center justify-center">
                    <Check size={9} className="text-white" />
                  </div>
                )}
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
  const [sessions, setSessions] = useState<VideoSession[]>(initialVideos)
  const [viewId,   setViewId]   = useState<string | null>(() =>
    initialVideos.find((v) => isActive(v.status))?.id ?? null
  )
  const [mode, setMode] = useState<'pro' | null>(null)

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
    setMode(null)
  }

  function handleDone(videoId: string, outputUrl: string | null) {
    updateSessionStatus(videoId, 'done', outputUrl)
  }

  function handleReset() { setViewId(null); setMode(null) }

  return (
    <div className="flex flex-1 h-full overflow-hidden">

      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside className="w-52 bg-brand-surface border-r border-brand-border flex flex-col shrink-0">
        <div className="p-4 border-b border-brand-border flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold text-brand-text">Faceless Video</h2>
          <Wand2 size={14} className="text-brand-muted" />
        </div>

        {/* New video button */}
        <div className="p-3 border-b border-brand-border">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-2 w-full bg-brand-bg border border-brand-border rounded-xl px-3 py-2.5 text-sm font-body text-brand-text hover:border-brand-primary/40 hover:bg-blue-50 transition-all"
          >
            <Plus size={15} className="text-brand-primary" />
            Nouvelle vidéo
          </button>
        </div>

        {/* Sessions list */}
        <div className="flex-1 overflow-y-auto p-2">
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4 py-8">
              <Video size={26} className="text-brand-border mb-2" />
              <p className="text-brand-muted font-body text-xs">Aucune session.</p>
              <p className="text-brand-muted font-body text-xs">Créez votre première vidéo !</p>
            </div>
          ) : (
            <div className="space-y-1">
              {sessions.map((s) => {
                const isCurrent  = viewId === s.id
                const inProgress = isActive(s.status)
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => { setViewId(s.id); setMode(null) }}
                    title={s.title ?? 'Sans titre'}
                    className={cn('w-full text-left px-3 py-2.5 rounded-xl transition-all',
                      isCurrent ? 'bg-blue-50' : 'hover:bg-brand-bg')}
                  >
                    <div className="flex items-center gap-1.5">
                      {inProgress && <Loader2 size={9} className="shrink-0 text-brand-primary animate-spin" />}
                      <p className="font-body text-xs text-brand-text truncate">{s.title ?? 'Sans titre'}</p>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <StatusBadge status={s.status} />
                      <span className="font-mono text-[9px] text-brand-muted">
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

      {/* ── Main panel ──────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden flex flex-col">
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
