'use client'

/**
 * MotionStudio — nouveau parcours Motion Design
 *
 * Flow :
 *   1. Input   — Brief visuel + Script voix off + Voix + Format/Durée
 *   2. Board   — Storyboard généré par Claude · édition par scène · régénération
 *   3. Launch  — Pipeline SSE (même flow que Faceless)
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Sparkles, Loader2, RefreshCw, ChevronRight, AlertCircle,
  CheckCircle2, Mic2, Volume2, Play, Pause, Video,
  Plus, ArrowLeft, Wand2, Upload, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { startMotionGeneration, getVoices } from '@/lib/api'
import { useVideoStatus } from '@/hooks/use-video-status'
import { toast } from '@/components/ui/toast'
import { VideoPlayer } from '@/components/ui/video-player'
import type { VideoFormat, VideoDuration, MotionScene } from '@clyro/shared'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const FORMATS: Array<{ id: VideoFormat; label: string; desc: string }> = [
  { id: '9:16', label: '9:16', desc: 'TikTok · Reels' },
  { id: '1:1',  label: '1:1',  desc: 'Instagram' },
  { id: '16:9', label: '16:9', desc: 'YouTube' },
]

const DURATIONS: Array<{ id: VideoDuration; label: string }> = [
  { id: '15s', label: '15s' },
  { id: '30s', label: '30s' },
  { id: '60s', label: '60s' },
]

const STYLE_LABELS: Record<string, { label: string; color: string }> = {
  hero:        { label: 'Accroche',  color: '#00CFFF' },
  feature:     { label: 'Point clé', color: '#9B59FF' },
  stats:       { label: 'Stats',     color: '#00C896' },
  'text-focus': { label: 'Citation', color: '#FFB347' },
  outro:       { label: 'Outro',     color: '#FF6B6B' },
}

const SCENE_TYPE_LABELS: Record<string, string> = {
  text_hero:         'Texte Hero',
  split_text_image:  'Image + Texte',
  product_showcase:  'Produit',
  stats_counter:     'Statistiques',
  cta_end:           'CTA / Outro',
  image_full:        'Image Plein',
}

const PIPELINE_STEPS = [
  { key: 'storyboard', label: 'Analyse du brief',  pct: 20 },
  { key: 'visuals',    label: 'Génération visuels', pct: 55 },
  { key: 'audio',      label: 'Voix off',           pct: 75 },
  { key: 'assembly',   label: 'Assemblage',         pct: 92 },
  { key: 'done',       label: 'Vidéo prête !',      pct: 100 },
]

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface VoiceItem {
  id: string
  name: string
  gender?: string
  accent?: string
  previewUrl?: string | null
}

interface VideoSession {
  id: string
  title: string | null
  status: string
  output_url?: string | null
  created_at: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Scene Preview Card (CSS live preview — updates reactively)
// ─────────────────────────────────────────────────────────────────────────────

function ScenePreview({ scene }: { scene: MotionScene }) {
  const accent = scene.accent_color || '#00CFFF'
  const parts = scene.text.split(new RegExp(`(${scene.highlight})`, 'i'))

  return (
    <div
      className="relative rounded-xl overflow-hidden flex flex-col items-center justify-center p-4 text-center"
      style={{
        background: `linear-gradient(135deg, #050B14 0%, #0D1B2A 100%)`,
        border: `1px solid ${accent}30`,
        minHeight: 120,
        boxShadow: `0 0 20px ${accent}15`,
      }}
    >
      {/* Accent glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
      />

      {/* Icon */}
      {scene.icon && (
        <span className="text-2xl mb-2 block">{scene.icon}</span>
      )}

      {/* Main text with highlight */}
      <p className="font-bold text-sm leading-tight mb-1" style={{ color: '#fff' }}>
        {parts.map((part: string, i: number) =>
          part.toLowerCase() === scene.highlight?.toLowerCase() ? (
            <span key={i} style={{
              background: `linear-gradient(90deg, ${accent}, #9B59FF)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              {part}
            </span>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </p>

      {/* Subtext */}
      {scene.subtext && (
        <p className="text-[10px] opacity-50 text-white leading-tight">{scene.subtext}</p>
      )}

      {/* Stats */}
      {scene.style === 'stats' && scene.stats && (
        <div className="flex gap-3 mt-2">
          {scene.stats.slice(0, 3).map((s: { value: string; label: string }, i: number) => (
            <div key={i} className="text-center">
              <p className="text-xs font-bold" style={{ color: accent }}>{s.value}</p>
              <p className="text-[9px] text-white/40">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Style badge */}
      <div
        className="absolute bottom-2 right-2 text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-full"
        style={{ background: `${accent}20`, color: accent }}
      >
        {STYLE_LABELS[scene.style]?.label ?? scene.style}
      </div>

      {/* Duration */}
      <div className="absolute top-2 right-2 text-[9px] text-white/30 font-mono">
        {scene.duree_estimee}s
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Scene Editor Card
// ─────────────────────────────────────────────────────────────────────────────

function SceneCard({
  scene,
  onChange,
  onRegenerate,
}: {
  scene: MotionScene
  onChange: (patch: Partial<MotionScene>) => void
  onRegenerate: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const accent = scene.accent_color || '#00CFFF'
  const styleMeta = STYLE_LABELS[scene.style] ?? { label: scene.style, color: '#999' }

  return (
    <div className="border border-navy-700 rounded-xl overflow-hidden bg-navy-800">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 border-b border-navy-700 cursor-pointer select-none"
        onClick={() => setExpanded((v) => !v)}
      >
        <span
          className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0"
          style={{ background: `${styleMeta.color}20`, color: styleMeta.color }}
        >
          {scene.index} · {styleMeta.label}
        </span>
        <p className="flex-1 text-sm font-body text-foreground truncate">{scene.text}</p>
        <span className="text-xs text-[--text-muted] font-mono shrink-0">{scene.duree_estimee}s</span>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRegenerate() }}
          className="shrink-0 p-1.5 rounded-lg text-[--text-muted] hover:text-blue-500 hover:bg-blue-500/10 transition-colors"
          title="Regénérer cette scène"
        >
          <RefreshCw size={13} />
        </button>
      </div>

      {/* Preview (always visible) */}
      <div className="px-4 pt-3">
        <ScenePreview scene={scene} />
      </div>

      {/* Voiceover (always visible) */}
      <div className="px-4 pt-3">
        <label className="block text-[11px] font-body font-medium text-[--text-muted] mb-1">
          🎙 Voix off
        </label>
        <textarea
          value={scene.texte_voix}
          onChange={(e) => onChange({ texte_voix: e.target.value })}
          rows={2}
          className="w-full text-sm font-body text-foreground bg-white border border-navy-700 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 transition-colors resize-none"
        />
      </div>

      {/* Expand / collapse params */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full px-4 py-2.5 text-xs text-[--text-muted] hover:text-foreground flex items-center gap-1.5 transition-colors"
      >
        <span
          className="inline-block transition-transform"
          style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
        >
          ▶
        </span>
        {expanded ? 'Masquer les paramètres Remotion' : 'Modifier les paramètres Remotion'}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-navy-700 pt-3">
          <div className="grid grid-cols-2 gap-3">
            {/* Text */}
            <div className="col-span-2">
              <label className="block text-[11px] font-body font-medium text-[--text-muted] mb-1">Texte principal</label>
              <input
                type="text"
                value={scene.text}
                onChange={(e) => onChange({ text: e.target.value })}
                className="w-full text-sm font-body text-foreground bg-white border border-navy-700 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            {/* Subtext */}
            <div className="col-span-2">
              <label className="block text-[11px] font-body font-medium text-[--text-muted] mb-1">Sous-titre</label>
              <input
                type="text"
                value={scene.subtext}
                onChange={(e) => onChange({ subtext: e.target.value })}
                className="w-full text-sm font-body text-foreground bg-white border border-navy-700 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            {/* Highlight */}
            <div>
              <label className="block text-[11px] font-body font-medium text-[--text-muted] mb-1">
                Mot en gradient
              </label>
              <input
                type="text"
                value={scene.highlight}
                onChange={(e) => onChange({ highlight: e.target.value })}
                className="w-full text-sm font-body text-foreground bg-white border border-navy-700 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            {/* Icon */}
            <div>
              <label className="block text-[11px] font-body font-medium text-[--text-muted] mb-1">Icône</label>
              <input
                type="text"
                value={scene.icon}
                onChange={(e) => onChange({ icon: e.target.value })}
                className="w-full text-sm font-body text-foreground bg-white border border-navy-700 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            {/* Style */}
            <div>
              <label className="block text-[11px] font-body font-medium text-[--text-muted] mb-1">Style</label>
              <select
                value={scene.style}
                onChange={(e) => onChange({ style: e.target.value as MotionScene['style'] })}
                className="w-full text-sm font-body text-foreground bg-white border border-navy-700 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 transition-colors"
              >
                {Object.entries(STYLE_LABELS).map(([id, { label }]) => (
                  <option key={id} value={id}>{label}</option>
                ))}
              </select>
            </div>
            {/* Scene Type (Remotion composition) */}
            <div>
              <label className="block text-[11px] font-body font-medium text-[--text-muted] mb-1">Type de scène</label>
              <select
                value={scene.scene_type ?? 'text_hero'}
                onChange={(e) => onChange({ scene_type: e.target.value as any })}
                className="w-full text-sm font-body text-foreground bg-white border border-navy-700 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 transition-colors"
              >
                {Object.entries(SCENE_TYPE_LABELS).map(([id, label]) => (
                  <option key={id} value={id}>{label}</option>
                ))}
              </select>
            </div>
            {/* Accent color */}
            <div>
              <label className="block text-[11px] font-body font-medium text-[--text-muted] mb-1">Couleur accent</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={scene.accent_color || '#00CFFF'}
                  onChange={(e) => onChange({ accent_color: e.target.value })}
                  className="w-9 h-9 rounded-lg border border-navy-700 cursor-pointer"
                />
                <input
                  type="text"
                  value={scene.accent_color || '#00CFFF'}
                  onChange={(e) => onChange({ accent_color: e.target.value })}
                  className="flex-1 text-xs font-mono text-foreground bg-white border border-navy-700 rounded-lg px-2 py-2 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
            {/* Duration */}
            <div>
              <label className="block text-[11px] font-body font-medium text-[--text-muted] mb-1">Durée (s)</label>
              <input
                type="number"
                min={2}
                max={12}
                value={scene.duree_estimee}
                onChange={(e) => onChange({ duree_estimee: parseInt(e.target.value) || 5 })}
                className="w-full text-sm font-body text-foreground bg-white border border-navy-700 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          {/* Stats editor (only for stats style) */}
          {scene.style === 'stats' && (
            <div>
              <label className="block text-[11px] font-body font-medium text-[--text-muted] mb-2">Statistiques</label>
              <div className="space-y-2">
                {(scene.stats ?? []).map((stat: { value: string; label: string }, i: number) => (
                  <div key={i} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Valeur"
                      value={stat.value}
                      onChange={(e) => {
                        const stats = [...(scene.stats ?? [])]
                        stats[i] = { ...stats[i], value: e.target.value }
                        onChange({ stats })
                      }}
                      className="w-24 text-sm font-body text-foreground bg-white border border-navy-700 rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-500"
                    />
                    <input
                      type="text"
                      placeholder="Label"
                      value={stat.label}
                      onChange={(e) => {
                        const stats = [...(scene.stats ?? [])]
                        stats[i] = { ...stats[i], label: e.target.value }
                        onChange({ stats })
                      }}
                      className="flex-1 text-sm font-body text-foreground bg-white border border-navy-700 rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Voice Picker (reusable)
// ─────────────────────────────────────────────────────────────────────────────

function VoicePicker({
  voiceId,
  onSelect,
}: {
  voiceId: string
  onSelect: (id: string, name: string) => void
}) {
  const [voices, setVoices] = useState<VoiceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [preview, setPreview] = useState<HTMLAudioElement | null>(null)

  useEffect(() => {
    getVoices().then((r) => setVoices(r.public as VoiceItem[])).catch(() => setVoices([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <label className="block text-xs font-body font-medium text-foreground mb-2">
        Voix off <span className="text-[--text-muted] font-normal">(optionnel)</span>
      </label>

      {/* No voice */}
      <button
        type="button"
        onClick={() => onSelect('', 'Pas de voix off')}
        className={cn(
          'w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left mb-2 transition-all',
          voiceId === ''
            ? 'border-blue-500 bg-blue-500/10'
            : 'border-navy-700 bg-navy-800 hover:border-blue-500/40'
        )}
      >
        <div className="w-8 h-8 rounded-full bg-navy-900 border border-navy-700 flex items-center justify-center shrink-0">
          <Mic2 size={14} className="text-[--text-muted]" />
        </div>
        <p className="text-sm font-display font-semibold text-foreground">Pas de voix off</p>
        {voiceId === '' && <CheckCircle2 size={16} className="ml-auto text-blue-500" />}
      </button>

      {loading ? (
        <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin text-[--text-muted]" /></div>
      ) : (
        <div className="space-y-1.5 max-h-44 overflow-y-auto pr-0.5">
          {voices.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => onSelect(v.id, v.name)}
              className={cn(
                'w-full flex items-center gap-3 p-2.5 rounded-xl border-2 text-left transition-all',
                voiceId === v.id
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-navy-700 bg-navy-800 hover:border-blue-500/40'
              )}
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-200 flex items-center justify-center text-xs font-bold text-blue-500 shrink-0">
                {v.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-display font-semibold text-foreground leading-none">{v.name}</p>
                <p className="text-xs text-[--text-muted] mt-0.5 truncate">{[v.gender, v.accent].filter(Boolean).join(' · ')}</p>
              </div>
              {'previewUrl' in v && v.previewUrl && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    preview?.pause()
                    const a = new Audio(v.previewUrl!)
                    a.play()
                    setPreview(a)
                  }}
                  className="p-1 rounded-lg hover:bg-blue-500/10 text-[--text-muted] hover:text-blue-500 transition-colors"
                >
                  <Volume2 size={13} />
                </button>
              )}
              {voiceId === v.id && <CheckCircle2 size={14} className="text-blue-500 shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Generating View
// ─────────────────────────────────────────────────────────────────────────────

function GeneratingView({
  videoId, title, onDone,
}: {
  videoId: string
  title: string
  onDone: (outputUrl: string | null) => void
}) {
  const { status, progress, outputUrl, errorMessage, isDone, isError } = useVideoStatus(videoId)
  const notified = useRef(false)
  const router = useRouter()

  useEffect(() => {
    if (isDone && !notified.current) {
      notified.current = true
      onDone(outputUrl)
      setTimeout(() => router.refresh(), 2500)
    }
  }, [isDone, outputUrl, onDone, router])

  const step = PIPELINE_STEPS.find((p) => p.key === status) ?? PIPELINE_STEPS[0]

  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-6 py-12 px-6">
      <div className={cn(
        'w-14 h-14 rounded-full flex items-center justify-center',
        isError ? 'bg-red-50' : isDone ? 'bg-emerald-50' : 'bg-blue-500/10'
      )}>
        {isError
          ? <AlertCircle size={26} className="text-red-500" />
          : isDone
            ? <CheckCircle2 size={26} className="text-emerald-500" />
            : <Loader2 size={26} className="animate-spin text-blue-500" />
        }
      </div>

      <div className="text-center">
        <h3 className="font-display font-bold text-xl text-foreground">{title}</h3>
        <p className="text-sm text-[--text-muted] mt-1">
          {isError ? errorMessage : isDone ? 'Votre vidéo est prête !' : step.label}
        </p>
      </div>

      {!isError && (
        <div className="w-full max-w-sm">
          <div className="h-1.5 rounded-full bg-navy-700 overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-700"
              style={{ width: `${isDone ? 100 : progress}%` }}
            />
          </div>
          <div className="flex justify-between mt-3">
            {PIPELINE_STEPS.map((p) => (
              <div key={p.key} className="flex flex-col items-center gap-1">
                <div className={cn('w-1.5 h-1.5 rounded-full transition-colors', progress >= p.pct ? 'bg-blue-500' : 'bg-navy-700')} />
                <span className="text-[9px] text-[--text-muted] text-center w-14 leading-tight hidden sm:block">{p.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {isDone && outputUrl && (
        <div className="w-full max-w-sm">
          <VideoPlayer url={outputUrl} title={title} />
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main MotionStudio
// ─────────────────────────────────────────────────────────────────────────────

type Phase = 'input' | 'board' | 'generating'

export function MotionStudio({
  initialVideos,
  onVideoCreated,
}: {
  initialVideos: VideoSession[]
  onVideoCreated?: (id: string, title: string) => void
}) {
  const router = useRouter()

  // ── Sidebar state
  const [sessions, setSessions] = useState<VideoSession[]>(initialVideos)
  const [activeSession, setActiveSession] = useState<VideoSession | null>(null)

  // ── Phase
  const [phase, setPhase] = useState<Phase>('input')

  // ── Input fields
  const [brief, setBrief]   = useState('')
  const [script, setScript] = useState('')
  const [voiceId, setVoiceId] = useState('')
  const [format, setFormat] = useState<VideoFormat>('9:16')
  const [duration, setDuration] = useState<VideoDuration>('30s')

  // ── Logo
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)

  // ── Storyboard
  const [scenes, setScenes] = useState<MotionScene[]>([])
  const [genLoading, setGenLoading] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)

  // ── Generation
  const [videoId, setVideoId] = useState<string | null>(null)
  const [videoTitle, setVideoTitle] = useState('')
  const [launching, setLaunching] = useState(false)

  // ── Logo upload ────────────────────────────────────────────────────────────

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Le fichier doit être une image (PNG, SVG, JPG)')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Le fichier ne doit pas dépasser 5 Mo')
      return
    }
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  function clearLogo() {
    setLogoFile(null)
    if (logoPreview) URL.revokeObjectURL(logoPreview)
    setLogoPreview(null)
    if (logoInputRef.current) logoInputRef.current.value = ''
  }

  // ── Storyboard generation ──────────────────────────────────────────────────

  const generateStoryboard = useCallback(async () => {
    if (!brief.trim() || !script.trim()) return
    setGenLoading(true)
    setGenError(null)
    try {
      const res = await fetch('/api/generate-motion-storyboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief, script, format, duration }),
      })
      const data = await res.json() as { scenes?: MotionScene[]; error?: string }
      if (!res.ok || data.error) throw new Error(data.error ?? 'Erreur de génération')
      setScenes(data.scenes ?? [])
      setPhase('board')
    } catch (e) {
      setGenError(e instanceof Error ? e.message : 'Erreur inconnue')
    } finally {
      setGenLoading(false)
    }
  }, [brief, script, format, duration])

  const regenerateScene = useCallback(async (index: number) => {
    const scene = scenes.find((s) => s.index === index)
    if (!scene) return
    // Re-ask Claude for just this scene keeping the same voix off
    try {
      const res = await fetch('/api/generate-motion-storyboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brief: `Scène ${index} uniquement. Voix off : "${scene.texte_voix}". Style actuel : ${scene.style}. ${brief}`,
          script: scene.texte_voix,
          format,
          duration: `${scene.duree_estimee}s` as VideoDuration,
        }),
      })
      const data = await res.json() as { scenes?: MotionScene[] }
      if (data.scenes?.[0]) {
        const newScene: MotionScene = { ...data.scenes[0], index, texte_voix: scene.texte_voix }
        setScenes((prev) => prev.map((s) => s.index === index ? newScene : s))
      }
    } catch {
      toast.error('Erreur lors de la régénération de la scène')
    }
  }, [scenes, brief, format])

  function updateScene(index: number, patch: Partial<MotionScene>) {
    setScenes((prev) => prev.map((s) => s.index === index ? { ...s, ...patch } : s))
  }

  // ── Launch pipeline ────────────────────────────────────────────────────────

  async function handleLaunch() {
    if (!scenes.length) return
    setLaunching(true)
    const title = scenes[0]?.text ?? 'Motion Design'
    try {
      // Upload logo to Supabase if provided
      let logoUrl: string | undefined
      if (logoFile) {
        const formData = new FormData()
        formData.append('file', logoFile)
        const uploadRes = await fetch('/api/upload-logo', { method: 'POST', body: formData })
        const uploadData = await uploadRes.json() as { url?: string; error?: string }
        if (!uploadRes.ok || uploadData.error) {
          toast.error(uploadData.error ?? 'Erreur upload logo')
        } else {
          logoUrl = uploadData.url
        }
      }

      const res = await startMotionGeneration({
        title,
        brief,
        format,
        duration,
        style: 'dynamique',
        brand_config: {
          primary_color: scenes[0]?.accent_color ?? '#00CFFF',
          style: 'dynamique',
          ...(logoUrl && { logo_url: logoUrl }),
        },
        voice_id: voiceId || undefined,
      })
      setVideoId(res.video_id)
      setVideoTitle(title)
      setPhase('generating')
      setSessions((prev) => [
        { id: res.video_id, title, status: 'processing', created_at: new Date().toISOString() },
        ...prev,
      ])
      onVideoCreated?.(res.video_id, title)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur de lancement')
    } finally {
      setLaunching(false)
    }
  }

  function handleReset() {
    setPhase('input')
    setBrief('')
    setScript('')
    setVoiceId('')
    setScenes([])
    setGenError(null)
    setVideoId(null)
    setActiveSession(null)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-1 h-full overflow-hidden">

      {/* ── Sidebar ── */}
      <aside className="w-52 bg-navy-800 border-r border-navy-700 flex flex-col shrink-0">
        <div className="p-4 border-b border-navy-700">
          <h2 className="font-display text-sm font-semibold text-foreground">Motion Design</h2>
        </div>
        <div className="p-3 border-b border-navy-700">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-2 w-full bg-navy-900 border border-navy-700 rounded-xl px-3 py-2.5 text-sm font-body text-foreground hover:border-blue-500/40 hover:bg-blue-50 transition-all"
          >
            <Plus size={16} className="text-blue-500" />
            Nouvelle vidéo
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4 py-8">
              <Video size={28} className="text-navy-700 mb-2" />
              <p className="text-[--text-muted] font-body text-xs">Aucune session encore.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {sessions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActiveSession(s)}
                  className={cn(
                    'w-full text-left px-3 py-2 rounded-xl text-xs font-body transition-all',
                    activeSession?.id === s.id
                      ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                      : 'text-foreground hover:bg-navy-900 border border-transparent'
                  )}
                >
                  <p className="font-semibold truncate">{s.title ?? 'Sans titre'}</p>
                  <p className="text-[--text-muted] mt-0.5 truncate">
                    {s.status === 'done' ? '✓ Prête' : s.status}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* ── Main panel ── */}
      <div className="flex-1 overflow-hidden flex flex-col">

        {/* Phase : input */}
        {phase === 'input' && (
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">

              {/* Header */}
              <div>
                <h1 className="font-display text-2xl font-bold text-foreground">Créer une vidéo Motion</h1>
                <p className="text-sm text-[--text-muted] mt-1">
                  Décrivez l'ambiance visuelle, entrez votre script — Claude génère le storyboard.
                </p>
              </div>

              {/* Brief */}
              <div>
                <label className="block text-sm font-body font-semibold text-foreground mb-1.5">
                  Brief visuel <span className="text-red-400">*</span>
                </label>
                <p className="text-xs text-[--text-muted] mb-2">
                  Style, ambiance, couleurs, émotion recherchée. Ex: "Vidéo dark tech pour une startup IA, tons bleu-violet, rythme dynamique."
                </p>
                <textarea
                  value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                  placeholder="Décrivez l'ambiance visuelle et le style de votre vidéo…"
                  rows={4}
                  className="w-full border border-navy-700 rounded-xl px-4 py-3 text-sm font-body text-foreground placeholder:text-[--text-muted] bg-navy-800 focus:outline-none focus:border-blue-500 focus:bg-white transition-colors resize-none"
                />
              </div>

              {/* Script */}
              <div>
                <label className="block text-sm font-body font-semibold text-foreground mb-1.5">
                  Script voix off <span className="text-red-400">*</span>
                </label>
                <p className="text-xs text-[--text-muted] mb-2">
                  Le texte exact qui sera lu par la voix off. Claude le découpera en scènes.
                </p>
                <textarea
                  value={script}
                  onChange={(e) => setScript(e.target.value)}
                  placeholder="Entrez ici le texte complet de votre voix off…"
                  rows={6}
                  className="w-full border border-navy-700 rounded-xl px-4 py-3 text-sm font-body text-foreground placeholder:text-[--text-muted] bg-navy-800 focus:outline-none focus:border-blue-500 focus:bg-white transition-colors resize-none"
                />
                <p className={cn('text-xs mt-1 text-right', script.length < 20 ? 'text-[--text-muted]' : 'text-emerald-600')}>
                  {script.length} caractères
                </p>
              </div>

              {/* Format + Duration */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-body font-semibold text-foreground mb-2">Format</label>
                  <div className="flex gap-2">
                    {FORMATS.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setFormat(f.id)}
                        className={cn(
                          'flex-1 py-2 rounded-xl border-2 text-xs font-body font-semibold transition-all',
                          format === f.id
                            ? 'border-blue-500 bg-blue-500/10 text-blue-500'
                            : 'border-navy-700 text-[--text-muted] hover:border-blue-500/40'
                        )}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-body font-semibold text-foreground mb-2">Durée</label>
                  <div className="flex gap-2">
                    {DURATIONS.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => setDuration(d.id)}
                        className={cn(
                          'flex-1 py-2 rounded-xl border-2 text-xs font-body font-semibold transition-all',
                          duration === d.id
                            ? 'border-blue-500 bg-blue-500/10 text-blue-500'
                            : 'border-navy-700 text-[--text-muted] hover:border-blue-500/40'
                        )}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Voice */}
              <VoicePicker voiceId={voiceId} onSelect={(id) => setVoiceId(id)} />

              {/* Logo upload */}
              <div>
                <label className="block text-sm font-body font-semibold text-foreground mb-1.5">
                  Logo <span className="text-[--text-muted] font-normal">(optionnel)</span>
                </label>
                <p className="text-xs text-[--text-muted] mb-2">
                  Votre logo sera incrusté dans la vidéo si fourni. PNG ou SVG transparent recommandé.
                </p>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/svg+xml,image/jpeg,image/webp"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                {logoPreview ? (
                  <div className="flex items-center gap-3 border border-navy-700 rounded-xl px-4 py-3 bg-navy-800">
                    <img src={logoPreview} alt="Logo preview" className="w-10 h-10 object-contain rounded-lg bg-white p-1 border border-navy-700" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-body text-foreground truncate">{logoFile?.name}</p>
                      <p className="text-xs text-[--text-muted]">{logoFile ? `${(logoFile.size / 1024).toFixed(0)} Ko` : ''}</p>
                    </div>
                    <button type="button" onClick={clearLogo}
                      className="shrink-0 p-1.5 rounded-lg text-[--text-muted] hover:text-red-500 hover:bg-red-50 transition-colors">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-navy-700 rounded-xl px-4 py-4 text-sm font-body text-[--text-muted] hover:border-blue-500/40 hover:text-blue-500 transition-colors"
                  >
                    <Upload size={16} />
                    Importer un logo
                  </button>
                )}
              </div>

              {/* Error */}
              {genError && (
                <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
                  <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-600">{genError}</p>
                </div>
              )}

              {/* CTA */}
              <button
                type="button"
                onClick={generateStoryboard}
                disabled={!brief.trim() || script.trim().length < 20 || genLoading}
                className="w-full flex items-center justify-center gap-2 bg-foreground text-white font-display font-semibold text-sm px-5 py-3.5 rounded-xl disabled:opacity-40 hover:opacity-80 transition-opacity"
              >
                {genLoading
                  ? <><Loader2 size={16} className="animate-spin" /> Génération du storyboard…</>
                  : <><Sparkles size={16} /> Générer le storyboard</>
                }
              </button>
            </div>
          </div>
        )}

        {/* Phase : board */}
        {phase === 'board' && (
          <div className="flex flex-col h-full overflow-hidden">
            {/* Board topbar */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-navy-700 shrink-0">
              <button
                type="button"
                onClick={() => setPhase('input')}
                className="flex items-center gap-1.5 text-sm text-[--text-muted] hover:text-foreground transition-colors"
              >
                <ArrowLeft size={15} />
                Modifier le brief
              </button>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={generateStoryboard}
                  disabled={genLoading}
                  className="flex items-center gap-1.5 text-xs text-blue-500 border border-blue-500/30 rounded-lg px-3 py-1.5 hover:bg-blue-500/10 transition-colors disabled:opacity-50"
                >
                  <RefreshCw size={12} className={cn(genLoading && 'animate-spin')} />
                  Tout regénérer
                </button>
                <button
                  type="button"
                  onClick={handleLaunch}
                  disabled={launching || scenes.length === 0}
                  className="flex items-center gap-2 bg-foreground text-white font-display font-semibold text-sm px-4 py-2 rounded-xl disabled:opacity-40 hover:opacity-80 transition-opacity"
                >
                  {launching
                    ? <Loader2 size={14} className="animate-spin" />
                    : <Wand2 size={14} />
                  }
                  Lancer la génération
                </button>
              </div>
            </div>

            {/* Scenes grid */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {genLoading ? (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <Sparkles size={28} className="text-blue-500 animate-pulse" />
                  <p className="text-sm text-[--text-muted]">Régénération du storyboard…</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
                  {scenes.map((scene) => (
                    <SceneCard
                      key={scene.index}
                      scene={scene}
                      onChange={(patch) => updateScene(scene.index, patch)}
                      onRegenerate={() => regenerateScene(scene.index)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Phase : generating */}
        {phase === 'generating' && videoId && (
          <GeneratingView
            videoId={videoId}
            title={videoTitle}
            onDone={(url) => {
              setSessions((prev) =>
                prev.map((s) => s.id === videoId ? { ...s, status: 'done', output_url: url ?? undefined } : s)
              )
            }}
          />
        )}
      </div>
    </div>
  )
}
